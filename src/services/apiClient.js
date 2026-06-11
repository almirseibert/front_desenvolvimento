// src/services/apiClient.js

// URL base da sua API no Easypanel
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api'; 

const getToken = () => localStorage.getItem('authToken');

const apiFetch = async (endpoint, options = {}) => {
    const token = getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`; 
    }

    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.error || `Erro ${response.status}: ${response.statusText}`;
            const err = new Error(errorMessage);
            // Preserva o payload completo (campo, tipo, valor_*) para que a UI
            // possa destacar o input ofensor em vez de só mostrar a mensagem.
            err.status = response.status;
            err.data = errorData;
            err.response = { status: response.status, data: errorData };
            throw err;
        }
        
        if (response.status === 204) {
            return null;
        }

        return await response.json(); 
    } catch (error) {
        console.error(`Erro na chamada da API para ${API_URL}${endpoint}:`, error);
        throw error; 
    }
};

const apiClient = {
    // --- Upload Genérico (Usado em Funcionários e Multas) ---
    uploadFile: async (formData) => apiFetch('/upload', { method: 'POST', body: formData }),

    // --- Autenticação ---
    login: async (email, password) => {
        return apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    },
    getMe: async () => {
        return apiFetch('/auth/me');
    },
    validatePassword: async (password) => {
        return apiFetch('/auth/validate-password', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
    },
    changePassword: async (data) => {
        return apiFetch('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    createRegistrationRequest: async (data) => {
        return apiFetch('/auth/register', { 
            method: 'POST', 
            body: JSON.stringify(data) 
        });
    },

    // --- Veículos ---
    getVehicles: async () => apiFetch('/vehicles'),
    getVehicleById: async (id) => apiFetch(`/vehicles/${id}`),
    createVehicle: async (data) => apiFetch('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
    updateVehicle: async (id, data) => apiFetch(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVehicle: async (id) => apiFetch(`/vehicles/${id}`, { method: 'DELETE' }),
    allocateVehicleToObra: async (id, data) => apiFetch(`/vehicles/${id}/allocate-obra`, { method: 'POST', body: JSON.stringify(data) }),
    deallocateVehicleFromObra: async (id, data) => apiFetch(`/vehicles/${id}/deallocate-obra`, { method: 'POST', body: JSON.stringify(data) }),
    assignVehicleToOperational: async (id, data) => apiFetch(`/vehicles/${id}/assign-operational`, { method: 'POST', body: JSON.stringify(data) }),
    unassignVehicleFromOperational: async (id, data) => apiFetch(`/vehicles/${id}/unassign-operational`, { method: 'POST', body: JSON.stringify(data) }),
    startVehicleMaintenance: async (id, data) => apiFetch(`/vehicles/${id}/start-maintenance`, { method: 'POST', body: JSON.stringify(data) }),
    endVehicleMaintenance: async (id, data) => apiFetch(`/vehicles/${id}/end-maintenance`, { method: 'POST', body: JSON.stringify(data) }),
    uploadVehicleImage: async (id, formData) => {
        return apiFetch(`/vehicles/${id}/upload-image`, {
            method: 'POST',
            body: formData, 
        });
    },

    // --- Configurações de Tipos/Sub-tipos de Veículos ---
    getVehicleTypeConfigs: async () => apiFetch('/vehicle-type-configs'),
    createVehicleTypeConfig: async (data) => apiFetch('/vehicle-type-configs', { method: 'POST', body: JSON.stringify(data) }),
    updateVehicleTypeConfig: async (id, data) => apiFetch(`/vehicle-type-configs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVehicleTypeConfig: async (id) => apiFetch(`/vehicle-type-configs/${id}`, { method: 'DELETE' }),

    // --- Taxonomia de Veículos (grupos → tipos → sub-tipos) ---
    getVehicleTaxonomy: async () => apiFetch('/vehicle-taxonomy'),
    createVehicleGroup: async (data) => apiFetch('/vehicle-taxonomy/groups', { method: 'POST', body: JSON.stringify(data) }),
    updateVehicleGroup: async (id, data) => apiFetch(`/vehicle-taxonomy/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVehicleGroup: async (id) => apiFetch(`/vehicle-taxonomy/groups/${id}`, { method: 'DELETE' }),
    createVehicleType: async (data) => apiFetch('/vehicle-taxonomy/types', { method: 'POST', body: JSON.stringify(data) }),
    updateVehicleType: async (id, data) => apiFetch(`/vehicle-taxonomy/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVehicleType: async (id) => apiFetch(`/vehicle-taxonomy/types/${id}`, { method: 'DELETE' }),
    createVehicleSubType: async (data) => apiFetch('/vehicle-taxonomy/sub-types', { method: 'POST', body: JSON.stringify(data) }),
    updateVehicleSubType: async (id, data) => apiFetch(`/vehicle-taxonomy/sub-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVehicleSubType: async (id) => apiFetch(`/vehicle-taxonomy/sub-types/${id}`, { method: 'DELETE' }),

    // --- Checklists ---
    getVehicleChecklists: async (vehicleId) => apiFetch(`/checklists/vehicle/${vehicleId}`),

    // --- Obras ---
    getObras: async () => apiFetch('/obras'),
    getObraById: async (id) => apiFetch(`/obras/${id}`),
    createObra: async (data) => apiFetch('/obras', { method: 'POST', body: JSON.stringify(data) }),
    updateObra: async (id, data) => apiFetch(`/obras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteObra: async (id) => apiFetch(`/obras/${id}`, { method: 'DELETE' }),
    finishObra: async (id, data) => apiFetch(`/obras/${id}/finish`, { method: 'PUT', body: JSON.stringify(data) }), 
    updateObraHistoryEntry: async (obraId, historyId, data) => {
        return apiFetch(`/obras/${obraId}/historico/${historyId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    deleteObraHistoryEntry: async (obraId, historyId) =>
        apiFetch(`/obras/${obraId}/historico/${historyId}`, { method: 'DELETE' }),

    // --- MÓDULO SUPERVISOR (Novo) ---
    getSupervisorDashboard: async () => apiFetch('/supervisor/dashboard'),
    getSupervisorObraDetails: async (id) => apiFetch(`/supervisor/obra/${id}`),
    saveSupervisorContract: async (data) => apiFetch('/supervisor/contract', { method: 'POST', body: JSON.stringify(data) }),
    addSupervisorCrmLog: async (data) => apiFetch('/supervisor/crm', { method: 'POST', body: JSON.stringify(data) }),

    // --- Faturamento / Controle Diário ---
    getDailyLogs: async (obraId, filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiFetch(`/billing?obraId=${obraId}&${queryParams}`);
    },
    upsertDailyLog: async (data) => apiFetch('/billing', { method: 'POST', body: JSON.stringify(data) }),
    deleteDailyLog: async (id) => apiFetch(`/billing/${id}`, { method: 'DELETE' }),

    // --- Funcionários ---
    getEmployees: async () => apiFetch('/employees'),
    getEmployeeById: async (id) => apiFetch(`/employees/${id}`),
    createEmployee: async (data) => apiFetch('/employees', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployee: async (id, data) => apiFetch(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployee: async (id) => apiFetch(`/employees/${id}`, { method: 'DELETE' }),
    getEmployeeHistory: async (id) => apiFetch(`/employees/${id}/history`), 
    updateEmployeeStatus: async (id, data) => apiFetch(`/employees/${id}/status`, { 
        method: 'PUT', 
        body: JSON.stringify(data) 
    }), 

    // --- Revisões ---
    getRevisions: async () => apiFetch('/revisions'),
    createRevisionPlan: async (data) => apiFetch('/revisions', { method: 'POST', body: JSON.stringify(data) }),
    updateRevisionPlan: async (id, data) => apiFetch(`/revisions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRevisionPlan: async (id) => apiFetch(`/revisions/${id}`, { method: 'DELETE' }),
    getConsolidatedRevisionPlan: async () => apiFetch('/revisions/consolidated'), 
    getRevisionHistoryByVehicle: async (vehicleId) => apiFetch(`/revisions/history/${vehicleId}`), 
    completeRevision: async (data) => apiFetch('/revisions/complete', { method: 'POST', body: JSON.stringify(data) }), 

    // --- Despesas ---
    getExpenses: async () => apiFetch('/expenses'),
    createExpense: async (data) => apiFetch('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    updateExpense: async (id, data) => apiFetch(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteExpense: async (id) => apiFetch(`/expenses/${id}`, { method: 'DELETE' }),

    // --- Parceiros (Postos) ---
    getPartners: async () => apiFetch('/partners'),
    getPartnerById: async (id) => apiFetch(`/partners/${id}`),
    createPartner: async (data) => apiFetch('/partners', { method: 'POST', body: JSON.stringify(data) }),
    updatePartner: async (id, data) => apiFetch(`/partners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePartner: async (id) => apiFetch(`/partners/${id}`, { method: 'DELETE' }),
    updatePartnerFuelPrices: async (id, prices) => apiFetch(`/partners/${id}/prices`, { method: 'PUT', body: JSON.stringify(prices) }),
    updatePartnerStatus: async (id, status) => apiFetch(`/partners/${id}/status`, { 
        method: 'PUT', 
        body: JSON.stringify({ status: status })
        }),
        
    // --- SOLICITAÇÕES (App) ---
    getSolicitacoes: async (params) => {
        const queryParams = new URLSearchParams(params).toString();
        return apiFetch(`/solicitacoes?${queryParams}`);
    },
    createSolicitacao: async (formData) => apiFetch('/solicitacoes', { method: 'POST', body: formData }),
    avaliarSolicitacao: async (id, data) => apiFetch(`/solicitacoes/${id}/avaliar`, { method: 'PUT', body: JSON.stringify(data) }),
    enviarComprovanteSolicitacao: async (id, formData) => apiFetch(`/solicitacoes/${id}/comprovante`, { method: 'PUT', body: formData }),
    confirmarBaixaSolicitacao: async (id, data = {}) => apiFetch(`/solicitacoes/${id}/confirmar-baixa`, { method: 'PUT', body: JSON.stringify(data) }),
    rejeitarComprovanteSolicitacao: async (id) => apiFetch(`/solicitacoes/${id}/rejeitar-comprovante`, { method: 'PUT' }),
    getMySolicitacaoStatus: async () => apiFetch('/solicitacoes/meus-status'),

    // --- Abastecimentos (Legado/Admin) ---
    getRefuelings: async () => apiFetch('/refuelings'),
    getRefuelingById: async (id) => apiFetch(`/refuelings/${id}`),
    createRefuelingOrder: async (data) => apiFetch('/refuelings', { method: 'POST', body: JSON.stringify(data) }),
    updateRefuelingOrder: async (id, data) => apiFetch(`/refuelings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateRefueling: async (id, data) => apiFetch(`/refuelings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    confirmRefuelingOrder: async (id, data) => apiFetch(`/refuelings/${id}/confirm`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRefuelingOrder: async (id) => apiFetch(`/refuelings/${id}`, { method: 'DELETE' }),
    liberarOrdemBloqueada: async (id, data) => apiFetch(`/refuelings/${id}/liberar`, { method: 'PUT', body: JSON.stringify(data || {}) }),
    negarOrdemBloqueada: async (id) => apiFetch(`/refuelings/${id}/negar`, { method: 'DELETE' }),
    sendRefuelingEmail: async (payload) => apiFetch('/refuelings/send-email', { method: 'POST', body: JSON.stringify(payload) }),
    uploadRefuelingPdf: async (formData) => apiFetch('/refuelings/upload-pdf', { method: 'POST', body: formData }),

    // --- Transações do Comboio ---
    getComboioTransactions: async () => apiFetch('/comboioTransactions'),
    getComboioTransactionById: async (id) => apiFetch(`/comboioTransactions/${id}`),
    deleteComboioTransaction: async (id) => apiFetch(`/comboioTransactions/${id}`, { method: 'DELETE' }),
    createComboioEntrada: async (data) => apiFetch('/comboioTransactions/entrada', { method: 'POST', body: JSON.stringify(data) }),
    createComboioSaida: async (data) => apiFetch('/comboioTransactions/saida', { method: 'POST', body: JSON.stringify(data) }),
    // Distribuição do operador do comboio (com fotos). Recebe um FormData já montado.
    createComboioSaidaComFotos: async (formData) => apiFetch('/comboioTransactions/saida', { method: 'POST', body: formData }),
    createComboioDrenagem: async (data) => apiFetch('/comboioTransactions/drenagem', { method: 'POST', body: JSON.stringify(data) }),

    // --- Multas ---
    getFines: async () => apiFetch('/fines'),
    getFineById: async (id) => apiFetch(`/fines/${id}`),
    createFine: async (data) => apiFetch('/fines', { method: 'POST', body: JSON.stringify(data) }),
    updateFine: async (id, data) => apiFetch(`/fines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFine: async (id) => apiFetch(`/fines/${id}`, { method: 'DELETE' }),
    // (A rota .post(`/fines/${id}/notify`) é acessada dinamicamente via apiFetch, não precisando estar declarada no apiClient, mas usaremos post() padrão se necessário)

    // --- Diário de Bordo ---
    getDiarioDeBordo: async () => apiFetch('/diarioDeBordo'),
    getDiarioDeBordoById: async (id) => apiFetch(`/diarioDeBordo/${id}`),
    createDiarioDeBordo: async (data) => apiFetch('/diarioDeBordo', { method: 'POST', body: JSON.stringify(data) }), 
    updateDiarioDeBordo: async (id, data) => apiFetch(`/diarioDeBordo/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDiarioDeBordo: async (id) => apiFetch(`/diarioDeBordo/${id}`, { method: 'DELETE' }),
    startDiarioJourney: async (data) => apiFetch('/diarioDeBordo/start', { method: 'POST', body: JSON.stringify(data) }),
    endDiarioJourney: async (id, data) => apiFetch(`/diarioDeBordo/${id}/end`, { method: 'PUT', body: JSON.stringify(data) }),
    startDiarioBreak: async (id, data) => apiFetch(`/diarioDeBordo/${id}/start-break`, { method: 'PUT', body: JSON.stringify(data) }),
    endDiarioBreak: async (id, data) => apiFetch(`/diarioDeBordo/${id}/end-break`, { method: 'PUT', body: JSON.stringify(data) }),

    // --- Ordens de Compra/Serviço ---
    getOrders: async () => apiFetch('/orders'),
    getOrderById: async (id) => apiFetch(`/orders/${id}`),
    createOrder: async (data) => apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),
    updateOrder: async (id, data) => apiFetch(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteOrder: async (id) => apiFetch(`/orders/${id}`, { method: 'DELETE' }),
    cancelOrder: async (id) => apiFetch(`/orders/${id}/cancel`, { method: 'POST' }),

    // --- Contadores ---
    getCounter: async (name) => apiFetch(`/counters/${name}`),
    updateCounter: async (name, lastNumber) => apiFetch(`/counters/${name}`, { method: 'PUT', body: JSON.stringify({ lastNumber }) }),

    // --- Alertas de Inatividade ---
    getInactivityAlerts: async () => apiFetch('/inactivityAlerts'),
    createInactivityAlert: async (data) => apiFetch('/inactivityAlerts', { method: 'POST', body: JSON.stringify(data) }),
    updateInactivityAlert: async (id, data) => apiFetch(`/inactivityAlerts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteInactivityAlert: async (id) => apiFetch(`/inactivityAlerts/${id}`, { method: 'DELETE' }),

    // --- Usuários (Admin) ---
    getUsers: async () => apiFetch('/users'), 

    // --- Mensagens de Atualização (Admin) ---
    adminGetUpdateMessage: async () => apiFetch('/admin/update-message'), 
    adminSaveUpdateMessage: async (data) => apiFetch('/admin/update-message', { method: 'PUT', body: JSON.stringify(data) }), 

    // --- Funções Administrativas ---
    adminGetRegistrationRequests: async () => apiFetch('/admin/registration-requests'),
    adminApproveRegistrationRequest: async (data) => apiFetch('/admin/registration-requests/approve', { method: 'POST', body: JSON.stringify(data) }),
    adminDeleteRegistrationRequest: async (id) => apiFetch(`/admin/registration-requests/${id}`, { method: 'DELETE' }),
    adminAssignRole: async (data) => apiFetch('/admin/assign-role', { method: 'PUT', body: JSON.stringify(data) }),
    adminMigrateUsers: async () => apiFetch('/admin/migrate-users', { method: 'POST' }), 

   // --- Pneus ---
    getTires: async () => apiFetch('/tires'),
    createTire: async (data) => apiFetch('/tires', { method: 'POST', body: JSON.stringify(data) }),
    updateTire: async (id, data) => apiFetch(`/tires/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    registerTireTransaction: async (data) => apiFetch('/tires/transaction', { method: 'POST', body: JSON.stringify(data) }),
    getTireHistory: async (id) => apiFetch(`/tires/${id}/history`),
    getVehicleTireHistory: async (vehicleId) => apiFetch(`/tires/vehicle/${vehicleId}/history`),

    // --- WhatsApp (Admin) ---
    whatsappGetStatus: async () => apiFetch('/whatsapp/status'),
    whatsappReiniciar: async () => apiFetch('/whatsapp/reiniciar', { method: 'POST' }),
    whatsappEnviarTeste: async (data) => apiFetch('/whatsapp/enviar-teste', { method: 'POST', body: JSON.stringify(data) }),
    whatsappGetLogs: async () => apiFetch('/whatsapp/logs'),

    // --- Usuários Admin CRUD (TODO: backend) ---
    adminCreateUser: async (data) => apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    adminUpdateUser: async (id, data) => apiFetch(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    adminToggleUserStatus: async (id) => apiFetch(`/admin/users/${id}/status`, { method: 'PATCH' }),
    adminResetUserPassword: async (id) => apiFetch(`/admin/users/${id}/reset-password`, { method: 'POST' }),

    // --- Grupos de Acesso (TODO: backend) ---
    adminGetGroups: async () => apiFetch('/admin/groups'),
    adminCreateGroup: async (data) => apiFetch('/admin/groups', { method: 'POST', body: JSON.stringify(data) }),
    adminUpdateGroup: async (id, data) => apiFetch(`/admin/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    adminDeleteGroup: async (id) => apiFetch(`/admin/groups/${id}`, { method: 'DELETE' }),

    // --- Configuração de E-mail (TODO: backend) ---
    adminGetEmailConfig: async () => apiFetch('/admin/email-config'),
    adminSaveEmailConfig: async (data) => apiFetch('/admin/email-config', { method: 'PUT', body: JSON.stringify(data) }),
    adminSendTestEmail: async (data) => apiFetch('/admin/email-config/test', { method: 'POST', body: JSON.stringify(data) }),

    // --- Roteamento de Notificações (TODO: backend) ---
    adminGetNotificationRouting: async () => apiFetch('/admin/notification-routing'),
    adminSaveNotificationRouting: async (data) => apiFetch('/admin/notification-routing', { method: 'PUT', body: JSON.stringify(data) }),

    // --- Templates de Mensagens (TODO: backend) ---
    adminGetMessageTemplates: async () => apiFetch('/admin/message-templates'),
    adminCreateMessageTemplate: async (data) => apiFetch('/admin/message-templates', { method: 'POST', body: JSON.stringify(data) }),
    adminUpdateMessageTemplate: async (id, data) => apiFetch(`/admin/message-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    adminDeleteMessageTemplate: async (id) => apiFetch(`/admin/message-templates/${id}`, { method: 'DELETE' }),

    // --- Configurações de Alertas (TODO: backend) ---
    adminGetAlertConfig: async () => apiFetch('/admin/alert-config'),
    adminSaveAlertConfig: async (data) => apiFetch('/admin/alert-config', { method: 'PUT', body: JSON.stringify(data) }),

    // --- Relatórios Programados (TODO: backend) ---
    adminGetScheduledReports: async () => apiFetch('/admin/scheduled-reports'),
    adminCreateScheduledReport: async (data) => apiFetch('/admin/scheduled-reports', { method: 'POST', body: JSON.stringify(data) }),
    adminUpdateScheduledReport: async (id, data) => apiFetch(`/admin/scheduled-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    adminDeleteScheduledReport: async (id) => apiFetch(`/admin/scheduled-reports/${id}`, { method: 'DELETE' }),

    // --- Workflows de Aprovação (TODO: backend) ---
    adminGetApprovalWorkflows: async () => apiFetch('/admin/approval-workflows'),
    adminSaveApprovalWorkflows: async (data) => apiFetch('/admin/approval-workflows', { method: 'PUT', body: JSON.stringify(data) }),

    // --- Feriados (TODO: backend) ---
    adminGetHolidays: async () => apiFetch('/admin/holidays'),
    adminCreateHoliday: async (data) => apiFetch('/admin/holidays', { method: 'POST', body: JSON.stringify(data) }),
    adminDeleteHoliday: async (id) => apiFetch(`/admin/holidays/${id}`, { method: 'DELETE' }),

    // --- Broadcast (TODO: backend) ---
    adminBroadcast: async (data) => apiFetch('/admin/broadcast', { method: 'POST', body: JSON.stringify(data) }),

    // --- Health Check & Métricas (TODO: backend) ---
    adminGetSystemHealth: async () => apiFetch('/admin/system/health'),
    adminGetUsageStats: async () => apiFetch('/admin/usage-stats'),

    // --- Log de Auditoria (TODO: backend) ---
    adminGetAuditLog: async (params) => {
        const q = new URLSearchParams(params).toString();
        return apiFetch(`/admin/audit-log?${q}`);
    },

    // --- Comboios (partners-espelho) ---
    adminGetComboios:      async () => apiFetch('/admin/comboios'),
    adminSyncComboios:     async () => apiFetch('/admin/comboios/sync', { method: 'POST' }),
    adminActivateComboio:  async (vehicleId) => apiFetch(`/admin/comboios/${vehicleId}/activate`,   { method: 'POST' }),
    adminDeactivateComboio:async (vehicleId) => apiFetch(`/admin/comboios/${vehicleId}/deactivate`, { method: 'POST' }),
    adminUpdateComboioPartnerContacts: async (vehicleId, data) =>
        apiFetch(`/admin/comboios/${vehicleId}/partner`, { method: 'PATCH', body: JSON.stringify(data) }),
    adminGetComboioPeriodos: async (vehicleId) =>
        apiFetch(`/admin/comboios/${vehicleId}/periodos`),

    // --- Notificações: destinos por evento (Fase 3.1) ---
    adminListNotificationTargets: async (eventType) => {
        const q = eventType ? `?event_type=${encodeURIComponent(eventType)}` : '';
        return apiFetch(`/admin/notification-targets${q}`);
    },
    adminCreateNotificationTarget: async (data) =>
        apiFetch('/admin/notification-targets', { method: 'POST', body: JSON.stringify(data) }),
    adminUpdateNotificationTarget: async (id, data) =>
        apiFetch(`/admin/notification-targets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    adminDeleteNotificationTarget: async (id) =>
        apiFetch(`/admin/notification-targets/${id}`, { method: 'DELETE' }),

    // --- Contatos Internos (Fase 4.1) ---
    adminListInternalContacts:   async () => apiFetch('/admin/internal-contacts'),
    adminCreateInternalContact:  async (data) =>
        apiFetch('/admin/internal-contacts', { method: 'POST', body: JSON.stringify(data) }),
    adminUpdateInternalContact:  async (id, data) =>
        apiFetch(`/admin/internal-contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    adminDeleteInternalContact:  async (id) =>
        apiFetch(`/admin/internal-contacts/${id}`, { method: 'DELETE' }),

    // --- Log de erros de solicitação de abastecimento (app) ---
    adminGetSolicitacaoErros: async (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return apiFetch(`/admin/solicitacao-erros${q ? `?${q}` : ''}`);
    },
    adminGetSolicitacaoErrosResumo: async () => apiFetch('/admin/solicitacao-erros/resumo'),

    // --- Sessões Ativas (TODO: backend) ---
    adminGetActiveSessions: async () => apiFetch('/admin/sessions'),
    adminForceLogout: async (sessionId) => apiFetch(`/admin/sessions/${sessionId}`, { method: 'DELETE' }),

    // --- Backup & Export (TODO: backend) ---
    adminExportData: async (module) => apiFetch(`/admin/export/${module}`),

    // --- SigaSul — Rastreamento Veicular ---
    sigasulGetPositions: async (force = false) => apiFetch(`/sigasul/positions${force ? '?force=true' : ''}`),
    sigasulGetPositionsByPeriod: async (from, to) =>
        apiFetch(`/sigasul/positions/period?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    sigasulGetPositionsByPlate: async (plate, from, to) =>
        apiFetch(`/sigasul/positions/vehicle/${encodeURIComponent(plate)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    sigasulGetJourneys: async () => apiFetch('/sigasul/journeys'),
    sigasulGetJourneysSimplified: async (from, to) =>
        apiFetch(`/sigasul/journeys/simplified?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    sigasulGetJourneysAggregate: async (from, to) =>
        apiFetch(`/sigasul/journeys/aggregate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

    // --- Defaults & Auxiliares ---
    defaults: { baseURL: API_URL },
    get: (url, config) => apiFetch(url, { method: 'GET', ...config }),
    post: (url, data, config) => apiFetch(url, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data), ...config }),
    put: (url, data, config) => apiFetch(url, { method: 'PUT', body: data instanceof FormData ? data : JSON.stringify(data), ...config }),
    delete: (url, config) => apiFetch(url, { method: 'DELETE', ...config }),
};

export default apiClient;