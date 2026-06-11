import React, { useState, useEffect } from 'react';
import { LayoutDashboard, RefreshCw, Loader, AlertCircle, Truck, BarChart2, ArrowLeft, DollarSign, Activity, Save } from 'lucide-react';
import apiClient from '../services/apiClient';
import ObraCard from '../components/supervisor/ObraCard';
import ContractConfigModal from '../components/supervisor/ContractConfigModal';
import SearchableSelect from '../components/SearchableSelect';
import { formatObraNome } from '../utils/obraFormat';
import AllocationForecastPage from './AllocationForecastPage';

// ============================================================================
// COMPONENTE: BUSINESS INTELLIGENCE & PRODUTIVIDADE
// ============================================================================
const ProductionBI = ({ onBack }) => {
    const [obras, setObras] = useState([]);
    const [filtroObra, setFiltroObra] = useState('geral');
    const [filtroDias, setFiltroDias] = useState(15);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Controlo dos Tickets
    const [ticketMedio, setTicketMedio] = useState({});
    const [unsavedTickets, setUnsavedTickets] = useState(false);
    const [isSavingTickets, setIsSavingTickets] = useState(false);

    // Carrega a listagem de obras para o Select
    useEffect(() => {
        apiClient.get('/supervisor/dashboard').then(res => setObras((res || []).filter(o => (o.tipo_registro || 'obra') !== 'centro_custo'))).catch(console.error);
    }, []);

    // Carrega os dados Analíticos + Configuração de Tickets salva no Banco de Dados
    useEffect(() => {
        setLoading(true);
        Promise.all([
            apiClient.get(`/supervisor/analytics?obraId=${filtroObra}&dias=${filtroDias}`),
            apiClient.get('/supervisor/tickets') // Busca no BD os tickets guardados
        ])
        .then(([analyticsRes, ticketsRes]) => {
            setData(analyticsRes);
            
            // Mescla os tickets da base de dados com possíveis novos tipos de máquinas
            const newTicket = { ...ticketsRes };
            Object.keys(analyticsRes.frotaPorTipo).forEach(tipo => {
                if (newTicket[tipo] === undefined) {
                    newTicket[tipo] = 120; // Default de fallback se não houver no banco
                }
            });
            setTicketMedio(newTicket);
            setUnsavedTickets(false); // Reseta o status de alterações pendentes
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [filtroObra, filtroDias]);

    const handleTicketChange = (tipo, value) => {
        setTicketMedio(prev => ({ ...prev, [tipo]: Number(value) }));
        setUnsavedTickets(true); // Indica que houve alteração manual não guardada
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
            {/* Header de Configuração do BI */}
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
                    {/* Linha de Cartões (KPIs Principais) */}
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

                    {/* Gráfico de Barras com Tailwind Puro (Clean e Seguro) */}
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

                    {/* Financeiro / Ticket Médio Interativo e Persistente */}
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
                                    
                                    {/* Botão para Guardar na Base de Dados */}
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

                                    {/* Resumo Financeiro */}
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
// COMPONENTE ORIGINAL: DASHBOARD DO SUPERVISOR
// ============================================================================
const SupervisorDashboard = ({ user, onNavigateToDetail }) => {
    const [obras, setObras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard', 'allocations' ou 'bi'
    
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [selectedObraForConfig, setSelectedObraForConfig] = useState(null);

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
            const interval = setInterval(fetchDashboardData, 300000); 
            return () => clearInterval(interval);
        }
    }, [viewMode]);

    const handleConfigClick = (e, obra) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        setSelectedObraForConfig(obra);
        setIsConfigModalOpen(true);
    };

    const handleCardClick = (obraId) => {
        if (onNavigateToDetail) {
            onNavigateToDetail(obraId);
        }
    };

    // Navegadores de Páginas Internas
    if (viewMode === 'allocations') {
        return <AllocationForecastPage onBack={() => setViewMode('dashboard')} />;
    }

    if (viewMode === 'bi') {
        return <ProductionBI onBack={() => setViewMode('dashboard')} />;
    }

    return (
        <div className="bg-slate-100 min-h-screen p-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <LayoutDashboard className="text-blue-600" />
                        Gestão de Obras
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Atualizado em: {lastUpdate.toLocaleTimeString()}
                    </p>
                </div>
                
                <div className="flex gap-3 flex-wrap justify-center">
                    <button 
                        onClick={() => setViewMode('bi')}
                        className="text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all" style={{background:'#1c1a17'}} onMouseEnter={e=>e.currentTarget.style.background='#2e2820'} onMouseLeave={e=>e.currentTarget.style.background='#1c1a17'}
                    >
                        <BarChart2 size={18} /> Business Intelligence (BI)
                    </button>

                    <button 
                        onClick={() => setViewMode('allocations')}
                        className="bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold shadow-sm border border-slate-200 flex items-center gap-2 transition-all"
                    >
                        <Truck size={18} /> Previsão de Desmobilização
                    </button>
                    
                    <button 
                        onClick={fetchDashboardData}
                        className="bg-white p-2 rounded-lg text-slate-600 hover:text-blue-600 shadow-sm border border-slate-200"
                        title="Atualizar Agora"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <Loader size={48} className="animate-spin text-blue-600 mb-4" />
                    <span className="text-xl text-slate-600">Calculando previsões...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {obras.map((obra) => (
                        <div key={obra.id} className="h-full transform transition-all hover:-translate-y-1">
                            <ObraCard 
                                obra={obra} 
                                onClick={() => handleCardClick(obra.id)}
                                onConfig={(e) => handleConfigClick(e, obra)}
                            />
                        </div>
                    ))}
                    
                    {obras.length === 0 && (
                        <div className="col-span-full text-center py-20 text-slate-400">
                            <AlertCircle size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="text-lg">Nenhuma obra ativa encontrada.</p>
                        </div>
                    )}
                </div>
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