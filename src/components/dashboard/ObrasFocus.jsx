import React from 'react';
import { ArrowRight } from 'lucide-react';

const statusColor = {
    vermelho: 'bg-red-500',
    amarelo: 'bg-amber-400',
    verde: 'bg-emerald-500',
};

const ObrasFocus = ({ obras = [], onNavigateAll }) => {
    if (!obras.length) {
        return (
            <section className="bg-white rounded-xl border border-stone-200 p-4">
                <h2 className="text-sm font-semibold text-stone-900 mb-2">Obras em foco</h2>
                <p className="text-xs text-stone-500">Sem obras com dados consolidados no período.</p>
            </section>
        );
    }

    return (
        <section className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold text-stone-900">Obras em foco</h2>
                {onNavigateAll && (
                    <button onClick={onNavigateAll} className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                        Ver todas <ArrowRight size={12} />
                    </button>
                )}
            </div>
            <ul className="divide-y divide-stone-100">
                {obras.map(o => (
                    <li key={o.obraId} className="py-2 flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor[o.status] || 'bg-stone-300'}`} />
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-stone-900 truncate">{o.obraNome}</div>
                            <div className="text-[11px] text-stone-600 truncate">{o.linhaResumo}</div>
                        </div>
                        <div className="text-[11px] text-stone-500 text-right whitespace-nowrap">
                            {o.percentConcluido !== null ? `${Math.round(o.percentConcluido)}% concluída` : '—'}
                            <br />
                            {o.ritmoHorasPorDia !== null
                                ? `ritmo ${o.ritmoHorasPorDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h/dia`
                                : 'sem ritmo'}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default ObrasFocus;
