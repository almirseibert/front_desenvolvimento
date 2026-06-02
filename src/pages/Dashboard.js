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
        // Mesma lógica da VehiclePage: frota própria = ativo + não-sucata + não-terceirizado
        // computedStatus replica o override de status da VehiclePage (obraAtualId → 'Em Obra', etc.)
        const activeVehicles = vehicles
            .filter(v => {
                const isSucata = v.status === 'Sucata';
                const isAtivo = v.ativo === undefined ? v.status !== 'Inativo' : Boolean(v.ativo);
                return isAtivo && !isSucata && !v.isOutsourced;
            })
            .map(v => {
                let computedStatus = v.status;
                if (!computedStatus || computedStatus === 'Disponível') {
                    if (v.obraAtualId) computedStatus = 'Em Obra';
                    else if (v.operationalAssignment) computedStatus = 'Em Operação';
                    else if (v.maintenanceLocation) computedStatus = 'Em Manutenção';
                    else computedStatus = 'Disponível';
                }
                return { ...v, computedStatus };
            });

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
            obrasAtivas: obras.filter(o => o.status === 'ativa' && (o.tipo_registro || 'obra') !== 'centro_custo').length,
            emObra: activeVehicles.filter(v => v.computedStatus === 'Em Obra').length,
            operacao: activeVehicles.filter(v => v.computedStatus === 'Em Operação').length,
            disponivel: activeVehicles.filter(v => v.computedStatus === 'Disponível').length,
            manutencao: activeVehicles.filter(v => ['Em Manutenção', 'Aguardando Manutenção'].includes(v.computedStatus)).length,
            multas: pendingFines.length,
            valorMultas: totalFinesValue // Retorna a soma total financeira segura
        };
    }, [vehicles, obras, fines]);

    const StatCard = ({ title, value, subValue, icon: Icon, iconBg, iconColor, accentColor, onClick }) => {
        const [hov, setHov] = React.useState(false);
        return (
            <div
                onClick={onClick}
                onMouseEnter={() => setHov(true)}
                onMouseLeave={() => setHov(false)}
                style={{
                    background: 'white',
                    borderRadius: 12,
                    border: '1px solid #f0ebe3',
                    borderLeft: `4px solid ${accentColor || '#e8e0d4'}`,
                    boxShadow: hov ? '0 4px 12px 0 rgb(0 0 0 / 0.09)' : '0 1px 3px 0 rgb(0 0 0 / 0.06)',
                    transform: hov ? 'translateY(-2px)' : 'none',
                    transition: 'box-shadow 0.15s, transform 0.15s',
                    cursor: 'pointer',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flex: 1 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8a78', lineHeight: 1.25 }}>{title}</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#3d3528', lineHeight: 1, marginTop: 6 }}>{value}</p>
                        {subValue && (
                            <div style={{ marginTop: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#b03828', background: '#fdf0ec', border: '1px solid #e8c8bc', borderRadius: 4, padding: '2px 6px' }}>
                                    {subValue}
                                </span>
                            </div>
                        )}
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg || '#f5f2ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={20} color={iconColor || '#9a8a78'} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="flex items-center gap-2" style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14', lineHeight: 1.25 }}>
                        <Activity size={20} style={{ color: '#9E7A42' }} /> Painel de Controle
                    </h1>
                    <p style={{ fontSize: 12, color: '#9a8a78', marginTop: 2 }}>Visão Geral da Frota · {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
                
                {/* --- BOTÃO DA AGENDA (Substituindo o "Gerenciar Obras") --- */}
                <button 
                    onClick={() => setShowAgenda(true)} 
                    className="relative text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2" style={{background:'#1c1a17'}} onMouseEnter={e=>e.currentTarget.style.background='#2e2820'} onMouseLeave={e=>e.currentTarget.style.background='#1c1a17'}
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
                <StatCard title="Total Frota"   value={stats.total}      icon={Truck}       iconBg="#fdf8f0" iconColor="#9E7A42" accentColor="#9E7A42" onClick={() => navigate('vehicles')} />
                <StatCard title="Obras Ativas"  value={stats.obrasAtivas} icon={Building}   iconBg="#eff5fc" iconColor="#2d5a8a" accentColor="#2d5a8a" onClick={() => navigate('obras', { state: { filter: 'ativa' } })} />
                <StatCard title="Em Obra"       value={stats.emObra}     icon={Truck}       iconBg="#e0f2fe" iconColor="#0c4a6e" accentColor="#0ea5e9" onClick={() => navigate('vehicles', { state: { status: 'Em Obra' } })} />
                <StatCard title="Em Operação"   value={stats.operacao}   icon={Users}       iconBg="#ede9fe" iconColor="#3730a3" accentColor="#8b5cf6" onClick={() => navigate('vehicles', { state: { status: 'Em Operação' } })} />
                <StatCard title="Disponíveis"   value={stats.disponivel} icon={CheckCircle} iconBg="#d1fae5" iconColor="#065f46" accentColor="#10b981" onClick={() => navigate('vehicles', { state: { status: 'Disponível' } })} />
                <StatCard title="Manutenção"    value={stats.manutencao} icon={Wrench}      iconBg="#ffedd5" iconColor="#9a3412" accentColor="#f97316" onClick={() => navigate('vehicles', { state: { status: 'Em Manutenção' } })} />
                <StatCard
                    title="Multas Pen."
                    value={stats.multas}
                    subValue={stats.multas > 0 ? stats.valorMultas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : undefined}
                    icon={ShieldAlert}
                    iconBg="#fdf0ec" iconColor="#b03828" accentColor="#b03828"
                    onClick={() => navigate('fines')}
                />
            </div>

            {/* Layout Principal - 2 Linhas Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* --- LINHA 1: MAPA + PROGRESSO --- */}
                {/* Coluna Esquerda: Mapa (6/12) */}
                <div className="lg:col-span-6 h-[350px]">
                    <section className="bg-white rounded-xl overflow-hidden h-full flex flex-col" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)' }}>
                        <div className="p-4 flex justify-between items-center shrink-0" style={{ borderBottom: '1px solid #f0ebe3', background: '#faf9f7' }}>
                            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14' }}>Geolocalização da Frota</h2>
                            <button onClick={() => setIsMapExpanded(true)} style={{ color: '#9a8a78', background: 'transparent', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', lineHeight: 0 }} onMouseEnter={e => { e.currentTarget.style.background = '#f5f2ed'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}><Maximize2 size={16}/></button>
                        </div>
                        <div className="flex-1 relative" style={{ background: '#f5f3ef' }}>
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