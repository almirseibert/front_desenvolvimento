import React, { useState, useMemo } from 'react';
import { Bell, AlertTriangle, ShieldAlert, Wrench, FileText, Badge, Timer, CheckCircle } from 'lucide-react';
// Importa a lógica unificada de restrições
import { checkVehicleRestrictions } from '../../utils/vehicleRules';
import { formatObraNome } from '../../utils/obraFormat';

const AlertsPanel = ({ vehicles = [], employees = [], inactivityAlerts = [], obras = [], navigate, setSelectedInactivityAlert, revisions = [], refuelings = [] }) => {
    const [activeTab, setActiveTab] = useState('todos');

    // Processamento centralizado de alertas (Unificado e em Tempo Real)
    const alerts = useMemo(() => {
        const list = [];
        const now = new Date();
        // Zera a hora atual para comparação justa de datas
        now.setHours(0, 0, 0, 0);

        const thirtyDays = new Date(now);
        thirtyDays.setDate(now.getDate() + 30);

        // 1. Alertas de Veículos (Manutenção e Docs de Veículos)
        vehicles.forEach(v => {
            const vehicleRevisions = revisions.filter(r => r.vehicleId === v.id);
            const restrictions = checkVehicleRestrictions(v, vehicleRevisions);

            restrictions.forEach((issue, index) => {
                let category = 'manutencao'; 
                if (issue.category === 'documento') category = 'docs_veiculo';
                if (issue.category === 'bloqueio') category = 'manutencao';

                list.push({
                    id: `v-${v.id}-${index}`,
                    category: category,
                    type: issue.type === 'error' ? 'danger' : 'warning',
                    title: `${v.registroInterno} - ${v.placa}`,
                    subtitle: issue.category.toUpperCase(),
                    message: issue.message,
                    date: 'Hoje',
                    action: () => navigate('revisions')
                });
            });
        });

        // 2. Alertas de Inatividade (Operacional) - CÁLCULO 100% DINÂMICO
        const DIAS_LIMITE = 7; // Define com quantos dias sem abastecer o alerta é gerado

        vehicles.forEach(v => {
            // Regra 1: O veículo deve estar estritamente 'Em Obra'
            if (v.status !== 'Em Obra') return;

            // Regra 2: O registro de inatividade deve ser referente à obra atual
            if (!v.obraAtualId) return;

            // Regra 4: Analisar juntamente com a obra atual quando foi o último abastecimento
            const vehRefuels = refuelings
                .filter(r => String(r.vehicleId) === String(v.id) && String(r.obraId) === String(v.obraAtualId) && r.status === 'Concluída')
                .sort((a,b) => {
                    const dA = new Date(a.data || a.date || a.created_at || 0);
                    const dB = new Date(b.data || b.date || b.created_at || 0);
                    return dB - dA; // O mais recente primeiro
                });

            let lastRefuelDate = null;
            let daysInactive = null;
            let isBasedOnAllocation = false;

            if (vehRefuels.length > 0) {
                // Pegamos a data do abastecimento mais recente NESSA obra
                const latest = vehRefuels[0];
                const dRaw = latest.data || latest.date || latest.created_at;
                const dObj = new Date(dRaw);
                
                if (!isNaN(dObj.getTime())) {
                    lastRefuelDate = dObj;
                    const diffTime = Math.abs(now - dObj);
                    daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                }
            } else {
                // Se o veículo está na obra mas NUNCA abasteceu lá, verificamos a data em que ele foi alocado
                const obra = obras.find(o => String(o.id) === String(v.obraAtualId));
                if (obra && obra.historicoVeiculos) {
                    const alocacao = obra.historicoVeiculos.find(h => String(h.veiculoId) === String(v.id) && !h.dataSaida);
                    if (alocacao && alocacao.dataEntrada) {
                        const dObj = new Date(alocacao.dataEntrada);
                        if (!isNaN(dObj.getTime())) {
                            lastRefuelDate = dObj;
                            const diffTime = Math.abs(now - dObj);
                            daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            isBasedOnAllocation = true;
                        }
                    }
                }
            }

            // Se não foi possível rastrear uma data base (sem alocação formal e sem abastecimento), pulamos para não gerar falso positivo.
            if (daysInactive === null || lastRefuelDate === null) return;

            // Regra 3 e 5: Se passar do limite, exibe o alerta. Se ele tiver sido abastecido, os dias caem (ex: 0) e ele é ignorado.
            if (daysInactive >= DIAS_LIMITE) {
                // Consultamos se já existe um card "Observado" salvo no banco para não sobrepor a ação do usuário
                const backendAlert = inactivityAlerts.find(a => 
                    String(a.vehicleId || a.vehicle_id || a.vehicle?.id) === String(v.id) && 
                    String(a.obraId || a.obra_id || a.obra?.id) === String(v.obraAtualId) &&
                    ['Ativo', 'Pendente', 'Observado'].includes(a.status)
                );

                // Ocultamos apenas se o gestor já tratou (Observou)
                if (backendAlert && backendAlert.status === 'Observado') return;

                let obraNome = 'Obra Desconhecida';
                const foundObra = obras.find(o => String(o.id) === String(v.obraAtualId));
                if (foundObra) obraNome = formatObraNome(foundObra);

                const msgContext = isBasedOnAllocation ? 'desde a chegada na obra' : 'sem abastecer na obra';

                list.push({
                    // ID Dinâmico ou acoplado ao backend se existir
                    id: backendAlert ? `inat-${backendAlert.id}` : `inat-dyn-${v.id}`,
                    category: 'inatividade', 
                    type: 'danger', 
                    title: `${v.registroInterno} - Inatividade`,
                    subtitle: obraNome,
                    message: `Parado há ${daysInactive} dias ${msgContext}. Último registro: ${lastRefuelDate.toLocaleDateString('pt-BR')}`,
                    date: lastRefuelDate.toLocaleDateString('pt-BR'),
                    action: () => {
                        // Se o alerta for gerado dinamicamente, criamos um mock compatível com o Modal
                        const alertToPass = backendAlert || {
                            id: 'novo',
                            vehicleId: v.id,
                            obraId: v.obraAtualId,
                            vehicle: v,
                            obra: foundObra,
                            lastRefuelingDate: lastRefuelDate.toISOString(),
                            daysSinceLastRefuel: daysInactive,
                            status: 'Ativo'
                        };
                        setSelectedInactivityAlert(alertToPass);
                    }
                });
            }
        });

        // 3. Alertas de Funcionários (CNH)
        if (Array.isArray(employees)) {
            employees.forEach(emp => {
                // Filtro para apresentar APENAS funcionários Ativos
                if (emp.status && emp.status.toUpperCase() !== 'ATIVO') return;

                const cnhDateRaw = emp.cnhVencimento || emp.validadeCNH;

                if (cnhDateRaw) {
                    let validade;
                    if (typeof cnhDateRaw === 'string' && cnhDateRaw.includes('-')) {
                         const parts = cnhDateRaw.split('T')[0].split('-');
                         if (parts.length === 3) {
                             validade = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
                         } else {
                             validade = new Date(cnhDateRaw);
                         }
                    } else {
                        validade = new Date(cnhDateRaw);
                    }
                    
                    if (!isNaN(validade.getTime())) {
                        validade.setHours(0, 0, 0, 0);
                        const validadeTime = validade.getTime();
                        const nowTime = now.getTime();
                        const thirtyDaysTime = thirtyDays.getTime();

                        if (validadeTime < nowTime) {
                            list.push({
                                id: `emp-cnh-${emp.id}`,
                                category: 'cnh',
                                type: 'danger',
                                title: `CNH VENCIDA: ${emp.nome}`,
                                subtitle: 'Habilitação',
                                message: `Venceu em ${validade.toLocaleDateString('pt-BR')}.`,
                                date: validade.toLocaleDateString('pt-BR'),
                                action: () => navigate('employees')
                            });
                        } else if (validadeTime <= thirtyDaysTime) {
                            list.push({
                                id: `emp-cnh-${emp.id}`,
                                category: 'cnh',
                                type: 'warning',
                                title: `CNH a Vencer: ${emp.nome}`,
                                subtitle: 'Habilitação',
                                message: `Vence em ${validade.toLocaleDateString('pt-BR')}.`,
                                date: validade.toLocaleDateString('pt-BR'),
                                action: () => navigate('employees')
                            });
                        }
                    }
                }

                // Toxicológico
                const toxRaw = emp.exameToxicologicoVencimento;
                if (toxRaw) {
                    let toxVenc;
                    if (typeof toxRaw === 'string' && toxRaw.includes('-')) {
                        const parts = toxRaw.split('T')[0].split('-');
                        if (parts.length === 3) {
                            toxVenc = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
                        } else {
                            toxVenc = new Date(toxRaw);
                        }
                    } else {
                        toxVenc = new Date(toxRaw);
                    }

                    if (!isNaN(toxVenc.getTime())) {
                        toxVenc.setHours(0, 0, 0, 0);
                        const toxTime = toxVenc.getTime();

                        if (toxTime < now.getTime()) {
                            list.push({
                                id: `emp-tox-${emp.id}`,
                                category: 'cnh',
                                type: 'danger',
                                title: `Toxicológico VENCIDO: ${emp.nome}`,
                                subtitle: 'Exame Toxicológico',
                                message: `Venceu em ${toxVenc.toLocaleDateString('pt-BR')}.`,
                                date: toxVenc.toLocaleDateString('pt-BR'),
                                action: () => navigate('employees')
                            });
                        } else if (toxTime <= thirtyDays.getTime()) {
                            list.push({
                                id: `emp-tox-${emp.id}`,
                                category: 'cnh',
                                type: 'warning',
                                title: `Toxicológico a Vencer: ${emp.nome}`,
                                subtitle: 'Exame Toxicológico',
                                message: `Vence em ${toxVenc.toLocaleDateString('pt-BR')}.`,
                                date: toxVenc.toLocaleDateString('pt-BR'),
                                action: () => navigate('employees')
                            });
                        }
                    }
                }
            });
        }

        return list.sort((a, b) => {
            if (a.type === 'danger' && b.type !== 'danger') return -1;
            if (a.type !== 'danger' && b.type === 'danger') return 1;
            return 0;
        });
    }, [vehicles, employees, inactivityAlerts, revisions, navigate, setSelectedInactivityAlert, obras, refuelings]);

    const filteredAlerts = activeTab === 'todos' ? alerts : alerts.filter(a => a.category === activeTab);

    const counts = {
        todos: alerts.length,
        manutencao: alerts.filter(a => a.category === 'manutencao').length,
        docs_veiculo: alerts.filter(a => a.category === 'docs_veiculo').length,
        cnh: alerts.filter(a => a.category === 'cnh').length,
        inatividade: alerts.filter(a => a.category === 'inatividade').length
    };

    const tabs = [
        { id: 'todos', label: 'Todos', icon: <Bell size={14}/> },
        { id: 'manutencao', label: 'Manutenção', icon: <Wrench size={14}/> },
        { id: 'inatividade', label: 'Inatividade', icon: <Timer size={14}/> },
        { id: 'cnh', label: 'CNH', icon: <Badge size={14}/> },
        { id: 'docs_veiculo', label: 'Docs Veíc.', icon: <FileText size={14}/> },
    ];

    const colors = {
        danger: 'bg-red-50 border-l-red-500 text-red-900',
        warning: 'bg-yellow-50 border-l-yellow-500 text-yellow-900',
        info: 'bg-blue-50 border-l-blue-500 text-blue-900',
        success: 'bg-green-50 border-l-green-500 text-green-900'
    };

    const icons = {
        danger: <AlertTriangle size={18} className="text-red-500" />,
        warning: <AlertTriangle size={18} className="text-yellow-500" />,
        info: <ShieldAlert size={18} className="text-blue-500" />,
    };

    return (
        <div className="bg-white rounded-xl h-full flex flex-col overflow-hidden" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)' }}>
            <div className="p-4 flex justify-between items-center shrink-0" style={{ borderBottom: '1px solid #f0ebe3', background: '#faf9f7' }}>
                <h3 className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14' }}>
                    <Bell size={16} style={{ color: '#9E7A42' }}/> Central de Alertas
                </h3>
                <span style={{ background: '#fdf0ec', color: '#b03828', border: '1px solid #e8c8bc', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{alerts.length}</span>
            </div>

            {/* Abas */}
            <div className="flex shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid #f0ebe3' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex-1 py-2.5 flex items-center justify-center gap-1 transition-colors whitespace-nowrap px-2"
                        style={{
                            fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                            borderBottom: activeTab === tab.id ? '2px solid #9E7A42' : '2px solid transparent',
                            color: activeTab === tab.id ? '#9E7A42' : '#9a8a78',
                            background: activeTab === tab.id ? '#fdf8f0' : 'transparent',
                        }}
                    >
                        {tab.icon} {tab.label}
                        {counts[tab.id] > 0 && <span style={{ marginLeft: 4, fontSize: 10, padding: '1px 5px', borderRadius: 9999, background: activeTab === tab.id ? '#fde68a' : '#f0ebe3', color: activeTab === tab.id ? '#78350f' : '#9a8a78' }}>{counts[tab.id]}</span>}
                    </button>
                ))}
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {filteredAlerts.length > 0 ? filteredAlerts.map((alert) => {
                    return (
                        <div 
                            key={alert.id} 
                            onClick={alert.action}
                            className={`p-3 rounded-lg border-l-4 shadow-sm cursor-pointer transition-all flex items-start gap-3 border border-gray-100 ${colors[alert.type]} hover:opacity-90`}
                        >
                            <div className="mt-0.5 shrink-0">{icons[alert.type]}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-xs font-bold text-gray-800 truncate pr-2">{alert.title}</h4>
                                    <span className="text-[9px] bg-white bg-opacity-50 px-1.5 py-0.5 rounded text-gray-600 shrink-0 border border-gray-200">{alert.date}</span>
                                </div>
                                <p className="text-[10px] font-semibold opacity-70 uppercase tracking-wide mb-0.5">{alert.subtitle}</p>
                                <p className="text-xs leading-snug">{alert.message}</p>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                        <CheckCircle size={32} className="mb-2 text-green-100"/>
                        <p className="text-xs">Nenhum alerta nesta categoria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertsPanel;