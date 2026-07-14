// src/contexts/AuthContext.js
import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import apiClient from '../services/apiClient'; 

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState({
        isOperator: false,
        isEditor: false,
        isAdmin: false,
        isViewer: false,
        isRH: false,
        isFaturamento: false,
        isAbastecimento: false,
        isOficina: false,
        isGerencia: false,
        canAccessRefueling: false,
    });
    const [loading, setLoading] = useState(true);

    const setUserAndPermissions = (userData) => {
        if (userData) {
            const role = userData.user_type || userData.role || 'viewer';
            const roleNormalized = role.toLowerCase();
            const canAccess = userData.podeAcessarAbastecimento || false;

            // Roles que têm 'refueling' em ROLE_PAGE_ACCESS — BD flag mantido para retrocompat
            const REFUELING_ROLES = ['admin', 'gerencia', 'abastecimento', 'editor'];
            const canAccessRefueling = canAccess || REFUELING_ROLES.includes(roleNormalized);

            setUser({ ...userData, roleNormalized });
            setPermissions({
                isOperator:      roleNormalized === 'operador',
                isEditor:        ['editor', 'admin'].includes(roleNormalized),
                isAdmin:         roleNormalized === 'admin',
                isViewer:        ['viewer', 'visualizador'].includes(roleNormalized),
                isRH:            roleNormalized === 'rh',
                isFaturamento:   roleNormalized === 'faturamento',
                isAbastecimento: roleNormalized === 'abastecimento',
                isOficina:       roleNormalized === 'oficina',
                isGerencia:      roleNormalized === 'gerencia',
                canAccessRefueling,
            });
        } else {
            setUser(null);
            setPermissions({
                isOperator: false,
                isEditor: false,
                isAdmin: false,
                isViewer: false,
                isRH: false,
                isFaturamento: false,
                isAbastecimento: false,
                isOficina: false,
                isGerencia: false,
                canAccessRefueling: false,
            });
        }
    };

    // Efeito para verificar o token no carregamento inicial
    useEffect(() => {
        const checkAuth = async () => {
            setLoading(true);
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const userData = await apiClient.getMe(); 
                    setUserAndPermissions(userData);
                } catch (error) {
                    console.error("Falha ao buscar dados do usuário com token existente:", error);
                    localStorage.removeItem('authToken');
                    setUserAndPermissions(null);
                }
            } else {
                setUserAndPermissions(null);
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            const response = await apiClient.login(email, password);
            const token = response.token;

            if (token) {
                localStorage.setItem('authToken', token);
                if (response.refreshToken) {
                    localStorage.setItem('refreshToken', response.refreshToken);
                }
                const userData = await apiClient.getMe();
                setUserAndPermissions(userData);
                return { success: true, user: userData };
            } else {
                throw new Error("Token não recebido do servidor.");
            }
        } catch (error) {
            console.error("Erro no processo de login:", error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            setUserAndPermissions(null);
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        // Revoga o refresh token no servidor (best-effort) antes de limpar local.
        apiClient.logout?.();
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        setUserAndPermissions(null);
    }, []);

    // O apiClient dispara 'auth:logout' quando a renovação silenciosa falha
    // (refresh token expirado/revogado). Aqui limpamos o estado para a UI
    // voltar à tela de login sem o usuário ver erros soltos.
    useEffect(() => {
        const handleForcedLogout = () => setUserAndPermissions(null);
        window.addEventListener('auth:logout', handleForcedLogout);
        return () => window.removeEventListener('auth:logout', handleForcedLogout);
    }, []);

    const value = useMemo(() => ({ 
        user, 
        ...permissions, 
        loading, 
        login, 
        logout 
    }), [user, permissions, loading, login, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};