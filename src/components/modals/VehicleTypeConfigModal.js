import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, Save, Loader, AlertTriangle, ChevronDown, ChevronUp, Fuel } from 'lucide-react';
import { vehicleGroups, vehicleSubTypes, getGroupUnit, getReadingSourceForUnit } from '../../utils/vehicleRules';
import SearchableSelect from '../SearchableSelect';

const EMPTY_FORM = {
    tipo: '',
    sub_tipo: '',
    media_consumo_padrao: '',
    percentual_tolerancia_padrao: '20',
    unidade: 'L/h',
};

// A unidade é derivada do grupo (configurável na aba Admin → Veículos).
const unidadeParaTipo = (tipo) => (tipo ? getGroupUnit(tipo) : 'L/h');

const unidadeDescricao = (unidade) => {
    switch (unidade) {
        case 'Km/L': return 'Quilômetros rodados por litro';
        case 'L/Km': return 'Litros consumidos por quilômetro';
        case 'h/L':  return 'Horas de operação por litro';
        case 'L/h':
        default:     return 'Litros consumidos por hora de operação';
    }
};

const VehicleTypeConfigModal = ({ onClose, apiClient, setAlertMessage }) => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [showForm, setShowForm] = useState(false);

    const allTypes = useMemo(() => Object.values(vehicleGroups).flat().sort(), []);
    const subTypesForSelected = useMemo(() => vehicleSubTypes[form.tipo] || [], [form.tipo]);

    const load = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getVehicleTypeConfigs();
            setConfigs(data);
        } catch (err) {
            setError('Erro ao carregar configurações.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(false);
        setError('');
    };

    const handleTipoChange = (tipo) => {
        const unidade = unidadeParaTipo(tipo);
        setForm(prev => ({ ...prev, tipo, sub_tipo: '', unidade }));
    };

    const handleEdit = (cfg) => {
        setForm({
            tipo: cfg.tipo,
            sub_tipo: cfg.sub_tipo || '',
            media_consumo_padrao: cfg.media_consumo_padrao != null ? cfg.media_consumo_padrao.toString() : '',
            percentual_tolerancia_padrao: cfg.percentual_tolerancia_padrao != null ? cfg.percentual_tolerancia_padrao.toString() : '20',
            unidade: cfg.unidade || unidadeParaTipo(cfg.tipo),
        });
        setEditingId(cfg.id);
        setShowForm(true);
        setError('');
    };

    const handleSave = async () => {
        if (!form.tipo) { setError('Selecione um grupo de equipamento.'); return; }
        setSaving(true);
        setError('');
        try {
            const payload = {
                tipo: form.tipo,
                sub_tipo: form.sub_tipo || null,
                media_consumo_padrao: form.media_consumo_padrao !== '' ? parseFloat(form.media_consumo_padrao) : null,
                percentual_tolerancia_padrao: form.percentual_tolerancia_padrao !== '' ? parseFloat(form.percentual_tolerancia_padrao) : 20,
                unidade: form.unidade,
            };
            if (editingId) {
                await apiClient.updateVehicleTypeConfig(editingId, payload);
                setAlertMessage('Configuração atualizada com sucesso!');
            } else {
                await apiClient.createVehicleTypeConfig(payload);
                setAlertMessage('Configuração criada com sucesso!');
            }
            await load();
            resetForm();
        } catch (err) {
            setError(err.message || 'Erro ao salvar configuração.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleting(id);
        try {
            await apiClient.deleteVehicleTypeConfig(id);
            setConfigs(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            setError('Erro ao excluir configuração.');
        } finally {
            setDeleting(null);
        }
    };

    // Agrupa configs por tipo para exibição
    const grouped = useMemo(() => {
        const map = {};
        configs.forEach(cfg => {
            if (!map[cfg.tipo]) map[cfg.tipo] = [];
            map[cfg.tipo].push(cfg);
        });
        return map;
    }, [configs]);

    return (
        <div className="mak-modal-backdrop backdrop-blur-sm">
            <div className="mak-modal">

                {/* Cabeçalho */}
                <div className="mak-modal-header">
                    <div>
                        <h2 className="mak-modal-title">
                            <Fuel size={20} className="text-yellow-500"/>
                            Configuração de Grupos de Equipamento
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Defina a média de consumo padrão e a tolerância por grupo e subgrupo.
                        </p>
                    </div>
                    <button onClick={onClose} className="mak-modal-close">
                        <X size={20}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                    {/* Botão para abrir formulário */}
                    {!showForm && (
                        <button
                            onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); setError(''); }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg transition-colors text-sm"
                        >
                            <Plus size={16}/> Nova Configuração
                        </button>
                    )}

                    {/* Formulário de criação/edição */}
                    {showForm && (
                        <div className="border border-yellow-300 bg-yellow-50 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                    {editingId ? <Edit2 size={14}/> : <Plus size={14}/>}
                                    {editingId ? 'Editar Configuração' : 'Nova Configuração'}
                                </h3>
                                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                                    <X size={16}/>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Tipo */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Grupo *</label>
                                    <SearchableSelect
                                        items={allTypes.map(t => ({ id: t, label: t }))}
                                        value={form.tipo}
                                        onChange={(item) => handleTipoChange(item?.id || '')}
                                        getLabel={(t) => t.label}
                                        placeholder="Selecione..."
                                    />
                                </div>

                                {/* Subgrupo (condicional) */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                        Subgrupo {subTypesForSelected.length > 0 ? '' : '(sem subgrupos)'}
                                    </label>
                                    <SearchableSelect
                                        items={subTypesForSelected.map(st => ({ id: st, label: st }))}
                                        value={form.sub_tipo}
                                        onChange={(item) => setForm(prev => ({ ...prev, sub_tipo: item?.id || '' }))}
                                        getLabel={(t) => t.label}
                                        placeholder="Nenhum (vale para todo o grupo)"
                                        disabled={subTypesForSelected.length === 0}
                                    />
                                </div>

                                {/* Média de consumo */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                        Média de Consumo ({form.unidade})
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.media_consumo_padrao}
                                        onChange={e => setForm(prev => ({ ...prev, media_consumo_padrao: e.target.value }))}
                                        placeholder="Ex: 15.00"
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-mono"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {unidadeDescricao(form.unidade)}
                                    </p>
                                </div>

                                {/* Percentual de tolerância */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                        Tolerância Acima da Média (%)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            max="200"
                                            value={form.percentual_tolerancia_padrao}
                                            onChange={e => setForm(prev => ({ ...prev, percentual_tolerancia_padrao: e.target.value }))}
                                            placeholder="20"
                                            className="w-full p-2 pr-8 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-mono"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">%</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Consumo acima deste % gera alerta de consumo excessivo
                                    </p>
                                </div>
                            </div>

                            {/* Unidade (somente leitura — derivada do tipo) */}
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2.5">
                                <span className="text-xs text-gray-500">Unidade do grupo:</span>
                                <span className="font-bold text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{form.unidade}</span>
                                <span className="text-xs text-gray-400">
                                    ({getReadingSourceForUnit(form.unidade) === 'odometro' ? 'usa odômetro (Km)' : 'usa horímetro (Hr)'} · edite em Admin → Veículos)
                                </span>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3 justify-end pt-1">
                                <button onClick={resetForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-5 py-2 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg text-sm flex items-center gap-2 disabled:opacity-70 transition-colors"
                                >
                                    {saving ? <Loader size={14} className="animate-spin"/> : <Save size={14}/>}
                                    {saving ? 'Salvando…' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lista agrupada por tipo */}
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader size={24} className="animate-spin text-yellow-500"/>
                        </div>
                    ) : Object.keys(grouped).length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Fuel size={32} className="mx-auto mb-2 opacity-30"/>
                            <p className="text-sm">Nenhuma configuração cadastrada.</p>
                            <p className="text-xs mt-1">Clique em "Nova Configuração" para começar.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([tipo, items]) => (
                                <TipoGroup
                                    key={tipo}
                                    tipo={tipo}
                                    items={items}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    deleting={deleting}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Rodapé */}
                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg text-sm transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

const TipoGroup = ({ tipo, items, onEdit, onDelete, deleting }) => {
    const [open, setOpen] = useState(true);

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-800">{tipo}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                {open ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </button>

            {open && (
                <div className="divide-y divide-gray-100">
                    {items.sort((a, b) => (a.sub_tipo || '').localeCompare(b.sub_tipo || '')).map(cfg => (
                        <div key={cfg.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700">
                                    {cfg.sub_tipo
                                        ? <span className="font-medium">{cfg.sub_tipo}</span>
                                        : <span className="text-gray-400 italic">Padrão do grupo (sem subgrupo)</span>}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-xs text-gray-500">
                                        {cfg.media_consumo_padrao != null
                                            ? <><strong className="text-blue-700">{parseFloat(cfg.media_consumo_padrao).toFixed(2)}</strong> {cfg.unidade}</>
                                            : <span className="text-gray-400">— sem média definida</span>}
                                    </span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-xs text-gray-500">
                                        Tolerância: <strong className="text-amber-600">{parseFloat(cfg.percentual_tolerancia_padrao || 20).toFixed(0)}%</strong>
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-4 shrink-0">
                                <button
                                    onClick={() => onEdit(cfg)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 size={14}/>
                                </button>
                                <button
                                    onClick={() => onDelete(cfg.id)}
                                    disabled={deleting === cfg.id}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Excluir"
                                >
                                    {deleting === cfg.id ? <Loader size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VehicleTypeConfigModal;



