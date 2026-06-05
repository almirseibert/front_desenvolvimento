import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import apiClient from '../services/apiClient';
import { getVehicleMainReading } from '../utils/vehicleRules';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    PlusCircle, Edit, Trash2, FileText, XCircle, Loader, X,
    ChevronDown, UploadCloud, Paperclip, RefreshCw, Eye, ThumbsUp,
    CheckCircle, FileCode2, MessageCircle, Plus, AlertTriangle,
    Package, Lock, Unlock
} from 'lucide-react';

import ProtectedComponent from '../components/ProtectedComponent';
import { PasswordConfirmationModal } from '../App';
import SearchableSelect from '../components/SearchableSelect';

// ===================================================================================
// HELPERS DE PARSE E FORMATAÇÃO
// ===================================================================================
const getCreatorEmail = (order) => {
    if (!order || !order.createdBy) return 'N/A';
    if (typeof order.createdBy === 'object') return order.createdBy.userEmail || 'N/A';
    try { const p = JSON.parse(order.createdBy); return p.userEmail || 'N/A'; } catch(e) { return order.createdBy; }
};

const getEditorEmail = (order) => {
    if (!order || !order.editedBy) return 'N/A';
    if (typeof order.editedBy === 'object') return order.editedBy.userEmail || 'N/A';
    try { const p = JSON.parse(order.editedBy); return p.userEmail || 'N/A'; } catch(e) { return order.editedBy; }
};

