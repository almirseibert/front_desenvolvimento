import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Loader, X, Lock, Camera, Image as ImageIcon, CheckCircle, Trash2,
    Gauge, CalendarClock, Fuel, ArrowRight, AlertTriangle, Droplet
} from 'lucide-react';
import { getAllowedReadingTypes, getGroupForType } from '../../utils/vehicleRules';
import SearchableObraSelect from '../SearchableObraSelect';
import SearchableSelect from '../SearchableSelect';

// ─── Compressão de imagem (mesma lógica da SolicitacaoAbastecimentoPage) ──────
const compressImage = (file, callback) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1280;
            let { width, height } = img;
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                const compressed = new File([blob], (file.name || 'foto').replace(/\.[^/.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                });
                callback(compressed, URL.createObjectURL(compressed));
            }, 'image/jpeg', 0.7);
        };
    };
};

// ─── Captura de uma foto (câmera ou galeria) ──────────────────────────────────
const PhotoCapture = ({ label, hint, photo, onPick, onClear }) => {
    const camRef = useRef(null);
    const galRef = useRef(null);

    const handle = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        compressImage(file, (compressed, preview) => onPick(compressed, preview));
        e.target.value = '';
    };

    return (
        <div className="space-y-1">
            <label className="text-xs font-bold text-gray-600 uppercase ml-0.5 flex items-center gap-1">
                {label} <span className="text-red-500">*</span>
            </label>
            {hint && <p className="text-[11px] text-gray-400 -mt-0.5">{hint}</p>}
            <div className={`border-2 border-dashed rounded-xl p-2 flex items-center justify-center h-36 relative overflow-hidden ${photo ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                {photo ? (
                    <div onClick={onClear} className="w-full h-full relative cursor-pointer">
                        <img src={photo.preview} alt={label} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center">
                            <span className="bg-white px-2 py-0.5 rounded-full shadow text-[11px] font-bold text-green-700 inline-flex items-center gap-1">
                                <CheckCircle size={11} /> OK <span className="text-gray-300">|</span> <Trash2 size={10} className="text-red-500" /> Trocar
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-3 w-full h-full items-center justify-center">
                        <div onClick={() => camRef.current?.click()} className="flex-1 h-full flex flex-col items-center justify-center bg-white rounded-lg cursor-pointer hover:bg-yellow-50 active:bg-yellow-100 transition border border-gray-200 shadow-sm">
                            <Camera size={26} className="text-gray-700 mb-1" />
                            <span className="text-xs font-bold text-gray-700">Câmera</span>
                        </div>
                        <div onClick={() => galRef.current?.click()} className="flex-1 h-full flex flex-col items-center justify-center bg-white rounded-lg cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition border border-gray-200 shadow-sm">
                            <ImageIcon size={26} className="text-gray-700 mb-1" />
                            <span className="text-xs font-bold text-gray-700">Galeria</span>
                        </div>
                    </div>
                )}
                <input type="file" ref={camRef} className="hidden" accept="image/*" capture="environment" onChange={handle} />
                <input type="file" ref={galRef} className="hidden" accept="image/*" onChange={handle} />
            </div>
        </div>
    );
};

// ─── Modal principal: distribuição (saída) feita pelo operador do comboio ─────
const ComboioDistribuicaoModal = ({
    user,
    comboioVehicle,
    vehicles = [],
    obras = [],
    employees = [],
    transactions = [],
    onClose,
    setAlertMessage,
    apiClient,
    reloadData,
}) => {
    const today = () => new Date().toISOString().split('T')[0];

    const emptyForm = {
        receivingVehicleId: '',
        obraId: '',
        fuelType: '',
        employeeId: '',
        odometro: '',
        horimetro: '',
        date: today(),
        liters: '',
    };

    const [step, setStep] = useState('dados'); // 'dados' | 'finalizar'
    const [formData, setFormData] = useState(emptyForm);
    const [photos, setPhotos] = useState({ horimetro: null, re: null, medidorZerado: null, litragem: null });
    const [isSaving, setIsSaving] = useState(false);
    const [blockReason, setBlockReason] = useState(null);

    const availableMachines = useMemo(
        () => vehicles
            .filter(v => !v.isComboioVehicle && v.id !== comboioVehicle?.id)
            .sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')),
        [vehicles, comboioVehicle]
    );
    const sortedObras = useMemo(() => obras.filter(o => ['ativa', 'mobilizacao'].includes(o.status)).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')), [obras]);
    const sortedEmployees = useMemo(() => [...employees].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')), [employees]);
    const selectedVehicle = useMemo(() => vehicles.find(v => v.id === formData.receivingVehicleId), [formData.receivingVehicleId, vehicles]);

    // Último tipo de combustível que ESTE comboio abasteceu no equipamento.
    const lastFuelForVehicle = useCallback((vehId) => {
        const last = transactions
            .filter(t => t.type === 'saida' && t.receivingVehicleId === vehId && t.fuelType)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        return last?.fuelType || '';
    }, [transactions]);

    const availableFuels = useMemo(
        () => Object.entries(comboioVehicle?.fuelLevels || {}).filter(([, level]) => level > 0),
        [comboioVehicle]
    );

    // Auto-preenchimento ao escolher o veículo (tudo como sugestão, editável).
    useEffect(() => {
        if (!selectedVehicle) return;

        let autoEmployee = '';
        if (selectedVehicle.operationalAssignment?.employeeId) {
            autoEmployee = selectedVehicle.operationalAssignment.employeeId;
        } else {
            // Fallback: operador ativo do veículo no histórico da obra atual.
            const obra = obras.find(o => o.id === selectedVehicle.obraAtualId);
            const hist = obra?.historicoVeiculos?.find(h => String(h.veiculoId) === String(selectedVehicle.id) && !h.dataSaida);
            if (hist?.employeeId) autoEmployee = hist.employeeId;
        }

        const sugFuel = lastFuelForVehicle(selectedVehicle.id)
            || (availableFuels.length === 1 ? availableFuels[0][0] : '');

        setFormData(prev => ({
            ...prev,
            obraId: prev.obraId || selectedVehicle.obraAtualId || '',
            employeeId: prev.employeeId || autoEmployee,
            fuelType: prev.fuelType || sugFuel,
            date: prev.date || today(),
        }));
    }, [selectedVehicle, obras, availableFuels, lastFuelForVehicle]);

    // Validação de leitura em tempo real (mesmas regras de bloqueio do sistema).
    useEffect(() => {
        if (!selectedVehicle) { setBlockReason(null); return; }
        const allowed = getAllowedReadingTypes(selectedVehicle.tipo);
        const isKm = allowed.includes('odometro');
        let reason = null;

        if (isKm && formData.odometro) {
            const current = parseFloat(formData.odometro);
            const last = parseFloat(selectedVehicle.odometro || 0);
            if (!isNaN(current) && last > 0) {
                const limite = getGroupForType(selectedVehicle.tipo) === 'Caminhões de Trecho' ? 2000 : 1000;
                if (current <= last) reason = `Odômetro (${current}) menor/igual ao atual (${last}).`;
                else if (current - last > limite) reason = `Salto excessivo de Km (> ${limite}).`;
            }
        }
        if (!isKm && formData.horimetro) {
            const current = parseFloat(formData.horimetro);
            const last = parseFloat(selectedVehicle.horimetro || 0);
            if (!isNaN(current) && last > 0) {
                if (current <= last) reason = `Horímetro (${current}) menor/igual ao atual (${last}).`;
                else if (current - last > 50) reason = `Salto excessivo de Horas (> 50h).`;
            }
        }
        setBlockReason(reason);
    }, [formData.odometro, formData.horimetro, selectedVehicle]);

    const setField = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));

    const pickPhoto = (key) => (file, preview) => setPhotos(prev => ({ ...prev, [key]: { file, preview } }));
    const clearPhoto = (key) => () => setPhotos(prev => ({ ...prev, [key]: null }));

    const isKmVehicle = selectedVehicle && getAllowedReadingTypes(selectedVehicle.tipo).includes('odometro');
    const readingValue = isKmVehicle ? formData.odometro : formData.horimetro;

    // --- Validação da etapa 1 (dados + 3 fotos) ---
    const canStart = () => {
        if (!formData.receivingVehicleId || !formData.obraId || !formData.fuelType || !formData.employeeId) return false;
        if (!readingValue) return false;
        if (blockReason) return false;
        if (!photos.horimetro || !photos.re || !photos.medidorZerado) return false;
        return true;
    };

    const handleStart = () => {
        if (!formData.receivingVehicleId || !formData.obraId || !formData.fuelType || !formData.employeeId) {
            setAlertMessage('Preencha veículo, obra, funcionário e combustível.');
            return;
        }
        if (!readingValue) {
            setAlertMessage(`Informe o ${isKmVehicle ? 'odômetro' : 'horímetro'} atual.`);
            return;
        }
        if (blockReason) {
            setAlertMessage(`Leitura bloqueada: ${blockReason}`);
            return;
        }
        if (!photos.horimetro || !photos.re || !photos.medidorZerado) {
            setAlertMessage('Tire as 3 fotos exigidas antes de iniciar o abastecimento.');
            return;
        }
        setStep('finalizar');
    };

    // --- Finalização (4ª foto + litragem) ---
    const handleFinish = async () => {
        const liters = parseFloat(String(formData.liters).replace(',', '.'));
        if (!liters || liters <= 0) {
            setAlertMessage('Informe a litragem abastecida.');
            return;
        }
        if (!photos.litragem) {
            setAlertMessage('Tire a foto do medidor com a litragem abastecida.');
            return;
        }
        const stock = comboioVehicle?.fuelLevels?.[formData.fuelType] || 0;
        if (liters > stock) {
            setAlertMessage(`Saldo insuficiente no comboio. Disponível: ${stock.toFixed(2)} L.`);
            return;
        }

        setIsSaving(true);
        try {
            const payload = new FormData();
            payload.append('comboioVehicleId', comboioVehicle.id);
            payload.append('receivingVehicleId', formData.receivingVehicleId);
            payload.append('obraId', formData.obraId);
            payload.append('employeeId', formData.employeeId);
            payload.append('fuelType', formData.fuelType);
            payload.append('liters', String(liters));
            payload.append('date', new Date(formData.date + 'T12:00:00Z').toISOString());
            if (isKmVehicle) payload.append('odometro', String(parseFloat(formData.odometro) || ''));
            else payload.append('horimetro', String(parseFloat(formData.horimetro) || ''));
            payload.append('createdBy', JSON.stringify({
                userId: user.id || user.uid,
                userEmail: user.email || 'sistema@frotasmak.com',
                name: user.name,
            }));
            payload.append('foto_horimetro', photos.horimetro.file);
            payload.append('foto_re', photos.re.file);
            payload.append('foto_medidor_zerado', photos.medidorZerado.file);
            payload.append('foto_litragem', photos.litragem.file);

            await apiClient.createComboioSaidaComFotos(payload);
            setAlertMessage('Abastecimento registrado com sucesso!');
            if (reloadData) reloadData();

            // Já abre a tela para um novo abastecimento.
            setFormData(emptyForm);
            setPhotos({ horimetro: null, re: null, medidorZerado: null, litragem: null });
            setBlockReason(null);
            setStep('dados');
        } catch (error) {
            console.error(error);
            setAlertMessage(error.message || 'Erro ao registrar abastecimento.');
        } finally {
            setIsSaving(false);
        }
    };

    const stock = comboioVehicle?.fuelLevels?.[formData.fuelType] || 0;
    const fuelLabel = (t) => (t === 'dieselS10' ? 'Diesel S10' : t === 'dieselComum' ? 'Diesel Comum' : t);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[94vh] flex flex-col">
                {/* Header */}
                <div className="bg-yellow-400 px-5 py-4 rounded-t-3xl flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                            <Fuel size={20} /> {step === 'dados' ? 'Abastecer Veículo' : 'Finalizar Abastecimento'}
                        </h2>
                        <p className="text-[11px] text-gray-800/80">
                            {step === 'dados' ? 'Passo 1 de 2 · dados e fotos iniciais' : 'Passo 2 de 2 · litragem'}
                        </p>
                    </div>
                    <button onClick={onClose} disabled={isSaving} className="p-2 bg-yellow-500/40 rounded-full hover:bg-yellow-500/70">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm">
                    {step === 'dados' ? (
                        <>
                            {/* Veículo */}
                            <div>
                                <label className="block font-bold text-gray-600 text-xs uppercase mb-1">Veículo a Abastecer *</label>
                                <SearchableSelect
                                    items={availableMachines}
                                    value={formData.receivingVehicleId}
                                    onChange={(item) => setField('receivingVehicleId', item?.id || '')}
                                    getLabel={(v) => `${v.registroInterno} - ${v.modelo || ''}`.trim()}
                                    getSubLabel={(v) => v.placa || ''}
                                    placeholder="Selecione o veículo..."
                                    overlay
                                    overlayTitle="Buscar veículo a abastecer..."
                                />
                            </div>

                            {selectedVehicle && (
                                <>
                                    {/* Leitura */}
                                    <div className={`p-3 rounded-xl border ${isKmVehicle ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                                        <label className="text-xs font-bold uppercase mb-1 flex items-center gap-1 text-gray-700">
                                            {isKmVehicle ? <Gauge size={14} /> : <CalendarClock size={14} />}
                                            {isKmVehicle ? 'Odômetro (Km)' : 'Horímetro (Hr)'} *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-lg font-bold"
                                            placeholder={`Atual: ${isKmVehicle ? (selectedVehicle.odometro || 0) : (selectedVehicle.horimetro || 0)}`}
                                            value={readingValue}
                                            onChange={(e) => setField(isKmVehicle ? 'odometro' : 'horimetro', e.target.value)}
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1 text-right">
                                            Atual: {isKmVehicle ? `${selectedVehicle.odometro || 0} Km` : `${selectedVehicle.horimetro || 0} h`}
                                        </p>
                                    </div>

                                    {blockReason && (
                                        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg flex items-center gap-2 font-bold animate-pulse">
                                            <Lock size={18} /> {blockReason}
                                        </div>
                                    )}

                                    {selectedVehicle.naoPodeCircular && (
                                        <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-xs">
                                            <AlertTriangle size={14} /> Veículo marcado como NÃO PODE CIRCULAR.
                                        </div>
                                    )}

                                    {/* Funcionário */}
                                    <div>
                                        <label className="block font-bold text-gray-600 text-xs uppercase mb-1">Funcionário (operando) *</label>
                                        <SearchableSelect
                                            items={sortedEmployees}
                                            value={formData.employeeId}
                                            onChange={(item) => setField('employeeId', item?.id || '')}
                                            getLabel={(e) => e.nome || ''}
                                            getSubLabel={(e) => e.profissao || ''}
                                            placeholder="Selecione o funcionário..."
                                        />
                                    </div>

                                    {/* Obra */}
                                    <div>
                                        <label className="block font-bold text-gray-600 text-xs uppercase mb-1">Obra (Centro de Custo) *</label>
                                        <SearchableObraSelect
                                            obras={sortedObras}
                                            value={formData.obraId}
                                            onChange={(obra) => setField('obraId', obra?.id || '')}
                                            placeholder="Selecione..."
                                            includeInactive={true}
                                        />
                                    </div>

                                    {/* Combustível + Data */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-bold text-gray-600 text-xs uppercase mb-1">Combustível *</label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                                                value={formData.fuelType}
                                                onChange={(e) => setField('fuelType', e.target.value)}
                                            >
                                                <option value="">Selecione</option>
                                                {availableFuels.map(([type, level]) => (
                                                    <option key={type} value={type}>{fuelLabel(type)} ({level.toFixed(1)} L)</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block font-bold text-gray-600 text-xs uppercase mb-1">Data *</label>
                                            <input
                                                type="date"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg"
                                                value={formData.date}
                                                onChange={(e) => setField('date', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Fotos iniciais */}
                                    <div className="pt-2 border-t border-dashed">
                                        <p className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1">
                                            <Camera size={14} /> Fotos obrigatórias antes de abastecer
                                        </p>
                                        <div className="space-y-3">
                                            <PhotoCapture
                                                label="Horímetro / Odômetro atual"
                                                hint="Foto do painel mostrando a leitura."
                                                photo={photos.horimetro}
                                                onPick={pickPhoto('horimetro')}
                                                onClear={clearPhoto('horimetro')}
                                            />
                                            <PhotoCapture
                                                label="RE ou Placa do veículo"
                                                hint="Registro interno (RE) ou placa do veículo."
                                                photo={photos.re}
                                                onPick={pickPhoto('re')}
                                                onClear={clearPhoto('re')}
                                            />
                                            <PhotoCapture
                                                label="Medidor de abastecimento zerado"
                                                hint="Bomba/medidor zerado antes de iniciar."
                                                photo={photos.medidorZerado}
                                                onPick={pickPhoto('medidorZerado')}
                                                onClear={clearPhoto('medidorZerado')}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Resumo */}
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                                <div className="flex justify-between"><span className="text-gray-500">Veículo</span><span className="font-bold text-gray-800">{selectedVehicle?.registroInterno} · {selectedVehicle?.placa}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Combustível</span><span className="font-bold text-gray-800">{fuelLabel(formData.fuelType)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Disponível no comboio</span><span className="font-mono font-bold text-gray-800">{stock.toFixed(1)} L</span></div>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-yellow-900 text-xs flex items-center gap-2">
                                <Droplet size={16} /> Abasteça o veículo agora. Em seguida, fotografe o medidor e informe a litragem.
                            </div>

                            <PhotoCapture
                                label="Medidor com a litragem abastecida"
                                hint="Foto do medidor mostrando os litros abastecidos."
                                photo={photos.litragem}
                                onPick={pickPhoto('litragem')}
                                onClear={clearPhoto('litragem')}
                            />

                            <div>
                                <label className="block font-bold text-gray-600 text-xs uppercase mb-1">Litragem abastecida (L) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    inputMode="decimal"
                                    className="w-full p-3 border border-gray-300 rounded-lg text-2xl font-bold text-center"
                                    placeholder="0,00"
                                    value={formData.liters}
                                    onChange={(e) => setField('liters', e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t p-3 flex gap-2 shrink-0 bg-white rounded-b-3xl">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
                    >
                        Cancelar
                    </button>
                    {step === 'dados' ? (
                        <button
                            onClick={handleStart}
                            disabled={!canStart()}
                            className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            Iniciar Abastecimento <ArrowRight size={18} />
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep('dados')}
                                disabled={isSaving}
                                className="px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleFinish}
                                disabled={isSaving || !formData.liters || !photos.litragem}
                                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                Finalizar
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ComboioDistribuicaoModal;
