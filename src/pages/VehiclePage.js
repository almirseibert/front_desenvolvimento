import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    HardHat, Users, Wrench, ShieldAlert, Edit, Clock, Trash2, PlusCircle,
    Download, ChevronsUpDown, AlertTriangle, Truck,
    FileText, Ban, ClipboardCheck, Power, Package, Search,
    CheckCircle2, MoreVertical, FolderOpen
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';

import ProtectedComponent from '../components/ProtectedComponent';
import VehicleModal from '../components/VehicleModal';
import MaintenanceModal from '../components/MaintenanceModal';
import VehicleFinesModal from '../components/VehicleFinesModal';
import { formatObraNome } from '../utils/obraFormat';
import VehicleDetailModal from '../components/VehicleDetailModal';
import OperationalAssignmentModal from '../components/OperationalAssignmentModal';
import ObraAllocationModal from '../components/ObraAllocationModal';
import HistoryModal from '../components/HistoryModal';
import SearchableSelect from '../components/SearchableSelect';
import ChecklistModal from '../components/ChecklistModal';
import VehicleDocumentsModal from '../components/VehicleDocumentsModal';

import { getVehicleMainReading, checkVehicleRestrictions } from '../utils/vehicleRules';

// STATUS_CONFIG removido — usar StatusBadge de src/components/ui/StatusBadge.js

const ALL_STATUS_OPTIONS = ['Disponível', 'Em Obra', 'Em Operação', 'Em Manutenção', 'Aguardando Manutenção', 'Sucata'];

