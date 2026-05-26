import React, { useState, useEffect, lazy, Suspense } from 'react'; 
import { 
    LogOut, HardHat, Building, Clock, Truck, 
    ChevronLeft, ChevronRight, Bell, Wrench, Fuel, Droplet, DollarSign, ShieldAlert,
    User, Shield, CalendarClock, ShoppingCart, Loader, X, Disc, ClipboardCheck, FileText, Key, UserPlus, Smartphone, TrendingUp, Package 
} from 'lucide-react';

// Importação do Socket.io Client
import { io } from "socket.io-client";

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';

// LoginScreen carrega de forma síncrona (necessário antes do login, sem autenticação)
import LoginScreen from './components/LoginScreen'; 

import apiClient from './services/apiClient'; 
import { 
    vehicleGroups, 
    extraObraOptions, 
    operationalSubGroups, 
    equipmentTypesForHours, 
    getVehicleMainReading
} from './utils/vehicleRules';

// ==========================================
// Lazy Loading de Páginas (Code Splitting)
// O bundle inicial fica enxuto — cada página só
// é baixada quando o usuário navegar até ela.
// ==========================================
const Dashboard                    = lazy(() => import('./pages/Dashboard'));
const ObrasPage                    = lazy(() => import('./pages/ObrasPage'));
const PartnersPage                 = lazy(() => import('./pages/PartnersPage'));
const RefuelingPage                = lazy(() => import('./pages/RefuelingPage'));
const ComboioPage                  = lazy(() => import('./pages/ComboioPage'));
const ExpensesPage                 = lazy(() => import('./pages/ExpensesPage'));
const EmployeesPage                = lazy(() => import('./pages/EmployeesPage'));
const ReportsPage                  = lazy(() => import('./pages/ReportsPage'));
const FinesPage                    = lazy(() => import('./pages/FinesPage'));
const VehiclePage                  = lazy(() => import('./pages/VehiclePage'));
const RevisionsPage                = lazy(() => import('./pages/RevisionsPage'));
const DiarioDeBordoPage            = lazy(() => import('./pages/DiarioDeBordoPage'));
const AdminPage                    = lazy(() => import('./pages/AdminPage'));
const ControleDiarioPage           = lazy(() => import('./pages/ControleDiarioPage'));
const OrdersPage                   = lazy(() => import('./pages/OrdersPage'));
const InventoryPage                = lazy(() => import('./pages/InventoryPage'));
const TiresPage                    = lazy(() => import('./pages/TiresPage'));
const BillingPage                  = lazy(() => import('./pages/BillingPage'));
const OperacionalPage              = lazy(() => import('./pages/OperacionalPage'));
const SupervisorDashboard          = lazy(() => import('./pages/SupervisorDashboard'));
const SupervisorObraDetail         = lazy(() => import('./pages/SupervisorObraDetail'));
const SolicitacaoAbastecimentoPage = lazy(() => import('./pages/SolicitacaoAbastecimentoPage'));
const AdminSolicitacoesPage        = lazy(() => import('./pages/AdminSolicitacoesPage'));

// ==========================================
// Fallback de Carregamento de Página
// Reutiliza o mesmo Loader amarelo do sistema
// ==========================================
const PageFallback = () => (
    <div className="flex items-center justify-center h-full text-lg font-semibold text-gray-500">
        <Loader size={32} className="animate-spin mr-3 text-yellow-500" /> Carregando...
    </div>
);

// ==========================================
// Modais Globais
// ==========================================

const CustomAlert = ({ message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md text-center">
            <pre className="text-base mb-6 whitespace-pre-wrap text-left font-sans text-gray-700">{message}</pre>
            <button onClick={onClose} className="py-2 px-6 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-500 transition-colors">OK</button>
        </div>
    </div>
);

const ConfirmationModal = ({ title, message, onConfirm, onClose, confirmText = 'Confirmar', cancelText = 'Cancelar', confirmColor = 'bg-yellow-400 hover:bg-yellow-500 text-gray-900' }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90]">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-3 text-gray-800">{title}</h3>
            <p className="text-gray-600 mb-6 text-sm">{message}</p>
            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium">{cancelText}</button>
                <button onClick={onConfirm} className={`px-4 py-2 rounded-lg text-sm font-semibold ${confirmColor}`}>{confirmText}</button>
            </div>
        </div>
    </div>
);

