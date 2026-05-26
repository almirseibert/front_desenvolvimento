import React, { useState, useEffect, useMemo } from 'react';
import {
    HardHat, Users, Wrench, ShieldAlert, Edit, Clock, Trash2, PlusCircle,
    Download, ChevronsUpDown, AlertTriangle, Truck,
    FileText, Ban, ClipboardCheck, Power, Package, Search, SlidersHorizontal,
    CheckCircle2, Briefcase
} from 'lucide-react';

import ProtectedComponent from '../components/ProtectedComponent';
import VehicleModal from '../components/VehicleModal';
import MaintenanceModal from '../components/MaintenanceModal';
import VehicleFinesModal from '../components/VehicleFinesModal';
import VehicleDetailModal from '../components/VehicleDetailModal';
import OperationalAssignmentModal from '../components/OperationalAssignmentModal';
import ObraAllocationModal from '../components/ObraAllocationModal';
import HistoryModal from '../components/HistoryModal';
import ChecklistModal from '../components/ChecklistModal';

import { getVehicleMainReading, checkVehicleRestrictions } from '../utils/vehicleRules';

// ─── Constantes de Status ────────────────────────────────────────────────────

const STATUS_CONFIG = {
    'Disponível':            { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
    'Em Obra':               { color: 'bg-sky-100 text-sky-800 border-sky-200',             dot: 'bg-sky-500' },
    'Em Operação':           { color: 'bg-violet-100 text-violet-800 border-violet-200',    dot: 'bg-violet-500' },
    'Em Manutenção':         { color: 'bg-orange-100 text-orange-800 border-orange-200',    dot: 'bg-orange-500' },
    'Aguardando Manutenção': { color: 'bg-amber-100 text-amber-800 border-amber-200',       dot: 'bg-amber-400 animate-pulse' },
    'Sucata':                { color: 'bg-zinc-200 text-zinc-700 border-zinc-300',          dot: 'bg-zinc-500' },
    'Inativo':               { color: 'bg-gray-100 text-gray-500 border-gray-200',          dot: 'bg-gray-400' },
};

const ALL_STATUS_OPTIONS = ['Disponível', 'Em Obra', 'Em Operação', 'Em Manutenção', 'Aguardando Manutenção', 'Sucata'];

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
    const [isObraAllocationModalOpen, setIsObraAllocationModalOpen] = useState(false);
    const [isOperationalModalOpen, setIsOperationalModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isFinesModalOpen, setIsFinesModalOpen] = useState(false);
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
    const [vehicleToToggleStatus, setVehicleToToggleStatus] = useState(null);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    const [filters, setFilters] = useState({
        type: 'todos', status: 'todos', search: '',
        group: 'todos', showInactive: false, showSucata: false
    });
    const [sortConfig, setSortConfig] = useState({ key: 'registroInterno', direction: 'ascending' });

    useEffect(() => {
        if (initialFilter) setFilters(prev => ({ ...prev, ...initialFilter }));
    }, [initialFilter]);

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

            const typeMatch   = filters.type   === 'todos' || v.tipo             === filters.type;
            const statusMatch = filters.status  === 'todos' || v.computedStatus  === filters.status;
            const groupMatch  = filters.group   === 'todos' || (groups[filters.group] && groups[filters.group].includes(v.tipo));

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
        if (vehicle.isSucata)  return 'opacity-70 hover:opacity-100 bg-zinc-50 border-l-4 border-l-zinc-300';
        if (!vehicle.ativo)    return 'opacity-60 hover:opacity-100 bg-gray-50 border-l-4 border-l-gray-200';
        if (vehicle.isOutsourced) return 'bg-purple-50/30 hover:bg-purple-50 border-l-4 border-l-purple-300';
        if (vehicle.restrictions.some(r => r.category === 'bloqueio' || r.type === 'bloqueio')) return 'bg-red-50/60 hover:bg-red-50 border-l-4 border-l-red-400';
        if (vehicle.restrictions.some(r => r.type === 'error'))   return 'bg-orange-50/40 hover:bg-orange-50 border-l-4 border-l-orange-400';
        if (vehicle.restrictions.some(r => r.type === 'warning')) return 'bg-yellow-50/40 hover:bg-yellow-50 border-l-4 border-l-yellow-300';
        return 'bg-white hover:bg-gray-50/80 border-l-4 border-l-transparent';
    };

    const renderAlertBadges = (restrictions, vehicle) => {
        if (vehicle.isSucata) return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500 text-white">
                <Package size={9}/> SUCATA
            </span>
        );
        if (!vehicle.ativo) return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-400 text-white">
                <Ban size={9}/> INATIVO
            </span>
        );
        if (!restrictions || !restrictions.length) return null;
        const manutencao = restrictions.filter(r => r.category === 'manutencao');
        const documentos = restrictions.filter(r => r.category === 'documento');
        const bloqueio   = restrictions.filter(r => r.category === 'bloqueio' || r.type === 'bloqueio');
        return (
            <div className="flex gap-1 flex-wrap mt-0.5">
                {bloqueio.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white" title={bloqueio[0].message}>
                        <Ban size={9}/> BLOQUEADO
                    </span>
                )}
                {manutencao.length > 0 && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${manutencao.some(r => r.type === 'error') ? 'bg-orange-500 text-white' : 'bg-amber-400 text-amber-900'}`} title={manutencao.map(r => r.message).join('\n')}>
                        <Wrench size={9}/> {manutencao.some(r => r.type === 'error') ? 'VENCIDA' : 'PREV.'}
                    </span>
                )}
                {documentos.length > 0 && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${documentos.some(r => r.type === 'error') ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`} title={documentos.map(r => r.message).join('\n')}>
                        <FileText size={9}/> DOCS
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
        const headers = ['Registro', 'Placa', 'Marca', 'Modelo', 'Tipo', 'Leitura', 'Status', 'Terceiro?', 'Ativo'];
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

    const trunc = (text, limit = 22) => {
        if (!text) return '';
        return text.length <= limit ? text : text.substring(0, limit) + '…';
    };

    const SortHeader = ({ label, sortKey, className = '' }) => (
        <button
            onClick={() => requestSort(sortKey)}
            className={`flex items-center gap-1 text-left font-semibold text-xs text-gray-500 uppercase tracking-wider hover:text-gray-800 transition-colors ${className}`}
        >
            {label}
            <ChevronsUpDown size={11} className={sortConfig.key === sortKey ? 'text-yellow-500' : 'text-gray-300'} />
        </button>
    );

    const activeFiltersCount = [filters.group, filters.type, filters.status].filter(f => f !== 'todos').length
        + (filters.showInactive ? 1 : 0) + (filters.showSucata ? 1 : 0);

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
                            <button onClick={exportToCSV} className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition text-sm shadow-sm">
                                <Download size={14}/> Exportar
                            </button>
                            <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-500 transition text-sm shadow-sm">
                                <PlusCircle size={15}/> Novo Veículo
                            </button>
                        </div>
                    </ProtectedComponent>
                </div>

                {/* ── Cards de Sumário ────────────────────────────────────── */}
                {/* Frota Própria — terceirizados excluídos de todos os contadores */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-0.5">Frota Própria</p>
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
                        {[
                            { label: 'Ativos',      value: summary.total,       icon: Truck,         bg: 'bg-white',      text: 'text-gray-800',    sub: 'text-gray-400'    },
                            { label: 'Disponíveis', value: summary.disponiveis, icon: CheckCircle2,  bg: 'bg-emerald-50', text: 'text-emerald-700', sub: 'text-emerald-400' },
                            { label: 'Em Obra',     value: summary.emObra,      icon: HardHat,       bg: 'bg-sky-50',     text: 'text-sky-700',     sub: 'text-sky-400'     },
                            { label: 'Manutenção',  value: summary.manutencao,  icon: Wrench,        bg: 'bg-orange-50',  text: 'text-orange-700',  sub: 'text-orange-400'  },
                            { label: 'Alertas',     value: summary.comAlerta,   icon: AlertTriangle, bg: summary.comAlerta > 0 ? 'bg-red-50' : 'bg-white', text: summary.comAlerta > 0 ? 'text-red-600' : 'text-gray-500', sub: 'text-red-300' },
                            { label: 'Sucata',      value: summary.sucata,      icon: Package,       bg: 'bg-zinc-100',   text: 'text-zinc-600',    sub: 'text-zinc-400'    },
                        ].map(({ label, value, icon: Icon, bg, text, sub }) => (
                            <div key={label} className={`${bg} rounded-xl border border-gray-100 shadow-sm p-3 md:p-4 flex items-center gap-2.5`}>
                                <Icon size={18} className={`${text} shrink-0 opacity-70`}/>
                                <div>
                                    <p className={`text-lg md:text-xl font-bold leading-none ${text}`}>{value}</p>
                                    <p className={`text-[10px] md:text-xs mt-0.5 ${sub}`}>{label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Card de Terceirizados — contagem separada, não soma à frota própria */}
                {summary.terceiros > 0 && (
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-0.5">Veículos Terceirizados</p>
                        <div className="bg-purple-50 border border-purple-200 rounded-xl shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="flex items-center gap-3 pr-0 sm:pr-5 sm:border-r border-purple-200">
                                <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                                    <Briefcase size={18} className="text-purple-700"/>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-purple-800 leading-none">{summary.terceiros}</p>
                                    <p className="text-xs text-purple-500 mt-0.5">Total cadastrado</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2.5 flex-1">
                                <div className="flex items-center gap-2 bg-white border border-purple-100 rounded-lg px-3 py-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"/>
                                    <span className="text-sm font-bold text-gray-800">{summary.terceirosDisponiveis}</span>
                                    <span className="text-xs text-gray-500">Disponíveis</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white border border-purple-100 rounded-lg px-3 py-2">
                                    <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0"/>
                                    <span className="text-sm font-bold text-gray-800">{summary.terceirosEmObra}</span>
                                    <span className="text-xs text-gray-500">Em Obra</span>
                                </div>
                                {summary.terceirosManutencao > 0 && (
                                    <div className="flex items-center gap-2 bg-white border border-purple-100 rounded-lg px-3 py-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0"/>
                                        <span className="text-sm font-bold text-gray-800">{summary.terceirosManutencao}</span>
                                        <span className="text-xs text-gray-500">Manutenção</span>
                                    </div>
                                )}
                            </div>
                            <p className="hidden sm:block text-[10px] text-purple-400 whitespace-nowrap self-center">
                                Não contabilizados na frota própria
                            </p>
                        </div>
                    </div>
                )}
                {/* ── Filtros ─────────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 p-3 border-b border-gray-100">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                            <input
                                type="text" name="search"
                                placeholder="Buscar por placa, registro, marca ou modelo…"
                                value={filters.search} onChange={handleFilterChange}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(p => !p)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition ${showFilters ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                        >
                            <SlidersHorizontal size={14}/>
                            Filtros
                            {activeFiltersCount > 0 && (
                                <span className="bg-yellow-400 text-gray-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFiltersCount}</span>
                            )}
                        </button>
                    </div>

                    {showFilters && (
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/60 border-b border-gray-100">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block">Grupo</label>
                                <select name="group" value={filters.group} onChange={handleFilterChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 outline-none">
                                    <option value="todos">Todos os grupos</option>
                                    {Object.keys(vehicleGroups).map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block">Tipo</label>
                                <select name="type" value={filters.type} onChange={handleFilterChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 outline-none">
                                    <option value="todos">Todos os tipos</option>
                                    {vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block">Status</label>
                                <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 outline-none">
                                    <option value="todos">Todos os status</option>
                                    {ALL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col justify-center gap-3 pt-1">
                                {[
                                    { name: 'showInactive', label: 'Ver inativos',   activeColor: 'peer-checked:bg-yellow-400' },
                                    { name: 'showSucata',   label: 'Ver sucatas',    activeColor: 'peer-checked:bg-zinc-500',  extra: `(${summary.sucata})` },
                                ].map(({ name, label, activeColor, extra }) => (
                                    <label key={name} className="flex items-center gap-2.5 cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" name={name} checked={filters[name]} onChange={handleFilterChange} className="sr-only peer"/>
                                            <div className={`w-9 h-5 bg-gray-200 rounded-full transition-colors ${activeColor}`}/>
                                            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"/>
                                        </div>
                                        <span className="text-sm text-gray-600">{label} {extra && <span className="text-gray-400 text-[11px]">{extra}</span>}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-400">
                        <span>{filteredVehicles.length} veículo{filteredVehicles.length !== 1 ? 's' : ''} exibido{filteredVehicles.length !== 1 ? 's' : ''}</span>
                        {activeFiltersCount > 0 && (
                            <button
                                onClick={() => setFilters({ type: 'todos', status: 'todos', search: '', group: 'todos', showInactive: false, showSucata: false })}
                                className="text-yellow-600 hover:text-yellow-700 font-medium"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Tabela ──────────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                    {/* Cabeçalho */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="col-span-3"><SortHeader label="Veículo" sortKey="registroInterno"/></div>
                        <div className="col-span-1"><SortHeader label="Reg." sortKey="registroInterno"/></div>
                        <div className="col-span-2"><SortHeader label="Placa" sortKey="placa"/></div>
                        <div className="col-span-2"><SortHeader label="Leitura" sortKey="vehicleReading" className="justify-center"/></div>
                        <div className="col-span-2"><SortHeader label="Status" sortKey="computedStatus" className="justify-center"/></div>
                        <div className="col-span-2 flex justify-center">
                            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Ações</span>
                        </div>
                    </div>

                    {/* Linhas */}
                    <div className="divide-y divide-gray-100">
                        {filteredVehicles.length === 0 ? (
                            <div className="py-16 text-center">
                                <Truck size={32} className="mx-auto text-gray-200 mb-3"/>
                                <p className="text-gray-400 font-medium text-sm">Nenhum veículo encontrado</p>
                                <p className="text-gray-300 text-xs mt-1">Ajuste os filtros ou cadastre um novo veículo</p>
                            </div>
                        ) : filteredVehicles.map(vehicle => {
                            const statusKey = vehicle.isSucata ? 'Sucata' : (!vehicle.ativo ? 'Inativo' : vehicle.computedStatus);
                            const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG['Disponível'];
                            const hasCritical = vehicle.restrictions.some(r => r.type === 'bloqueio' || r.type === 'error');
                            const hasChecklists = vehicle.checklistCount > 0;

                            const statusDisplay = (!vehicle.isSucata && vehicle.ativo && vehicle.computedStatus === 'Em Obra' && vehicle.obra)
                                ? `Obra: ${trunc(vehicle.obra.nome, 18)}`
                                : (!vehicle.isSucata && vehicle.ativo && vehicle.computedStatus === 'Disponível')
                                    ? `${vehicle.computedStatus} · ${vehicle.localizacaoAtual || 'Pátio'}`
                                    : statusKey;

                            return (
                                <div key={vehicle.id} className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center px-3 md:px-5 py-3.5 transition-all ${getRowStyle(vehicle)}`}>

                                    {/* Veículo */}
                                    <div className="md:col-span-3 flex items-center gap-3">
                                        <div
                                            className="relative shrink-0 cursor-pointer group"
                                            onClick={() => { setSelectedVehicle(vehicle); setIsDetailModalOpen(true); }}
                                        >
                                            <div className={`w-16 h-11 rounded-lg overflow-hidden border ${vehicle.isSucata ? 'border-zinc-200 grayscale opacity-70' : 'border-gray-100'}`}>
                                                <img
                                                    src={vehicle.fotoURL
                                                        ? (vehicle.fotoURL.startsWith('http') ? vehicle.fotoURL : `${(process.env.REACT_APP_API_URL || '').replace('/api', '')}${vehicle.fotoURL}`)
                                                        : 'https://placehold.co/80x56/f1f5f9/94a3b8?text=S%2FF'}
                                                    alt=""
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                />
                                            </div>
                                            {hasCritical && vehicle.ativo && !vehicle.isSucata && (
                                                <div className="absolute -top-1.5 -left-1.5 bg-red-500 text-white rounded-full p-0.5 shadow" title="Requer atenção">
                                                    <AlertTriangle size={10} fill="white"/>
                                                </div>
                                            )}
                                            {vehicle.isSucata && (
                                                <div className="absolute -top-1.5 -left-1.5 bg-zinc-500 text-white rounded-full p-0.5 shadow" title="Sucata">
                                                    <Package size={10}/>
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-gray-900 text-sm">{vehicle.registroInterno}</span>
                                                {vehicle.isOutsourced && (
                                                    <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded-full border border-purple-200 font-bold uppercase">3º</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">{vehicle.marca} {vehicle.modelo}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-gray-400">{vehicle.tipo}</span>
                                                {renderAlertBadges(vehicle.restrictions, vehicle)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reg. Interno */}
                                    <div className="md:col-span-1 hidden md:block">
                                        <span className="text-xs font-bold text-gray-700 font-mono">{vehicle.registroInterno}</span>
                                    </div>

                                    {/* Placa */}
                                    <div className="md:col-span-2 hidden md:block">
                                        <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded-md tracking-wide">{vehicle.placa}</span>
                                    </div>

                                    {/* Leitura */}
                                    <div className="md:col-span-2 hidden md:flex justify-center">
                                        <span className={`text-sm font-mono font-semibold ${vehicle.isSucata ? 'text-zinc-400' : 'text-gray-700'}`}>
                                            {vehicle.vehicleReading}
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="md:col-span-2 flex justify-start md:justify-center">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.color} max-w-[170px]`}>
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusCfg.dot}`}/>
                                            <span className="truncate" title={statusDisplay}>{trunc(statusDisplay, 22)}</span>
                                        </div>
                                    </div>

                                    {/* Botões */}
                                    <div className="md:col-span-2 flex flex-wrap gap-1 justify-start md:justify-center items-center">

                                        <button onClick={() => { setSelectedVehicle(vehicle); setIsChecklistModalOpen(true); }}
                                            className={`p-1.5 rounded-md transition-colors ${hasChecklists ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50'}`}
                                            title="Checklists">
                                            <ClipboardCheck size={15}/>
                                        </button>
                                        <button onClick={() => { setSelectedVehicle(vehicle); setIsFinesModalOpen(true); }}
                                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors" title="Multas">
                                            <ShieldAlert size={15}/>
                                        </button>
                                        <button onClick={() => { setSelectedVehicle(vehicle); setIsHistoryModalOpen(true); }}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Histórico">
                                            <Clock size={15}/>
                                        </button>

                                        <ProtectedComponent requiredPermission="editor">
                                            <button onClick={() => handleEdit(vehicle)}
                                                className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors" title="Editar">
                                                <Edit size={15}/>
                                            </button>

                                            {/* Ações de alocação — apenas ativos e não-sucata */}
                                            {vehicle.ativo && !vehicle.isSucata && vehicle.computedStatus === 'Disponível' && (<>
                                                <button onClick={() => { setSelectedVehicle(vehicle); setIsObraAllocationModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Alocar Obra"><HardHat size={15}/></button>
                                                <button onClick={() => { setSelectedVehicle(vehicle); setIsOperationalModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors" title="Alocar Operação"><Users size={15}/></button>
                                                <button onClick={() => { setSelectedVehicle(vehicle); setIsMaintenanceModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors" title="Enviar p/ Manutenção"><Wrench size={15}/></button>
                                            </>)}
                                            {vehicle.ativo && !vehicle.isSucata && vehicle.computedStatus === 'Em Obra' && (
                                                <button onClick={() => { setSelectedVehicle(vehicle); setIsObraAllocationModalOpen(true); }} className="p-1.5 text-red-400 bg-red-50 hover:bg-red-100 rounded-md border border-red-100 transition-colors" title="Desalocar de Obra"><HardHat size={15}/></button>
                                            )}
                                            {vehicle.ativo && !vehicle.isSucata && vehicle.computedStatus === 'Em Operação' && (
                                                <button onClick={() => { setSelectedVehicle(vehicle); setIsOperationalModalOpen(true); }} className="p-1.5 text-red-400 bg-red-50 hover:bg-red-100 rounded-md border border-red-100 transition-colors" title="Desalocar de Operação"><Users size={15}/></button>
                                            )}
                                            {vehicle.ativo && !vehicle.isSucata && (vehicle.computedStatus === 'Em Manutenção' || vehicle.computedStatus === 'Aguardando Manutenção') && (
                                                <button onClick={() => { setSelectedVehicle(vehicle); setIsMaintenanceModalOpen(true); }} className="p-1.5 text-emerald-500 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-100 transition-colors" title="Finalizar Manutenção"><Wrench size={15}/></button>
                                            )}

                                            {/* Ativar / Inativar — não exibe para sucata */}
                                            {!vehicle.isSucata && (
                                                <button onClick={() => setVehicleToToggleStatus(vehicle)}
                                                    className={`p-1.5 rounded-md transition-colors ${vehicle.ativo ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'}`}
                                                    title={vehicle.ativo ? 'Inativar Veículo' : 'Reativar Veículo'}>
                                                    <Power size={15}/>
                                                </button>
                                            )}

                                            <ProtectedComponent requiredPermission="admin">
                                                <button onClick={() => { setSelectedVehicle(vehicle); setIsDeleteModalOpen(true); }}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Excluir permanentemente">
                                                    <Trash2 size={15}/>
                                                </button>
                                            </ProtectedComponent>
                                        </ProtectedComponent>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {filteredVehicles.length > 0 && (
                        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
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
                            onClick={() => { setShowFilters(true); setFilters(p => ({ ...p, showSucata: true })); }}
                            className="ml-auto whitespace-nowrap text-zinc-700 font-semibold hover:underline text-xs"
                        >
                            Visualizar →
                        </button>
                    </div>
                )}
            </div>

            {/* ── Modais ──────────────────────────────────────────────────── */}
            {isModalOpen && <VehicleModal user={user} vehicle={selectedVehicle} vehicles={vehicles} vehicleTypes={vehicleTypes} vehicleGroups={vehicleGroups} onClose={() => setIsModalOpen(false)} setAlertMessage={setAlertMessage} apiClient={apiClient} reloadData={reloadData} PasswordConfirmationModal={PasswordConfirmationModal}/>}
            {isObraAllocationModalOpen && <ObraAllocationModal user={user} vehicle={selectedVehicle} obras={obras} employees={employees} revisions={revisions} onClose={() => setIsObraAllocationModalOpen(false)} setAlertMessage={setAlertMessage} apiClient={apiClient} reloadData={reloadData} vehicles={vehicles} PasswordConfirmationModal={PasswordConfirmationModal}/>}
            {isOperationalModalOpen && <OperationalAssignmentModal user={user} vehicle={selectedVehicle} employees={employees} revisions={revisions} onClose={() => setIsOperationalModalOpen(false)} setAlertMessage={setAlertMessage} apiClient={apiClient} reloadData={reloadData} operationalSubGroups={operationalSubGroups} PasswordConfirmationModal={PasswordConfirmationModal}/>}
            {isHistoryModalOpen && <HistoryModal vehicle={selectedVehicle} onClose={() => setIsHistoryModalOpen(false)} obras={obras} apiClient={apiClient} employees={employees}/>}
            {isChecklistModalOpen && <ChecklistModal vehicle={selectedVehicle} onClose={() => setIsChecklistModalOpen(false)} apiClient={apiClient}/>}
            {isDetailModalOpen && <VehicleDetailModal vehicle={selectedVehicle} revision={revisions.find(r => r.vehicleId === selectedVehicle?.id)} onClose={() => setIsDetailModalOpen(false)} vehicleGroups={vehicleGroups}/>}
            {isFinesModalOpen && <VehicleFinesModal vehicle={selectedVehicle} fines={fines} onClose={() => setIsFinesModalOpen(false)}/>}
            {isMaintenanceModalOpen && <MaintenanceModal user={user} vehicle={selectedVehicle} onClose={() => setIsMaintenanceModalOpen(false)} apiClient={apiClient} setAlertMessage={setAlertMessage} reloadData={reloadData}/>}

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
