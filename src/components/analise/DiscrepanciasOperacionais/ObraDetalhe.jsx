import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader, ArrowLeft } from 'lucide-react';

const fmtMin = (min) => {
    if (!min) return '0h';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (!h) return `${m}min`;
    if (!m) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
};

const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
};

const TIPO_META = {
    maquina_alem_do_faturado:      { color: 'text-red-700',    bg: 'bg-red-50',    dot: 'bg-red-500',    label: 'Máquina rodou além do faturado', short: 'Rodou além do faturado' },
    faturado_alem_da_maquina:      { color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500', label: 'Faturado além da máquina',       short: 'Faturado sem rastreador' },
    sem_lancamento_com_atividade:  { color: 'text-amber-700',  bg: 'bg-amber-50',  dot: 'bg-amber-500',  label: 'Atividade sem lançamento',       short: 'Sem lançamento' },
    gap_ponto_maquina_inicio:      { color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500', label: 'Operador presente, máquina desligada', short: 'Gap ponto → máquina' },
    gap_ponto_maquina_fim:         { color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500', label: 'Máquina parou antes do operador sair', short: 'Máquina parou cedo' },
};

const TIPOS_ORDEM = [
    'maquina_alem_do_faturado',
    'faturado_alem_da_maquina',
    'sem_lancamento_com_atividade',
    'gap_ponto_maquina_inicio',
    'gap_ponto_maquina_fim',
];

const ObraDetalhe = ({ apiClient, obra, range, onBack, onSelectDiscrepancia, setAlertMessage }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tipoFiltro, setTipoFiltro] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.getAnaliseObraDetalhe(obra.obraId, range);
            setData(res);
        } catch (e) {
            setAlertMessage?.(e.message || 'Erro ao carregar obra.');
        } finally {
            setLoading(false);
        }
    }, [apiClient, obra.obraId, range, setAlertMessage]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader className="animate-spin" size={32} style={{ color: '#9E7A42' }} />
            </div>
        );
    }
    if (!data) return null;

    const { kpis, topMaquinas, topOperadores, lista } = data;

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
                <div className="flex items-start gap-3">
                    <button
                        onClick={onBack}
                        className="mt-1 p-1.5 rounded hover:bg-slate-200 transition-colors"
                        title="Voltar"
                    >
                        <ArrowLeft size={18} className="text-slate-600" />
                    </button>
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Divergências Operacionais</p>
                        <h1 className="text-2xl font-bold text-slate-800">{obra.obraNome}</h1>
                        <p className="text-xs text-slate-500 mt-0.5">{range.startDate} → {range.endDate}</p>
                    </div>
                </div>
            </div>

            {/* Bloco 1 — KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <Kpi
                    label="Máquina rodou além do faturado"
                    sublabel="rastreador ativo fora da janela"
                    value={fmtMin(kpis.gapMaquinaAlemFaturadoMin)}
                    tone="red"
                />
                <Kpi
                    label="Faturado além da máquina"
                    sublabel="janela faturada sem atividade"
                    value={fmtMin(kpis.gapFaturadoAlemMaquinaMin)}
                    tone="orange"
                />
                <Kpi
                    label="Gap ponto → máquina"
                    sublabel="aguardando integração do ponto"
                    value={fmtMin(kpis.gapPontoMaquinaMin)}
                    tone="purple"
                    pending={!kpis.gapPontoMaquinaMin}
                />
                <Kpi
                    label="Dias sem lançamento"
                    sublabel="com atividade detectada"
                    value={kpis.diasSemLancamentoComAtividade}
                    tone="amber"
                />
            </div>

            {/* Bloco 2 — Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <RankingCard
                    title="Top 5 máquinas"
                    items={topMaquinas.map(m => ({
                        primary: m.registroInterno || m.placa,
                        secondary: m.placa,
                        value: fmtMin(m.min),
                    }))}
                />
                <RankingCard
                    title="Top 5 operadores"
                    items={topOperadores.map(o => ({
                        primary: o.nome,
                        secondary: null,
                        value: fmtMin(o.min),
                    }))}
                    emptyMessage="Sem dados de operadores (aguardando integração do ponto)."
                />
            </div>

            {/* Bloco 3 — Lista com filtro por tipo */}
            <ListaComFiltro
                lista={lista}
                tipoFiltro={tipoFiltro}
                setTipoFiltro={setTipoFiltro}
                onSelectDiscrepancia={onSelectDiscrepancia}
            />
        </div>
    );
};

