import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Trash2, Edit, Loader, RefreshCw, Mail, MessageCircle, Power, X, Search, Briefcase } from 'lucide-react';
import apiClient from '../../services/apiClient';

const ContatosInternosTab = () => {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');
    const [filtroSetor, setFiltroSetor] = useState('');
    const [modal, setModal] = useState({ open: false, data: null });
    const [feedback, setFeedback] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const data = await apiClient.adminListInternalContacts();
            setContacts(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setFeedback({ type: 'error', text: e.message || 'Erro ao carregar contatos.' });
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const setores = useMemo(() => {
        const set = new Set();
        contacts.forEach(c => { if (c.setor) set.add(c.setor); });
        return Array.from(set).sort();
    }, [contacts]);

    const filtered = useMemo(() => {
        const q = busca.trim().toLowerCase();
        return contacts.filter(c => {
            if (filtroSetor && c.setor !== filtroSetor) return false;
            if (!q) return true;
            return [c.nome, c.cargo, c.setor, c.whatsapp, c.email]
                .some(v => v && String(v).toLowerCase().includes(q));
        });
    }, [contacts, busca, filtroSetor]);

    const handleToggleActive = async (c) => {
        try {
            await apiClient.adminUpdateInternalContact(c.id, { ativo: c.ativo ? 0 : 1 });
            await load();
        } catch (e) {
            setFeedback({ type: 'error', text: e.message });
        }
    };

    const handleDelete = async (c) => {
        if (!window.confirm(`Excluir o contato "${c.nome}"?`)) return;
        try {
            await apiClient.adminDeleteInternalContact(c.id);
            await load();
        } catch (e) {
            setFeedback({ type: 'error', text: e.message });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Users size={18} className="text-yellow-500"/> Contatos Internos
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Cadastro de pessoas-chave da operação (RH, Coordenação, Gestores). Use para referência rápida e para alimentar destinos de notificação.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="text-xs px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-1.5">
                        <RefreshCw size={14}/> Atualizar
                    </button>
                    <button
                        onClick={() => setModal({ open: true, data: null })}
                        className="text-xs px-3 py-2 rounded-md bg-yellow-500 text-white hover:bg-yellow-600 font-semibold flex items-center gap-1.5"
                    >
                        <Plus size={14}/> Novo contato
                    </button>
                </div>
            </div>

            {feedback && (
                <div className={`px-3 py-2 rounded-md text-xs flex items-center justify-between ${feedback.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    <span>{feedback.text}</span>
                    <button onClick={() => setFeedback(null)}><X size={14}/></button>
                </div>
            )}

            <div className="bg-white rounded-lg p-3 border border-gray-200 flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                    <Search size={14} className="text-gray-400"/>
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome, cargo, telefone ou e-mail…"
                        className="flex-1 text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-white"
                    />
                </div>
                <select
                    value={filtroSetor}
                    onChange={(e) => setFiltroSetor(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-white"
                >
                    <option value="">Todos os setores</option>
                    {setores.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="text-xs text-gray-500 ml-auto">{filtered.length} contato(s)</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                    <Loader size={16} className="animate-spin"/> Carregando…
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-lg p-10 border border-dashed border-gray-300 text-center text-gray-400">
                    <Users size={36} className="mx-auto mb-2 opacity-30"/>
                    <p className="text-sm">Nenhum contato cadastrado{busca || filtroSetor ? ' com os filtros atuais' : ''}.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(c => (
                        <div key={c.id} className={`bg-white rounded-lg border border-gray-200 p-3 ${c.ativo ? '' : 'opacity-60'}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-gray-800 truncate">{c.nome}</div>
                                    <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                        {c.cargo && <span className="flex items-center gap-1"><Briefcase size={10}/>{c.cargo}</span>}
                                        {c.setor && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{c.setor}</span>}
                                    </div>
                                </div>
                                <div className="flex gap-0.5">
                                    <button onClick={() => handleToggleActive(c)} title={c.ativo ? 'Desativar' : 'Ativar'}
                                        className={`p-1.5 rounded-md transition ${c.ativo ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                                        <Power size={14}/>
                                    </button>
                                    <button onClick={() => setModal({ open: true, data: c })} title="Editar"
                                        className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition">
                                        <Edit size={14}/>
                                    </button>
                                    <button onClick={() => handleDelete(c)} title="Excluir"
                                        className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2 space-y-1 text-xs">
                                {c.whatsapp && (
                                    <a href={`https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                                       className="flex items-center gap-1.5 text-green-700 hover:underline">
                                        <MessageCircle size={12}/> <span className="font-mono">{c.whatsapp}</span>
                                    </a>
                                )}
                                {c.email && (
                                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-blue-700 hover:underline truncate">
                                        <Mail size={12}/> <span className="truncate">{c.email}</span>
                                    </a>
                                )}
                                {c.observacao && <p className="text-gray-500 italic text-[11px] mt-1">{c.observacao}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal.open && (
                <ContatoModal
                    initial={modal.data}
                    onClose={() => setModal({ open: false, data: null })}
                    onSaved={() => { setModal({ open: false, data: null }); load(); setFeedback({ type: 'ok', text: 'Contato salvo.' }); }}
                />
            )}
        </div>
    );
};

const ContatoModal = ({ initial, onClose, onSaved }) => {
    const isEdit = !!initial;
    const [form, setForm] = useState(initial || {
        nome: '', cargo: '', setor: '', whatsapp: '', email: '', observacao: '', ativo: 1,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async () => {
        if (!form.nome || !form.nome.trim()) {
            setError('Nome é obrigatório.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                nome: form.nome.trim(),
                cargo: form.cargo || null,
                setor: form.setor || null,
                whatsapp: form.whatsapp || null,
                email: form.email || null,
                observacao: form.observacao || null,
                ativo: form.ativo ? 1 : 0,
            };
            if (isEdit) await apiClient.adminUpdateInternalContact(initial.id, payload);
            else        await apiClient.adminCreateInternalContact(payload);
            onSaved();
        } catch (e) {
            setError(e.message || 'Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <Users size={16} className="text-yellow-500"/> {isEdit ? 'Editar contato' : 'Novo contato interno'}
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18}/></button>
                </div>
                <div className="p-5 space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Nome *</label>
                        <input type="text" value={form.nome} onChange={(e) => handleChange('nome', e.target.value)}
                            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Cargo</label>
                            <input type="text" value={form.cargo || ''} onChange={(e) => handleChange('cargo', e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"/>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Setor</label>
                            <input type="text" value={form.setor || ''} onChange={(e) => handleChange('setor', e.target.value)}
                                placeholder="RH, Coordenação, Frota, …"
                                className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"/>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">WhatsApp</label>
                            <input type="text" value={form.whatsapp || ''} onChange={(e) => handleChange('whatsapp', e.target.value)}
                                placeholder="555199XXXXXXX"
                                className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"/>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">E-mail</label>
                            <input type="email" value={form.email || ''} onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"/>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Observação</label>
                        <textarea value={form.observacao || ''} onChange={(e) => handleChange('observacao', e.target.value)}
                            rows={2}
                            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white resize-none"/>
                    </div>
                    {isEdit && (
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                            <input type="checkbox" checked={!!form.ativo}
                                onChange={(e) => handleChange('ativo', e.target.checked ? 1 : 0)}/> Ativo
                        </label>
                    )}
                    {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1.5 rounded">{error}</div>}
                </div>
                <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-xl">
                    <button onClick={onClose}
                        className="text-xs px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100">Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="text-xs px-4 py-2 rounded-md bg-yellow-500 text-white font-semibold hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1.5">
                        {saving && <Loader size={12} className="animate-spin"/>}
                        {isEdit ? 'Salvar' : 'Criar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContatosInternosTab;
