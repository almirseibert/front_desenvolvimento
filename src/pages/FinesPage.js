import React, { useState, useMemo, useEffect } from 'react';
import {
    PlusCircle,
    Edit,
    Trash2,
    X,
    Loader,
    ChevronsUpDown,
    FileText,
    Printer,
    Send
} from 'lucide-react';
import jsPDF from 'jspdf';
import ProtectedComponent from '../components/ProtectedComponent';
import SearchableSelect from '../components/SearchableSelect';

// ===================================================================================
// FUNÇÃO AUXILIAR PARA FORMATAR DATAS
// ===================================================================================
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Data Inválida';
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

// ===================================================================================
// FUNÇÃO GERADORA DE PDF (TERMO DE RESPONSABILIDADE)
// ===================================================================================
// Aceita 'returnBlob' para gerar o arquivo silenciosamente e enviar via API
const generateFinePDF = (fineData, employee, vehicle, returnBlob = false) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    // --- Cabeçalho ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("FROTAS MAK - Gestão de Multas", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;
    
    doc.setFontSize(14);
    doc.text("TERMO DE RESPONSABILIDADE E NOTIFICAÇÃO", pageWidth / 2, yPos, { align: "center" });
    yPos += 20;

    // --- Dados do Funcionário ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CONDUTOR:", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${employee?.nome || 'N/A'}`, margin + 30, yPos);
    
    if (employee?.cpf) {
        doc.text(`CPF: ${employee.cpf}`, pageWidth - margin - 50, yPos);
    }
    yPos += 10;

    // --- Dados do Veículo e Infração ---
    doc.setDrawColor(200);
    doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

    doc.setFont("helvetica", "bold");
    doc.text("DADOS DA INFRAÇÃO:", margin, yPos);
    yPos += 8;

    const details = [
        `Veículo: ${vehicle?.marca || ''} ${vehicle?.modelo || ''} - Placa: ${vehicle?.placa || 'N/A'}`,
        `Data da Infração: ${formatDate(fineData.dataInfração)}`,
        `Local: ${fineData.local || fineData.localInfracao || 'Não informado'}`,
        `Código/Descrição: ${fineData.codigoInfração || fineData.codigoInfracao || ''} - ${fineData.descricao}`,
        `Valor da Multa: R$ ${parseFloat(fineData.valor || 0).toFixed(2).replace('.', ',')}`
    ];

    doc.setFont("helvetica", "normal");
    details.forEach(line => {
        doc.text(line, margin, yPos);
        yPos += 7;
    });
    
    yPos += 10;
    doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

    // --- Texto Legal / Desconto ---
    if (fineData.discountFromEmployee) {
        doc.setFont("helvetica", "bold");
        doc.text("AUTORIZAÇÃO DE DESCONTO:", margin, yPos);
        yPos += 8;
        doc.setFont("helvetica", "normal");
        
        const textDesconto = `Declaro para os devidos fins que fui o condutor responsável pela infração acima descrita. Autorizo a empresa Frotas MAK a proceder com o desconto do valor integral desta multa (R$ ${parseFloat(fineData.valor || 0).toFixed(2).replace('.', ',')}) em minha folha de pagamento, conforme previsto no Art. 462 da CLT e no contrato de trabalho.`;
        
        const splitText = doc.splitTextToSize(textDesconto, pageWidth - (margin * 2));
        doc.text(splitText, margin, yPos);
        yPos += (splitText.length * 7) + 10;
    }

    // --- Aviso de Transferência (NIC) ---
    if (!fineData.alreadyInEmployeeName) {
        doc.setFillColor(255, 240, 240);
        doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 45, 'F');
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 0, 0); 
        doc.text("⚠️ AVISO IMPORTANTE - TRANSFERÊNCIA DE PONTUAÇÃO", margin + 5, yPos);
        yPos += 8;
        
        doc.setTextColor(0, 0, 0); 
        doc.setFontSize(10);
        const textNIC = "É OBRIGATÓRIA a assinatura do formulário de identificação do condutor infrator e a entrega da cópia da CNH ao departamento responsável dentro do prazo legal. \n\nA NÃO realização deste procedimento acarretará na penalidade de NIC (Não Indicação de Condutor), gerando uma NOVA MULTA de valor igual ou superior à original, cujo custo TAMBÉM será repassado ao condutor responsável.";
        
        const splitNIC = doc.splitTextToSize(textNIC, pageWidth - (margin * 2) - 10);
        doc.text(splitNIC, margin + 5, yPos);
        yPos += (splitNIC.length * 5) + 15;
    }

    // --- Validade Eletrônica ---
    yPos = 245; 
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 28, 'F');
    doc.setDrawColor(200);
    doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("VALIDADE ELETRÔNICA (Notificação Digital)", pageWidth / 2, yPos, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    const textoEletronico = "Este termo foi gerado e enviado eletronicamente. A ciência e o recebimento desta notificação via sistema/WhatsApp corporativo suprem a necessidade de assinatura física para a devida autorização do desconto em folha de pagamento, estando em total conformidade com as normas e políticas da empresa.";
    const splitEletronico = doc.splitTextToSize(textoEletronico, pageWidth - (margin * 2) - 10);
    doc.text(splitEletronico, margin + 5, yPos + 6);

    // Data de Emissão
    doc.setFontSize(8);
    doc.text(`Documento gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, 280);

    if (returnBlob) {
        return doc.output('blob');
    } else {
        window.open(doc.output('bloburl'), '_blank');
    }
};

// ===================================================================================
// MODAL PARA EDITAR/ADICIONAR MULTA
// ===================================================================================
const FineModal = ({
    user,
    fine,
    vehicles,
    employees,
    onClose,
    setAlertMessage,
    apiClient,
    reloadData
}) => {
    const [formData, setFormData] = useState({
        vehicleId: fine?.vehicleId || '',
        employeeId: fine?.employeeId || '',
        dataInfração: fine?.dataInfração ? new Date(fine.dataInfração).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        local: fine?.local || '',
        codigoInfração: fine?.codigoInfração || '',
        descricao: fine?.descricao || '',
        valor: fine?.valor?.toString() || '',
        dataVencimento: fine?.dataVencimento ? new Date(fine.dataVencimento).toISOString().split('T')[0] : '',
        status: fine?.status || 'Pendente',
        discountFromEmployee: fine?.discountFromEmployee || false,
        alreadyInEmployeeName: fine?.alreadyInEmployeeName || false
    });

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const fineStatusOptions = ['Pendente', 'Paga', 'Em Recurso', 'Cancelada'];
    const isEditing = !!fine;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value 
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!formData.vehicleId || !formData.employeeId || !formData.descricao || !formData.valor || !formData.dataInfração) {
            setError('Veículo, condutor, data da infração, descrição e valor são obrigatórios.');
            return;
        }
        
        setIsSaving(true);

        const vehicle = vehicles?.find(v => v.id === formData.vehicleId);
        const employee = employees?.find(e => e.id === formData.employeeId);

        if (!vehicle || !employee) {
             setError('Veículo ou funcionário selecionado inválido.');
             setIsSaving(false);
             return;
        }

        const dataToSave = {
            ...formData,
            valor: parseFloat(formData.valor.replace(',', '.')) || 0,
            dataInfração: formData.dataInfração,
            dataVencimento: formData.dataVencimento || null,
        };

        try {
            if (isEditing) {
                await apiClient.updateFine(fine.id, dataToSave);
                setAlertMessage('Multa atualizada com sucesso!');
            } else {
                await apiClient.createFine(dataToSave);
                setAlertMessage('Multa registrada com sucesso!');
            }

            reloadData();
            onClose();

            // Pós-salvar visualização do PDF.
            setTimeout(() => {
                if (formData.discountFromEmployee || !formData.alreadyInEmployeeName) {
                    const confirmPDF = window.confirm("Deseja visualizar o Termo de Responsabilidade Eletrônico agora?");
                    if (confirmPDF) {
                        generateFinePDF(dataToSave, employee, vehicle, false);
                    }
                }
            }, 500);

        } catch (err) {
            console.error("Erro ao salvar multa:", err);
            setError(err.message || "Ocorreu um erro ao salvar a multa.");
            setIsSaving(false);
        }
    };

     const activeEmployees = useMemo(() => (employees || []).filter(e => e.status === 'ativo').sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [employees]);
     const sortedVehicles = useMemo(() => (vehicles || []).sort((a,b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')), [vehicles]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-2 sm:p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col my-auto overflow-hidden">
                <div className="p-4 sm:p-5 border-b bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" flex items-center gap-2">
                        {isEditing ? <Edit size={20}/> : <PlusCircle size={20}/>}
                        {isEditing ? 'Editar Multa' : 'Registrar Nova Multa'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block font-bold text-gray-700 mb-1">Veículo Infrator *</label>
                                <SearchableSelect
                                    items={sortedVehicles}
                                    value={formData.vehicleId}
                                    onChange={(item) => handleChange({ target: { name: 'vehicleId', value: item?.id || '' } })}
                                    getLabel={(v) => `${v.registroInterno} - ${v.placa}`}
                                    getSubLabel={(v) => v.modelo || ''}
                                    placeholder="Selecione o veículo..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Condutor Responsável *</label>
                                <SearchableSelect
                                    items={activeEmployees}
                                    value={formData.employeeId}
                                    onChange={(item) => handleChange({ target: { name: 'employeeId', value: item?.id || '' } })}
                                    getLabel={(e) => e.nome}
                                    getSubLabel={(e) => e.profissao || ''}
                                    placeholder="Selecione o condutor..."
                                    required
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ border: "1px solid #f0ebe3" }}>
                            <h3 className="md:col-span-3 text-xs font-bold text-gray-500 uppercase border-b pb-1 mb-1">Detalhes da Infração</h3>
                            
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">Data da Infração *</label>
                                <input name="dataInfração" type="date" value={formData.dataInfração} onChange={handleChange} className="w-full p-2 border rounded bg-white" required />
                            </div>
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">Valor (R$) *</label>
                                <input name="valor" type="text" inputMode="decimal" value={formData.valor} onChange={handleChange} placeholder="0,00" className="w-full p-2 border rounded bg-white font-semibold text-red-600" required />
                            </div>
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                                    {fineStatusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div className="md:col-span-3">
                                <label className="block font-medium text-gray-700 mb-1">Descrição / Motivo *</label>
                                <input name="descricao" value={formData.descricao} onChange={handleChange} placeholder="Ex: Excesso de velocidade (até 20%)" className="w-full p-2 border rounded bg-white" required />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block font-medium text-gray-700 mb-1">Local</label>
                                <input name="local" value={formData.local} onChange={handleChange} placeholder="Ex: BR-386 Km 340" className="w-full p-2 border rounded bg-white" />
                            </div>
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">Cód. Infração</label>
                                <input name="codigoInfração" value={formData.codigoInfração} onChange={handleChange} placeholder="Ex: 7455-0" className="w-full p-2 border rounded bg-white" />
                            </div>
                        </div>

                        <div className="md:col-span-2 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                             <h3 className="text-xs font-bold text-yellow-800 uppercase border-b border-yellow-200 pb-1 mb-2 flex items-center gap-2">
                                <FileText size={14}/> Gestão Administrativa / RH
                             </h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex items-start gap-2 cursor-pointer p-2 hover:bg-yellow-100 rounded transition">
                                    <input type="checkbox" name="discountFromEmployee" checked={formData.discountFromEmployee} onChange={handleChange} className="mt-1 w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500 border-gray-300" />
                                    <div>
                                        <span className="block font-bold text-gray-800">Descontar do Funcionário?</span>
                                        <span className="text-xs text-gray-600">Gera termo de ciência e autorização eletrônica.</span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2 cursor-pointer p-2 hover:bg-yellow-100 rounded transition">
                                    <input type="checkbox" name="alreadyInEmployeeName" checked={formData.alreadyInEmployeeName} onChange={handleChange} className="mt-1 w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500 border-gray-300" />
                                    <div>
                                        <span className="block font-bold text-gray-800">Já está no nome do Condutor?</span>
                                        <span className="text-xs text-gray-600">Se marcado, remove o aviso de multa NIC do termo.</span>
                                    </div>
                                </label>
                             </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block font-medium text-gray-700 mb-1">Data de Vencimento</label>
                            <input name="dataVencimento" type="date" value={formData.dataVencimento} onChange={handleChange} className="w-full p-2 border rounded bg-white" />
                        </div>
                        
                        {error && <p className="text-sm text-red-600 md:col-span-2 bg-red-50 p-3 rounded border border-red-200 flex items-center gap-2"><X size={16}/> {error}</p>}
                    </div>
                </form>

                <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 z-10">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition w-full sm:w-auto">Cancelar</button>
                    <button type="submit" onClick={handleSubmit} disabled={isSaving} className="px-5 py-2.5 mak-btn mak-btn-primary">
                        {isSaving ? <><Loader className="animate-spin" size={18}/> Processando...</> : <><PlusCircle size={18}/> Salvar Multa</>}
                    </button>
                </div>
            </div>
        </div>
    );
};


// ===================================================================================
// PÁGINA PRINCIPAL DE MULTAS
// ===================================================================================
const FinesPage = ({
    user, fines = [], vehicles = [], employees = [],
    PasswordConfirmationModal, apiClient, setAlertMessage, reloadData
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingFine, setEditingFine] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [filters, setFilters] = useState({ search: '', status: 'Pendente' });
    const [sortConfig, setSortConfig] = useState({ key: 'dataInfração', direction: 'descending' });
    
    const [notifyingIds, setNotifyingIds] = useState(new Set());

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const openModal = (fine = null) => {
        setEditingFine(fine);
        setIsModalOpen(true);
    };

    const openDeleteModal = (id) => {
        setItemToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await apiClient.deleteFine(itemToDelete);
            setAlertMessage('Multa excluída com sucesso.');
            reloadData();
        } catch (error) {
            console.error("Erro ao excluir multa:", error);
            setAlertMessage(error.message || 'Falha ao excluir multa.');
        } finally {
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    // --- NOVA FUNÇÃO DE ENVIO VIA API (Totalmente Independente) ---
    const handleSendWhatsAppAPI = async (fine) => {
        const employee = employees.find(e => e.id === fine.employeeId);
        const vehicle = vehicles.find(v => v.id === fine.vehicleId);

        if (!employee || !employee.contato) {
            alert(`O funcionário não possui número de contato cadastrado no sistema.`);
            return;
        }

        const confirmZap = window.confirm(`Deseja notificar ${employee.nome} via WhatsApp utilizando a API oficial Frotas MAK? (O Termo em PDF será anexado automaticamente)`);
        if (!confirmZap) return;

        setNotifyingIds(prev => new Set(prev).add(fine.id));

        try {
            // 1. Gera o PDF silenciosamente como Blob
            const pdfBlob = generateFinePDF(fine, employee, vehicle, true);
            const file = new File([pdfBlob], `Multa_${vehicle.placa}_FrotasMAK.pdf`, { type: 'application/pdf' });

            // 2. Faz o Upload direto na Rota das Multas (Isolado e Seguro)
            const formData = new FormData();
            formData.append('file', file);
            
            // Usamos post() genérico do apiClient para a nova rota interna das multas
            const uploadRes = await apiClient.post('/fines/upload-pdf', formData);
            const pdfUrl = uploadRes.data?.url || uploadRes.url;

            if (!pdfUrl) {
                 throw new Error("URL do PDF não foi gerada pelo servidor.");
            }

            // 3. Aciona a notificação com o anexo pronto
            await apiClient.post(`/fines/${fine.id}/notify`, { pdfUrl });

            setAlertMessage('Notificação e Termo Eletrônico enviados com sucesso pelo WhatsApp!');
        } catch (error) {
            console.error("Erro ao notificar multa:", error);
            setAlertMessage(`Erro ao notificar via WhatsApp: ${error.response?.data?.error || error.message}`);
        } finally {
            setNotifyingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(fine.id);
                return newSet;
            });
        }
    };

    const processedFines = useMemo(() => {
        if (!Array.isArray(fines)) return [];
        
        let filtered = fines.filter(fine => {
            const searchLower = filters.search.toLowerCase();
            const searchMatch = !searchLower ||
                (fine.vehicleInfo?.placa || '').toLowerCase().includes(searchLower) ||
                (fine.vehicleInfo?.registroInterno || '').toLowerCase().includes(searchLower) ||
                (fine.employeeInfo?.nome || '').toLowerCase().includes(searchLower) ||
                (fine.descricao || '').toLowerCase().includes(searchLower);
            const statusMatch = filters.status === 'todos' || fine.status === filters.status;
            return searchMatch && statusMatch;
        });
        
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let valA, valB;
                switch (sortConfig.key) {
                    case 'vehicle':
                        valA = a.vehicleInfo?.registroInterno || '';
                        valB = b.vehicleInfo?.registroInterno || '';
                        break;
                    case 'employee':
                         valA = a.employeeInfo?.nome || '';
                         valB = b.employeeInfo?.nome || '';
                        break;
                    case 'valor':
                        valA = a.valor || 0;
                        valB = b.valor || 0;
                        break;
                    case 'dataInfração':
                         valA = a.dataInfração || '';
                         valB = b.dataInfração || '';
                         break;
                    default:
                        valA = a[sortConfig.key] || '';
                        valB = b[sortConfig.key] || '';
                }
                
                let comparison = 0;
                if (typeof valA === 'number' && typeof valB === 'number') {
                    comparison = valA - valB;
                } else {
                    comparison = String(valA).localeCompare(String(valB), 'pt-BR', { sensitivity: 'base' });
                }
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return filtered;
    }, [fines, filters, sortConfig]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Paga': return 'bg-green-100 text-green-700 border-green-200';
            case 'Pendente': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'Em Recurso': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Cancelada': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 font-sans">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" tracking-tight">Gerenciamento de Multas</h1>
                <ProtectedComponent requiredPermission="editor">
                    <button onClick={() => openModal()} className="flex items-center gap-2 px-5 py-2.5 mak-btn mak-btn-primary">
                        <PlusCircle size={20} />Registrar Multa
                    </button>
                </ProtectedComponent>
            </div>

            <div className="mb-6 p-5 bg-white rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4" style={{ border: "1px solid #f0ebe3" }}>
                <input
                    type="text"
                    name="search"
                    placeholder="🔍 Buscar por placa, condutor, descrição..."
                    value={filters.search}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition"
                 />
                <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition"
                >
                    <option value="todos">Status: Todos</option>
                    <option value="Pendente">Status: Pendente</option>
                    <option value="Paga">Status: Paga</option>
                    <option value="Em Recurso">Status: Em Recurso</option>
                    <option value="Cancelada">Status: Cancelada</option>
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden " style={{ border: "1px solid #f0ebe3" }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 min-w-[800px]">
                         <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition" onClick={() => requestSort('vehicle')}>
                                    Veículo <ChevronsUpDown size={14} className="inline ml-1 opacity-40"/>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition" onClick={() => requestSort('employee')}>
                                    Condutor <ChevronsUpDown size={14} className="inline ml-1 opacity-40"/>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition" onClick={() => requestSort('dataInfração')}>
                                    Infração <ChevronsUpDown size={14} className="inline ml-1 opacity-40"/>
                                </th>
                                <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100 transition" onClick={() => requestSort('valor')}>
                                    Valor <ChevronsUpDown size={14} className="inline ml-1 opacity-40"/>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition" onClick={() => requestSort('status')}>
                                    Status <ChevronsUpDown size={14} className="inline ml-1 opacity-40"/>
                                </th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {processedFines.map(fine => {
                                const isNotifying = notifyingIds.has(fine.id);
                                return (
                                <tr key={fine.id} className="bg-white transition-colors duration-150 group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">
                                            {fine.vehicleInfo?.registroInterno || 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                                            {fine.vehicleInfo?.placa || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-[180px]">
                                        <div className="font-medium text-gray-900 truncate" title={fine.employeeInfo?.nome}>
                                            {fine.employeeInfo?.nome || 'N/A'}
                                        </div>
                                        {fine.discountFromEmployee && (
                                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 mt-1 inline-block font-medium">
                                                Descontar
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 max-w-[220px]">
                                        <div className="font-medium text-gray-800 truncate" title={fine.descricao}>{fine.descricao || 'N/A'}</div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                            <span>📅 {formatDate(fine.dataInfração)}</span>
                                            {fine.local && <span className="truncate max-w-[100px]" title={fine.local}>📍 {fine.local}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-800 whitespace-nowrap">
                                        R$ {(parseFloat(fine.valor) || 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-sm ${getStatusBadge(fine.status)}`}>
                                            {fine.status || 'N/A'}
                                        </span>
                                         {fine.status === 'Pendente' && fine.dataVencimento && (
                                             <div className="text-[11px] text-gray-500 mt-1.5 font-medium">
                                                 Vence: {formatDate(fine.dataVencimento)}
                                             </div>
                                         )}
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <div className="flex justify-center items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => {
                                                     const emp = employees.find(e => e.id === fine.employeeId);
                                                     const veh = vehicles.find(v => v.id === fine.vehicleId);
                                                     generateFinePDF(fine, emp, veh, false); 
                                                }}
                                                title="Visualizar PDF" 
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            
                                            <button 
                                                onClick={() => handleSendWhatsAppAPI(fine)}
                                                disabled={isNotifying}
                                                title="Enviar WhatsApp via API c/ Anexo" 
                                                className={`p-1.5 rounded-full transition ${isNotifying ? 'text-green-400' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                                            >
                                                {isNotifying ? <Loader className="animate-spin" size={18} /> : <Send size={18} />}
                                            </button>

                                            <ProtectedComponent requiredPermission="editor">
                                                <button onClick={() => openModal(fine)} title="Editar" className="p-1.5 text-gray-400 hover:text-[#9E7A42] hover:bg-[#fdf8f0] rounded-full transition"><Edit size={18} /></button>
                                            </ProtectedComponent>
                                            <ProtectedComponent requiredPermission="admin">
                                                <button onClick={() => openDeleteModal(fine.id)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"><Trash2 size={18} /></button>
                                            </ProtectedComponent>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {processedFines.length === 0 && (
                                <tr><td colSpan="6" className="text-center p-10 text-gray-500 italic">Nenhuma multa encontrada com os filtros atuais.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && <FineModal user={user} fine={editingFine} vehicles={vehicles} employees={employees} onClose={() => setIsModalOpen(false)} setAlertMessage={setAlertMessage} apiClient={apiClient} reloadData={reloadData} />}
            {isDeleteModalOpen && itemToDelete &&
                <PasswordConfirmationModal
                    message="Confirme sua senha para EXCLUIR esta multa permanentemente."
                    onConfirm={handleDelete}
                    onClose={() => setIsDeleteModalOpen(false)}
                    apiClient={apiClient}
                />}
        </div>
    );
};

export default FinesPage;



