// src/contexts/DataContext.js
//
// ============================================================================
// DataContext — Estado global de dados com LAZY LOADING e CACHE
// ============================================================================
//
// Substitui o `loadAllData()` antigo do App.js que carregava tudo no login.
// Agora cada recurso (vehicles, fines, refuelings, etc.) é carregado APENAS
// quando alguma página efetivamente precisa dele.
//
// Estratégia:
//   - Recursos "essenciais" (vehicles, obras, employees, partners) são pré-
//     carregados logo após o login porque praticamente toda página os usa
//     como referência (lookups por id).
//   - Recursos "pesados" (refuelings, comboioTransactions, fines, expenses,
//     diarioDeBordoLogs, dailyWorkLogs, orders, revisions) são lazy: a
//     primeira página que precisar deles dispara o fetch, e o resultado
//     fica em cache durante toda a sessão.
//   - Socket.io continua invalidando alvos (`server:sync`) e nós refazemos
//     o fetch APENAS dos recursos que estão atualmente cacheados — não
//     adianta buscar fines se nenhuma página de fines está aberta ainda.
//
// API exposta pelo hook useData():
//   - vehicles, obras, employees, partners, refuelings, ... (estados)
//   - ensure(resource)              → garante que o recurso está carregado
//   - ensureAll(['fines','expenses']) → garante múltiplos de uma vez
//   - refresh(resource)             → força refetch ignorando cache
//   - invalidate(resource)          → marca como stale (próximo ensure refaz)
//   - reload()                      → recarrega TUDO que está cacheado
//   - socket                        → instância Socket.io (compartilhada)
//
// ============================================================================

import React, {
    createContext, useContext, useState, useRef,
    useCallback, useEffect, useMemo
} from 'react';
import { io } from 'socket.io-client';
import apiClient from '../services/apiClient';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

// ----------------------------------------------------------------------------
// Definição dos recursos e como buscá-los.
// Cada recurso tem:
//   - getter: função (parâmetro user) que retorna a promise da API
//   - rawSetter? : nome interno do estado "cru" (caso precise de processing)
//   - essential: se true, carrega após login; se false, lazy
//   - allowedFor: função (user) que diz se este recurso é válido para o user
// ----------------------------------------------------------------------------

const isOperador = (u) => u?.user_type === 'operador';
const REFUELING_ROLES = ['admin', 'gerencia', 'abastecimento', 'editor'];
const isAdminOrRefueler = (u) =>
    u?.podeAcessarAbastecimento || REFUELING_ROLES.includes(u?.user_type?.toLowerCase());

const RESOURCE_DEFS = {
    // ----- Essenciais (pré-carregados após login) -----
    vehicles: {
        getter: () => apiClient.getVehicles(),
        essential: true,
        allowedFor: () => true,
    },
    obras: {
        getter: () => apiClient.getObras(),
        essential: true,
        allowedFor: () => true,
    },
    employees: {
        getter: () => apiClient.getEmployees(),
        essential: true,
        allowedFor: () => true,
    },
    partners: {
        getter: () => apiClient.getPartners(),
        essential: true,
        allowedFor: () => true,
    },

    // ----- Lazy (carregados sob demanda) -----
    revisions: {
        getter: () => apiClient.getRevisions(),
        essential: false,
        allowedFor: (u) => !isOperador(u),
    },
    expenses: {
        getter: () => apiClient.getExpenses(),
        essential: false,
        allowedFor: (u) => !isOperador(u),
    },
    refuelings: {
        getter: () => apiClient.getRefuelings(),
        essential: false,
        allowedFor: (u) => !isOperador(u),
    },
    comboioTransactions: {
        getter: () => apiClient.getComboioTransactions(),
        essential: false,
        allowedFor: (u) => isAdminOrRefueler(u),
    },
    fines: {
        getter: () => apiClient.getFines(),
        essential: false,
        allowedFor: (u) => !isOperador(u),
    },
    diarioDeBordoLogs: {
        getter: () => apiClient.getDiarioDeBordo(),
        essential: false,
        allowedFor: () => true,
    },
    dailyWorkLogs: {
        getter: () => apiClient.getDailyLogs('all'),
        essential: false,
        allowedFor: (u) => !isOperador(u),
    },
    orders: {
        getter: () => {
            // Tolerância: getAllOrders pode ou não existir dependendo da versão do apiClient
            if (typeof apiClient.getAllOrders === 'function') return apiClient.getAllOrders();
            if (typeof apiClient.getOrders === 'function') return apiClient.getOrders();
            return Promise.resolve([]);
        },
        essential: false,
        allowedFor: (u) => !isOperador(u),
    },
};

