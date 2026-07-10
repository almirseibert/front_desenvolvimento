import React, { useState, useMemo } from 'react';
import { 
    PlusCircle, Download, Edit, Trash2, RefreshCw, MapPin, 
    AlertTriangle, Search, CheckCircle
} from 'lucide-react';
import ProtectedComponent from '../components/ProtectedComponent';

// Importação dos Modais
import ObraModal from '../components/modals/ObraModal'; 
import ObraDetailModal from '../components/modals/ObraDetailModal';
import ManualFinishObraModal from '../components/modals/ManualFinishObraModal';
import { formatObraNome } from '../utils/obraFormat';

// Fases reais de uma obra (espelha OBRA_FASES do ObraModal) + finalizada.
// Fonte única de verdade para rótulo e cor de cada status, evitando divergência
// entre o filtro, o badge da listagem e a cor da borda do card.
const STATUS_META = {
    radar:       { label: 'No radar',       color: '#f59e0b' },
    planejada:   { label: 'Planejada',      color: '#f59e0b' },
    mobilizacao: { label: 'Em mobilização', color: '#f59e0b' },
    ativa:       { label: 'Em operação',    color: '#10b981' },
    finalizada:  { label: 'Finalizada',     color: '#9ca3af' },
};
const STATUS_ORDER = ['radar', 'planejada', 'mobilizacao', 'ativa', 'finalizada'];

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
    const [filter, setFilter] = useState('todos'); // 'todos' | 'radar' | 'planejada' | 'mobilizacao' | 'ativa' | 'finalizada'
    const [tipoFilter, setTipoFilter] = useState('todos'); // 'todos' | 'obra' | 'centro_custo'
    const [regiaoFilter, setRegiaoFilter] = useState('todas'); // 'todas' | 'Lajeado' | 'Santa Maria'
    const [orgaoFilter, setOrgaoFilter] = useState('todos'); // 'todos' | <nome do órgão>
    const [sortBy, setSortBy] = useState('nome-asc'); // ordenação da listagem
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

    // --- ESTILOS DOS CONTROLES DE FILTRO ---
    const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9a8a78', whiteSpace: 'nowrap' };
    const selectStyle = { fontSize: 13, color: '#3d3528', background: '#f5f2ed', border: '1px solid #ece5da', borderRadius: 8, padding: '6px 28px 6px 10px', cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239a8a78\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' };

    // --- HELPER: Cores do Card Baseado em Progresso ---
    const getCardBorderColor = (obra) => {
        if (obra.status === 'finalizada') return '#9ca3af';
        if (['radar', 'planejada', 'mobilizacao'].includes(obra.status)) return '#f59e0b'; // âmbar: fase de planejamento
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

    // --- LISTA DE ÓRGÃOS CONTRATANTES (para o filtro) ---
    const orgaosContratantes = useMemo(() => {
        const set = new Set();
        (obras || []).forEach(o => { if (o.orgao_contratante) set.add(o.orgao_contratante); });
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [obras]);

    // --- FILTROS E ORDENAÇÃO ---
    const filteredObras = useMemo(() => {
        // "Abertura" = quando o registro da obra foi criado. Obras pré-ativas
        // gravam dataInicio=null (só é preenchido na 1ª alocação), então usamos
        // created_at como fonte primária e dataInicio como fallback legado.
        const openTime = (o) => {
            const raw = o.created_at || o.dataInicio;
            return raw ? new Date(raw).getTime() : 0;
        };
        const activeCount = (o) => (o.historicoVeiculos || []).filter(h => !h.dataSaida).length;

        // Normaliza para busca sem acento/caixa: "Candido" casa com "Cândido".
        const normalize = (s) => (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '');
        const term = normalize(searchTerm);

        const sorters = {
            'nome-asc': (a, b) => (a.nome || '').localeCompare(b.nome || ''),
            'nome-desc': (a, b) => (b.nome || '').localeCompare(a.nome || ''),
            'abertura-recente': (a, b) => openTime(b) - openTime(a),
            'abertura-antiga': (a, b) => openTime(a) - openTime(b),
            'equip-desc': (a, b) => activeCount(b) - activeCount(a),
        };

        return (obras || [])
            .filter(o => {
                const statusMatch = filter === 'todos' || o.status === filter;
                const searchMatch = normalize(o.nome).includes(term) || normalize(o.orgao_contratante).includes(term);
                const tipoMatch = tipoFilter === 'todos' || (o.tipo_registro || 'obra') === tipoFilter;
                const regiaoMatch = regiaoFilter === 'todas' || o.regiao === regiaoFilter;
                const orgaoMatch = orgaoFilter === 'todos' || o.orgao_contratante === orgaoFilter;
                return statusMatch && searchMatch && tipoMatch && regiaoMatch && orgaoMatch;
            })
            .sort(sorters[sortBy] || sorters['nome-asc']);
    }, [obras, filter, tipoFilter, regiaoFilter, orgaoFilter, sortBy, searchTerm]);

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
                    <p style={{ fontSize: 13, color: '#9a8a78', marginTop: 2 }}>Cadastro e gerenciamento de obras e centros de custo.</p>
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
            <div className="bg-white p-4 rounded-xl mb-6" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
                {/* Linha 1: busca + ordenação */}
                <div className="flex flex-col md:flex-row gap-3 md:items-center mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5" size={15} style={{ color: '#b0a090' }} />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou órgão contratante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span style={labelStyle}>Ordenar por</span>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
                            <option value="nome-asc">Nome (A → Z)</option>
                            <option value="nome-desc">Nome (Z → A)</option>
                            <option value="abertura-recente">Abertura (mais recente)</option>
                            <option value="abertura-antiga">Abertura (mais antiga)</option>
                            <option value="equip-desc">Equipamentos ativos</option>
                        </select>
                    </div>
                </div>

                {/* Linha 2: filtros */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3" style={{ borderTop: '1px solid #f5f2ed' }}>
                    <div className="flex items-center gap-2">
                        <span style={labelStyle}>Status</span>
                        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={selectStyle}>
                            <option value="todos">Todos</option>
                            {STATUS_ORDER.map(s => (
                                <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span style={labelStyle}>Tipo</span>
                        <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} style={selectStyle}>
                            <option value="todos">Todos</option>
                            <option value="obra">Obras</option>
                            <option value="centro_custo">Centros de Custo</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span style={labelStyle}>Região</span>
                        <select value={regiaoFilter} onChange={(e) => setRegiaoFilter(e.target.value)} style={selectStyle}>
                            <option value="todas">Todas</option>
                            <option value="Lajeado">Lajeado</option>
                            <option value="Santa Maria">Santa Maria</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span style={labelStyle}>Órgão</span>
                        <select value={orgaoFilter} onChange={(e) => setOrgaoFilter(e.target.value)} style={{ ...selectStyle, maxWidth: 200 }}>
                            <option value="todos">Todos</option>
                            {orgaosContratantes.map(org => (
                                <option key={org} value={org}>{org}</option>
                            ))}
                        </select>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#9a8a78', whiteSpace: 'nowrap' }}>
                        {filteredObras.length} {filteredObras.length === 1 ? 'registro' : 'registros'}
                    </span>
                </div>
            </div>

            {/* LISTAGEM (TABELA) */}
            {filteredObras.length > 0 ? (
                <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#faf9f7', borderBottom: '1px solid #f0ebe3' }}>
                                    {['Nome', 'Tipo', 'Região', 'Órgão Contratante', 'Status', 'Equip. Ativos'].map((h, i) => (
                                        <th key={h} style={{ textAlign: i >= 4 ? 'center' : 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9a8a78', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                    <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9a8a78' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredObras.map(obra => {
                                    const activeCount = (obra.historicoVeiculos || []).filter(h => !h.dataSaida).length;
                                    const isCentroCusto = obra.tipo_registro === 'centro_custo';
                                    const orgaoPendente = !isCentroCusto && !obra.orgao_contratante;
                                    const regiaoPendente = !isCentroCusto && !obra.regiao;
                                    const statusColor = getCardBorderColor(obra);
                                    const statusLabel = (STATUS_META[obra.status] || STATUS_META.ativa).label;

                                    return (
                                        <tr key={obra.id} style={{ borderBottom: '1px solid #f5f2ed' }}
                                            className="transition-colors hover:bg-[#faf9f7]">
                                            {/* Nome */}
                                            <td style={{ padding: '10px 16px', maxWidth: 320 }}>
                                                <div className="flex items-center gap-2">
                                                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: statusColor, flexShrink: 0 }} title={statusLabel} />
                                                    <div className="min-w-0">
                                                        <div className="line-clamp-1" style={{ fontWeight: 600, color: '#3d3528' }} title={formatObraNome(obra)}>
                                                            {formatObraNome(obra)}
                                                        </div>
                                                        {obra.latitude && (
                                                            <a href={`https://www.google.com/maps/search/?api=1&query=${obra.latitude},${obra.longitude}`} target="_blank" rel="noreferrer"
                                                                style={{ fontSize: 11, color: '#2d5a8a', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                                                <MapPin size={11}/> Ver no Mapa
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Tipo */}
                                            <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                                                {isCentroCusto ? (
                                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#ede9fe', color: '#3730a3', border: '1px solid #ddd6fe', borderRadius: 9999, padding: '2px 8px' }}>Centro de Custo</span>
                                                ) : (
                                                    <span style={{ fontSize: 12, color: '#6a5e4e' }}>Obra</span>
                                                )}
                                            </td>
                                            {/* Região */}
                                            <td style={{ padding: '10px 16px', color: '#6a5e4e', whiteSpace: 'nowrap' }}>
                                                {obra.regiao ? obra.regiao : (regiaoPendente ? (
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#c2410c', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        <AlertTriangle size={12}/> Pendente
                                                    </span>
                                                ) : <span style={{ color: '#c4b8a8' }}>—</span>)}
                                            </td>
                                            {/* Órgão */}
                                            <td style={{ padding: '10px 16px', color: '#6a5e4e', maxWidth: 220 }}>
                                                {orgaoPendente ? (
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#c2410c', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        <AlertTriangle size={12}/> Pendente
                                                    </span>
                                                ) : (
                                                    <span className="line-clamp-1" title={obra.orgao_contratante || ''}>{obra.orgao_contratante || <span style={{ color: '#c4b8a8' }}>—</span>}</span>
                                                )}
                                            </td>
                                            {/* Status */}
                                            <td style={{ padding: '10px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, background: `${statusColor}1a`, color: statusColor }}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            {/* Equip. ativos */}
                                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: activeCount > 0 ? '#e0f2fe' : '#f5f2ed', color: activeCount > 0 ? '#0c4a6e' : '#9a8a78' }}>
                                                    {activeCount}
                                                </span>
                                            </td>
                                            {/* Ações */}
                                            <td style={{ padding: '10px 16px' }}>
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openModal('detail', obra)}
                                                        className="px-3 py-1.5 text-sm font-medium rounded-lg transition mak-btn mak-btn-cancel">
                                                        Gerenciar
                                                    </button>
                                                    <ProtectedComponent requiredPermission="obra-editor">
                                                        <button onClick={() => openModal('createEdit', obra)}
                                                            style={{ padding: 6, background: 'transparent', border: 'none', borderRadius: 6, color: '#b0a090', cursor: 'pointer', lineHeight: 0 }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = '#fdf8f0'; e.currentTarget.style.color = '#9E7A42'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b0a090'; }}
                                                            title="Editar">
                                                            <Edit size={15}/>
                                                        </button>
                                                    </ProtectedComponent>
                                                    <ProtectedComponent requiredPermission="obra-editor">
                                                        {obra.status === 'ativa' ? (
                                                            <button onClick={() => openModal('finish', obra)}
                                                                style={{ padding: 6, background: 'transparent', color: '#065f46', border: 'none', borderRadius: 6, cursor: 'pointer', lineHeight: 0 }}
                                                                onMouseEnter={e => e.currentTarget.style.background = '#d1fae5'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                title="Finalizar Obra">
                                                                <CheckCircle size={16}/>
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleReactivate(obra)}
                                                                style={{ padding: 6, background: 'transparent', color: '#9E7A42', border: 'none', borderRadius: 6, cursor: 'pointer', lineHeight: 0 }}
                                                                onMouseEnter={e => e.currentTarget.style.background = '#fdf8f0'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                title="Reativar">
                                                                <RefreshCw size={16}/>
                                                            </button>
                                                        )}
                                                    </ProtectedComponent>
                                                    <ProtectedComponent requiredPermission="admin">
                                                        <button onClick={() => openModal('delete', obra)}
                                                            style={{ padding: 6, background: 'transparent', color: '#b03828', border: 'none', borderRadius: 6, cursor: 'pointer', lineHeight: 0 }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#fdf0ec'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            title="Excluir">
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </ProtectedComponent>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
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
                    employees={employees}
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