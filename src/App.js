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
import { Bell, Loader, X, UserPlus, AlertTriangle, WifiOff, Fuel, Truck
} from 'lucide-react';
import ExcavatorLoader from './components/ui/ExcavatorLoader';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import Sidebar from './components/Sidebar';

// LoginScreen carrega de forma síncrona (necessário antes do login)
import LoginScreen from './components/LoginScreen';

import apiClient from './services/apiClient';
import { canAccessPage, canAccessAnaliseGerencial } from './utils/permissions';
import {
    vehicleGroups,
    extraObraOptions,
    operationalSubGroups,
    equipmentTypesForHours,
    hydrateVehicleTaxonomy,
} from './utils/vehicleRules';
import { processVehiclesWithAlerts } from './utils/vehicleAlerts';

// ==========================================
// Lazy Loading de Páginas (Code Splitting)
// ==========================================
const Dashboard                    = lazy(() => import('./pages/Dashboard'));
const ObrasPage                    = lazy(() => import('./pages/ObrasPage'));
const PlanejamentoPage             = lazy(() => import('./pages/PlanejamentoPage'));
const PartnersPage                 = lazy(() => import('./pages/PartnersPage'));
const RefuelingPage                = lazy(() => import('./pages/RefuelingPage'));
const SaldoEmPostosPage            = lazy(() => import('./pages/SaldoEmPostosPage'));
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
const ComboioMobilePage            = lazy(() => import('./pages/ComboioMobilePage'));
const OperadorDocumentosPage       = lazy(() => import('./pages/OperadorDocumentosPage'));
const AdminSolicitacoesPage        = lazy(() => import('./pages/AdminSolicitacoesPage'));
const SigaSulPage                  = lazy(() => import('./pages/SigaSulPage'));
const AnaliseGerencialPage         = lazy(() => import('./pages/AnaliseGerencialPage'));
const AproveitamentoProdutivoPage  = lazy(() => import('./pages/AproveitamentoProdutivoPage'));
const ProjecaoObraPage             = lazy(() => import('./pages/ProjecaoObraPage'));
const TerceirizadosPage            = lazy(() => import('./pages/TerceirizadosPage'));
const AdminUsuariosPage            = lazy(() => import('./pages/AdminUsuariosPage'));
const AdminFrotaPage               = lazy(() => import('./pages/AdminFrotaPage'));
const AdminComunicacaoPage         = lazy(() => import('./pages/AdminComunicacaoPage'));
const AdminSistemaPage             = lazy(() => import('./pages/AdminSistemaPage'));

// ==========================================
// Fallback de Carregamento de Página
// ==========================================
const PageFallback = () => (
    <div className="flex items-center justify-center h-full">
        <ExcavatorLoader size="md" />
    </div>
);

// ==========================================
// Botões utilitários para modais
// ==========================================

const BtnPrimary = ({ onClick, children, disabled }) => {
    const [h, setH] = React.useState(false);
    return (
        <button onClick={onClick} disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: h ? '#8a6a34' : '#9E7A42', color: '#fff', opacity: disabled ? 0.6 : 1, transition: 'background 0.15s' }}>
            {children}
        </button>
    );
};
const BtnCancel = ({ onClick, children }) => {
    const [h, setH] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e8e0d4', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: h ? '#f5f2ed' : '#fff', color: '#6a5e4e', transition: 'background 0.15s' }}>
            {children}
        </button>
    );
};
const BtnDanger = ({ onClick, children, disabled }) => {
    const [h, setH] = React.useState(false);
    return (
        <button onClick={onClick} disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: h ? '#9a2e20' : '#b03828', color: '#fff', opacity: disabled ? 0.6 : 1, transition: 'background 0.15s' }}>
            {children}
        </button>
    );
};

// ==========================================
// Modais Globais
// ==========================================

