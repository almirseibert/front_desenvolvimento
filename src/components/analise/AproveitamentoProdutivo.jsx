import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Loader, BarChart2, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle,
    DollarSign, Activity, Save, Gauge, Truck, FileDown, FileText, Info
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import SearchableSelect from '../SearchableSelect';
import { formatObraNome } from '../../utils/obraFormat';
import DrillDownDiaModal from './DrillDownDiaModal';
import { useData } from '../../contexts/DataContext';
import TerceirizadoObraResumo from './TerceirizadoObraResumo';

// ============================================================================
// Helpers
// ============================================================================
const fmtH = (h) => `${(Number(h) || 0).toFixed(1)}h`;
const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
const fmtCurrency = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d) =>
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fmtDateBR = (s) => (s || '').split('-').reverse().join('/');

const utilTone = (pct) => {
    if (pct >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-500', soft: 'bg-emerald-50', border: 'border-emerald-200' };
    if (pct >= 60) return { text: 'text-yellow-700',  bg: 'bg-yellow-500',  soft: 'bg-yellow-50',  border: 'border-yellow-200' };
    if (pct >= 40) return { text: 'text-orange-700',  bg: 'bg-orange-500',  soft: 'bg-orange-50',  border: 'border-orange-200' };
    return            { text: 'text-red-700',     bg: 'bg-red-500',     soft: 'bg-red-50',     border: 'border-red-200' };
};

// Presets de período
const buildPresets = () => {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const y = today.getFullYear(), m = today.getMonth();
    const firstThisMonth = new Date(y, m, 1);
    const lastPrevMonth  = new Date(y, m, 0);
    const firstPrevMonth = new Date(y, m - 1, 1);
    const last7Start  = new Date(today); last7Start.setDate(today.getDate() - 6);
    const last30Start = new Date(today); last30Start.setDate(today.getDate() - 29);
    const qStartMonth = Math.floor(m / 3) * 3;
    const firstQ = new Date(y, qStartMonth, 1);
    const firstY = new Date(y, 0, 1);
    return [
        { id: '7d',    label: 'Últimos 7 dias',  start: last7Start,   end: today },
        { id: '30d',   label: 'Últimos 30 dias', start: last30Start,  end: today },
        { id: 'mtd',   label: 'Mês atual',       start: firstThisMonth, end: today },
        { id: 'prev',  label: 'Mês passado',     start: firstPrevMonth, end: lastPrevMonth },
        { id: 'qtd',   label: 'Trimestre',       start: firstQ,       end: today },
        { id: 'ytd',   label: 'Ano até hoje',    start: firstY,       end: today },
    ];
};

// ============================================================================
// Sub-componentes
// ============================================================================
const KpiCard = ({ icon: Icon, label, value, sub, delta, accent = 'border-l-slate-300', valueClass = 'text-slate-800' }) => {
    const Arrow = delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
    const deltaColor = delta == null ? '' : delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-500';
    return (
        <div className={`bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 ${accent}`}>
            <div className="flex items-center gap-2 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                <Icon size={14} /> {label}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
                <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
                {Arrow && (
                    <span className={`text-[11px] font-bold flex items-center gap-0.5 ${deltaColor}`}>
                        <Arrow size={12} />
                        {Math.abs(delta).toFixed(1)}
                    </span>
                )}
            </div>
            {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
        </div>
    );
};

const UtilBar = ({ pct }) => {
    const tone = utilTone(pct);
    const safe = Math.max(0, Math.min(100, pct));
    return (
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full ${tone.bg}`} style={{ width: `${safe}%` }} />
        </div>
    );
};

// ============================================================================
// Componente principal
// ============================================================================
const AproveitamentoProdutivo = ({ apiClient, setAlertMessage }) => {
    const { obras: obrasFull = [], vehicles: vehiclesFull = [] } = useData();
    const obrasComTerceirizado = useMemo(() => {
        const outsourcedIds = new Set(vehiclesFull.filter(v => v.isOutsourced).map(v => v.id));
        const set = new Set();
        obrasFull.forEach(o => {
            if ((o.historicoVeiculos || []).some(h => outsourcedIds.has(h.veiculoId))) set.add(o.id);
        });
        return set;
    }, [obrasFull, vehiclesFull]);
    const presets = useMemo(buildPresets, []);
    const [obras, setObras] = useState([]);
    const [filtroObra, setFiltroObra] = useState('geral');
    const [presetId, setPresetId] = useState('30d');
    const [range, setRange] = useState(() => ({
        start: fmtDate(presets[1].start),
        end: fmtDate(presets[1].end),
    }));
    const [metaRealista, setMetaRealista] = useState(75);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ticketMedio, setTicketMedio] = useState({});
    const [unsavedTickets, setUnsavedTickets] = useState(false);
    const [isSavingTickets, setIsSavingTickets] = useState(false);
    const [drillDate, setDrillDate] = useState(null);

    // Carrega obras para o seletor
    useEffect(() => {
        apiClient.get('/supervisor/dashboard')
            .then(res => setObras((res || []).filter(o => (o.tipo_registro || 'obra') !== 'centro_custo')))
            .catch(err => {
                console.error(err);
                setAlertMessage?.('Falha ao carregar lista de obras.');
            });
    }, [apiClient, setAlertMessage]);

    // Aplica preset
    const applyPreset = useCallback((id) => {
        setPresetId(id);
        if (id === 'custom') return;
        const p = presets.find(x => x.id === id);
        if (p) setRange({ start: fmtDate(p.start), end: fmtDate(p.end) });
    }, [presets]);

    // Carrega analytics
    useEffect(() => {
        if (!range.start || !range.end || range.start > range.end) return;
        setLoading(true);
        Promise.all([
            apiClient.get(`/supervisor/analytics?obraId=${filtroObra}&startDate=${range.start}&endDate=${range.end}`),
            apiClient.get('/supervisor/tickets'),
        ])
        .then(([analyticsRes, ticketsRes]) => {
            setData(analyticsRes);
            const newTicket = { ...ticketsRes };
            (analyticsRes.frotaPorTipo || []).forEach(t => {
                if (newTicket[t.tipo] === undefined) newTicket[t.tipo] = 120;
            });
            setTicketMedio(newTicket);
            setUnsavedTickets(false);
        })
        .catch(err => {
            console.error(err);
            setAlertMessage?.('Falha ao processar dados de produtividade.');
        })
        .finally(() => setLoading(false));
    }, [apiClient, filtroObra, range.start, range.end, setAlertMessage]);

    const handleTicketChange = (tipo, value) => {
        setTicketMedio(prev => ({ ...prev, [tipo]: Number(value) }));
        setUnsavedTickets(true);
    };

    const saveTickets = async () => {
        setIsSavingTickets(true);
        try {
            await apiClient.post('/supervisor/tickets', { tickets: ticketMedio });
            setUnsavedTickets(false);
            setAlertMessage?.('Tickets médios salvos com sucesso.');
        } catch (err) {
            console.error(err);
            setAlertMessage?.('Erro ao salvar os tickets médios.');
        } finally {
            setIsSavingTickets(false);
        }
    };

    // Métricas derivadas
    const m = useMemo(() => {
        if (!data) return null;
        const s = data.summary;
        const meta = metaRealista / 100;

        const totalPotencialDiario = (data.frotaPorTipo || []).reduce(
            (acc, c) => acc + (c.capDiaria * (ticketMedio[c.tipo] || 0)),
            0
        );
        const totalFaturado = (data.frotaPorTipo || []).reduce(
            (acc, c) => acc + (c.horas_executadas * (ticketMedio[c.tipo] || 0)),
            0
        );
        // Receita "potencialmente recuperável" se atingisse a META realista
        const horasMeta = s.capPeriodoLiquida * meta;
        const horasFaltaMeta = Math.max(0, horasMeta - s.horasExecutadas);
        // Distribui receita perdida proporcionalmente aos tipos (capPeriodo × ticket)
        const denom = (data.frotaPorTipo || []).reduce((a, c) => a + c.capPeriodo, 0);
        const receitaPerdidaRealista = denom > 0
            ? (data.frotaPorTipo || []).reduce((acc, c) => {
                const share = c.capPeriodo / denom;
                return acc + (horasFaltaMeta * share) * (ticketMedio[c.tipo] || 0);
            }, 0)
            : 0;

        return {
            totalPotencialDiario,
            totalFaturado,
            horasMeta,
            horasFaltaMeta,
            receitaPerdidaRealista,
        };
    }, [data, ticketMedio, metaRealista]);

    // Export CSV
    const exportCSV = () => {
        if (!data) return;
        const lines = [];
        lines.push(['Aproveitamento Produtivo']);
        lines.push([`Período`, `${fmtDateBR(data.range.startDate)} a ${fmtDateBR(data.range.endDate)}`]);
        lines.push([`Dias úteis`, data.range.diasUteis]);
        lines.push([]);
        lines.push(['Resumo']);
        lines.push(['Capacidade líquida', fmtH(data.summary.capPeriodoLiquida)]);
        lines.push(['Horas executadas', fmtH(data.summary.horasExecutadas)]);
        lines.push(['Aproveitamento', fmtPct(data.summary.aproveitamento)]);
        lines.push(['Horas perdidas', fmtH(data.summary.horasPerdidasTotal)]);
        lines.push([]);

        if (data.porObra?.length) {
            lines.push(['Ranking por obra (pior → melhor)']);
            lines.push(['Obra','Responsável','Fiscal','Veículos','Capacidade','Executado','Aproveitamento','Perdidas']);
            data.porObra.forEach(o => lines.push([
                o.obraNome, o.responsavel || '', o.fiscal || '', o.qtdVeiculos,
                fmtH(o.capPeriodo), fmtH(o.horas_executadas), fmtPct(o.aproveitamento), fmtH(o.horas_perdidas),
            ]));
            lines.push([]);
        }

        lines.push(['Ranking por máquina (pior → melhor)']);
        lines.push(['Registro','Modelo','Tipo','Obra atual','Capacidade','Executado','Aproveitamento','Perdidas']);
        data.porVeiculo.forEach(v => lines.push([
            v.registroInterno || '', v.modelo || '', v.tipo || '', v.obraNome || '',
            fmtH(v.capPeriodo), fmtH(v.horas_executadas), fmtPct(v.aproveitamento), fmtH(v.horas_perdidas),
        ]));

        const csv = lines.map(r => r.map(c => {
            const s = String(c ?? '');
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')).join('\n');

        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aproveitamento_${data.range.startDate}_${data.range.endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Export PDF
    const exportPDF = () => {
        if (!data) return;
        const doc = new jsPDF('portrait');
        doc.setFontSize(14);
        doc.text('MAK Frotas — Aproveitamento Produtivo', 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Período: ${fmtDateBR(data.range.startDate)} a ${fmtDateBR(data.range.endDate)}  •  ${data.range.diasUteis} dias úteis`, 14, 22);
        const obraName = filtroObra === 'geral' ? 'Visão geral da frota' : (obras.find(o => String(o.id) === String(filtroObra))?.nome || filtroObra);
        doc.text(`Escopo: ${obraName}`, 14, 27);

        autoTable(doc, {
            startY: 33,
            head: [['Indicador', 'Valor']],
            body: [
                ['Capacidade líquida no período', fmtH(data.summary.capPeriodoLiquida)],
                ['Horas executadas',              fmtH(data.summary.horasExecutadas)],
                ['Aproveitamento',                fmtPct(data.summary.aproveitamento)],
                ['Horas perdidas',                fmtH(data.summary.horasPerdidasTotal)],
                ['Delta de aproveitamento vs. período anterior', `${data.comparativo.delta.aproveitamento >= 0 ? '+' : ''}${data.comparativo.delta.aproveitamento.toFixed(1)} pp`],
            ],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [158, 122, 66] },
        });

        if (data.porObra?.length) {
            autoTable(doc, {
                head: [['Obra', 'Responsável', 'Veículos', 'Executado', 'Aprov.']],
                body: data.porObra.map(o => [
                    o.obraNome, o.responsavel || '—', o.qtdVeiculos,
                    fmtH(o.horas_executadas), fmtPct(o.aproveitamento),
                ]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [158, 122, 66] },
            });
        }

        autoTable(doc, {
            head: [['Máquina', 'Tipo', 'Obra atual', 'Executado', 'Aprov.']],
            body: data.porVeiculo.map(v => [
                v.registroInterno || v.modelo || '—',
                v.tipo || '—',
                v.obraNome || '—',
                fmtH(v.horas_executadas),
                fmtPct(v.aproveitamento),
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [158, 122, 66] },
        });

        doc.save(`aproveitamento_${data.range.startDate}_${data.range.endDate}.pdf`);
    };

    // ----------------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------------
    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">Aproveitamento Produtivo</h1>
                    <p className="text-sm text-slate-500 max-w-2xl">
                        Capacidade líquida da frota vs. horas efetivamente apontadas. A capacidade
                        desconta fins de semana e máquinas atualmente em manutenção.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={exportCSV}
                        disabled={!data || loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <FileDown size={14} /> CSV
                    </button>
                    <button
                        onClick={exportPDF}
                        disabled={!data || loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
                    >
                        <FileText size={14} /> PDF
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 space-y-3">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[260px]">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Obra</label>
                        <SearchableSelect
                            items={[{ id: 'geral', nome: '🌍 Visão Geral da Frota' }, ...obras]}
                            value={filtroObra}
                            onChange={(item) => setFiltroObra(item?.id || 'geral')}
                            getLabel={(o) => formatObraNome(o)}
                            placeholder="Selecione obra..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">De</label>
                        <input
                            type="date"
                            value={range.start}
                            onChange={(e) => { setRange(r => ({ ...r, start: e.target.value })); setPresetId('custom'); }}
                            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Até</label>
                        <input
                            type="date"
                            value={range.end}
                            onChange={(e) => { setRange(r => ({ ...r, end: e.target.value })); setPresetId('custom'); }}
                            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div className="ml-auto flex items-end gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                                Meta realista de aproveitamento
                                <span title="Usada no cálculo de receita potencialmente perdida. 100% nunca é atingível na prática (deslocamento, intervalo, ausência de operador).">
                                    <Info size={12} className="text-slate-400" />
                                </span>
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range" min={50} max={100} step={5}
                                    value={metaRealista}
                                    onChange={(e) => setMetaRealista(Number(e.target.value))}
                                    className="w-32"
                                />
                                <span className="text-sm font-bold text-slate-800 w-10">{metaRealista}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {presets.map(p => (
                        <button
                            key={p.id}
                            onClick={() => applyPreset(p.id)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                                presetId === p.id
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                    {presetId === 'custom' && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                            Personalizado
                        </span>
                    )}
                </div>
            </div>

            {/* Conteúdo */}
            {loading || !data ? (
                <div className="flex justify-center py-20">
                    <Loader className="animate-spin" size={32} style={{ color: '#9E7A42' }} />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* KPIs principais com delta vs período anterior */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KpiCard
                            icon={Gauge}
                            label="Aproveitamento"
                            value={fmtPct(data.summary.aproveitamento)}
                            sub={`${fmtH(data.summary.horasExecutadas)} de ${fmtH(data.summary.capPeriodoLiquida)} possíveis`}
                            delta={data.comparativo.delta.aproveitamento}
                            accent={`border-l-${
                                data.summary.aproveitamento >= 80 ? 'emerald' :
                                data.summary.aproveitamento >= 60 ? 'yellow'  :
                                data.summary.aproveitamento >= 40 ? 'orange'  : 'red'
                            }-500`}
                            valueClass={utilTone(data.summary.aproveitamento).text}
                        />
                        <KpiCard
                            icon={Clock}
                            label="Capacidade líquida"
                            value={`${data.summary.capDiariaLiquida}h/dia`}
                            sub={`${data.summary.qtdVeiculos} veículos • ${data.summary.qtdManutencao} em manutenção • ${data.range.diasUteis} dias úteis`}
                            accent="border-l-emerald-500"
                        />
                        <KpiCard
                            icon={Activity}
                            label="Média executada"
                            value={`${data.summary.mediaExecutadaDiasUteis.toFixed(1)}h`}
                            sub="por dia útil no período"
                            accent="border-l-blue-500"
                        />
                        <KpiCard
                            icon={AlertTriangle}
                            label="Horas perdidas"
                            value={fmtH(data.summary.horasPerdidasTotal)}
                            sub={`Sendo ${fmtH(data.summary.horasPerdidasManutencao)} em manutenção`}
                            delta={-data.comparativo.delta.horasPerdidasTotal /* sinal invertido: menos perdas é positivo */}
                            accent="border-l-red-500"
                            valueClass="text-red-600"
                        />
                    </div>

                    {/* Gráfico Diário */}
                    {(() => {
                        const capRef = data.summary.capDiariaLiquida;
                        const maxVal = Math.max(capRef, ...data.chartData.map(d => d.horas_faturadas), 10) * 1.15;
                        return (
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                                <div className="flex flex-wrap justify-between items-start mb-6 gap-2">
                                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <BarChart2 size={18} className="text-slate-600" />
                                        Produção diária vs. capacidade
                                    </h3>
                                    <div className="text-[11px] text-slate-500 max-w-md text-right">
                                        Cinza claro = sábado/domingo (capacidade zero). Clique em um dia para abrir o detalhamento por máquina.
                                    </div>
                                </div>

                                <div className="relative h-72 flex items-end gap-1.5 border-b border-l border-slate-200 p-2 pb-0 overflow-x-auto">
                                    {capRef > 0 && (
                                        <div
                                            className="absolute left-0 w-full border-t-[3px] border-dashed border-emerald-500 z-0 pointer-events-none"
                                            style={{ bottom: `${(capRef / maxVal) * 100}%` }}
                                        >
                                            <span className="absolute -top-6 left-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded shadow-sm border border-emerald-200">
                                                Capacidade líquida: {capRef}h/dia
                                            </span>
                                        </div>
                                    )}
                                    {data.chartData.map((d, i) => {
                                        const height = (d.horas_faturadas / maxVal) * 100;
                                        const pct = capRef > 0 && d.is_business_day ? (d.horas_faturadas / capRef) * 100 : 0;
                                        const tone = utilTone(pct);
                                        const dateStr = fmtDateBR(d.date);
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setDrillDate(d.date)}
                                                className="flex-1 flex flex-col justify-end items-center relative group h-full z-10 min-w-[24px]"
                                                title="Ver detalhe do dia"
                                            >
                                                {!d.is_business_day && (
                                                    <div className="absolute inset-x-0 bottom-6 top-0 bg-slate-50 -z-10" />
                                                )}
                                                <div
                                                    className={`w-full max-w-[40px] ${d.is_business_day ? tone.bg : 'bg-slate-300'} rounded-t transition-all cursor-pointer relative shadow-sm`}
                                                    style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0', opacity: 0.85 }}
                                                >
                                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-20">
                                                        <p className="font-bold text-slate-300 mb-1">{dateStr}{!d.is_business_day && ' (fim de semana)'}</p>
                                                        <p className="font-bold">Executado: <span className="text-blue-300">{fmtH(d.horas_faturadas)}</span></p>
                                                        {d.is_business_day && <p>Aproveitamento: <span className={tone.text.replace('700','300')}>{fmtPct(pct)}</span></p>}
                                                    </div>
                                                </div>
                                                <span className="text-[9px] text-slate-500 mt-2 h-6 text-center font-medium">{dateStr.slice(0, 5)}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex flex-wrap justify-center gap-6 mt-4 text-[11px] font-semibold text-slate-600">
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"/>≥80%</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block"/>60–79%</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block"/>40–59%</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"/>&lt;40%</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-300 inline-block"/>Fim de semana</span>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Ranking por obra (apenas em visão geral) */}
                    {data.porObra && data.porObra.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Truck size={18} className="text-slate-600" />
                                    Ranking por obra
                                </h3>
                                <span className="text-[11px] text-slate-500">
                                    Pior → melhor aproveitamento. Quem cobrar.
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                                        <tr>
                                            <th className="p-3 text-left">Obra</th>
                                            <th className="p-3 text-left">Responsável</th>
                                            <th className="p-3 text-left">Fiscal</th>
                                            <th className="p-3 text-center">Veículos</th>
                                            <th className="p-3 text-right">Executado</th>
                                            <th className="p-3 text-left w-[24%]">Aproveitamento</th>
                                            <th className="p-3 text-right">Perdidas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.porObra.map(o => {
                                            const tone = utilTone(o.aproveitamento);
                                            return (
                                                <React.Fragment key={o.obraId}>
                                                <tr className="hover:bg-slate-50">
                                                    <td className="p-3 font-bold text-slate-800">{o.obraNome}</td>
                                                    <td className="p-3 text-slate-600">{o.responsavel || <span className="text-slate-400 italic">—</span>}</td>
                                                    <td className="p-3 text-slate-600">{o.fiscal || <span className="text-slate-400 italic">—</span>}</td>
                                                    <td className="p-3 text-center text-slate-600">{o.qtdVeiculos}</td>
                                                    <td className="p-3 text-right text-slate-700 font-semibold">{fmtH(o.horas_executadas)}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1"><UtilBar pct={o.aproveitamento} /></div>
                                                            <span className={`font-bold min-w-[52px] text-right ${tone.text}`}>{fmtPct(o.aproveitamento)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right text-red-600 font-semibold">{fmtH(o.horas_perdidas)}</td>
                                                </tr>
                                                {obrasComTerceirizado.has(o.obraId) && (
                                                    <tr className="bg-purple-50/40">
                                                        <td colSpan={7} className="px-3 pb-2">
                                                            <TerceirizadoObraResumo obraId={o.obraId} variant="inline" hideWhenEmpty={false} />
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Aproveitamento por categoria */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <Truck size={18} className="text-slate-600" />
                            Aproveitamento por categoria
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                                    <tr>
                                        <th className="p-3 text-left">Categoria</th>
                                        <th className="p-3 text-center">Qtd.</th>
                                        <th className="p-3 text-center">Em manut.</th>
                                        <th className="p-3 text-center">Executado</th>
                                        <th className="p-3 text-left w-[28%]">Aproveitamento</th>
                                        <th className="p-3 text-right">Perdidas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(data.frotaPorTipo || []).map(c => {
                                        const tone = utilTone(c.aproveitamento);
                                        return (
                                            <tr key={c.tipo} className="hover:bg-slate-50">
                                                <td className="p-3 font-bold text-slate-800">{c.tipo}</td>
                                                <td className="p-3 text-center text-slate-600">{c.qtd}</td>
                                                <td className="p-3 text-center text-amber-700 font-semibold">{c.qtdManutencao || 0}</td>
                                                <td className="p-3 text-center text-slate-700 font-semibold">{fmtH(c.horas_executadas)}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1"><UtilBar pct={c.aproveitamento} /></div>
                                                        <span className={`font-bold min-w-[52px] text-right ${tone.text}`}>{fmtPct(c.aproveitamento)}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right text-red-600 font-semibold">{fmtH(c.horas_perdidas)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Ranking por máquina individual */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <Activity size={18} className="text-slate-600" />
                                Máquinas individualmente
                            </h3>
                            <span className="text-[11px] text-slate-500">Da menos aproveitada para a mais aproveitada</span>
                        </div>
                        <div className="overflow-x-auto max-h-[480px]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-bold sticky top-0">
                                    <tr>
                                        <th className="p-3 text-left">Máquina</th>
                                        <th className="p-3 text-left">Tipo</th>
                                        <th className="p-3 text-left">Obra atual</th>
                                        <th className="p-3 text-right">Executado</th>
                                        <th className="p-3 text-left w-[24%]">Aproveitamento</th>
                                        <th className="p-3 text-right">Perdidas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.porVeiculo.map(v => {
                                        const isManut = v.estado === 'manutencao';
                                        const tone = utilTone(v.aproveitamento);
                                        return (
                                            <tr key={v.id} className="hover:bg-slate-50">
                                                <td className="p-3 font-bold text-slate-800">
                                                    {v.registroInterno || v.modelo}
                                                    {v.registroInterno && v.modelo && (
                                                        <span className="text-slate-400 font-normal text-xs"> — {v.modelo}</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-slate-600">{v.tipo}</td>
                                                <td className="p-3 text-slate-600">{v.obraNome || '—'}</td>
                                                <td className="p-3 text-right font-semibold text-slate-700">{fmtH(v.horas_executadas)}</td>
                                                <td className="p-3">
                                                    {isManut ? (
                                                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                                            Em manutenção
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1"><UtilBar pct={v.aproveitamento} /></div>
                                                            <span className={`font-bold min-w-[52px] text-right ${tone.text}`}>{fmtPct(v.aproveitamento)}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right text-red-600 font-semibold">{isManut ? '—' : fmtH(v.horas_perdidas)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Reflexo financeiro com meta realista */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <DollarSign size={18} className="text-yellow-600" />
                                    Reflexo financeiro
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Ticket médio por categoria × horas. "Receita não capturada" usa a meta realista
                                    de <strong>{metaRealista}%</strong> definida acima, não 100%.
                                </p>
                            </div>
                            {unsavedTickets && (
                                <button
                                    onClick={saveTickets}
                                    disabled={isSavingTickets}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 transition-colors"
                                >
                                    {isSavingTickets ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                                    Salvar tickets
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                                        <tr>
                                            <th className="p-3 text-left">Categoria</th>
                                            <th className="p-3 text-center">Cap/dia</th>
                                            <th className="p-3 text-center text-blue-700">Ticket (R$/h)</th>
                                            <th className="p-3 text-right">Potencial / dia</th>
                                            <th className="p-3 text-right">Faturado no período</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(data.frotaPorTipo || []).map(c => {
                                            const ticket = ticketMedio[c.tipo] || 0;
                                            return (
                                                <tr key={c.tipo} className="hover:bg-slate-50">
                                                    <td className="p-3 font-bold text-slate-800">{c.tipo}</td>
                                                    <td className="p-3 text-center text-slate-600">{c.capDiaria}h</td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            value={ticket}
                                                            onChange={(e) => handleTicketChange(c.tipo, e.target.value)}
                                                            className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-center font-bold text-blue-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-slate-700">{fmtCurrency(c.capDiaria * ticket)}</td>
                                                    <td className="p-3 text-right font-bold text-emerald-700">{fmtCurrency(c.horas_executadas * ticket)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">Potencial diário (100%)</p>
                                    <p className="text-2xl font-black text-slate-800 mt-1">{fmtCurrency(m?.totalPotencialDiario || 0)}</p>
                                    <p className="text-xs text-slate-500 mt-2">Referência teórica máxima.</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <p className="text-[11px] text-blue-600 uppercase font-bold tracking-wider">Faturado no período</p>
                                    <p className="text-2xl font-black text-blue-800 mt-1">{fmtCurrency(m?.totalFaturado || 0)}</p>
                                    <p className="text-xs text-blue-600 mt-2">
                                        Média de <strong className="bg-blue-100 px-1 py-0.5 rounded">{fmtCurrency((m?.totalFaturado || 0) / Math.max(1, data.range.diasUteis))}</strong> por dia útil.
                                    </p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                    <p className="text-[11px] text-red-600 uppercase font-bold tracking-wider flex items-center gap-1">
                                        <TrendingUp size={12}/> Não capturado vs. meta de {metaRealista}%
                                    </p>
                                    <p className="text-2xl font-black text-red-700 mt-1">{fmtCurrency(m?.receitaPerdidaRealista || 0)}</p>
                                    <p className="text-xs text-red-600 mt-2">
                                        Receita que faltaria para atingir a meta realista — não a teórica de 100%.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {drillDate && (
                <DrillDownDiaModal
                    apiClient={apiClient}
                    date={drillDate}
                    obraId={filtroObra}
                    onClose={() => setDrillDate(null)}
                />
            )}
        </div>
    );
};

export default AproveitamentoProdutivo;