const RESOURCE_KEYS = Object.keys(RESOURCE_DEFS);
const EMPTY_ARRAY = [];

// Mapeia os "targets" que vêm do socket para chaves locais.
// O backend emite 'comboio', mas internamente usamos 'comboioTransactions'.
const TARGET_TO_RESOURCE = {
    vehicles: 'vehicles',
    obras: 'obras',
    employees: 'employees',
    partners: 'partners',
    revisions: 'revisions',
    expenses: 'expenses',
    refuelings: 'refuelings',
    comboio: 'comboioTransactions',
    comboioTransactions: 'comboioTransactions',
    fines: 'fines',
    diarioDeBordo: 'diarioDeBordoLogs',
    diarioDeBordoLogs: 'diarioDeBordoLogs',
    dailyWorkLogs: 'dailyWorkLogs',
    orders: 'orders',
};

// ============================================================================
// Provider
// ============================================================================

export const DataProvider = ({ children }) => {
    const { user, logout } = useAuth();

    // Estados de cada recurso
    const [vehicles, setVehicles] = useState(EMPTY_ARRAY);
    const [obras, setObras] = useState(EMPTY_ARRAY);
    const [employees, setEmployees] = useState(EMPTY_ARRAY);
    const [rawPartners, setRawPartners] = useState(EMPTY_ARRAY);
    const [revisions, setRevisions] = useState(EMPTY_ARRAY);
    const [expenses, setExpenses] = useState(EMPTY_ARRAY);
    const [refuelings, setRefuelings] = useState(EMPTY_ARRAY);
    const [rawComboioTransactions, setRawComboioTransactions] = useState(EMPTY_ARRAY);
    const [rawFines, setRawFines] = useState(EMPTY_ARRAY);
    const [diarioDeBordoLogs, setDiarioDeBordoLogs] = useState(EMPTY_ARRAY);
    const [dailyWorkLogs, setDailyWorkLogs] = useState(EMPTY_ARRAY);
    const [orders, setOrders] = useState(EMPTY_ARRAY);

    // Status de carregamento essencial (bloqueia tela até terminar)
    const [bootstrapLoading, setBootstrapLoading] = useState(true);

    // Indicador de "está sincronizando algo em background"
    const [syncing, setSyncing] = useState(false);

    // Cache de quais recursos JÁ foram carregados nesta sessão
    // Usamos ref para evitar re-renders quando atualizamos o cache.
    const loadedRef = useRef(new Set());

    // Promessas em voo (para deduplicar fetches concorrentes)
    const inFlightRef = useRef(new Map());

    // Socket.io
    const [socket, setSocket] = useState(null);

    // ------------------------------------------------------------------------
    // Setters mapeados por chave de recurso
    // ------------------------------------------------------------------------
    const setters = useMemo(() => ({
        vehicles: setVehicles,
        obras: setObras,
        employees: setEmployees,
        partners: setRawPartners,
        revisions: setRevisions,
        expenses: setExpenses,
        refuelings: setRefuelings,
        comboioTransactions: setRawComboioTransactions,
        fines: setRawFines,
        diarioDeBordoLogs: setDiarioDeBordoLogs,
        dailyWorkLogs: setDailyWorkLogs,
        orders: setOrders,
    }), []);

    // ------------------------------------------------------------------------
    // fetchResource: busca UM recurso, deduplicando promessas em voo
    // ------------------------------------------------------------------------
    const fetchResource = useCallback(async (key) => {
        const def = RESOURCE_DEFS[key];
        if (!def) {
            console.warn(`[DataContext] Recurso desconhecido: ${key}`);
            return null;
        }
        if (!def.allowedFor(user)) {
            // Recurso indisponível para este user — apenas marca como "carregado" vazio
            loadedRef.current.add(key);
            return EMPTY_ARRAY;
        }

        // Deduplicação: se já tem uma promessa em voo para esta chave, retorna ela
        if (inFlightRef.current.has(key)) {
            return inFlightRef.current.get(key);
        }

        const promise = (async () => {
            try {
                const data = await def.getter(user);
                const arr = Array.isArray(data) ? data : (data || EMPTY_ARRAY);
                setters[key]?.(arr);
                loadedRef.current.add(key);
                return arr;
            } catch (err) {
                console.error(`[DataContext] Erro ao buscar ${key}:`, err);
                // Em caso de 401, faz logout global
                if (err?.message && err.message.includes('401')) {
                    logout?.();
                }
                return null;
            } finally {
                inFlightRef.current.delete(key);
            }
        })();

        inFlightRef.current.set(key, promise);
        return promise;
    }, [user, setters, logout]);

    // ------------------------------------------------------------------------
    // ensure: garante que um recurso está carregado (não refaz se já tem)
    // ------------------------------------------------------------------------
    const ensure = useCallback(async (key) => {
        if (loadedRef.current.has(key)) {
            return; // já carregado, nada a fazer
        }
        await fetchResource(key);
    }, [fetchResource]);

    // ------------------------------------------------------------------------
    // ensureAll: garante múltiplos recursos em paralelo
    // ------------------------------------------------------------------------
    const ensureAll = useCallback(async (keys) => {
        if (!Array.isArray(keys) || keys.length === 0) return;
        const missing = keys.filter(k => !loadedRef.current.has(k));
        if (missing.length === 0) return;
        await Promise.all(missing.map(k => fetchResource(k)));
    }, [fetchResource]);

    // ------------------------------------------------------------------------
    // refresh: força refetch ignorando cache
    // ------------------------------------------------------------------------
    const refresh = useCallback(async (key) => {
        loadedRef.current.delete(key);
        inFlightRef.current.delete(key);
        return fetchResource(key);
    }, [fetchResource]);

    // ------------------------------------------------------------------------
    // invalidate: marca como "stale" (próximo ensure refaz)
    // ------------------------------------------------------------------------
    const invalidate = useCallback((key) => {
        loadedRef.current.delete(key);
    }, []);

    // ------------------------------------------------------------------------
    // reload: recarrega tudo que já está cacheado (compatibilidade com o
    //         `reloadData` antigo que era passado como prop)
    // ------------------------------------------------------------------------
    const reload = useCallback(async () => {
        const cached = Array.from(loadedRef.current);
        if (cached.length === 0) return;

        setSyncing(true);
        try {
            // Limpa o cache primeiro, depois refaz
            cached.forEach(k => {
                loadedRef.current.delete(k);
                inFlightRef.current.delete(k);
            });
            await Promise.all(cached.map(k => fetchResource(k)));
        } finally {
            setSyncing(false);
        }
    }, [fetchResource]);

    // ------------------------------------------------------------------------
    // Bootstrap: carrega os recursos ESSENCIAIS após login
    // ------------------------------------------------------------------------
    useEffect(() => {
        if (!user) {
            setBootstrapLoading(false);
            return;
        }

        let cancelled = false;
        setBootstrapLoading(true);

        const bootstrap = async () => {
            const essentials = RESOURCE_KEYS.filter(k =>
                RESOURCE_DEFS[k].essential && RESOURCE_DEFS[k].allowedFor(user)
            );

            try {
                // Usamos Promise.allSettled para que UMA falha não derrube o boot
                await Promise.allSettled(essentials.map(k => fetchResource(k)));
            } finally {
                if (!cancelled) setBootstrapLoading(false);
            }
        };

        bootstrap();

        return () => { cancelled = true; };
    }, [user, fetchResource]);

    // ------------------------------------------------------------------------
    // Reset de estado ao logout
    // ------------------------------------------------------------------------
    useEffect(() => {
        if (!user) {
            loadedRef.current.clear();
            inFlightRef.current.clear();
            setVehicles(EMPTY_ARRAY);
            setObras(EMPTY_ARRAY);
            setEmployees(EMPTY_ARRAY);
            setRawPartners(EMPTY_ARRAY);
            setRevisions(EMPTY_ARRAY);
            setExpenses(EMPTY_ARRAY);
            setRefuelings(EMPTY_ARRAY);
            setRawComboioTransactions(EMPTY_ARRAY);
            setRawFines(EMPTY_ARRAY);
            setDiarioDeBordoLogs(EMPTY_ARRAY);
            setDailyWorkLogs(EMPTY_ARRAY);
            setOrders(EMPTY_ARRAY);
        }
    }, [user]);

    // ------------------------------------------------------------------------
    // Socket.io: conexão única e tratamento de server:sync
    // ------------------------------------------------------------------------
    useEffect(() => {
        if (!user) return;

        const SOCKET_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').replace('/api', '');
        const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
        setSocket(s);

        s.on('connect', () => {
            console.log('🟢 Conectado ao Socket.io');
        });

        s.on('disconnect', () => {
            console.log('🔴 Desconectado do Socket.io');
        });

        // Sincronização: só refaz fetch de recursos QUE JÁ ESTÃO no cache.
        // Isso elimina o "tempo gasto buscando coisas que ninguém abriu ainda".
        s.on('server:sync', async ({ targets } = {}) => {
            if (!Array.isArray(targets)) return;

            const resourcesToRefresh = targets
                .map(t => TARGET_TO_RESOURCE[t])
                .filter(Boolean)
                .filter(r => loadedRef.current.has(r)); // só refresca o que já carregamos

            if (resourcesToRefresh.length === 0) return;

            setSyncing(true);
            try {
                await Promise.all(resourcesToRefresh.map(r => refresh(r)));
            } finally {
                setSyncing(false);
            }
        });

        return () => {
            s.disconnect();
            setSocket(null);
        };
    }, [user, refresh]);

    // ------------------------------------------------------------------------
    // Derivações memoizadas (ordenações)
    // ------------------------------------------------------------------------
    const partners = useMemo(() => {
        if (rawPartners.length === 0) return EMPTY_ARRAY;
        return [...rawPartners].sort((a, b) =>
            (a.razaoSocial || '').localeCompare(b.razaoSocial || '')
        );
    }, [rawPartners]);

    const comboioTransactions = useMemo(() => {
        if (rawComboioTransactions.length === 0) return EMPTY_ARRAY;
        return [...rawComboioTransactions].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [rawComboioTransactions]);

    const fines = useMemo(() => {
        if (rawFines.length === 0) return EMPTY_ARRAY;
        return [...rawFines].sort((a, b) =>
            new Date(b.dataInfracao).getTime() - new Date(a.dataInfracao).getTime()
        );
    }, [rawFines]);

    // ------------------------------------------------------------------------
    // Valor do contexto
    // ------------------------------------------------------------------------
    const value = useMemo(() => ({
        // Dados (essenciais)
        vehicles,
        obras,
        employees,
        partners,

        // Dados (lazy)
        revisions,
        expenses,
        refuelings,
        comboioTransactions,
        fines,
        diarioDeBordoLogs,
        dailyWorkLogs,
        orders,

        // Status
        bootstrapLoading,
        syncing,

        // API
        ensure,
        ensureAll,
        refresh,
        invalidate,
        reload,

        // Socket.io
        socket,
    }), [
        vehicles, obras, employees, partners,
        revisions, expenses, refuelings, comboioTransactions, fines,
        diarioDeBordoLogs, dailyWorkLogs, orders,
        bootstrapLoading, syncing,
        ensure, ensureAll, refresh, invalidate, reload,
        socket,
    ]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

// ============================================================================
// Hooks de consumo
// ============================================================================

export const useData = () => {
    const ctx = useContext(DataContext);
    if (!ctx) {
        throw new Error('useData deve ser usado dentro de DataProvider');
    }
    return ctx;
};

/**
 * Hook auxiliar para páginas que dependem de recursos "lazy".
 * Uso:
 *   const { fines, ensureAll } = useData();
 *   useEnsureResources(['fines', 'expenses']);
 *
 * Internamente faz `ensureAll(keys)` na montagem da página.
 */
export const useEnsureResources = (keys) => {
    const { ensureAll } = useData();
    useEffect(() => {
        if (Array.isArray(keys) && keys.length > 0) {
            ensureAll(keys);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(keys)]);
};