const PasswordConfirmationModal = ({ onConfirm, onClose, message, apiClient }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const handleConfirm = async () => {
        setIsVerifying(true);
        setError('');
        try {
            await apiClient.validatePassword(password);
            await onConfirm(); 
            onClose(); 
        } catch (err) {
            setError(err.message || "Senha incorreta.");
        } finally {
            setIsVerifying(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90]">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-3 text-gray-800">Confirmação de Segurança</h3>
                <p className="text-gray-600 mb-4 text-sm">{message || "Insira sua senha para confirmar esta operação sensível."}</p>
                <div className="mb-4">
                    <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" 
                        placeholder="Sua senha"
                        autoFocus
                    />
                </div>
                {error && <p className="text-xs text-red-600 mb-3 font-medium">{error}</p>}
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">Cancelar</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={isVerifying} 
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 flex items-center gap-2 text-sm font-semibold"
                    >
                        {isVerifying && <Loader size={14} className="animate-spin" />}
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

const ChangePasswordModal = ({ isOpen, onClose, apiClient }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if(isOpen) {
            setCurrentPassword(''); 
            setNewPassword(''); 
            setConfirmPassword(''); 
            setMessage(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As novas senhas não conferem.' });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'A nova senha deve ter no mínimo 6 caracteres.' });
            return;
        }

        setLoading(true);
        try {
            await apiClient.changePassword({ currentPassword, newPassword });
            setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
            setTimeout(() => { onClose(); }, 1500);
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Erro ao alterar senha.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110]">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-lg font-bold text-gray-800">Alterar Senha</h2>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                </div>
                
                {message && (
                    <div className={`p-2 mb-3 rounded text-sm text-center ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase">Senha Atual</label>
                        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full p-2 border rounded focus:border-yellow-500 outline-none" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase">Nova Senha</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 border rounded focus:border-yellow-500 outline-none" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase">Confirmar Nova Senha</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-2 border rounded focus:border-yellow-500 outline-none" required />
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-bold">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-yellow-400 text-gray-900 rounded hover:bg-yellow-500 text-sm font-bold disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const UpdateMessageModal = ({ message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[99999]"> 
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-xl">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Bell className="text-yellow-500" /> Novidades do Sistema
                 </h2>
                 <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200">
                    <X size={20} />
                 </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[60vh] overflow-y-auto mb-6">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
            </div>
            <button onClick={onClose} className="w-full py-2 px-6 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-500 transition-colors">
                Entendido
            </button>
        </div>
    </div>
);

const AdminPendingRequestAlert = ({ pendingCount, onClose, navigate }) => (
    <div className="fixed bottom-4 right-4 z-[99999] bg-white border-l-4 border-blue-500 shadow-2xl rounded-lg p-4 max-w-sm animate-bounce-in">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                    <UserPlus size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-800">Solicitações Pendentes</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Há <strong className="text-blue-600">{pendingCount}</strong> novos usuários aguardando aprovação.
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
            <button onClick={onClose} className="text-sm text-gray-500 hover:underline px-2">Agora não</button>
            <button 
                onClick={() => { onClose(); navigate('admin'); }} 
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 font-semibold transition-colors"
            >
                Ver Solicitações
            </button>
        </div>
    </div>
);


// ==========================================
// Conteúdo Principal (App Content)
// ==========================================

const AppContent = () => {
    const { user, logout } = useAuth(); 
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [pageFilter, setPageFilter] = useState(null); 
    const [alertMessage, setAlertMessage] = useState(''); 
    const [selectedObraId, setSelectedObraId] = useState(null);

    // Estados Globais de Dados
    const [vehicles, setVehicles] = useState([]);
    const [obras, setObras] = useState([]);
    const [revisions, setRevisions] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [rawPartners, setRawPartners] = useState([]); 
    const [refuelings, setRefuelings] = useState([]);
    const [rawComboioTransactions, setRawComboioTransactions] = useState([]);
    const [rawFines, setRawFines] = useState([]);
    const [diarioDeBordoLogs, setDiarioDeBordoLogs] = useState([]);
    const [dailyWorkLogs, setDailyWorkLogs] = useState([]); 
    const [orders, setOrders] = useState([]); // NOVO ESTADO DAS ORDENS DE SERVIÇO
    
    // Estados de Interface e Modais
    const [loadingData, setLoadingData] = useState(true); 
    const [updateMessage, setUpdateMessage] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false); 
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0); 
    const [pendingSolicitacoesCount, setPendingSolicitacoesCount] = useState(0);
    
    // Estado para os alertas em Real-Time da Agenda
    const [agendaAlerts, setAgendaAlerts] = useState([]);

    // Instância do socket.io (para passar a componentes que precisam ouvir eventos)
    const [socketInstance, setSocketInstance] = useState(null);

    // Implementação do Socket.io
    useEffect(() => {
        const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const cleanSocketUrl = SOCKET_URL.replace('/api', '');

        const socket = io(cleanSocketUrl, {
            transports: ['websocket', 'polling']
        });

        setSocketInstance(socket);

        socket.on('connect', () => {
            console.log("🟢 Conectado ao servidor Socket.io");
        });

        // Ouvinte de Alertas da Agenda
        socket.on('agenda:alerta', (data) => {
            if (!user) return;
            const currentUserId = String(user.uid || user.id);
            const eventUserId = String(data.userId);

            if (currentUserId === eventUserId) {
                // Tenta tocar o bipe, se não conseguir apenas exibe visualmente
                try {
                    const audio = new Audio('/beep.mp3'); 
                    audio.play().catch(e => console.warn('Sem interação para áudio.', e)); 
                } catch(e) {
                    console.warn('Erro ao reproduzir áudio.', e);
                }
                
                setAgendaAlerts(prev => [...prev, data]);
            }
        });

        // Ouvinte de Sincronização em Lote
        socket.on('server:sync', async ({ targets }) => {
            if (!targets || !Array.isArray(targets)) return;

            const updateActions = {
                'vehicles': () => apiClient.getVehicles().then(setVehicles),
                'obras': () => apiClient.getObras().then(setObras),
                'employees': () => apiClient.getEmployees().then(setEmployees),
                'revisions': () => { 
                    if(user.user_type !== 'operador') {
                        return apiClient.getRevisions().then(setRevisions);
                    }
                },
                'partners': () => apiClient.getPartners().then(setRawPartners), 
                'orders': () => {
                    if (user.user_type !== 'operador' && typeof apiClient.getAllOrders === 'function') {
                        return apiClient.getAllOrders().then(setOrders);
                    }
                },
                'refuelings': () => { 
                    if(user.podeAcessarAbastecimento || user.user_type === 'admin') {
                        return apiClient.getRefuelings().then(setRefuelings);
                    }
                },
                'comboio': () => { 
                    if(user.podeAcessarAbastecimento || user.user_type === 'admin') {
                        return apiClient.getComboioTransactions().then(setRawComboioTransactions);
                    }
                },
                'fines': () => { 
                    if(user.user_type !== 'operador') {
                        return apiClient.getFines().then(setRawFines);
                    }
                },
                'dailyWorkLogs': () => { 
                    if(user.user_type !== 'operador') {
                        return apiClient.getDailyLogs('all').then(setDailyWorkLogs);
                    }
                },
                'expenses': () => { 
                    if(user.user_type !== 'operador') {
                        return apiClient.getExpenses().then(setExpenses);
                    }
                },
                'solicitacoes': () => { 
                    if (user.user_type === 'admin' || user.podeAcessarAbastecimento) {
                         return apiClient.get('/solicitacoes?status=PENDENTE')
                            .then(res => {
                                const data = Array.isArray(res) ? res : (res.data || []);
                                if (Array.isArray(data)) {
                                    setPendingSolicitacoesCount(data.filter(s => s.status === 'PENDENTE' || s.status === 'AGUARDANDO_BAIXA').length);
                                }
                            }).catch(console.error);
                    }
                }
            };

            for (const target of targets) {
                if (updateActions[target]) {
                    try { 
                        await updateActions[target](); 
                    } catch (error) { 
                        console.error(`Erro ao sincronizar target ${target}:`, error); 
                    }
                }
            }
        });

        // Ouvinte de Notificações Administrativas
        socket.on('admin:notificacao', (data) => {
            if (user.user_type === 'admin' || user.podeAcessarAbastecimento) {
                if (data.tipo === 'nova_solicitacao' || data.tipo === 'baixa_pendente') {
                    try { 
                        const audio = new Audio('/beep.mp3'); 
                        audio.play().catch(e => console.warn('Sem interação', e)); 
                    } catch(e) {}
                    
                    setPendingSolicitacoesCount(prev => prev + 1);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log("🔴 Desconectado do servidor Socket.io");
        });

        return () => {
            socket.disconnect();
            setSocketInstance(null);
        };
    }, [user]);

    // Memorizações de Dados para Otimização de Performance
    const partners = React.useMemo(() => {
        return [...rawPartners].sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || ''));
    }, [rawPartners]);

    const comboioTransactions = React.useMemo(() => {
        return [...rawComboioTransactions].sort((a, b) => (new Date(b.date).getTime()) - (new Date(a.date).getTime()));
    }, [rawComboioTransactions]);

    const fines = React.useMemo(() => {
        return [...rawFines].sort((a, b) => (new Date(b.dataInfracao).getTime()) - (new Date(a.dataInfracao).getTime()));
    }, [rawFines]);

    // Processamento de Alertas de Veículos
    const processVehiclesWithAlerts = (vehiclesData, revisionsData, finesData) => {
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        return vehiclesData.map(vehicle => {
            let hasAlert = false;
            let alertText = '';

            // Bloqueio de Circulação
            if (vehicle.canCirculate === false || vehicle.canCirculate === 0 || vehicle.canCirculate === '0') { 
                hasAlert = true; 
                alertText = `BLOQUEIO: O veículo não pode rodar (Doc/Manutenção).`;
            }

            // Revisões
            const revision = revisionsData.find(r => r.vehicleId === vehicle.id); 
            if (revision && !hasAlert) {
                const proximaData = revision.proximaRevisaoData ? new Date(revision.proximaRevisaoData) : null;
                const proximoOdometro = revision.proximaRevisaoOdometro;
                const proximoHorimetro = revision.proximaRevisaoHorimetro;
                
                const readingData = getVehicleMainReading(vehicle); 
                const currentReading = readingData.raw;
                const unit = readingData.unit;

                const avisoAntecedencia = parseFloat(revision.avisoAntecedenciaKmHr || 0);
                const avisoDias = parseInt(revision.avisoAntecedenciaDias || 0);
                
                let metaLeitura = unit === 'Hr' ? proximoHorimetro : proximoOdometro;
                if (!metaLeitura && unit === 'Hr' && proximoOdometro) metaLeitura = proximoOdometro; 

                if (proximaData && now >= proximaData) {
                    hasAlert = true; 
                    alertText = 'Atenção: Revisão Vencida (Data)!';
                } else if (proximaData && avisoDias > 0) {
                     const warningDate = new Date(proximaData);
                     warningDate.setDate(warningDate.getDate() - avisoDias);
                     if (now >= warningDate) { 
                         hasAlert = true; 
                         alertText = 'Atenção: Revisão Próxima (Data)!'; 
                     }
                }

                if (!hasAlert && metaLeitura > 0) {
                     if (currentReading >= metaLeitura) {
                         hasAlert = true; 
                         alertText = `Atenção: Revisão Vencida (${unit})!`;
                     } else if (avisoAntecedencia > 0 && currentReading >= (metaLeitura - avisoAntecedencia)) {
                         hasAlert = true; 
                         alertText = `Atenção: Revisão Próxima (${unit})!`;
                     }
                }
            }

            // Documentos
            const isTruck = vehicleGroups['Caminhões'].includes(vehicle.tipo) || vehicleGroups['Caminhões de Trecho'].includes(vehicle.tipo);
            if (isTruck && !hasAlert) {
                const docs = [
                    { type: 'Tacógrafo', date: vehicle.validadeTacografo },
                    { type: 'AET DAER', date: vehicle.validadeAET_DAER },
                    { type: 'AET DNIT', date: vehicle.validadeAET_DNIT },
                ];
                
                for (const doc of docs) {
                    if (doc.date) {
                        const d = new Date(doc.date);
                        const compareDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()); 
                        if (now > compareDate) {
                            hasAlert = true; 
                            alertText = `Atenção: ${doc.type} Vencido!`; 
                            break; 
                        } else if (compareDate <= thirtyDaysFromNow) {
                            hasAlert = true; 
                            alertText = `Atenção: ${doc.type} Vence em breve!`;
                        }
                    }
                }
            }
            
            // Multas
            const hasPendingFine = finesData.some(fine => fine.vehicleId === vehicle.id && fine.paymentStatus === 'Pendente'); 
            if(hasPendingFine && !hasAlert) { 
                hasAlert = true; 
                alertText = 'Atenção: Há multas pendentes para este veículo.'; 
            }

            return { ...vehicle, possuiAviso: hasAlert, avisoTexto: alertText };
        });
    };

    const processedVehicles = React.useMemo(() => {
        return processVehiclesWithAlerts(vehicles, revisions || [], fines || []);
    }, [vehicles, revisions, fines]);

    const navigate = (page, filter = null) => { 
        setCurrentPage(page); 
        setPageFilter(filter); 
    };

    const handleNavigateToObra = (obraId) => { 
        setSelectedObraId(obraId); 
        setCurrentPage('supervisor_detail'); 
    };

    // Carregamento de Todos os Dados
    const loadAllData = React.useCallback(async () => {
        if (!user) { 
            setLoadingData(false); 
            return; 
        }
        
        setLoadingData(true);
        setAlertMessage(''); 

        const dataEndpoints = {
            vehicles: { getter: apiClient.getVehicles, setter: setVehicles },
            obras: { getter: apiClient.getObras, setter: setObras },
            revisions: { getter: apiClient.getRevisions, setter: setRevisions },
            expenses: { getter: apiClient.getExpenses, setter: setExpenses },
            employees: { getter: apiClient.getEmployees, setter: setEmployees },
            partners: { getter: apiClient.getPartners, setter: setRawPartners },
            refuelings: { getter: apiClient.getRefuelings, setter: setRefuelings },
            comboioTransactions: { getter: apiClient.getComboioTransactions, setter: setRawComboioTransactions },
            fines: { getter: apiClient.getFines, setter: setRawFines },
            diarioDeBordo: { getter: apiClient.getDiarioDeBordo, setter: setDiarioDeBordoLogs },
            dailyWorkLogs: { getter: () => apiClient.getDailyLogs('all'), setter: setDailyWorkLogs },
            orders: { getter: apiClient.getAllOrders, setter: setOrders } // Busca as ordens (o apiClient pode usar getAllOrders ou getOrders dependendo de como você definiu)
        };

        if (user.user_type === 'operador') { 
            delete dataEndpoints.revisions; 
            delete dataEndpoints.expenses; 
            delete dataEndpoints.comboioTransactions;
            delete dataEndpoints.fines; 
            delete dataEndpoints.dailyWorkLogs;
            delete dataEndpoints.orders;
        }

        try {
            const promises = Object.values(dataEndpoints).map(endpoint => {
                if (typeof endpoint.getter === 'function') {
                    return endpoint.getter().catch(e => null);
                }
                return Promise.resolve(null);
            });
            const results = await Promise.all(promises);

            Object.keys(dataEndpoints).forEach((key, index) => {
                if (results[index] !== null) {
                    dataEndpoints[key].setter(results[index]);
                }
            });

            // Tratativas Adicionais de Admin / Atualizações do Sistema
            if (user.user_type === 'admin') {
                try {
                    const updateMsg = await apiClient.adminGetUpdateMessage();
                    if (updateMsg && updateMsg.showPopup) { 
                        setUpdateMessage(updateMsg.message); 
                        setShowUpdateModal(true); 
                    }
                } catch (e) {
                    console.warn("Erro ao buscar mensagem de update:", e);
                }

                try {
                    const requests = await apiClient.adminGetRegistrationRequests();
                    setPendingRequestsCount(requests && requests.length > 0 ? requests.length : 0);
                } catch (e) {
                    console.warn("Erro ao buscar requisições de cadastro:", e);
                }
            } else if (user.user_type !== 'operador') {
                 try {
                    const updateMsg = await apiClient.adminGetUpdateMessage();
                    if (updateMsg && updateMsg.showPopup) { 
                        setUpdateMessage(updateMsg.message); 
                        setShowUpdateModal(true); 
                    }
                } catch (e) {
                    console.warn("Erro ao buscar mensagem de update:", e);
                }
            }

            // Busca solicitações pendentes no carregamento inicial
            if (user.user_type === 'admin' || user.podeAcessarAbastecimento) {
                 try {
                     const res = await apiClient.get('/solicitacoes');
                     const data = Array.isArray(res) ? res : (res.data || []);
                     if (Array.isArray(data)) {
                         setPendingSolicitacoesCount(data.filter(s => s.status === 'PENDENTE' || s.status === 'AGUARDANDO_BAIXA').length);
                     }
                 } catch(e) {
                     console.warn("Erro ao carregar quantidade de solicitações:", e);
                 }
            }
        } catch (error) {
            console.error("Erro Fatal API no carregamento de dados:", error);
            setAlertMessage("Erro de conexão com o servidor. Alguns dados podem não ter sido carregados.");
            if (error.message.includes('401')) {
                logout();
            }
        } finally {
            setLoadingData(false);
        }
    }, [user, logout]); 

    useEffect(() => { 
        loadAllData(); 
    }, [loadAllData]);

    // Renderização Especial para Perfil de Operador
    if (user && user.user_type === 'operador') { 
        if (loadingData) {
            return (
                <div className="flex justify-center items-center h-screen">
                    <Loader className="animate-spin text-yellow-500" size={40} />
                </div>
            );
        }
        return (
            <Suspense fallback={<PageFallback />}>
                <SolicitacaoAbastecimentoPage 
                    apiClient={apiClient} 
                    user={user} 
                    vehicles={vehicles} 
                    obras={obras} 
                    partners={partners} 
                    setAlertMessage={setAlertMessage} 
                />
            </Suspense>
        );
    }

    const renderPage = () => {
        const commonProps = { 
            user, 
            setAlertMessage, 
            PasswordConfirmationModal: (props) => <PasswordConfirmationModal {...props} apiClient={apiClient} />, 
            ConfirmationModal, 
            vehicleGroups, 
            extraObraOptions, 
            equipmentTypesForHours, 
            operationalSubGroups,
            apiClient, 
            reloadData: loadAllData, 
            navigate, 
            vehicles: processedVehicles, 
            obras, 
            revisions, 
            expenses, 
            employees, 
            partners, 
            refuelings, 
            comboioTransactions, 
            fines, 
            diarioDeBordoLogs, 
            dailyWorkLogs,
            orders, // Agora repassando as Ordens Globalmente
            socket: socketInstance
        };

        const Denied = () => (
            <div className="p-10 text-center text-red-500 font-bold bg-white rounded shadow m-4">
                Acesso Negado
            </div>
        );

        switch (currentPage) {
            case 'dashboard': 
                return <Dashboard {...commonProps} />;
            case 'supervisor_dashboard': 
                return <SupervisorDashboard {...commonProps} onNavigateToDetail={handleNavigateToObra} />;
            case 'supervisor_detail': 
                return <SupervisorObraDetail obraId={selectedObraId} onBack={() => setCurrentPage('supervisor_dashboard')} />;
            case 'vehicles': 
                return <VehiclePage {...commonProps} initialFilter={pageFilter} />;
            case 'obras': 
                return <ObrasPage {...commonProps} initialFilter={pageFilter} />;
            case 'billing':
                return <BillingPage {...commonProps} initialFilter={pageFilter} />;
            case 'operacional':
                return <OperacionalPage {...commonProps} />;
            case 'controleDiario': 
                return <ControleDiarioPage {...commonProps} />;
            case 'revisions': 
                return <RevisionsPage {...commonProps} />;
            case 'partners': 
                return <PartnersPage {...commonProps} />;
            case 'refueling': 
                return (user.podeAcessarAbastecimento || user.user_type === 'admin') ? <RefuelingPage {...commonProps} /> : <Denied />;
            case 'admin_solicitacoes': 
                return (user.podeAcessarAbastecimento || user.user_type === 'admin') ? <AdminSolicitacoesPage {...commonProps} /> : <Denied />;
            case 'orders': 
                return <OrdersPage {...commonProps} />; 
            case 'inventory': 
                return <InventoryPage {...commonProps} />; 
            case 'comboio': 
                return (user.podeAcessarAbastecimento || user.user_type === 'admin') ? <ComboioPage {...commonProps} /> : <Denied />;
            case 'expenses': 
                return <ExpensesPage {...commonProps} />;
            case 'employees': 
                return <EmployeesPage {...commonProps} />;
            case 'fines': 
                return <FinesPage {...commonProps} />;
            case 'tires': 
                return <TiresPage {...commonProps} revisions={revisions} />; 
            case 'reports': 
                return <ReportsPage {...commonProps} />; 
            case 'admin': 
                return user.user_type === 'admin' ? <AdminPage {...commonProps} /> : <Denied />; 
            default: 
                return <Dashboard {...commonProps} />; 
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 text-gray-800 font-sans overflow-hidden">
            {showUpdateModal && updateMessage && (
                <UpdateMessageModal message={updateMessage} onClose={() => setShowUpdateModal(false)} />
            )}
            
            {/* RENDERIZAÇÃO DOS AVISOS REAL-TIME DA AGENDA */}
            <div className="fixed top-20 right-4 z-[99999] flex flex-col gap-3">
                {agendaAlerts.map((alerta, index) => (
                    <div key={index} className="bg-white border-l-4 border-yellow-500 shadow-2xl rounded-lg p-4 w-80 animate-bounce-in relative">
                        <button 
                            onClick={() => setAgendaAlerts(prev => prev.filter((_, i) => i !== index))} 
                            className="absolute top-2 right-2 text-gray-400 hover:text-gray-800 transition-colors"
                        >
                            <X size={16}/>
                        </button>
                        <div className="flex items-start gap-3 mt-1 text-gray-800">
                            <Bell size={24} className="text-yellow-500 animate-pulse shrink-0" />
                            <div>
                                <h3 className="font-bold text-sm leading-tight">{alerta.title}</h3>
                                <p className="text-xs mt-1 font-medium">{alerta.message}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {pendingRequestsCount > 0 && user.user_type === 'admin' && (
                <AdminPendingRequestAlert 
                    pendingCount={pendingRequestsCount} 
                    onClose={() => setPendingRequestsCount(0)} 
                    navigate={setCurrentPage} 
                />
            )}
            
            <Sidebar 
                currentPage={currentPage} 
                setCurrentPage={setCurrentPage} 
                user={user} 
                logout={logout} 
                onChangePassword={() => setShowChangePasswordModal(true)} 
                pendingSolicitacoesCount={pendingSolicitacoesCount} 
            /> 
            
            <ChangePasswordModal 
                isOpen={showChangePasswordModal} 
                onClose={() => setShowChangePasswordModal(false)} 
                apiClient={apiClient} 
            />

            <main className="flex-1 flex flex-col relative overflow-hidden">
                <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 bg-slate-100 scroll-smooth">
                    {alertMessage && (
                        <CustomAlert message={alertMessage} onClose={() => setAlertMessage('')} />
                    )}
                    
                    {loadingData ? (
                        <div className="flex items-center justify-center h-full text-lg font-semibold text-gray-500">
                            <Loader size={32} className="animate-spin mr-3 text-yellow-500" /> Sincronizando dados...
                        </div>
                    ) : (
                        // Suspense envolve apenas a área de conteúdo (dentro do main),
                        // mantendo a Sidebar sempre visível durante a transição de páginas.
                        <Suspense fallback={<PageFallback />}>
                            {renderPage()}
                        </Suspense>
                    )}
                </div>
            </main>
        </div>
    );
};

// ==========================================
// Roteador e Container Principal
// ==========================================

const AppRouter = () => {
    const { user, loading } = useAuth(); 
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
                <Loader size={40} className="animate-spin text-yellow-500" />
            </div>
        );
    }
    return !user ? <LoginScreen apiClient={apiClient} /> : <AppContent />;
};

export default function AppContainer() {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    );
}