const ListaComFiltro = ({ lista, tipoFiltro, setTipoFiltro, onSelectDiscrepancia }) => {
    // Conta ocorrências por tipo (uma discrepância pode ter múltiplos tipos)
    const contagem = useMemo(() => {
        const acc = {};
        for (const item of lista) {
            for (const d of (item.discrepancias || [])) {
                acc[d.tipo] = (acc[d.tipo] || 0) + 1;
            }
        }
        return acc;
    }, [lista]);

    const tiposPresentes = TIPOS_ORDEM.filter(t => contagem[t] > 0);

    const listaFiltrada = useMemo(() => {
        if (!tipoFiltro) return lista;
        return lista.filter(item =>
            (item.discrepancias || []).some(d => d.tipo === tipoFiltro)
        );
    }, [lista, tipoFiltro]);

    return (
        <div className="bg-white rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-slate-800">Discrepâncias do período</h3>
                <span className="text-xs text-slate-400">
                    {listaFiltrada.length} de {lista.length}
                </span>
            </div>

            {/* Pills de filtro */}
            {tiposPresentes.length > 0 && (
                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2">
                    <FilterPill
                        active={tipoFiltro === null}
                        onClick={() => setTipoFiltro(null)}
                        label="Todas"
                        count={lista.length}
                        tone="slate"
                    />
                    {tiposPresentes.map(t => {
                        const meta = TIPO_META[t];
                        return (
                            <FilterPill
                                key={t}
                                active={tipoFiltro === t}
                                onClick={() => setTipoFiltro(tipoFiltro === t ? null : t)}
                                label={meta.short}
                                count={contagem[t]}
                                dot={meta.dot}
                            />
                        );
                    })}
                </div>
            )}

            {listaFiltrada.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                    {tipoFiltro ? 'Nenhuma discrepância desse tipo no período.' : 'Nenhuma discrepância relevante.'}
                </div>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {listaFiltrada.map(item => (
                        <DiscrepanciaRow
                            key={item.id}
                            item={item}
                            tipoDestaque={tipoFiltro}
                            onClick={() => onSelectDiscrepancia(item.id)}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
};

const FilterPill = ({ active, onClick, label, count, dot, tone }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            active
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
    >
        {dot && <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : dot}`} />}
        {label}
        <span className={`px-1.5 py-0 rounded-full text-[10px] ${
            active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
        }`}>
            {count}
        </span>
    </button>
);

const Kpi = ({ label, sublabel, value, tone, pending }) => {
    const tones = {
        red:    'border-red-200    text-red-700',
        orange: 'border-orange-200 text-orange-700',
        purple: 'border-purple-200 text-purple-700',
        amber:  'border-amber-200  text-amber-700',
    };
    return (
        <div className={`bg-white rounded-lg shadow-sm border-l-4 ${tones[tone]} p-3 relative`}>
            {pending && (
                <span className="absolute top-2 right-2 text-[9px] text-slate-300 uppercase">pendente</span>
            )}
            <div className={`text-2xl font-bold ${pending ? 'text-slate-300' : ''}`}>{value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-1">{label}</div>
            <div className="text-[10px] text-slate-400">{sublabel}</div>
        </div>
    );
};

const RankingCard = ({ title, items, emptyMessage }) => (
    <div className="bg-white rounded-lg shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
        </div>
        {items.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs px-4">
                {emptyMessage || 'Sem dados no período.'}
            </div>
        ) : (
            <ol className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                    <li key={idx} className="px-4 py-2.5 flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-700 truncate">{item.primary}</div>
                            {item.secondary && (
                                <div className="text-[11px] text-slate-400 truncate">{item.secondary}</div>
                            )}
                        </div>
                        <span className="font-bold text-amber-700 text-sm">{item.value}</span>
                    </li>
                ))}
            </ol>
        )}
    </div>
);

const DiscrepanciaRow = ({ item, tipoDestaque, onClick }) => {
    const discs = item.discrepancias || [];
    // Se há filtro ativo e essa linha tem o tipo, usa-o como destaque.
    // Senão, o tipo mais grave dita cor e magnitude exibida.
    const destacada = tipoDestaque
        ? discs.find(d => d.tipo === tipoDestaque)
        : discs.reduce((m, d) => (d.magnitude_min > (m?.magnitude_min || 0) ? d : m), null);
    const meta = TIPO_META[destacada?.tipo] || { color: 'text-slate-700', dot: 'bg-slate-400' };
    const magnitude = destacada?.magnitude_min ?? item.maiorMagnitudeMin;

    return (
        <li>
            <button onClick={onClick} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                <span className={`font-bold text-sm ${meta.color} min-w-[80px]`}>{fmtMin(magnitude)}</span>
                <span className="text-xs text-slate-500 min-w-[80px]">
                    {item.registroInterno || item.placa}
                    {item.operadorNome ? ` / ${item.operadorNome}` : ''}
                </span>
                <span className="text-xs text-slate-400">{fmtDate(item.data)}</span>
                <span className="flex-1 text-xs text-slate-600 truncate ml-2">
                    {discs.map(d => TIPO_META[d.tipo]?.short || d.tipo).join(' · ')}
                </span>
            </button>
        </li>
    );
};

export default ObraDetalhe;
