import React, { useState, useEffect } from 'react';
import {
    Building, HardHat, ClipboardCheck, FileText,
    Fuel, Wrench, User, Shield, LogOut, Key,
    ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
    Radio
} from 'lucide-react';
import { ROLE_PAGE_ACCESS } from '../utils/permissions';

const Sidebar = ({ currentPage, setCurrentPage, user, logout, onChangePassword, pendingSolicitacoesCount }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const roleNorm = user?.roleNormalized || (user?.user_type || 'viewer').toLowerCase();
    const userPages = ROLE_PAGE_ACCESS[roleNorm] || ROLE_PAGE_ACCESS['viewer'];
    const canAccess = (pageId) => userPages.includes('*') || userPages.includes(pageId);
    const canAccessAny = (pageIds) => pageIds.some(id => canAccess(id));

    const navGroups = [
        {
            id: 'dashboard',
            label: 'Principal',
            icon: <Building size={14} />,
            hidden: !canAccess('dashboard'),
            items: [
                { id: 'dashboard', label: 'Painel Geral' },
            ],
        },
        {
            id: 'obras',
            label: 'Obras',
            icon: <HardHat size={14} />,
            hidden: !canAccessAny(['obras', 'expenses', 'supervisor_dashboard']),
            items: [
                { id: 'obras',                label: 'Obras' },
                { id: 'supervisor_dashboard', label: 'Gestão de Obras (TV)', hidden: !canAccess('supervisor_dashboard') },
                { id: 'expenses',             label: 'Despesas',             hidden: !canAccess('expenses') },
            ],
        },
        {
            id: 'faturamento',
            label: 'Faturamento',
            icon: <ClipboardCheck size={14} />,
            hidden: !canAccessAny(['operacional', 'billing']),
            items: [
                { id: 'operacional', label: 'Central Operacional', hidden: !canAccess('operacional') },
                { id: 'billing',     label: 'Relatório de Horas',  hidden: !canAccess('billing') },
            ],
        },
        {
            id: 'relatorios',
            label: 'Relatórios',
            icon: <FileText size={14} />,
            hidden: !canAccess('reports'),
            items: [
                { id: 'reports', label: 'Relatórios' },
            ],
        },
        {
            id: 'operacoes',
            label: 'Operações',
            icon: <Fuel size={14} />,
            hidden: !canAccessAny(['refueling', 'comboio', 'admin_solicitacoes']),
            items: [
                { id: 'refueling',          label: 'Abastecimento',     hidden: !canAccess('refueling') },
                { id: 'comboio',            label: 'Comboio',           hidden: !canAccess('comboio') },
                { id: 'admin_solicitacoes', label: 'Solicitações (App)', hidden: !canAccess('admin_solicitacoes'), badge: pendingSolicitacoesCount },
            ],
        },
        {
            id: 'oficina',
            label: 'Oficina',
            icon: <Wrench size={14} />,
            hidden: !canAccessAny(['revisions', 'tires', 'orders']),
            items: [
                { id: 'revisions', label: 'Revisões & Manutenções', hidden: !canAccess('revisions') },
                { id: 'tires',     label: 'Gestão de Pneus',        hidden: !canAccess('tires') },
                { id: 'orders',    label: 'Ordens (C/S)',            hidden: !canAccess('orders') },
            ],
        },
        {
            id: 'cadastros',
            label: 'Cadastros',
            icon: <User size={14} />,
            hidden: !canAccessAny(['vehicles', 'employees', 'partners', 'inventory', 'fines']),
            items: [
                { id: 'vehicles',  label: 'Veículos',        hidden: !canAccess('vehicles') },
                { id: 'employees', label: 'Funcionários',    hidden: !canAccess('employees') },
                { id: 'partners',  label: 'Fornecedores',    hidden: !canAccess('partners') },
                { id: 'inventory', label: 'Estoque / Peças', hidden: !canAccess('inventory') },
                { id: 'fines',     label: 'Multas',          hidden: !canAccess('fines') },
            ],
        },
        {
            id: 'rastreamento',
            label: 'Rastreamento',
            icon: <Radio size={14} />,
            hidden: !canAccess('sigasul'),
            items: [
                { id: 'sigasul', label: 'SigaSul GPS' },
            ],
        },
        {
            id: 'admin',
            label: 'Administração',
            icon: <Shield size={14} />,
            hidden: !canAccess('admin'),
            items: [
                { id: 'admin_usuarios',    label: 'Usuários & Acesso' },
                { id: 'admin_frota',       label: 'Frota' },
                { id: 'admin_comunicacao', label: 'Comunicação' },
                { id: 'admin_sistema',     label: 'Sistema' },
            ],
        },
    ];

    const visibleGroups = navGroups.filter(g => !g.hidden);

    const getActiveGroupId = (pageId) => {
        for (const g of navGroups) {
            if (g.items.some(item => item.id === pageId)) return g.id;
        }
        if (pageId === 'supervisor_detail') return 'obras';
        return null;
    };

    const [expandedGroups, setExpandedGroups] = useState(() => {
        const active = getActiveGroupId(currentPage);
        return new Set(active ? [active] : []);
    });

    useEffect(() => {
        const active = getActiveGroupId(currentPage);
        if (active) setExpandedGroups(new Set([active]));
    }, [currentPage]);

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => {
            if (prev.has(groupId)) return new Set();
            return new Set([groupId]);
        });
    };

    const isGroupActive = (group) =>
        group.items.some(item => item.id === currentPage) ||
        (group.id === 'obras' && currentPage === 'supervisor_detail');

    const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
    const userRole = (() => {
        const t = user?.user_type || '';
        if (t === 'admin') return 'Administrador';
        if (t === 'editor') return 'Editor';
        if (t === 'operador') return 'Operador';
        return 'Visualizador';
    })();

    /* ── Item de navegação (modo expandido) ── */
    const renderItem = (item, inFlyout = false) => {
        if (item.hidden) return null;
        const isActive = currentPage === item.id;

        if (inFlyout) {
            return (
                <li key={item.id}>
                    <button
                        onClick={() => setCurrentPage(item.id)}
                        className={`flex items-center w-full px-3 py-1.5 transition-colors ${
                            isActive
                                ? 'text-white font-bold'
                                : 'hover:text-[#f0ebe3]'
                        }`}
                        style={{ fontSize: 13, color: isActive ? '#ffffff' : '#c4b8a8' }}
                    >
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge > 0 && (
                            <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                {item.badge}
                            </span>
                        )}
                    </button>
                </li>
            );
        }

        return (
            <li key={item.id}>
                <button
                    onClick={() => setCurrentPage(item.id)}
                    className="flex items-center w-full px-2 py-1.5 rounded-md transition-all duration-150 relative"
                    style={isActive
                        ? { fontSize: 13, background: '#9E7A42', color: '#ffffff', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }
                        : { fontSize: 13, color: '#c4b8a8' }
                    }
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#2e2820'; e.currentTarget.style.color = '#f0ebe3'; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#c4b8a8'; } }}
                >
                    <span className="flex-1 text-left truncate" style={{ fontWeight: isActive ? 700 : 500 }}>
                        {item.label}
                    </span>
                    {item.badge > 0 && (
                        <span className="absolute right-2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                            {item.badge}
                        </span>
                    )}
                </button>
            </li>
        );
    };

    return (
        <div
            className="flex flex-col h-full z-20 transition-all duration-300 ease-in-out shrink-0"
            style={{
                width: isCollapsed ? 56 : 224,
                background: '#1c1a17',
                color: '#8a7a68',
            }}
        >
            {/* ── Logo / Header ── */}
            <div
                className="flex items-center shrink-0 px-3"
                style={{
                    height: 50,
                    borderBottom: '1px solid #3d3528',
                    background: '#1c1a17',
                    gap: 8,
                }}
            >
                {!isCollapsed && (
                    <>
                        <div
                            className="flex items-center justify-center rounded-lg shrink-0"
                            style={{ background: '#252018', padding: '5px 8px' }}
                        >
                            <span style={{ fontSize: 14, fontWeight: 900, color: '#9E7A42', letterSpacing: '-0.02em' }}>MAK</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#5a4e3a', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            Serviços
                        </span>
                    </>
                )}
                {isCollapsed && (
                    <div className="w-full flex justify-center">
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#9E7A42' }}>M</span>
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="ml-auto p-1 rounded transition-colors"
                    style={{ color: '#5a4e3a' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#2e2820'; e.currentTarget.style.color = '#f0ebe3'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#5a4e3a'; }}
                    title={isCollapsed ? 'Expandir' : 'Recolher'}
                >
                    {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                </button>
            </div>

            {/* ── Nav ── */}
            <nav className="flex-1 overflow-y-auto mak-scrollbar py-2">
                {isCollapsed ? (
                    /* Modo recolhido: ícone do grupo + flyout ao hover */
                    <ul className="space-y-0.5 px-1.5">
                        {visibleGroups.map(group => {
                            const active = isGroupActive(group);
                            const hasBadge = group.items.some(i => i.badge > 0);
                            return (
                                <li key={group.id} className="relative group/flyout">
                                    <button
                                        className="flex items-center justify-center w-full p-2 rounded-md transition-all duration-150 relative"
                                        style={active
                                            ? { background: '#9E7A42', color: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }
                                            : { color: '#8a7a68' }
                                        }
                                        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#2e2820'; e.currentTarget.style.color = '#f0ebe3'; } }}
                                        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#8a7a68'; } }}
                                        title={group.label}
                                    >
                                        {group.icon}
                                        {hasBadge && (
                                            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                                        )}
                                    </button>
                                    {/* Flyout */}
                                    <div
                                        className="hidden group-hover/flyout:block absolute left-full top-0 ml-1 z-50 w-48 rounded-lg py-2 pointer-events-auto"
                                        style={{ background: '#252018', border: '1px solid #3d3528', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}
                                    >
                                        <div className="px-3 pb-1.5 mb-1" style={{ borderBottom: '1px solid #3d3528' }}>
                                            <p style={{ fontSize: 9, fontWeight: 700, color: '#9E7A42', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                                {group.label}
                                            </p>
                                        </div>
                                        <ul>
                                            {group.items.map(item => renderItem(item, true))}
                                        </ul>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    /* Modo expandido: accordion por grupo */
                    <ul className="space-y-0.5 px-2">
                        {visibleGroups.map(group => {
                            const active = isGroupActive(group);
                            const expanded = expandedGroups.has(group.id);
                            return (
                                <li key={group.id}>
                                    {/* Header do grupo */}
                                    <button
                                        onClick={() => toggleGroup(group.id)}
                                        className="flex items-center w-full px-2 py-1.5 rounded-md transition-colors"
                                        style={{ color: active ? '#9E7A42' : '#a89880' }}
                                        onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#d4c8b8'; } }}
                                        onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#a89880'; } }}
                                    >
                                        <span className="mr-2 shrink-0" style={{ color: active ? '#9E7A42' : '#a89880' }}>
                                            {group.icon}
                                        </span>
                                        <span
                                            className="flex-1 text-left uppercase"
                                            style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}
                                        >
                                            {group.label}
                                        </span>
                                        <span style={{ color: active ? '#9E7A42' : '#7a6e60' }}>
                                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </span>
                                    </button>

                                    {/* Itens do grupo */}
                                    <div
                                        className="overflow-hidden transition-all duration-200 ease-in-out"
                                        style={{ maxHeight: expanded ? '600px' : '0px' }}
                                    >
                                        <ul className="ml-3 pl-2 mt-0.5 mb-1 space-y-0.5" style={{ borderLeft: '1px solid #3d3528' }}>
                                            {group.items.map(item => renderItem(item))}
                                        </ul>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </nav>

            {/* ── Footer ── */}
            <div className="shrink-0 p-2" style={{ borderTop: '1px solid #3d3528' }}>
                {/* Usuário */}
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md mb-1 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div
                        className="flex items-center justify-center rounded-full shrink-0 text-white font-bold"
                        style={{ width: 26, height: 26, background: '#9E7A42', fontSize: 10, fontWeight: 700 }}
                    >
                        {userInitial}
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden">
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#f0ebe3' }} className="truncate">{user?.name}</p>
                            <div className="flex items-center gap-1">
                                <span style={{ fontSize: 9, color: '#5a4e3a' }}>{userRole}</span>
                                <button
                                    onClick={onChangePassword}
                                    className="flex items-center gap-0.5 transition-colors"
                                    style={{ fontSize: 9, color: '#5a4e3a' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#9E7A42'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#5a4e3a'}
                                    title="Trocar senha"
                                >
                                    · <Key size={9} /> Trocar Senha
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sair */}
                <button
                    onClick={logout}
                    className={`flex items-center w-full px-2 py-1.5 rounded-md transition-all duration-150 ${isCollapsed ? 'justify-center' : 'gap-2'}`}
                    style={{ color: '#5a4e3a' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(176,56,40,0.15)'; e.currentTarget.style.color = '#b03828'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#5a4e3a'; }}
                    title="Sair"
                >
                    <LogOut size={14} />
                    {!isCollapsed && <span style={{ fontSize: 12, fontWeight: 600 }}>Sair</span>}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
