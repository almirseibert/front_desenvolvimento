import React from 'react';

const pad2 = (n) => String(n).padStart(2, '0');

const fmtHHMM = (iso) => {
    const d = new Date(iso);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const Trilha = ({ label, color, intervals, pending, dataStr }) => {
    const dayStart = new Date(`${dataStr}T00:00:00`).getTime();
    const total = 24 * 60 * 60 * 1000;
    const xPct = (iso) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - dayStart) / total) * 100));
    const wPct = (a, b) => Math.max(0.2, xPct(b) - xPct(a));

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 w-20 shrink-0 uppercase tracking-wide">
                {label}
            </span>
            <div className="flex-1 h-6 bg-slate-100 rounded relative overflow-hidden">
                {pending && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 italic">
                        Aguardando integração
                    </div>
                )}
                {!pending && (intervals || []).map((iv, idx) => (
                    <div
                        key={idx}
                        className={`absolute top-0 h-full ${color} rounded-sm`}
                        style={{
                            left:  `${xPct(iv.inicio)}%`,
                            width: `${wPct(iv.inicio, iv.fim)}%`,
                        }}
                        title={`${fmtHHMM(iv.inicio)} – ${fmtHHMM(iv.fim)}`}
                    />
                ))}
            </div>
        </div>
    );
};

const Timeline3Trilhas = ({ dataStr, faturado, rastreador, ponto, pontoPending }) => (
    <div className="space-y-2">
        {/* Eixo de horas */}
        <div className="flex items-center gap-2">
            <span className="w-20 shrink-0" />
            <div className="flex-1 flex justify-between text-[10px] text-slate-400 font-mono px-0.5">
                {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => (
                    <span key={h}>{pad2(h)}:00</span>
                ))}
            </div>
        </div>
        <Trilha label="Faturado"   color="bg-blue-500"   intervals={faturado}   dataStr={dataStr} />
        <Trilha label="Rastreador" color="bg-emerald-500" intervals={rastreador} dataStr={dataStr} />
        <Trilha label="Ponto"      color="bg-purple-500" intervals={ponto}      pending={pontoPending} dataStr={dataStr} />
    </div>
);

export default Timeline3Trilhas;
