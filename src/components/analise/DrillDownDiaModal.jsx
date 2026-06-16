import React, { useEffect, useState } from 'react';
import { X, Loader, CheckCircle2, AlertTriangle, Wrench, Moon } from 'lucide-react';

const STATUS_META = {
    produziu:   { label: 'Produziu',         icon: CheckCircle2,  text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
    ocioso:     { label: 'Ocioso',           icon: AlertTriangle, text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200' },
    manutencao: { label: 'Em manutenção',    icon: Wrench,        text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
    nao_util:   { label: 'Dia não útil',     icon: Moon,          text: 'text-slate-600',   bg: 'bg-slate-50',    border: 'border-slate-200' },
};

const fmtH = (h) => `${(Number(h) || 0).toFixed(1)}h`;
const fmtDateBR = (s) => s.split('-').reverse().join('/');

const DrillDownDiaModal = ({ apiClient, date, obraId, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!date) return;
        setLoading(true);
        apiClient.get(`/supervisor/analytics/dia?date=${date}&obraId=${obraId || 'geral'}`)
            .then(setData)
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [apiClient, date, obraId]);

    if (!date) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">
                            Detalhe do dia — {fmtDateBR(date)}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            O que cada máquina fez neste dia.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading || !data ? (
                        <div className="flex justify-center py-16">
                            <Loader className="animate-spin" size={28} style={{ color: '#9E7A42' }} />
                        </div>
                    ) : (
                        <>
                            {/* Resumo do dia */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                {['produziu','ocioso','manutencao','nao_util'].map(st => {
                                    const meta = STATUS_META[st];
                                    const Icon = meta.icon;
                                    return (
                                        <div key={st} className={`${meta.bg} border ${meta.border} rounded-lg p-3`}>
                                            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>
                                                <Icon size={12} /> {meta.label}
                                            </div>
                                            <p className={`text-xl font-bold mt-1 ${meta.text}`}>
                                                {data.totais[st] || 0}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="text-xs text-slate-500 mb-3">
                                Total apontado no dia: <strong className="text-slate-800">{fmtH(data.totais.horas)}</strong>
                                {!data.isBusinessDay && <span className="ml-2 text-amber-600 font-semibold">• Sábado/Domingo</span>}
                            </p>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                                        <tr>
                                            <th className="p-2 text-left">Status</th>
                                            <th className="p-2 text-left">Máquina</th>
                                            <th className="p-2 text-left">Tipo</th>
                                            <th className="p-2 text-left">Obra</th>
                                            <th className="p-2 text-right">Horas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.items.map(it => {
                                            const meta = STATUS_META[it.status];
                                            const Icon = meta.icon;
                                            return (
                                                <tr key={it.id} className="hover:bg-slate-50">
                                                    <td className="p-2">
                                                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${meta.bg} ${meta.text}`}>
                                                            <Icon size={11} /> {meta.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 font-semibold text-slate-800">
                                                        {it.registroInterno || it.modelo}
                                                        {it.registroInterno && it.modelo && (
                                                            <span className="text-slate-400 font-normal"> — {it.modelo}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-slate-600">{it.tipo}</td>
                                                    <td className="p-2 text-slate-600">{it.obraNome || '—'}</td>
                                                    <td className="p-2 text-right font-bold text-slate-800">{fmtH(it.horas)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DrillDownDiaModal;