// ===================================================================================
// COMPONENTE: SEÇÃO DE NOTIFICAÇÕES AO FORNECEDOR
// ===================================================================================
const SendNotificationSection = ({ formData, setFormData, partners = [] }) => {
    const selectedPartner = partners.find(p => p.id === formData.supplierId);
    const hasWhatsapp = !!(selectedPartner?.whatsappNumber || selectedPartner?.telefone);
    const hasEmail    = !!(selectedPartner?.email);

    return (
        <div className="border rounded p-4 bg-white shadow-sm">
            <h3 className="font-bold text-gray-800 uppercase mb-3 text-xs flex items-center gap-2">
                <MessageCircle size={14} /> Notificações ao Fornecedor
            </h3>

            <div className="space-y-3">
                {!formData.supplierId && (
                    <p className="text-xs text-gray-400 italic">Selecione um fornecedor para habilitar notificações.</p>
                )}

                {formData.supplierId && (
                    <div className="flex gap-4 flex-wrap">
                        <label className={`inline-flex items-center cursor-pointer ${!hasEmail ? 'opacity-40' : ''}`}>
                            <input
                                type="checkbox"
                                checked={formData.notifyEmail && hasEmail}
                                onChange={e => setFormData({ ...formData, notifyEmail: e.target.checked })}
                                className="h-4 w-4 text-blue-600"
                                disabled={!hasEmail}
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">📧 Enviar por E-mail</span>
                            {!hasEmail && <span className="ml-1 text-xs text-gray-400">(sem e-mail)</span>}
                        </label>

                        <label className={`inline-flex items-center cursor-pointer ${!hasWhatsapp ? 'opacity-40' : ''}`}>
                            <input
                                type="checkbox"
                                checked={formData.notifyWhatsapp && hasWhatsapp}
                                onChange={e => setFormData({ ...formData, notifyWhatsapp: e.target.checked })}
                                className="h-4 w-4 text-green-600"
                                disabled={!hasWhatsapp}
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">📱 Enviar por WhatsApp</span>
                            {!hasWhatsapp && <span className="ml-1 text-xs text-gray-400">(sem número)</span>}
                        </label>
                    </div>
                )}

                {formData.notifyWhatsapp && hasWhatsapp && (
                    <div className="bg-green-50 border border-green-200 rounded p-2">
                        <p className="text-xs text-green-800">
                            <strong>WhatsApp:</strong> Será enviado para {selectedPartner?.razaoSocial} — {selectedPartner?.whatsappNumber || selectedPartner?.telefone}
                        </p>
                    </div>
                )}
                {formData.notifyEmail && hasEmail && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <p className="text-xs text-blue-800">
                            <strong>E-mail:</strong> Será enviado para {selectedPartner?.email}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ===================================================================================
// COMPONENTE: BUSCA INTELIGENTE DE ITEMS DO ESTOQUE
// ===================================================================================
const SmartInventorySelect = ({ onItemSelected, currentItems = [] }) => {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (search.length > 1) {
                setIsLoading(true);
                try {
                    const res = await apiClient.get('/inventory/items', { params: { search } });
                    const data = res?.data ?? res ?? [];
                    setResults(Array.isArray(data) ? data.filter(i => !currentItems.find(c => c.itemId === i.id)) : []);
                } catch (err) {
                    setResults([]);
                }
                setIsLoading(false);
            } else {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [search, currentItems]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div className="flex gap-2 items-center mb-1">
                <Package size={14} className="text-purple-500 shrink-0" />
                <span className="text-xs font-bold text-purple-700 uppercase">Buscar do Estoque</span>
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Buscar item do almoxarifado por nome ou SKU..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
                    onFocus={() => search.length > 1 && setIsOpen(true)}
                    className="flex-1 p-2 border rounded outline-none focus:ring-2 focus:ring-purple-400 text-sm bg-purple-50 border-purple-200"
                />
                {search && (
                    <button type="button" onClick={() => { setSearch(''); setResults([]); setIsOpen(false); }} className="p-2 text-gray-400 hover:text-gray-600">
                        <X size={16} />
                    </button>
                )}
            </div>
            {isOpen && (results.length > 0 || isLoading) && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-2xl max-h-56 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center text-gray-500 text-sm"><Loader className="animate-spin inline mr-2" size={16} />Buscando...</div>
                    ) : (
                        results.map(item => (
                            <div
                                key={item.id}
                                onClick={() => { onItemSelected(item); setSearch(''); setIsOpen(false); }}
                                className="p-3 hover:bg-purple-50 cursor-pointer border-b last:border-b-0 transition"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-gray-900 text-sm">{item.name}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.quantity === 0 ? 'bg-red-100 text-red-700' : item.quantity <= item.minQuantity ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                        {item.quantity} {item.unit || 'un'}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    SKU: {item.sku} | Preço: R$ {(parseFloat(item.unitPrice) || 0).toFixed(2)}
                                    {item.quantity === 0 && <span className="ml-2 text-red-600 font-bold">⚠ Zerado</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ===================================================================================
// COMPONENTE: CRIAÇÃO RÁPIDA DE ITEM NO ESTOQUE
// ===================================================================================
const CreateItemQuickButton = ({ onItemCreated, categories = [] }) => {
    const [showQuickForm, setShowQuickForm] = useState(false);
    const [itemData, setItemData] = useState({ sku: '', name: '', unitPrice: '', categoryId: '' });
    const [isSaving, setIsSaving] = useState(false);

    const handleCreateItem = async () => {
        if (!itemData.sku || !itemData.name) return;
        setIsSaving(true);
        try {
            await apiClient.post('/inventory/items', {
                ...itemData,
                unitPrice: parseFloat(itemData.unitPrice) || 0,
                quantity: 0,
                minQuantity: 5,
            });
            onItemCreated();
            setShowQuickForm(false);
            setItemData({ sku: '', name: '', unitPrice: '', categoryId: '' });
        } catch (error) {
            console.error('Erro ao criar item:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!showQuickForm) {
        return (
            <button
                type="button"
                onClick={() => setShowQuickForm(true)}
                className="text-xs text-purple-600 font-bold hover:underline mt-1 flex items-center gap-1"
            >
                <Plus size={12} /> Criar novo item no estoque
            </button>
        );
    }

    return (
        <div className="bg-purple-50 border border-purple-200 rounded p-3 mt-2 space-y-2">
            <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-purple-800">Novo item rápido no estoque</p>
                <button type="button" onClick={() => setShowQuickForm(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="SKU *" value={itemData.sku} onChange={e => setItemData({ ...itemData, sku: e.target.value })} className="p-2 border rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" />
                <input type="text" placeholder="Nome *" value={itemData.name} onChange={e => setItemData({ ...itemData, name: e.target.value })} className="p-2 border rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" />
                <input type="number" step="0.01" placeholder="Preço R$" value={itemData.unitPrice} onChange={e => setItemData({ ...itemData, unitPrice: e.target.value })} className="p-2 border rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" />
                {categories.length > 0 && (
                    <select value={itemData.categoryId} onChange={e => setItemData({ ...itemData, categoryId: e.target.value })} className="p-2 border rounded text-xs outline-none focus:ring-1 focus:ring-purple-400">
                        <option value="">Categoria (opcional)</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}
            </div>
            <button
                type="button"
                onClick={handleCreateItem}
                disabled={isSaving || !itemData.sku || !itemData.name}
                className="w-full py-1.5 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
                {isSaving ? <Loader className="animate-spin" size={12} /> : <Plus size={12} />}
                {isSaving ? 'Criando...' : 'Criar Item'}
            </button>
        </div>
    );
};

// ===================================================================================
// COMPONENTE: SELECT COM BUSCA PARA FORNECEDORES
// ===================================================================================
const SearchableSupplierSelect = ({ partners = [], value, onChange }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = partners.find(p => p.id === value);
    const filtered = partners.filter(p =>
        (p.razaoSocial || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.cnpj || '').includes(search)
    );

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div
                className="mt-1 p-2 border rounded w-full bg-white cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`truncate ${selected ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {selected ? `${selected.razaoSocial} ${selected.cnpj ? `(${selected.cnpj})` : ''}` : 'Buscar e selecionar fornecedor...'}
                </span>
                <ChevronDown size={16} className="text-gray-500 shrink-0" />
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-2xl max-h-60 flex flex-col">
                    <div className="p-2 sticky top-0 bg-gray-50 border-b">
                        <input
                            type="text"
                            className="w-full p-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                            placeholder="Digite o nome ou CNPJ para filtrar..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        {filtered.map(p => (
                            <div
                                key={p.id}
                                className="p-2 hover:bg-[#fdf8f0] cursor-pointer text-sm border-b last:border-b-0 transition-colors"
                                onClick={() => { onChange(p.id, p.razaoSocial); setIsOpen(false); setSearch(''); }}
                            >
                                <div className="font-semibold text-gray-800">{p.razaoSocial}</div>
                                {p.cnpj && <div className="text-xs text-gray-500">{p.cnpj}</div>}
                            </div>
                        ))}
                        {filtered.length === 0 && <div className="p-3 text-sm text-gray-500 text-center">Nenhum fornecedor encontrado.</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// ===================================================================================
// GERAÇÃO DE PDF PARA ORDEM DE COMPRA/SERVIÇO
// ===================================================================================
const generateOrderPDF = (order, vehicle, employee, operator, obra, logoDataUrl, returnBlob = false) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const effectivePageHeight = 148.5;
    const margin = 10;

    if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', margin, 10, 45, 16.875); } catch(e) {}
    }

    const orderNumberStr = order.orderNumber ? String(order.orderNumber).padStart(6, '0') : '000000';
    const emissorEmail = getCreatorEmail(order);

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('Ordem de Compra/Serviço', pageWidth - margin, 15, { align: 'right' });
    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text(`Nº: ${orderNumberStr}`, pageWidth - margin, 22, { align: 'right' });
    doc.text(`Data: ${order.date ? new Date(order.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A'}`, pageWidth - margin, 29, { align: 'right' });

    doc.setLineWidth(0.5); doc.line(margin, 38, pageWidth - margin, 38);

    const infoStartY = 45;
    const midX = (pageWidth / 2) + 5;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Fornecedor:', margin, infoStartY);
    doc.text('Obra de Destino:', midX, infoStartY);
    doc.setFont('helvetica', 'normal');
    doc.text(order.supplier || 'N/A', margin + 25, infoStartY);
    doc.text(obra?.nome || order.obraId || 'Não especificada', midX + 30, infoStartY);

    doc.setFont('helvetica', 'bold');
    doc.text('Func. Autorizado:', margin, infoStartY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(employee?.nome || 'Não especificado', margin + 35, infoStartY + 7);

    if (operator) {
        doc.setFont('helvetica', 'bold');
        doc.text('Operador (Custo):', margin, infoStartY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(operator.nome || 'N/A', margin + 35, infoStartY + 12);
    }

    if (vehicle) {
        doc.setFont('helvetica', 'bold');
        doc.text('Veículo Vinculado:', midX, infoStartY + 7);
        doc.setFont('helvetica', 'normal');
        doc.text(`${vehicle.registroInterno || 'N/A'} - ${vehicle.placa || 'N/A'}`, midX + 35, infoStartY + 7);
        if (order.kmHrAtual != null && order.kmHrAtual !== '') {
            doc.setFont('helvetica', 'bold');
            doc.text(`${order.kmHrUnit || 'Km/Hr'} Atual:`, midX, infoStartY + 12);
            doc.setFont('helvetica', 'normal');
            doc.text(`${Number(order.kmHrAtual).toLocaleString('pt-BR')} ${order.kmHrUnit || ''}`, midX + 35, infoStartY + 12);
        }
    }

    const tableBody = (order.items || []).map(item => [
        item.quantity || 0,
        item.description || '',
        order.status !== 'Pendente de Valor' ? `R$ ${(parseFloat(item.unitPrice) || 0).toFixed(2)}` : 'A cotar',
        order.status !== 'Pendente de Valor' ? `R$ ${((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}` : 'A cotar'
    ]);

    let finalY = infoStartY + 18;

    autoTable(doc, {
        startY: finalY,
        head: [['Qtd.', 'Descrição do Item/Serviço', 'Vlr. Unit.', 'Vlr. Total']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [24, 49, 83], fontSize: 9 },
        styles: { fontSize: 8 },
        didDrawPage: (data) => {
            finalY = data.cursor.y;
            if (order.status !== 'Pendente de Valor') {
                doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
                doc.text('Total Geral:', data.settings.margin.left, finalY + 8);
                const displayTotal = order.totalValue != null ? order.totalValue : (order.items || []).reduce((sum, i) => sum + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0)), 0);
                doc.text(`R$ ${(parseFloat(displayTotal) || 0).toFixed(2)}`, pageWidth - margin, finalY + 8, { align: 'right' });
                finalY += 8;
            }
        }
    });

    if (doc.lastAutoTable && doc.lastAutoTable.finalY) {
        finalY = doc.lastAutoTable.finalY > finalY ? doc.lastAutoTable.finalY : finalY;
    }
    finalY += 10;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Condição de Pagamento:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    let paymentText = order.payment?.type || 'N/A';

    if (order.payment?.type === 'A prazo') {
        paymentText += ` - ${order.payment.method || ''}`;
        doc.text(paymentText, margin + 40, finalY);
        finalY += 6;
        if (order.payment?.installments && order.payment.installments.length > 0) {
            order.payment.installments.forEach((inst, idx) => {
                const dataFormatada = inst.dueDate ? new Date(inst.dueDate + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'N/A';
                const valorFormat = (parseFloat(inst.value) || 0).toFixed(2);
                doc.text(`${idx + 1}ª Parcela: ${dataFormatada} - R$ ${valorFormat}`, margin + 40, finalY);
                finalY += 4.5;
            });
        }
    } else {
        doc.text(paymentText, margin + 40, finalY);
        finalY += 7;
    }

    const footerStartY = Math.max(finalY + 5, effectivePageHeight - 25);
    doc.setLineWidth(0.2); doc.line(margin, footerStartY, pageWidth - margin, footerStartY);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Esta ordem de compra deve gerar uma nota fiscal para faturamento.', margin, footerStartY + 5);
    doc.text('Somente os itens acima descriminados estão liberados para compra, itens adicionais não serão pagos.', margin, footerStartY + 9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Ordem emitida por: ${emissorEmail}`, margin, footerStartY + 15);

    doc.setLineDashPattern([1, 1], 0); doc.setDrawColor(180, 180, 180);
    doc.line(0, effectivePageHeight, pageWidth, effectivePageHeight);

    // ← MUDANÇA: retorna blob quando pedido, abre no navegador quando não
    if (returnBlob) {
        return doc.output('blob');
    }
    doc.output('dataurlnewwindow');
};

// ===================================================================================
// COMPONENTE PRINCIPAL: PÁGINA
// ===================================================================================
const OrdersPage = ({
    user, setAlertMessage,
    vehicles = [], employees = [], obras = [], partners = [],
    PasswordConfirmationModal, apiClient, reloadData,
    orders = []
}) => {
    const [localOrders, setLocalOrders] = useState([]);
    const [isFetching, setIsFetching] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [itemToCancel, setItemToCancel] = useState(null);

    const [orderDetailsToView, setOrderDetailsToView] = useState(null);
    const [orderToClose, setOrderToClose] = useState(null);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

    const [filters, setFilters] = useState({ obra: '', vehicle: '', emitter: '', date: '', number: '', status: '' });
    const [loadingAction, setLoadingAction] = useState(false);

    const fetchLocalOrders = async () => {
        setIsFetching(true);
        try {
            let data = [];
            if (typeof apiClient.getAllOrders === 'function') {
                data = await apiClient.getAllOrders();
            } else if (typeof apiClient.get === 'function') {
                const res = await apiClient.get('/orders');
                data = res?.data ?? res ?? [];
            }
            if (data) setLocalOrders(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao buscar ordens locais:", error);
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => { fetchLocalOrders(); }, []);

    const handleReloadData = async () => {
        if (reloadData) await reloadData();
        await fetchLocalOrders();
    };

    const activeOrders = orders && orders.length > 0 ? orders : localOrders;

    const sortedObras    = useMemo(() => [...(obras || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')), [obras]);
    const sortedVehicles = useMemo(() => [...(vehicles || [])].sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')), [vehicles]);

    const filteredOrders = useMemo(() => {
        return (activeOrders || []).filter(order => {
            const dateMatch    = !filters.date   || (order.date && new Date(order.date).toISOString().split('T')[0] === filters.date);
            const numberMatch  = !filters.number || String(order.orderNumber).padStart(6, '0').includes(filters.number);
            const obraMatch    = !filters.obra   || order.obraId === filters.obra;
            const vehicleMatch = !filters.vehicle || order.vehicleId === filters.vehicle;
            const emissorEmail = getCreatorEmail(order);
            const emitterMatch = !filters.emitter || emissorEmail.toLowerCase().includes(filters.emitter.toLowerCase());
            const statusMatch  = !filters.status || order.status === filters.status;
            return dateMatch && numberMatch && obraMatch && vehicleMatch && emitterMatch && statusMatch;
        }).sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0));
    }, [activeOrders, filters]);

    const handleOpenPDF = (order) => {
        const vehicle  = vehicles.find(v => v.id === order.vehicleId);
        const employee = employees.find(e => e.id === order.employeeId);
        const operator = employees.find(e => e.id === order.operatorId);
        const obra     = obras.find(o => o.id === order.obraId);

        const logo = new Image();
        logo.crossOrigin = 'Anonymous';
        logo.src = 'https://i.postimg.cc/pVnwyfRq/MAK-Servi-os-Logotipo.png';
        logo.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = logo.width; canvas.height = logo.height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(logo, 0, 0);
                generateOrderPDF(order, vehicle, employee, operator, obra, canvas.toDataURL('image/png'));
            } catch (e) { generateOrderPDF(order, vehicle, employee, operator, obra, null); }
        };
        logo.onerror = () => generateOrderPDF(order, vehicle, employee, operator, obra, null);
    };

    const openEditModal   = (order) => { setEditingOrder(order); setIsModalOpen(true); };
    const openCancelModal = (order) => { setItemToCancel(order); setIsCancelModalOpen(true); };

    const handleCancelOrder = async () => {
        if (!itemToCancel) return;
        setLoadingAction(true);
        try {
            if (typeof apiClient.cancelOrder === 'function') {
                await apiClient.cancelOrder(itemToCancel.id);
            } else {
                await apiClient.put(`/orders/${itemToCancel.id}/cancel`);
            }
            setAlertMessage("Ordem cancelada com sucesso.");
            await handleReloadData();
        } catch (error) {
            setAlertMessage(error.message || "Falha ao cancelar a ordem.");
        } finally {
            setIsCancelModalOpen(false);
            setItemToCancel(null);
            setLoadingAction(false);
        }
    };

    const handleQuickStatusChange = async (order, newStatus) => {
        try {
            const updatedData = {
                ...order,
                status: newStatus,
                editedBy: { userEmail: user?.email, userId: user?.id || user?.uid }
            };
            if (typeof apiClient.updateOrder === 'function') {
                await apiClient.updateOrder(order.id, updatedData);
            } else {
                await apiClient.put(`/orders/${order.id}`, updatedData);
            }
            setAlertMessage(`Ordem atualizada para: ${newStatus}`);
            await handleReloadData();
        } catch (error) {
            setAlertMessage("Erro ao mudar o status: " + error.message);
        }
    };

    const handleCloseOrderSubmit = async (nfNumber, finalValue) => {
        try {
            const updatedData = {
                ...orderToClose,
                status: 'Concluída',
                invoiceNumber: nfNumber,
                totalValue: finalValue,
                editedBy: { userEmail: user?.email, userId: user?.id || user?.uid }
            };
            if (typeof apiClient.updateOrder === 'function') {
                await apiClient.updateOrder(orderToClose.id, updatedData);
            } else {
                await apiClient.put(`/orders/${orderToClose.id}`, updatedData);
            }

            // ATUALIZAR ESTOQUE ao concluir a OS
            const itemsList = (() => {
                const raw = orderToClose.items;
                if (!raw) return [];
                if (typeof raw === 'string') { try { return JSON.parse(raw); } catch(e) { return []; } }
                return Array.isArray(raw) ? raw : [];
            })();

            for (const item of itemsList) {
                if (item.itemId) {
                    try {
                        await apiClient.post('/inventory/movements', {
                            itemId: item.itemId,
                            type: 'saida',
                            quantity: -Math.abs(parseFloat(item.quantity) || 1),
                            reason: `OS Concluída #${String(orderToClose.orderNumber).padStart(6, '0')} - NF: ${nfNumber}`,
                            reference: orderToClose.id,
                            userEmail: user?.email || 'sistema',
                        });
                    } catch (movErr) {
                        console.warn('[Estoque] Erro ao baixar item:', item.itemId, movErr?.message);
                    }
                }
            }

            setAlertMessage(`Ordem fechada! Despesa gerada para a NF ${nfNumber}.`);
            await handleReloadData();
        } catch (error) {
            setAlertMessage("Erro ao fechar ordem: " + error.message);
        } finally {
            setIsCloseModalOpen(false);
            setOrderToClose(null);
        }
    };

    return (
        <div className="container mx-auto space-y-6 p-4 md:p-6 lg:p-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">Ordens de Compra/Serviço</h1>
                <ProtectedComponent requiredPermission="editor">
                    <div className="flex w-full sm:w-auto gap-2">
                        <button onClick={handleReloadData} className="flex items-center gap-2 mak-btn mak-btn-cancel">
                            <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => { setEditingOrder(null); setIsModalOpen(true); }} className="flex-1 sm:flex-none flex items-center gap-2 px-4 py-2 mak-btn mak-btn-primary">
                            <PlusCircle size={18} />Nova Ordem
                        </button>
                    </div>
                </ProtectedComponent>
            </div>

            <div className="bg-white p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-center text-sm" style={{ border: "1px solid #f0ebe3" }}>
                <input type="text" placeholder="Nº Ordem" value={filters.number} onChange={e => setFilters({...filters, number: e.target.value})} className="p-2 rounded-lg w-full bg-[#faf9f7] text-sm" style={{ border: "1px solid #e8e0d4" }}/>
                <input type="date" value={filters.date} onChange={e => setFilters({...filters, date: e.target.value})} className="p-2 rounded-lg w-full bg-[#faf9f7] text-sm" style={{ border: "1px solid #e8e0d4" }}/>
                <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="p-2 rounded-lg w-full bg-[#faf9f7] text-sm outline-none" style={{ border: "1px solid #e8e0d4" }}>
                    <option value="">Status (Todos)</option>
                    <option value="Pendente de Valor">A Cotar (Pendente)</option>
                    <option value="Ativa">Ativa (Liberada)</option>
                    <option value="Concluída">Concluída</option>
                    <option value="Cancelada">Cancelada</option>
                </select>
                <SearchableSelect
                    items={[
                        { id: 'Administração', nome: 'Administração' },
                        { id: 'Oficina', nome: 'Oficina Central' },
                        ...sortedObras.map(o => ({ ...o, nome: `${o.nome}${o.tipo_registro === 'centro_custo' ? ' (CC)' : ''}` })),
                    ]}
                    value={filters.obra}
                    onChange={(item) => setFilters({...filters, obra: item?.id || ''})}
                    getLabel={(o) => o.nome}
                    placeholder="Todas as Obras"
                />
                <SearchableSelect
                    items={sortedVehicles}
                    value={filters.vehicle}
                    onChange={(item) => setFilters({...filters, vehicle: item?.id || ''})}
                    getLabel={(v) => `${v.registroInterno} - ${v.placa}`}
                    getSubLabel={(v) => v.modelo || ''}
                    placeholder="Todos os Veículos"
                />
                <input type="text" placeholder="Emissor (email)" value={filters.emitter} onChange={e => setFilters({...filters, emitter: e.target.value})} className="p-2 rounded-lg w-full bg-[#faf9f7] text-sm" style={{ border: "1px solid #e8e0d4" }}/>
            </div>

            <div className="bg-white rounded-xl overflow-x-auto" style={{ border: "1px solid #f0ebe3" }}>
                <table className="w-full text-sm text-left min-w-[1100px]">
                    <thead className="text-xs uppercase" style={{ background: "#faf9f7", borderBottom: "1px solid #f0ebe3", color: "#9a8a78" }}>
                        <tr>
                            <th className="p-3">Nº Ordem</th>
                            <th className="p-3">Obra/Local</th>
                            <th className="p-3">Veículo</th>
                            <th className="p-3">Fornecedor</th>
                            <th className="p-3">Func. / Op.</th>
                            <th className="p-3">Data</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Valor Total</th>
                            <th className="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredOrders.map(order => {
                            const vehicle  = vehicles.find(v => v.id === order.vehicleId);
                            const employee = employees.find(e => e.id === order.employeeId);
                            const operator = employees.find(e => e.id === order.operatorId);
                            const obra     = obras.find(o => o.id === order.obraId);

                            const anexosList = (() => {
                                if (!order.anexos) return [];
                                if (typeof order.anexos === 'string') { try { return JSON.parse(order.anexos); } catch(e) { return []; } }
                                return Array.isArray(order.anexos) ? order.anexos : [];
                            })();

                            const statusStyles = {
                                'Ativa':              'bg-blue-100 text-blue-800',
                                'Concluída':          'bg-green-100 text-green-800',
                                'Cancelada':          'bg-red-100 text-red-800',
                                'Pendente de Valor':  'bg-yellow-100 text-yellow-800 animate-pulse'
                            };

                            return (
                                <tr key={order.id} className="hover:bg-gray-50 align-middle">
                                    <td className="p-3 font-bold text-gray-800 whitespace-nowrap">
                                        {String(order.orderNumber || '').padStart(6, '0')}
                                        {anexosList.length > 0 && <span title={`${anexosList.length} anexo(s)`} className="inline-block ml-2 text-gray-400"><Paperclip size={12}/></span>}
                                    </td>
                                    <td className="p-3">{obra?.nome || order.obraId || 'N/A'}</td>
                                    <td className="p-3">{vehicle ? <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-mono">{vehicle.registroInterno}</span> : 'N/A'}</td>
                                    <td className="p-3 max-w-[150px] truncate" title={order.supplier}>{order.supplier}</td>
                                    <td className="p-3 text-xs leading-tight">
                                        <div><strong>R:</strong> {employee?.nome || 'N/A'}</div>
                                        {operator && operator.id !== employee?.id && <div className="text-gray-500 mt-0.5"><strong>Op:</strong> {operator.nome}</div>}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">{order.date ? new Date(order.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${statusStyles[order.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {order.status === 'Ativa' ? 'Liberada (Ativa)' : order.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-medium text-gray-900">
                                        {order.status === 'Pendente de Valor' ? 'A Cotar' : `R$ ${(parseFloat(order.totalValue) || 0).toFixed(2)}`}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-center gap-1.5 flex-wrap w-full">
                                            <button onClick={() => setOrderDetailsToView(order)} title="Ver Detalhes Completos (Raio-X)" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition border border-transparent hover:border-blue-200"><Eye size={16}/></button>
                                            <button onClick={() => handleOpenPDF(order)} title="Gerar / Visualizar PDF" className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md transition"><FileText size={16}/></button>

                                            {order.status === 'Pendente de Valor' && (
                                                <ProtectedComponent requiredPermission="editor">
                                                    <button onClick={() => handleQuickStatusChange(order, 'Ativa')} title="Aprovar e Liberar Ordem" className="p-1.5 text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 rounded-md transition"><ThumbsUp size={16}/></button>
                                                </ProtectedComponent>
                                            )}

                                            {order.status === 'Ativa' && (
                                                <ProtectedComponent requiredPermission="editor">
                                                    <button onClick={() => { setOrderToClose(order); setIsCloseModalOpen(true); }} title="Concluir / Lançar Nota Fiscal" className="p-1.5 text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 rounded-md transition"><CheckCircle size={16}/></button>
                                                </ProtectedComponent>
                                            )}

                                            {/* Botão Editar — disponível para todos os status exceto Cancelada */}
                                            {order.status !== 'Cancelada' && (
                                                <ProtectedComponent requiredPermission="editor">
                                                    <button
                                                        onClick={() => openEditModal(order)}
                                                        title={order.status === 'Concluída' ? 'Editar ordem concluída (desbloqueado)' : 'Editar Ordem'}
                                                        className={`p-1.5 rounded-md transition ${order.status === 'Concluída' ? 'text-orange-500 hover:bg-orange-50 border border-dashed border-orange-300' : 'text-gray-400 hover:text-[#9E7A42] hover:bg-[#fdf8f0]'}`}
                                                    >
                                                        {order.status === 'Concluída' ? <Unlock size={16}/> : <Edit size={16}/>}
                                                    </button>
                                                </ProtectedComponent>
                                            )}

                                            {order.status !== 'Cancelada' && order.status !== 'Concluída' && (
                                                <ProtectedComponent requiredPermission="editor">
                                                    <button onClick={() => openCancelModal(order)} title="Cancelar Ordem" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"><XCircle size={16}/></button>
                                                </ProtectedComponent>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredOrders.length === 0 && (
                            <tr>
                                <td colSpan="9" className="p-8 text-center text-gray-500 italic">
                                    {isFetching ? <><Loader size={18} className="inline animate-spin text-yellow-500 mr-2"/>Buscando dados...</> : 'Nenhuma ordem encontrada com os filtros atuais.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAIS */}
            {orderDetailsToView && <OrderDetailsModal
                order={orderDetailsToView}
                onClose={() => setOrderDetailsToView(null)}
                vehicles={vehicles} employees={employees} obras={obras}
            />}

            {isCloseModalOpen && orderToClose && <CloseOrderModal
                order={orderToClose}
                onClose={() => setIsCloseModalOpen(false)}
                onSubmit={handleCloseOrderSubmit}
            />}

            {isModalOpen && <OrderModal
                user={user}
                onClose={() => { setIsModalOpen(false); setEditingOrder(null); }}
                setAlertMessage={setAlertMessage}
                vehicles={vehicles}
                employees={employees}
                obras={obras}
                partners={partners}
                orderToEdit={editingOrder}
                generatePDF={handleOpenPDF}
                apiClient={apiClient}
                reloadData={handleReloadData}
            />}

            {isCancelModalOpen && itemToCancel && <PasswordConfirmationModal
                message={`Confirme sua senha para CANCELAR a ordem Nº ${String(itemToCancel.orderNumber || '').padStart(6, '0')}.`}
                onConfirm={handleCancelOrder}
                onClose={() => setIsCancelModalOpen(false)}
                apiClient={apiClient}
            />}
        </div>
    );
};

// ===================================================================================
// MODAL RAIO-X
// ===================================================================================
const OrderDetailsModal = ({ order, onClose, vehicles, employees, obras }) => {
    const vehicle  = vehicles.find(v => v.id === order.vehicleId);
    const employee = employees.find(e => e.id === order.employeeId);
    const operator = employees.find(e => e.id === order.operatorId);
    const obra     = obras.find(o => o.id === order.obraId);

    const safeParseJson = (raw, fallback) => {
        if (!raw) return fallback;
        if (typeof raw === 'object') return raw;
        try { return JSON.parse(raw); } catch(e) { return fallback; }
    };

    const anexosList = safeParseJson(order.anexos, []);
    const itemsList  = safeParseJson(order.items, []);
    const payment    = safeParseJson(order.payment, { type: 'N/A' });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <Eye className="text-blue-500"/> Detalhes da Ordem #{String(order.orderNumber || '').padStart(6, '0')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between border-b pb-4">
                        <div>
                            <span className="text-xs font-bold text-gray-500 block uppercase mb-1">Status Atual</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                order.status === 'Concluída' ? 'bg-green-100 text-green-800' :
                                order.status === 'Ativa' ? 'bg-blue-100 text-blue-800' :
                                order.status === 'Cancelada' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                                {order.status === 'Ativa' ? 'Liberada (Ativa)' : order.status}
                            </span>
                        </div>
                        <div><span className="text-xs font-bold text-gray-500 block uppercase mb-1">Data Emissão</span><p className="font-bold text-gray-900">{order.date ? new Date(order.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A'}</p></div>
                        <div><span className="text-xs font-bold text-gray-500 block uppercase mb-1">Emissor (Criação)</span><p className="font-bold text-gray-900">{getCreatorEmail(order)}</p></div>
                        <div><span className="text-xs font-bold text-gray-500 block uppercase mb-1">Última Edição</span><p className="font-bold text-gray-900">{getEditorEmail(order)}</p></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg border">
                            <h3 className="text-xs font-black text-gray-400 uppercase mb-3">Vínculos de Fornecimento</h3>
                            <p className="text-sm mb-2"><strong className="text-gray-700">Fornecedor:</strong> {order.supplier || 'N/A'}</p>
                            <p className="text-sm mb-2"><strong className="text-gray-700">Obra/Local (Custo):</strong> {obra?.nome || order.obraId || 'N/A'}</p>
                            <p className="text-sm"><strong className="text-gray-700">Veículo:</strong> {vehicle ? `${vehicle.registroInterno} - ${vehicle.placa}` : 'Uso Geral'}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border">
                            <h3 className="text-xs font-black text-gray-400 uppercase mb-3">Equipe Autorizada</h3>
                            <p className="text-sm mb-2"><strong className="text-gray-700">Func. / Retirada:</strong> {employee?.nome || 'N/A'}</p>
                            <p className="text-sm"><strong className="text-gray-700">Operador (Equipamento):</strong> {operator?.nome || 'Não se aplica'}</p>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                        <h3 className="text-xs font-black text-blue-800 uppercase mb-3">Dados Fiscais e Conclusão</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div><p className="text-xs text-blue-600 font-bold uppercase mb-1">Nota Fiscal</p><p className="font-black text-blue-900">{order.invoiceNumber || 'Não informada'}</p></div>
                            <div><p className="text-xs text-blue-600 font-bold uppercase mb-1">Condição de Pagamento</p><p className="font-bold text-blue-900">{payment.type} {payment.method ? `- ${payment.method}` : ''}</p></div>
                            <div><p className="text-xs text-blue-600 font-bold uppercase mb-1">Valor Total Autorizado</p><p className="font-black text-blue-900 text-lg">R$ {(parseFloat(order.totalValue) || 0).toFixed(2)}</p></div>
                        </div>
                        {payment.installments && payment.installments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-blue-200">
                                <p className="text-xs font-bold text-blue-700 mb-2">Desdobramento de Parcelas:</p>
                                <div className="flex gap-2 flex-wrap">
                                    {payment.installments.map((inst, idx) => (
                                        <span key={idx} className="bg-white px-2 py-1 rounded text-xs border border-blue-200 shadow-sm font-semibold text-blue-900">
                                            {idx + 1}ª - {inst.dueDate ? new Date(inst.dueDate + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'N/A'} - R$ {(parseFloat(inst.value) || 0).toFixed(2)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <h3 className="text-xs font-black text-gray-500 uppercase mb-3 border-b pb-1">Itens Descriminados</h3>
                            <table className="w-full text-xs text-left">
                                <thead className="text-gray-400 border-b">
                                    <tr>
                                        <th className="pb-2 w-12">Qtd</th>
                                        <th className="pb-2">Descrição</th>
                                        <th className="pb-2 text-right">Vlr. Unit</th>
                                        <th className="pb-2 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {itemsList.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="py-2 font-bold">{item.quantity}</td>
                                            <td className="py-2">{item.description}</td>
                                            <td className="py-2 text-right">R$ {(parseFloat(item.unitPrice)||0).toFixed(2)}</td>
                                            <td className="py-2 text-right font-semibold">R$ {((parseFloat(item.quantity)||0) * (parseFloat(item.unitPrice)||0)).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-gray-500 uppercase mb-3 border-b pb-1">Anexos / Orçamentos</h3>
                            {anexosList.length > 0 ? (
                                <ul className="space-y-2">
                                    {anexosList.map((anexo, i) => (
                                        <li key={i}>
                                            <a href={anexo.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-gray-50 border rounded text-xs font-semibold text-blue-600 hover:bg-blue-50 transition">
                                                <Paperclip size={14}/> {anexo.name || `Anexo ${i+1}`}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-gray-400 italic">Nenhum documento anexado.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-100 text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50">Voltar para Lista</button>
                </div>
            </div>
        </div>
    );
};

// ===================================================================================
// MODAL FECHAMENTO / CONCLUSÃO (XML / NF)
// ===================================================================================
const CloseOrderModal = ({ order, onClose, onSubmit }) => {
    const [nfNumber, setNfNumber] = useState(order.invoiceNumber || '');
    const [finalValue, setFinalValue] = useState(order.totalValue || 0);
    const [isParsing, setIsParsing] = useState(false);

    const handleXmlImport = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setIsParsing(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const xmlDoc = new DOMParser().parseFromString(evt.target.result, "text/xml");
                const nNfNode = xmlDoc.getElementsByTagName('nNF')[0];
                const vNfNode = xmlDoc.getElementsByTagName('vNF')[0] || xmlDoc.getElementsByTagName('vProd')[0];
                if (nNfNode) setNfNumber(nNfNode.textContent);
                if (vNfNode) setFinalValue(parseFloat(vNfNode.textContent).toFixed(2));
            } catch (err) {
                alert("Erro ao ler o XML. Preencha manualmente.");
            } finally {
                setIsParsing(false);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 border-t-4 border-green-500">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Concluir Ordem #{String(order.orderNumber || '').padStart(6, '0')}</h3>
                <p className="text-xs text-gray-600 mb-4">A confirmação da NF ativará a despesa financeira na Obra selecionada e baixará o estoque dos itens vinculados.</p>

                <div className="mb-4 bg-gray-50 border p-3 rounded border-dashed text-center">
                    <label className="cursor-pointer text-sm font-bold text-green-600 hover:underline flex flex-col items-center gap-1">
                        <FileCode2 size={24}/> Importar Leitura de XML
                        <input type="file" accept=".xml" className="hidden" onChange={handleXmlImport} />
                    </label>
                    {isParsing && <p className="text-xs text-gray-500 mt-2">Lendo XML...</p>}
                </div>

                <div className="space-y-3 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase">Nº Nota Fiscal *</label>
                        <input type="text" value={nfNumber} onChange={e=>setNfNumber(e.target.value)} className="w-full p-2 border rounded bg-white text-sm" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase">Valor Total Cobrado (R$) *</label>
                        <input type="number" step="0.01" value={finalValue} onChange={e=>setFinalValue(e.target.value)} className="w-full p-2 border rounded bg-white text-sm" required />
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm font-bold text-gray-700 hover:bg-gray-300">Cancelar</button>
                    <button onClick={() => onSubmit(nfNumber, parseFloat(finalValue))} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700" disabled={!nfNumber || finalValue <= 0}>
                        Concluir e Lançar NF
                    </button>
                </div>
            </div>
        </div>
    );
};

// ===================================================================================
// MODAL DE CRIAÇÃO/EDIÇÃO DE ORDEM
// ===================================================================================
const OrderModal = ({ user, onClose, setAlertMessage, vehicles = [], employees = [], obras = [], partners = [], orderToEdit, generatePDF, apiClient, reloadData }) => {

    const parsedAnexos = useMemo(() => {
        if (!orderToEdit?.anexos) return [];
        if (typeof orderToEdit.anexos === 'string') { try { return JSON.parse(orderToEdit.anexos); } catch(e) { return []; } }
        return Array.isArray(orderToEdit.anexos) ? orderToEdit.anexos : [];
    }, [orderToEdit]);

    // Determinar se edição de ordem concluída deve ser permitida
    const isClosedOrder = orderToEdit?.status === 'Concluída';
    const [editUnlocked, setEditUnlocked] = useState(!isClosedOrder);

    const [formData, setFormData] = useState({
        supplier:       orderToEdit?.supplier    || '',
        supplierId:     orderToEdit?.supplierId  || '',
        date:           orderToEdit?.date ? new Date(orderToEdit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        employeeId:     orderToEdit?.employeeId  || '',
        operatorId:     orderToEdit?.operatorId  || '',
        obraId:         orderToEdit?.obraId      || '',
        vehicleId:      orderToEdit?.vehicleId   || '',
        kmHrAtual:      orderToEdit?.kmHrAtual   ?? '',
        kmHrUnit:       orderToEdit?.kmHrUnit    || '',
        items: (Array.isArray(orderToEdit?.items) && orderToEdit.items.length > 0
            ? orderToEdit.items
            : [{ quantity: '1', description: '', unitPrice: '', itemId: null }]
        ).map(item => ({
            quantity:    item.quantity?.toString()    || '1',
            description: item.description             || '',
            unitPrice:   item.unitPrice?.toString()   || '',
            itemId:      item.itemId                  || null,
        })),
        payment:        orderToEdit?.payment || { type: 'À vista', method: '', days: '', installments: [] },
        anexos:         parsedAnexos,
        createdBy:      orderToEdit?.createdBy || undefined,
        notifyEmail:    false,
        notifyWhatsapp: false,
    });

    const [isPricePending, setIsPricePending] = useState(orderToEdit ? orderToEdit.status === 'Pendente de Valor' : true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [inventoryCategories, setInventoryCategories] = useState([]);

    // Carregar categorias para o botão de criação rápida
    useEffect(() => {
        apiClient.get('/inventory/categories')
            .then(res => setInventoryCategories(res?.data ?? res ?? []))
            .catch(() => {});
    }, []);

    const sortedVehicles  = useMemo(() => [...vehicles].sort((a,b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')), [vehicles]);
    const sortedEmployees = useMemo(() => [...employees].sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [employees]);
    const sortedObras     = useMemo(() => [...obras].filter(o => o.status === 'ativa').sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [obras]);

    // -------------------------------------------------------
    // AUTO-PREENCHIMENTO ao selecionar Veículo
    // -------------------------------------------------------
    const handleVehicleChange = useCallback(async (vehicleId) => {
        setFormData(prev => ({ ...prev, vehicleId }));
        if (!vehicleId) return;
        try {
            const res = await apiClient.get(`/vehicles/${vehicleId}`);
            const vehicle = res?.data ?? res;
            if (!vehicle) return;

            let suggestedObraId    = formData.obraId;
            let suggestedOperatorId = formData.operatorId;

            // Somente sugerir se o campo ainda está vazio ou se veículo está disponível
            if (vehicle.lastObraId && (!formData.obraId || vehicle.status === 'disponível')) {
                suggestedObraId = vehicle.lastObraId;
                // Buscar operador da última obra
                try {
                    const obraRes = await apiClient.get(`/obras/${vehicle.lastObraId}`);
                    const obra = obraRes?.data ?? obraRes;
                    if (obra?.operatorId && !formData.operatorId) {
                        suggestedOperatorId = obra.operatorId;
                    }
                } catch (_) {}
            }

            const reading = getVehicleMainReading(vehicle);
            setFormData(prev => ({
                ...prev,
                vehicleId,
                obraId:     suggestedObraId,
                operatorId: suggestedOperatorId,
                kmHrAtual:  reading.raw || '',
                kmHrUnit:   reading.unit || '',
            }));
        } catch (err) {
            console.warn('[OrderModal] Erro ao buscar dados do veículo:', err?.message);
        }
    }, [formData.obraId, formData.operatorId]);

    // Gestão de Itens
    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        let processedValue = value;
        if (field === 'unitPrice' || field === 'quantity') {
            processedValue = value.replace(',', '.');
            if (!/^\d*\.?\d*$/.test(processedValue) && processedValue !== '') return;
        }
        newItems[index] = { ...newItems[index], [field]: processedValue };
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => setFormData(prev => ({
        ...prev,
        items: [...prev.items, { quantity: '1', description: '', unitPrice: '', itemId: null }]
    }));

    const removeItem = (index) => setFormData(prev => ({
        ...prev,
        items: formData.items.filter((_, i) => i !== index)
    }));

    // Adicionar item do estoque
    const handleInventoryItemSelected = (stockItem) => {
        const newItem = {
            quantity:    '1',
            description: stockItem.name,
            unitPrice:   stockItem.unitPrice?.toString() || '',
            itemId:      stockItem.id,
        };
        setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    const totalValue = useMemo(() => {
        if (isPricePending) return 0;
        return formData.items.reduce((total, item) => {
            return total + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0));
        }, 0);
    }, [formData.items, isPricePending]);

    // Parcelas
    const addInstallment = () => setFormData(p => ({
        ...p,
        payment: { ...p.payment, installments: [...(p.payment.installments || []), { dueDate: '', value: '' }] }
    }));

    const handleInstallmentChange = (idx, field, value) => setFormData(p => {
        const newInst = [...(p.payment.installments || [])];
        newInst[idx] = { ...newInst[idx], [field]: value };
        return { ...p, payment: { ...p.payment, installments: newInst } };
    });

    const removeInstallment = (idx) => setFormData(p => {
        const newInst = [...(p.payment.installments || [])];
        newInst.splice(idx, 1);
        return { ...p, payment: { ...p.payment, installments: newInst } };
    });

    // Upload de Arquivo
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setAlertMessage("O arquivo excede o limite de 5MB."); return; }
        setIsUploading(true);
        try {
            let fileUrl = '';
            try {
                const uploadData = new FormData();
                uploadData.append('file', file);
                const res = await apiClient.post('/upload', uploadData, { headers: { 'Content-Type': 'multipart/form-data' } });
                fileUrl = res.url || res.fileUrl || res.path || '';
            } catch (err) { console.warn("Upload falhou no servidor. Usando Base64.", err); }
            if (!fileUrl) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                await new Promise((resolve, reject) => { reader.onload = resolve; reader.onerror = reject; });
                fileUrl = reader.result;
            }
            setFormData(p => ({ ...p, anexos: [...(p.anexos || []), { name: file.name, url: fileUrl }] }));
        } catch (error) {
            setAlertMessage("Erro ao anexar arquivo.");
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const removeAnexo = (index) => setFormData(p => ({ ...p, anexos: p.anexos.filter((_, i) => i !== index) }));

    const handleSave = async (e) => {
        if (e) e.preventDefault();

        const itemsValid   = formData.items.length > 0 && formData.items.every(i => (parseFloat(i.quantity) || 0) > 0 && i.description.trim() !== '');
        const pricesValid  = isPricePending || formData.items.every(i => (parseFloat(i.unitPrice) || 0) > 0);
        const paymentValid = formData.payment.type !== 'A prazo' || !!formData.payment.method;

        if (!formData.supplierId || !formData.date || !formData.employeeId || !formData.obraId || !itemsValid || !pricesValid || !paymentValid) {
            let errorMsg = "Preencha Fornecedor, Data, Func. Autorizado, Obra Destino, e Itens válidos.";
            if (!isPricePending && !pricesValid) errorMsg += " Informe os valores Unitários.";
            if (!paymentValid && formData.payment.type === 'A prazo') errorMsg += " Selecione o método de pagamento a prazo.";
            setAlertMessage(errorMsg);
            return;
        }

        setIsSaving(true);

        // -----------------------------------------------------------------------
        // NOVO: Se WhatsApp marcado, gera PDF como blob e faz upload ANTES de salvar
        // -----------------------------------------------------------------------
        let pdfAnexo = null;

        if (formData.notifyWhatsapp) {
            try {
                // Monta os dados da ordem (sem orderNumber ainda) para gerar o PDF
                const previewOrder = {
                    ...formData,
                    date:        new Date(formData.date + 'T12:00:00Z').toISOString(),
                    totalValue:  isPricePending ? 0 : totalValue,
                    status:      isPricePending ? 'Pendente de Valor' : 'Ativa',
                    orderNumber: orderToEdit?.orderNumber || '??????',
                    payment:     formData.payment,
                    items:       formData.items.map(item => ({
                        quantity:    parseFloat(item.quantity) || 0,
                        description: item.description,
                        unitPrice:   isPricePending ? 0 : (parseFloat(item.unitPrice) || 0),
                    })),
                    createdBy: orderToEdit ? formData.createdBy : { userEmail: user?.email },
                };

                const vehicle  = vehicles.find(v => v.id === formData.vehicleId);
                const employee = employees.find(emp => emp.id === formData.employeeId);
                const operator = employees.find(emp => emp.id === formData.operatorId);
                const obra     = obras.find(o => o.id === formData.obraId);

                // Carrega logo e gera blob do PDF
                const pdfBlob = await new Promise((resolve) => {
                    const logo = new Image();
                    logo.crossOrigin = 'Anonymous';
                    logo.src = 'https://i.postimg.cc/pVnwyfRq/MAK-Servi-os-Logotipo.png';
                    logo.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = logo.width; canvas.height = logo.height;
                            const ctx = canvas.getContext('2d'); ctx.drawImage(logo, 0, 0);
                            resolve(generateOrderPDF(previewOrder, vehicle, employee, operator, obra, canvas.toDataURL('image/png'), true));
                        } catch (e) {
                            resolve(generateOrderPDF(previewOrder, vehicle, employee, operator, obra, null, true));
                        }
                    };
                    logo.onerror = () => {
                        resolve(generateOrderPDF(previewOrder, vehicle, employee, operator, obra, null, true));
                    };
                    // Timeout de segurança: se a logo demorar >3s, gera sem ela
                    setTimeout(() => {
                        resolve(generateOrderPDF(previewOrder, vehicle, employee, operator, obra, null, true));
                    }, 3000);
                });

                // Faz upload do PDF para o servidor
                const numStr = String(orderToEdit?.orderNumber || 'nova').padStart(6, '0');
                const pdfFile = new File([pdfBlob], `ordem-${numStr}.pdf`, { type: 'application/pdf' });
                const uploadForm = new FormData();
                uploadForm.append('file', pdfFile);

                const uploadRes = await apiClient.post('/upload', uploadForm, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                const pdfUrl = uploadRes?.url || uploadRes?.fileUrl || uploadRes?.path || null;
                if (pdfUrl) {
                    pdfAnexo = { name: `Ordem-${numStr}.pdf`, url: pdfUrl };
                    console.log('[WhatsApp] PDF gerado e enviado ao servidor:', pdfUrl);
                }
            } catch (uploadErr) {
                // Não bloqueia o salvamento — apenas loga e segue sem o PDF
                console.warn('[WhatsApp] Falha ao gerar/upload do PDF — WhatsApp será enviado sem anexo:', uploadErr.message);
            }
        }
// -----------------------------------------------------------------------
        // Monta os dados finais da ordem (injeta PDF nos anexos se existir)
        // -----------------------------------------------------------------------
        const anexosList = [...(formData.anexos || [])];
        if (pdfAnexo) {
            // Coloca o PDF gerado como primeiro anexo para o backend priorizá-lo
            anexosList.unshift(pdfAnexo);
        }

        const finalOrderData = {
            supplier:       formData.supplier,
            supplierId:     formData.supplierId,
            date:           new Date(formData.date + 'T12:00:00Z').toISOString(),
            employeeId:     formData.employeeId,
            operatorId:     formData.operatorId || null,
            obraId:         formData.obraId,
            vehicleId:      formData.vehicleId || null,
            kmHrAtual:      formData.kmHrAtual !== '' ? parseFloat(formData.kmHrAtual) : null,
            kmHrUnit:       formData.kmHrUnit || null,
            items:          formData.items.map(item => ({
                quantity:    parseFloat(item.quantity) || 0,
                description: item.description,
                unitPrice:   isPricePending ? 0 : (parseFloat(item.unitPrice) || 0),
                itemId:      item.itemId || null,
            })),
            payment:        formData.payment,
            anexos:         JSON.stringify(anexosList),   // ← inclui o PDF se houver
            totalValue:     isPricePending ? 0 : totalValue,
            status:         isPricePending ? 'Pendente de Valor' : 'Ativa',
            notifyEmail:    formData.notifyEmail,
            notifyWhatsapp: formData.notifyWhatsapp,
            createdBy:      orderToEdit ? formData.createdBy : { userEmail: user?.email, userId: user?.id || user?.uid },
            editedBy:       orderToEdit ? { userEmail: user?.email, userId: user?.id || user?.uid } : null
        };

        if (orderToEdit && isClosedOrder && editUnlocked) {
            finalOrderData.status = 'Concluída';
        }

        try {
            let savedOrderData;
            if (orderToEdit) {
                if (typeof apiClient.updateOrder === 'function') {
                    savedOrderData = await apiClient.updateOrder(orderToEdit.id, finalOrderData);
                } else {
                    const res = await apiClient.put(`/orders/${orderToEdit.id}`, finalOrderData);
                    savedOrderData = res.data || res;
                }
                setAlertMessage(`Ordem atualizada com sucesso!${formData.notifyWhatsapp ? ' 📱 Notificação WhatsApp enviada.' : ''}`);
            } else {
                if (typeof apiClient.createOrder === 'function') {
                    savedOrderData = await apiClient.createOrder(finalOrderData);
                } else {
                    const res = await apiClient.post('/orders', finalOrderData);
                    savedOrderData = res.data || res;
                }
                setAlertMessage(`Ordem criada com sucesso!${formData.notifyWhatsapp ? ' 📱 Notificação WhatsApp enviada.' : ''}`);
            }

            if (reloadData) await reloadData();

            // Abre o PDF no navegador com o número correto da ordem (agora que temos o ID)
            if (savedOrderData) {
                const pdfData = { ...finalOrderData, ...savedOrderData };
                if (!pdfData.orderNumber && savedOrderData.orderNumber) pdfData.orderNumber = savedOrderData.orderNumber;
                pdfData.createdBy = finalOrderData.createdBy;
                generatePDF(pdfData); // handleOpenPDF — abre no navegador normalmente
            }

            onClose();
        } catch (error) {
            console.error("Erro ao salvar ordem:", error);
            setAlertMessage(error.message || "Falha ao salvar a ordem.");
        } finally {
            setIsSaving(false);
        }
    };

    const isReadOnly = isClosedOrder && !editUnlocked;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col my-auto">
                {/* Cabeçalho */}
                <div className="p-4 sm:p-5 border-b sticky top-0 bg-white z-10 flex justify-between items-center rounded-t-lg">
                    <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        {orderToEdit ? <Edit size={22} className="text-yellow-500"/> : <PlusCircle size={22} className="text-yellow-500"/>}
                        {orderToEdit ? 'Editar Ordem / Anexos' : 'Nova Ordem de Compra/Serviço'}
                    </h2>
                    <div className="flex items-center gap-2">
                        {/* Botão para desbloquear edição de ordem concluída */}
                        {isClosedOrder && (
                            <button
                                type="button"
                                onClick={() => setEditUnlocked(!editUnlocked)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${editUnlocked ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-gray-100 text-gray-600 border border-gray-300'}`}
                            >
                                {editUnlocked ? <><Unlock size={13}/> Editando Concluída</> : <><Lock size={13}/> Desbloquear Edição</>}
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-200" disabled={isSaving}><X size={20}/></button>
                    </div>
                </div>

                {/* Banner de aviso ao editar ordem concluída */}
                {isClosedOrder && editUnlocked && (
                    <div className="bg-orange-50 border-b border-orange-200 px-5 py-3 flex items-center gap-3">
                        <AlertTriangle className="text-orange-600 shrink-0" size={18} />
                        <p className="text-xs text-orange-800">
                            <strong>Atenção:</strong> Você está editando uma ordem já concluída. As despesas vinculadas serão recalculadas automaticamente pelo backend.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-sm">

                        {/* 1. Informações Base */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 bg-gray-50 p-4 rounded mb-6" style={{ border: "1px solid #f0ebe3" }}>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fornecedor *</label>
                                <SearchableSupplierSelect
                                    partners={partners.filter(p => p.tipo_parceiro === 'fornecedor')}
                                    value={formData.supplierId}
                                    onChange={(id, name) => setFormData({...formData, supplierId: id, supplier: name})}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Data Emissão *</label>
                                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="p-2 border rounded w-full bg-white outline-none focus:border-yellow-500" required disabled={isReadOnly} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Obra de Destino (Custo) *</label>
                                <SearchableSelect
                                    items={[
                                        { id: 'Administração', nome: 'Administração' },
                                        { id: 'Oficina', nome: 'Oficina Central' },
                                        ...sortedObras.map(o => ({ ...o, nome: `${o.nome}${o.tipo_registro === 'centro_custo' ? ' (CC)' : ''}` })),
                                    ]}
                                    value={formData.obraId}
                                    onChange={(item) => setFormData({...formData, obraId: item?.id || ''})}
                                    getLabel={(o) => o.nome}
                                    placeholder="Selecione..."
                                    disabled={isReadOnly}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1" title="Quem fará o serviço ou irá retirar as peças">Funcionário Autorizado (Retirada) *</label>
                                <SearchableSelect
                                    items={sortedEmployees}
                                    value={formData.employeeId}
                                    onChange={(item) => setFormData({...formData, employeeId: item?.id || ''})}
                                    getLabel={(e) => `${e.nome}${e.vulgo ? ` (${e.vulgo})` : ''}`}
                                    getSubLabel={(e) => e.profissao || ''}
                                    placeholder="Selecione quem irá retirar..."
                                    disabled={isReadOnly}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1" title="Para cruzamento de custos de manutenção de equipamento">Operador do Equipamento (Custo)</label>
                                <SearchableSelect
                                    items={sortedEmployees}
                                    value={formData.operatorId}
                                    onChange={(item) => setFormData({...formData, operatorId: item?.id || ''})}
                                    getLabel={(e) => e.nome}
                                    getSubLabel={(e) => e.profissao || ''}
                                    placeholder="Opcional / Não se aplica"
                                    disabled={isReadOnly}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Vincular Veículo / Equipamento</label>
                                <SearchableSelect
                                    items={sortedVehicles}
                                    value={formData.vehicleId}
                                    onChange={(item) => handleVehicleChange(item?.id || '')}
                                    getLabel={(v) => `${v.registroInterno} - ${v.placa}`}
                                    getSubLabel={(v) => v.modelo || ''}
                                    placeholder="Uso Geral / Sem Veículo Específico"
                                    disabled={isReadOnly}
                                />
                                {formData.obraId && formData.vehicleId && (
                                    <p className="text-[10px] text-green-700 mt-1">✔ Obra e operador preenchidos automaticamente com base no histórico do veículo.</p>
                                )}
                            </div>

                            {formData.vehicleId && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                        {formData.kmHrUnit === 'Km' ? 'Odômetro Atual (Km)' : formData.kmHrUnit === 'Hr' ? 'Horímetro Atual (Hr)' : 'Km / Hr Atual'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.kmHrAtual}
                                        onChange={e => setFormData(prev => ({ ...prev, kmHrAtual: e.target.value }))}
                                        placeholder={`Leitura atual em ${formData.kmHrUnit || 'Km ou Hr'}`}
                                        className="p-2 border rounded w-full bg-white outline-none focus:border-yellow-500"
                                        disabled={isReadOnly}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-0.5">Preenchido automaticamente com a leitura atual do veículo. Corrija se necessário.</p>
                                </div>
                            )}
                        </div>

                        {/* Layout Dividido: Itens | Financeiro + Arquivos */}
                        <div className="flex flex-col lg:flex-row gap-6">

                            {/* Coluna Esquerda: Itens */}
                            <div className="flex-1 border-t lg:border-t-0 pt-4 lg:pt-0">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-800 uppercase">Itens / Serviços *</h3>
                                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                                        <input type="checkbox" checked={isPricePending} onChange={() => setIsPricePending(!isPricePending)} className="rounded text-yellow-600 focus:ring-yellow-500" disabled={isReadOnly}/>
                                        Ordem a Cotar (Sem Valor)
                                    </label>
                                </div>

                                {/* Busca Inteligente do Estoque */}
                                {!isReadOnly && (
                                    <div className="mb-3 p-3 bg-gray-50 rounded border">
                                        <SmartInventorySelect
                                            onItemSelected={handleInventoryItemSelected}
                                            currentItems={formData.items}
                                        />
                                        <CreateItemQuickButton
                                            onItemCreated={() => {}}
                                            categories={inventoryCategories}
                                        />
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {formData.items.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded border">
                                            {item.itemId && (
                                                <div className="col-span-12 mb-1">
                                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold">📦 Do Estoque</span>
                                                </div>
                                            )}
                                            <div className="col-span-3 sm:col-span-2">
                                                <input type="text" inputMode="decimal" placeholder="Qtd" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="p-1.5 border rounded w-full text-sm bg-white outline-none focus:border-yellow-500 text-center" required disabled={isReadOnly}/>
                                            </div>
                                            <div className="col-span-9 sm:col-span-5">
                                                <input type="text" placeholder="Descrição da Peça ou Serviço" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="p-1.5 border rounded w-full text-sm bg-white outline-none focus:border-yellow-500" required disabled={isReadOnly}/>
                                            </div>
                                            <div className="col-span-10 sm:col-span-4">
                                                <div className="relative">
                                                    {!isPricePending && <span className="absolute left-2 top-2 text-xs text-gray-500">R$</span>}
                                                    <input
                                                        type="text" inputMode="decimal" step="0.01"
                                                        placeholder={isPricePending ? "Aguardando" : "Unitário"}
                                                        value={item.unitPrice}
                                                        onChange={e => handleItemChange(index, 'unitPrice', e.target.value)}
                                                        className={`p-1.5 border rounded w-full text-sm outline-none focus:border-yellow-500 ${isPricePending ? 'bg-gray-100 cursor-not-allowed text-center text-xs text-gray-400' : 'bg-white pl-7'}`}
                                                        required={!isPricePending}
                                                        disabled={isPricePending || isReadOnly}
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                                                {formData.items.length > 1 && !isReadOnly && (
                                                    <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {!isReadOnly && (
                                    <button type="button" onClick={addItem} className="text-xs text-blue-600 font-bold hover:underline mt-2">+ Adicionar Linha Manual</button>
                                )}

                                <div className="mt-6 border-t pt-4">
                                    <p className={`text-right font-black text-2xl ${isPricePending ? 'text-gray-400' : 'text-green-700'}`}>
                                        <span className="text-sm font-bold text-gray-500 mr-2 uppercase">Total da Ordem:</span>
                                        {isPricePending ? 'A COTAR' : `R$ ${totalValue.toFixed(2)}`}
                                    </p>
                                </div>
                            </div>

                            {/* Coluna Direita: Financeiro + Arquivos + Notificações */}
                            <div className="w-full lg:w-[400px] flex flex-col gap-6">

                                {/* Pagamento */}
                                <div className="border rounded p-4 bg-white shadow-sm">
                                    <h3 className="font-bold text-gray-800 uppercase mb-3 text-xs">Condição de Pagamento *</h3>
                                    <div className="flex gap-4 mb-3 border-b pb-3">
                                        <label className="inline-flex items-center cursor-pointer font-medium">
                                            <input type="radio" name="paymentType" value="À vista" checked={formData.payment.type === 'À vista'} onChange={e => setFormData({...formData, payment: {type: e.target.value, method:'', days: '', installments:[]}})} className="h-4 w-4 text-yellow-600 focus:ring-yellow-500" disabled={isReadOnly}/> <span className="ml-2">À vista</span>
                                        </label>
                                        <label className="inline-flex items-center cursor-pointer font-medium">
                                            <input type="radio" name="paymentType" value="A prazo" checked={formData.payment.type === 'A prazo'} onChange={e => setFormData({...formData, payment: {type: e.target.value, method: formData.payment.method || 'PIX', days: '', installments: formData.payment.installments || []}})} className="h-4 w-4 text-yellow-600 focus:ring-yellow-500" disabled={isReadOnly}/> <span className="ml-2">A prazo</span>
                                        </label>
                                    </div>
                                    {formData.payment.type === 'A prazo' && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Método de Pagamento*</label>
                                                <select value={formData.payment.method} onChange={e => setFormData({...formData, payment: {...formData.payment, method: e.target.value}})} className="p-2 border rounded bg-white text-sm w-full outline-none focus:border-yellow-500" required disabled={isReadOnly}>
                                                    <option value="PIX">PIX (Transferência)</option>
                                                    <option value="Boleto">Boleto Bancário</option>
                                                    <option value="Cartão Corporativo">Cartão de Crédito</option>
                                                </select>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded border">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="text-xs font-bold text-gray-700 uppercase">Detalhamento de Parcelas</h4>
                                                    {!isReadOnly && <button type="button" onClick={addInstallment} className="text-xs text-blue-600 font-bold hover:underline">+ Parcela</button>}
                                                </div>
                                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                    {formData.payment.installments?.map((inst, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border shadow-sm">
                                                            <span className="text-[10px] font-black text-gray-400">{idx + 1}ª</span>
                                                            <input type="date" value={inst.dueDate} onChange={e => handleInstallmentChange(idx, 'dueDate', e.target.value)} className="p-1 border rounded text-xs w-full text-gray-700 outline-none" title="Data de Vencimento" required disabled={isReadOnly}/>
                                                            <input type="number" step="0.01" placeholder="R$" value={inst.value} onChange={e => handleInstallmentChange(idx, 'value', e.target.value)} className="p-1 border rounded text-xs w-24 outline-none" required disabled={isReadOnly}/>
                                                            {!isReadOnly && <button type="button" onClick={() => removeInstallment(idx)} className="text-red-400 hover:text-red-600"><X size={14}/></button>}
                                                        </div>
                                                    ))}
                                                    {(!formData.payment.installments || formData.payment.installments.length === 0) && (
                                                        <p className="text-xs text-gray-400 italic text-center py-2">Defina as datas e valores acordados.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* NOTIFICAÇÕES */}
                                <SendNotificationSection
                                    formData={formData}
                                    setFormData={setFormData}
                                    partners={partners}
                                />

                                {/* Anexos */}
                                <div className="border rounded p-4 bg-white shadow-sm">
                                    <h3 className="font-bold text-gray-800 uppercase mb-3 text-xs flex items-center gap-2"><Paperclip size={14}/> Orçamentos e Documentos</h3>
                                    <ul className="space-y-2 mb-3 max-h-32 overflow-y-auto custom-scrollbar">
                                        {formData.anexos.map((anexo, i) => (
                                            <li key={i} className="flex justify-between items-center bg-gray-50 p-2 border rounded text-xs">
                                                <a href={anexo.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 truncate w-4/5 font-medium"><FileText size={12} className="shrink-0"/> {anexo.name || `Documento ${i+1}`}</a>
                                                {!isReadOnly && <button type="button" onClick={() => removeAnexo(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>}
                                            </li>
                                        ))}
                                        {formData.anexos.length === 0 && <li className="text-xs text-gray-400 italic">Nenhum arquivo anexado.</li>}
                                    </ul>
                                    {!isReadOnly && (
                                        <>
                                            <div className="flex items-center w-full">
                                                <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} accept=".pdf, .jpg, .jpeg, .png, .xls, .xlsx, .csv" />
                                                <label htmlFor="file-upload" className={`w-full cursor-pointer flex justify-center items-center gap-2 px-3 py-2 rounded text-sm font-semibold transition border border-dashed ${isUploading ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
                                                    {isUploading ? <Loader className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                                                    {isUploading ? 'Processando Upload...' : 'Adicionar Arquivo'}
                                                </label>
                                            </div>
                                            <p className="text-[9px] text-gray-400 mt-2 text-center">Permitido PDF, Imagens e Planilhas (Max. 5MB).</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rodapé Fixo */}
                    <div className="p-4 bg-white border-t flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 z-10 rounded-b-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-bold text-gray-700 w-full sm:w-auto" disabled={isSaving}>Cancelar</button>
                        {!isReadOnly && (
                            <button type="submit" disabled={isSaving} className="px-5 py-2 mak-btn mak-btn-primary">
                                {isSaving ? <><Loader className="animate-spin" size={18}/> Salvando e Gerando...</> : 'Salvar e Gerar PDF'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};
export default OrdersPage;




