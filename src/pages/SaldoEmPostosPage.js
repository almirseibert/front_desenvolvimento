// pages/SaldoEmPostosPage.js
// Controle do saldo pré-pago de combustível em postos parceiros.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Fuel, Plus, AlertTriangle, History, X, TrendingDown,
    ArrowDownCircle, ArrowUpCircle, RefreshCcw, ArrowUpDown,
    Pencil, Trash2,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { useData, useEnsureResources } from '../contexts/DataContext';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDateTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString('pt-BR'); } catch { return String(d); }
};
// Só consideramos "ativo" o posto que recebeu crédito pré-pago.
// Postos sem crédito são pagamento à vista — não devem aparecer aqui,
// mesmo que tenham empenho (tanque cheio aberto) ou consumo via baixa.
const hasActivity = (row) => (Number(row.total_credited) || 0) > 0;

// Máscara de moeda BRL: o input mantém apenas os dígitos e mostra "1.234,56".
const digitsToBRL = (digits) => {
    const clean = String(digits || '').replace(/\D/g, '');
    if (!clean) return '';
    const num = Number(clean) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const digitsToNumber = (digits) => {
    const clean = String(digits || '').replace(/\D/g, '');
    return clean ? Number(clean) / 100 : 0;
};
const numberToDigits = (n) => {
    const v = Number(n) || 0;
    return String(Math.round(v * 100));
};

const ENTRY_LABELS = {
    credit: { label: 'Crédito', color: 'text-green-700 bg-green-50', sign: '+' },
    reservation: { label: 'Empenho', color: 'text-yellow-700 bg-yellow-50', sign: '−' },
    reservation_release: { label: 'Liberação', color: 'text-blue-700 bg-blue-50', sign: '+' },
    settlement: { label: 'Baixa', color: 'text-red-700 bg-red-50', sign: '−' },
    adjustment: { label: 'Ajuste', color: 'text-purple-700 bg-purple-50', sign: null },
};

// ────────────────────────────────────────────────────────────────────────────
// Card de posto
// ────────────────────────────────────────────────────────────────────────────
const PartnerCard = ({ row, onLancar, onVerExtrato }) => {
    const available = Number(row.available) || 0;
    const credited  = Number(row.total_credited) || 0;
    const consumido = credited > 0 ? Math.max(0, 1 - available / credited) : 0;
    const pct = Math.round(consumido * 100);

    let badge = 'bg-green-100 text-green-800 border-green-300';
    let bar = 'bg-green-500';
    let borderColor = 'border-green-300';
    if (pct >= 80) { badge = 'bg-red-100 text-red-800 border-red-300'; bar = 'bg-red-500'; borderColor = 'border-red-300'; }
    else if (pct >= 50) { badge = 'bg-yellow-100 text-yellow-800 border-yellow-300'; bar = 'bg-yellow-500'; borderColor = 'border-yellow-300'; }

    const fullTankOpen = Number(row.full_tank_open) || 0;

    return (
        <div className={`bg-white rounded-lg shadow border ${borderColor} p-4 flex flex-col gap-3`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate" title={row.partner_name}>{row.partner_name}</h3>
                    <p className="text-xs text-slate-500">Posto parceiro</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded border ${badge}`}>{pct}% consumido</span>
            </div>

            <div>
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-xs text-slate-500">Saldo disponível</p>
                        <p className="text-2xl font-bold text-slate-900">{fmtBRL(available)}</p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <p>Empenhado: {fmtBRL(row.total_reserved)}</p>
                        <p>Creditado: {fmtBRL(credited)}</p>
                    </div>
                </div>
                <div className="mt-2 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
            </div>

            {fullTankOpen > 0 && (
                <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1">
                    <AlertTriangle size={14} />
                    <span>{fullTankOpen} ordem(ns) "encher tanque" sem valor empenhado.</span>
                </div>
            )}

            <div className="flex gap-2 mt-1">
                <button onClick={() => onLancar(row)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-medium text-sm rounded px-3 py-2 inline-flex items-center justify-center gap-1">
                    <Plus size={14} /> Lançar crédito
                </button>
                <button onClick={() => onVerExtrato(row)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded px-3 py-2 inline-flex items-center justify-center gap-1">
                    <History size={14} /> Extrato
                </button>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Modal: Lançar crédito (com seleção de posto opcional)
// ────────────────────────────────────────────────────────────────────────────
const LancarCreditoModal = ({ partner, allPartners, editEntry, onClose, onSaved }) => {
    const isEdit = !!editEntry;
    const [partnerId, setPartnerId] = useState(editEntry?.partner_id || partner?.partner_id || '');
    const [amountDigits, setAmountDigits] = useState(editEntry ? numberToDigits(editEntry.amount) : '');
    const [description, setDescription] = useState(editEntry?.description || '');
    const [detail, setDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!partnerId) { setDetail(null); return; }
        let active = true;
        setLoadingDetail(true);
        apiClient.getPartnerFuelCreditDetail(partnerId)
            .then(d => { if (active) setDetail(d); })
            .catch(e => { if (active) setError(e.message); })
            .finally(() => { if (active) setLoadingDetail(false); });
        return () => { active = false; };
    }, [partnerId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!partnerId) { setError('Escolha um posto.'); return; }
        const v = digitsToNumber(amountDigits);
        if (!Number.isFinite(v) || v <= 0) { setError('Valor deve ser maior que zero.'); return; }
        setSaving(true);
        setError(null);
        try {
            if (isEdit) {
                await apiClient.updatePartnerFuelCreditEntry(editEntry.id, {
                    amount: v,
                    description: description.trim() || null,
                });
            } else {
                await apiClient.createPartnerFuelCredit({
                    partner_id: partnerId,
                    amount: v,
                    description: description.trim() || null,
                });
            }
            onSaved();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const available = Number(detail?.balance?.available || 0);
    const avg30 = Number(detail?.consumption?.avgDaily30 || 0);
    const diasAtuais = avg30 > 0 ? Math.floor(available / avg30) : null;
    const valorNum = digitsToNumber(amountDigits);
    const diasComCredito = avg30 > 0 ? Math.floor((available + valorNum) / avg30) : null;
    const fullTankOpen = Number(detail?.balance?.full_tank_open || 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="font-semibold text-slate-800">{isEdit ? 'Editar crédito lançado' : 'Lançar crédito em posto'}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700">Posto</label>
                        <select
                            value={partnerId}
                            onChange={(e) => setPartnerId(e.target.value)}
                            className="mt-1 w-full border rounded px-3 py-2"
                            required
                            disabled={!!partner || isEdit}
                        >
                            <option value="">Selecione...</option>
                            {(allPartners || []).map(p => (
                                <option key={p.partner_id} value={p.partner_id}>{p.partner_name}</option>
                            ))}
                        </select>
                    </div>

                    {partnerId && (
                        <div className="bg-slate-50 rounded p-3 text-sm space-y-1">
                            {loadingDetail ? (
                                <p className="text-slate-500">Carregando contexto do posto...</p>
                            ) : (
                                <>
                                    <div className="flex justify-between"><span className="text-slate-600">Saldo atual</span><span className="font-semibold">{fmtBRL(available)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-600">Consumo médio (30d)</span><span>{fmtBRL(avg30)}/dia</span></div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Duração estimada do saldo atual</span>
                                        <span>{diasAtuais != null ? `${diasAtuais} dias` : '—'}</span>
                                    </div>
                                    {fullTankOpen > 0 && (
                                        <div className="mt-2 flex items-center gap-2 text-amber-800 bg-amber-100 rounded px-2 py-1 text-xs">
                                            <AlertTriangle size={14} />
                                            <span>{fullTankOpen} ordem(ns) "encher tanque" em aberto — valor ainda não empenhado.</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-medium text-slate-700">Valor a creditar</label>
                        <div className="mt-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">R$</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={digitsToBRL(amountDigits)}
                                onChange={(e) => setAmountDigits(e.target.value.replace(/\D/g, ''))}
                                placeholder="0,00"
                                className="w-full border rounded pl-9 pr-3 py-2 text-right font-mono"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Descrição (opcional)</label>
                        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: depósito 23/06/2026" className="mt-1 w-full border rounded px-3 py-2" maxLength={255} />
                    </div>

                    {valorNum > 0 && diasComCredito != null && (
                        <div className="bg-green-50 text-green-800 rounded px-3 py-2 text-sm">
                            Com este crédito, o saldo dura aproximadamente <strong>{diasComCredito} dias</strong>.
                        </div>
                    )}
                    {error && <div className="bg-red-50 text-red-700 rounded px-3 py-2 text-sm">{error}</div>}

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded border text-slate-700 hover:bg-slate-50">Cancelar</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold disabled:opacity-50">
                            {saving ? 'Salvando...' : (isEdit ? 'Salvar alteração' : 'Confirmar crédito')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Drawer: Extrato em tabela, com filtro técnico e ordem cronológica
// ────────────────────────────────────────────────────────────────────────────
const ExtratoDrawer = ({ partner, onClose, onEditCredit, refreshKey, onAfterMutation }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTechnical, setShowTechnical] = useState(false);
    const [sortAsc, setSortAsc] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        setLoading(true);
        apiClient.getPartnerFuelCreditEntries(partner.partner_id, { limit: 500 })
            .then(setEntries)
            .finally(() => setLoading(false));
    }, [partner.partner_id, refreshKey]);

    const handleDelete = async (entry) => {
        if (!window.confirm(`Remover este crédito de ${fmtBRL(entry.amount)}? Esta ação não pode ser desfeita.`)) return;
        setDeletingId(entry.id);
        try {
            await apiClient.deletePartnerFuelCreditEntry(entry.id);
            onAfterMutation && onAfterMutation();
        } catch (e) {
            alert(e.message);
        } finally {
            setDeletingId(null);
        }
    };

    // Por padrão escondemos `reservation_release` em ordens que já foram baixadas:
    // o par (reservation + release) vira ruído quando a baixa cobre a história.
    // Quando uma ordem tem settlement, mostramos apenas: empenho (estado intermediário)
    // e baixa (definitivo). Sem a "liberação" duplicando informação.
    const filtered = useMemo(() => {
        const settledOrderIds = new Set(
            entries.filter(e => e.entry_type === 'settlement' && e.order_id).map(e => e.order_id)
        );
        let list = entries.filter(e => {
            if (showTechnical) return true;
            if (e.entry_type === 'reservation_release' && e.order_id && settledOrderIds.has(e.order_id)) {
                return false; // libera+baixa = só mostra baixa
            }
            if (e.entry_type === 'reservation' && e.order_id && settledOrderIds.has(e.order_id)) {
                return false; // ordem já baixada — empenho intermediário não interessa
            }
            return true;
        });
        list = [...list].sort((a, b) => {
            const da = new Date(a.created_at).getTime();
            const db = new Date(b.created_at).getTime();
            return sortAsc ? da - db : db - da;
        });
        return list;
    }, [entries, showTechnical, sortAsc]);

    return (
        <div className="fixed inset-0 z-40 flex">
            <div className="flex-1 bg-black/40" onClick={onClose} />
            <div className="w-full max-w-3xl bg-white shadow-xl flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="font-semibold text-slate-800">Extrato — {partner.partner_name}</h2>
                        <p className="text-xs text-slate-500">Lançamentos de crédito, empenho e baixa</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700"><X size={18} /></button>
                </div>

                <div className="px-4 py-2 border-b bg-slate-50 flex flex-wrap items-center gap-3 text-xs">
                    <button
                        onClick={() => setSortAsc(s => !s)}
                        className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-slate-100"
                    >
                        <ArrowUpDown size={12} />
                        {sortAsc ? 'Cronológico (antigos primeiro)' : 'Mais recentes primeiro'}
                    </button>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={showTechnical} onChange={(e) => setShowTechnical(e.target.checked)} />
                        Mostrar lançamentos técnicos (liberações de empenho)
                    </label>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="p-6 text-center text-slate-500">Carregando...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-6 text-center text-slate-500">Sem lançamentos.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="text-left px-3 py-2">Data</th>
                                    <th className="text-left px-3 py-2">Tipo</th>
                                    <th className="text-left px-3 py-2">Ordem / Obra</th>
                                    <th className="text-left px-3 py-2">Descrição</th>
                                    <th className="text-right px-3 py-2">Valor</th>
                                    <th className="text-right px-3 py-2 w-20">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map(e => {
                                    const meta = ENTRY_LABELS[e.entry_type] || { label: e.entry_type, color: 'text-slate-700 bg-slate-50', sign: '' };
                                    const amt = Number(e.amount);
                                    const isFullTankMarker = e.entry_type === 'reservation' && amt === 0 && e.order_is_full_tank == 1;
                                    const label = isFullTankMarker ? 'Empenho (encher tanque)' : meta.label;
                                    const sign = meta.sign != null ? meta.sign : (amt >= 0 ? '+' : '−');
                                    const valueColor = sign === '+' ? 'text-green-700' : 'text-red-700';
                                    return (
                                        <tr key={e.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fmtDateTime(e.created_at)}</td>
                                            <td className="px-3 py-2">
                                                <span className={`text-xs px-2 py-0.5 rounded ${meta.color}`}>{label}</span>
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">
                                                {e.order_auth_number && <div>#{String(e.order_auth_number).padStart(6, '0')}</div>}
                                                {e.obra_name && <div className="text-xs text-slate-500">{e.obra_name}</div>}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">
                                                {e.description}
                                                {e.created_by_email && <div className="text-xs text-slate-400">{e.created_by_email}</div>}
                                            </td>
                                            <td className={`px-3 py-2 text-right whitespace-nowrap font-semibold ${isFullTankMarker ? 'text-amber-700 italic' : valueColor}`}>
                                                {isFullTankMarker ? 'em aberto' : `${sign} ${fmtBRL(Math.abs(amt))}`}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                {e.entry_type === 'credit' && (
                                                    <div className="inline-flex gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => onEditCredit && onEditCredit(e)}
                                                            title="Corrigir valor"
                                                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(e)}
                                                            disabled={deletingId === e.id}
                                                            title="Remover crédito"
                                                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Página principal
// ────────────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
    { key: 'alert',   label: 'Alerta (mais críticos primeiro)' },
    { key: 'name',    label: 'Nome do posto (A→Z)' },
    { key: 'balance', label: 'Saldo disponível (menor primeiro)' },
    { key: 'used',    label: '% consumido (maior primeiro)' },
];

const SaldoEmPostosPage = () => {
    useEnsureResources(['partnerFuelCredits']);
    const { partnerFuelCredits = [], refresh } = useData();
    const [modal, setModal] = useState(null);
    const [extratoPartner, setExtratoPartner] = useState(null);
    const [extratoRefreshKey, setExtratoRefreshKey] = useState(0);
    const [filter, setFilter] = useState('');
    const [sortBy, setSortBy] = useState('alert');
    const [showAll, setShowAll] = useState(false);

    const visiblePartners = useMemo(() => {
        const q = filter.trim().toLowerCase();
        let arr = partnerFuelCredits;
        if (!showAll) arr = arr.filter(hasActivity);
        if (q) arr = arr.filter(p => (p.partner_name || '').toLowerCase().includes(q));

        const sorters = {
            alert: (a, b) => {
                const score = (p) => {
                    const c = Number(p.total_credited) || 0;
                    const av = Number(p.available) || 0;
                    const pct = c > 0 ? 1 - av / c : 0;
                    if (pct >= 0.8) return 0;
                    if (pct >= 0.5) return 1;
                    return 2;
                };
                const d = score(a) - score(b);
                return d !== 0 ? d : (a.partner_name || '').localeCompare(b.partner_name || '');
            },
            name: (a, b) => (a.partner_name || '').localeCompare(b.partner_name || ''),
            balance: (a, b) => (Number(a.available) || 0) - (Number(b.available) || 0),
            used: (a, b) => {
                const used = (p) => {
                    const c = Number(p.total_credited) || 0;
                    const av = Number(p.available) || 0;
                    return c > 0 ? 1 - av / c : 0;
                };
                return used(b) - used(a);
            },
        };
        return [...arr].sort(sorters[sortBy] || sorters.alert);
    }, [partnerFuelCredits, filter, sortBy, showAll]);

    const totalAtivos = partnerFuelCredits.filter(hasActivity).length;
    const totalGeral  = partnerFuelCredits.length;

    const handleSaved = () => {
        setModal(null);
        refresh && refresh('partnerFuelCredits');
        // se o extrato estiver aberto, recarrega ele também
        if (extratoPartner) setExtratoRefreshKey(k => k + 1);
    };

    const handleExtratoMutation = () => {
        refresh && refresh('partnerFuelCredits');
        setExtratoRefreshKey(k => k + 1);
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Fuel size={24} className="text-yellow-500" /> Saldo em Postos
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        {totalAtivos} posto(s) com saldo ou movimento ativo de {totalGeral} cadastrado(s).
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setModal({ type: 'credit', partner: null })}
                        className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold text-sm rounded px-4 py-2 inline-flex items-center gap-1"
                    >
                        <Plus size={16} /> Adicionar crédito
                    </button>
                    <button
                        onClick={() => refresh && refresh('partnerFuelCredits')}
                        className="inline-flex items-center gap-1 border rounded px-3 py-2 text-sm hover:bg-slate-50"
                    >
                        <RefreshCcw size={14} /> Atualizar
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-lg shadow p-3 mb-4 flex flex-wrap gap-3 items-center">
                <input
                    type="search"
                    placeholder="Buscar posto..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="border rounded px-3 py-2 text-sm flex-1 min-w-[180px]"
                />
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border rounded px-3 py-2 text-sm"
                >
                    {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                    Mostrar postos sem saldo
                </label>
            </div>

            {visiblePartners.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
                    <TrendingDown className="mx-auto mb-2 text-slate-400" size={32} />
                    {showAll ? 'Nenhum posto encontrado.' : 'Nenhum posto com saldo ativo. Use "Adicionar crédito" para começar.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visiblePartners.map(row => (
                        <PartnerCard
                            key={row.partner_id}
                            row={row}
                            onLancar={(p) => setModal({ type: 'credit', partner: p })}
                            onVerExtrato={(p) => setExtratoPartner(p)}
                        />
                    ))}
                </div>
            )}

            {modal?.type === 'credit' && (
                <LancarCreditoModal
                    partner={modal.partner}
                    allPartners={partnerFuelCredits}
                    editEntry={modal.editEntry}
                    onClose={() => setModal(null)}
                    onSaved={handleSaved}
                />
            )}
            {extratoPartner && (
                <ExtratoDrawer
                    partner={extratoPartner}
                    refreshKey={extratoRefreshKey}
                    onEditCredit={(entry) => setModal({ type: 'credit', partner: extratoPartner, editEntry: entry })}
                    onAfterMutation={handleExtratoMutation}
                    onClose={() => setExtratoPartner(null)}
                />
            )}
        </div>
    );
};

export default SaldoEmPostosPage;
