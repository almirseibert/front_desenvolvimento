import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Plus, Trash2, Edit, Loader, RefreshCw, Mail, MessageCircle, Power, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

// Catálogo dos eventos suportados (Fase 3.2). Manter sincronizado com cronService quando 3.2 for implementado.
const EVENT_TYPES = [
    { id: 'obra_criada',                 label: 'Obra criada',                          desc: 'Disparado ao criar uma nova obra.' },
    { id: 'funcionario_retornou_ferias', label: 'Funcionário retornou de férias',       desc: 'Status do funcionário muda de Férias para Ativo.' },
    { id: 'cnh_vencendo',                label: 'CNH vencendo (30 dias)',               desc: 'Cron diário, 30 dias antes do vencimento.' },
    { id: 'cnh_vencida',                 label: 'CNH vencida',                          desc: 'Cron diário, no dia do vencimento.' },
    { id: 'toxicologico_vencendo',       label: 'Toxicológico vencendo (30 dias)',      desc: 'Cron diário, 30 dias antes do vencimento.' },
    { id: 'combustivel_obra_20pct',      label: 'Combustível da obra a 20% do limite', desc: 'Ao registrar despesa que atinja 80% do orçamento.' },
    { id: 'obra_progresso',              label: 'Progresso da obra (30/50/70%)',        desc: 'Ao atualizar o percentual da obra.' },
    { id: 'revisao_veiculo_leve',        label: 'Revisão de veículo leve',              desc: 'Cron diário — por Km.' },
    { id: 'revisao_veiculo_pesado',      label: 'Revisão de veículo pesado',            desc: 'Cron diário — por Hr.' },
    { id: 'ordem_gerada',                label: 'Ordem de abastecimento gerada',        desc: 'Ao criar ordem (com PDF em anexo).' },
    { id: 'multa_lancada',               label: 'Multa lançada',                        desc: 'Ao registrar multa (com PDF de ciência).' },
    { id: 'documento_veiculo_vencido',   label: 'Documento de veículo vencido',         desc: 'Cron diário.' },
    { id: 'operador_placeholder_obra_7dias', label: 'Operador fictício em obra >7 dias', desc: 'Cron diário. Lista veículos com COLABORADOR/TESTE/etc. há mais de 7 dias.' },
];

const CHANNELS = [
    { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, color: 'text-green-600 bg-green-50 border-green-200' },
    { id: 'email',    label: 'E-mail',   Icon: Mail,          color: 'text-blue-600 bg-blue-50 border-blue-200' },
];

const TARGET_TYPES = [
    { id: 'role',             label: 'Função (role)',       placeholder: 'admin, gerencia, rh, faturamento, abastecimento, oficina, editor' },
    { id: 'user',             label: 'Usuário (ID)',        placeholder: 'ID do usuário no sistema' },
    { id: 'employee',         label: 'Funcionário (ID)',    placeholder: 'ID do funcionário' },
    { id: 'internal_contact', label: 'Contato Interno',     placeholder: 'Selecione um contato interno' },
    { id: 'phone',            label: 'Telefone (avulso)',   placeholder: '55519XXXXXXXX' },
    { id: 'email_address',    label: 'E-mail (avulso)',     placeholder: 'pessoa@empresa.com' },
];

const eventLabel = (id) => EVENT_TYPES.find(e => e.id === id)?.label || id;
const targetTypeLabel = (id) => TARGET_TYPES.find(t => t.id === id)?.label || id;

