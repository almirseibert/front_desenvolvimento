import React from 'react';

/**
 * Configuração centralizada de status de veículos.
 * Usa os tokens CSS do tema Terroso Mineral (design_handoff/tokens).
 */
export const VEHICLE_STATUS_CONFIG = {
    'Disponível': {
        bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', dot: '#10b981', pulse: false,
    },
    'Em Obra': {
        bg: '#e0f2fe', border: '#bae6fd', text: '#0c4a6e', dot: '#0ea5e9', pulse: false,
    },
    'Em Operação': {
        bg: '#ede9fe', border: '#ddd6fe', text: '#3730a3', dot: '#8b5cf6', pulse: false,
    },
    'Em Manutenção': {
        bg: '#ffedd5', border: '#fed7aa', text: '#9a3412', dot: '#f97316', pulse: false,
    },
    'Aguardando Manutenção': {
        bg: '#fef3c7', border: '#fde68a', text: '#78350f', dot: '#fbbf24', pulse: true,
    },
    'Sucata': {
        bg: '#f4f4f5', border: '#d4d4d8', text: '#3f3f46', dot: '#71717a', pulse: false,
    },
    'Inativo': {
        bg: '#f3f4f6', border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af', pulse: false,
    },
    'Terceirizado': {
        bg: '#f3e8ff', border: '#e9d5ff', text: '#6b21a8', dot: '#a855f7', pulse: false,
    },
};

/**
 * StatusBadge — badge de status de veículo com dot colorido.
 *
 * Props:
 *  status   string  — chave do VEHICLE_STATUS_CONFIG (ex: 'Disponível')
 *  micro    bool    — variante menor para tabelas (10px, padding menor)
 *  label    string  — sobrescreve o texto exibido (padrão: usa o próprio status)
 *  style    object  — estilos extras no container
 *  className string — classes extras
 */
const StatusBadge = ({ status, micro = false, label, style: extraStyle = {}, className = '' }) => {
    const cfg = VEHICLE_STATUS_CONFIG[status];
    if (!cfg) return (
        <span
            className={className}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                borderRadius: 9999, padding: micro ? '2px 7px' : '4px 10px',
                fontSize: micro ? 10 : 12, fontWeight: 700,
                background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280',
                whiteSpace: 'nowrap',
                ...extraStyle,
            }}
        >
            {label ?? status ?? '—'}
        </span>
    );

    return (
        <span
            className={className}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                borderRadius: 9999, padding: micro ? '2px 7px' : '4px 10px',
                fontSize: micro ? 10 : 12, fontWeight: 700,
                background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text,
                whiteSpace: 'nowrap',
                ...extraStyle,
            }}
        >
            {!micro && (
                <span
                    className={cfg.pulse ? 'dot-pulse' : ''}
                    style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: cfg.dot, flexShrink: 0,
                    }}
                />
            )}
            {label ?? status}
        </span>
    );
};

/**
 * RoleBadge — badge de papel de usuário.
 */
export const ROLE_BADGE_CONFIG = {
    admin:        { bg: '#dbeafe', border: '#bfdbfe', text: '#1e40af', label: 'Admin' },
    editor:       { bg: '#fef9c3', border: '#fef08a', text: '#854d0e', label: 'Editor' },
    viewer:       { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569', label: 'Visualizador' },
    visualizador: { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569', label: 'Visualizador' },
    vencido:      { bg: '#fdf0ec', border: '#e8c8bc', text: '#b03828', label: 'Vencido' },
};

export const RoleBadge = ({ role, label: labelOverride, className = '' }) => {
    const cfg = ROLE_BADGE_CONFIG[role?.toLowerCase()] || ROLE_BADGE_CONFIG.viewer;
    return (
        <span
            className={className}
            style={{
                display: 'inline-flex', alignItems: 'center',
                borderRadius: 9999, padding: '2px 7px',
                fontSize: 10, fontWeight: 700,
                background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text,
                whiteSpace: 'nowrap',
            }}
        >
            {labelOverride ?? cfg.label}
        </span>
    );
};

export default StatusBadge;
