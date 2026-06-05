import React, { useState, useEffect } from 'react';
import { 
    Users, Truck, FileText, AlertTriangle, 
    ClipboardCheck, HardHat, Printer, Droplet, TrendingUp
} from 'lucide-react';

import ProtectedComponent from '../components/ProtectedComponent';
import apiClient from '../services/apiClient'; 

// Importação dos Módulos de Relatório
import VehicleReport from '../components/reports/VehicleReport';
import EmployeeReport from '../components/reports/EmployeeReport';
import AlertsReport from '../components/reports/AlertsReport';
import BillingReport from '../components/reports/BillingReport';
import ConstructionReport from '../components/reports/ConstructionReport';
import WorkPlanReport from '../components/reports/WorkPlanReport';
import SupplyOrdersReport from '../components/reports/SupplyOrdersReport'; 
import AveragesReport from '../components/reports/AveragesReport'; // Novo
import FuelConsumptionReport from '../components/reports/FuelConsumptionReport';

const ReportsPage = ({ 
    vehicles = [], 
    obras = [], 
    expenses = [], 
    equipmentTypesForHours = [], 
    employees = [], 
    fines = [], 
    vehicleGroups = {}, 
    dailyWorkLogs = [], 
    refuelings = [],
    supplyOrders = [], 
    gasStations = [],
    revisions = []
}) => {
    const [reportType, setReportType] = useState(null);
    const [inactivityAlerts, setInactivityAlerts] = useState([]);
    const [fetchedRefuelings, setFetchedRefuelings] = useState([]);
    const [fetchedRevisions, setFetchedRevisions] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (apiClient && apiClient.getInactivityAlerts) {
                    const alertsData = await apiClient.getInactivityAlerts();
                    setInactivityAlerts(alertsData || []);
                }
                if (refuelings.length === 0 && apiClient && apiClient.getRefuelings) {
                    const refuelsData = await apiClient.getRefuelings();
                    setFetchedRefuelings(refuelsData || []);
                }
                if (revisions.length === 0 && apiClient) {
                    try {
                        const revData = apiClient.getRevisions ? await apiClient.getRevisions() : await apiClient.get('/revisions');
                        setFetchedRevisions(Array.isArray(revData) ? revData : []);
                    } catch (e) {
                        console.warn("Aviso: Não foi possível buscar revisões locais.", e);
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar dados para relatório:", error);
            }
        };
        fetchData();
    }, [refuelings, revisions]); 

    const activeRefuelings = refuelings.length > 0 ? refuelings : fetchedRefuelings;
    const activeRevisions = revisions.length > 0 ? revisions : fetchedRevisions; 

    const reportTypes = [
        { id: 'vehicles', label: 'Frota & Veículos', icon: Truck, desc: 'Listagem geral, status e localização.', color: 'bg-blue-600' },
        { id: 'employees', label: 'Funcionários', icon: Users, desc: 'Quadro, histórico e documentos.', color: 'bg-green-600' },
        { id: 'alerts', label: 'Alertas & Pendências', icon: AlertTriangle, desc: 'Vencimentos e inatividade.', color: 'bg-red-600' },
        { id: 'billing', label: 'Faturamento', icon: ClipboardCheck, desc: 'Comparativo Contratado x Faturado.', color: 'bg-yellow-500' },
        { id: 'construction', label: 'Obras', icon: HardHat, desc: 'Progresso Físico vs. Financeiro.', color: 'bg-orange-600' },
        { id: 'workplan', label: 'Plano de Trabalho', icon: FileText, desc: 'Histórico físico e despesas.', color: 'bg-gray-600' },
        { id: 'supply', label: 'Ordens Abastecimento', icon: Droplet, desc: 'Relatório de ordens em aberto.', color: 'bg-purple-600' },
        { id: 'averages', label: 'Médias & Consumo', icon: TrendingUp, desc: 'Comparativos e médias (Km/L, L/Hr).', color: 'bg-teal-600' },
        { id: 'fuel_obra', label: 'Consumo por Obra', icon: Droplet, desc: 'Litros e valores de combustível agrupados por obra.', color: 'bg-orange-600' }
    ];

    return (
        <div className="container mx-auto p-6 md:p-8 max-w-7xl min-h-screen flex flex-col">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" mb-2">Central de Relatórios</h1>
            <p className="text-gray-500 mb-8">Selecione um tipo de relatório para configurar os filtros e gerar o PDF.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8 transition-all duration-500">
                {reportTypes.map((type) => {
                    const isActive = reportType === type.id;
                    return (
                        <button
                            key={type.id}
                            onClick={() => setReportType(type.id)}
                            className={`relative overflow-hidden p-4 rounded-xl border transition-all duration-300 text-left group ${
                                isActive 
                                ? 'border-transparent ring-2 ring-offset-2 ring-yellow-500 shadow-lg scale-105 bg-white z-10' 
                                : 'border-gray-200 bg-white hover:border-yellow-400 hover:shadow-md'
                            }`}
                        >
                            <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity`}>
                                <type.icon size={64} className={isActive ? 'text-yellow-500' : 'text-gray-400'} />
                            </div>
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-white shadow-sm ${type.color}`}>
                                <type.icon size={20} />
                            </div>
                            <h3 className={`font-bold text-sm mb-1 ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>{type.label}</h3>
                            <p className="text-xs text-gray-500 leading-snug">{type.desc}</p>
                            {isActive && <div className="absolute bottom-0 left-0 w-full h-1 bg-yellow-500"></div>}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 bg-white rounded-2xl shadow-sm p-6 md:p-8 relative overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                {!reportType ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-50">
                        <Printer size={64} className="mb-4" style={{ color: "#e8e0d4" }} />
                        <h3 className="text-xl font-bold text-gray-400">Nenhum relatório selecionado</h3>
                        <p className="text-gray-400">Escolha uma opção acima para começar.</p>
                    </div>
                ) : (
                    <div key={reportType} className="animate-slide-up">
                        <ProtectedComponent requiredPermission="viewer">
                            {reportType === 'vehicles' && <VehicleReport vehicles={vehicles} obras={obras} vehicleGroups={vehicleGroups} />}
                            {reportType === 'employees' && <EmployeeReport employees={employees} obras={obras} vehicles={vehicles} fines={fines} />}
                            {reportType === 'alerts' && <AlertsReport vehicles={vehicles} employees={employees} inactivityAlerts={inactivityAlerts} obras={obras} refuelings={activeRefuelings} revisions={activeRevisions} />}
                            {reportType === 'billing' && <BillingReport obras={obras} vehicles={vehicles} />}
                            {reportType === 'construction' && <ConstructionReport obras={obras} vehicles={vehicles} dailyWorkLogs={dailyWorkLogs} vehicleGroups={vehicleGroups} />}
                            {reportType === 'workplan' && <WorkPlanReport obras={obras} vehicles={vehicles} vehicleGroups={vehicleGroups} expenses={expenses} equipmentTypesForHours={equipmentTypesForHours} />}
                            {reportType === 'supply' && <SupplyOrdersReport supplyOrders={supplyOrders} vehicles={vehicles} obras={obras} gasStations={gasStations} refuelings={activeRefuelings} />}
                            {reportType === 'averages' && <AveragesReport refuelings={activeRefuelings} vehicles={vehicles} obras={obras} vehicleGroups={vehicleGroups} />}
                            {reportType === 'fuel_obra' && <FuelConsumptionReport refuelings={activeRefuelings} obras={obras} vehicles={vehicles} expenses={expenses} />}
                        </ProtectedComponent>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportsPage;

