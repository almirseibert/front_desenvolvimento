import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const classColors = {
    verde: { bg: 'bg-emerald-100', fill: 'bg-emerald-500', text: 'text-emerald-700' },
    amarelo: { bg: 'bg-amber-100', fill: 'bg-amber-400', text: 'text-amber-700' },
    vermelho: { bg: 'bg-red-100', fill: 'bg-red-500', text: 'text-red-700' },
};

const classify = (pct) => {
    if (pct >= 70) return 'verde';
    if (pct >= 40) return 'amarelo';
    return 'vermelho';
};

const Row = ({ index, name, value, classe }) => {
    const c = classColors[classe] || classColors.amarelo;
    const width = Math.max(2, Math.min(100, value));
    return (
        <div className="flex items-center gap-2 py-1.5">
            <span className="text-[11px] text-stone-500 w-4">{index}</span>
            <div className="flex-1 text-[12px] text-stone-900 truncate">{name}</div>
            <div className={`flex-none w-[90px] ${c.bg} rounded-sm h-3.5 overflow-hidden`}>
                <div className={`${c.fill} h-full`} style={{ width: `${width}%` }} />
            </div>
            <div className={`text-[11px] font-medium w-9 text-right ${c.text}`}>
                {Math.round(value)}%
            </div>
        </div>
    );
};

const Card = ({ title, icon: Icon, iconColor, obras }) => (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="flex justify-between items-center mb-2">
            <div className="text-[13px] font-semibold text-stone-900 inline-flex items-center gap-1.5">
                <Icon size={14} className={iconColor} />
                {title}
            </div>
            <div className="text-[10px] text-stone-500">% aproveitamento · 30d</div>
        </div>
        {obras.length === 0 ? (
            <p className="text-xs text-stone-500">Sem dados no período.</p>
        ) : (
            obras.map((o, i) => (
                <Row
                    key={o.obraId}
                    index={i + 1}
                    name={o.nome}
                    value={o.aproveitamento}
                    classe={o.classe || classify(o.aproveitamento)}
                />
            ))
        )}
    </div>
);

const RankingObras = ({ ranking }) => {
    const top = ranking?.top || [];
    const atencao = ranking?.atencao || [];
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card title="Top produtividade" icon={TrendingUp} iconColor="text-emerald-600" obras={top} />
            <Card title="Atenção" icon={TrendingDown} iconColor="text-red-600" obras={atencao} />
        </div>
    );
};

export default RankingObras;