const NotificacoesAdminTab = () => {
    const [targets, setTargets] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterEvent, setFilterEvent] = useState('');
    const [filterChannel, setFilterChannel] = useState('');
    const [modal, setModal] = useState({ open: false, data: null });
    const [feedback, setFeedback] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [data, contactsData] = await Promise.all([
                apiClient.adminListNotificationTargets(),
                apiClient.adminListInternalContacts().catch(() => []),
            ]);
            setTargets(Array.isArray(data) ? data : []);
            setContacts(Array.isArray(contactsData) ? contactsData : []);
        } catch (e) {
            console.error('Erro ao carregar notification_targets:', e);
            setFeedback({ type: 'error', text: e.message || 'Erro ao carregar destinos.' });
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const contactName = (id) => contacts.find(c => String(c.id) === String(id))?.nome || null;

    const filtered = useMemo(() => targets.filter(t => {
        if (filterEvent && t.event_type !== filterEvent) return false;
        if (filterChannel && t.channel !== filterChannel) return false;
        return true;
    }), [targets, filterEvent, filterChannel]);

    // Agrupa por event_type para facilitar leitura
    const grouped = useMemo(() => {
        const map = new Map();
        for (const t of filtered) {
            if (!map.has(t.event_type)) map.set(t.event_type, []);
            map.get(t.event_type).push(t);
        }
        return Array.from(map.entries()).sort((a, b) => eventLabel(a[0]).localeCompare(eventLabel(b[0])));
    }, [filtered]);

    const handleToggleActive = async (t) => {
        try {
            await apiClient.adminUpdateNotificationTarget(t.id, { active: t.active ? 0 : 1 });
            await load();
        } catch (e) {
            setFeedback({ type: 'error', text: e.message });
        }
    };

    const handleDelete = async (t) => {
        if (!window.confirm(`Excluir este destino (${targetTypeLabel(t.target_type)}: ${t.target_value})?`)) return;
        try {
            await apiClient.adminDeleteNotificationTarget(t.id);
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
                        <Bell size={18} className="text-yellow-500" /> Destinos de Notificação
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Configure quem recebe cada evento via WhatsApp ou e-mail. Os disparos automáticos lerão esta lista.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="text-xs px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-1.5"
                    >
                        <RefreshCw size={14}/> Atualizar
                    </button>
                    <button
                        onClick={() => setModal({ open: true, data: null })}
                        className="text-xs px-3 py-2 rounded-md bg-yellow-500 text-white hover:bg-yellow-600 font-semibold flex items-center gap-1.5"
                    >
                        <Plus size={14}/> Novo destino
                    </button>
                </div>
            </div>

            {feedback && (
                <div className={`px-3 py-2 rounded-md text-xs flex items-center justify-between ${feedback.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    <span>{feedback.text}</span>
                    <button onClick={() => setFeedback(null)}><X size={14}/></button>
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white rounded-lg p-3 border border-gray-200 flex flex-wrap gap-3 items-center">
                <select
                    value={filterEvent}
                    onChange={(e) => setFilterEvent(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-white"
                >
                    <option value="">Todos os eventos</option>
                    {EVENT_TYPES.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
                </select>
                <select
                    value={filterChannel}
                    onChange={(e) => setFilterChannel(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-white"
                >
                    <option value="">Todos os canais</option>
                    {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <span className="text-xs text-gray-500 ml-auto">{filtered.length} destino(s)</span>
            </div>

            {/* Lista agrupada por evento */}
            {loading ? (
                <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                    <Loader size={16} className="animate-spin"/> Carregando…
                </div>
            ) : grouped.length === 0 ? (
                <div className="bg-white rounded-lg p-10 border border-dashed border-gray-300 text-center text-gray-400">
                    <Bell size={36} className="mx-auto mb-2 opacity-30"/>
                    <p className="text-sm">Nenhum destino cadastrado{filterEvent || filterChannel ? ' com os filtros atuais' : ''}.</p>
                    {!filterEvent && !filterChannel && (
                        <p className="text-xs mt-1">Clique em "Novo destino" para começar.</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {grouped.map(([eventType, items]) => {
                        const meta = EVENT_TYPES.find(e => e.id === eventType);
                        return (
                            <div key={eventType} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-bold text-gray-800">{meta?.label || eventType}</div>
                                        {meta?.desc && <div className="text-[11px] text-gray-500">{meta.desc}</div>}
                                    </div>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{items.length}</span>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {items.map(t => {
                                        const ch = CHANNELS.find(c => c.id === t.channel);
                                        const ChIcon = ch?.Icon || MessageCircle;
                                        return (
                                            <div key={t.id} className={`flex items-center gap-3 px-4 py-2.5 ${t.active ? '' : 'opacity-50'}`}>
                                                <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${ch?.color || 'border-gray-200 text-gray-600'}`}>
                                                    <ChIcon size={11}/> {ch?.label || t.channel}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-800 truncate">
                                                        {t.label || (t.target_type === 'internal_contact' && contactName(t.target_value)) || t.target_value}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500">
                                                        {targetTypeLabel(t.target_type)}
                                                        {t.target_type === 'internal_contact'
                                                            ? <> · {contactName(t.target_value) || <span className="font-mono">{t.target_value}</span>}</>
                                                            : <> · <span className="font-mono">{t.target_value}</span></>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleActive(t)}
                                                    title={t.active ? 'Desativar' : 'Ativar'}
                                                    className={`p-1.5 rounded-md transition ${t.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                                >
                                                    <Power size={15}/>
                                                </button>
                                                <button
                                                    onClick={() => setModal({ open: true, data: t })}
                                                    className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition"
                                                    title="Editar"
                                                >
                                                    <Edit size={15}/>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(t)}
                                                    className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={15}/>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal.open && (
                <NotificacaoModal
                    initial={modal.data}
                    contacts={contacts}
                    onClose={() => setModal({ open: false, data: null })}
                    onSaved={() => { setModal({ open: false, data: null }); load(); setFeedback({ type: 'ok', text: 'Destino salvo.' }); }}
                />
            )}
        </div>
    );
};

// ─── Modal ─────────────────────────────────────────────────────────────────────
const NotificacaoModal = ({ initial, contacts = [], onClose, onSaved }) => {
    const isEdit = !!initial;
    const [form, setForm] = useState(initial || {
        event_type: EVENT_TYPES[0].id,
        channel: 'whatsapp',
        target_type: 'role',
        target_value: '',
        label: '',
        active: 1,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const targetMeta = TARGET_TYPES.find(t => t.id === form.target_type);

    const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async () => {
        if (!form.target_value || !String(form.target_value).trim()) {
            setError('Informe o valor do destino.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (isEdit) {
                await apiClient.adminUpdateNotificationTarget(initial.id, {
                    event_type: form.event_type,
                    channel: form.channel,
                    target_type: form.target_type,
                    target_value: String(form.target_value).trim(),
                    label: form.label || null,
                    active: form.active ? 1 : 0,
                });
            } else {
                await apiClient.adminCreateNotificationTarget({
                    event_type: form.event_type,
                    channel: form.channel,
                    target_type: form.target_type,
                    target_value: String(form.target_value).trim(),
                    label: form.label || null,
                    active: 1,
                });
            }
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
                        <Bell size={16} className="text-yellow-500"/> {isEdit ? 'Editar destino' : 'Novo destino de notificação'}
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18}/></button>
                </div>
                <div className="p-5 space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Evento</label>
                        <select
                            value={form.event_type}
                            onChange={(e) => handleChange('event_type', e.target.value)}
                            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"
                        >
                            {EVENT_TYPES.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
                        </select>
                        {EVENT_TYPES.find(e => e.id === form.event_type)?.desc && (
                            <p className="text-[11px] text-gray-500 mt-1">{EVENT_TYPES.find(e => e.id === form.event_type).desc}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Canal</label>
                            <select
                                value={form.channel}
                                onChange={(e) => handleChange('channel', e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"
                            >
                                {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo do destino</label>
                            <select
                                value={form.target_type}
                                onChange={(e) => handleChange('target_type', e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"
                            >
                                {TARGET_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Valor do destino</label>
                        {form.target_type === 'internal_contact' ? (
                            <>
                                <select
                                    value={form.target_value}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        handleChange('target_value', id);
                                        const c = contacts.find(x => String(x.id) === id);
                                        if (c && !form.label) handleChange('label', c.nome);
                                    }}
                                    className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"
                                >
                                    <option value="">— Selecione —</option>
                                    {contacts
                                        .filter(c => form.channel === 'whatsapp' ? c.whatsapp : c.email)
                                        .map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nome} ({form.channel === 'whatsapp' ? c.whatsapp : c.email})
                                            </option>
                                        ))}
                                </select>
                                {contacts.filter(c => form.channel === 'whatsapp' ? c.whatsapp : c.email).length === 0 && (
                                    <p className="text-[11px] text-amber-600 mt-1">
                                        Nenhum contato interno com {form.channel === 'whatsapp' ? 'WhatsApp' : 'e-mail'} cadastrado. Cadastre em "Contatos Internos".
                                    </p>
                                )}
                            </>
                        ) : (
                            <input
                                type="text"
                                value={form.target_value}
                                onChange={(e) => handleChange('target_value', e.target.value)}
                                placeholder={targetMeta?.placeholder || ''}
                                className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"
                            />
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Rótulo (opcional)</label>
                        <input
                            type="text"
                            value={form.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                            placeholder="Ex.: Coordenação de Frota"
                            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 bg-white"
                        />
                    </div>
                    {isEdit && (
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                                type="checkbox"
                                checked={!!form.active}
                                onChange={(e) => handleChange('active', e.target.checked ? 1 : 0)}
                            /> Ativo
                        </label>
                    )}
                    {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1.5 rounded">{error}</div>}
                </div>
                <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="text-xs px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="text-xs px-4 py-2 rounded-md bg-yellow-500 text-white font-semibold hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saving && <Loader size={12} className="animate-spin"/>}
                        {isEdit ? 'Salvar' : 'Criar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificacoesAdminTab;
