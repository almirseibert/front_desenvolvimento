import React, { useState, useEffect, useMemo } from 'react';
import ExcavatorLoader from '../components/ui/ExcavatorLoader';
import {
    LayoutDashboard, RefreshCw, Loader, AlertCircle, Truck,
    Activity, Search, X, Clock, CheckCircle2,
    AlertTriangle, ArrowUpDown, DollarSign, TrendingDown,
    FileDown, Users, Percent
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiClient from '../services/apiClient';
import ObraCard from '../components/supervisor/ObraCard';
import ContractConfigModal from '../components/supervisor/ContractConfigModal';
import AllocationForecastPage from './AllocationForecastPage';

const REFRESH_INTERVAL_MS = 300000;

const fmtBRL = (v) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtBRLCompact = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
    return `R$ ${n.toFixed(0)}`;
};
const STATUS_LABELS = {
    red: { label: 'Crítica', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
    violet: { label: 'Atenção', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500' },
    yellow: { label: 'Em andamento', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-400' },
    green: { label: 'Saudável', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
};
const SORT_OPTIONS = [
    { id: 'criticidade', label: 'Criticidade' },
    { id: 'conclusao_desc', label: 'Maior % conclusão' },
    { id: 'conclusao_asc', label: 'Menor % conclusão' },
    { id: 'prazo_asc', label: 'Menor prazo' },
    { id: 'margem_asc', label: 'Pior margem' },
    { id: 'margem_desc', label: 'Melhor margem' },
    { id: 'receita_desc', label: 'Maior receita' },
    { id: 'nome', label: 'Nome (A-Z)' },
];

const computeObraFinance = (o) => {
    const valorTotal = Number(o.kpi?.valor_total_contrato) || 0;
    const gasto = Number(o.kpi?.total_gasto) || 0;
    const perc = Number(o.kpi?.percentual_conclusao) || 0;
    const valorProduzido = (Math.min(perc, 100) / 100) * valorTotal;
    const margem = valorProduzido - gasto;
    const margemPct = valorProduzido > 0 ? (margem / valorProduzido) * 100 : null;
    return { valorTotal, gasto, valorProduzido, margem, margemPct };
};
const STATUS_ORDER = { red: 0, violet: 1, yellow: 2, green: 3 };

// ============================================================================
// KPI CARD (header da listagem)
// ============================================================================
const KpiCard = ({ icon: Icon, label, value, sub, accent }) => (
    <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 ${accent}`}>
        <div className="flex items-center gap-2 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
            <Icon size={14} /> {label}
        </div>
        <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
);

// ============================================================================
// DASHBOARD DO SUPERVISOR (refatorado)
// ============================================================================
const SupervisorDashboard = ({ user, onNavigateToDetail }) => {
    const [obras, setObras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [viewMode, setViewMode] = useState('dashboard');
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [selectedObraForConfig, setSelectedObraForConfig] = useState(null);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [sortBy, setSortBy] = useState('criticidade');
    const [groupMode, setGroupMode] = useState('status'); // 'status' | 'responsavel' | 'none'

    const fetchDashboardData = async () => {
        try {
            if (obras.length === 0) setLoading(true);
            const data = await apiClient.get('/supervisor/dashboard');
            setObras((data || []).filter(o => (o.tipo_registro || 'obra') !== 'centro_custo'));
            setLastUpdate(new Date());
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'dashboard') {
            fetchDashboardData();
            const interval = setInterval(fetchDashboardData, REFRESH_INTERVAL_MS);
            return () => clearInterval(interval);
        }
    }, [viewMode]);

    // KPIs agregados (com camada financeira e ponderação correta)
    const aggregateKpis = useMemo(() => {
        const empty = {
            total: 0, capacidadeTotal: 0, conclusaoPonderada: 0, criticas: 0,
            receitaTotal: 0, custoTotal: 0, valorProduzido: 0, margemMediaPct: 0,
            aditivoEstourado: 0, aditivoRisco: 0,
        };
        if (!obras.length) return empty;

        let capacidadeTotal = 0;
        let somaHorasPonderada = 0; // numerador da média ponderada
        let criticas = 0;
        let receitaTotal = 0;
        let custoTotal = 0;
        let valorProduzido = 0;
        let aditivoEstourado = 0;
        let aditivoRisco = 0;

        obras.forEach(o => {
            const horasContr = Number(o.kpi?.horas_contratadas) || 0;
            const horasExec = Number(o.kpi?.horas_executadas) || 0;
            const perc = Number(o.kpi?.percentual_conclusao) || 0;
            const fin = computeObraFinance(o);

            capacidadeTotal += horasContr;
            somaHorasPonderada += horasExec; // ponderação real: soma exec / soma contr
            if (o.kpi?.status_cor === 'red' || o.kpi?.status_cor === 'violet') criticas++;

            receitaTotal += fin.valorTotal;
            custoTotal += fin.gasto;
            valorProduzido += fin.valorProduzido;

            // Exposição a aditivo:
            // - estourado: obras com perc > 100% → R$ adicional implícito (perc-100)/100 × valorTotal
            // - em risco: obras 90-100% → soma de R$ "produzido restante até 100%"
            if (perc > 100) {
                aditivoEstourado += ((perc - 100) / 100) * fin.valorTotal;
            } else if (perc >= 90) {
                aditivoRisco += ((100 - perc) / 100) * fin.valorTotal;
            }
        });

        const conclusaoPonderada = capacidadeTotal > 0
            ? (somaHorasPonderada / capacidadeTotal) * 100
            : 0;
        const margemAbsoluta = valorProduzido - custoTotal;
        const margemMediaPct = valorProduzido > 0 ? (margemAbsoluta / valorProduzido) * 100 : 0;

        return {
            total: obras.length,
            capacidadeTotal: Math.round(capacidadeTotal),
            conclusaoPonderada: Math.round(conclusaoPonderada),
            criticas,
            receitaTotal,
            custoTotal,
            valorProduzido,
            margemAbsoluta,
            margemMediaPct,
            aditivoEstourado,
            aditivoRisco,
        };
    }, [obras]);

    const statusCounts = useMemo(() => {
        const counts = { red: 0, violet: 0, yellow: 0, green: 0 };
        obras.forEach(o => {
            const s = o.kpi?.status_cor || 'green';
            if (counts[s] !== undefined) counts[s]++;
        });
        return counts;
    }, [obras]);

    const filteredAndSorted = useMemo(() => {
        const normalize = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const q = normalize(search);
        let list = obras.filter(o => {
            if (statusFilter !== 'todos' && (o.kpi?.status_cor || 'green') !== statusFilter) return false;
            if (!q) return true;
            return normalize(o.nome).includes(q)
                || normalize(o.responsavel).includes(q)
                || normalize(o.fiscal_nome).includes(q);
        });

        const margemOf = (o) => {
            const f = computeObraFinance(o);
            return f.margemPct === null ? -Infinity : f.margemPct;
        };
        const cmp = {
            criticidade: (a, b) => (STATUS_ORDER[a.kpi?.status_cor] ?? 9) - (STATUS_ORDER[b.kpi?.status_cor] ?? 9)
                || (b.kpi?.percentual_conclusao || 0) - (a.kpi?.percentual_conclusao || 0),
            conclusao_desc: (a, b) => (b.kpi?.percentual_conclusao || 0) - (a.kpi?.percentual_conclusao || 0),
            conclusao_asc: (a, b) => (a.kpi?.percentual_conclusao || 0) - (b.kpi?.percentual_conclusao || 0),
            prazo_asc: (a, b) => (a.kpi?.dias_restantes_estimados ?? 99999) - (b.kpi?.dias_restantes_estimados ?? 99999),
            margem_asc: (a, b) => margemOf(a) - margemOf(b),
            margem_desc: (a, b) => margemOf(b) - margemOf(a),
            receita_desc: (a, b) => (Number(b.kpi?.valor_total_contrato) || 0) - (Number(a.kpi?.valor_total_contrato) || 0),
            nome: (a, b) => (a.nome || '').localeCompare(b.nome || ''),
        }[sortBy];

        return [...list].sort(cmp);
    }, [obras, search, statusFilter, sortBy]);

    const groups = useMemo(() => {
        if (groupMode !== 'status') return null;
        const buckets = { criticas: [], andamento: [], saudaveis: [] };
        filteredAndSorted.forEach(o => {
            const s = o.kpi?.status_cor || 'green';
            if (s === 'red' || s === 'violet') buckets.criticas.push(o);
            else if (s === 'yellow') buckets.andamento.push(o);
            else buckets.saudaveis.push(o);
        });
        return buckets;
    }, [filteredAndSorted, groupMode]);

    // Agregação por responsável (substitui agrupamento por status quando ativo)
    const groupsByResponsavel = useMemo(() => {
        if (groupMode !== 'responsavel') return null;
        const map = new Map();
        filteredAndSorted.forEach(o => {
            const key = (o.responsavel || 'Sem responsável').trim();
            if (!map.has(key)) map.set(key, { responsavel: key, obras: [], receita: 0, gasto: 0, valorProduzido: 0, criticas: 0 });
            const g = map.get(key);
            const fin = computeObraFinance(o);
            g.obras.push(o);
            g.receita += fin.valorTotal;
            g.gasto += fin.gasto;
            g.valorProduzido += fin.valorProduzido;
            if (o.kpi?.status_cor === 'red' || o.kpi?.status_cor === 'violet') g.criticas++;
        });
        return Array.from(map.values())
            .map(g => ({
                ...g,
                margemPct: g.valorProduzido > 0 ? ((g.valorProduzido - g.gasto) / g.valorProduzido) * 100 : null,
            }))
            .sort((a, b) => b.receita - a.receita);
    }, [filteredAndSorted, groupMode]);

    const handleConfigClick = (e, obra) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        setSelectedObraForConfig(obra);
        setIsConfigModalOpen(true);
    };

    const handleCardClick = (obraId) => {
        if (onNavigateToDetail) onNavigateToDetail(obraId);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
        const now = new Date().toLocaleString('pt-BR');

        doc.setFontSize(14);
        doc.text('Gestão de Obras — Análise Gerencial', 40, 40);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Emitido em ${now} • ${aggregateKpis.total} obras ativas`, 40, 56);

        // KPIs em texto
        const kpiLine = [
            `Receita contratada: ${fmtBRL(aggregateKpis.receitaTotal)}`,
            `Custo realizado: ${fmtBRL(aggregateKpis.custoTotal)}`,
            `Valor produzido: ${fmtBRL(aggregateKpis.valorProduzido)}`,
            `Margem média: ${aggregateKpis.margemMediaPct.toFixed(1)}%`,
            `Conclusão ponderada: ${aggregateKpis.conclusaoPonderada}%`,
            `Aditivo estourado: ${fmtBRL(aggregateKpis.aditivoEstourado)}`,
            `Em risco de aditivo: ${fmtBRL(aggregateKpis.aditivoRisco)}`,
            `Obras críticas: ${aggregateKpis.criticas}`,
        ].join('   |   ');
        doc.setTextColor(40);
        doc.setFontSize(8);
        const wrapped = doc.splitTextToSize(kpiLine, doc.internal.pageSize.getWidth() - 80);
        doc.text(wrapped, 40, 76);

        const rows = filteredAndSorted.map(o => {
            const f = computeObraFinance(o);
            const status = STATUS_LABELS[o.kpi?.status_cor || 'green']?.label || '—';
            return [
                o.nome || '—',
                o.responsavel || '—',
                status,
                `${(o.kpi?.percentual_conclusao || 0).toFixed(1)}%`,
                `${Math.round(o.kpi?.horas_executadas || 0)} / ${Math.round(o.kpi?.horas_contratadas || 0)}`,
                fmtBRLCompact(f.valorTotal),
                fmtBRLCompact(f.gasto),
                f.margemPct === null ? '—' : `${f.margemPct.toFixed(0)}%`,
                o.kpi?.dias_restantes_estimados ? `${o.kpi.dias_restantes_estimados} d` : '—',
            ];
        });

        autoTable(doc, {
            startY: 100,
            head: [['Obra', 'Responsável', 'Status', '% Conc.', 'Horas (exec/contr)', 'Contrato', 'Gasto', 'Margem', 'Prazo']],
            body: rows,
            styles: { fontSize: 8, cellPadding: 4 },
            headStyles: { fillColor: [30, 41, 59], textColor: 255 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right' },
                8: { halign: 'right' },
            },
        });

        doc.save(`gestao-obras-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (viewMode === 'allocations') return <AllocationForecastPage onBack={() => setViewMode('dashboard')} />;

    const renderGrid = (list) => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {list.map((obra) => (
                <div key={obra.id} className="h-full transform transition-all hover:-translate-y-1">
                    <ObraCard
                        obra={obra}
                        onClick={() => handleCardClick(obra.id)}
                        onConfig={(e) => handleConfigClick(e, obra)}
                    />
                </div>
            ))}
        </div>
    );

    const GroupHeader = ({ icon: Icon, color, title, count }) => (
        <div className="flex items-center gap-3 mb-3 mt-2">
            <div className={`w-1.5 h-7 rounded-full ${color}`}></div>
            <Icon size={18} className="text-slate-700" />
            <h2 className="text-base font-bold text-slate-800 tracking-tight">{title}</h2>
            <span className="text-xs font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">{count}</span>
        </div>
    );

    return (
        <div className="bg-slate-100 min-h-screen p-6 animate-fade-in">
            {/* Header com título + ações */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <LayoutDashboard className="text-blue-600" />
                        Gestão de Obras
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">
                        Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={handleExportPDF}
                        className="bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold shadow-sm border border-slate-200 flex items-center gap-2 transition-colors"
                        title="Exportar relatório em PDF"
                    >
                        <FileDown size={18} /> Exportar PDF
                    </button>
                    <button
                        onClick={() => setViewMode('allocations')}
                        className="bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold shadow-sm border border-slate-200 flex items-center gap-2 transition-colors"
                    >
                        <Truck size={18} /> Previsão de Desmobilização
                    </button>
                    <button
                        onClick={fetchDashboardData}
                        className="bg-white p-2 rounded-lg text-slate-600 hover:text-blue-600 shadow-sm border border-slate-200"
                        title="Atualizar agora"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            {/* KPIs agregados — linha 1: visão executiva */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <KpiCard
                    icon={DollarSign}
                    label="Receita contratada"
                    value={fmtBRLCompact(aggregateKpis.receitaTotal)}
                    sub="Soma dos contratos ativos"
                    accent="border-l-blue-500"
                />
                <KpiCard
                    icon={TrendingDown}
                    label="Custo realizado"
                    value={fmtBRLCompact(aggregateKpis.custoTotal)}
                    sub={`Produzido: ${fmtBRLCompact(aggregateKpis.valorProduzido)}`}
                    accent="border-l-slate-500"
                />
                <KpiCard
                    icon={Percent}
                    label="Margem média"
                    value={`${aggregateKpis.margemMediaPct.toFixed(1)}%`}
                    sub={`Abs.: ${fmtBRLCompact(aggregateKpis.margemAbsoluta || 0)}`}
                    accent={aggregateKpis.margemMediaPct >= 20 ? 'border-l-emerald-500' : aggregateKpis.margemMediaPct >= 5 ? 'border-l-yellow-500' : 'border-l-red-500'}
                />
                <KpiCard
                    icon={AlertTriangle}
                    label="Exposição a aditivo"
                    value={fmtBRLCompact(aggregateKpis.aditivoEstourado)}
                    sub={`+ ${fmtBRLCompact(aggregateKpis.aditivoRisco)} em risco (90-100%)`}
                    accent={aggregateKpis.aditivoEstourado > 0 ? 'border-l-red-500' : aggregateKpis.aditivoRisco > 0 ? 'border-l-orange-500' : 'border-l-slate-300'}
                />
            </div>

            {/* KPIs agregados — linha 2: operacional */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard
                    icon={LayoutDashboard}
                    label="Obras ativas"
                    value={aggregateKpis.total}
                    sub={`${statusCounts.green} saudáveis • ${statusCounts.yellow} em and.`}
                    accent="border-l-blue-300"
                />
                <KpiCard
                    icon={Clock}
                    label="Horas contratadas"
                    value={`${aggregateKpis.capacidadeTotal.toLocaleString('pt-BR')}h`}
                    sub="Soma do contratado"
                    accent="border-l-emerald-300"
                />
                <KpiCard
                    icon={Activity}
                    label="Conclusão ponderada"
                    value={`${aggregateKpis.conclusaoPonderada}%`}
                    sub="∑horas exec ÷ ∑horas contratadas"
                    accent="border-l-yellow-400"
                />
                <KpiCard
                    icon={AlertTriangle}
                    label="Obras críticas"
                    value={aggregateKpis.criticas}
                    sub={aggregateKpis.criticas > 0 ? 'Exigem atenção imediata' : 'Nenhuma obra crítica'}
                    accent={aggregateKpis.criticas > 0 ? 'border-l-red-500' : 'border-l-slate-300'}
                />
            </div>

            {/* Barra de busca + filtros */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 mb-6 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por obra, responsável ou fiscal..."
                        className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:bg-white outline-none"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {[
                        { id: 'todos', label: 'Todas', count: obras.length, dot: 'bg-slate-400' },
                        { id: 'red', label: 'Crítica', count: statusCounts.red, dot: STATUS_LABELS.red.dot },
                        { id: 'violet', label: 'Atenção', count: statusCounts.violet, dot: STATUS_LABELS.violet.dot },
                        { id: 'yellow', label: 'Em and.', count: statusCounts.yellow, dot: STATUS_LABELS.yellow.dot },
                        { id: 'green', label: 'Saudável', count: statusCounts.green, dot: STATUS_LABELS.green.dot },
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setStatusFilter(opt.id)}
                            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors ${
                                statusFilter === opt.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${opt.dot}`}></span>
                            {opt.label}
                            <span className={`text-[10px] ${statusFilter === opt.id ? 'text-slate-300' : 'text-slate-400'}`}>{opt.count}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                        <ArrowUpDown size={13} /> Ordenar
                    </div>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium px-2 py-1.5 outline-none focus:border-blue-500"
                    >
                        {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>

                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        {[
                            { id: 'status', label: 'Status', icon: AlertTriangle },
                            { id: 'responsavel', label: 'Responsável', icon: Users },
                            { id: 'none', label: 'Lista', icon: ArrowUpDown },
                        ].map(g => (
                            <button
                                key={g.id}
                                onClick={() => setGroupMode(g.id)}
                                title={`Agrupar por ${g.label}`}
                                className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md transition-colors ${
                                    groupMode === g.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <g.icon size={12} /> {g.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Conteúdo */}
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <ExcavatorLoader size="sm" text="Calculando previsões..." />
                </div>
            ) : filteredAndSorted.length === 0 ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-slate-200">
                    <AlertCircle size={64} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg">{obras.length === 0 ? 'Nenhuma obra ativa encontrada.' : 'Nenhuma obra corresponde aos filtros.'}</p>
                    {obras.length > 0 && (
                        <button onClick={() => { setSearch(''); setStatusFilter('todos'); }} className="mt-3 text-blue-600 hover:underline text-sm font-bold">
                            Limpar filtros
                        </button>
                    )}
                </div>
            ) : groupMode === 'status' && groups ? (
                <div className="space-y-6">
                    {groups.criticas.length > 0 && (
                        <section>
                            <GroupHeader icon={AlertTriangle} color="bg-red-500" title="Críticas / Atenção" count={groups.criticas.length} />
                            {renderGrid(groups.criticas)}
                        </section>
                    )}
                    {groups.andamento.length > 0 && (
                        <section>
                            <GroupHeader icon={Clock} color="bg-yellow-400" title="Em andamento" count={groups.andamento.length} />
                            {renderGrid(groups.andamento)}
                        </section>
                    )}
                    {groups.saudaveis.length > 0 && (
                        <section>
                            <GroupHeader icon={CheckCircle2} color="bg-emerald-500" title="Saudáveis" count={groups.saudaveis.length} />
                            {renderGrid(groups.saudaveis)}
                        </section>
                    )}
                </div>
            ) : groupMode === 'responsavel' && groupsByResponsavel ? (
                <div className="space-y-8">
                    {groupsByResponsavel.map(g => {
                        const margemColor = g.margemPct === null ? 'text-slate-500'
                            : g.margemPct >= 20 ? 'text-emerald-700'
                            : g.margemPct >= 5 ? 'text-yellow-700'
                            : 'text-red-700';
                        return (
                            <section key={g.responsavel}>
                                <div className="flex items-center gap-3 mb-3 mt-2 flex-wrap">
                                    <div className="w-1.5 h-7 rounded-full bg-blue-500"></div>
                                    <Users size={18} className="text-slate-700" />
                                    <h2 className="text-base font-bold text-slate-800 tracking-tight">{g.responsavel}</h2>
                                    <span className="text-xs font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">{g.obras.length} obras</span>
                                    <div className="flex items-center gap-3 text-xs text-slate-600 ml-2">
                                        <span><b>Receita:</b> {fmtBRLCompact(g.receita)}</span>
                                        <span className="text-slate-300">•</span>
                                        <span><b>Gasto:</b> {fmtBRLCompact(g.gasto)}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className={`font-bold ${margemColor}`}>
                                            Margem: {g.margemPct === null ? '—' : `${g.margemPct.toFixed(1)}%`}
                                        </span>
                                        {g.criticas > 0 && (
                                            <>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-red-700 font-bold flex items-center gap-1">
                                                    <AlertTriangle size={11} /> {g.criticas} crítica{g.criticas > 1 ? 's' : ''}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {renderGrid(g.obras)}
                            </section>
                        );
                    })}
                </div>
            ) : (
                renderGrid(filteredAndSorted)
            )}

            <ContractConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                obra={selectedObraForConfig}
                onSuccess={fetchDashboardData}
            />
        </div>
    );
};

export default SupervisorDashboard;
