// src/App.js
//
// ============================================================================
// App.js refatorado — pontos 1 e 2 da análise
// ============================================================================
//
// MUDANÇAS PRINCIPAIS:
//
// 1. ELIMINADO `loadAllData` eager:
//    O carregamento de TODOS os 12 endpoints no login deu lugar ao DataContext,
//    que carrega só o ESSENCIAL no boot (vehicles, obras, employees, partners)
//    e busca o resto sob demanda quando cada página é aberta.
//
// 2. ELIMINADO o re-render cascade:
//    Antes, `commonProps` era recriado a cada render como objeto literal novo
//    — qualquer mudança de qualquer um dos 12 estados disparava re-render
//    em toda a árvore. Agora `commonProps` é memoizado, e os modais globais
//    (CustomAlert, ConfirmationModal, PasswordConfirmationModal) também.
//
// 3. PROCESSAMENTO DE ALERTAS OTIMIZADO:
//    A função O(V × R × F) virou O(V + R + F) ao pré-indexar revisions e
//    fines em Maps. Veja src/utils/vehicleAlerts.js.
//
// 4. SOCKET.IO no DataContext:
//    Centralizamos a conexão Socket.io no DataContext. Não há mais lógica
//    duplicada de "refetch tudo" — agora só refazemos fetch dos recursos
//    que JÁ ESTÃO carregados (os outros nem foram puxados ainda).
//
// 5. COMPATIBILIDADE TOTAL:
//    As páginas continuam recebendo as mesmas props que recebiam antes
//    (vehicles, obras, fines, etc.). Não há necessidade de alterar nenhuma
//    página existente.
//
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
    Bell, Loader, X, UserPlus
} from 'lucide-react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import Sidebar from './components/Sidebar';

// LoginScreen carrega de forma síncrona (necessário antes do login)
import LoginScreen from './components/LoginScreen';

import apiClient from './services/apiClient';
import {
    vehicleGroups,
    extraObraOptions,
    operationalSubGroups,
    equipmentTypesForHours,
} from './utils/vehicleRules';
import { processVehiclesWithAlerts } from './utils/vehicleAlerts';

// ==========================================
// Lazy Loading de Páginas (Code Splitting)
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
const SigaSulPage                  = lazy(() => import('./pages/SigaSulPage'));

// ==========================================
// Fallback de Carregamento de Página
// ==========================================
const PageFallback = () => (
    <div className="flex items-center justify-center h-full text-lg font-semibold text-gray-500">
        <Loader size={32} className="animate-spin mr-3 text-yellow-500" /> Carregando...
    </div>
);

// ==========================================
// Modais Globais
// ==========================================

