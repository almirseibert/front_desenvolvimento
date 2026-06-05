import React, { useState, useMemo, useEffect } from 'react';
import { Droplet, ArrowUpCircle, ArrowDownCircle, Plus, Minus, Recycle, Edit, Trash2, MapPin, Truck, History } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Modais Separados
import ComboioEntradaModal from '../components/modals/ComboioEntradaModal';
import ComboioSaidaModal from '../components/modals/ComboioSaidaModal';
import ComboioDrenagemModal from '../components/modals/ComboioDrenagemModal';
import { getAllowedReadingTypes } from '../utils/vehicleRules';

import ProtectedComponent from '../components/ProtectedComponent';
import SearchableSelect from '../components/SearchableSelect';

// --- FUNÇÃO DE GERAÇÃO DE PDF (Padronizada A4 - Igual Abastecimento) ---
const generateAuthorizationPDF = (orderData, vehicles = [], partners = [], employees = [], vehicleGroups = {}) => {
    // --- HELPER: Validação de Data ---
    const isValidDbDate = (dateString) => {
        if (!dateString) return false;
        const str = String(dateString);
        return str.length > 5 && !str.startsWith('0000') && str !== '1970-01-01T00:00:00.000Z';
    };

    // --- HELPER: Formatação de Data Segura ---
    const formatDateSafe = (dateInput) => {
        if (!isValidDbDate(dateInput)) return 'N/A';
        try {
            let date;
            if (dateInput && typeof dateInput.toDate === 'function') {
                date = dateInput.toDate();
            } else {
                let dateStr = String(dateInput);
                if (dateStr.includes(' ') && !dateStr.includes('T')) {
                    dateStr = dateStr.replace(' ', 'T');
                }
                date = new Date(dateStr);
            }
            if (isNaN(date.getTime())) return 'Data Inválida';
            return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).toLocaleDateString('pt-BR');
        } catch { return 'Erro'; }
    };

    const buildPdf = (logoDataUrl) => {
        // MUDANÇA: Formato A4 (antes era A5) para igualar ao Abastecimento
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const effectivePageHeight = 148.5; 
        const margin = 10;

        // Determina quem é o "Veículo" e "Parceiro" baseado no tipo de transação
        let vehicleId, partnerId;
        if (orderData.isEntrada || orderData.type === 'entrada') {
            vehicleId = orderData.comboioVehicleId || orderData.vehicleId; // O comboio está sendo abastecido
            partnerId = orderData.partnerId;
        } else {
            vehicleId = orderData.receivingVehicleId || orderData.vehicleId; // O veículo está recebendo do comboio
            partnerId = null; // O parceiro é o comboio
        }

        const vehicle = vehicles.find(v => v.id === vehicleId); 
        const partner = partners.find(p => p.id === partnerId); 
        const employee = employees.find(e => e.id === orderData.employeeId);
        
        const dateToUse = orderData.data || orderData.date;
        let emissionDateStr = formatDateSafe(dateToUse);

        // Logo
        if (logoDataUrl) {
            try {
                doc.addImage(logoDataUrl, 'PNG', margin, 10, 45, 16.875);
            } catch (e) {
                console.error("Erro ao adicionar logo ao PDF:", e);
            }
        }

        doc.setFontSize(16);
        doc.text(`Autorização de Abastecimento`, pageWidth - margin, 15, { align: 'right' });
        doc.setFontSize(12);
        // Exibe o número da ordem que vem do backend (agora sincronizado com refuelingCounter)
        doc.text(`Nº: ${String(orderData.authNumber || '0').padStart(6, '0')}`, pageWidth - margin, 22, { align: 'right' });

        let leituraLabel = 'Leitura';
        let leituraValue = 'N/A';
        
        // Lógica de Leitura unificada
        if (orderData.odometro && orderData.odometro > 0) {
            leituraLabel = 'Odômetro';
            leituraValue = orderData.odometro;
        } else if (orderData.horimetro && orderData.horimetro > 0) {
            leituraLabel = 'Horímetro';
            leituraValue = orderData.horimetro;
        } else if (vehicle) {
            // Fallback se não tiver na ordem, tenta pegar do veículo (menos preciso, mas útil)
            const allowed = getAllowedReadingTypes(vehicle.tipo);
            if (allowed.includes('odometro')) {
                leituraLabel = 'Odômetro';
                leituraValue = vehicle.odometro || 'N/A';
            } else {
                leituraLabel = 'Horímetro';
                leituraValue = vehicle.horimetro || 'N/A';
            }
        }

        const body = [
            ['Data de Emissão', emissionDateStr],
            ['Funcionário Autorizado', employee?.nome || 'Não especificado'],
            ['Veículo Autorizado', `${vehicle?.registroInterno || 'N/A'} - ${vehicle?.placa || 'N/A'}`],
            ['Modelo', `${vehicle?.marca || ''} ${vehicle?.modelo || ''}`.trim() || 'N/A'],
            [leituraLabel, `${leituraValue}`],
            ['Posto Autorizado', orderData.partnerName || partner?.razaoSocial || (orderData.type === 'saida' ? 'Comboio Interno' : 'N/A')],
            ['Combustível Autorizado', orderData.fuelType === 'dieselS10' ? 'Diesel S10' : (orderData.fuelType === 'dieselComum' ? 'Diesel Comum' : orderData.fuelType) || 'N/A'],
            ['Litros Liberados', `${parseFloat(orderData.litrosAbastecidos || orderData.liters || 0).toFixed(2)} L`],
        ];

        if (orderData.invoiceNumber) {
            body.push(['Nota Fiscal (NF)', orderData.invoiceNumber]);
        }

        let issuer = 'N/A';
        if (orderData.createdBy) {
            if (typeof orderData.createdBy === 'string') {
                issuer = orderData.createdBy; 
            } else if (typeof orderData.createdBy === 'object') {
                issuer = orderData.createdBy.nome || orderData.createdBy.name || orderData.createdBy.userEmail || orderData.createdBy.email || 'Usuário do Sistema';
            }
        }
        body.push(['Emitido por', issuer]);

        autoTable(doc, {
            startY: 35,
            body: body,
            theme: 'striped',
            styles: { fontSize: 9, cellPadding: 1.5 },
            headStyles: { fillColor: [24, 49, 83] },
            columnStyles: {
                0: { cellWidth: 40, fontStyle: 'bold' }
            }
        });

        let finalY = (doc.lastAutoTable?.finalY || 35) + 10;
        const footerStartY = Math.max(finalY, effectivePageHeight - 20); 
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('*A presente ordem de abastecimento é válida exclusivamente para a placa/RE indicada e para o tipo de combustível previamente autorizado.', margin, footerStartY);
        doc.text('*Estão autorizados somente os itens discriminados acima.', margin, footerStartY + 4);

        doc.setLineDashPattern([1, 1], 0);
        doc.setDrawColor(180, 180, 180);
        doc.line(0, effectivePageHeight, pageWidth, effectivePageHeight);

        // Gera nome do arquivo
        const fileName = `Autorizacao_${orderData.authNumber || 'TEMP'}_${vehicle?.registroInterno || 'VEIC'}.pdf`;
        doc.save(fileName);
    };

    const logo = new Image();
    logo.crossOrigin = 'Anonymous';
    logo.src = 'https://i.postimg.cc/pVnwyfRq/MAK-Servi-os-Logotipo.png';

    logo.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = logo.width;
            canvas.height = logo.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(logo, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            buildPdf(dataUrl);
        } catch (e) {
            console.error("Erro ao processar logo:", e);
            buildPdf(null);
        }
    };

    logo.onerror = () => {
        console.error("Erro ao carregar o logotipo para o PDF.");
        buildPdf(null);
    };
};

