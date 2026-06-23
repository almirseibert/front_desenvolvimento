import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import apiClient from '../services/apiClient';
import ExcavatorLoader from '../components/ui/ExcavatorLoader';
import {
    Package, Plus, Edit, Trash2, Search, AlertTriangle, TrendingDown,
    DollarSign, AlertCircle, X, Loader, Grid3X3, List, RefreshCw,
    Link2, History, ChevronDown, ChevronUp
} from 'lucide-react';

import ProtectedComponent from '../components/ProtectedComponent';
import SearchableSelect from '../components/SearchableSelect';

// ==========================================================
// HELPER: Cor de badge de categoria (evita interpolação dinâmica)
// ==========================================================
const CATEGORY_COLOR_MAP = {
    'blue-500':   { bg: 'bg-blue-100',   text: 'text-blue-800'   },
    'green-500':  { bg: 'bg-green-100',  text: 'text-green-800'  },
    'red-500':    { bg: 'bg-red-100',    text: 'text-red-800'    },
    'purple-500': { bg: 'bg-purple-100', text: 'text-purple-800' },
    'yellow-500': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    'pink-500':   { bg: 'bg-pink-100',   text: 'text-pink-800'   },
    'gray-500':   { bg: 'bg-gray-100',   text: 'text-gray-700'   },
};
const getCategoryBadgeClass = (color) => {
    const c = CATEGORY_COLOR_MAP[color] || CATEGORY_COLOR_MAP['gray-500'];
    return `${c.bg} ${c.text}`;
};

