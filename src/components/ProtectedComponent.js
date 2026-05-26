import React from 'react';
// CORREÇÃO: O caminho foi ajustado de './AuthContext' para '../contexts/AuthContext'
import { useAuth } from '../contexts/AuthContext'; 

/**
 * Componente de Proteção Baseado em Função (RBAC) e Flags de Permissão.
 * Renderiza os filhos apenas se o usuário tiver a permissão necessária.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - O conteúdo a ser renderizado se a permissão for concedida.
 * @param {('admin'|'editor'|'viewer'|'refueling')} props.requiredPermission - A permissão necessária.
 */
const ProtectedComponent = ({ children, requiredPermission }) => {
    // 1. Obtenha o objeto 'user' completo do contexto.
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    // 2. Defina os níveis de permissão hierárquicos.
    const permissionLevels = {
        admin: 3,
        editor: 2,
        viewer: 1,
    };

    // 3. Verifique se é uma permissão especial (não hierárquica).
    if (requiredPermission === 'refueling') {
        // Verifica a flag 'podeAcessarAbastecimento'
        // Seu backend (rota /auth/me) DEVE juntar esta informação
        // da tabela 'employees' no objeto 'user'.
        // Admins também têm acesso
        const hasPermission = !!user.podeAcessarAbastecimento || user.user_type === 'admin';
        return hasPermission ? <>{children}</> : null;
    }

    // 4. Se for uma permissão hierárquica, compare os níveis.
    const requiredLevel = permissionLevels[requiredPermission];
    
    // ATUALIZADO: Usa 'user_type' (do seu SQL) em vez de 'role'.
    // Seu backend (rota /auth/me) DEVE incluir este campo.
    const userLevel = permissionLevels[user.user_type] || 0; 

    if (requiredLevel !== undefined) {
        // O usuário tem permissão se o nível dele for maior ou igual ao necessário
        const hasPermission = userLevel >= requiredLevel;
        return hasPermission ? <>{children}</> : null;
    }
    
    // Se a permissão requerida não for reconhecida, não renderiza por segurança.
    console.warn(`ProtectedComponent: Permissão desconhecida '${requiredPermission}'.`);
    return null;
};

export default ProtectedComponent;