const ComboioPage = ({
    user,
    vehicles = [],
    partners = [],
    obras = [],
    employees = [],
    comboioTransactions = [],
    expenses = [],
    refuelings = [], 
    setAlertMessage,
    apiClient,
    extraObraOptions = [],
    vehicleGroups = {},
    PasswordConfirmationModal,
    reloadData,
}) => {
    // Estado
    const [selectedComboioId, setSelectedComboioId] = useState(null);
    const [modalState, setModalState] = useState({ type: null, data: null, isEditing: false });
    const [deleteTransaction, setDeleteTransaction] = useState(null);
    const [selectedObraFilter, setSelectedObraFilter] = useState('todas');

    // Listas Filtradas
    const comboioVehicles = useMemo(() => vehicles.filter(v => v.isComboioVehicle).sort((a,b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')), [vehicles]);
    
    // Seleção automática inicial
    useEffect(() => {
        if (!selectedComboioId && comboioVehicles.length > 0) setSelectedComboioId(comboioVehicles[0].id);
        else if (selectedComboioId && !comboioVehicles.some(v => v.id === selectedComboioId)) {
            setSelectedComboioId(comboioVehicles.length > 0 ? comboioVehicles[0].id : null);
        }
    }, [comboioVehicles, selectedComboioId]);

    const selectedComboio = comboioVehicles.find(v => v.id === selectedComboioId);

    // Reseta filtro de obra ao trocar de comboio
    useEffect(() => { setSelectedObraFilter('todas'); }, [selectedComboioId]);

    // Todas as transações deste comboio (sem filtro)
    const allTransactions = useMemo(() => (
        comboioTransactions
            .filter(t => t.comboioVehicleId === selectedComboioId)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
    ), [comboioTransactions, selectedComboioId]);

    // Obras atendidas: agrega litros de SAÍDA por obraId
    const obrasAtendidas = useMemo(() => {
        const map = new Map();
        for (const t of allTransactions) {
            if (t.type !== 'saida') continue;
            const oid = t.obraId || '__sem_obra__';
            const obra = t.obraId ? obras.find(o => o.id === t.obraId) : null;
            const nome = t.obraName || obra?.nome || (t.obraId ? t.obraId : 'Sem obra');
            const cur = map.get(oid) || { obraId: t.obraId || null, obraName: nome, totalLitros: 0, qtd: 0 };
            cur.totalLitros += parseFloat(t.liters) || 0;
            cur.qtd += 1;
            map.set(oid, cur);
        }
        return Array.from(map.values()).sort((a, b) => b.totalLitros - a.totalLitros);
    }, [allTransactions, obras]);

    // Transações filtradas pela obra atendida selecionada
    const transactions = useMemo(() => {
        if (selectedObraFilter === 'todas') return allTransactions;
        if (selectedObraFilter === '__sem_obra__') return allTransactions.filter(t => t.type === 'saida' && !t.obraId);
        return allTransactions.filter(t => t.type === 'saida' && t.obraId === selectedObraFilter);
    }, [allTransactions, selectedObraFilter]);

    // Handlers
    const closeModal = () => setModalState({ type: null, data: null, isEditing: false });
    
    const handleEdit = (transaction) => {
        let modalType = null;
        if (transaction.type === 'entrada') modalType = 'entrada';
        else if (transaction.type === 'saida') modalType = 'saida';
        else if (transaction.type === 'drenagem') modalType = 'drenagem';

        if (modalType) {
            setModalState({ type: modalType, data: transaction, isEditing: true });
        }
    };

    const handleDelete = async () => {
        if (!deleteTransaction) return;
        try {
            await apiClient.deleteComboioTransaction(deleteTransaction.id);
            setAlertMessage("Transação excluída e saldos revertidos.");
            reloadData();
        } catch (e) {
            setAlertMessage(e.message);
        } finally {
            setDeleteTransaction(null);
        }
    };

    // Componente Barra de Combustível com Porcentagem
    const FuelBar = ({ type, level, capacity }) => {
        const totalCapacity = parseFloat(capacity) || 2000; 
        const pct = Math.min((level / totalCapacity) * 100, 100);
        const color = type === 'dieselS10' ? 'bg-blue-600' : 'bg-green-600';
        const label = type === 'dieselS10' ? 'Diesel S10' : 'Diesel Comum';

        return (
            <div className="flex-1 flex flex-col items-center">
                <div className="relative h-32 w-10 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 flex items-end shadow-inner">
                    <div 
                        className={`${color} w-full transition-all duration-700 ease-in-out`} 
                        style={{ height: `${pct}%` }}
                    ></div>
                    <div className="absolute w-full text-center bottom-1 text-[10px] font-bold text-white drop-shadow-md">
                        {pct.toFixed(0)}%
                    </div>
                </div>
                <div className="mt-2 text-center">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-tighter">{label}</div>
                    <div className="text-sm font-mono text-gray-900">{level.toFixed(0)} L</div>
                </div>
            </div>
        );
    };

    const getObraName = (obraId) => {
        const obra = obras.find(o => o.id === obraId);
        if (obra) return obra.nome;
        if (extraObraOptions.includes(obraId)) return obraId;
        return 'Não definida';
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">Gestão de Comboio</h1>
                    <p className="text-sm text-gray-500">Controle de estoque, abastecimentos e movimentações.</p>
                </div>
                <ProtectedComponent requiredPermission="editor">
                    <button 
                        onClick={() => setModalState({ type: 'drenagem', data: null, isEditing: false })}
                        className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-semibold hover:bg-orange-200 flex items-center gap-2 border border-orange-200 transition shadow-sm"
                    >
                        <Recycle size={18} /> Registrar Drenagem
                    </button>
                </ProtectedComponent>
            </header>

            {/* SELETOR DE COMBOIO — combo searchable (substitui a antiga lista que abria todos) */}
            <div className="bg-white rounded-xl shadow-sm p-4" style={{ border: "1px solid #f0ebe3" }}>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2 mb-2">
                    <Truck size={14}/> Selecione o Comboio
                </label>
                <SearchableSelect
                    items={comboioVehicles}
                    value={selectedComboioId || ''}
                    onChange={(item) => setSelectedComboioId(item?.id || null)}
                    getLabel={(v) => `${v.registroInterno} — ${v.placa}`}
                    getSubLabel={(v) => v.modelo || ''}
                    getBadge={(v) => {
                        const obra = obras.find(o => o.id === v.obraAtualId);
                        return obra ? { text: obra.nome, color: 'bg-blue-100 text-blue-700' } : null;
                    }}
                    placeholder={comboioVehicles.length === 0 ? 'Nenhum comboio cadastrado' : 'Busque por RE, placa ou modelo...'}
                    disabled={comboioVehicles.length === 0}
                />
                {comboioVehicles.length === 0 && (
                    <p className="mt-2 text-xs text-gray-400 italic">
                        Marque um veículo como "Comboio" no cadastro de veículos para ele aparecer aqui.
                    </p>
                )}
            </div>

            {/* PAINEL DO COMBOIO SELECIONADO */}
            {selectedComboio && (
            <div className="bg-white rounded-xl shadow-sm p-5" style={{ border: "1px solid #f0ebe3" }}>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }}>{selectedComboio.registroInterno}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">{selectedComboio.placa}</span>
                            <span className="text-xs text-gray-500">{selectedComboio.modelo}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-blue-700 mt-2">
                            <MapPin size={14} />
                            <span className="font-medium">{getObraName(selectedComboio.obraAtualId)}</span>
                        </div>

                        {/* OBRAS ATENDIDAS — agregado de saídas por obra (lista suspensa) */}
                        <div className="mt-3">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1">
                                <History size={12}/> Obras atendidas {obrasAtendidas.length > 0 && <span className="text-gray-400 normal-case font-normal">({obrasAtendidas.length})</span>}
                            </label>
                            <select
                                value={selectedObraFilter}
                                onChange={(e) => setSelectedObraFilter(e.target.value)}
                                disabled={obrasAtendidas.length === 0}
                                className="w-full md:w-auto text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400"
                            >
                                <option value="todas">Todas as obras{obrasAtendidas.length > 0 ? ` (${obrasAtendidas.length})` : ''}</option>
                                {obrasAtendidas.map(o => {
                                    const key = o.obraId || '__sem_obra__';
                                    return (
                                        <option key={key} value={key}>
                                            {o.obraName} — {o.totalLitros.toFixed(1)} L ({o.qtd} saída{o.qtd > 1 ? 's' : ''})
                                        </option>
                                    );
                                })}
                            </select>
                            {obrasAtendidas.length === 0 && (
                                <p className="mt-1 text-[11px] text-gray-400 italic">Nenhuma saída registrada ainda.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-center gap-4 px-2">
                        {Object.entries(selectedComboio.fuelLevels || {}).map(([type, level]) => (
                            <FuelBar key={type} type={type} level={level} capacity={selectedComboio.fuelCapacity} />
                        ))}
                        {Object.keys(selectedComboio.fuelLevels || {}).length === 0 && (
                            <div className="text-xs text-gray-400 py-4 italic text-center bg-gray-50 rounded px-4">
                                Sem dados de tanque
                            </div>
                        )}
                    </div>

                    <ProtectedComponent requiredPermission="editor">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-[220px]">
                            <button
                                onClick={() => setModalState({ type: 'entrada', data: selectedComboio, isEditing: false })}
                                className="bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-semibold hover:bg-blue-700 flex justify-center items-center gap-2 transition shadow-sm"
                            >
                                <Plus size={16}/> Entrada
                            </button>
                            <button
                                onClick={() => setModalState({ type: 'saida', data: selectedComboio, isEditing: false })}
                                className="bg-yellow-400 text-gray-900 py-2 px-3 rounded-lg text-sm font-semibold hover:bg-yellow-300 flex justify-center items-center gap-2 transition shadow-sm"
                            >
                                <Minus size={16}/> Abastecer
                            </button>
                        </div>
                    </ProtectedComponent>
                </div>
            </div>
            )}

            {/* HISTÓRICO DO COMBOIO SELECIONADO */}
            {selectedComboio && (
            <div className="grid grid-cols-1">
                <div className="bg-white rounded-xl shadow-sm flex flex-col h-[600px]" style={{ border: "1px solid #f0ebe3" }}>
                    <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
                        <h2 className="font-bold text-gray-700">
                            Histórico de Operações {selectedComboio ? `- ${selectedComboio.registroInterno}` : ''}
                            {selectedObraFilter !== 'todas' && (
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                    (saídas para {obrasAtendidas.find(o => (o.obraId || '__sem_obra__') === selectedObraFilter)?.obraName || 'obra'})
                                </span>
                            )}
                        </h2>
                        {selectedComboio && (
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                                {transactions.length} registros
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3 bg-gray-50/50">
                        {transactions.length > 0 ? transactions.map(t => (
                            <div key={t.id} className="flex items-center p-4 bg-white rounded-lg hover:shadow-md transition-all group" style={{ border: "1px solid #f0ebe3" }}>
                                <div className={`p-3 rounded-full mr-4 shadow-sm flex-shrink-0 ${t.type === 'entrada' ? 'bg-blue-100 text-blue-600' : t.type === 'saida' ? 'bg-yellow-100 text-yellow-600' : 'bg-orange-100 text-orange-600'}`}>
                                    {t.type === 'entrada' ? <ArrowUpCircle size={24}/> : t.type === 'saida' ? <ArrowDownCircle size={24}/> : <Recycle size={24}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-sm font-bold text-gray-800 truncate pr-2">
                                            {t.type === 'entrada' ? `ENTRADA: ${t.partnerName}` : t.type === 'saida' ? `SAÍDA: ${t.receivingVehicleName || 'Veículo'}` : `DRENAGEM: ${t.drainingVehicleName}`}
                                        </p>
                                        <span className={`text-base font-mono font-bold whitespace-nowrap ${t.type === 'entrada' || t.type === 'drenagem' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'entrada' || t.type === 'drenagem' ? '+' : '-'}{parseFloat(t.liters).toFixed(1)} L
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span> {new Date(t.date).toLocaleString('pt-BR')}</span>
                                        <span className="flex items-center gap-1 font-medium text-gray-600 bg-gray-100 px-1.5 rounded">{t.fuelType === 'dieselS10' ? 'Diesel S10' : 'Diesel Comum'}</span>
                                        {t.authNumber && <span className="flex items-center gap-1 font-bold text-gray-700 bg-gray-200 px-1.5 rounded">Nº {String(t.authNumber).padStart(6,'0')}</span>}
                                        {t.obraName && <span className="flex items-center gap-1"><MapPin size={10}/> {t.obraName}</span>}
                                        {t.invoiceNumber && <span className="flex items-center gap-1 bg-yellow-50 text-yellow-800 px-1 rounded border border-yellow-100">NF: {t.invoiceNumber}</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 ml-3 pl-3 border-l border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => generateAuthorizationPDF(t, vehicles, partners, employees, vehicleGroups)} 
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                                        title="PDF"
                                    >
                                        <ArrowDownCircle size={18} className="transform rotate-180"/> 
                                    </button>
                                    <ProtectedComponent requiredPermission="editor">
                                        <button 
                                            onClick={() => handleEdit(t)} 
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                                            title="Editar Operação"
                                        >
                                            <Edit size={18}/>
                                        </button>
                                    </ProtectedComponent>
                                    <ProtectedComponent requiredPermission="admin">
                                        <button 
                                            onClick={() => setDeleteTransaction(t)} 
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                                            title="Excluir Operação"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    </ProtectedComponent>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <div className="bg-gray-100 p-4 rounded-full mb-3">
                                    <Droplet size={40} className="text-gray-300"/>
                                </div>
                                <p className="font-medium">Nenhuma operação registrada.</p>
                                <p className="text-sm">Selecione um comboio para ver o histórico.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}

            {modalState.type === 'entrada' && (
                <ComboioEntradaModal
                    onClose={closeModal}
                    comboioVehicle={modalState.isEditing ? comboioVehicles.find(v => v.id === modalState.data.comboioVehicleId) : modalState.data}
                    transactionData={modalState.isEditing ? modalState.data : null}
                    user={user}
                    partners={partners}
                    employees={employees}
                    obras={obras}
                    extraObraOptions={extraObraOptions}
                    apiClient={apiClient}
                    setAlertMessage={setAlertMessage}
                    generateAuthorizationPDF={generateAuthorizationPDF}
                    vehicleGroups={vehicleGroups}
                    reloadData={reloadData}
                    comboioTransactions={comboioTransactions} 
                />
            )}

            {modalState.type === 'saida' && (
                <ComboioSaidaModal
                    onClose={closeModal}
                    comboioVehicle={modalState.isEditing ? comboioVehicles.find(v => v.id === modalState.data.comboioVehicleId) : modalState.data}
                    transactionData={modalState.isEditing ? modalState.data : null}
                    vehicles={vehicles}
                    obras={obras}
                    employees={employees}
                    expenses={expenses}
                    comboioTransactions={comboioTransactions}
                    refuelings={refuelings}
                    user={user}
                    apiClient={apiClient}
                    setAlertMessage={setAlertMessage}
                    generateAuthorizationPDF={generateAuthorizationPDF}
                    vehicleGroups={vehicleGroups}
                    extraObraOptions={extraObraOptions}
                    reloadData={reloadData}
                    PasswordConfirmationModal={PasswordConfirmationModal}
                />
            )}

            {modalState.type === 'drenagem' && (
                <ComboioDrenagemModal
                    onClose={closeModal}
                    transactionData={modalState.isEditing ? modalState.data : null}
                    user={user}
                    vehicles={vehicles}
                    apiClient={apiClient}
                    setAlertMessage={setAlertMessage}
                    reloadData={reloadData}
                />
            )}

            {deleteTransaction && (
                <PasswordConfirmationModal
                    message="Tem certeza? A exclusão irá reverter os saldos de combustível do comboio e do veículo envolvido."
                    onConfirm={handleDelete}
                    onClose={() => setDeleteTransaction(null)}
                    apiClient={apiClient}
                />
            )}
        </div>
    );
};

export default ComboioPage;


