import React, { useState, useEffect, useMemo } from 'react';
import {
    Activity, Building, Truck, Users, CheckCircle, Wrench, ShieldAlert,
    Maximize2, Loader, Calendar, Bell
} from 'lucide-react';

// Componentes Modularizados
import AllocationMap, { ExpandedMapModal } from '../components/dashboard/ExpandedMapModal';
import InactivityAlertModal from '../components/dashboard/InactivityAlertModal';
import AlertsPanel from '../components/dashboard/AlertsPanel';
import ObraProgressBI from '../components/dashboard/ObraProgressBI';
import FuelEfficiencyRanking from '../components/dashboard/FuelEfficiencyRanking';
import AgendaModal from '../components/modals/AgendaModal'; // NOVO: Componente da Agenda

const Dashboard = ({
    navigate,
    vehicles = [], obras = [], refuelings = [], employees = [], fines = [], revisions = [],
    vehicleGroups = {}, equipmentTypesForHours = [],
    dailyWorkLogs = [], // Recebe logs de faturamento
    apiClient,
    setAlertMessage,
    reloadData
}) => {
    const [selectedInactivityAlert, setSelectedInactivityAlert] = useState(null);
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    
    // Fetch local de alertas de inatividade (específico do dashboard)
    const [inactivityAlerts, setInactivityAlerts] = useState([]);
    const [loadingAlerts, setLoadingAlerts] = useState(true);

    // ==========================================
    // ESTADOS E FUNÇÕES DA NOVA AGENDA
    // ==========================================
    const [showAgenda, setShowAgenda] = useState(false);
    const [notificacoesAgenda, setNotificacoesAgenda] = useState(0);

    const carregarNotificacoesAgenda = async () => {
        try {
            // Usa o apiClient que vem por prop
            if (apiClient && apiClient.get) {
                const response = await apiClient.get('/agenda/notificacoes');
                if (response.data) {
                    setNotificacoesAgenda(response.data.length);
                }
            }
        } catch (error) {
            console.error("Erro ao buscar alertas da agenda:", error);
        }
    };

    useEffect(() => {
        carregarNotificacoesAgenda();
        const intervalAgenda = setInterval(carregarNotificacoesAgenda, 300000); // 5 min
        return () => clearInterval(intervalAgenda);
    }, [apiClient]);
    // ==========================================

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                if (apiClient && apiClient.getInactivityAlerts) {
                    const data = await apiClient.getInactivityAlerts();
                    setInactivityAlerts(data || []);
                }
            } catch (error) { console.error("Erro alertas inatividade", error); } 
            finally { setLoadingAlerts(false); }
        };
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 300000); // 5 min
        return () => clearInterval(interval);
    }, [apiClient]);

    // Estatísticas Rápidas
    const stats = useMemo(() => {
        const activeVehicles = vehicles.filter(v => v.status !== 'Inativo');
        
        // Filtra as multas pendentes de forma mais robusta (ignorando maiúsculas/minúsculas e checando outras colunas)
        const pendingFines = fines.filter(f => {
            const status = String(f.paymentStatus || f.status || f.statusPagamento || '').toLowerCase().trim();
            return status === 'pendente' || status === 'não pago' || status === 'nao pago';
        });
        
        // Soma os valores das multas de forma segura
        const totalFinesValue = pendingFines.reduce((sum, f) => {
            const rawValue = f.valor || f.amount || f.valor_multa || f.valorMulta || 0;
            // Substitui vírgula por ponto caso venha formatado como string pt-BR
            const numValue = parseFloat(String(rawValue).replace(',', '.')); 
            return sum + (isNaN(numValue) ? 0 : numValue);
        }, 0);

        return {
            total: activeVehicles.length,
            obrasAtivas: obras.filter(o => o.status === 'ativa').length,
            emObra: activeVehicles.filter(v => v.status === 'Em Obra').length,
            operacao: activeVehicles.filter(v => v.status === 'Em Operação').length,
            disponivel: activeVehicles.filter(v => v.status === 'Disponível').length,
            // Conta os dois status referentes a manutenção
            manutencao: activeVehicles.filter(v => ['Em Manutenção', 'Aguardando Manutenção'].includes(v.status)).length,
            multas: pendingFines.length,
            valorMultas: totalFinesValue // Retorna a soma total financeira segura
        };
    }, [vehicles, obras, fines]);

    const StatCard = ({ title, value, subValue, icon: Icon, color, onClick }) => (
        <div onClick={onClick} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5 border-l-4 border-l-${color}-500 flex flex-col h-full`}>
            <div className="flex justify-between items-start flex-1">
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1 leading-none">{value}</h3>
                    {/* Renderiza o valor financeiro ou detalhe adicional caso exista */}
                    {subValue && (
                        <div className="mt-1.5">
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                {subValue}
                            </span>
                        </div>
                    )}
                </div>
                <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600 shrink-0`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Activity className="text-yellow-500" /> Painel de Controle
                    </h1>
                    <p className="text-sm text-gray-500">Visão Geral da Frota • {new Date().toLocaleDateString()}</p>
                </div>
                
                {/* --- BOTÃO DA AGENDA (Substituindo o "Gerenciar Obras") --- */}
                <button 
                    onClick={() => setShowAgenda(true)} 
                    className="relative bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2"
                >
                    <Calendar size={18}/> Agenda / Avisos
                    
                    {/* Sininho de Notificação Vermelho */}
                    {notificacoesAgenda > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce shadow-md border-2 border-white z-10">
                            {notificacoesAgenda}
                        </span>
                    )}
                </button>
            </header>

            {/* Grid de Estatísticas (KPIs) */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <StatCard title="Total Frota" value={stats.total} icon={Truck} color="slate" onClick={() => navigate('vehicles')} />
                <StatCard title="Obras Ativas" value={stats.obrasAtivas} icon={Building} color="indigo" onClick={() => navigate('obras', { state: { filter: 'ativa' } })} />
                <StatCard title="Em Obra" value={stats.emObra} icon={Truck} color="blue" onClick={() => navigate('vehicles', { state: { status: 'Em Obra' } })} />
                <StatCard title="Em Operação" value={stats.operacao} icon={Users} color="cyan" onClick={() => navigate('vehicles', { state: { status: 'Em Operação' } })} />
                <StatCard title="Disponíveis" value={stats.disponivel} icon={CheckCircle} color="green" onClick={() => navigate('vehicles', { state: { status: 'Disponível' } })} />
                <StatCard title="Manutenção" value={stats.manutencao} icon={Wrench} color="red" onClick={() => navigate('vehicles', { state: { status: 'Em Manutenção' } })} />
                
                <StatCard 
                    title="Multas Pen." 
                    value={stats.multas} 
                    // Exibe o valor formatado em Reais se houver multas pendentes
                    subValue={stats.multas > 0 ? stats.valorMultas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : undefined}
                    icon={ShieldAlert} 
                    color="orange" 
                    onClick={() => navigate('fines')} 
                />
            </div>

            {/* Layout Principal - 2 Linhas Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* --- LINHA 1: MAPA + PROGRESSO --- */}
                {/* Coluna Esquerda: Mapa (6/12) */}
                <div className="lg:col-span-6 h-[350px]">
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <h2 className="font-bold text-gray-800">Geolocalização da Frota</h2>
                            <button onClick={() => setIsMapExpanded(true)} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"><Maximize2 size={18}/></button>
                        </div>
                        <div className="flex-1 bg-gray-100 relative">
                            {/* Passamos vehicleGroups para permitir o cálculo correto do progresso no mapa */}
                            <AllocationMap 
                                obras={obras} 
                                vehicles={vehicles} 
                                vehicleGroups={vehicleGroups}
                            />
                        </div>
                    </section>
                </div>

                {/* Coluna Direita: Progresso e Faturamento (6/12) */}
                <div className="lg:col-span-6 h-[350px]">
                     <ObraProgressBI 
                        obras={obras} 
                        vehicles={vehicles} 
                        equipmentTypesForHours={equipmentTypesForHours} 
                        dailyWorkLogs={dailyWorkLogs}
                    />
                </div>

                {/* --- LINHA 2: RANKING + ALERTAS --- */}
                {/* Coluna Esquerda: Ranking (6/12) */}
                <div className="lg:col-span-6 h-[350px]">
                     <FuelEfficiencyRanking 
                        vehicles={vehicles} 
                        refuelings={refuelings} 
                        vehicleGroups={vehicleGroups}
                    />
                </div>

                {/* Coluna Direita: Alertas (6/12) */}
                <div className="lg:col-span-6 h-[350px]">
                    <AlertsPanel 
                        vehicles={vehicles} 
                        employees={employees} 
                        revisions={revisions} 
                        inactivityAlerts={inactivityAlerts}
                        refuelings={refuelings} // <--- NOVO: Passando abastecimentos para validação em tempo real
                        obras={obras}
                        navigate={navigate}
                        setSelectedInactivityAlert={setSelectedInactivityAlert}
                    />
                </div>
            </div>

            {/* Modais */}
            {selectedInactivityAlert && (
                <InactivityAlertModal 
                    alert={selectedInactivityAlert} 
                    refuelings={refuelings} 
                    obras={obras}
                    vehicles={vehicles}
                    employees={employees} 
                    onClose={() => setSelectedInactivityAlert(null)}
                    onObserve={() => { setSelectedInactivityAlert(null); reloadData(); }}
                    onProlong={() => { setSelectedInactivityAlert(null); reloadData(); }}
                    apiClient={apiClient}
                    setAlertMessage={setAlertMessage}
                />
            )}
            {isMapExpanded && (
                <ExpandedMapModal 
                    obras={obras} 
                    vehicles={vehicles} 
                    vehicleGroups={vehicleGroups}
                    onClose={() => setIsMapExpanded(false)} 
                />
            )}
            
            {/* --- MODAL DA NOVA AGENDA --- */}
            <AgendaModal 
                isOpen={showAgenda} 
                onClose={() => setShowAgenda(false)} 
                onEventUpdate={carregarNotificacoesAgenda}
            />
        </div>
    );
};

export default Dashboard;