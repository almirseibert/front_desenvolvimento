import React from 'react';
import { Clock, Calendar, AlertTriangle, User, Settings, DollarSign } from 'lucide-react';

const fmtBRLCompact = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
    return `R$ ${n.toFixed(0)}`;
};

const ObraCard = ({ obra, onClick, onConfig }) => {
    const { kpi, nome, responsavel, fiscal_nome, previsao } = obra;
    
    const colorMap = {
        green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', bar: 'bg-emerald-500', icon: 'text-emerald-600' },
        yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', bar: 'bg-yellow-400', icon: 'text-yellow-600' },
        violet: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', bar: 'bg-purple-500', icon: 'text-purple-600' },
        red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', bar: 'bg-red-600', icon: 'text-red-600' },
    };

    const status = kpi?.status_cor || 'green';
    const styles = colorMap[status] || colorMap.green;
    const percentual = kpi?.percentual_conclusao || 0;
    
    // Data de previsão (Vem do backend já calculada)
    const dataTermino = previsao?.data_termino_estimada 
        ? new Date(previsao.data_termino_estimada).toLocaleDateString('pt-BR') 
        : '--/--/----';
    
    const diasRestantes = kpi?.dias_restantes_estimados || 0;

    return (
        <div 
            onClick={onClick}
            className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 cursor-pointer relative flex flex-col h-full hover:shadow-md transition-shadow group`}
        >
            <button 
                onClick={(e) => {
                    if(e && e.stopPropagation) e.stopPropagation();
                    if (onConfig) onConfig(e);
                }}
                className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors z-10"
                title="Configurar Contrato"
            >
                <Settings size={16} />
            </button>

            <div className="mb-4 pr-6">
                <h3 className="font-bold text-lg text-slate-800 leading-tight line-clamp-2 min-h-[3.5rem]">{nome}</h3>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <User size={12} />
                    <span>Resp: {responsavel}</span>
                </div>
                {fiscal_nome && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="text-slate-300">|</span>
                        <span>Fiscal: {fiscal_nome}</span>
                    </div>
                )}
            </div>

            <div className="mb-4">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Progresso Físico</span>
                    <span className={`text-sm font-bold ${styles.text}`}>{percentual}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                        className={`h-2.5 rounded-full transition-all duration-1000 ${styles.bar}`} 
                        style={{ width: `${Math.min(percentual, 100)}%` }}
                    ></div>
                </div>
            </div>

            {/* KPIs Principais */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {/* HORAS: Contratadas / Executadas */}
                <div className={`p-2 rounded-lg border ${styles.bg} ${styles.border}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <Clock size={14} className={styles.icon} />
                        <span className={`text-[10px] font-bold uppercase ${styles.text}`}>Horas</span>
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-xs font-bold ${styles.text}`}>
                            {kpi?.horas_contratadas?.toFixed(0) || 0} / {kpi?.horas_executadas?.toFixed(0) || 0}
                        </span>
                        <span className="text-[10px] opacity-70">Cont. / Exec.</span>
                    </div>
                </div>
                
                {/* Previsão */}
                <div className="p-2 rounded-lg border bg-slate-50 border-slate-200">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Calendar size={14} className="text-slate-500" />
                        <span className="text-[10px] font-bold uppercase text-slate-500">Previsão</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{dataTermino}</span>
                        <span className="text-[10px] text-slate-400">{diasRestantes > 0 ? `${diasRestantes} dias úteis` : 'Concluído'}</span>
                    </div>
                </div>
            </div>

            {/* Mini-linha financeira */}
            {(() => {
                const valorTotal = Number(kpi?.valor_total_contrato) || 0;
                const gasto = Number(kpi?.total_gasto) || 0;
                const valorProduzido = (Math.min(percentual, 100) / 100) * valorTotal;
                const margem = valorProduzido - gasto;
                const margemPct = valorProduzido > 0 ? (margem / valorProduzido) * 100 : null;
                const margemColor = margemPct === null ? 'text-slate-400'
                    : margemPct >= 25 ? 'text-emerald-700'
                    : margemPct >= 10 ? 'text-yellow-700'
                    : 'text-red-700';
                if (valorTotal === 0 && gasto === 0) return null;
                return (
                    <div className="mb-3 p-2 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign size={13} className="text-slate-500" />
                            <span className="text-[10px] font-bold uppercase text-slate-500">Financeiro</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[11px]">
                            <div>
                                <div className="text-slate-400 text-[9px] uppercase">Contrato</div>
                                <div className="font-bold text-slate-700">{fmtBRLCompact(valorTotal)}</div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-[9px] uppercase">Gasto</div>
                                <div className="font-bold text-slate-700">{fmtBRLCompact(gasto)}</div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-[9px] uppercase">Margem</div>
                                <div className={`font-bold ${margemColor}`}>
                                    {margemPct === null ? '—' : `${margemPct.toFixed(0)}%`}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <div className="mt-auto flex flex-wrap gap-2">
                {percentual > 90 && (
                    <div className="flex items-center bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 text-[10px] font-bold animate-pulse">
                        <AlertTriangle size={12} className="mr-1" />
                        Zona de Aditivo
                    </div>
                )}
                
                {diasRestantes < 15 && diasRestantes > 0 && percentual < 90 && (
                    <div className="flex items-center bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 text-[10px] font-bold">
                        <Clock size={12} className="mr-1" />
                        Prazo Curto
                    </div>
                )}
            </div>
        </div>
    );
};

export default ObraCard;