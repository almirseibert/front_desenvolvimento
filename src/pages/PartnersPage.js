import React, { useState, useMemo } from 'react';
import {
    PlusCircle, Edit, Trash2, FileText, X, Loader, 
    Droplet, Truck, Fuel, Printer, ChevronDown, ChevronUp,
    Save, Ban, CheckCircle, PackageOpen
} from 'lucide-react';
import ProtectedComponent from '../components/ProtectedComponent';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Página de Parceiros (Postos e Fornecedores) ---
const PartnersPage = ({
    user, partners = [], vehicles = [], refuelings = [], comboioTransactions = [],
    PasswordConfirmationModal, setAlertMessage, apiClient, reloadData, ConfirmationModal
}) => {
    // Abas de navegação
    const [activeTab, setActiveTab] = useState('posto'); // 'posto' | 'fornecedor'

    // Estados
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

    // Estados de item
    const [editingPartner, setEditingPartner] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [partnerForReport, setPartnerForReport] = useState(null);
    const [partnerForPrices, setPartnerForPrices] = useState(null);
    const [partnerToToggleStatus, setPartnerToToggleStatus] = useState(null);

    // Estados para filtro e ordenação
    const [filterText, setFilterText] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'razaoSocial', direction: 'ascending' });

    // Funções de Modal
    const openModal = (p = null) => { setEditingPartner(p); setIsModalOpen(true); };
    const openDeleteModal = (id) => { setItemToDelete({ id }); setIsDeleteModalOpen(true); };
    const openReportModal = (p) => { setPartnerForReport(p); setIsReportModalOpen(true); };
    const openPriceModal = (p) => { setPartnerForPrices(p); setIsPriceModalOpen(true); };
    
    // Delete
    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await apiClient.deletePartner(itemToDelete.id);
            setAlertMessage("Registro excluído com sucesso!");
            reloadData();
        } catch (error) {
            console.error("Erro ao excluir:", error);
            setAlertMessage(error.message || "Falha ao excluir.");
        } finally {
            setItemToDelete(null);
            setIsDeleteModalOpen(false);
        }
    };

    // Toggle Status
    const handleToggleStatus = async () => {
        if (!partnerToToggleStatus) return;
        try {
            const novoStatus = partnerToToggleStatus.status_operacional === 'BLOQUEADO' ? 'ATIVO' : 'BLOQUEADO';
            await apiClient.updatePartnerStatus(partnerToToggleStatus.id, novoStatus);
            setAlertMessage(`Parceiro ${novoStatus === 'ATIVO' ? 'ativado' : 'bloqueado'} com sucesso!`);
            reloadData();
        } catch (error) {
            setAlertMessage('Erro ao alterar status: ' + error.message);
        } finally {
            setPartnerToToggleStatus(null);
        }
    };

    // Lógica de Filtro e Ordenação (Separando por Aba)
    const filteredAndSortedPartners = useMemo(() => {
        let filteredItems = [...(partners || [])];

        // 0. Filtrar pela Aba Ativa (Se não tiver tipo, assume posto para retrocompatibilidade)
        filteredItems = filteredItems.filter(p => {
            const tipo = p.tipo_parceiro || 'posto';
            return tipo === activeTab;
        });

        // 1. Filtrar texto
        if (filterText) {
            filteredItems = filteredItems.filter(partner =>
                (partner.razaoSocial || '').toLowerCase().includes(filterText.toLowerCase()) ||
                (partner.cidade || '').toLowerCase().includes(filterText.toLowerCase()) ||
                (partner.cnpj || '').includes(filterText)
            );
        }

        // 2. Ordenar
        if (sortConfig.key) {
            filteredItems.sort((a, b) => {
                const aValue = a[sortConfig.key] || '';
                const bValue = b[sortConfig.key] || '';
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filteredItems;
    }, [partners, filterText, sortConfig, activeTab]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        if (sortConfig.direction === 'ascending') return <ChevronUp size={14} className="ml-1" />;
        return <ChevronDown size={14} className="ml-1" />;
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">Postos & Fornecedores</h1>
                <ProtectedComponent requiredPermission="editor">
                    <button onClick={() => openModal()} className="flex items-center gap-2 px-3 py-2 mak-btn mak-btn-primary">
                        <PlusCircle size={18} /> Cadastrar {activeTab === 'posto' ? 'Posto' : activeTab === 'locador' ? 'Locador' : 'Fornecedor'}
                    </button>
                </ProtectedComponent>
            </div>

            {/* ABAS */}
            <div className="flex border-b border-gray-200 mb-4 bg-white rounded-t-lg pt-2 px-2 overflow-x-auto shadow-sm">
                <button 
                    onClick={() => setActiveTab('posto')} 
                    className={`py-3 px-4 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'posto' ? 'border-b-2 border-[#9E7A42] text-[#9E7A42] bg-yellow-50' : 'text-[#9a8a78] hover:text-[#6a5e4e] hover:bg-gray-50'}`}
                >
                    <Droplet size={16} /> Postos de Combustível
                </button>
                <button 
                    onClick={() => setActiveTab('fornecedor')} 
                    className={`py-3 px-4 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'fornecedor' ? 'border-b-2 border-[#9E7A42] text-[#9E7A42] bg-yellow-50' : 'text-[#9a8a78] hover:text-[#6a5e4e] hover:bg-gray-50'}`}
                >
                    <PackageOpen size={16} /> Peças & Serviços (Fornecedores)
                </button>
                <button
                    onClick={() => setActiveTab('locador')}
                    className={`py-3 px-4 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'locador' ? 'border-b-2 border-[#9E7A42] text-[#9E7A42] bg-yellow-50' : 'text-[#9a8a78] hover:text-[#6a5e4e] hover:bg-gray-50'}`}
                >
                    <Truck size={16} /> Locadores (Equip. Terceirizados)
                </button>
            </div>

            {/* Filtro */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Filtrar por nome, CNPJ ou cidade..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                />
            </div>

            {/* Lista */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden " style={{ border: "1px solid #f0ebe3" }}>
                <div className="hidden md:grid grid-cols-8 gap-4 p-4 font-semibold text-xs text-gray-600 border-b bg-gray-50 uppercase tracking-wider">
                    <div className="col-span-2 cursor-pointer flex items-center" onClick={() => requestSort('razaoSocial')}>
                        Razão Social / Endereço {getSortIcon('razaoSocial')}
                    </div>
                    <div className="cursor-pointer flex items-center" onClick={() => requestSort('cidade')}>
                        Cidade {getSortIcon('cidade')}
                    </div>
                    <div>WhatsApp</div>
                    <div>Contato</div>
                    <div className="text-center">Status</div>
                    <div className="col-span-2 text-center">Ações</div>
                </div>

                {filteredAndSortedPartners.map(partner => (
                    <div key={partner.id} className={`grid grid-cols-1 md:grid-cols-8 gap-y-2 gap-x-4 items-center p-3 md:p-4 border-b last:border-b-0 hover:bg-gray-50 text-sm ${partner.status_operacional === 'BLOQUEADO' ? 'bg-red-50' : ''}`}>
                        <div className="md:col-span-2">
                            <p className="font-bold text-gray-900">{partner.razaoSocial}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{partner.endereco}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{partner.cnpj}</p>
                        </div>
                        <div><span className="font-medium text-gray-500 md:hidden">Cidade: </span>{partner.cidade}</div>
                        <div><span className="font-medium text-gray-500 md:hidden">WhatsApp: </span>{partner.whatsapp}</div>
                        <div>
                             <span className="font-medium text-gray-500 md:hidden">Contato: </span>
                             <span className="block truncate" title={`${partner.contatoResponsavel || ''} ${partner.telefone ? `(${partner.telefone})` : ''}`}>
                                {partner.contatoResponsavel} {partner.telefone && `(${partner.telefone})`}
                             </span>
                        </div>
                        <div className="text-center">
                            {partner.status_operacional === 'BLOQUEADO' ? (
                                <span className="inline-flex items-center gap-1 text-red-600 font-bold text-xs px-2 py-1 bg-red-100 rounded-full"><Ban size={12}/> BLOQUEADO</span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-green-600 font-bold text-xs px-2 py-1 bg-green-100 rounded-full"><CheckCircle size={12}/> ATIVO</span>
                            )}
                        </div>
                        
                        <div className="md:col-span-2 flex flex-wrap gap-1 justify-start md:justify-center mt-2 md:mt-0">
                            {activeTab === 'posto' && (
                                <button onClick={() => openReportModal(partner)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full" title="Relatório de Abastecimentos"><FileText size={14} /></button>
                            )}
                            <ProtectedComponent requiredPermission="editor">
                                <button 
                                    onClick={() => setPartnerToToggleStatus(partner)}
                                    className={`p-1.5 rounded-full transition ${partner.status_operacional === 'BLOQUEADO' ? 'text-green-600 hover:bg-green-100' : 'text-red-400 hover:text-red-600 hover:bg-red-100'}`}
                                    title={partner.status_operacional === 'BLOQUEADO' ? "Desbloquear (Ativar)" : "Bloquear (Lista Negra)"}
                                >
                                    {partner.status_operacional === 'BLOQUEADO' ? <CheckCircle size={14}/> : <Ban size={14}/>}
                                </button>
                                {activeTab === 'posto' && (
                                    <button onClick={() => openPriceModal(partner)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-gray-100 rounded-full" title="Valores Combustíveis"><Fuel size={14} /></button>
                                )}
                                <button onClick={() => openModal(partner)} className="p-1.5 text-gray-400 hover:text-[#9E7A42] hover:bg-[#f5f2ed] rounded-full" title="Editar"><Edit size={14} /></button>
                            </ProtectedComponent>
                            <ProtectedComponent requiredPermission="admin">
                                <button onClick={() => openDeleteModal(partner.id)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full"><Trash2 size={14}/></button>
                            </ProtectedComponent>
                        </div>
                    </div>
                ))}
                {filteredAndSortedPartners.length === 0 && (
                    <p className="p-6 text-center text-gray-500 italic">Nenhum registro encontrado nesta categoria.</p>
                )}
            </div>

            {/* Modais */}
            {isModalOpen && (
                <PartnerModal user={user} partner={editingPartner} defaultTipo={activeTab} onClose={() => setIsModalOpen(false)} apiClient={apiClient} reloadData={reloadData} setAlertMessage={setAlertMessage} />
            )}
            {isPriceModalOpen && (
                <FuelPriceModal user={user} partner={partnerForPrices} onClose={() => setIsPriceModalOpen(false)} apiClient={apiClient} reloadData={reloadData} setAlertMessage={setAlertMessage} />
            )}
            {isReportModalOpen && (
                <RefuelingReportModal partner={partnerForReport} vehicles={vehicles} refuelings={refuelings} comboioTransactions={comboioTransactions} onClose={() => setIsReportModalOpen(false)} apiClient={apiClient} reloadData={reloadData} setAlertMessage={setAlertMessage} />
            )}
            {isDeleteModalOpen && itemToDelete && (
                <PasswordConfirmationModal message="Confirme sua senha para excluir. Todas as ordens vinculadas perderão a referência visual (mas não serão excluídas)." onConfirm={handleDelete} onClose={() => setIsDeleteModalOpen(false)} apiClient={apiClient} />
            )}

            {partnerToToggleStatus && ConfirmationModal ? (
                <ConfirmationModal 
                    title={partnerToToggleStatus.status_operacional === 'BLOQUEADO' ? "Ativar Cadastro" : "Bloquear Cadastro"}
                    message={partnerToToggleStatus.status_operacional === 'BLOQUEADO' 
                        ? "Deseja ativar este fornecedor/posto novamente?" 
                        : "Deseja adicionar este parceiro à Lista Negra? Ninguém poderá selecioná-lo em novas ordens."}
                    onConfirm={handleToggleStatus}
                    onClose={() => setPartnerToToggleStatus(null)}
                    confirmColor={partnerToToggleStatus.status_operacional === 'BLOQUEADO' ? "bg-green-500 hover:bg-green-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}
                    confirmText={partnerToToggleStatus.status_operacional === 'BLOQUEADO' ? "Ativar" : "Bloquear"}
                />
            ) : partnerToToggleStatus && (
                <PasswordConfirmationModal message="Confirme a alteração de status deste parceiro." onConfirm={handleToggleStatus} onClose={() => setPartnerToToggleStatus(null)} apiClient={apiClient} />
            )}
        </div>
    );
};

// --- Modal de Adicionar/Editar ---
const PartnerModal = ({ user, partner, defaultTipo, onClose, setAlertMessage, apiClient, reloadData }) => {
    const [formData, setFormData] = useState({
        razaoSocial: partner?.razaoSocial || '',
        cnpj: partner?.cnpj || '',
        inscricaoEstadual: partner?.inscricaoEstadual || '',
        endereco: partner?.endereco || '',
        cidade: partner?.cidade || '',
        telefone: partner?.telefone || '',
        whatsapp: partner?.whatsapp || '',
        email: partner?.email || '',
        contatoResponsavel: partner?.contatoResponsavel || '',
        tipo_parceiro: partner?.tipo_parceiro || defaultTipo || 'posto',
        envia_por_whatsapp: !!(partner?.envia_por_whatsapp ?? 0),
        envia_por_email:    !!(partner?.envia_por_email    ?? 0),
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.razaoSocial) return setAlertMessage("A Razão Social é obrigatória.");

        setIsSaving(true);
        const dataToSave = { ...formData };
        // Converte os checkboxes para 1/0 (esperado pelo banco). Strings vazias viram null.
        dataToSave.envia_por_whatsapp = dataToSave.envia_por_whatsapp ? 1 : 0;
        dataToSave.envia_por_email    = dataToSave.envia_por_email    ? 1 : 0;
        Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === '') dataToSave[key] = null; });

        try {
            if (partner) {
                await apiClient.updatePartner(partner.id, dataToSave);
                setAlertMessage(`Registro atualizado com sucesso!`);
            } else {
                const dataForCreation = { ...dataToSave, id: crypto.randomUUID() };
                if (dataForCreation.tipo_parceiro === 'posto') {
                    dataForCreation.fuel_prices = { 'Diesel S10': 0, 'Diesel S500': 0, 'Arla': 0, 'Gasolina Comum': 0, 'Gasolina Aditivada': 0 };
                }
                await apiClient.createPartner(dataForCreation);
                setAlertMessage(`Cadastrado com sucesso!`);
            }
            reloadData();
            onClose();
        } catch (error) {
            setAlertMessage(error.message || "Erro ao salvar.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[95vh] flex flex-col my-auto">
                <div className="p-4 sm:p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
                    <h2 className="text-xl sm:text-2xl font-bold">{partner ? 'Editar Cadastro' : 'Novo Cadastro'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200" disabled={isSaving}><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                        <div className="md:col-span-2">
                            <label className="block font-medium text-gray-700 mb-2">Categoria do Parceiro *</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tipo_parceiro" value="posto" checked={formData.tipo_parceiro === 'posto'} onChange={handleChange} className="text-yellow-500 focus:ring-yellow-500" /> Posto de Combustível</label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tipo_parceiro" value="fornecedor" checked={formData.tipo_parceiro === 'fornecedor'} onChange={handleChange} className="text-yellow-500 focus:ring-yellow-500" /> Fornecedor (Peças, Serviços, etc)</label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tipo_parceiro" value="locador" checked={formData.tipo_parceiro === 'locador'} onChange={handleChange} className="text-yellow-500 focus:ring-yellow-500" /> Locador (Equip. Terceirizados)</label>
                            </div>
                        </div>

                        <div className="md:col-span-2"><label className="block font-medium text-gray-700">Razão Social / Fantasia *</label><input name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} required className="mt-1 p-2 border rounded w-full bg-white focus:ring-2 focus:ring-yellow-500 outline-none" /></div>
                        <div><label className="block font-medium text-gray-700">CNPJ / CPF</label><input name="cnpj" value={formData.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" className="mt-1 p-2 border rounded w-full bg-white" /></div>
                        <div><label className="block font-medium text-gray-700">Inscrição Estadual</label><input name="inscricaoEstadual" value={formData.inscricaoEstadual} onChange={handleChange} className="mt-1 p-2 border rounded w-full bg-white" /></div>
                        <div className="md:col-span-2"><label className="block font-medium text-gray-700">Endereço Completo</label><input name="endereco" value={formData.endereco} onChange={handleChange} placeholder="Rua, Número, Bairro" className="mt-1 p-2 border rounded w-full bg-white" /></div>
                        <div className="md:col-span-2"><label className="block font-medium text-gray-700">Cidade - UF</label><input name="cidade" value={formData.cidade} onChange={handleChange} placeholder="Lajeado - RS" className="mt-1 p-2 border rounded w-full bg-white" /></div>
                        <div><label className="block font-medium text-gray-700">Telefone Fixo</label><input name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 0000-0000" className="mt-1 p-2 border rounded w-full bg-white" /></div>
                        <div><label className="block font-medium text-gray-700">WhatsApp</label><input name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="(00) 90000-0000" className="mt-1 p-2 border rounded w-full bg-white" /></div>
                        <div><label className="block font-medium text-gray-700">E-mail</label><input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="contato@empresa.com" className="mt-1 p-2 border rounded w-full bg-white" /></div>
                        <div><label className="block font-medium text-gray-700">Contato Responsável (Nome)</label><input name="contatoResponsavel" value={formData.contatoResponsavel} onChange={handleChange} placeholder="Falar com..." className="mt-1 p-2 border rounded w-full bg-white" /></div>

                        {formData.tipo_parceiro === 'posto' && (
                            <div className="md:col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                                <label className="block font-bold text-gray-800 mb-2 text-xs uppercase tracking-wide">
                                    Envio automático de ordens
                                </label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            name="envia_por_whatsapp"
                                            checked={!!formData.envia_por_whatsapp}
                                            onChange={handleChange}
                                            className="w-4 h-4 accent-green-600"
                                        />
                                        Enviar ordem por <strong>WhatsApp</strong>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            name="envia_por_email"
                                            checked={!!formData.envia_por_email}
                                            onChange={handleChange}
                                            className="w-4 h-4 accent-blue-600"
                                        />
                                        Enviar ordem por <strong>E-mail</strong>
                                    </label>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-2">
                                    Os canais marcados receberão a ordem automaticamente assim que ela for criada.
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-end gap-2 sticky bottom-0 z-10">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-medium w-full sm:w-auto" disabled={isSaving}>Cancelar</button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 mak-btn mak-btn-primary">
                            {isSaving ? <><Loader className="animate-spin" size={18}/> Salvando...</> : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Modal de Preços de Combustível (MANTIDO NA ÍNTEGRA) ---
const FuelPriceModal = ({ user, partner, onClose, setAlertMessage, apiClient, reloadData }) => {
    const [prices, setPrices] = useState({
        'Diesel S10': partner?.fuel_prices?.['Diesel S10']?.toString().replace('.', ',') || '',
        'Diesel S500': partner?.fuel_prices?.['Diesel S500']?.toString().replace('.', ',') || '',
        'Arla': partner?.fuel_prices?.['Arla']?.toString().replace('.', ',') || '',
        'Gasolina Comum': partner?.fuel_prices?.['Gasolina Comum']?.toString().replace('.', ',') || '',
        'Gasolina Aditivada': partner?.fuel_prices?.['Gasolina Aditivada']?.toString().replace('.', ',') || '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handlePriceChange = (e) => {
        const { name, value } = e.target;
        if (/^[\d,]*\d{0,3}$/.test(value) || value === '') {
             setPrices(prev => ({ ...prev, [name]: value.replace('.', ',') }));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const numericPrices = Object.entries(prices).reduce((acc, [key, val]) => {
            acc[key] = parseFloat(val.replace(',', '.')) || 0;
            return acc;
        }, {});

        try {
            await apiClient.updatePartnerFuelPrices(partner.id, numericPrices);
            setAlertMessage("Preços atualizados com sucesso!");
            reloadData();
            onClose();
        } catch (error) {
            console.error("Erro ao salvar preços:", error);
            setAlertMessage(error.message || "Erro ao atualizar os preços.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                 <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">Valores de Combustíveis</h2>
                        <p className="text-gray-600 text-sm">{partner.razaoSocial}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200" disabled={isSaving}><X size={20}/></button>
                 </div>
                <form onSubmit={handleSave}>
                    <div className="p-6 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-medium text-gray-700">Diesel S10 (R$)</label><input name="Diesel S10" value={prices['Diesel S10']} onChange={handlePriceChange} type="text" inputMode="decimal" placeholder="0,00" className="w-full p-2 border rounded mt-1 text-sm"/></div>
                            <div><label className="block text-xs font-medium text-gray-700">Diesel S500 (R$)</label><input name="Diesel S500" value={prices['Diesel S500']} onChange={handlePriceChange} type="text" inputMode="decimal" placeholder="0,00" className="w-full p-2 border rounded mt-1 text-sm"/></div>
                            <div><label className="block text-xs font-medium text-gray-700">Arla (R$)</label><input name="Arla" value={prices['Arla']} onChange={handlePriceChange} type="text" inputMode="decimal" placeholder="0,00" className="w-full p-2 border rounded mt-1 text-sm"/></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                             <div><label className="block text-xs font-medium text-gray-700">Gasolina Comum (R$)</label><input name="Gasolina Comum" value={prices['Gasolina Comum']} onChange={handlePriceChange} type="text" inputMode="decimal" placeholder="0,00" className="w-full p-2 border rounded mt-1 text-sm"/></div>
                            <div><label className="block text-xs font-medium text-gray-700">Gasolina Aditivada (R$)</label><input name="Gasolina Aditivada" value={prices['Gasolina Aditivada']} onChange={handlePriceChange} type="text" inputMode="decimal" placeholder="0,00" className="w-full p-2 border rounded mt-1 text-sm"/></div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 border-t flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium" disabled={isSaving}>Cancelar</button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 mak-btn mak-btn-primary">
                            {isSaving ? <><Loader className="animate-spin" size={18}/> Salvando...</> : 'Salvar Preços'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Modal de Relatório (MANTIDO NA ÍNTEGRA) ---
const RefuelingReportModal = ({ partner, vehicles = [], refuelings = [], comboioTransactions = [], onClose, apiClient, reloadData, setAlertMessage }) => {
    
    const today = new Date().toISOString().split('T')[0];
    const [dateRange, setDateRange] = useState({ start: '', end: today });

    // Estados para edição de NF
    const [editingNfId, setEditingNfId] = useState(null);
    const [newNfValue, setNewNfValue] = useState('');
    const [isUpdatingNf, setIsUpdatingNf] = useState(false);

    // Processa os dados
    const { reportData, totals } = useMemo(() => {
        const data = [];
        const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00Z') : null;
        const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59Z') : null;

        // 1. Abastecimentos normais
        (refuelings || []).forEach(e => {
            const itemDate = new Date(e.data);
            if (e.partnerId !== partner.id || e.status !== 'Concluída') return;
            if (startDate && itemDate < startDate) return;
            if (endDate && itemDate > endDate) return;

            const outros = parseFloat(e.outrosValor) || 0;
            const litros = parseFloat(e.litrosAbastecidos) || 0;
            
            let precoUnit = parseFloat(e.pricePerLiter);
            if (!precoUnit || precoUnit === 0) {
                 precoUnit = parseFloat(partner.fuel_prices?.[e.fuelType] || 0);
            }
            
            const valorCombustivel = litros * precoUnit;
            
            const vehicle = vehicles.find(v => v.id === e.vehicleId);
            const vehicleLabel = vehicle 
                ? `${vehicle.modelo || ''} - ${vehicle.placa || ''}`.trim()
                : (e.vehicleInternalId || 'N/A');

            data.push({
                id: e.id,
                date: itemDate,
                type: 'Abastecimento',
                icon: <Droplet size={14} className="text-blue-500" />,
                description: `Auth: ${e.authNumber} (${vehicleLabel})`,
                vehicleName: vehicleLabel,
                invoiceNumber: e.invoiceNumber || e.notaFiscal || '', 
                fuelType: e.fuelType,
                liters: litros,
                value: valorCombustivel,
                others: outros,
                total: valorCombustivel + outros
            });
        });

        // 2. Entradas de Comboio
        // Não listamos aqui: a entrada de comboio já gera uma linha em `refuelings`
        // (com Auth, veículo do comboio e valores completos) tratada no bloco 1.
        // Manter este iter duplica a linha no relatório do posto.

        const sortedData = data.sort((a, b) => b.date - a.date);
        
        const totals = sortedData.reduce((acc, item) => {
            acc.liters += item.liters;
            acc.value += item.value;
            acc.others += item.others;
            acc.total += item.total;
            return acc;
        }, { liters: 0, value: 0, others: 0, total: 0 });

        return { reportData: sortedData, totals };
    }, [partner, refuelings, comboioTransactions, dateRange, vehicles]);

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    // Funções de Edição de NF
    const handleEditNfClick = (item) => {
        setEditingNfId(item.id);
        setNewNfValue(item.invoiceNumber || '');
    };

    const handleCancelNfEdit = () => {
        setEditingNfId(null);
        setNewNfValue('');
    };

    const handleSaveNf = async (itemId) => {
        setIsUpdatingNf(true);
        try {
            if (apiClient && apiClient.updateRefueling) {
                await apiClient.updateRefueling(itemId, { invoiceNumber: newNfValue });
                if (setAlertMessage) setAlertMessage("NF atualizada com sucesso!");
                if (reloadData) await reloadData();
            } else {
                alert("Função de atualização não configurada no apiClient.");
            }
            setEditingNfId(null);
        } catch (error) {
            console.error("Erro ao atualizar NF:", error);
            alert("Erro ao salvar NF.");
        } finally {
            setIsUpdatingNf(false);
        }
    };

    // Função de Gerar PDF
    const generateReportPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text(`Relatório - ${partner.razaoSocial}`, 14, 22);
        doc.setFontSize(11);
        const startDateStr = dateRange.start ? new Date(dateRange.start + 'T12:00:00').toLocaleDateString('pt-BR') : 'Início';
        const endDateStr = dateRange.end ? new Date(dateRange.end + 'T12:00:00').toLocaleDateString('pt-BR') : 'Hoje';
        doc.text(`Período: ${startDateStr} a ${endDateStr}`, 14, 30);

        const head = [['Data', 'NF', 'Descrição / Veículo', 'Comb.', 'Litros', 'Vl Comb.', 'Vl Outros', 'Vl Total']];
        const body = reportData.map(item => [
            formatDate(item.date),
            item.invoiceNumber || '-',
            item.description, 
            item.fuelType,
            item.liters.toFixed(2),
            `R$ ${item.value.toFixed(2)}`,
            `R$ ${item.others.toFixed(2)}`,
            `R$ ${item.total.toFixed(2)}`,
        ]);

        autoTable(doc, { 
            startY: 35, 
            head: head, 
            body: body, 
            theme: 'striped', 
            headStyles: { fillColor: [34, 139, 34] }
        });

        let finalY = (doc.lastAutoTable?.finalY || 35) + 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAIS DO PERÍODO:`, 14, finalY);
        finalY += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Total Litros: ${totals.liters.toFixed(2)} L`, 14, finalY);
        doc.text(`Total Combustível: R$ ${totals.value.toFixed(2)}`, 60, finalY);
        doc.text(`Total Outros: R$ ${totals.others.toFixed(2)}`, 110, finalY);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(220, 53, 69);
        doc.text(`VALOR TOTAL: R$ ${totals.total.toFixed(2)}`, 14, finalY + 7);

        doc.save(`Relatorio_${partner.razaoSocial.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold">Relatório de Abastecimento</h2>
                        <p className="text-gray-600 text-sm">{partner.razaoSocial}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X size={18}/></button>
                </div>
                
                {/* Filtros */}
                <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-medium text-gray-700">Data Início</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="mt-1 w-full p-2 border rounded-lg bg-gray-50 text-sm" />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-medium text-gray-700">Data Fim</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="mt-1 w-full p-2 border rounded-lg bg-gray-50 text-sm" />
                    </div>
                    <button onClick={generateReportPDF} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition text-sm w-full sm:w-auto" disabled={reportData.length === 0}>
                        <Printer size={16}/> Gerar PDF
                    </button>
                </div>

                {/* Conteúdo Rolável */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar text-sm relative">
                    {reportData.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">NF</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Comb.</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Litros</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor Comb.</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Outros</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap">{formatDate(item.date)}</td>
                                        
                                        {/* Coluna NF com Edição */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {editingNfId === item.id ? (
                                                <div className="flex items-center gap-1">
                                                    <input 
                                                        type="text" 
                                                        value={newNfValue} 
                                                        onChange={(e) => setNewNfValue(e.target.value)}
                                                        className="w-20 p-1 border rounded text-xs"
                                                        placeholder="Nº NF"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSaveNf(item.id)} disabled={isUpdatingNf} className="text-green-600 hover:bg-green-100 p-1 rounded">
                                                        {isUpdatingNf ? <Loader size={14} className="animate-spin"/> : <Save size={14}/>}
                                                    </button>
                                                    <button onClick={handleCancelNfEdit} className="text-red-600 hover:bg-red-100 p-1 rounded">
                                                        <X size={14}/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group">
                                                    <span className="font-mono text-gray-700">{item.invoiceNumber || '-'}</span>
                                                    <ProtectedComponent requiredPermission="editor">
                                                        <button onClick={() => handleEditNfClick(item)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity">
                                                            <Edit size={12}/>
                                                        </button>
                                                    </ProtectedComponent>
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span className="flex items-center gap-2">{item.icon} {item.type}</span>
                                        </td>
                                        <td className="px-4 py-2">{item.description}</td>
                                        <td className="px-4 py-2">{item.fuelType}</td>
                                        <td className="px-4 py-2 text-right">{item.liters.toFixed(2)} L</td>
                                        <td className="px-4 py-2 text-right">R$ {item.value.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right">R$ {item.others.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-bold">R$ {item.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100">
                                <tr className="font-bold text-gray-900">
                                    <td colSpan="5" className="px-4 py-3 text-right text-sm">TOTAIS</td>
                                    <td className="px-4 py-3 text-right text-sm">{totals.liters.toFixed(2)} L</td>
                                    <td className="px-4 py-3 text-right text-sm">R$ {totals.value.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right text-sm">R$ {totals.others.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right text-sm">R$ {totals.total.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    ) : (
                        <p className="text-gray-500 text-center italic py-10">Nenhum abastecimento concluído encontrado para este posto no período selecionado.</p>
                    )}
                </div>
                
                <div className="p-4 bg-gray-50 border-t flex justify-end sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default PartnersPage;



