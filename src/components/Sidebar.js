import React, { useState, useEffect } from 'react';
import {
    Building, HardHat, ClipboardCheck, FileText,
    Fuel, Wrench, User, Shield, LogOut, Key,
    ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
    Radio
} from 'lucide-react';

const Sidebar = ({ currentPage, setCurrentPage, user, logout, onChangePassword, pendingSolicitacoesCount }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isAdmin = user?.user_type === 'admin';
    const isSupervisor = user?.user_type === 'supervisor';
    const isViewer = user?.user_type === 'viewer' || user?.user_type === 'visualizador';
    const canRefuel = user?.podeAcessarAbastecimento || isAdmin;

    const navGroups = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: <Building size={16} />,
            items: [
                { id: 'dashboard', label: 'Painel Geral' },
            ],
        },
        {
            id: 'obras',
            label: 'Obras',
            icon: <HardHat size={16} />,
            items: [
                { id: 'obras',                label: 'Obras' },
                { id: 'supervisor_dashboard', label: 'Gestão de Obras (TV)', hidden: !isAdmin && !isSupervisor },
                { id: 'expenses',             label: 'Despesas' },
            ],
        },
        {
            id: 'faturamento',
            label: 'Faturamento',
            icon: <ClipboardCheck size={16} />,
            items: [
                { id: 'operacional', label: 'Central Operacional',    hidden: isViewer },
                { id: 'billing',     label: 'Relatório de Horas' },
            ],
        },
        {
            id: 'relatorios',
            label: 'Relatórios',
            icon: <FileText size={16} />,
            items: [
                { id: 'reports', label: 'Relatórios' },
            ],
        },
        {
            id: 'operacoes',
            label: 'Operações',
            icon: <Fuel size={16} />,
            hidden: !canRefuel,
            items: [
                { id: 'refueling',          label: 'Abastecimento' },
                { id: 'comboio',            label: 'Comboio' },
                { id: 'admin_solicitacoes', label: 'Solicitações (App)', badge: pendingSolicitacoesCount },
            ],
        },
        {
            id: 'oficina',
            label: 'Oficina',
            icon: <Wrench size={16} />,
            items: [
                { id: 'revisions', label: 'Revisões & Manutenções' },
                { id: 'tires',     label: 'Gestão de Pneus' },
                { id: 'orders',    label: 'Ordens (C/S)' },
            ],
        },
        {
            id: 'cadastros',
            label: 'Cadastros',
            icon: <User size={16} />,
            items: [
                { id: 'vehicles',  label: 'Veículos' },
                { id: 'employees', label: 'Funcionários' },
                { id: 'partners',  label: 'Fornecedores' },
                { id: 'inventory', label: 'Estoque / Peças' },
                { id: 'fines',     label: 'Multas' },
            ],
        },
        {
            id: 'rastreamento',
            label: 'Rastreamento',
            icon: <Radio size={16} />,
            hidden: !isAdmin,
            items: [
                { id: 'sigasul', label: 'SigaSul GPS' },
            ],
        },
        {
            id: 'admin',
            label: 'Administração',
            icon: <Shield size={16} />,
            hidden: !isAdmin,
            items: [
                { id: 'admin', label: 'Admin' },
            ],
        },
    ];

    const visibleGroups = navGroups.filter(g => !g.hidden);

    const getActiveGroupId = (pageId) => {
        for (const g of navGroups) {
            if (g.items.some(item => item.id === pageId)) return g.id;
        }
        // supervisor_detail é subpágina de supervisor_dashboard
        if (pageId === 'supervisor_detail') return 'obras';
        return null;
    };

    const [expandedGroups, setExpandedGroups] = useState(() => {
        const active = getActiveGroupId(currentPage);
        return new Set(active ? [active] : []);
    });

    useEffect(() => {
        const active = getActiveGroupId(currentPage);
        if (active) setExpandedGroups(prev => new Set([...prev, active]));
    }, [currentPage]);

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(groupId) ? next.delete(groupId) : next.add(groupId);
            return next;
        });
    };

    const isGroupActive = (group) =>
        group.items.some(item => item.id === currentPage) ||
        (group.id === 'obras' && currentPage === 'supervisor_detail');

    const renderItem = (item, inFlyout = false) => {
        if (item.hidden) return null;
        const isActive = currentPage === item.id;
        const base = inFlyout
            ? `flex items-center w-full px-3 py-1.5 text-xs transition-colors ${item.dimmed && !isActive ? 'opacity-50' : ''}`
            : `flex items-center w-full px-2 py-1.5 rounded-md text-xs transition-all duration-200 group relative ${item.dimmed && !isActive ? 'opacity-50 hover:opacity-100' : ''}`;
        const active = isActive
            ? inFlyout ? 'bg-yellow-500 text-slate-900 font-bold' : 'bg-yellow-500 text-slate-900 shadow-md font-bold'
            : inFlyout ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white';

        return (
            <li key={item.id}>
                <button onClick={() => setCurrentPage(item.id)} className={`${base} ${active}`}>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.badge > 0 && (
                        <span className={`${inFlyout ? '' : 'absolute right-2'} bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse`}>
                            {item.badge}
                        </span>
                    )}
                </button>
            </li>
        );
    };

    return (
        <div className={`bg-slate-900 text-slate-300 shadow-xl transition-all duration-300 ease-in-out flex flex-col ${isCollapsed ? 'w-14' : 'w-56'} h-full z-20`}>

            {/* Header */}
            <div className="h-14 flex items-center justify-between px-3 border-b border-slate-700 bg-slate-950 shrink-0">
                {!isCollapsed ? (
                    <img src="https://i.postimg.cc/pVnwyfRq/MAK-Servi-os-Logotipo.png" alt="MAK" className="h-8 object-contain" />
                ) : (
                    <div className="w-full flex justify-center">
                        <span className="font-bold text-yellow-500 text-xs">MAK</span>
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto custom-scrollbar py-2">
                {isCollapsed ? (
                    /* ── Modo recolhido: ícone do grupo + flyout ao hover ── */
                    <ul className="space-y-1 px-2">
                        {visibleGroups.map(group => (
                            <li key={group.id} className="relative group/flyout">
                                <button
                                    className={`flex items-center justify-center w-full p-2 rounded-md transition-all duration-200 ${
                                        isGroupActive(group)
                                            ? 'bg-yellow-500 text-slate-900 shadow-md'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                                    title={group.label}
                                >
                                    {group.icon}
                                    {/* badge no ícone do grupo se algum item tiver */}
                                    {group.items.some(i => i.badge > 0) && (
                                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    )}
                                </button>
                                {/* Flyout */}
                                <div className="hidden group-hover/flyout:block absolute left-full top-0 ml-1 z-50 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-2 pointer-events-auto">
                                    <div className="px-3 pb-1.5 mb-1 border-b border-slate-700">
                                        <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">{group.label}</p>
                                    </div>
                                    <ul>
                                        {group.items.map(item => renderItem(item, true))}
                                    </ul>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    /* ── Modo expandido: accordion por grupo ── */
                    <ul className="space-y-0.5 px-2">
                        {visibleGroups.map(group => (
                            <li key={group.id}>
                                {/* Header do grupo */}
                                <button
                                    onClick={() => toggleGroup(group.id)}
                                    className={`flex items-center w-full px-2 py-1.5 rounded-md transition-colors text-xs font-bold uppercase tracking-wide group/gh ${
                                        isGroupActive(group)
                                            ? 'text-yellow-500'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    <span className="mr-2">{group.icon}</span>
                                    <span className="flex-1 text-left">{group.label}</span>
                                    <span className="text-slate-600 group-hover/gh:text-slate-400 transition-colors">
                                        {expandedGroups.has(group.id) ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </span>
                                </button>

                                {/* Itens do grupo — animação por max-height */}
                                <div
                                    className="overflow-hidden transition-all duration-200 ease-in-out"
                                    style={{ maxHeight: expandedGroups.has(group.id) ? '600px' : '0px' }}
                                >
                                    <ul className="ml-3 pl-2 border-l border-slate-700 mt-0.5 mb-1 space-y-0.5">
                                        {group.items.map(item => renderItem(item))}
                                    </ul>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </nav>

            {/* Footer */}
            <div className="p-2 border-t border-slate-700 bg-slate-950 shrink-0">
                <div className={`mb-2 px-2 flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-6 h-6 rounded-full bg-yellow-500 text-slate-900 flex items-center justify-center font-bold text-xs shrink-0">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    {!isCollapsed && (
                        <div className="ml-2 overflow-hidden">
                            <p className="text-xs text-white truncate font-medium">{user?.name}</p>
                            <button onClick={onChangePassword} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                <Key size={10} /> Trocar Senha
                            </button>
                        </div>
                    )}
                </div>
                <button
                    onClick={logout}
                    className="flex items-center w-full px-2 py-1.5 rounded-md transition-colors duration-200 hover:bg-red-900/50 text-slate-400 hover:text-red-400"
                    title="Sair"
                >
                    <LogOut size={16} />
                    {!isCollapsed && <span className="ml-3 text-xs font-bold">Sair</span>}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