// ─── Menu de ações compacto com 3 pontos ─────────────────────────────────────
const VehicleActionMenu = ({ vehicle, canDo, handlers }) => {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const btnStyle = (color, bg) => ({
        padding: '5px 6px', borderRadius: 6, border: 'none', cursor: 'pointer',
        lineHeight: 0, background: bg || 'transparent', color: color || '#b0a090',
        transition: 'background 0.1s',
    });

    // Botão primário: apenas quando o veículo está em um status "ativo" que requer ação
    const renderPrimary = () => {
        if (!canDo('allocate') || !vehicle.ativo || vehicle.isSucata) return null;
        if (vehicle.computedStatus === 'Em Obra') return (
            <button
                style={btnStyle('#b03828', '#fdf0ec')}
                onMouseEnter={e => { e.currentTarget.style.background = '#fce8e4'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fdf0ec'; }}
                onClick={handlers.obraModal} title="Em Obra — clique para gerenciar"
            ><HardHat size={15}/></button>
        );
        if (vehicle.computedStatus === 'Em Operação') return (
            <button
                style={btnStyle('#b03828', '#fdf0ec')}
                onMouseEnter={e => { e.currentTarget.style.background = '#fce8e4'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fdf0ec'; }}
                onClick={handlers.opModal} title="Em Operação — clique para gerenciar"
            ><Users size={15}/></button>
        );
        if (vehicle.computedStatus === 'Em Manutenção' || vehicle.computedStatus === 'Aguardando Manutenção') return (
            <button
                style={btnStyle('#059669', '#ecfdf5')}
                onMouseEnter={e => { e.currentTarget.style.background = '#d1fae5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; }}
                onClick={handlers.maintenanceModal} title="Em Manutenção — clique para finalizar"
            ><Wrench size={15}/></button>
        );
        return null;
    };

    const MenuItem = ({ onClick, icon: Icon, label, color, divider }) => (
        <>
            {divider && <div style={{ height: 1, background: '#f0ebe3', margin: '2px 0' }}/>}
            <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                style={{ color: color || '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => { setOpen(false); onClick(); }}
            >
                <Icon size={13} style={{ flexShrink: 0 }}/> {label}
            </button>
        </>
    );

    return (
        <div className="relative flex items-center gap-0.5" ref={menuRef}>
            {renderPrimary()}
            <button
                onClick={() => setOpen(o => !o)}
                style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', lineHeight: 0, background: 'transparent', color: '#b0a090', transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f3ef'; e.currentTarget.style.color = '#6a5e4e'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b0a090'; }}
                title="Mais ações"
            >
                <MoreVertical size={15}/>
            </button>

            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: '100%', zIndex: 1000, marginTop: 4,
                    background: 'white', border: '1px solid #f0ebe3', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 185, overflow: 'hidden',
                }}>
                    {/* Ações de alocação quando disponível */}
                    {canDo('allocate') && vehicle.ativo && !vehicle.isSucata && vehicle.computedStatus === 'Disponível' && (<>
                        <MenuItem onClick={handlers.obraModal} icon={HardHat} label="Alocar a Obra" color="#059669"/>
                        <MenuItem onClick={handlers.opModal} icon={Users} label="Alocar a Operação" color="#0891b2"/>
                        <MenuItem onClick={handlers.maintenanceModal} icon={Wrench} label="Enviar p/ Manutenção" color="#ea580c"/>
                    </>)}

                    {canDo('checklist') && (
                        <MenuItem onClick={handlers.checklist} icon={ClipboardCheck} label="Checklists"
                            color={vehicle.checklistCount > 0 ? '#6b21a8' : undefined}
                            divider={canDo('allocate') && vehicle.ativo && !vehicle.isSucata && vehicle.computedStatus === 'Disponível'}/>
                    )}
                    {canDo('fines') && <MenuItem onClick={handlers.fines} icon={ShieldAlert} label="Multas" color="#c2410c"/>}
                    {canDo('history') && <MenuItem onClick={handlers.history} icon={Clock} label="Histórico"/>}
                    <MenuItem onClick={handlers.documents} icon={FolderOpen} label="Documentos" color="#9E7A42"/>

                    {canDo('edit') && (
                        <MenuItem onClick={handlers.edit} icon={Edit} label="Editar" color="#9E7A42" divider/>
                    )}
                    {canDo('block') && !vehicle.isSucata && (
                        <MenuItem
                            onClick={handlers.toggleStatus} icon={Power}
                            label={vehicle.ativo ? 'Inativar Veículo' : 'Reativar Veículo'}
                            color={vehicle.ativo ? '#b03828' : '#059669'}
                        />
                    )}
                    {canDo('delete') && (
                        <MenuItem onClick={handlers.delete} icon={Trash2} label="Excluir permanentemente" color="#b03828"/>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

const VehiclePage = ({
    user, vehicles = [], obras = [], revisions = [], employees = [], fines = [],
    setAlertMessage, initialFilter, PasswordConfirmationModal,
    vehicleGroups = {}, operationalSubGroups = [], apiClient, reloadData
}) => {

    const vehicleTypes = useMemo(() => {
        const existingTypes = (vehicles || []).map(v => v.tipo).filter(Boolean);
        const predefinedTypes = Object.values(vehicleGroups || {}).flat();
        return [...new Set([...existingTypes, ...predefinedTypes])].sort();
    }, [vehicles, vehicleGroups]);

    // --- Estados ---
    const [isModalOpen, setIsModalOpen] = useState(false);
const [vehicleTypeConfigs, setVehicleTypeConfigs] = useState([]);
    const [isObraAllocationModalOpen, setIsObraAllocationModalOpen] = useState(false);
    const [isOperationalModalOpen, setIsOperationalModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isFinesModalOpen, setIsFinesModalOpen] = useState(false);
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [vehicleToToggleStatus, setVehicleToToggleStatus] = useState(null);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [filters, setFilters] = useState({
        type: 'todos', status: 'todos', search: '',
        group: 'todos', showInactive: false, showSucata: false
    });
    const [sortConfig, setSortConfig] = useState({ key: 'registroInterno', direction: 'ascending' });

    useEffect(() => {
        if (initialFilter) setFilters(prev => ({ ...prev, ...initialFilter }));
    }, [initialFilter]);

    useEffect(() => {
        apiClient.getVehicleTypeConfigs().then(setVehicleTypeConfigs).catch(() => {});
    }, [apiClient]);

    const handleFilterChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFilters(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    // --- Processamento de Dados ---
    const processedVehicles = useMemo(() => {
        return (vehicles || []).map(v => {
            // "Sucata" é status permanente — não sofre override por alocações
            let currentStatus = v.status;
            if (currentStatus !== 'Sucata') {
                if (!currentStatus || currentStatus === 'Disponível') {
                    if (v.obraAtualId) currentStatus = 'Em Obra';
                    else if (v.operationalAssignment) currentStatus = 'Em Operação';
                    else if (v.maintenanceLocation) currentStatus = 'Em Manutenção';
                    else currentStatus = 'Disponível';
                }
            }
            const isSucata = currentStatus === 'Sucata';
            const readingData = getVehicleMainReading(v);
            const restrictions = isSucata ? [] : checkVehicleRestrictions(v, revisions);
            const obra = v.obraAtualId ? obras.find(o => o.id === v.obraAtualId) : null;

            return {
                ...v,
                computedStatus: currentStatus,
                isSucata,
                obra,
                vehicleReading: `${readingData.value ?? 'N/A'} ${readingData.unit}`,
                vehicleReadingRaw: readingData.raw,
                restrictions,
                ativo: v.ativo === undefined ? true : Boolean(v.ativo)
            };
        });
    }, [vehicles, revisions, obras]);

    // --- Cards de sumário ---
    const summary = useMemo(() => {
        // Frota própria: ativos, não-sucata, não-terceirizados
        const proprios = processedVehicles.filter(v => v.ativo && !v.isSucata && !v.isOutsourced);
        // Terceiros: ativos e não-sucata
        const terceiros = processedVehicles.filter(v => v.ativo && !v.isSucata && v.isOutsourced);
        return {
            // Frota própria (excluí terceiros de todos os contadores)
            total:       proprios.length,
            disponiveis: proprios.filter(v => v.computedStatus === 'Disponível').length,
            emObra:      proprios.filter(v => v.computedStatus === 'Em Obra').length,
            manutencao:  proprios.filter(v => ['Em Manutenção', 'Aguardando Manutenção'].includes(v.computedStatus)).length,
            comAlerta:   proprios.filter(v => v.restrictions.length > 0).length,
            sucata:      processedVehicles.filter(v => v.isSucata && !v.isOutsourced).length,
            // Terceiros (card próprio)
            terceiros:            terceiros.length,
            terceirosDisponiveis: terceiros.filter(v => v.computedStatus === 'Disponível').length,
            terceirosEmObra:      terceiros.filter(v => v.computedStatus === 'Em Obra').length,
            terceirosManutencao:  terceiros.filter(v => ['Em Manutenção', 'Aguardando Manutenção'].includes(v.computedStatus)).length,
        };
    }, [processedVehicles]);

    // --- Filtragem e Ordenação ---
    const filteredVehicles = useMemo(() => {
        let items = processedVehicles.filter(v => {
            const groups = vehicleGroups || {};
            const searchLower = filters.search.toLowerCase();

            const searchMatch = !searchLower ||
                (v.placa || '').toLowerCase().includes(searchLower) ||
                (v.registroInterno || '').toLowerCase().includes(searchLower) ||
                (v.marca || '').toLowerCase().includes(searchLower) ||
                (v.modelo || '').toLowerCase().includes(searchLower);

            const typeMatch  = filters.type  === 'todos' || v.tipo === filters.type;
            const groupMatch = filters.group === 'todos' || (groups[filters.group] && groups[filters.group].includes(v.tipo));

            // '_manutencao' é valor especial que agrupa Em Manutenção + Aguardando Manutenção
            const statusMatch = filters.status === 'todos' || (
                filters.status === '_manutencao'
                    ? ['Em Manutenção', 'Aguardando Manutenção'].includes(v.computedStatus)
                    : v.computedStatus === filters.status
            );

            if (v.isSucata   && !filters.showSucata)   return false;
            if (!v.ativo && !v.isSucata && !filters.showInactive) return false;

            return searchMatch && typeMatch && statusMatch && groupMatch;
        });

        items.sort((a, b) => {
            if (sortConfig.key === 'vehicleReading') {
                return sortConfig.direction === 'ascending'
                    ? a.vehicleReadingRaw - b.vehicleReadingRaw
                    : b.vehicleReadingRaw - a.vehicleReadingRaw;
            }
            const valA = String(a[sortConfig.key] || '').toLowerCase();
            const valB = String(b[sortConfig.key] || '').toLowerCase();
            const numA = parseInt(valA.replace(/\D/g, '')) || 0;
            const numB = parseInt(valB.replace(/\D/g, '')) || 0;
            if (valA.startsWith('re') && valB.startsWith('re') && numA !== numB) {
                return sortConfig.direction === 'ascending' ? numA - numB : numB - numA;
            }
            return sortConfig.direction === 'ascending'
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        });

        return items;
    }, [processedVehicles, filters, vehicleGroups, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    // --- Helpers Visuais ---
    const getRowStyle = (vehicle) => {
        if (vehicle.isSucata)  return 'opacity-70 hover:opacity-100 border-l-4 border-l-[#d4d4d8]';
        if (!vehicle.ativo)    return 'opacity-60 hover:opacity-100 border-l-4 border-l-[#e5e7eb]';
        if (vehicle.isOutsourced) return 'border-l-4 border-l-[#a855f7]';
        if (vehicle.restrictions.some(r => r.category === 'bloqueio' || r.type === 'bloqueio')) return 'border-l-4 border-l-[#b03828]';
        if (vehicle.restrictions.some(r => r.type === 'error'))   return 'border-l-4 border-l-[#f97316]';
        if (vehicle.restrictions.some(r => r.type === 'warning')) return 'border-l-4 border-l-[#fbbf24]';
        return 'border-l-4 border-l-transparent';
    };

    const renderAlertBadges = (restrictions, vehicle) => {
        if (vehicle.isSucata) return (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-500 text-white" title="Sucata">
                <Package size={8}/> SUCATA
            </span>
        );
        if (!vehicle.ativo) return (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-400 text-white" title="Inativo">
                <Ban size={8}/> INATIVO
            </span>
        );
        if (!restrictions || !restrictions.length) return null;
        const manutencao = restrictions.filter(r => r.category === 'manutencao');
        const documentos = restrictions.filter(r => r.category === 'documento');
        const bloqueio   = restrictions.filter(r => r.category === 'bloqueio' || r.type === 'bloqueio');
        // Ícone compacto com tooltip — sem texto para economizar espaço horizontal
        const dotStyle = (bg) => ({
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: '50%', background: bg, flexShrink: 0
        });
        return (
            <div className="flex gap-0.5 items-center">
                {bloqueio.length > 0 && (
                    <span style={dotStyle('#dc2626')} title={bloqueio[0].message || 'Bloqueado'}>
                        <Ban size={9} color="#fff"/>
                    </span>
                )}
                {manutencao.length > 0 && (
                    <span style={dotStyle(manutencao.some(r => r.type === 'error') ? '#ea580c' : '#d97706')} title={manutencao.map(r => r.message).join('\n')}>
                        <Wrench size={9} color="#fff"/>
                    </span>
                )}
                {documentos.length > 0 && (
                    <span style={dotStyle(documentos.some(r => r.type === 'error') ? '#2563eb' : '#93c5fd')} title={documentos.map(r => r.message).join('\n')}>
                        <FileText size={9} color="#fff"/>
                    </span>
                )}
            </div>
        );
    };

    // --- Ações ---
    const handleEdit   = (v) => { setSelectedVehicle(v); setIsModalOpen(true); };
    const handleNew    = ()  => { setSelectedVehicle(null); setIsModalOpen(true); };

    const handleDelete = async () => {
        try {
            await apiClient.deleteVehicle(selectedVehicle.id);
            setAlertMessage('Veículo excluído com sucesso.');
            reloadData();
        } catch (error) {
            setAlertMessage('Erro ao excluir: ' + error.message);
        } finally {
            setIsDeleteModalOpen(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!vehicleToToggleStatus) return;
        try {
            const novoStatus = vehicleToToggleStatus.ativo ? 0 : 1;
            await apiClient.updateVehicle(vehicleToToggleStatus.id, { ativo: novoStatus });
            setAlertMessage(`Veículo ${novoStatus === 1 ? 'ativado' : 'inativado'} com sucesso.`);
            reloadData();
        } catch (error) {
            setAlertMessage('Erro ao alterar status: ' + error.message);
        } finally {
            setVehicleToToggleStatus(null);
        }
    };

    const exportToCSV = () => {
        const headers = ['Registro', 'Placa', 'Marca', 'Modelo', 'Grupo', 'Leitura', 'Status', 'Terceiro?', 'Ativo'];
        const rows = filteredVehicles.map(v => [
            v.registroInterno, v.placa, v.marca, v.modelo, v.tipo,
            v.vehicleReading, v.computedStatus, v.isOutsourced ? 'SIM' : 'NÃO', v.ativo ? 'SIM' : 'NÃO'
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "veiculos_frotasmak.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    const SortHeader = ({ label, sortKey, className = '' }) => (
        <button
            onClick={() => requestSort(sortKey)}
            className={`flex items-center gap-1 text-left transition-colors ${className}`}
            style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9a8a78', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#6a5e4e'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9a8a78'; }}
        >
            {label}
            <ChevronsUpDown size={11} style={{ color: sortConfig.key === sortKey ? '#9E7A42' : '#d4c8b8' }} />
        </button>
    );

    const activeFiltersCount = [filters.group, filters.type, filters.status].filter(f => f !== 'todos').length
        + (filters.showInactive ? 1 : 0) + (filters.showSucata ? 1 : 0);

    // Controle de botões por role
    const VEHICLE_ACTION_BUTTONS = {
        admin:         ['edit', 'checklist', 'fines', 'history', 'delete', 'block', 'allocate'],
        gerencia:      ['edit', 'checklist', 'fines', 'history', 'block', 'allocate'],
        editor:        ['edit', 'checklist', 'fines', 'history', 'block', 'allocate'],
        rh:            ['checklist', 'fines', 'history'],
        faturamento:   ['checklist', 'history'],
        abastecimento: ['checklist', 'history'],
        oficina:       ['checklist', 'history'],
    };
    const canDo = (action) => {
        const role = user?.user_type?.toLowerCase() || '';
        const allowed = VEHICLE_ACTION_BUTTONS[role] || ['history'];
        return allowed.includes(action);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="max-w-screen-2xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-5">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                            <div className="p-2 bg-yellow-400 rounded-lg shadow-sm"><Truck size={20} className="text-gray-900" /></div>
                            Gestão da Frota
                        </h1>
                        <p className="text-gray-400 text-sm mt-1 ml-1">
                            {summary.total} veículos ativos &middot; {summary.disponiveis} disponíveis
                        </p>
                    </div>
                    <ProtectedComponent requiredPermission="editor">
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={exportToCSV}>
                                <Download size={14}/> Exportar
                            </Button>
                            <Button variant="primary" onClick={handleNew}>
                                <PlusCircle size={15}/> Novo Veículo
                            </Button>
                        </div>
                    </ProtectedComponent>
                </div>

                {/* ── Cards de Sumário compactos (clicáveis) ─────────────── */}
                <div className="bg-white rounded-xl shadow-sm px-3 py-2.5 flex flex-wrap items-center gap-1.5" style={{ border: "1px solid #f0ebe3" }}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-0.5 shrink-0">Própria:</span>
                    {[
                        { label: 'Ativos',      value: summary.total,       icon: Truck,         base: 'border-gray-200 bg-gray-50 text-gray-700',           active: 'border-gray-400 bg-gray-200',     filterKey: 'reset'       },
                        { label: 'Disponíveis', value: summary.disponiveis, icon: CheckCircle2,  base: 'border-emerald-200 bg-emerald-50 text-emerald-700',   active: 'border-emerald-500 bg-emerald-100', filterKey: 'Disponível'  },
                        { label: 'Em Obra',     value: summary.emObra,      icon: HardHat,       base: 'border-sky-200 bg-sky-50 text-sky-700',               active: 'border-sky-500 bg-sky-100',         filterKey: 'Em Obra'     },
                        { label: 'Manutenção',  value: summary.manutencao,  icon: Wrench,        base: 'border-orange-200 bg-orange-50 text-orange-700',      active: 'border-orange-500 bg-orange-100',   filterKey: '_manutencao' },
                        { label: 'Alertas',     value: summary.comAlerta,   icon: AlertTriangle, base: summary.comAlerta > 0 ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 bg-gray-50 text-gray-400', active: 'border-red-500 bg-red-100', filterKey: null },
                        { label: 'Sucata',      value: summary.sucata,      icon: Package,       base: 'border-zinc-200 bg-zinc-100 text-zinc-600',           active: 'border-zinc-500 bg-zinc-200',       filterKey: '_sucata'     },
                    ].map(({ label, value, icon: Icon, base, active, filterKey }) => {
                        const isActive =
                            filterKey === 'reset'      ? (filters.status === 'todos' && !filters.showSucata) :
                            filterKey === '_sucata'    ? filters.showSucata :
                            filterKey === '_manutencao'? filters.status === '_manutencao' :
                            filterKey                  ? filters.status === filterKey :
                            false;
                        return (
                            <button
                                key={label}
                                disabled={!filterKey}
                                onClick={() => {
                                    if (!filterKey) return;
                                    if (filterKey === 'reset')       setFilters(p => ({ ...p, status: 'todos', showSucata: false, showInactive: false }));
                                    else if (filterKey === '_sucata') setFilters(p => ({ ...p, status: 'Sucata', showSucata: true }));
                                    else                             setFilters(p => ({ ...p, status: filterKey, showSucata: false }));
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all ${isActive ? active + ' ring-1 ring-offset-0' : base} ${filterKey ? 'cursor-pointer hover:shadow-sm hover:brightness-95' : 'cursor-default opacity-60'}`}
                            >
                                <Icon size={11} className="shrink-0"/>
                                <span className="font-bold">{value}</span>
                                <span className="opacity-75">{label}</span>
                            </button>
                        );
                    })}

                    {summary.terceiros > 0 && (<>
                        <span className="text-gray-200 mx-0.5 text-base select-none">|</span>
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mr-0.5 shrink-0">Terceiros:</span>
                        {[
                            { label: 'Total',       value: summary.terceiros,             dot: 'bg-purple-500' },
                            { label: 'Disponíveis', value: summary.terceirosDisponiveis,  dot: 'bg-emerald-500' },
                            { label: 'Em Obra',     value: summary.terceirosEmObra,       dot: 'bg-sky-500' },
                            ...(summary.terceirosManutencao > 0 ? [{ label: 'Manutenção', value: summary.terceirosManutencao, dot: 'bg-orange-400' }] : []),
                        ].map(({ label, value, dot }) => (
                            <span key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-purple-100 bg-purple-50 text-purple-700 text-xs font-medium">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`}/>
                                <span className="font-bold">{value}</span>
                                <span className="opacity-75">{label}</span>
                            </span>
                        ))}
                    </>)}
                </div>

                {/* ── Filtros sempre visíveis ──────────────────────────────── */}
                <div className="bg-white rounded-xl shadow-sm relative" style={{ border: "1px solid #f0ebe3" }}>
                    <div className="p-3 flex flex-wrap items-center gap-2">
                        {/* Busca */}
                        <div className="relative flex-1 min-w-[180px]">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                            <input
                                type="text" name="search"
                                placeholder="Placa, registro, marca ou modelo…"
                                value={filters.search} onChange={handleFilterChange}
                                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-gray-50 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition" style={{ border: "1px solid #f0ebe3" }}
                            />
                        </div>
                        {/* Selects */}
                        <select name="group" value={filters.group} onChange={handleFilterChange} className="px-2.5 py-1.5 text-sm rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 outline-none" style={{ border: "1px solid #f0ebe3" }}>
                            <option value="todos">Todos os tipos</option>
                            {Object.keys(vehicleGroups).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <div className="min-w-[180px]">
                            <SearchableSelect
                                items={[{ id: 'todos', label: 'Todos os grupos' }, ...vehicleTypes.map(t => ({ id: t, label: t }))]}
                                value={filters.type || 'todos'}
                                onChange={(item) => handleFilterChange({ target: { name: 'type', value: item?.id || 'todos' } })}
                                getLabel={(t) => t.label}
                                placeholder="Todos os grupos"
                            />
                        </div>
                        <select
                            name="status"
                            value={filters.status === '_manutencao' ? '_manutencao' : filters.status}
                            onChange={handleFilterChange}
                            className="px-2.5 py-1.5 text-sm rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 outline-none" style={{ border: "1px solid #f0ebe3" }}
                        >
                            <option value="todos">Todos os status</option>
                            <option value="_manutencao">Manutenção (qualquer)</option>
                            {ALL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {/* Toggles */}
                        {[
                            { name: 'showInactive', label: 'Inativos', activeColor: 'peer-checked:bg-yellow-400' },
                            { name: 'showSucata',   label: `Sucatas (${summary.sucata})`, activeColor: 'peer-checked:bg-zinc-500' },
                        ].map(({ name, label, activeColor }) => (
                            <label key={name} className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                <div className="relative">
                                    <input type="checkbox" name={name} checked={filters[name]} onChange={handleFilterChange} className="sr-only peer"/>
                                    <div className={`w-8 h-4 bg-gray-200 rounded-full transition-colors ${activeColor}`}/>
                                    <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"/>
                                </div>
                                <span className="text-xs text-gray-600">{label}</span>
                            </label>
                        ))}
                        {/* Contador + Limpar */}
                        <div className="ml-auto flex items-center gap-3 shrink-0">
                            <span className="text-xs text-gray-400">{filteredVehicles.length} veículo{filteredVehicles.length !== 1 ? 's' : ''}</span>
                            {activeFiltersCount > 0 && (
                                <button
                                    onClick={() => setFilters({ type: 'todos', status: 'todos', search: '', group: 'todos', showInactive: false, showSucata: false })}
                                    className="text-xs text-yellow-600 hover:text-yellow-700 font-medium"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Tabela ──────────────────────────────────────────────── */}
                <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.08)' }}>

                    {/* Cabeçalho */}
                    <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3" style={{ background: '#faf9f7', borderBottom: '1px solid #f0ebe3' }}>
                        <div className="col-span-3"><SortHeader label="Veículo" sortKey="registroInterno"/></div>
                        <div className="col-span-1"><SortHeader label="Placa" sortKey="placa"/></div>
                        <div className="col-span-2"><SortHeader label="Leitura" sortKey="vehicleReading" className="justify-center"/></div>
                        <div className="col-span-5"><SortHeader label="Status / Localização" sortKey="computedStatus"/></div>
                        <div className="col-span-1 flex justify-center">
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9a8a78' }}>Ações</span>
                        </div>
                    </div>

                    {/* Linhas */}
                    <div className="divide-y divide-[#f0ebe3]">
                        {filteredVehicles.length === 0 ? (
                            <div className="py-16 text-center">
                                <Truck size={32} className="mx-auto mb-3" style={{ color: '#e8e0d4' }}/>
                                <p style={{ color: '#b0a090', fontWeight: 600, fontSize: 13 }}>Nenhum veículo encontrado</p>
                                <p style={{ color: '#d4c8b8', fontSize: 11, marginTop: 4 }}>Ajuste os filtros ou cadastre um novo veículo</p>
                            </div>
                        ) : filteredVehicles.map(vehicle => {
                            const statusKey = vehicle.isSucata ? 'Sucata' : (!vehicle.ativo ? 'Inativo' : vehicle.computedStatus);
                            const hasCritical = vehicle.restrictions.some(r => r.type === 'bloqueio' || r.type === 'error');

                            const statusDisplay = (!vehicle.isSucata && vehicle.ativo && vehicle.computedStatus === 'Em Obra' && vehicle.obra)
                                ? `Obra: ${formatObraNome(vehicle.obra)}`
                                : (!vehicle.isSucata && vehicle.ativo && vehicle.computedStatus === 'Disponível')
                                    ? `${vehicle.computedStatus} · ${vehicle.localizacaoAtual || 'Pátio'}`
                                    : statusKey;

                            const actionHandlers = {
                                obraModal:        () => { setSelectedVehicle(vehicle); setIsObraAllocationModalOpen(true); },
                                opModal:          () => { setSelectedVehicle(vehicle); setIsOperationalModalOpen(true); },
                                maintenanceModal: () => { setSelectedVehicle(vehicle); setIsMaintenanceModalOpen(true); },
                                checklist:        () => { setSelectedVehicle(vehicle); setIsChecklistModalOpen(true); },
                                fines:            () => { setSelectedVehicle(vehicle); setIsFinesModalOpen(true); },
                                history:          () => { setSelectedVehicle(vehicle); setIsHistoryModalOpen(true); },
                                documents:        () => { setSelectedVehicle(vehicle); setIsDocModalOpen(true); },
                                edit:             () => handleEdit(vehicle),
                                toggleStatus:     () => setVehicleToToggleStatus(vehicle),
                                delete:           () => { setSelectedVehicle(vehicle); setIsDeleteModalOpen(true); },
                            };

                            return (
                                <div
                                    key={vehicle.id}
                                    className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center px-3 md:px-5 py-3 transition-all ${getRowStyle(vehicle)}`}
                                    style={{ background: 'white' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(250,249,247,0.85)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                                >
                                    {/* Veículo — col-span-3 */}
                                    <div className="md:col-span-3 flex items-center gap-2.5">
                                        <div
                                            className="relative shrink-0 cursor-pointer group"
                                            onClick={() => { setSelectedVehicle(vehicle); setIsDetailModalOpen(true); }}
                                        >
                                            <div
                                                className={`w-[40px] h-[28px] rounded-lg overflow-hidden flex items-center justify-center ${vehicle.isSucata ? 'grayscale opacity-70' : ''}`}
                                                style={{ border: '1px solid #e8e0d4', background: '#f5f3ef', flexShrink: 0 }}
                                            >
                                                {vehicle.fotoURL ? (
                                                    <img
                                                        src={vehicle.fotoURL.startsWith('http') ? vehicle.fotoURL : `${(process.env.REACT_APP_API_URL || '').replace('/api', '')}${vehicle.fotoURL}`}
                                                        alt=""
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    />
                                                ) : (
                                                    <Truck size={13} style={{ color: '#c8b8a8' }} />
                                                )}
                                            </div>
                                            {hasCritical && vehicle.ativo && !vehicle.isSucata && (
                                                <div className="absolute -top-1.5 -left-1.5 bg-red-500 text-white rounded-full p-0.5 shadow" title="Requer atenção">
                                                    <AlertTriangle size={9} fill="white"/>
                                                </div>
                                            )}
                                            {vehicle.isSucata && (
                                                <div className="absolute -top-1.5 -left-1.5 bg-zinc-500 text-white rounded-full p-0.5 shadow" title="Sucata">
                                                    <Package size={9}/>
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <span style={{ fontWeight: 700, fontSize: 12, color: '#3d3528' }}>{vehicle.registroInterno}</span>
                                                {vehicle.isOutsourced && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', background: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff', borderRadius: 9999, padding: '1px 5px' }}>3º</span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: 10, color: '#9a8a78' }} className="truncate">{vehicle.marca} {vehicle.modelo}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span style={{ fontSize: 9, color: '#b0a090' }}>{vehicle.tipo}</span>
                                                {renderAlertBadges(vehicle.restrictions, vehicle)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Placa — col-span-1 */}
                                    <div className="md:col-span-1 hidden md:block">
                                        <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: '#3d3528', background: '#f5f2ed', border: '1px solid #e8e0d4', borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap' }}>{vehicle.placa}</span>
                                    </div>

                                    {/* Leitura — col-span-2 */}
                                    <div className="md:col-span-2 hidden md:flex justify-center">
                                        <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 12, fontWeight: 600, color: vehicle.isSucata ? '#9ca3af' : '#3d3528' }}>
                                            {vehicle.vehicleReading}
                                        </span>
                                    </div>

                                    {/* Status — col-span-5: nome completo da obra */}
                                    <div className="md:col-span-5 flex items-center">
                                        <StatusBadge status={statusKey} label={statusDisplay}/>
                                    </div>

                                    {/* Ações — col-span-1: botão ativo + 3 pontos */}
                                    <div className="md:col-span-1 flex justify-end md:justify-center items-center">
                                        <VehicleActionMenu
                                            vehicle={vehicle}
                                            canDo={canDo}
                                            handlers={actionHandlers}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {filteredVehicles.length > 0 && (
                        <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: '#faf9f7', borderTop: '1px solid #f0ebe3', fontSize: 11, color: '#b0a090' }}>
                            <span>{filteredVehicles.length} registro{filteredVehicles.length !== 1 ? 's' : ''}</span>
                            <span>Frotas MAK · {new Date().toLocaleDateString('pt-BR')}</span>
                        </div>
                    )}
                </div>

                {/* ── Banner Sucata Oculta ─────────────────────────────────── */}
                {summary.sucata > 0 && !filters.showSucata && (
                    <div className="flex items-center gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-600">
                        <Package size={15} className="shrink-0 text-zinc-400"/>
                        <span>
                            <strong>{summary.sucata}</strong> veículo{summary.sucata !== 1 ? 's' : ''} em <strong>Sucata</strong> {summary.sucata !== 1 ? 'estão ocultos' : 'está oculto'}.
                            {' '}Estes veículos ficam excluídos de todos os cálculos do sistema e servem apenas como banco de peças.
                        </span>
                        <button
                            onClick={() => { setFilters(p => ({ ...p, showSucata: true })); }}
                            className="ml-auto whitespace-nowrap text-zinc-700 font-semibold hover:underline text-xs"
                        >
                            Visualizar →
                        </button>
                    </div>
                )}
            </div>

            {/* ── Modais ──────────────────────────────────────────────────── */}
            {isModalOpen && <VehicleModal user={user} vehicle={selectedVehicle} vehicles={vehicles} vehicleTypes={vehicleTypes} vehicleGroups={vehicleGroups} vehicleTypeConfigs={vehicleTypeConfigs} onClose={() => setIsModalOpen(false)} setAlertMessage={setAlertMessage} apiClient={apiClient} reloadData={reloadData} PasswordConfirmationModal={PasswordConfirmationModal}/>}
{isObraAllocationModalOpen && <ObraAllocationModal user={user} vehicle={selectedVehicle} obras={obras} employees={employees} revisions={revisions} onClose={() => setIsObraAllocationModalOpen(false)} setAlertMessage={setAlertMessage} apiClient={apiClient} reloadData={reloadData} vehicles={vehicles} PasswordConfirmationModal={PasswordConfirmationModal}/>}
            {isOperationalModalOpen && <OperationalAssignmentModal user={user} vehicle={selectedVehicle} employees={employees} revisions={revisions} onClose={() => setIsOperationalModalOpen(false)} setAlertMessage={setAlertMessage} apiClient={apiClient} reloadData={reloadData} operationalSubGroups={operationalSubGroups} PasswordConfirmationModal={PasswordConfirmationModal}/>}
            {isHistoryModalOpen && <HistoryModal vehicle={selectedVehicle} onClose={() => setIsHistoryModalOpen(false)} obras={obras} apiClient={apiClient} employees={employees}/>}
            {isChecklistModalOpen && <ChecklistModal vehicle={selectedVehicle} onClose={() => setIsChecklistModalOpen(false)} apiClient={apiClient}/>}
            {isDetailModalOpen && <VehicleDetailModal vehicle={selectedVehicle} revision={revisions.find(r => r.vehicleId === selectedVehicle?.id)} onClose={() => setIsDetailModalOpen(false)} vehicleGroups={vehicleGroups}/>}
            {isFinesModalOpen && <VehicleFinesModal vehicle={selectedVehicle} fines={fines} onClose={() => setIsFinesModalOpen(false)}/>}
            {isMaintenanceModalOpen && <MaintenanceModal user={user} vehicle={selectedVehicle} onClose={() => setIsMaintenanceModalOpen(false)} apiClient={apiClient} setAlertMessage={setAlertMessage} reloadData={reloadData}/>}
            {isDocModalOpen && <VehicleDocumentsModal vehicle={selectedVehicle} onClose={() => setIsDocModalOpen(false)} apiClient={apiClient}/>}

            {isDeleteModalOpen && (
                <PasswordConfirmationModal message={`Tem certeza que deseja excluir PERMANENTEMENTE o veículo ${selectedVehicle?.registroInterno}?`} onConfirm={handleDelete} onClose={() => setIsDeleteModalOpen(false)} apiClient={apiClient}/>
            )}
            {vehicleToToggleStatus && (
                <PasswordConfirmationModal
                    message={`Tem certeza que deseja ${vehicleToToggleStatus.ativo ? 'INATIVAR' : 'ATIVAR'} o veículo ${vehicleToToggleStatus.registroInterno}?${vehicleToToggleStatus.ativo ? ' Ele deixará de aparecer nas listas ativas.' : ''}`}
                    onConfirm={handleToggleStatus}
                    onClose={() => setVehicleToToggleStatus(null)}
                    apiClient={apiClient}
                />
            )}
        </div>
    );
};

export default VehiclePage;


