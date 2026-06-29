import React, { useMemo } from 'react';

const fmtShortDate = (dStr) => {
    const [, m, d] = dStr.split('-');
    return `${d}/${m}`;
};

const PulseChart = ({ pulse }) => {
    const rawDays = pulse?.days;

    const { days, points, max, consolidatedIdx } = useMemo(() => {
        const d = rawDays || [];
        const m = Math.max(1, ...d.map(x => x.horas));
        const pts = d.map((x, i) => ({ ...x, idx: i }));
        const cIdx = pts.findIndex(p => p.emConsolidacao);
        return { days: d, points: pts, max: m, consolidatedIdx: cIdx };
    }, [rawDays]);

    if (!days.length) {
        return (
            <section className="bg-white rounded-xl border border-stone-200 p-4">
                <h2 className="text-sm font-semibold text-stone-900 mb-1">Pulso diário</h2>
                <p className="text-xs text-stone-500">Sem dados nos últimos 14 dias.</p>
            </section>
        );
    }

    const W = 620, H = 140, padL = 40, padR = 20, padT = 18, padB = 22;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const xOf = (i) => padL + (i * innerW) / Math.max(1, days.length - 1);
    const yOf = (v) => padT + innerH - (v / max) * innerH;

    const consolidatedPoints = points.filter(p => !p.emConsolidacao);
    const inConsolidationPoints = points.filter(p => p.emConsolidacao);
    const bridge = consolidatedIdx > 0 ? points[consolidatedIdx - 1] : null;
    const inConsPath = bridge ? [bridge, ...inConsolidationPoints] : inConsolidationPoints;

    const toPath = (pts) => pts.map(p => `${xOf(p.idx)},${yOf(p.horas)}`).join(' ');

    return (
        <section className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold text-stone-900">Pulso diário · horas executadas</h2>
                <span className="text-[11px] text-stone-500">últimos 14 dias</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[140px] block" role="img" aria-label="Gráfico de horas executadas por dia">
                <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#e7e5e4" strokeWidth="0.5" />
                <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#e7e5e4" strokeWidth="0.5" />

                <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize="10" fill="#a8a29e">{Math.round(max)}</text>
                <text x={padL - 6} y={padT + innerH / 2 + 3} textAnchor="end" fontSize="10" fill="#a8a29e">{Math.round(max / 2)}</text>
                <text x={padL - 6} y={padT + innerH + 3} textAnchor="end" fontSize="10" fill="#a8a29e">0</text>

                {consolidatedPoints.length > 1 && (
                    <polyline points={toPath(consolidatedPoints)} fill="none" stroke="#2563eb" strokeWidth="2" />
                )}
                {inConsPath.length > 1 && (
                    <polyline points={toPath(inConsPath)} fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeDasharray="3,3" />
                )}

                {points.map(p => (
                    <circle key={p.date} cx={xOf(p.idx)} cy={yOf(p.horas)} r="2.5"
                            fill={p.emConsolidacao ? '#a8a29e' : '#2563eb'}>
                        <title>{`${p.date}: ${p.horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h${p.emConsolidacao ? ' (em consolidação)' : ''}`}</title>
                    </circle>
                ))}

                {consolidatedIdx > 0 && (
                    <>
                        <line x1={xOf(consolidatedIdx) - 6} y1={padT} x2={xOf(consolidatedIdx) - 6}
                              y2={padT + innerH} stroke="#d6d3d1" strokeWidth="0.5" strokeDasharray="2,2" />
                        <text x={xOf(consolidatedIdx)} y={padT + 10} fontSize="10" fill="#a8a29e">em consolidação</text>
                    </>
                )}

                {points.filter((_, i) => i % 3 === 0 || i === points.length - 1).map(p => (
                    <text key={`l-${p.date}`} x={xOf(p.idx)} y={H - 6} textAnchor="middle" fontSize="10" fill="#a8a29e">
                        {fmtShortDate(p.date)}
                    </text>
                ))}
            </svg>
        </section>
    );
};

export default PulseChart;