const CustomAlert = React.memo(({ message, onClose }) => (
    <div className="fixed inset-0 flex items-center justify-center z-[99999] p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', width: '100%', maxWidth: 420, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f0ebe3' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e1a14' }}>Aviso</span>
            </div>
            <div style={{ padding: '16px 18px' }}>
                <pre style={{ fontSize: 13, color: '#6a5e4e', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{message}</pre>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #f0ebe3', display: 'flex', justifyContent: 'flex-end' }}>
                <BtnPrimary onClick={onClose}>OK</BtnPrimary>
            </div>
        </div>
    </div>
));

const ConfirmationModal = React.memo(({
    title, message, onConfirm, onClose,
    confirmText = 'Confirmar', cancelText = 'Cancelar',
    confirmColor,
    danger = false,
}) => (
    <div className="fixed inset-0 flex items-center justify-center z-[90] p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', width: '100%', maxWidth: 420, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${danger ? '#fdf0ec' : '#f0ebe3'}` }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: danger ? '#b03828' : '#1e1a14' }}>{title}</span>
            </div>
            <div style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: 13, color: '#6a5e4e', lineHeight: 1.6 }}>{message}</p>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #f0ebe3', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <BtnCancel onClick={onClose}>{cancelText}</BtnCancel>
                {danger
                    ? <BtnDanger onClick={onConfirm}>{confirmText}</BtnDanger>
                    : <BtnPrimary onClick={onConfirm}>{confirmText}</BtnPrimary>
                }
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
        <div className="fixed inset-0 flex items-center justify-center z-[90] p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', width: '100%', maxWidth: 380, overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #fdf0ec' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#b03828' }}>Confirmação de Segurança</div>
                    <div style={{ fontSize: 11, color: '#9a8a78', marginTop: 2 }}>Insira sua senha para continuar</div>
                </div>
                <div style={{ padding: '16px 18px' }}>
                    <p style={{ fontSize: 13, color: '#6a5e4e', lineHeight: 1.5, marginBottom: 12 }}>{message || 'Esta operação requer confirmação de identidade.'}</p>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                        placeholder="Sua senha"
                        autoFocus
                        style={{ width: '100%' }}
                    />
                    {error && <p style={{ fontSize: 11, color: '#b03828', marginTop: 6, fontWeight: 600 }}>{error}</p>}
                </div>
                <div style={{ padding: '12px 18px', borderTop: '1px solid #f0ebe3', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <BtnCancel onClick={onClose}>Cancelar</BtnCancel>
                    <BtnDanger onClick={handleConfirm} disabled={isVerifying}>
                        {isVerifying && <Loader size={13} className="animate-spin" style={{ marginRight: 6 }} />}
                        Confirmar
                    </BtnDanger>
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

// Metadados de exibição por tipo de notificação administrativa.
const ADMIN_NOTIF_META = {
    nova_solicitacao:         { title: 'Nova solicitação de abastecimento', message: 'Há uma nova solicitação aguardando análise.', Icon: Fuel,          color: 'amber'  },
    baixa_pendente:           { title: 'Baixa de abastecimento pendente',    message: 'Uma solicitação está aguardando baixa.',        Icon: Fuel,          color: 'amber'  },
    ordem_bloqueada:          { title: 'Ordem de abastecimento bloqueada',   message: 'Uma ordem está bloqueada aguardando liberação.', Icon: AlertTriangle, color: 'red'    },
    nova_solicitacao_cadastro:{ title: 'Nova solicitação de cadastro',       message: 'Um novo usuário aguarda aprovação de cadastro.', Icon: UserPlus,      color: 'blue'   },
    requisicao_operacional:   { title: 'Nova requisição operacional',        message: 'Há uma sugestão de mudança de obra/operador aguardando análise.', Icon: Truck, color: 'amber' },
    whatsapp_desconectado:    { title: 'Serviço WhatsApp desconectado',      message: 'A conexão com o WhatsApp caiu. Reconecte o serviço.', Icon: WifiOff,    color: 'red'    },
    whatsapp_nao_configurado: { title: 'WhatsApp não configurado',           message: 'O serviço de WhatsApp ainda não foi configurado.', Icon: WifiOff,     color: 'red'    },
};

const ADMIN_NOTIF_COLORS = {
    amber: { border: 'border-amber-500', bg: 'bg-amber-100', text: 'text-amber-600' },
    red:   { border: 'border-red-500',   bg: 'bg-red-100',   text: 'text-red-600'   },
    blue:  { border: 'border-blue-500',  bg: 'bg-blue-100',  text: 'text-blue-600'  },
};

const AdminNotificationPopup = React.memo(({ popup, onClose }) => {
    const meta = ADMIN_NOTIF_META[popup.tipo] || { title: 'Nova notificação', message: 'Há um novo evento na área administrativa.', Icon: Bell, color: 'blue' };
    const c = ADMIN_NOTIF_COLORS[meta.color] || ADMIN_NOTIF_COLORS.blue;
    const Icon = meta.Icon;
    return (
        <div className={`bg-white border-l-4 ${c.border} shadow-2xl rounded-lg p-4 max-w-sm w-full animate-bounce-in pointer-events-auto`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className={`${c.bg} ${c.text} p-2 rounded-full`}>
                        <Icon size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800">{meta.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{popup.message || meta.message}</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
        </div>
    );
});

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
    const [operadorTelaAtual, setOperadorTelaAtual] = useState(null); // null | 'comboio' | 'normal'

    const [agendaAlerts, setAgendaAlerts] = useState([]);
    const [adminPopups, setAdminPopups] = useState([]); // pop-ups de notificação (somente admin)

    // ---------- Taxonomia de veículos (hidratada do banco) ----------
    // Incrementa a cada hidratação para forçar recompute dos consumidores.
    const [taxonomyVersion, setTaxonomyVersion] = useState(0);

    const hydrateTaxonomy = useCallback(() => {
        apiClient.getVehicleTaxonomy?.()
            .then(tree => {
                hydrateVehicleTaxonomy(tree);
                setTaxonomyVersion(v => v + 1);
            })
            .catch(e => console.warn('Erro ao carregar taxonomia de veículos:', e));
    }, []);

    useEffect(() => {
        if (!user) return;
        hydrateTaxonomy();
    }, [user, hydrateTaxonomy]);

    // Re-hidrata quando o admin altera a taxonomia (via socket).
    useEffect(() => {
        if (!socket) return;
        const onSync = (payload) => {
            const targets = payload?.targets || [];
            if (targets.includes('vehicleTaxonomy')) hydrateTaxonomy();
        };
        socket.on('server:sync', onSync);
        return () => socket.off('server:sync', onSync);
    }, [socket, hydrateTaxonomy]);

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
        if (canAccessPage(user.roleNormalized, 'admin_solicitacoes')) {
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
            const podeAbastecimento = canAccessPage(user.roleNormalized, 'admin_solicitacoes');
            // Função "Abastecimento" em Usuários & Acesso.
            const isAbastecimento = user.roleNormalized === 'abastecimento';

            // Contador de solicitações pendentes (quem tem acesso à área de abastecimento).
            if (podeAbastecimento && (data.tipo === 'nova_solicitacao' || data.tipo === 'baixa_pendente')) {
                setPendingSolicitacoesCount(prev => prev + 1);
            }

            const tocarBeep = () => {
                try {
                    const audio = new Audio('/beep.mp3');
                    audio.play().catch(e => console.warn('Sem interação', e));
                } catch (e) {}
            };

            const mostrarPopup = () => {
                tocarBeep();
                setAdminPopups(prev => [
                    ...prev,
                    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tipo: data.tipo, message: data.mensagem || data.message || null },
                ]);
            };

            // Nova solicitação de abastecimento (página Solicitações App): o pop-up vai
            // para a função Abastecimento — não mais para a função Administrador.
            if (data.tipo === 'nova_solicitacao') {
                if (isAbastecimento && ADMIN_NOTIF_META[data.tipo]) {
                    mostrarPopup();
                } else if (podeAbastecimento) {
                    // Demais perfis com acesso a abastecimento: mantém apenas o beep do contador.
                    tocarBeep();
                }
                return;
            }

            // Demais notificações administrativas: pop-up + som somente para administradores.
            if (user.user_type === 'admin' && ADMIN_NOTIF_META[data.tipo]) {
                mostrarPopup();
            } else if (podeAbastecimento && data.tipo === 'baixa_pendente') {
                // Não-admin com acesso a abastecimento: mantém apenas o beep do contador.
                tocarBeep();
            }
        };

        const handleWaReconectado = () => {
            setAdminPopups(prev => prev.filter(p => p.tipo !== 'whatsapp_desconectado' && p.tipo !== 'whatsapp_nao_configurado'));
        };

        socket.on('agenda:alerta', handleAgendaAlert);
        socket.on('admin:notificacao', handleAdminNotification);
        socket.on('whatsapp:reconectado', handleWaReconectado);

        return () => {
            socket.off('agenda:alerta', handleAgendaAlert);
            socket.off('admin:notificacao', handleAdminNotification);
            socket.off('whatsapp:reconectado', handleWaReconectado);
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
        saldo_postos:         ['partnerFuelCredits'],
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
        operacional:          ['dailyWorkLogs', 'refuelings'],
        terceirizados:        ['dailyWorkLogs', 'refuelings', 'comboioTransactions', 'terceirizadoPagamentos'],
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
        vehicleGroups: { ...vehicleGroups },
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
    // taxonomyVersion força recompute quando a taxonomia (mutada in-place) é re-hidratada
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [
        user,
        PasswordConfirmationModalWrapped,
        reload, navigate,
        processedVehicles, obras, revisions, expenses, employees, partners,
        refuelings, comboioTransactions, fines, diarioDeBordoLogs, dailyWorkLogs, orders,
        socket,
        taxonomyVersion,
    ]);

    const closeAgendaAlert = useCallback((index) => {
        setAgendaAlerts(prev => prev.filter((_, i) => i !== index));
    }, []);

    // ---------- Operador: rota especial ----------
    if (user && user.user_type === 'operador') {
        if (bootstrapLoading) {
            return (
                <div className="flex justify-center items-center h-screen" style={{ background: '#f5f3ef' }}>
                    <ExcavatorLoader size="md" />
                </div>
            );
        }

        // Tela de Documentos (PDFs) — acessível a partir de qualquer fluxo do operador
        if (operadorTelaAtual === 'documentos') {
            return (
                <Suspense fallback={<PageFallback />}>
                    <OperadorDocumentosPage
                        apiClient={apiClient}
                        user={user}
                        setAlertMessage={setAlertMessage}
                        onVoltar={() => setOperadorTelaAtual(null)}
                    />
                </Suspense>
            );
        }

        // Detecta veículos vinculados ao operador via alocacaoAtual.description
        const employeeRecord = employees.find(e =>
            e.id === user.employeeId || e.nome === user.name
        );

        const registrosVinculados = employeeRecord?.alocacaoAtual?.isAllocated
            ? employeeRecord.alocacaoAtual.description.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        const veiculosVinculados = registrosVinculados
            .map(reg => vehicles.find(v => v.registroInterno === reg))
            .filter(Boolean);

        const comboiosVinculados  = veiculosVinculados.filter(v => v.isComboioVehicle);
        const normaisVinculados   = veiculosVinculados.filter(v => !v.isComboioVehicle);

        const temComboio  = comboiosVinculados.length > 0;
        const temNormal   = normaisVinculados.length > 0;

        // Caso 2: todos comboio (ou apenas comboio) → vai direto pro comboio
        if (temComboio && !temNormal) {
            return (
                <Suspense fallback={<PageFallback />}>
                    <ComboioMobilePage
                        apiClient={apiClient}
                        user={user}
                        comboio={comboiosVinculados[0]}
                        vehicles={vehicles}
                        obras={obras}
                        employees={employees}
                        partners={partners}
                        expenses={expenses}
                        setAlertMessage={setAlertMessage}
                        socket={socket}
                        PasswordConfirmationModal={PasswordConfirmationModalWrapped}
                        onAbrirDocumentos={() => setOperadorTelaAtual('documentos')}
                    />
                </Suspense>
            );
        }

        // Caso 1: tem comboio E normal → tela de seleção
        if (temComboio && temNormal) {
            if (operadorTelaAtual === 'comboio') {
                return (
                    <Suspense fallback={<PageFallback />}>
                        <ComboioMobilePage
                            apiClient={apiClient}
                            user={user}
                            comboio={comboiosVinculados[0]}
                            vehicles={vehicles}
                            obras={obras}
                            employees={employees}
                            partners={partners}
                            expenses={expenses}
                            setAlertMessage={setAlertMessage}
                            socket={socket}
                            PasswordConfirmationModal={PasswordConfirmationModalWrapped}
                            onVoltar={() => setOperadorTelaAtual(null)}
                            onAbrirDocumentos={() => setOperadorTelaAtual('documentos')}
                        />
                    </Suspense>
                );
            }
            if (operadorTelaAtual === 'normal') {
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
                            onVoltar={() => setOperadorTelaAtual(null)}
                            onAbrirDocumentos={() => setOperadorTelaAtual('documentos')}
                        />
                    </Suspense>
                );
            }
            // Tela de seleção
            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6" style={{ background: '#f5f3ef' }}>
                    <div className="text-center mb-2">
                        <div className="text-xl font-bold text-slate-800">Abastecimento</div>
                        <div className="text-sm text-slate-500 mt-1">Selecione o tipo de abastecimento</div>
                    </div>
                    <button
                        onClick={() => setOperadorTelaAtual('normal')}
                        className="w-full max-w-xs bg-white border-2 border-yellow-500 rounded-2xl p-6 flex flex-col items-center gap-3 shadow hover:shadow-md active:scale-95 transition-all"
                    >
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#fef9c3' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9E7A42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z"/>
                            </svg>
                        </div>
                        <div className="font-semibold text-slate-800 text-lg">Abastecimento Normal</div>
                        <div className="text-xs text-slate-400 text-center">Solicitar abastecimento para seu veículo</div>
                    </button>
                    <button
                        onClick={() => setOperadorTelaAtual('comboio')}
                        className="w-full max-w-xs bg-white border-2 border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-3 shadow hover:shadow-md active:scale-95 transition-all"
                    >
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#f1f5f9' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                            </svg>
                        </div>
                        <div className="font-semibold text-slate-800 text-lg">Comboio</div>
                        <div className="text-xs text-slate-400 text-center">Gerenciar abastecimento do comboio</div>
                    </button>
                    <button
                        onClick={() => setOperadorTelaAtual('documentos')}
                        className="w-full max-w-xs text-slate-500 hover:text-slate-800 text-sm font-medium flex items-center justify-center gap-2 mt-2 transition"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Documentos (PDFs)
                    </button>
                </div>
            );
        }

        // Caso 3: apenas veículos normais → tela normal
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
                    onAbrirDocumentos={() => setOperadorTelaAtual('documentos')}
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
                return canAccessAnaliseGerencial(user)
                    ? <SupervisorDashboard {...commonProps} onNavigateToDetail={handleNavigateToObra} /> : <Denied />;
            case 'supervisor_detail':
                return canAccessAnaliseGerencial(user)
                    ? <SupervisorObraDetail obraId={selectedObraId} onBack={() => setCurrentPage('supervisor_dashboard')} /> : <Denied />;
            case 'vehicles':
                return <VehiclePage {...commonProps} initialFilter={pageFilter} />;
            case 'obras':
                return <ObrasPage {...commonProps} initialFilter={pageFilter} />;
            case 'planejamento':
                return <PlanejamentoPage {...commonProps} />;
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
            case 'terceirizados':
                return <TerceirizadosPage {...commonProps} />;
            case 'refueling':
                return canAccessPage(user.roleNormalized, 'refueling')
                    ? <RefuelingPage {...commonProps} /> : <Denied />;
            case 'saldo_postos':
                return canAccessPage(user.roleNormalized, 'saldo_postos')
                    ? <SaldoEmPostosPage /> : <Denied />;
            case 'admin_solicitacoes':
                return canAccessPage(user.roleNormalized, 'admin_solicitacoes')
                    ? <AdminSolicitacoesPage {...commonProps} /> : <Denied />;
            case 'orders':
                return <OrdersPage {...commonProps} />;
            case 'inventory':
                return <InventoryPage {...commonProps} />;
            case 'comboio':
                return canAccessPage(user.roleNormalized, 'comboio')
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
                return canAccessPage(user.roleNormalized, 'admin')
                    ? <AdminPage {...commonProps} /> : <Denied />;
            case 'admin_usuarios':
                return canAccessPage(user.roleNormalized, 'admin')
                    ? <AdminUsuariosPage {...commonProps} /> : <Denied />;
            case 'admin_frota':
                return canAccessPage(user.roleNormalized, 'admin')
                    ? <AdminFrotaPage {...commonProps} /> : <Denied />;
            case 'admin_comunicacao':
                return canAccessPage(user.roleNormalized, 'admin')
                    ? <AdminComunicacaoPage {...commonProps} /> : <Denied />;
            case 'admin_sistema':
                return canAccessPage(user.roleNormalized, 'admin')
                    ? <AdminSistemaPage {...commonProps} /> : <Denied />;
            case 'sigasul':
                return canAccessPage(user.roleNormalized, 'sigasul')
                    ? <SigaSulPage {...commonProps} /> : <Denied />;
            case 'analise_gerencial':
                return canAccessAnaliseGerencial(user)
                    ? <AnaliseGerencialPage {...commonProps} /> : <Denied />;
            case 'projecao_obra':
                return canAccessAnaliseGerencial(user)
                    ? <ProjecaoObraPage {...commonProps} /> : <Denied />;
            case 'aproveitamento':
                return canAccessAnaliseGerencial(user)
                    ? <AproveitamentoProdutivoPage {...commonProps} /> : <Denied />;
            default:
                return <Dashboard {...commonProps} />; 
        }
    };

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: '#f5f3ef', fontFamily: "'Roboto', sans-serif", color: '#3d3528' }}>
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

            {user.user_type === 'admin' && adminPopups.length > 0 && (
                <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-3 pointer-events-none">
                    {adminPopups.map(popup => (
                        <AdminNotificationPopup
                            key={popup.id}
                            popup={popup}
                            onClose={() => setAdminPopups(prev => prev.filter(p => p.id !== popup.id))}
                        />
                    ))}
                </div>
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
                <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 scroll-smooth mak-scrollbar" style={{ background: '#f5f3ef' }}>
                    {alertMessage && (
                        <CustomAlert message={alertMessage} onClose={() => setAlertMessage('')} />
                    )}

                    {bootstrapLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <ExcavatorLoader size="md" text="Carregando dados iniciais..." />
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
            <div className="flex items-center justify-center min-h-screen" style={{ background: '#f5f3ef' }}>
                <ExcavatorLoader size="md" text={null} />
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
