import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    LayoutDashboard, RefreshCw, Loader, AlertCircle, Truck, BarChart2,
    ArrowLeft, DollarSign, Activity, Save, Search, X, Clock, CheckCircle2,
    AlertTriangle, ArrowUpDown
} from 'lucide-react';
import apiClient from '../services/apiClient';
import ObraCard from '../components/supervisor/ObraCard';
import ContractConfigModal from '../components/supervisor/ContractConfigModal';
import SearchableSelect from '../components/SearchableSelect';
import { formatObraNome } from '../utils/obraFormat';
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
// COMPONENTE: BUSINESS INTELLIGENCE & PRODUTIVIDADE (mantido sem mudanças)
// ============================================================================
const ProductionBI = ({ onBack }) => {
    const [obras, setObras] = useState([]);
    const [filtroObra, setFiltroObra] = useState('geral');
    const [filtroDias, setFiltroDias] = useState(15);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ticketMedio, setTicketMedio] = useState({});
    const [unsavedTickets, setUnsavedTickets] = useState(false);
    const [isSavingTickets, setIsSavingTickets] = useState(false);

    useEffect(() => {
        apiClient.get('/supervisor/dashboard').then(res => setObras((res || []).filter(o => (o.tipo_registro || 'obra') !== 'centro_custo'))).catch(console.error);
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            apiClient.get(`/supervisor/analytics?obraId=${filtroObra}&dias=${filtroDias}`),
            apiClient.get('/supervisor/tickets')
        ])
        .then(([analyticsRes, ticketsRes]) => {
            setData(analyticsRes);
            const newTicket = { ...ticketsRes };
            Object.keys(analyticsRes.frotaPorTipo).forEach(tipo => {
                if (newTicket[tipo] === undefined) newTicket[tipo] = 120;
            });
            setTicketMedio(newTicket);
            setUnsavedTickets(false);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [filtroObra, filtroDias]);

    const handleTicketChange = (tipo, value) => {
        setTicketMedio(prev => ({ ...prev, [tipo]: Number(value) }));
        setUnsavedTickets(true);
    };

    const saveTicketsToDatabase = async () => {
        setIsSavingTickets(true);
        try {
            await apiClient.post('/supervisor/tickets', { tickets: ticketMedio });
            setUnsavedTickets(false);
        } catch (error) {
            console.error("Erro ao guardar tickets:", error);
            alert("Ocorreu um erro ao guardar os valores padrão.");
        } finally {
            setIsSavingTickets(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    return (
        <div className="bg-slate-100 min-h-screen p-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={20}/></button>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart2 className="text-blue-600" />
                        BI & Análise de Produtividade
                    </h1>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <div className="flex-1 md:flex-none min-w-[220px]">
                        <SearchableSelect
                            items={[{ id: 'geral', nome: '🌍 Visão Geral da Frota' }, ...obras]}
                            value={filtroObra}
                            onChange={(item) => setFiltroObra(item?.id || 'geral')}
                            getLabel={(o) => formatObraNome(o)}
                            placeholder="Selecione obra..."
                        />
                    </div>

                    <select
                        className="bg-slate-50 border border-slate-300 text-slate-700 rounded-lg p-2 font-medium flex-1 md:flex-none outline-none focus:border-blue-500"
                        value={filtroDias}
                        onChange={(e) => setFiltroDias(Number(e.target.value))}
                    >
                        <option value={7}>Últimos 7 dias</option>
                        <option value={15}>Últimos 15 dias</option>
                        <option value={30}>Últimos 30 dias</option>
                    </select>
                </div>
            </div>

            {loading || !data ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <Loader size={48} className="animate-spin text-blue-600 mb-4" />
                    <span className="text-lg text-slate-600">Processando cruzamento de dados...</span>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-green-500">
                            <p className="text-xs font-bold text-slate-500 uppercase">Capacidade Produtiva</p>
                            <p className="text-3xl font-bold text-slate-800 mt-2">{data.summary.capEmObra + data.summary.capDisponivel}<span className="text-sm font-normal text-slate-500">h/dia</span></p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
                            <p className="text-xs font-bold text-slate-500 uppercase">Produção Média (Apontada)</p>
                            <p className="text-3xl font-bold text-blue-600 mt-2">{data.summary.mediaExecutada}<span className="text-sm font-normal text-slate-500">h/dia</span></p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-red-500">
                            <p className="text-xs font-bold text-slate-500 uppercase">Perda por Manutenção</p>
                            <p className="text-3xl font-bold text-red-500 mt-2">{data.summary.capManutencao}<span className="text-sm font-normal text-slate-500">h/dia</span></p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-yellow-500">
                            <p className="text-xs font-bold text-slate-500 uppercase">Aproveitamento (OEE)</p>
                            <p className="text-3xl font-bold text-yellow-600 mt-2">
                                {data.summary.capEmObra + data.summary.capDisponivel > 0
                                    ? ((data.summary.mediaExecutada / (data.summary.capEmObra + data.summary.capDisponivel)) * 100).toFixed(1)
                                    : '0'}%
                            </p>
                        </div>
                    </div>

                    {(() => {
                        const maxVal = Math.max(...data.chartData.map(d => Math.max(d.capacidade_alocada + d.capacidade_disponivel + d.capacidade_manutencao, d.horas_faturadas)), 10) * 1.15;

                        return (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2">
                                    <Activity size={20} className="text-blue-600"/> Apontamentos vs Capacidade Técnica
                                </h3>

                                <div className="relative h-72 flex items-end gap-2 border-b border-l border-slate-200 p-2 pb-0">
                                    <div
                                        className="absolute left-0 w-full border-t-[3px] border-dashed border-green-500 z-0 flex items-center transition-all duration-500"
                                        style={{ bottom: `${((data.summary.capEmObra + data.summary.capDisponivel) / maxVal) * 100}%` }}
                                    >
                                        <span className="absolute -top-6 left-2 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded shadow-sm border border-green-200">
                                            Capacidade Total (Disponível): {data.summary.capEmObra + data.summary.capDisponivel}h/dia
                                        </span>
                                    </div>

                                    {data.summary.capManutencao > 0 && (
                                        <div
                                            className="absolute left-0 w-full border-t border-dotted border-red-400 z-0 flex items-center transition-all duration-500"
                                            style={{ bottom: `${((data.summary.capEmObra + data.summary.capDisponivel + data.summary.capManutencao) / maxVal) * 100}%` }}
                                        >
                                            <span className="absolute -top-6 right-2 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-200">
                                                Pico Absoluto (c/ Manutenções): {data.summary.capEmObra + data.summary.capDisponivel + data.summary.capManutencao}h/dia
                                            </span>
                                        </div>
                                    )}

                                    {data.chartData.map((d, i) => {
                                        const height = (d.horas_faturadas / maxVal) * 100;
                                        const parts = d.date.split('-');
                                        const dateStr = `${parts[2]}/${parts[1]}`;

                                        return (
                                            <div key={i} className="flex-1 flex flex-col justify-end items-center relative group h-full z-10">
                                                <div
                                                    className="w-full max-w-[40px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition-all cursor-pointer relative shadow-sm border-t border-blue-300"
                                                    style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                                                >
                                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-20">
                                                        <p className="font-bold text-slate-300 mb-1">{dateStr}</p>
                                                        <p className="font-bold text-sm">Faturado: <span className="text-blue-300">{d.horas_faturadas.toFixed(1)}h</span></p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] text-slate-500 mt-2 h-6 text-center font-medium">{dateStr}</span>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="flex flex-wrap justify-center gap-8 mt-8 text-xs font-bold text-slate-600">
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded border border-blue-600"></div> Produção Efetiva</div>
                                    <div className="flex items-center gap-2"><div className="w-6 h-0 border-t-[3px] border-dashed border-green-500"></div> Frota Disponível (Obras + Pátio)</div>
                                    <div className="flex items-center gap-2"><div className="w-6 h-0 border-t border-dotted border-red-400"></div> Total Empresa (Incl. Quebrados)</div>
                                </div>
                            </div>
                        );
                    })()}

                    {(() => {
                        let potencialDiario = 0;
                        let faturadoTotal = 0;
                        Object.keys(data.frotaPorTipo).forEach(tipo => {
                            const info = data.frotaPorTipo[tipo];
                            const ticket = ticketMedio[tipo] || 0;
                            potencialDiario += (info.cap * ticket);
                            faturadoTotal += (info.horas_executadas * ticket);
                        });

                        return (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <DollarSign size={20} className="text-yellow-600"/> Análise Financeira por Categoria
                                    </h3>

                                    {unsavedTickets && (
                                        <button
                                            onClick={saveTicketsToDatabase}
                                            disabled={isSavingTickets}
                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 transition-colors animate-pulse"
                                        >
                                            {isSavingTickets ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                                            Salvar Valores Padrão
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                                                <tr>
                                                    <th className="p-3 rounded-tl-lg">Categoria</th>
                                                    <th className="p-3 text-center">Unid.</th>
                                                    <th className="p-3 text-center">Capacidade (h/dia)</th>
                                                    <th className="p-3 text-center text-blue-600">Ticket Médio (R$/h)</th>
                                                    <th className="p-3 text-right rounded-tr-lg">Potencial Financeiro / Dia</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {Object.keys(data.frotaPorTipo).map(tipo => {
                                                    const info = data.frotaPorTipo[tipo];
                                                    const ticket = ticketMedio[tipo] || 0;
                                                    return (
                                                        <tr key={tipo} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3 font-bold text-slate-800">{tipo}</td>
                                                            <td className="p-3 text-center text-slate-600 font-medium">{info.qtd}</td>
                                                            <td className="p-3 text-center text-slate-600 font-medium">{info.cap}h</td>
                                                            <td className="p-3 flex justify-center">
                                                                <input
                                                                    type="number"
                                                                    value={ticket}
                                                                    onChange={(e) => handleTicketChange(tipo, e.target.value)}
                                                                    className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-center font-bold text-blue-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                                                />
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-green-700">
                                                                {formatCurrency(info.cap * ticket)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {Object.keys(data.frotaPorTipo).length === 0 && (
                                                    <tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">Nenhum equipamento produtivo encontrado neste filtro.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 hover:shadow-md transition-all">
                                            <p className="text-[11px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Faturamento Teórico Ideal</p>
                                            <p className="text-3xl font-black text-slate-800">{formatCurrency(potencialDiario)} <span className="text-sm font-bold text-slate-400">/dia</span></p>
                                            <p className="text-xs text-slate-500 mt-2">Equivale à <strong className="text-slate-700">capacidade total (100%)</strong> vendida pelo ticket médio preenchido.</p>
                                        </div>

                                        <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 hover:shadow-md transition-all">
                                            <p className="text-[11px] text-blue-600 uppercase font-bold mb-1 tracking-wider">Faturamento Apontado (Período)</p>
                                            <p className="text-3xl font-black text-blue-800">{formatCurrency(faturadoTotal)}</p>
                                            <p className="text-xs text-blue-600 mt-2">Isso representa uma média de <strong className="bg-blue-100 px-1 py-0.5 rounded">{formatCurrency(faturadoTotal / filtroDias)}</strong> arrecadados por dia.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

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
    if (viewMode === 'bi') return <ProductionBI onBack={() => setViewMode('dashboard')} />;

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
                        onClick={() => setViewMode('bi')}
                        className="text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-colors bg-slate-900 hover:bg-slate-800"
                    >
                        <BarChart2 size={18} /> Business Intelligence
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