const CustomAlert = React.memo(({ message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md text-center">
            <pre className="text-base mb-6 whitespace-pre-wrap text-left font-sans text-gray-700">{message}</pre>
            <button onClick={onClose} className="py-2 px-6 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-500 transition-colors">OK</button>
        </div>
    </div>
));

const ConfirmationModal = React.memo(({
    title, message, onConfirm, onClose,
    confirmText = 'Confirmar', cancelText = 'Cancelar',
    confirmColor = 'bg-yellow-400 hover:bg-yellow-500 text-gray-900',
}) => (
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
));

const PasswordConfirmationModalRaw = ({ onConfirm, onClose, message, apiClient: apiClientProp }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const client = apiClientProp || apiClient;

    const handleConfirm = async () => {
        setIsVerifying(true);
        setError('');
        try {
            await client.validatePassword(password);
            await onConfirm();
            onClose();
        } catch (err) {
            setError(err.message || 'Senha incorreta.');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90]">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-3 text-gray-800">Confirmação de Segurança</h3>
                <p className="text-gray-600 mb-4 text-sm">{message || 'Insira sua senha para confirmar esta operação sensível.'}</p>
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
const PasswordConfirmationModal = React.memo(PasswordConfirmationModalRaw);

const ChangePasswordModalRaw = ({ isOpen, onClose, apiClient: apiClientProp }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const client = apiClientProp || apiClient;

    useEffect(() => {
        if (isOpen) {
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
            await client.changePassword({ currentPassword, newPassword });
            setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
            setTimeout(onClose, 1500);
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Erro ao alterar senha.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Alterar Senha</h2>
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
const ChangePasswordModal = React.memo(ChangePasswordModalRaw);

const UpdateMessageModal = React.memo(({ message, onClose }) => (
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
));

const AdminPendingRequestAlert = React.memo(({ pendingCount, onClose, navigate }) => (
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
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
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
));

// ==========================================
// AppContent — conteúdo principal
// ==========================================

const AppContent = () => {
    const { user, logout } = useAuth();
    const {
        vehicles, obras, employees, partners,
        revisions, expenses, refuelings, comboioTransactions, fines,
        diarioDeBordoLogs, dailyWorkLogs, orders,
        bootstrapLoading, syncing,
        reload, ensureAll,
        socket,
    } = useData();

    // ---------- Estados de UI ----------
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [pageFilter, setPageFilter] = useState(null);
    const [alertMessage, setAlertMessage] = useState('');
    const [selectedObraId, setSelectedObraId] = useState(null);

    const [updateMessage, setUpdateMessage] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [pendingSolicitacoesCount, setPendingSolicitacoesCount] = useState(0);

    const [agendaAlerts, setAgendaAlerts] = useState([]);

    // ---------- Avisos auxiliares (não bloqueantes do bootstrap) ----------
    useEffect(() => {
        if (!user || user.user_type === 'operador') return;

        // Mensagem de update (não bloqueia tela)
        apiClient.adminGetUpdateMessage?.()
            .then(msg => {
                if (msg && msg.showPopup) {
                    setUpdateMessage(msg.message);
                    setShowUpdateModal(true);
                }
            })
            .catch(e => console.warn('Erro ao buscar mensagem de update:', e));

        // Solicitações de cadastro pendentes (somente admin)
        if (user.user_type === 'admin') {
            apiClient.adminGetRegistrationRequests?.()
                .then(reqs => {
                    setPendingRequestsCount(reqs && reqs.length > 0 ? reqs.length : 0);
                })
                .catch(e => console.warn('Erro ao buscar registrationRequests:', e));
        }

        // Solicitações de abastecimento pendentes
        if (user.user_type === 'admin' || user.podeAcessarAbastecimento) {
            apiClient.get?.('/solicitacoes')
                .then(res => {
                    const data = Array.isArray(res) ? res : (res?.data || []);
                    setPendingSolicitacoesCount(
                        data.filter(s => s.status === 'PENDENTE' || s.status === 'AGUARDANDO_BAIXA').length
                    );
                })
                .catch(e => console.warn('Erro ao carregar solicitações:', e));
        }
    }, [user]);

    // ---------- Socket: eventos específicos do App (agenda, notificações) ----------
    useEffect(() => {
        if (!socket || !user) return;

        const handleAgendaAlert = (data) => {
            const currentUserId = String(user.uid || user.id);
            const eventUserId = String(data.userId);
            if (currentUserId !== eventUserId) return;

            try {
                const audio = new Audio('/beep.mp3');
                audio.play().catch(e => console.warn('Sem interação para áudio.', e));
            } catch (e) {
                console.warn('Erro ao reproduzir áudio.', e);
            }
            setAgendaAlerts(prev => [...prev, data]);
        };

        const handleAdminNotification = (data) => {
            if (user.user_type !== 'admin' && !user.podeAcessarAbastecimento) return;
            if (data.tipo === 'nova_solicitacao' || data.tipo === 'baixa_pendente') {
                try {
                    const audio = new Audio('/beep.mp3');
                    audio.play().catch(e => console.warn('Sem interação', e));
                } catch (e) {}
                setPendingSolicitacoesCount(prev => prev + 1);
            }
        };

        socket.on('agenda:alerta', handleAgendaAlert);
        socket.on('admin:notificacao', handleAdminNotification);

        return () => {
            socket.off('agenda:alerta', handleAgendaAlert);
            socket.off('admin:notificacao', handleAdminNotification);
        };
    }, [socket, user]);

    // ---------- Pré-fetch de recursos por página visitada ----------
    // Define quais recursos extras cada página precisa para funcionar.
    // O DataContext só busca o que ainda não está em cache.
    const PAGE_RESOURCE_REQUIREMENTS = useMemo(() => ({
        dashboard:            ['revisions', 'fines', 'refuelings'],
        vehicles:             ['revisions', 'fines'],
        revisions:            ['revisions'],
        refueling:            ['refuelings', 'revisions'],
        admin_solicitacoes:   ['refuelings'],
        comboio:              ['comboioTransactions', 'refuelings'],
        expenses:             ['expenses'],
        fines:                ['fines'],
        tires:                ['revisions'],
        reports:              ['revisions', 'fines', 'refuelings', 'expenses'],
        controleDiario:       ['dailyWorkLogs', 'diarioDeBordoLogs'],
        billing:              ['dailyWorkLogs', 'refuelings', 'expenses'],
        orders:               ['orders'],
        obras:                ['revisions'],
        operacional:          [],
        supervisor_dashboard: ['revisions', 'fines'],
        supervisor_detail:    ['revisions', 'fines', 'refuelings', 'expenses'],
    }), []);

    useEffect(() => {
        const needed = PAGE_RESOURCE_REQUIREMENTS[currentPage];
        if (needed && needed.length > 0) {
            ensureAll(needed);
        }
    }, [currentPage, ensureAll, PAGE_RESOURCE_REQUIREMENTS]);

    // ---------- Veículos com alertas (memoizado, agora O(V+R+F)) ----------
    const processedVehicles = useMemo(
        () => processVehiclesWithAlerts(vehicles, revisions, fines),
        [vehicles, revisions, fines]
    );

    // ---------- Navigate helpers ----------
    const navigate = useCallback((page, filter = null) => {
        setCurrentPage(page);
        setPageFilter(filter);
    }, []);

    const handleNavigateToObra = useCallback((obraId) => {
        setSelectedObraId(obraId);
        setCurrentPage('supervisor_detail');
    }, []);

    // ---------- Modal injection (PasswordConfirmationModal com apiClient pré-injetado) ----------
    const PasswordConfirmationModalWrapped = useMemo(
        () => (props) => <PasswordConfirmationModal {...props} apiClient={apiClient} />,
        []
    );

    // ---------- commonProps memoizado ----------
    // Evita re-renders em cascata: filhos só re-renderizam quando o
    // objeto commonProps realmente muda.
    const commonProps = useMemo(() => ({
        user,
        setAlertMessage,
        PasswordConfirmationModal: PasswordConfirmationModalWrapped,
        ConfirmationModal,
        vehicleGroups,
        extraObraOptions,
        equipmentTypesForHours,
        operationalSubGroups,
        apiClient,
        reloadData: reload,
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
        orders,
        socket,
    }), [
        user,
        PasswordConfirmationModalWrapped,
        reload, navigate,
        processedVehicles, obras, revisions, expenses, employees, partners,
        refuelings, comboioTransactions, fines, diarioDeBordoLogs, dailyWorkLogs, orders,
        socket,
    ]);

    const closeAgendaAlert = useCallback((index) => {
        setAgendaAlerts(prev => prev.filter((_, i) => i !== index));
    }, []);

    // ---------- Operador: rota especial ----------
    if (user && user.user_type === 'operador') {
        if (bootstrapLoading) {
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
                    socket={socket}
                />
            </Suspense>
        );
    }

    // ---------- Renderização de página ----------
    const Denied = () => (
        <div className="p-10 text-center text-red-500 font-bold bg-white rounded shadow m-4">
            Acesso Negado
        </div>
    );

    const renderPage = () => {
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
                return (user.podeAcessarAbastecimento || user.user_type === 'admin')
                    ? <RefuelingPage {...commonProps} /> : <Denied />;
            case 'admin_solicitacoes':
                return (user.podeAcessarAbastecimento || user.user_type === 'admin')
                    ? <AdminSolicitacoesPage {...commonProps} /> : <Denied />;
            case 'orders':
                return <OrdersPage {...commonProps} />;
            case 'inventory':
                return <InventoryPage {...commonProps} />;
            case 'comboio':
                return (user.podeAcessarAbastecimento || user.user_type === 'admin')
                    ? <ComboioPage {...commonProps} /> : <Denied />;
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
            case 'sigasul':
                return user.user_type === 'admin' ? <SigaSulPage {...commonProps} /> : <Denied />;
            default:
                return <Dashboard {...commonProps} />; 
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 text-gray-800 font-sans overflow-hidden">
            {showUpdateModal && updateMessage && (
                <UpdateMessageModal message={updateMessage} onClose={() => setShowUpdateModal(false)} />
            )}

            {/* Avisos Real-Time da Agenda */}
            <div className="fixed top-20 right-4 z-[99999] flex flex-col gap-3">
                {agendaAlerts.map((alerta, index) => (
                    <div key={`${alerta.id || index}-${index}`} className="bg-white border-l-4 border-yellow-500 shadow-2xl rounded-lg p-4 w-80 animate-bounce-in relative">
                        <button
                            onClick={() => closeAgendaAlert(index)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-gray-800 transition-colors"
                        >
                            <X size={16} />
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

                    {/* Indicador discreto de sync em background */}
                    {syncing && (
                        <div className="fixed bottom-4 left-4 bg-white shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-gray-600 border border-gray-200 z-[80]">
                            <Loader size={12} className="animate-spin text-yellow-500" />
                            Sincronizando...
                        </div>
                    )}

                    {bootstrapLoading ? (
                        <div className="flex items-center justify-center h-full text-lg font-semibold text-gray-500">
                            <Loader size={32} className="animate-spin mr-3 text-yellow-500" />
                            Carregando dados iniciais...
                        </div>
                    ) : (
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
// AppRouter — decide login ou aplicação
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
    return !user
        ? <LoginScreen apiClient={apiClient} />
        : <DataProvider><AppContent /></DataProvider>;
};

// ==========================================
// Container raiz
// ==========================================

export default function AppContainer() {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    );
}
