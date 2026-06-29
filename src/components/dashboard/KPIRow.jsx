import React from 'react';
import { TrendingUp, TrendingDown, Truck, Fuel, AlertOctagon, Activity } from 'lucide-react';

const fmtNumber = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtPct = (n) => `${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;

const DeltaPp = ({ value }) => {
    if (value === null || value === undefined) return null;
    if (Math.abs(value) < 0.05) return <span className="text-gray-500">estável vs período anterior</span>;
    const up = value > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span className={up ? 'text-red-600' : 'text-emerald-600'}>
            <Icon size={11} className="inline -mt-0.5 mr-0.5" />
            {up ? '+' : ''}{value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}pp vs período anterior
        </span>
    );
};

const Card = ({ title, value, hint, icon: Icon, danger }) => (
    <div className={`rounded-xl p-3.5 ${danger ? 'bg-red-50 border border-red-200' : 'bg-white border border-stone-200'}`}>
        <div className="flex items-start justify-between">
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${danger ? 'text-red-700' : 'text-stone-500'}`}>{title}</div>
            <Icon size={16} className={danger ? 'text-red-500' : 'text-stone-400'} />
        </div>
        <div className={`text-2xl font-semibold mt-1.5 ${danger ? 'text-red-700' : 'text-stone-900'}`}>{value}</div>
        <div className={`text-[11px] mt-1 ${danger ? 'text-red-600' : 'text-stone-600'}`}>{hint}</div>
    </div>
);

const KPIRow = ({ kpis }) => {
    if (!kpis) return null;
    const apr = kpis.aproveitamento || {};
    const veic = kpis.veiculosAtivos || {};
    const fuel = kpis.combustivelReceita || {};
    const obrasRisco = kpis.obrasEmRisco || 0;

    const fuelWarn = fuel.value >= (fuel.limit - 2);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card
                title="Aproveitamento"
                value={fmtPct(apr.value)}
                hint={<DeltaPp value={apr.deltaPp} />}
                icon={Activity}
            />
            <Card
                title="Veículos ativos"
                value={
                    <>
                        {fmtNumber(veic.trabalharam)}
                        <span className="text-sm text-stone-500 font-normal"> / {fmtNumber(veic.total)}</span>
                    </>
                }
                hint="trabalharam no período"
                icon={Truck}
            />
            <Card
                title="Combustível / receita"
                value={fmtPct(fuel.value)}
                hint={
                    <span className={fuelWarn ? 'text-amber-600' : 'text-stone-600'}>
                        limite {fuel.limit}%
                    </span>
                }
                icon={Fuel}
            />
            <Card
                title="Obras em risco"
                value={fmtNumber(obrasRisco)}
                hint="prejuízo ou atraso projetado"
                icon={AlertOctagon}
                danger
            />
        </div>
    );
};

export default KPIRow;
