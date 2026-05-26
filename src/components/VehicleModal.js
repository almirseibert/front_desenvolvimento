import React, { useState, useMemo, useEffect } from 'react';
import { Loader, X, AlertTriangle, Save, Camera, ShieldCheck, Briefcase, Gauge, MapPin, Package } from 'lucide-react';
import { checkReadingConsistency } from '../utils/vehicleRules';

// Statuses que podem ser definidos manualmente no cadastro/edição
const MANUAL_STATUS_OPTIONS = [
    { value: 'Disponível',            label: 'Disponível' },
    { value: 'Aguardando Manutenção', label: 'Aguardando Manutenção' },
    { value: 'Sucata',                label: '⚠️ Sucata (retirada definitiva de circulação)' },
];

// --- MODAL DE CRIAÇÃO/EDIÇÃO DE VEÍCULO (V2.8 - Status Sucata) ---
const VehicleModal = ({
    user,
    vehicle,
    vehicles = [],
    vehicleTypes = [],
    vehicleGroups = {},
    onClose,
    setAlertMessage,
    apiClient,
    reloadData,
    PasswordConfirmationModal
}) => {

    // --- Helper de Recuperação Robusta de Dados ---
    const resolveValue = (obj, keys) => {
        if (!obj) return '';
        for (const key of keys) {
            if (obj[key] !== undefined && obj[key] !== null) return obj[key].toString();
        }
        return '';
    };

    // --- Estado do Formulário ---
    const [formData, setFormData] = useState(() => ({
        placa:            vehicle?.placa || '',
        registroInterno:  vehicle?.registroInterno || '',
        capacidade:       vehicle?.capacidade?.toString() || '',
        tipo:             vehicle?.tipo || (vehicleTypes.length > 0 ? vehicleTypes[0] : ''),
        marca:            vehicle?.marca || '',
        modelo:           vehicle?.modelo || '',

        // Recuperação agressiva (Ano/Cor)
        anoFabricacao: resolveValue(vehicle, ['ano_fabricacao', 'anoFabricacao', 'AnoFabricacao']),
        anoModelo:     resolveValue(vehicle, ['ano_modelo',     'anoModelo',     'AnoModelo'    ]),
        cor:           resolveValue(vehicle, ['cor',  'Cor'  ]),
        chassi:        resolveValue(vehicle, ['chassi','Chassi']),

        // Leituras
        odometro:  vehicle?.odometro?.toString()  || '0',
        horimetro: vehicle?.horimetro?.toString() || '0',

        // Configurações
        isComboioVehicle: vehicle?.isComboioVehicle || false,
        isOutsourced:     vehicle?.isOutsourced     || false,

        // Dados do terceirizado (campos dedicados no banco)
        nomeEmpresaTerceiro: vehicle?.nomeEmpresaTerceiro || '',
        contratoTerceiro:    vehicle?.contratoTerceiro    || '',

        // Rastreador
        rastreador: vehicle?.rastreador || 'Sem Rastreador',

        fuelCapacity: vehicle?.fuelCapacity?.toString() || '',

        // Validades
        validadeTacografo: vehicle?.validadeTacografo ? new Date(vehicle.validadeTacografo).toISOString().split('T')[0] : '',
        validadeAET_DAER:  vehicle?.validadeAET_DAER  ? new Date(vehicle.validadeAET_DAER).toISOString().split('T')[0]  : '',
        validadeAET_DNIT:  vehicle?.validadeAET_DNIT  ? new Date(vehicle.validadeAET_DNIT).toISOString().split('T')[0]  : '',

        // Bloqueio de circulação
        canCirculate: (vehicle?.canCirculate === false || vehicle?.canCirculate === 0) ? false : true,

        // Status manual (novo)
        status: vehicle?.status || 'Disponível',
    }));

    // --- Efeito de Sincronia ---
    useEffect(() => {
        if (vehicle) {
            setFormData(prev => ({
                ...prev,
                anoFabricacao: resolveValue(vehicle, ['ano_fabricacao', 'anoFabricacao', 'AnoFabricacao']),
                anoModelo:     resolveValue(vehicle, ['ano_modelo',     'anoModelo',     'AnoModelo'    ]),
                cor:           resolveValue(vehicle, ['cor', 'Cor'  ]),
                chassi:        resolveValue(vehicle, ['chassi', 'Chassi']),
                rastreador:    vehicle.rastreador || 'Sem Rastreador',
                status:        vehicle.status     || 'Disponível',
            }));
        }
    }, [vehicle]);

    const [fotoFile, setFotoFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [pendingSaveData, setPendingSaveData] = useState(null);
    const [violationMessage, setViolationMessage] = useState('');

    // --- Helpers de Grupo ---
    const vehicleGroupsLocal = (vehicleGroups && Object.keys(vehicleGroups).length > 0)
        ? vehicleGroups
        : require('../utils/vehicleRules').vehicleGroups || {};

    const effectiveGroup = useMemo(() =>
        Object.keys(vehicleGroupsLocal).find(group => vehicleGroupsLocal[group]?.includes(formData.tipo)),
    [formData.tipo, vehicleGroupsLocal]);

    const showOdometro  = useMemo(() => effectiveGroup === 'Veículos Leves'     || effectiveGroup === 'Caminhões de Trecho', [effectiveGroup]);
    const showHorimetro = useMemo(() => effectiveGroup === 'Máquinas Pesadas'   || effectiveGroup === 'Caminhões',           [effectiveGroup]);

    const canBeComboio = useMemo(() => {
        const type = formData.tipo;
        if (effectiveGroup === 'Máquinas Pesadas') return false;
        const forbidden = ['Automóvel', 'Moto', 'Caminhão Pipa', 'Caminhão Prancha', 'Cavalo'];
        if (forbidden.includes(type)) return false;
        if (type.includes('Caçamba')) return false;
        return true;
    }, [formData.tipo, effectiveGroup]);

    const showCapacity = useMemo(() => {
        const type = formData.tipo;
        if (['Caminhão Pipa', 'Caminhão Tanque'].includes(type)) return true;
        if (type.includes('Caçamba')) return true;
        return false;
    }, [formData.tipo]);

    const isSucata = formData.status === 'Sucata';

    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'naoPodeCircular') {
            setFormData(prev => ({ ...prev, canCirculate: !checked }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                setError("O arquivo de imagem é muito grande (máx 5MB).");
                setFotoFile(null);
                e.target.value = null;
            } else {
                setError('');
                setFotoFile(file);
            }
        }
    };

    // --- Validação e Salvamento ---
    const validateAndPrepareSave = async (e) => {
        e.preventDefault();
        setError('');

        const isEditing = !!vehicle;

        if (!formData.placa || !formData.registroInterno || !formData.tipo || !formData.marca || !formData.modelo) {
            setError('Preencha os campos obrigatórios (*).');
            return;
        }

        if (!isEditing || (vehicle && vehicle.registroInterno !== formData.registroInterno)) {
            const exists = vehicles.some(v => v.registroInterno === formData.registroInterno && v.id !== vehicle?.id);
            if (exists) { setError('Já existe um veículo com este registro interno.'); return; }
        }

        let consistencyIssues = [];
        if (isEditing && !isSucata) {
            if (showOdometro) {
                const check = checkReadingConsistency(vehicle, formData.odometro, 'odometro');
                if (check.status === 'bloqueio') consistencyIssues.push(check.message);
            }
            if (showHorimetro) {
                const check = checkReadingConsistency(vehicle, formData.horimetro, 'horimetro');
                if (check.status === 'bloqueio') consistencyIssues.push(check.message);
            }
        }

        const mediaCalculo = showHorimetro ? 'horimetro' : 'odometro';

        const dataToSave = {
            ...formData,
            odometro:  showOdometro  ? (parseFloat(formData.odometro)  || 0) : null,
            horimetro: showHorimetro ? (parseFloat(formData.horimetro) || 0) : null,
            mediaCalculo,
            fuelCapacity: parseFloat(formData.fuelCapacity) || null,
            ano_fabricacao: parseInt(formData.anoFabricacao, 10) || null,
            ano_modelo:     parseInt(formData.anoModelo,     10) || null,
            chassi:      formData.chassi,
            capacidade:  showCapacity ? (parseFloat(formData.capacidade) || null) : null,
            validadeTacografo: formData.validadeTacografo || null,
            validadeAET_DAER:  formData.validadeAET_DAER  || null,
            validadeAET_DNIT:  formData.validadeAET_DNIT  || null,
            cor:       formData.cor,
            rastreador: formData.rastreador,
            status:     formData.status,
            // Sucata: força canCirculate = false e remove alocações ativas
            ...(isSucata && { canCirculate: false }),
        };

        delete dataToSave.anoFabricacao;
        delete dataToSave.anoModelo;
        delete dataToSave.hasRastreador;

        if (!canBeComboio) dataToSave.isComboioVehicle = false;
        if (dataToSave.isComboioVehicle && (!vehicle?.isComboioVehicle || !vehicle?.fuelLevels)) {
            dataToSave.fuelLevels = { dieselS10: 0, dieselComum: 0 };
        }

        if (consistencyIssues.length > 0) {
            setViolationMessage(consistencyIssues.join('\n'));
            setPendingSaveData(dataToSave);
            setShowPasswordModal(true);
            return;
        }

        executeSave(dataToSave);
    };

    const executeSave = async (data) => {
        setIsSaving(true);
        try {
            let vehicleId = vehicle?.id;
            let successMessage = '';

            if (vehicle) {
                await apiClient.updateVehicle(vehicle.id, data);
                successMessage = `Veículo ${data.registroInterno} atualizado!`;
            } else {
                const newVehicle = await apiClient.createVehicle({ ...data, status: data.status || 'Disponível' });
                vehicleId = newVehicle.id;
                successMessage = `Veículo ${data.registroInterno} adicionado!`;
            }

            if (fotoFile && vehicleId) {
                const uploadFormData = new FormData();
                uploadFormData.append('fotoFile', fotoFile);
                await apiClient.uploadVehicleImage(vehicleId, uploadFormData);
            }

            setAlertMessage(successMessage);
            reloadData();
            onClose();
        } catch (err) {
            console.error("Erro ao salvar:", err);
            setError(err.response?.data?.message || err.message || "Erro ao salvar.");
        } finally {
            setIsSaving(false);
            setShowPasswordModal(false);
        }
    };

    const apiBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace('/api', '');
    const previewImageUrl = fotoFile
        ? URL.createObjectURL(fotoFile)
        : (vehicle?.fotoURL
            ? (vehicle.fotoURL.startsWith('http') ? vehicle.fotoURL : `${apiBaseUrl}${vehicle.fotoURL}`)
            : 'https://placehold.co/150x100/e2e8f0/cbd5e0?text=Sem+Foto');

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
                <div className={`bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col my-auto border ${isSucata ? 'border-zinc-400' : 'border-gray-100'}`}>

                    {/* Cabeçalho */}
                    <div className={`p-5 border-b flex justify-between items-center rounded-t-xl sticky top-0 z-10 ${isSucata ? 'bg-zinc-100 border-zinc-300' : 'bg-gray-50'}`}>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                {isSucata && <Package size={18} className="text-zinc-500"/>}
                                {vehicle ? `Editar ${vehicle.registroInterno}` : 'Novo Veículo'}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {isSucata
                                    ? '⚠️ Este veículo está marcado como SUCATA — excluído de todos os cálculos.'
                                    : 'Cadastro Unificado (Odômetro / Horímetro).'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors" disabled={isSaving}>
                            <X size={20}/>
                        </button>
                    </div>

                    <form onSubmit={validateAndPrepareSave} className="flex-1 overflow-y-auto p-6 bg-white">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* ── Coluna 1: Identificação ── */}
                            <div className="space-y-5">
                                <h3 className="font-semibold text-gray-700 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <ShieldCheck size={16}/> Identificação
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Registro *</label>
                                        <input name="registroInterno" value={formData.registroInterno} onChange={handleChange} placeholder="Ex: C01" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Placa *</label>
                                        <input name="placa" value={formData.placa} onChange={handleChange} placeholder="ABC-1234" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none uppercase text-sm"/>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de Equipamento *</label>
                                    <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 outline-none text-sm" required>
                                        <option value="">Selecione...</option>
                                        {(vehicleTypes || []).map(type => <option key={type} value={type}>{type}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Marca *</label>
                                        <input name="marca" value={formData.marca} onChange={handleChange} placeholder="Volvo" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Modelo *</label>
                                        <input name="modelo" value={formData.modelo} onChange={handleChange} placeholder="FH 540" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"/>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Ano Fab.</label>
                                        <input name="anoFabricacao" type="number" value={formData.anoFabricacao} onChange={handleChange} placeholder="2024" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Ano Mod.</label>
                                        <input name="anoModelo" type="number" value={formData.anoModelo} onChange={handleChange} placeholder="2025" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cor</label>
                                        <input name="cor" value={formData.cor} onChange={handleChange} placeholder="Branco" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"/>
                                    </div>
                                </div>

                                {/* Status Manual */}
                                <div className={`p-3 rounded-lg border ${isSucata ? 'bg-zinc-100 border-zinc-300' : 'bg-gray-50 border-gray-200'}`}>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Status do Veículo</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className={`w-full p-2 border rounded-lg bg-white focus:ring-2 outline-none text-sm font-medium ${isSucata ? 'focus:ring-zinc-400 border-zinc-300 text-zinc-700' : 'focus:ring-yellow-400 border-gray-200 text-gray-700'}`}
                                    >
                                        {MANUAL_STATUS_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    {isSucata && (
                                        <p className="text-[11px] text-zinc-600 mt-2 flex items-start gap-1.5">
                                            <AlertTriangle size={12} className="shrink-0 mt-0.5"/>
                                            Veículos em <strong>Sucata</strong> ficam ocultos das listas, excluídos de todos os cálculos de frota e servem apenas como banco de peças.
                                        </p>
                                    )}
                                </div>

                                {/* Terceirizado: checkbox + campos extras se marcado */}
                                <div className={`rounded-lg border transition-colors ${formData.isOutsourced ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="p-3">
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                            <input type="checkbox" name="isOutsourced" checked={formData.isOutsourced} onChange={handleChange} className="h-5 w-5 text-purple-600 rounded"/>
                                            <span className={`font-bold text-sm flex items-center gap-2 ${formData.isOutsourced ? 'text-purple-800' : 'text-gray-600'}`}>
                                                <Briefcase size={15}/> Veículo Terceirizado?
                                            </span>
                                        </label>
                                    </div>
                                    {formData.isOutsourced && (
                                        <div className="px-3 pb-3 space-y-2.5 border-t border-purple-200 pt-3">
                                            <p className="text-[10px] text-purple-500 font-medium uppercase tracking-wide">Dados do fornecedor</p>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Empresa / Fornecedor</label>
                                                <input
                                                    name="nomeEmpresaTerceiro"
                                                    value={formData.nomeEmpresaTerceiro}
                                                    onChange={handleChange}
                                                    placeholder="Ex: Transportes Silva Ltda"
                                                    className="w-full p-2 border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-400 outline-none text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nº do Contrato / Referência</label>
                                                <input
                                                    name="contratoTerceiro"
                                                    value={formData.contratoTerceiro}
                                                    onChange={handleChange}
                                                    placeholder="Ex: CT-2025-042"
                                                    className="w-full p-2 border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-400 outline-none text-sm font-mono"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Coluna 2: Leituras e Capacidades ── */}
                            <div className="space-y-5">
                                <h3 className="font-semibold text-gray-700 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <Gauge size={16}/> Leituras e Capacidades
                                </h3>

                                {showHorimetro && (
                                    <div className={`p-4 rounded-lg border shadow-sm ${isSucata ? 'bg-zinc-50 border-zinc-200 opacity-60' : 'bg-blue-50 border-blue-200'}`}>
                                        <label className="block text-sm font-bold text-blue-900 uppercase mb-1">Horímetro Atual (Hr) *</label>
                                        <input name="horimetro" value={formData.horimetro} onChange={handleChange} type="number" step="0.1"
                                            disabled={isSucata}
                                            className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-lg font-mono text-blue-900 disabled:bg-gray-100 disabled:text-gray-400"/>
                                        <p className="text-[10px] text-blue-500 mt-1">Para Caminhões Caçamba e Máquinas.</p>
                                    </div>
                                )}

                                {showOdometro && (
                                    <div className={`p-4 rounded-lg border shadow-sm ${isSucata ? 'bg-zinc-50 border-zinc-200 opacity-60' : 'bg-emerald-50 border-emerald-200'}`}>
                                        <label className="block text-sm font-bold text-emerald-900 uppercase mb-1">Odômetro (Km) *</label>
                                        <input name="odometro" value={formData.odometro} onChange={handleChange} type="number" step="any"
                                            disabled={isSucata}
                                            className="w-full p-3 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none text-lg font-mono text-emerald-900 disabled:bg-gray-100 disabled:text-gray-400"/>
                                        <p className="text-[10px] text-emerald-500 mt-1">Para Veículos Leves e Caminhões de Trecho.</p>
                                    </div>
                                )}

                                {canBeComboio && !isSucata && (
                                    <div className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition">
                                        <input name="isComboioVehicle" id="isComboioVehicle" type="checkbox" checked={formData.isComboioVehicle} onChange={handleChange} className="h-5 w-5 rounded text-yellow-600 focus:ring-yellow-500"/>
                                        <label htmlFor="isComboioVehicle" className="ml-3 text-sm font-bold text-gray-700 cursor-pointer w-full">É um veículo Comboio?</label>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Chassi</label>
                                    <input name="chassi" value={formData.chassi} onChange={handleChange} placeholder="Identificação do chassi" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none uppercase text-sm"/>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {showCapacity && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Capacidade (m³)</label>
                                            <input name="capacidade" value={formData.capacidade} onChange={handleChange} type="number" step="any" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"/>
                                        </div>
                                    )}
                                    <div className={showCapacity ? '' : 'col-span-2'}>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tanque (L)</label>
                                        <input name="fuelCapacity" value={formData.fuelCapacity} onChange={handleChange} type="number" step="any" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"/>
                                    </div>
                                </div>
                            </div>

                            {/* ── Coluna 3: Foto e Documentação ── */}
                            <div className="space-y-5">
                                <h3 className="font-semibold text-gray-700 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <Camera size={16}/> Foto e Documentação
                                </h3>

                                <div className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg transition cursor-pointer relative group ${isSucata ? 'border-zinc-300 hover:bg-zinc-50 grayscale' : 'border-gray-300 hover:bg-gray-50'}`}>
                                    <img
                                        src={previewImageUrl}
                                        alt="Preview"
                                        className="w-full h-32 object-contain rounded-md mb-2"
                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x100?text=Sem+Imagem'; }}
                                    />
                                    <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all cursor-pointer">
                                        <span className="bg-white py-1 px-3 rounded shadow text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Alterar Foto</span>
                                        <input type="file" name="fotoFile" accept="image/*" onChange={handleFileChange} className="hidden"/>
                                    </label>
                                </div>

                                {(effectiveGroup === 'Caminhões' || effectiveGroup === 'Caminhões de Trecho') && (
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm space-y-3">
                                        <p className="font-bold text-blue-800 text-xs uppercase">Validades Obrigatórias</p>
                                        {[
                                            { name: 'validadeTacografo', label: 'Tacógrafo'   },
                                            { name: 'validadeAET_DAER',  label: 'AET DAER/RS' },
                                            { name: 'validadeAET_DNIT',  label: 'AET DNIT'    },
                                        ].map(({ name, label }) => (
                                            <div key={name}>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                                                <input name={name} value={formData[name]} onChange={handleChange} type="date" className="w-full p-1.5 border rounded bg-white text-sm"/>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Rastreador */}
                                <div className="p-3 border rounded-lg bg-gray-50">
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                                        <MapPin size={14} className="text-blue-600"/> Sistema de Rastreamento
                                    </label>
                                    <select name="rastreador" value={formData.rastreador} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                                        <option value="Sem Rastreador">Sem Rastreador</option>
                                        <option value="Sigasul">Sigasul</option>
                                        <option value="Fleet">Fleet</option>
                                        <option value="Khronos">Khronos</option>
                                        <option value="Sigasul+ID">Sigasul + ID</option>
                                    </select>
                                </div>

                                {/* Não Pode Circular — oculto se sucata (é implícito) */}
                                {!isSucata && (
                                    <div className={`p-3 rounded-lg border ${!formData.canCirculate ? 'bg-red-100 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                            <input type="checkbox" name="naoPodeCircular" checked={!formData.canCirculate} onChange={handleChange} className="h-5 w-5 text-red-600 rounded"/>
                                            <span className={`font-bold text-sm ${!formData.canCirculate ? 'text-red-800' : 'text-gray-600'}`}>NÃO Pode Circular?</span>
                                        </label>
                                    </div>
                                )}

                                {error && (
                                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                                        <AlertTriangle size={15} className="mt-0.5 shrink-0"/>
                                        <span>{error}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>

                    {/* Rodapé */}
                    <div className={`p-4 border-t rounded-b-xl flex justify-end gap-3 sticky bottom-0 z-10 ${isSucata ? 'bg-zinc-50 border-zinc-200' : 'bg-gray-50'}`}>
                        <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm" disabled={isSaving}>Cancelar</button>
                        <button onClick={validateAndPrepareSave} disabled={isSaving}
                            className={`px-6 py-2.5 font-bold rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm ${isSucata ? 'bg-zinc-600 hover:bg-zinc-700 text-white' : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'}`}>
                            {isSaving ? <Loader size={16} className="animate-spin"/> : <Save size={16}/>}
                            {isSaving ? 'Salvando…' : 'Salvar Veículo'}
                        </button>
                    </div>
                </div>
            </div>

            {showPasswordModal && (
                <PasswordConfirmationModal
                    message={`ATENÇÃO: Inconsistência de leitura detectada!\n\n${violationMessage}\n\nÉ necessário autorização de supervisor para prosseguir.`}
                    onConfirm={() => executeSave(pendingSaveData)}
                    onClose={() => setShowPasswordModal(false)}
                    apiClient={apiClient}
                />
            )}
        </>
    );
};

export default VehicleModal;
