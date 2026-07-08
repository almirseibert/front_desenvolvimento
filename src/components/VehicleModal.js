import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Loader, X, AlertTriangle, Save, Camera, ShieldCheck, Briefcase, Gauge, MapPin, Package, Fuel, FileText, Trash2, Upload, ExternalLink } from 'lucide-react';
import { checkReadingConsistency, vehicleSubTypes, getGroupUnit } from '../utils/vehicleRules';
import SearchableSelect from './SearchableSelect';

const ModalBtn = ({ variant = 'primary', onClick, disabled, children }) => {
    const [h, setH] = React.useState(false);
    const styles = {
        primary: { bg: h ? '#8a6a34' : '#9E7A42', color: '#fff', border: 'none' },
        cancel:  { bg: h ? '#f5f2ed' : '#fff', color: '#6a5e4e', border: '1px solid #e8e0d4' },
        danger:  { bg: h ? '#9a2e20' : '#b03828', color: '#fff', border: 'none' },
        dark:    { bg: h ? '#2e2820' : '#1c1a17', color: '#fff', border: 'none' },
    };
    const s = styles[variant] || styles.primary;
    return (
        <button onClick={onClick} disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.6 : 1, transition: 'background 0.15s', background: s.bg, color: s.color, border: s.border }}>
            {children}
        </button>
    );
};

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
    vehicleTypeConfigs = [],
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

        sub_tipo: vehicle?.sub_tipo || '',
        media_consumo: vehicle?.media_consumo?.toString() || '',
        percentual_tolerancia: vehicle?.percentual_tolerancia?.toString() || '20',

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

    // --- Documentos ---
    const [documents, setDocuments] = useState([]);
    const [docUploading, setDocUploading] = useState(false);
    const [docNome, setDocNome] = useState('');
    const [docTipo, setDocTipo] = useState('CRLV');

    const loadDocuments = useCallback(async () => {
        if (!vehicle?.id) return;
        try {
            const docs = await apiClient.getVehicleDocuments(vehicle.id);
            setDocuments(docs);
        } catch (e) {
            console.warn('Erro ao carregar documentos:', e.message);
        }
    }, [vehicle?.id, apiClient]);

    useEffect(() => { loadDocuments(); }, [loadDocuments]);

    const handleDocUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !vehicle?.id) return;
        setDocUploading(true);
        try {
            const fd = new FormData();
            fd.append('documentFile', file);
            fd.append('nome', docNome || file.name.replace(/\.pdf$/i, ''));
            fd.append('tipo', docTipo);
            await apiClient.uploadVehicleDocument(vehicle.id, fd);
            setDocNome('');
            await loadDocuments();
        } catch (err) {
            setError('Falha ao enviar documento: ' + err.message);
        } finally {
            setDocUploading(false);
            e.target.value = '';
        }
    };

    const handleDocDelete = async (docId) => {
        if (!vehicle?.id) return;
        try {
            await apiClient.deleteVehicleDocument(vehicle.id, docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
        } catch (err) {
            setError('Falha ao remover documento: ' + err.message);
        }
    };

    // --- Vínculos entre veículos (atrelar) ---
    const [links, setLinks] = useState([]);
    const [linkChildId, setLinkChildId] = useState('');
    const [linkTipo, setLinkTipo] = useState('');
    const [linkSaving, setLinkSaving] = useState(false);

    const loadLinks = useCallback(async () => {
        if (!vehicle?.id) return;
        try {
            const data = await apiClient.getVehicleLinks(vehicle.id);
            setLinks(data || []);
        } catch (e) {
            console.warn('Erro ao carregar vínculos:', e.message);
        }
    }, [vehicle?.id, apiClient]);

    useEffect(() => { loadLinks(); }, [loadLinks]);

    const handleAddLink = async () => {
        if (!vehicle?.id || !linkChildId) return;
        setLinkSaving(true);
        try {
            await apiClient.createVehicleLink({
                parent_vehicle_id: vehicle.id,
                child_vehicle_id: linkChildId,
                tipo_vinculo: linkTipo || null,
            });
            setLinkChildId('');
            setLinkTipo('');
            await loadLinks();
        } catch (err) {
            setError('Falha ao atrelar: ' + err.message);
        } finally {
            setLinkSaving(false);
        }
    };

    const handleRemoveLink = async (id) => {
        try {
            await apiClient.deleteVehicleLink(id);
            setLinks(prev => prev.filter(l => l.id !== id));
        } catch (err) {
            setError('Falha ao remover vínculo: ' + err.message);
        }
    };

    // --- Helpers de Grupo ---
    const vehicleGroupsLocal = (vehicleGroups && Object.keys(vehicleGroups).length > 0)
        ? vehicleGroups
        : require('../utils/vehicleRules').vehicleGroups || {};

    const effectiveGroup = useMemo(() =>
        Object.keys(vehicleGroupsLocal).find(group => vehicleGroupsLocal[group]?.includes(formData.tipo)),
    [formData.tipo, vehicleGroupsLocal]);

    const showOdometro  = useMemo(() => effectiveGroup === 'Veículos Leves'     || effectiveGroup === 'Caminhões de Trecho', [effectiveGroup]);
    const showHorimetro = useMemo(() => effectiveGroup === 'Máquinas Pesadas'   || effectiveGroup === 'Caminhões',           [effectiveGroup]);

    const availableSubTypes = useMemo(() => vehicleSubTypes[formData.tipo] || [], [formData.tipo]);

    // Busca a config padrão do tipo/sub-tipo cadastrada
    const typeConfigDefault = useMemo(() => {
        if (!vehicleTypeConfigs.length) return null;
        // Tenta match exato tipo+sub_tipo, fallback para só o tipo
        const exact = vehicleTypeConfigs.find(
            c => c.tipo === formData.tipo && c.sub_tipo === (formData.sub_tipo || null)
        );
        if (exact) return exact;
        return vehicleTypeConfigs.find(c => c.tipo === formData.tipo && !c.sub_tipo) || null;
    }, [vehicleTypeConfigs, formData.tipo, formData.sub_tipo]);

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
        if (name === 'tipo') {
            // Ao trocar tipo: limpa sub_tipo e sugere média do novo tipo (se houver config)
            const cfg = vehicleTypeConfigs.find(c => c.tipo === value && !c.sub_tipo);
            setFormData(prev => ({
                ...prev,
                tipo: value,
                sub_tipo: '',
                media_consumo: !vehicle && cfg?.media_consumo_padrao != null ? cfg.media_consumo_padrao.toString() : prev.media_consumo,
                percentual_tolerancia: !vehicle && cfg ? cfg.percentual_tolerancia_padrao?.toString() || '20' : prev.percentual_tolerancia,
            }));
            return;
        }
        if (name === 'sub_tipo') {
            // Ao selecionar sub-tipo, sugere média específica do sub-tipo (se houver)
            const cfg = vehicleTypeConfigs.find(c => c.tipo === formData.tipo && c.sub_tipo === value);
            setFormData(prev => ({
                ...prev,
                sub_tipo: value,
                media_consumo: !vehicle && cfg?.media_consumo_padrao != null ? cfg.media_consumo_padrao.toString() : prev.media_consumo,
                percentual_tolerancia: !vehicle && cfg ? cfg.percentual_tolerancia_padrao?.toString() || '20' : prev.percentual_tolerancia,
            }));
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
            sub_tipo:   formData.sub_tipo || null,
            media_consumo: formData.media_consumo !== '' ? parseFloat(formData.media_consumo) : null,
            percentual_tolerancia: formData.percentual_tolerancia !== '' ? parseFloat(formData.percentual_tolerancia) : 20,
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
            <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
                <div className="bg-white w-full max-w-5xl max-h-[95vh] flex flex-col" style={{ borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>

                    {/* Cabeçalho */}
                    <div className="flex justify-between items-start shrink-0 sticky top-0 z-10" style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${isSucata ? '#e8e0d4' : '#f0ebe3'}`, background: isSucata ? '#faf9f7' : '#fff', borderRadius: '12px 12px 0 0' }}>
                        <div className="flex items-center gap-2">
                            {isSucata && <Package size={16} style={{ color: '#71717a' }}/>}
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e1a14' }}>
                                    {vehicle ? `Editar — ${vehicle.registroInterno}` : 'Novo Veículo'}
                                </div>
                                <div style={{ fontSize: 11, color: isSucata ? '#b03828' : '#9a8a78', marginTop: 2 }}>
                                    {isSucata ? 'Veículo marcado como SUCATA — excluído de todos os cálculos.' : 'Cadastro Unificado · Odômetro / Horímetro'}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            style={{ background: 'transparent', border: 'none', color: '#b0a090', cursor: 'pointer', padding: 4, borderRadius: 5, lineHeight: 0, flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f5f2ed'; e.currentTarget.style.color = '#6a5e4e'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b0a090'; }}
                        >
                            <X size={16}/>
                        </button>
                    </div>

                    <form onSubmit={validateAndPrepareSave} className="flex-1 overflow-y-auto p-6 bg-white">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* ── Coluna 1: Identificação ── */}
                            <div className="space-y-5">
                                <h3 className="flex items-center gap-1.5 pb-2" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8a78', borderBottom: '1px solid #f0ebe3' }}>
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
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Grupo de Equipamento *</label>
                                    <SearchableSelect
                                        items={(vehicleTypes || []).map(t => ({ id: t, label: t }))}
                                        value={formData.tipo}
                                        onChange={(item) => handleChange({ target: { name: 'tipo', value: item?.id || '' } })}
                                        getLabel={(t) => t.label}
                                        placeholder="Selecione o tipo..."
                                        required
                                    />
                                </div>

                                {availableSubTypes.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subgrupo</label>
                                        <SearchableSelect
                                            items={availableSubTypes.map(st => ({ id: st, label: st }))}
                                            value={formData.sub_tipo}
                                            onChange={(item) => handleChange({ target: { name: 'sub_tipo', value: item?.id || '' } })}
                                            getLabel={(t) => t.label}
                                            placeholder="Nenhum"
                                        />
                                    </div>
                                )}

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
                                <h3 className="flex items-center gap-1.5 pb-2" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8a78', borderBottom: '1px solid #f0ebe3' }}>
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

                                {/* ── Consumo: média e tolerância ── */}
                                <div className={`p-3 rounded-lg border ${isSucata ? 'opacity-50' : 'bg-amber-50 border-amber-200'}`}>
                                    <p className="text-xs font-bold text-amber-800 uppercase mb-2.5 flex items-center gap-1.5">
                                        <Fuel size={13}/> Parâmetros de Consumo
                                    </p>
                                    <div className="space-y-2.5">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">
                                                Média esperada ({getGroupUnit(formData.tipo)})
                                            </label>
                                            <div className="relative">
                                                <input
                                                    name="media_consumo"
                                                    value={formData.media_consumo}
                                                    onChange={handleChange}
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    disabled={isSucata}
                                                    placeholder={typeConfigDefault?.media_consumo_padrao != null ? `Padrão: ${typeConfigDefault.media_consumo_padrao}` : 'Ex: 15.00'}
                                                    className="w-full p-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none text-sm font-mono disabled:bg-gray-100"
                                                />
                                            </div>
                                            {typeConfigDefault?.media_consumo_padrao != null && !formData.media_consumo && (
                                                <p className="text-[10px] text-amber-600 mt-0.5">
                                                    Usando padrão do grupo: {typeConfigDefault.media_consumo_padrao} {typeConfigDefault.unidade}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Tolerância acima da média (%)</label>
                                            <div className="relative">
                                                <input
                                                    name="percentual_tolerancia"
                                                    value={formData.percentual_tolerancia}
                                                    onChange={handleChange}
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    max="200"
                                                    disabled={isSucata}
                                                    className="w-full p-2 pr-8 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none text-sm font-mono disabled:bg-gray-100"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Coluna 3: Foto e Documentação ── */}
                            <div className="space-y-5">
                                <h3 className="flex items-center gap-1.5 pb-2" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8a78', borderBottom: '1px solid #f0ebe3' }}>
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

                                {/* Documentos do Veículo */}
                                {vehicle?.id && (
                                    <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                                        <p className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                                            <FileText size={13}/> Documentos
                                        </p>

                                        {/* Lista */}
                                        {documents.length > 0 ? (
                                            <ul className="space-y-1">
                                                {documents.map(doc => {
                                                    const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace('/api', '');
                                                    const href = doc.url.startsWith('http') ? doc.url : `${apiBase}${doc.url}`;
                                                    return (
                                                        <li key={doc.id} className="flex items-center justify-between gap-2 text-xs bg-white border rounded px-2 py-1.5">
                                                            <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline truncate">
                                                                <ExternalLink size={11} className="shrink-0"/>
                                                                <span className="truncate">{doc.nome}</span>
                                                                <span className="text-gray-400 shrink-0">({doc.tipo})</span>
                                                            </a>
                                                            <button onClick={() => handleDocDelete(doc.id)} className="text-red-400 hover:text-red-600 shrink-0">
                                                                <Trash2 size={13}/>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-gray-400">Nenhum documento cadastrado.</p>
                                        )}

                                        {/* Upload */}
                                        <div className="pt-1 space-y-1.5">
                                            <div className="flex gap-1.5">
                                                <input
                                                    type="text"
                                                    placeholder="Nome do documento"
                                                    value={docNome}
                                                    onChange={e => setDocNome(e.target.value)}
                                                    className="flex-1 min-w-0 p-1.5 border rounded text-xs"
                                                />
                                                <select
                                                    value={docTipo}
                                                    onChange={e => setDocTipo(e.target.value)}
                                                    className="p-1.5 border rounded text-xs bg-white"
                                                >
                                                    <option>CRLV</option>
                                                    <option>Seguro</option>
                                                    <option>Contrato</option>
                                                    <option>AET</option>
                                                    <option>Outro</option>
                                                </select>
                                            </div>
                                            <label className={`flex items-center justify-center gap-1.5 w-full p-1.5 border-2 border-dashed rounded text-xs cursor-pointer transition ${docUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white border-gray-300'}`}>
                                                {docUploading ? <Loader size={12} className="animate-spin"/> : <Upload size={12}/>}
                                                {docUploading ? 'Enviando…' : 'Selecionar PDF'}
                                                <input type="file" accept="application/pdf" onChange={handleDocUpload} disabled={docUploading} className="hidden"/>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Veículos Atrelados */}
                                {vehicle?.id && (
                                    <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                                        <p className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                                            <Package size={13}/> Veículos Atrelados
                                        </p>
                                        <p className="text-[11px] text-gray-400 -mt-1">Ex.: cavalo/prancha ↔ semirreboque, máquina ↔ acessório (rompedor/varredeira).</p>

                                        {links.length > 0 ? (
                                            <ul className="space-y-1">
                                                {links.map(l => {
                                                    const isParent = l.parent_vehicle_id === vehicle.id;
                                                    const outroReg = isParent ? (l.child_registro || l.child_placa) : (l.parent_registro || l.parent_placa);
                                                    const outroMod = isParent ? l.child_modelo : l.parent_modelo;
                                                    return (
                                                        <li key={l.id} className="flex items-center justify-between gap-2 text-xs bg-white border rounded px-2 py-1.5">
                                                            <span className="truncate">
                                                                <span className="text-gray-400">{isParent ? 'Atrelado:' : 'Principal:'}</span>{' '}
                                                                <span className="font-medium">{outroReg}</span>
                                                                {outroMod ? <span className="text-gray-400"> — {outroMod}</span> : null}
                                                                {l.tipo_vinculo ? <span className="text-gray-400"> ({l.tipo_vinculo})</span> : null}
                                                            </span>
                                                            <button onClick={() => handleRemoveLink(l.id)} className="text-red-400 hover:text-red-600 shrink-0" title="Desvincular">
                                                                <Trash2 size={13}/>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-gray-400">Nenhum veículo atrelado.</p>
                                        )}

                                        <div className="pt-1 flex gap-1.5">
                                            <select
                                                value={linkChildId}
                                                onChange={e => setLinkChildId(e.target.value)}
                                                className="flex-1 min-w-0 p-1.5 border rounded text-xs bg-white"
                                            >
                                                <option value="">Selecionar veículo a atrelar…</option>
                                                {vehicles
                                                    .filter(v => v.id !== vehicle.id)
                                                    .map(v => (
                                                        <option key={v.id} value={v.id}>
                                                            {v.registroInterno || v.placa} {v.modelo ? `— ${v.modelo}` : ''}
                                                        </option>
                                                    ))}
                                            </select>
                                            <input
                                                type="text"
                                                placeholder="Tipo (opcional)"
                                                value={linkTipo}
                                                onChange={e => setLinkTipo(e.target.value)}
                                                className="w-28 p-1.5 border rounded text-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddLink}
                                                disabled={!linkChildId || linkSaving}
                                                className="px-2.5 py-1.5 bg-[#9E7A42] text-white rounded text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {linkSaving ? <Loader size={12} className="animate-spin"/> : 'Atrelar'}
                                            </button>
                                        </div>
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
                    <div className="flex justify-end gap-2 sticky bottom-0 z-10" style={{ padding: '12px 20px', borderTop: '1px solid #f0ebe3', background: '#fff', borderRadius: '0 0 12px 12px' }}>
                        <ModalBtn variant="cancel" onClick={onClose} disabled={isSaving}>Cancelar</ModalBtn>
                        <ModalBtn variant={isSucata ? 'dark' : 'primary'} onClick={validateAndPrepareSave} disabled={isSaving}>
                            {isSaving ? <Loader size={14} className="animate-spin"/> : <Save size={14}/>}
                            {isSaving ? 'Salvando…' : 'Salvar Veículo'}
                        </ModalBtn>
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