// ==========================================================
// MODAL: CRIAR/EDITAR CATEGORIA
// ==========================================================
const CategoryModal = ({ isOpen, onClose, onSave, category = null }) => {
    const [formData, setFormData] = useState({ name: '', description: '', color: 'blue-500' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setFormData(category
            ? { name: category.name || '', description: category.description || '', color: category.color || 'blue-500' }
            : { name: '', description: '', color: 'blue-500' }
        );
    }, [category, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const colors = ['blue-500', 'green-500', 'red-500', 'purple-500', 'yellow-500', 'pink-500', 'gray-500'];
    const colorLabels = { 'blue-500': 'Azul', 'green-500': 'Verde', 'red-500': 'Vermelho', 'purple-500': 'Roxo', 'yellow-500': 'Amarelo', 'pink-500': 'Rosa', 'gray-500': 'Cinza' };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">{category ? 'Editar Categoria' : 'Nova Categoria'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                            placeholder="Ex: Filtros, Lubrificantes"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Descrição</label>
                        <textarea
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                            rows="2"
                            placeholder="Descrição detalhada..."
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Cor de Identificação</label>
                        <div className="flex gap-2 flex-wrap">
                            {colors.map(color => {
                                const c = CATEGORY_COLOR_MAP[color];
                                return (
                                    <button
                                        key={color}
                                        type="button"
                                        title={colorLabels[color]}
                                        onClick={() => setFormData({ ...formData, color })}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition ${c.bg} ${c.text} ${formData.color === color ? 'border-gray-700 scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    >
                                        {colorLabels[color]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold text-sm">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                            {isSaving ? <Loader className="animate-spin" size={16} /> : <Plus size={16} />}
                            {isSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ==========================================================
// MODAL: GERENCIAR REFERÊNCIAS / EQUIVALÊNCIAS
// ==========================================================
const ReferencesModal = ({ isOpen, onClose, item, allItems = [], onSave }) => {
    const [refs, setRefs] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [newRef, setNewRef] = useState({ referenceItemId: '', type: 'equivalencia', notes: '', priority: 0 });

    useEffect(() => {
        if (isOpen && item) {
            setRefs(item.references || []);
            setNewRef({ referenceItemId: '', type: 'equivalencia', notes: '', priority: 0 });
        }
    }, [isOpen, item]);

    const handleAdd = async () => {
        if (!newRef.referenceItemId) return;
        setIsSaving(true);
        try {
            await apiClient.post(`/inventory/items/${item.id}/references`, { ...newRef, itemId: item.id });
            await onSave();
            setNewRef({ referenceItemId: '', type: 'equivalencia', notes: '', priority: 0 });
        } catch (err) {
            console.error('Erro ao adicionar referência:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async (refId) => {
        if (!window.confirm('Remover esta equivalência?')) return;
        try {
            await apiClient.delete(`/inventory/references/${refId}`);
            await onSave();
        } catch (err) {
            console.error('Erro ao remover referência:', err);
        }
    };

    if (!isOpen || !item) return null;

    const typeLabels = { equivalencia: 'Equivalência', upgrade: 'Upgrade', substituto: 'Substituto', compativel: 'Compatível' };
    const availableItems = allItems.filter(i => i.id !== item.id && !refs.find(r => r.referenceItemId === i.id));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-5 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Equivalências / Substituições</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Item: <strong>{item.name}</strong> ({item.sku})</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Lista de referências existentes */}
                    {refs.length > 0 ? (
                        <div className="space-y-2">
                            {refs.map(ref => (
                                <div key={ref.id} className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg text-sm">
                                    <div>
                                        <span className="font-bold text-gray-800">{ref.name}</span>
                                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">{typeLabels[ref.type] || ref.type}</span>
                                        {ref.notes && <p className="text-xs text-gray-500 mt-0.5">{ref.notes}</p>}
                                    </div>
                                    <button onClick={() => handleRemove(ref.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 italic text-center py-4">Nenhum item equivalente cadastrado.</p>
                    )}

                    {/* Adicionar nova referência */}
                    <div className="border-t pt-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Adicionar Equivalência</h3>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="col-span-2">
                                <SearchableSelect
                                    items={availableItems}
                                    value={newRef.referenceItemId}
                                    onChange={(item) => setNewRef({ ...newRef, referenceItemId: item?.id || '' })}
                                    getLabel={(i) => `${i.name} (${i.sku})`}
                                    getSubLabel={(i) => `Estoque: ${i.quantity}`}
                                    placeholder="Selecionar item equivalente..."
                                />
                            </div>
                            <select
                                value={newRef.type}
                                onChange={e => setNewRef({ ...newRef, type: e.target.value })}
                                className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400"
                            >
                                <option value="equivalencia">Equivalência</option>
                                <option value="substituto">Substituto</option>
                                <option value="upgrade">Upgrade</option>
                                <option value="compativel">Compatível</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Notas (opcional)"
                                value={newRef.notes}
                                onChange={e => setNewRef({ ...newRef, notes: e.target.value })}
                                className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={!newRef.referenceItemId || isSaving}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader className="animate-spin" size={16} /> : <Plus size={16} />}
                            {isSaving ? 'Adicionando...' : 'Adicionar Equivalência'}
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t text-right">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold text-sm">Fechar</button>
                </div>
            </div>
        </div>
    );
};

// ==========================================================
// MODAL: HISTÓRICO DE MOVIMENTAÇÕES
// ==========================================================
const MovementHistoryModal = ({ isOpen, onClose, item }) => {
    const [movements, setMovements] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && item) {
            setIsLoading(true);
            apiClient.get(`/inventory/items/${item.id}/movements?limit=30`)
                .then(res => setMovements(res.data?.movements || res.data || []))
                .catch(err => console.error('Erro ao carregar movimentos:', err))
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, item]);

    if (!isOpen || !item) return null;

    const typeConfig = {
        entrada:   { label: 'Entrada',   cls: 'bg-green-100 text-green-800' },
        saida:     { label: 'Saída',     cls: 'bg-red-100 text-red-800'   },
        ajuste:    { label: 'Ajuste',    cls: 'bg-blue-100 text-blue-800'  },
        perda:     { label: 'Perda',     cls: 'bg-orange-100 text-orange-800' },
        devolucao: { label: 'Devolução', cls: 'bg-gray-100 text-gray-700'  },
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-5 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Histórico de Movimentações</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Item: <strong>{item.name}</strong></p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                    {isLoading ? (
                        <div className="text-center py-10"><Loader className="animate-spin text-purple-600 inline" size={30} /></div>
                    ) : movements.length === 0 ? (
                        <p className="text-sm text-gray-400 italic text-center py-8">Nenhuma movimentação registrada.</p>
                    ) : (
                        <div className="space-y-2">
                            {movements.map(m => {
                                const cfg = typeConfig[m.type] || { label: m.type, cls: 'bg-gray-100 text-gray-700' };
                                return (
                                    <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg text-sm">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                                        <span className={`font-black text-base shrink-0 w-12 text-right ${m.quantity > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                            {m.quantity > 0 ? '+' : ''}{m.quantity}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 truncate">{m.reason || 'Sem descrição'}</p>
                                            {m.reference && <p className="text-xs text-gray-500">Ref: {m.reference}</p>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-gray-500">{m.createdBy}</p>
                                            <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t text-right">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold text-sm">Fechar</button>
                </div>
            </div>
        </div>
    );
};

// ==========================================================
// MODAL: CRIAR/EDITAR ITEM
// ==========================================================
const ItemModal = ({ isOpen, onClose, onSave, item = null, categories = [] }) => {
    const defaultForm = {
        sku: '', eaN: '', internalCode: '', name: '', description: '',
        categoryId: '', quantity: 0, minQuantity: 5, maxQuantity: '',
        unitPrice: '', unit: 'unidade'
    };
    const [formData, setFormData] = useState(defaultForm);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (item) {
            setFormData({
                ...defaultForm,
                ...item,
                maxQuantity: item.maxQuantity || '',
                unitPrice: item.unitPrice || '',
            });
        } else {
            setFormData(defaultForm);
        }
    }, [item, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({
                ...formData,
                maxQuantity: formData.maxQuantity !== '' ? parseInt(formData.maxQuantity) : null,
                unitPrice: parseFloat(formData.unitPrice) || 0,
                quantity: parseInt(formData.quantity) || 0,
                minQuantity: parseInt(formData.minQuantity) || 0,
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">{item ? 'Editar Item' : 'Novo Item'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Identificadores */}
                    <div className="border-b pb-4">
                        <h3 className="font-bold text-gray-700 mb-3 text-xs uppercase text-gray-500">Identificadores</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">SKU *</label>
                                <input
                                    type="text"
                                    value={formData.sku}
                                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                    placeholder="Ex: FIL-001"
                                    required
                                    disabled={!!item}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Código EAN</label>
                                <input
                                    type="text"
                                    value={formData.eaN || ''}
                                    onChange={e => setFormData({ ...formData, eaN: e.target.value })}
                                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                    placeholder="1234567890123"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Código Interno (MC)</label>
                                <input
                                    type="text"
                                    value={formData.internalCode || ''}
                                    onChange={e => setFormData({ ...formData, internalCode: e.target.value })}
                                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                    placeholder="MC-001"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Informações */}
                    <div className="border-b pb-4">
                        <h3 className="font-bold text-xs uppercase text-gray-500 mb-3">Informações do Produto</h3>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm mb-2"
                            placeholder="Nome do Produto *"
                            required
                        />
                        <textarea
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                            rows="2"
                            placeholder="Descrição detalhada, especificações..."
                        />
                    </div>

                    {/* Categoria e Unidade */}
                    <div className="grid grid-cols-2 gap-3 border-b pb-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Categoria *</label>
                            <SearchableSelect
                                items={categories.map(c => ({ ...c, _label: c.name }))}
                                value={formData.categoryId}
                                onChange={(item) => setFormData({ ...formData, categoryId: item?.id || '' })}
                                getLabel={(c) => c.name}
                                placeholder="Selecionar..."
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Unidade</label>
                            <select
                                value={formData.unit}
                                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                            >
                                <option value="unidade">Unidade</option>
                                <option value="litro">Litro</option>
                                <option value="kg">Kg</option>
                                <option value="metro">Metro</option>
                                <option value="caixa">Caixa</option>
                                <option value="par">Par</option>
                                <option value="jogo">Jogo</option>
                            </select>
                        </div>
                    </div>

                    {/* Estoque */}
                    <div className="border-b pb-4">
                        <h3 className="font-bold text-xs uppercase text-gray-500 mb-3">Quantidades</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Atual {item ? '(somente leitura)' : ''}</label>
                                <input
                                    type="number"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                    min="0"
                                    disabled={!!item}
                                />
                                {item && <p className="text-[10px] text-gray-400 mt-1">Use "Movimentação" para ajustar</p>}
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Estoque Mínimo</label>
                                <input
                                    type="number"
                                    value={formData.minQuantity}
                                    onChange={e => setFormData({ ...formData, minQuantity: e.target.value })}
                                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Estoque Máximo</label>
                                <input
                                    type="number"
                                    value={formData.maxQuantity}
                                    onChange={e => setFormData({ ...formData, maxQuantity: e.target.value })}
                                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                    min="0"
                                    placeholder="Opcional"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Preço */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Preço Unitário (R$) *</label>
                        <input
                            type="number"
                            value={formData.unitPrice}
                            onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            required
                        />
                    </div>
                </form>

                <div className="p-4 border-t flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold text-sm">Cancelar</button>
                    <button
                        type="button"
                        onClick={() => document.getElementById('item-form-submit')?.click()}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isSaving ? <Loader className="animate-spin" size={16} /> : <Plus size={16} />}
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                    {/* Botão hidden para trigger do form submit */}
                    <form onSubmit={handleSubmit} className="hidden">
                        <button id="item-form-submit" type="submit" />
                    </form>
                </div>
            </div>
        </div>
    );
};

// ==========================================================
// MODAL: REGISTRAR MOVIMENTAÇÃO MANUAL
// ==========================================================
const MovementModal = ({ isOpen, onClose, item, onSave, user }) => {
    const [formData, setFormData] = useState({ type: 'entrada', quantity: '', reason: '', unitPrice: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) setFormData({ type: 'entrada', quantity: '', reason: '', unitPrice: '' });
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.quantity || parseInt(formData.quantity) === 0) return;
        setIsSaving(true);
        try {
            const qty = parseInt(formData.quantity);
            await apiClient.post('/inventory/movements', {
                itemId: item.id,
                type: formData.type,
                quantity: formData.type === 'saida' || formData.type === 'perda' ? -Math.abs(qty) : Math.abs(qty),
                reason: formData.reason,
                unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : undefined,
                userEmail: user?.email || 'sistema',
            });
            await onSave();
            onClose();
        } catch (err) {
            console.error('Erro ao registrar movimentação:', err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                <div className="p-5 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Registrar Movimentação</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{item.name} — Estoque atual: <strong>{item.quantity}</strong></p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tipo de Movimentação *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { v: 'entrada', l: '⬆ Entrada', cls: 'bg-green-50 border-green-300 text-green-800' },
                                { v: 'saida', l: '⬇ Saída', cls: 'bg-red-50 border-red-300 text-red-800' },
                                { v: 'ajuste', l: '↕ Ajuste', cls: 'bg-blue-50 border-blue-300 text-blue-800' },
                                { v: 'perda', l: '⚠ Perda', cls: 'bg-orange-50 border-orange-300 text-orange-800' },
                                { v: 'devolucao', l: '↩ Devolução', cls: 'bg-gray-50 border-gray-300 text-gray-700' },
                            ].map(opt => (
                                <button
                                    key={opt.v}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: opt.v })}
                                    className={`p-2 rounded border text-xs font-bold transition ${formData.type === opt.v ? opt.cls + ' border-2' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                >
                                    {opt.l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Quantidade *</label>
                        <input
                            type="number"
                            value={formData.quantity}
                            onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                            min="1"
                            required
                        />
                    </div>
                    {(formData.type === 'entrada') && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Preço Unitário (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.unitPrice}
                                onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                                className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                placeholder="0.00"
                            />
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Motivo / Referência *</label>
                        <input
                            type="text"
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                            placeholder="Ex: Compra NF-001, Ordem #123, Inventário mensal..."
                            required
                        />
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold text-sm">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                            {isSaving ? <Loader className="animate-spin" size={16} /> : null}
                            {isSaving ? 'Salvando...' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ==========================================================
// PÁGINA PRINCIPAL: ESTOQUE
// ==========================================================
const InventoryPage = ({ user, setAlertMessage, socket }) => {
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [summary, setSummary] = useState(null);
    const [alerts, setAlerts] = useState([]);

    const [filterText, setFilterText] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    const [viewMode, setViewMode] = useState('table');

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [itemModalOpen, setItemModalOpen] = useState(false);
    const [refsModalOpen, setRefsModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [movementModalOpen, setMovementModalOpen] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);

    // -------------------------------------------------------
    // FIX PRINCIPAL: Carregar dados independentemente,
    // sem Promise.all (que falhava se qualquer endpoint 404'd).
    // Cada chamada tem fallback gracioso.
    // -------------------------------------------------------
    const loadInitialData = useCallback(async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        const safeGet = async (url, fallback) => {
            try {
                const res = await apiClient.get(url);
                // apiClient pode retornar res.data ou res diretamente
                return res?.data ?? res ?? fallback;
            } catch (err) {
                console.warn(`[Inventory] Falha em GET ${url}:`, err?.message || err);
                return fallback;
            }
        };

        const [catsData, itemsData, summaryData, alertsData] = await Promise.all([
            safeGet('/inventory/categories', []),
            safeGet('/inventory/items', []),
            safeGet('/inventory/dashboard/summary', null),
            safeGet('/inventory/alerts', []),
        ]);

        setCategories(Array.isArray(catsData) ? catsData : []);
        setItems(Array.isArray(itemsData) ? itemsData : []);   // FIX: era catsRes.data antes
        setSummary(summaryData || null);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);

        setIsLoading(false);
        setIsRefreshing(false);
    }, []);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    // -------------------------------------------------------
    // INTEGRAÇÃO REAL-TIME COM SOCKET.IO
    // -------------------------------------------------------
    useEffect(() => {
        if (!socket) return;

        const handleSync = (data) => {
            // O backend envia: { targets: ['inventory'] }
            if (data?.targets?.includes('inventory')) {
                console.log('🔄 Atualização de estoque recebida via Socket.io');
                // true = recarrega os dados em background exibindo apenas o ícone girando
                loadInitialData(true); 
            }
        };

        socket.on('server:sync', handleSync);

        // Limpa o listener ao sair da página
        return () => {
            socket.off('server:sync', handleSync);
        };
    }, [socket, loadInitialData]);

    // -------------------------------------------------------
    // CRUD – Categoria
    // -------------------------------------------------------
    const handleSaveCategory = async (formData) => {
        try {
            if (selectedCategory) {
                await apiClient.put(`/inventory/categories/${selectedCategory.id}`, formData);
                setAlertMessage('Categoria atualizada!');
            } else {
                await apiClient.post('/inventory/categories', formData);
                setAlertMessage('Categoria criada!');
            }
            setSelectedCategory(null);
            await loadInitialData(true);
        } catch (error) {
            setAlertMessage('Erro ao salvar categoria.');
        }
    };

    const handleDeleteCategory = async (catId) => {
        if (!window.confirm('Desativar esta categoria?')) return;
        try {
            await apiClient.delete(`/inventory/categories/${catId}`);
            setAlertMessage('Categoria desativada.');
            await loadInitialData(true);
        } catch (error) {
            setAlertMessage(error.message || 'Erro ao desativar categoria.');
        }
    };

    // -------------------------------------------------------
    // CRUD – Item
    // -------------------------------------------------------
    const handleSaveItem = async (formData) => {
        try {
            if (selectedItem) {
                await apiClient.put(`/inventory/items/${selectedItem.id}`, { ...formData, userEmail: user?.email });
                setAlertMessage('Item atualizado!');
            } else {
                await apiClient.post('/inventory/items', { ...formData, userEmail: user?.email });
                setAlertMessage('Item criado!');
            }
            setSelectedItem(null);
            await loadInitialData(true);
        } catch (error) {
            setAlertMessage(error.message || 'Erro ao salvar item.');
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm('Tem certeza que deseja desativar este item?')) return;
        try {
            await apiClient.delete(`/inventory/items/${itemId}`);
            setAlertMessage('Item desativado.');
            await loadInitialData(true);
        } catch (error) {
            setAlertMessage('Erro ao desativar item.');
        }
    };

    // -------------------------------------------------------
    // Filtros
    // -------------------------------------------------------
    const filteredItems = useMemo(() => {
        const txt = filterText.toLowerCase();
        return items.filter(item => {
            const matchesText = !txt ||
                item.name.toLowerCase().includes(txt) ||
                (item.sku || '').toLowerCase().includes(txt) ||
                (item.eaN || '').includes(txt) ||
                (item.internalCode || '').toLowerCase().includes(txt);
            const matchesCategory = !categoryFilter || item.categoryId === categoryFilter;
            const matchesLowStock = !showLowStockOnly || item.quantity <= item.minQuantity;
            return matchesText && matchesCategory && matchesLowStock;
        });
    }, [items, filterText, categoryFilter, showLowStockOnly]);

    // -------------------------------------------------------
    // RENDER
    // -------------------------------------------------------
    if (isLoading) {
        return (
            <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <ExcavatorLoader size="md" text="Carregando dados do almoxarifado..." />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">

            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" flex items-center gap-2">
                        <Package className="text-purple-600" size={32} /> Almoxarifado
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Gestão de peças, lubrificantes e insumos.</p>
                </div>
                <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                    <button
                        onClick={() => loadInitialData(true)}
                        disabled={isRefreshing}
                        className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        title="Recarregar dados"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <ProtectedComponent requiredPermission="editor">
                        <button
                            onClick={() => { setSelectedCategory(null); setCategoryModalOpen(true); }}
                            className="flex items-center gap-2 px-3 py-2 mak-btn mak-btn-dark"
                        >
                            <Plus size={16} /> Categoria
                        </button>
                    </ProtectedComponent>
                    <ProtectedComponent requiredPermission="editor">
                        <button
                            onClick={() => { setSelectedItem(null); setItemModalOpen(true); }}
                            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow hover:bg-purple-700 transition text-sm"
                        >
                            <Plus size={16} /> Novo Item
                        </button>
                    </ProtectedComponent>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3">
                    <div className="bg-blue-100 p-3 rounded-lg text-blue-600 shrink-0"><Package size={22} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase leading-tight">Total SKUs</p>
                        <p className="text-2xl font-black text-gray-800">{summary?.totalItems ?? items.length}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3">
                    <div className="bg-green-100 p-3 rounded-lg text-green-600 shrink-0"><DollarSign size={22} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase leading-tight">Valor em Estoque</p>
                        {/* Correção de casting seguro usando Number() e parseFloat() */}
                        <p className="text-xl font-black text-gray-800">
                            R$ {Number(summary?.totalValue ?? items.reduce((a, i) => a + ((i.quantity || 0) * (parseFloat(i.unitPrice) || 0)), 0)).toFixed(2)}
                        </p>
                    </div>
                </div>
                <div className={`p-4 rounded-xl shadow-sm border flex items-center gap-3 ${(summary?.outOfStock ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                    <div className={`p-3 rounded-lg shrink-0 ${(summary?.outOfStock ?? 0) > 0 ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                        <AlertCircle size={22} />
                    </div>
                    <div>
                        <p className={`text-xs font-bold uppercase leading-tight ${(summary?.outOfStock ?? 0) > 0 ? 'text-red-700' : 'text-gray-500'}`}>Zerados</p>
                        <p className="text-2xl font-black">{summary?.outOfStock ?? items.filter(i => i.quantity === 0).length}</p>
                    </div>
                </div>
                <div className={`p-4 rounded-xl shadow-sm border flex items-center gap-3 ${(summary?.lowStock ?? 0) > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                    <div className={`p-3 rounded-lg shrink-0 ${(summary?.lowStock ?? 0) > 0 ? 'bg-yellow-200 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                        <TrendingDown size={22} />
                    </div>
                    <div>
                        <p className={`text-xs font-bold uppercase leading-tight ${(summary?.lowStock ?? 0) > 0 ? 'text-yellow-700' : 'text-gray-500'}`}>Críticos</p>
                        <p className="text-2xl font-black">{summary?.lowStock ?? items.filter(i => i.quantity > 0 && i.quantity <= i.minQuantity).length}</p>
                    </div>
                </div>
            </div>

            {/* Banner offline (quando API ainda não está disponível) */}
            {items.length === 0 && !isLoading && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="text-sm font-bold text-yellow-800">API de Estoque não encontrada</p>
                        <p className="text-xs text-yellow-700 mt-1">
                            Os endpoints <code className="bg-yellow-100 px-1 rounded">/inventory/*</code> retornaram 404.
                            Verifique se a rota foi registrada no backend (<code className="bg-yellow-100 px-1 rounded">app.use('/api/inventory', inventoryRoutes)</code>) e se o banco de dados foi criado via script SQL.
                        </p>
                    </div>
                </div>
            )}

            {/* Alertas críticos */}
            {alerts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <h3 className="font-bold text-red-800 text-sm mb-1">Alertas de Estoque Crítico ({alerts.length})</h3>
                            <div className="space-y-0.5 text-xs text-red-700">
                                {alerts.slice(0, 4).map(alert => (
                                    <p key={alert.id}>• <strong>{alert.sku || alert.itemId}</strong> — {alert.message || alert.title}</p>
                                ))}
                                {alerts.length > 4 && <p className="font-semibold mt-1">+ {alerts.length - 4} alertas adicionais</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Categorias (pill list) */}
            {categories.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setCategoryFilter('')}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${!categoryFilter ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Todos ({items.length})
                    </button>
                    {categories.map(cat => {
                        const count = items.filter(i => i.categoryId === cat.id).length;
                        const badge = getCategoryBadgeClass(cat.color);
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setCategoryFilter(categoryFilter === cat.id ? '' : cat.id)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition border ${
                                    categoryFilter === cat.id
                                        ? `${badge} border-current`
                                        : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
                                }`}
                            >
                                {cat.name} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white p-3 rounded-lg shadow-sm border flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, SKU, EAN ou cód. interno..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-400 outline-none text-sm"
                    />
                </div>
                <button
                    onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                    className={`px-3 py-2 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 border ${
                        showLowStockOnly ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-100 text-gray-700 border-gray-300'
                    }`}
                >
                    <AlertTriangle size={14} /> Críticos
                </button>
                <div className="flex gap-1">
                    <button onClick={() => setViewMode('table')} className={`px-3 py-2 rounded-lg text-sm transition ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}><List size={16} /></button>
                    <button onClick={() => setViewMode('grid')} className={`px-3 py-2 rounded-lg text-sm transition ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}><Grid3X3 size={16} /></button>
                </div>
            </div>

            {/* Vista Tabela */}
            {viewMode === 'table' && (
                <div className="bg-white rounded-lg shadow-sm overflow-x-auto border">
                    <table className="w-full text-sm text-left min-w-[800px]">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-600 font-bold border-b">
                            <tr>
                                <th className="p-3">SKU / Código</th>
                                <th className="p-3">Produto</th>
                                <th className="p-3">Categoria</th>
                                <th className="p-3 text-center">Estoque</th>
                                <th className="p-3 text-center">Mín.</th>
                                <th className="p-3 text-right">Preço Unit.</th>
                                <th className="p-3 text-right">Valor Total</th>
                                <th className="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 transition">
                                    <td className="p-3">
                                        <p className="font-mono text-gray-700 text-xs font-bold">{item.sku}</p>
                                        {item.eaN && <p className="text-[10px] text-gray-400">EAN: {item.eaN}</p>}
                                        {item.internalCode && <p className="text-[10px] text-blue-500">MC: {item.internalCode}</p>}
                                    </td>
                                    <td className="p-3">
                                        <p className="font-bold text-gray-900 leading-tight">{item.name}</p>
                                        {item.description && <p className="text-xs text-gray-400 truncate max-w-[180px]">{item.description}</p>}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getCategoryBadgeClass(item.categoryColor)}`}>
                                            {item.categoryName || '—'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded font-bold text-xs ${
                                            item.quantity === 0 ? 'bg-red-100 text-red-700 animate-pulse' :
                                            item.quantity <= item.minQuantity ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {item.quantity} {item.unit || 'un'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center text-gray-600 text-xs">{item.minQuantity}</td>
                                    {/* Correções com Number e parseFloat */}
                                    <td className="p-3 text-right text-gray-700 text-xs">R$ {Number(parseFloat(item.unitPrice) || 0).toFixed(2)}</td>
                                    <td className="p-3 text-right font-bold text-gray-800 text-xs">
                                        R$ {Number((item.quantity || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => { setSelectedItem(item); setMovementModalOpen(true); }} title="Registrar Movimentação" className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"><ChevronUp size={15} /></button>
                                            <button onClick={() => { setSelectedItem(item); setRefsModalOpen(true); }} title="Gerenciar Equivalências" className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition"><Link2 size={15} /></button>
                                            <button onClick={() => { setSelectedItem(item); setHistoryModalOpen(true); }} title="Histórico de Movimentações" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"><History size={15} /></button>
                                            <button onClick={() => { setSelectedItem(item); setItemModalOpen(true); }} title="Editar" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition"><Edit size={15} /></button>
                                            <button onClick={() => handleDeleteItem(item.id)} title="Desativar" className="p-1.5 text-red-400 hover:bg-red-50 rounded transition"><Trash2 size={15} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredItems.length === 0 && (
                        <div className="p-10 text-center text-gray-400 text-sm">
                            {items.length === 0 ? 'Nenhum item cadastrado. Clique em "+ Novo Item" para começar.' : 'Nenhum item encontrado com os filtros atuais.'}
                        </div>
                    )}
                </div>
            )}

            {/* Vista Grid */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-white rounded-lg border shadow-sm hover:shadow-md transition p-4">
                            <div className="flex justify-between items-start mb-2 gap-2">
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-900 leading-tight truncate">{item.name}</h3>
                                    <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${getCategoryBadgeClass(item.categoryColor)}`}>
                                    {item.categoryName || '—'}
                                </span>
                            </div>
                            <div className="space-y-1.5 border-t pt-3 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Estoque:</span>
                                    <span className={`font-bold ${item.quantity === 0 ? 'text-red-700' : item.quantity <= item.minQuantity ? 'text-yellow-700' : 'text-green-700'}`}>
                                        {item.quantity} {item.unit || 'un'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Mínimo:</span>
                                    <span className="font-semibold text-gray-700">{item.minQuantity}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Preço Unit.:</span>
                                    {/* Correções aplicadas aqui */}
                                    <span className="font-semibold">R$ {Number(parseFloat(item.unitPrice) || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1.5">
                                    <span className="text-gray-500">Valor Total:</span>
                                    <span className="font-black text-purple-600">R$ {Number((item.quantity || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex gap-1 mt-3 border-t pt-3">
                                <button onClick={() => { setSelectedItem(item); setMovementModalOpen(true); }} className="flex-1 py-1.5 bg-green-50 text-green-700 rounded text-xs font-semibold hover:bg-green-100 transition flex items-center justify-center gap-1"><ChevronUp size={12} /> Mov.</button>
                                <button onClick={() => { setSelectedItem(item); setRefsModalOpen(true); }} className="flex-1 py-1.5 bg-purple-50 text-purple-700 rounded text-xs font-semibold hover:bg-purple-100 transition flex items-center justify-center gap-1"><Link2 size={12} /> Equiv.</button>
                                <button onClick={() => { setSelectedItem(item); setItemModalOpen(true); }} className="flex-1 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold hover:bg-blue-100 transition flex items-center justify-center gap-1"><Edit size={12} /> Editar</button>
                            </div>
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-full p-10 text-center text-gray-400 text-sm">Nenhum item encontrado.</div>
                    )}
                </div>
            )}

            {/* Modais */}
            <CategoryModal
                isOpen={categoryModalOpen}
                onClose={() => { setCategoryModalOpen(false); setSelectedCategory(null); }}
                onSave={handleSaveCategory}
                category={selectedCategory}
            />

            <ItemModal
                isOpen={itemModalOpen}
                onClose={() => { setItemModalOpen(false); setSelectedItem(null); }}
                onSave={handleSaveItem}
                item={selectedItem}
                categories={categories}
            />

            <ReferencesModal
                isOpen={refsModalOpen}
                onClose={() => { setRefsModalOpen(false); setSelectedItem(null); }}
                item={selectedItem}
                allItems={items}
                onSave={() => loadInitialData(true)}
            />

            <MovementHistoryModal
                isOpen={historyModalOpen}
                onClose={() => { setHistoryModalOpen(false); setSelectedItem(null); }}
                item={selectedItem}
            />

            <MovementModal
                isOpen={movementModalOpen}
                onClose={() => { setMovementModalOpen(false); setSelectedItem(null); }}
                item={selectedItem}
                onSave={() => loadInitialData(true)}
                user={user}
            />
        </div>
    );
};

export default InventoryPage;

