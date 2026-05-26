import React, { useState, useMemo, useEffect } from 'react';
import { Droplet, ArrowUpCircle, ArrowDownCircle, Plus, Minus, Recycle, Edit, Trash2, MapPin } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Modais Separados
import ComboioEntradaModal from '../components/modals/ComboioEntradaModal';
import ComboioSaidaModal from '../components/modals/ComboioSaidaModal';
import ComboioDrenagemModal from '../components/modals/ComboioDrenagemModal';
import { getAllowedReadingTypes } from '../utils/vehicleRules';

import ProtectedComponent from '../components/ProtectedComponent';

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

    // Transações do comboio selecionado
    const transactions = useMemo(() => {
        return comboioTransactions
            .filter(t => t.comboioVehicleId === selectedComboioId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [comboioTransactions, selectedComboioId]);

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
                    <h1 className="text-2xl font-bold text-gray-800">Gestão de Comboio</h1>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* COLUNA ESQUERDA: LISTA DE COMBOIOS */}
                <div className="space-y-4">
                    <h2 className="font-bold text-gray-700 uppercase text-xs tracking-wider flex items-center gap-2">
                        <Droplet size={14}/> Frotas de Comboio
                    </h2>
                    {comboioVehicles.map(comboio => (
                        <div 
                            key={comboio.id}
                            onClick={() => setSelectedComboioId(comboio.id)}
                            className={`bg-white p-5 rounded-xl shadow-sm border cursor-pointer transition-all relative overflow-hidden ${selectedComboioId === comboio.id ? 'border-yellow-500 ring-1 ring-yellow-300' : 'border-gray-100 hover:border-blue-200'}`}
                        >
                            {selectedComboioId === comboio.id && <div className="absolute top-0 right-0 w-3 h-3 bg-yellow-500 rounded-bl-lg"></div>}
                            
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-bold text-gray-800">{comboio.registroInterno}</span>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">{comboio.placa}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{comboio.modelo}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 p-2 rounded-md mb-4 border border-blue-100">
                                <MapPin size={14} />
                                <span className="font-medium truncate">
                                    {getObraName(comboio.obraAtualId)}
                                </span>
                            </div>

                            <div className="flex justify-center gap-4 mb-4 px-2">
                                {Object.entries(comboio.fuelLevels || {}).map(([type, level]) => (
                                    <FuelBar key={type} type={type} level={level} capacity={comboio.fuelCapacity} />
                                ))}
                                {Object.keys(comboio.fuelLevels || {}).length === 0 && (
                                    <div className="text-xs text-gray-400 py-4 italic text-center w-full bg-gray-50 rounded">
                                        Sem dados de tanque
                                    </div>
                                )}
                            </div>

                            <ProtectedComponent requiredPermission="editor">
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setModalState({ type: 'entrada', data: comboio, isEditing: false }); }}
                                        className="bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 flex justify-center items-center gap-2 transition shadow-sm"
                                    >
                                        <Plus size={16}/> Entrada
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setModalState({ type: 'saida', data: comboio, isEditing: false }); }}
                                        className="bg-yellow-400 text-gray-900 py-2.5 rounded-lg text-sm font-semibold hover:bg-yellow-500 flex justify-center items-center gap-2 transition shadow-sm"
                                    >
                                        <Minus size={16}/> Abastecer
                                    </button>
                                </div>
                            </ProtectedComponent>
                        </div>
                    ))}
                    {comboioVehicles.length === 0 && (
                        <div className="text-center text-gray-400 py-10 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                            Nenhum veículo configurado como comboio.
                        </div>
                    )}
                </div>

                {/* COLUNA DIREITA: HISTÓRICO */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[700px]">
                    <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
                        <h2 className="font-bold text-gray-700">Histórico de Operações {selectedComboio ? `- ${selectedComboio.registroInterno}` : ''}</h2>
                        {selectedComboio && (
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                                {transactions.length} registros
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3 bg-gray-50/50">
                        {transactions.length > 0 ? transactions.map(t => (
                            <div key={t.id} className="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all group">
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