import React, { useState, useEffect, useRef } from 'react';
import { Truck, Plus, Edit2, Trash2, Loader, ChevronDown, ChevronRight, Fuel, Check, X, AlertTriangle, RefreshCw } from 'lucide-react';
import apiClient from '../../services/apiClient';
import VehicleTypeConfigModal from '../modals/VehicleTypeConfigModal';

const UNIDADES = ['L/h', 'h/L', 'Km/L', 'L/Km'];

const unidadeHint = (u) => {
    switch (u) {
        case 'Km/L': return 'Odômetro · km por litro (maior = melhor)';
        case 'L/Km': return 'Odômetro · litros por km (menor = melhor)';
        case 'h/L':  return 'Horímetro · horas por litro (maior = melhor)';
        case 'L/h':
        default:     return 'Horímetro · litros por hora (menor = melhor)';
    }
};

const VehicleTaxonomyTab = () => {
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [toast, setToast] = useState('');
    const [openGroups, setOpenGroups] = useState({});
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // estados de adição inline
    const [newGroupName, setNewGroupName] = useState('');
    const [addingTypeFor, setAddingTypeFor] = useState(null);
    const [newTypeName, setNewTypeName] = useState('');
    const [addingSubFor, setAddingSubFor] = useState(null);
    const [newSubName, setNewSubName] = useState('');

    const toastTimer = useRef(null);
    const showToast = (msg) => {
        setToast(msg);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 3500);
    };

    const load = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const data = await apiClient.getVehicleTaxonomy();
            setTree(Array.isArray(data) ? data : []);
        } catch (e) {
            setLoadError(e.message || 'Erro ao carregar. Verifique se o servidor está rodando e foi reiniciado após a última atualização.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleGroup = (id) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

    const run = async (fn, okMsg) => {
        setSaving(true);
        try {
            await fn();
            if (okMsg) showToast(okMsg);
            await load();
        } catch (e) {
            showToast(e.message || 'Erro na operação.');
        } finally {
            setSaving(false);
        }
    };

    // ── Grupos ────────────────────────────────────────────────────────────
    const addGroup = async () => {
        const nome = newGroupName.trim();
        if (!nome) return;
        setNewGroupName('');
        await run(() => apiClient.createVehicleGroup({ nome, unidade: 'L/h' }), `Grupo "${nome}" criado!`);
    };

    const renameGroup = (g) => {
        const nome = window.prompt('Novo nome do grupo:', g.nome);
        if (nome == null || nome.trim() === '' || nome.trim() === g.nome) return;
        run(() => apiClient.updateVehicleGroup(g.id, { nome: nome.trim(), unidade: g.unidade }), 'Grupo renomeado!');
    };

    const changeUnit = (g, unidade) => {
        run(() => apiClient.updateVehicleGroup(g.id, { nome: g.nome, unidade }), `Unidade do grupo "${g.nome}" atualizada para ${unidade}!`);
    };

    const deleteGroup = (g) => {
        if (!window.confirm(`Excluir o grupo "${g.nome}" e todos os seus tipos/sub-tipos?`)) return;
        run(() => apiClient.deleteVehicleGroup(g.id), `Grupo "${g.nome}" excluído.`);
    };

    // ── Tipos ─────────────────────────────────────────────────────────────
    const addType = async (groupId) => {
        const nome = newTypeName.trim();
        if (!nome) return;
        setNewTypeName('');
        setAddingTypeFor(null);
        await run(() => apiClient.createVehicleType({ group_id: groupId, nome }), `Tipo "${nome}" criado!`);
    };

    const renameType = (t) => {
        const nome = window.prompt('Novo nome do tipo:', t.nome);
        if (nome == null || nome.trim() === '' || nome.trim() === t.nome) return;
        run(() => apiClient.updateVehicleType(t.id, { nome: nome.trim() }), 'Tipo renomeado!');
    };

    const deleteType = (t) => {
        if (!window.confirm(`Excluir o tipo "${t.nome}" e seus sub-tipos?`)) return;
        run(() => apiClient.deleteVehicleType(t.id), `Tipo "${t.nome}" excluído.`);
    };

    // ── Sub-tipos ─────────────────────────────────────────────────────────
    const addSub = async (typeId) => {
        const nome = newSubName.trim();
        if (!nome) return;
        setNewSubName('');
        setAddingSubFor(null);
        await run(() => apiClient.createVehicleSubType({ type_id: typeId, nome }), `Sub-tipo "${nome}" criado!`);
    };

    const renameSub = (s) => {
        const nome = window.prompt('Novo nome do sub-tipo:', s.nome);
        if (nome == null || nome.trim() === '' || nome.trim() === s.nome) return;
        run(() => apiClient.updateVehicleSubType(s.id, { nome: nome.trim() }), 'Sub-tipo renomeado!');
    };

    const deleteSub = (s) => {
        if (!window.confirm(`Excluir o sub-tipo "${s.nome}"?`)) return;
        run(() => apiClient.deleteVehicleSubType(s.id), `Sub-tipo "${s.nome}" excluído.`);
    };

    return (
        <div className="space-y-4">
            {/* Toast de sucesso/erro */}
            {toast && (
                <div className="fixed top-4 right-4 z-[9999] bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">
                    {toast}
                </div>
            )}

            <div className="bg-white rounded-lg shadow border border-gray-200">
                {/* Cabeçalho */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Truck size={18} className="text-yellow-500" />
                        <div>
                            <h2 className="font-bold text-gray-800">Grupos, Tipos e Sub-tipos de Veículos</h2>
                            <p className="text-xs text-gray-400">Gerencie a taxonomia. A unidade do grupo define como o consumo é calculado.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={load}
                            disabled={loading}
                            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Recarregar"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setShowConfigModal(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg text-sm transition-colors"
                        >
                            <Fuel size={15} /> Configuração de Consumo
                        </button>
                    </div>
                </div>

                {/* Adicionar grupo */}
                <div className="flex items-center gap-2 p-4 border-b border-gray-100 bg-gray-50">
                    <input
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addGroup()}
                        placeholder="Nome do novo grupo…"
                        className="flex-1 max-w-xs p-2 border rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                        disabled={saving}
                    />
                    <button
                        onClick={addGroup}
                        disabled={saving || !newGroupName.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader size={14} className="animate-spin" /> : <Plus size={15} />} Novo Grupo
                    </button>
                </div>

                {/* Conteúdo */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader size={24} className="animate-spin text-yellow-500" />
                        <p className="text-sm text-gray-400">Carregando taxonomia…</p>
                    </div>
                ) : loadError ? (
                    <div className="p-6">
                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm">Erro ao carregar dados</p>
                                <p className="text-xs mt-1">{loadError}</p>
                                <button onClick={load} className="mt-2 text-xs font-bold underline hover:no-underline">
                                    Tentar novamente
                                </button>
                            </div>
                        </div>
                    </div>
                ) : tree.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Truck size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum grupo cadastrado.</p>
                        <p className="text-xs mt-1">Use o campo acima para criar o primeiro grupo.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {tree.map(g => {
                            const open = openGroups[g.id] !== false;
                            return (
                                <div key={g.id}>
                                    {/* Linha do grupo */}
                                    <div className="flex flex-wrap items-center gap-2 p-3 hover:bg-gray-50">
                                        <button
                                            onClick={() => toggleGroup(g.id)}
                                            className="text-gray-400 hover:text-gray-700 shrink-0"
                                        >
                                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                        <span className="font-bold text-gray-800">{g.nome}</span>
                                        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                                            {g.tipos.length} tipo(s)
                                        </span>

                                        <div className="flex flex-wrap items-center gap-2 ml-auto">
                                            <div className="flex flex-col items-end">
                                                <select
                                                    value={g.unidade}
                                                    onChange={e => changeUnit(g, e.target.value)}
                                                    disabled={saving}
                                                    className="p-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none disabled:opacity-60"
                                                    title="Unidade de consumo do grupo"
                                                >
                                                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                                <span className="text-[10px] text-gray-400 mt-0.5">{unidadeHint(g.unidade)}</span>
                                            </div>
                                            <button
                                                onClick={() => renameGroup(g)}
                                                disabled={saving}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Renomear grupo"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteGroup(g)}
                                                disabled={saving}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Excluir grupo"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista de tipos */}
                                    {open && (
                                        <div className="pl-8 pr-3 pb-3 space-y-1.5 bg-gray-50/50">
                                            {g.tipos.map(t => (
                                                <TypeRow
                                                    key={t.id}
                                                    type={t}
                                                    saving={saving}
                                                    addingSubFor={addingSubFor}
                                                    setAddingSubFor={setAddingSubFor}
                                                    newSubName={newSubName}
                                                    setNewSubName={setNewSubName}
                                                    onAddSub={addSub}
                                                    onRenameType={renameType}
                                                    onDeleteType={deleteType}
                                                    onRenameSub={renameSub}
                                                    onDeleteSub={deleteSub}
                                                />
                                            ))}

                                            {/* Adicionar tipo */}
                                            {addingTypeFor === g.id ? (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <input
                                                        autoFocus
                                                        value={newTypeName}
                                                        onChange={e => setNewTypeName(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && addType(g.id)}
                                                        placeholder="Nome do tipo…"
                                                        className="flex-1 max-w-xs p-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                                                        disabled={saving}
                                                    />
                                                    <button
                                                        onClick={() => addType(g.id)}
                                                        disabled={saving}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                                                    >
                                                        {saving ? <Loader size={14} className="animate-spin" /> : <Check size={15} />}
                                                    </button>
                                                    <button
                                                        onClick={() => { setAddingTypeFor(null); setNewTypeName(''); }}
                                                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setAddingTypeFor(g.id); setAddingSubFor(null); setNewTypeName(''); }}
                                                    disabled={saving}
                                                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 pt-1 disabled:opacity-50"
                                                >
                                                    <Plus size={13} /> Adicionar tipo
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showConfigModal && (
                <VehicleTypeConfigModal
                    onClose={() => setShowConfigModal(false)}
                    apiClient={apiClient}
                    setAlertMessage={showToast}
                />
            )}
        </div>
    );
};

const TypeRow = ({
    type, saving,
    addingSubFor, setAddingSubFor, newSubName, setNewSubName,
    onAddSub, onRenameType, onDeleteType, onRenameSub, onDeleteSub,
}) => {
    const [showSubs, setShowSubs] = useState(false);
    const hasSubs = type.subTipos && type.subTipos.length > 0;

    return (
        <div className="border border-gray-100 rounded-lg bg-white">
            <div className="flex items-center gap-2 p-2 hover:bg-gray-50">
                <button
                    onClick={() => setShowSubs(v => !v)}
                    className={`text-gray-300 hover:text-gray-600 ${!hasSubs ? 'cursor-default' : ''}`}
                >
                    {hasSubs
                        ? (showSubs ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                        : <span className="inline-block w-3.5" />}
                </button>
                <span className="text-sm text-gray-700 flex-1">{type.nome}</span>
                {hasSubs && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                        {type.subTipos.length}
                    </span>
                )}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onRenameType(type)}
                        disabled={saving}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Renomear tipo"
                    >
                        <Edit2 size={13} />
                    </button>
                    <button
                        onClick={() => onDeleteType(type)}
                        disabled={saving}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir tipo"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {showSubs && hasSubs && (
                <div className="pl-8 pr-2 pb-2 space-y-1">
                    {type.subTipos.map(s => (
                        <div key={s.id} className="flex items-center gap-2 text-sm text-gray-600 py-0.5">
                            <span className="text-gray-300 text-xs">▸</span>
                            <span className="flex-1">{s.nome}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onRenameSub(s)}
                                    disabled={saving}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                >
                                    <Edit2 size={12} />
                                </button>
                                <button
                                    onClick={() => onDeleteSub(s)}
                                    disabled={saving}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Adicionar sub-tipo */}
            <div className="pl-8 pr-2 pb-2">
                {addingSubFor === type.id ? (
                    <div className="flex items-center gap-2">
                        <input
                            autoFocus
                            value={newSubName}
                            onChange={e => setNewSubName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && onAddSub(type.id)}
                            placeholder="Nome do sub-tipo…"
                            className="flex-1 max-w-xs p-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                            disabled={saving}
                        />
                        <button
                            onClick={() => onAddSub(type.id)}
                            disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                        >
                            {saving ? <Loader size={13} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button
                            onClick={() => { setAddingSubFor(null); setNewSubName(''); }}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => { setAddingSubFor(type.id); setNewSubName(''); setShowSubs(true); }}
                        disabled={saving}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
                    >
                        <Plus size={12} /> Adicionar sub-tipo
                    </button>
                )}
            </div>
        </div>
    );
};

export default VehicleTaxonomyTab;

