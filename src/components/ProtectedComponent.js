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

    // Roles com permissão de escrita (criar/editar/excluir)
    // rh e faturamento são read-only dentro das páginas
    const EDITOR_ROLES = ['admin', 'gerencia', 'editor', 'abastecimento', 'oficina'];

    if (requiredPermission === 'refueling') {
        // Mantém flag legada de BD para retrocompat + roles novos
        const hasPermission =
            !!user.podeAcessarAbastecimento ||
            EDITOR_ROLES.includes(user.user_type?.toLowerCase());
        return hasPermission ? <>{children}</> : null;
    }

    if (requiredPermission === 'admin') {
        return user.user_type?.toLowerCase() === 'admin' ? <>{children}</> : null;
    }

    if (requiredPermission === 'editor') {
        return EDITOR_ROLES.includes(user.user_type?.toLowerCase()) ? <>{children}</> : null;
    }

    if (requiredPermission === 'obra-editor') {
        // Apenas admin, gerencia e editor podem criar/editar/finalizar obras
        return ['admin', 'gerencia', 'editor'].includes(user.user_type?.toLowerCase()) ? <>{children}</> : null;
    }

    if (requiredPermission === 'viewer') {
        return user.user_type?.toLowerCase() !== 'operador' ? <>{children}</> : null;
    }

    console.warn(`ProtectedComponent: Permissão desconhecida '${requiredPermission}'.`);
    return null;
};

export default ProtectedComponent;
