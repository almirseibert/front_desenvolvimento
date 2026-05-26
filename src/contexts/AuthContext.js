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
        isViewer: false, // --- NOVA PERMISSÃO ---
        canAccessRefueling: false,
    });
    const [loading, setLoading] = useState(true);

    // Função para definir o usuário e as permissões com base nos dados da API
    const setUserAndPermissions = (userData) => {
        if (userData) {
            setUser(userData);
            // Normaliza o papel do usuário (tenta pegar user_type, role ou define viewer como fallback)
            const role = userData.user_type || userData.role || 'viewer'; 
            const canAccess = userData.podeAcessarAbastecimento || false;

            // Normaliza string para comparação
            const roleNormalized = role.toLowerCase();

            setPermissions({
                isOperator: roleNormalized === 'operador',
                isEditor: ['editor', 'admin'].includes(roleNormalized),
                isAdmin: roleNormalized === 'admin',
                // Define se é visualizador explicitamente
                isViewer: roleNormalized === 'viewer' || roleNormalized === 'visualizador',
                
                canAccessRefueling: canAccess || roleNormalized === 'admin', 
            });
        } else {
            setUser(null);
            setPermissions({
                isOperator: false,
                isEditor: false,
                isAdmin: false,
                isViewer: false,
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
                const userData = await apiClient.getMe();
                setUserAndPermissions(userData);
                return { success: true, user: userData };
            } else {
                throw new Error("Token não recebido do servidor.");
            }
        } catch (error) {
            console.error("Erro no processo de login:", error);
            localStorage.removeItem('authToken'); 
            setUserAndPermissions(null);
            throw error; 
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        setUserAndPermissions(null);
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