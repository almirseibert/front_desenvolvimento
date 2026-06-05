import React, { useState, useMemo } from 'react';
import { 
    PlusCircle, Download, Edit, Trash2, RefreshCw, MapPin, 
    AlertTriangle, Search, CheckCircle, Clock 
} from 'lucide-react';
import ProtectedComponent from '../components/ProtectedComponent';

// Importação dos Modais
import ObraModal from '../components/modals/ObraModal'; 
import ObraDetailModal from '../components/modals/ObraDetailModal';
import ManualFinishObraModal from '../components/modals/ManualFinishObraModal';

const ObrasPage = ({
    user,
    vehicles = [],
    obras = [],
    PasswordConfirmationModal,
    setAlertMessage,
    vehicleGroups = {},
    employees = [],
    apiClient,
    reloadData,
}) => {
    // --- ESTADOS DA PÁGINA ---
    const [filter, setFilter] = useState('ativas'); // 'ativas' | 'finalizadas'
    const [tipoFilter, setTipoFilter] = useState('todos'); // 'todos' | 'obra' | 'centro_custo'
    const [regiaoFilter, setRegiaoFilter] = useState('todas'); // 'todas' | 'Lajeado' | 'Santa Maria'
    const [searchTerm, setSearchTerm] = useState('');
    
    // --- ESTADOS DOS MODAIS ---
    const [modalState, setModalState] = useState({
        createEdit: false,
        detail: false,
        finish: false,
        delete: false
    });
    const [selectedObra, setSelectedObra] = useState(null);

    // --- LÓGICA DE TIPOS DE EQUIPAMENTOS ---
    const derivedEquipmentTypes = useMemo(() => {
        const types = [];
        Object.entries(vehicleGroups).forEach(([groupName, groupTypes]) => {
            const name = groupName.toLowerCase();
            // Exclui categorias não cobráveis por hora no contrato
            if (name.includes('veículos leves') || name.includes('veiculos leves')) return;
            if (name.includes('caminhões de trecho') || name.includes('caminhoes de trecho')) return;

            if (Array.isArray(groupTypes)) {
                types.push(...groupTypes);
            }
        });
        return [...new Set(types)].sort();
    }, [vehicleGroups]);

    // --- HELPER: Cores do Card Baseado em Progresso ---
    const getCardBorderColor = (obra) => {
        if (obra.status === 'finalizada') return '#9ca3af';
        if (obra.tipo_registro !== 'centro_custo' && (!obra.orgao_contratante || !obra.regiao)) return '#f97316'; // laranja: informações pendentes
        if (obra.contractType === 'horas') {
            const contratado = Object.values(obra.horasContratadasPorTipo || {}).reduce((s, h) => s + (parseFloat(h) || 0), 0);
            const realizado = obra.totalHorasRealizadas || 0;
            if (contratado === 0) return '#0ea5e9';
            const pct = (realizado / contratado) * 100;
            if (pct >= 100) return '#b03828';
            if (pct >= 70) return '#8b5cf6';
            if (pct >= 30) return '#9E7A42';
            return '#10b981';
        }
        return '#10b981';
    };

    // --- HANDLERS ---
    const openModal = (type, obra = null) => {
        // VALIDAR FINALIZAÇÃO
        if (type === 'finish' && obra) {
            const activeCount = (obra.historicoVeiculos || []).filter(h => !h.dataSaida).length;
            if (activeCount > 0) {
                setAlertMessage("Não é possível finalizar esta obra pois existem veículos alocados. Por favor, realize a saída de todos os veículos e funcionários antes de finalizar.");
                return;
            }
        }

        setSelectedObra(obra);
        setModalState(prev => ({ ...prev, [type]: true }));
    };

    const closeModal = (type) => {
        setModalState(prev => ({ ...prev, [type]: false }));
        if (type !== 'detail') setSelectedObra(null);
    };

    const handleDelete = async () => {
        if (!selectedObra) return;
        try {
            await apiClient.deleteObra(selectedObra.id);
            setAlertMessage("Obra excluída com sucesso!");
            reloadData();
        } catch (error) {
            console.error("Erro ao excluir:", error);
            setAlertMessage(error.message || "Erro ao excluir obra.");
        } finally {
            closeModal('delete');
        }
    };

    const handleReactivate = async (obra) => {
        try {
            await apiClient.updateObra(obra.id, { status: 'ativa' });
            setAlertMessage("Obra reativada!");
            reloadData();
        } catch (error) {
            setAlertMessage("Erro ao reativar obra.");
        }
    };

    // --- FILTROS E ORDENAÇÃO ---
    const filteredObras = useMemo(() => {
        return (obras || [])
            .filter(o => {
                const statusMatch = filter === 'finalizadas' ? o.status === 'finalizada' : o.status !== 'finalizada';
                const searchMatch = (o.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || (o.orgao_contratante || '').toLowerCase().includes(searchTerm.toLowerCase());
                const tipoMatch = tipoFilter === 'todos' || (o.tipo_registro || 'obra') === tipoFilter;
                const regiaoMatch = regiaoFilter === 'todas' || o.regiao === regiaoFilter;
                return statusMatch && searchMatch && tipoMatch && regiaoMatch;
            })
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }, [obras, filter, tipoFilter, searchTerm]);

    const exportToCSV = () => {
        if (!filteredObras || filteredObras.length === 0) {
             setAlertMessage("Nenhuma obra para exportar.");
             return;
         }
        const headers = ['Tipo de Registro', 'Nome', 'Status', 'Responsável', 'Fiscal', 'Data Início', 'Data Fim', 'Tipo de Contrato', 'Horas Contratadas', 'Horas Realizadas', 'Latitude', 'Longitude'];
        const rows = filteredObras.map(o => {
            const contractedHours = Object.values(o.horasContratadasPorTipo || {}).reduce((sum, h) => sum + (parseFloat(h) || 0), 0);
            return [
                o.tipo_registro === 'centro_custo' ? 'Centro de Custo' : 'Obra',
                o.nome,
                o.status,
                o.responsavel || '',
                o.fiscal || '',
                o.dataInicio ? new Date(o.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A',
                o.dataFim ? new Date(o.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A',
                o.contractType === 'horas' ? 'Horas Trabalhadas' : 'Metros Quadrados',
                contractedHours.toFixed(1),
                (o.totalHorasRealizadas || 0).toFixed(1),
                o.latitude || '',
                o.longitude || ''
            ];
        });
        const csvRows = rows.map(row =>
            row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n' + csvRows;
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', 'obras.csv');
        link.click();
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-fadeIn">
            
            {/* TOPO */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e1a14' }}>Obras</h1>
                    <p style={{ fontSize: 13, color: '#9a8a78', marginTop: 2 }}>Gerencie contratos, alocações e progresso financeiro.</p>
                </div>
                <ProtectedComponent requiredPermission="editor">
                    <div className="flex gap-2">
                        <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-2 font-semibold rounded-lg transition text-sm mak-btn mak-btn-cancel">
                            <Download size={15}/> CSV
                        </button>
                        <button onClick={() => openModal('createEdit')} className="flex items-center gap-2 px-3 py-2 font-bold rounded-lg transition text-sm mak-btn mak-btn-primary">
                            <PlusCircle size={16}/> {tipoFilter === 'centro_custo' ? 'Novo Centro de Custo' : 'Nova Obra'}
                        </button>
                    </div>
                </ProtectedComponent>
            </div>

            {/* CONTROLES DE FILTRO */}
            <div className="bg-white p-4 rounded-xl mb-6 flex flex-col md:flex-row justify-between items-center gap-4" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
                <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                    {/* Filtro status */}
                    <div className="flex p-1 rounded-lg" style={{ background: '#f5f2ed' }}>
                        {[['ativas', 'Em Andamento'], ['finalizadas', 'Finalizadas']].map(([val, lbl]) => (
                            <button key={val} onClick={() => setFilter(val)}
                                className="px-3 py-1.5 text-sm font-medium rounded-md transition-all"
                                style={{ background: filter === val ? '#fff' : 'transparent', color: filter === val ? '#9E7A42' : '#9a8a78', boxShadow: filter === val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', border: 'none', cursor: 'pointer' }}
                            >{lbl}</button>
                        ))}
                    </div>
                    {/* Filtro tipo */}
                    <div className="flex p-1 rounded-lg" style={{ background: '#f5f2ed' }}>
                        {[['todos', 'Todos'], ['obra', 'Obras'], ['centro_custo', 'Centros de Custo']].map(([val, lbl]) => (
                            <button key={val} onClick={() => setTipoFilter(val)}
                                className="px-3 py-1.5 text-sm font-medium rounded-md transition-all"
                                style={{ background: tipoFilter === val ? '#fff' : 'transparent', color: tipoFilter === val ? '#9E7A42' : '#9a8a78', boxShadow: tipoFilter === val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', border: 'none', cursor: 'pointer' }}
                            >{lbl}</button>
                        ))}
                    </div>
                    {/* Filtro região */}
                    <div className="flex p-1 rounded-lg" style={{ background: '#f5f2ed' }}>
                        {['todas', 'Lajeado', 'Santa Maria'].map(r => (
                            <button key={r} onClick={() => setRegiaoFilter(r)}
                                className="px-3 py-1.5 text-sm font-medium rounded-md transition-all"
                                style={{ background: regiaoFilter === r ? '#fff' : 'transparent', color: regiaoFilter === r ? '#9E7A42' : '#9a8a78', boxShadow: regiaoFilter === r ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', border: 'none', cursor: 'pointer' }}
                            >{r === 'todas' ? 'Todas Regiões' : r}</button>
                        ))}
                    </div>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5" size={15} style={{ color: '#b0a090' }} />
                    <input
                        type="text"
                        placeholder="Buscar obra..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full"
                    />
                </div>
            </div>

            {/* GRID DE CARDS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredObras.map(obra => {
                    const totalContrato = Object.values(obra.horasContratadasPorTipo || {}).reduce((s, h) => s + (parseFloat(h) || 0), 0);
                    const tipoContratoLabel = obra.contractType === 'metrosQuadrados' ? 'Produção' : 'Horas';
                    const activeCount = (obra.historicoVeiculos || []).filter(h => !h.dataSaida).length;
                    
                    // Dados reais vindos do controller (faturamento)
                    const totalRealizado = parseFloat(obra.totalHorasRealizadas) || 0;
                    
                    // Cálculo de porcentagem para barra de progresso do card
                    const progressPercent = totalContrato > 0 ? (totalRealizado / totalContrato) * 100 : 0;
                    const cardBorderColor = getCardBorderColor(obra);

                    return (
                        <div key={obra.id} className="bg-white rounded-xl p-5 flex flex-col justify-between h-full transition-shadow hover:shadow-md" style={{ border: '1px solid #f0ebe3', borderLeft: `4px solid ${cardBorderColor}`, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>

                            {/* Header do Card */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="min-w-0 flex-1">
                                    {obra.tipo_registro === 'centro_custo' && (
                                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#ede9fe', color: '#3730a3', border: '1px solid #ddd6fe', borderRadius: 9999, padding: '2px 7px', display: 'inline-block', marginBottom: 4 }}>
                                            Centro de Custo
                                        </span>
                                    )}
                                    {obra.tipo_registro !== 'centro_custo' && (!obra.orgao_contratante || !obra.regiao) && (
                                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 9999, padding: '2px 7px', display: 'inline-block', marginBottom: 4 }}>
                                            ⚠ Informações Pendentes
                                        </span>
                                    )}
                                    <h3 className="line-clamp-1" style={{ fontSize: 14, fontWeight: 700, color: '#3d3528' }} title={obra.nome}>
                                        {obra.orgao_contratante && (
                                            <span style={{ color: '#b0a090', fontWeight: 400 }}>[{obra.orgao_contratante}] </span>
                                        )}
                                        {obra.nome}
                                    </h3>
                                    {obra.latitude && (
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${obra.latitude},${obra.longitude}`} target="_blank" rel="noreferrer"
                                            style={{ fontSize: 11, color: '#2d5a8a', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                            <MapPin size={11}/> Ver no Mapa
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 ml-2 shrink-0">
                                    <ProtectedComponent requiredPermission="obra-editor">
                                        <button onClick={() => openModal('createEdit', obra)}
                                            style={{ padding: 5, background: 'transparent', border: 'none', borderRadius: 6, color: '#b0a090', cursor: 'pointer', lineHeight: 0 }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#fdf8f0'; e.currentTarget.style.color = '#9E7A42'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b0a090'; }}>
                                            <Edit size={15}/>
                                        </button>
                                    </ProtectedComponent>
                                </div>
                            </div>

                            {/* Corpo do Card */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between py-1.5" style={{ borderBottom: '1px dashed #f0ebe3' }}>
                                    <span style={{ fontSize: 12, color: '#9a8a78' }}>Contrato</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6a5e4e' }}>{tipoContratoLabel}</span>
                                </div>

                                {obra.contractType === 'horas' && (
                                    <>
                                        <div className="flex justify-between py-1">
                                            <span style={{ fontSize: 12, color: '#9a8a78' }}>Realizado / Contratado</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#3d3528' }}>
                                                {totalRealizado.toFixed(1)} / {totalContrato.toFixed(1)} hrs
                                            </span>
                                        </div>
                                        <div className="w-full rounded-full" style={{ height: 6, background: '#f0ebe3' }}>
                                            <div style={{ height: 6, borderRadius: 9999, width: `${Math.min(progressPercent, 100)}%`, background: progressPercent > 100 ? '#b03828' : progressPercent > 80 ? '#f97316' : '#9E7A42', transition: 'width 0.3s' }}/>
                                        </div>
                                    </>
                                )}

                                <div className="flex justify-between py-1">
                                    <span style={{ fontSize: 12, color: '#9a8a78', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/> Equipamentos Ativos</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: activeCount > 0 ? '#e0f2fe' : '#f5f2ed', color: activeCount > 0 ? '#0c4a6e' : '#9a8a78' }}>
                                        {activeCount}
                                    </span>
                                </div>
                            </div>

                            {/* Rodapé do Card */}
                            <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #f0ebe3' }}>
                                <button onClick={() => openModal('detail', obra)}
                                    className="flex-1 py-2 text-sm font-medium rounded-lg transition mak-btn mak-btn-cancel">
                                    Gerenciar
                                </button>

                                <ProtectedComponent requiredPermission="obra-editor">
                                    {obra.status === 'ativa' ? (
                                        <button onClick={() => openModal('finish', obra)}
                                            style={{ padding: '6px 12px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 8, cursor: 'pointer', lineHeight: 0 }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#a7f3d0'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#d1fae5'}
                                            title="Finalizar Obra">
                                            <CheckCircle size={16}/>
                                        </button>
                                    ) : (
                                        <button onClick={() => handleReactivate(obra)}
                                            style={{ padding: '6px 12px', background: '#fdf8f0', color: '#9E7A42', border: '1px solid #e8d8b8', borderRadius: 8, cursor: 'pointer', lineHeight: 0 }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#fde68a'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#fdf8f0'}
                                            title="Reativar">
                                            <RefreshCw size={16}/>
                                        </button>
                                    )}
                                </ProtectedComponent>

                                <ProtectedComponent requiredPermission="admin">
                                    <button onClick={() => openModal('delete', obra)}
                                        style={{ padding: '6px 12px', background: '#fdf0ec', color: '#b03828', border: 'none', borderRadius: 8, cursor: 'pointer', lineHeight: 0 }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fce8e4'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#fdf0ec'}
                                        title="Excluir">
                                        <Trash2 size={16}/>
                                    </button>
                                </ProtectedComponent>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredObras.length === 0 && (
                <div className="text-center py-20 rounded-xl mt-6" style={{ background: '#faf9f7', border: '1px dashed #d4c8b8' }}>
                    <AlertTriangle className="mx-auto mb-4" size={40} style={{ color: '#d4c8b8' }}/>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#9a8a78' }}>Nenhuma obra encontrada</h3>
                    <p style={{ fontSize: 13, color: '#b0a090', marginTop: 4 }}>Tente ajustar os filtros ou criar uma nova obra.</p>
                </div>
            )}

            {/* --- MODAIS --- */}
            
            {modalState.createEdit && (
                <ObraModal
                    user={user}
                    obra={selectedObra}
                    onClose={() => closeModal('createEdit')}
                    apiClient={apiClient}
                    reloadData={reloadData}
                    setAlertMessage={setAlertMessage}
                    equipmentTypesForHours={derivedEquipmentTypes}
                    initialTipoRegistro={selectedObra ? (selectedObra.tipo_registro || 'obra') : (tipoFilter !== 'todos' ? tipoFilter : 'obra')}
                />
            )}

            {modalState.detail && selectedObra && (
                <ObraDetailModal 
                    user={user}
                    obra={selectedObra} 
                    vehicles={vehicles}
                    onClose={() => closeModal('detail')} 
                    setAlertMessage={setAlertMessage} 
                    apiClient={apiClient} 
                    reloadData={reloadData}
                    vehicleGroups={vehicleGroups}
                    equipmentTypesForHours={derivedEquipmentTypes}
                    employees={employees}
                />
            )}

            {modalState.finish && selectedObra && (
                <ManualFinishObraModal 
                    obra={selectedObra} 
                    onClose={() => closeModal('finish')} 
                    apiClient={apiClient} 
                    reloadData={reloadData} 
                    setAlertMessage={setAlertMessage} 
                />
            )}

            {modalState.delete && selectedObra && (
                <PasswordConfirmationModal 
                    message={`Tem certeza que deseja excluir a obra "${selectedObra.nome}"? Esta ação deletará TODO o histórico de veículos desta obra e não poderá ser desfeita.`}
                    onConfirm={handleDelete} 
                    onClose={() => closeModal('delete')} 
                    apiClient={apiClient} 
                />
            )}

        </div>
    );
};

export default ObrasPage;