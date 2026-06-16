import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    LayoutDashboard, RefreshCw, Loader, AlertCircle, Truck,
    Activity, Search, X, Clock, CheckCircle2,
    AlertTriangle, ArrowUpDown
} from 'lucide-react';
import apiClient from '../services/apiClient';
import ObraCard from '../components/supervisor/ObraCard';
import ContractConfigModal from '../components/supervisor/ContractConfigModal';
import AllocationForecastPage from './AllocationForecastPage';

const REFRESH_INTERVAL_MS = 300000;
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
    { id: 'nome', label: 'Nome (A-Z)' },
];
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
    const [grouped, setGrouped] = useState(true);
    const [secondsToRefresh, setSecondsToRefresh] = useState(REFRESH_INTERVAL_MS / 1000);
    const tickerRef = useRef(null);

    const fetchDashboardData = async () => {
        try {
            if (obras.length === 0) setLoading(true);
            const data = await apiClient.get('/supervisor/dashboard');
            setObras((data || []).filter(o => (o.tipo_registro || 'obra') !== 'centro_custo'));
            setLastUpdate(new Date());
            setSecondsToRefresh(REFRESH_INTERVAL_MS / 1000);
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
            tickerRef.current = setInterval(() => {
                setSecondsToRefresh(s => (s > 1 ? s - 1 : REFRESH_INTERVAL_MS / 1000));
            }, 1000);
            return () => {
                clearInterval(interval);
                if (tickerRef.current) clearInterval(tickerRef.current);
            };
        }
    }, [viewMode]);

    // KPIs agregados
    const aggregateKpis = useMemo(() => {
        if (!obras.length) return { total: 0, capacidadeTotal: 0, alocacaoMedia: 0, criticas: 0 };
        let capacidadeTotal = 0;
        let somaPercentual = 0;
        let criticas = 0;
        obras.forEach(o => {
            capacidadeTotal += Number(o.kpi?.horas_contratadas || 0);
            somaPercentual += Number(o.kpi?.percentual_conclusao || 0);
            if (o.kpi?.status_cor === 'red' || o.kpi?.status_cor === 'violet') criticas++;
        });
        return {
            total: obras.length,
            capacidadeTotal: Math.round(capacidadeTotal),
            alocacaoMedia: Math.round(somaPercentual / obras.length),
            criticas,
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

        const cmp = {
            criticidade: (a, b) => (STATUS_ORDER[a.kpi?.status_cor] ?? 9) - (STATUS_ORDER[b.kpi?.status_cor] ?? 9)
                || (b.kpi?.percentual_conclusao || 0) - (a.kpi?.percentual_conclusao || 0),
            conclusao_desc: (a, b) => (b.kpi?.percentual_conclusao || 0) - (a.kpi?.percentual_conclusao || 0),
            conclusao_asc: (a, b) => (a.kpi?.percentual_conclusao || 0) - (b.kpi?.percentual_conclusao || 0),
            prazo_asc: (a, b) => (a.kpi?.dias_restantes_estimados ?? 99999) - (b.kpi?.dias_restantes_estimados ?? 99999),
            nome: (a, b) => (a.nome || '').localeCompare(b.nome || ''),
        }[sortBy];

        return [...list].sort(cmp);
    }, [obras, search, statusFilter, sortBy]);

    const groups = useMemo(() => {
        if (!grouped) return null;
        const buckets = { criticas: [], andamento: [], saudaveis: [] };
        filteredAndSorted.forEach(o => {
            const s = o.kpi?.status_cor || 'green';
            if (s === 'red' || s === 'violet') buckets.criticas.push(o);
            else if (s === 'yellow') buckets.andamento.push(o);
            else buckets.saudaveis.push(o);
        });
        return buckets;
    }, [filteredAndSorted, grouped]);

    const handleConfigClick = (e, obra) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        setSelectedObraForConfig(obra);
        setIsConfigModalOpen(true);
    };

    const handleCardClick = (obraId) => {
        if (onNavigateToDetail) onNavigateToDetail(obraId);
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
                    <p className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                        Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1"><RefreshCw size={11} className="text-slate-400"/> próx. em {Math.floor(secondsToRefresh / 60)}m {secondsToRefresh % 60}s</span>
                    </p>
                </div>

                <div className="flex gap-2 flex-wrap">
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

            {/* KPIs agregados */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard
                    icon={LayoutDashboard}
                    label="Obras ativas"
                    value={aggregateKpis.total}
                    sub={`${statusCounts.green} saudáveis • ${statusCounts.yellow} em andamento`}
                    accent="border-l-blue-500"
                />
                <KpiCard
                    icon={Clock}
                    label="Horas contratadas"
                    value={`${aggregateKpis.capacidadeTotal.toLocaleString('pt-BR')}h`}
                    sub="Soma do contratado em todas obras"
                    accent="border-l-emerald-500"
                />
                <KpiCard
                    icon={Activity}
                    label="Conclusão média"
                    value={`${aggregateKpis.alocacaoMedia}%`}
                    sub="Média ponderada do progresso físico"
                    accent="border-l-yellow-500"
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

                    <button
                        onClick={() => setGrouped(g => !g)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                            grouped ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="Alternar agrupamento por status"
                    >
                        Agrupar
                    </button>
                </div>
            </div>

            {/* Conteúdo */}
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <Loader size={48} className="animate-spin text-blue-600 mb-4" />
                    <span className="text-xl text-slate-600">Calculando previsões...</span>
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
            ) : grouped ? (
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
