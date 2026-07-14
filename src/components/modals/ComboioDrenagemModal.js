import React, { useState, useMemo, useEffect } from 'react';
import { Loader, X, Truck, ArrowRightLeft, Trash2 } from 'lucide-react';
import SearchableSelect from '../SearchableSelect';
import { getAllowedReadingTypes, getVehicleMainReading } from '../../utils/vehicleRules';

// Converte o fuelType de um refueling (dieselS10 / dieselS500 / dieselComum...)
// para a convenção do comboio (dieselS10 / dieselComum). A drenagem é, na
// prática, sempre diesel.
const toComboioFuelKey = (fuelType) => {
    const f = String(fuelType || '').toLowerCase();
    if (f.includes('s10')) return 'dieselS10';
    if (f.includes('s500') || f.includes('comum') || f.includes('diesel')) return 'dieselComum';
    return fuelType || '';
};

const recDate = (r) => new Date(r?.data || r?.date || 0).getTime();

const ComboioDrenagemModal = ({
    user,
    vehicles = [],
    refuelings = [],
    onClose,
    setAlertMessage,
    apiClient,
    reloadData
}) => {
    const [formData, setFormData] = useState({
        destino: 'comboio',
        drainingVehicleId: '',
        comboioVehicleId: '',
        receivingVehicleId: '',
        liters: '',
        date: new Date().toISOString().split('T')[0],
        fuelType: '',
        reason: '',
        odometro: '',
        horimetro: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    // Listas
    const comboioVehicles = useMemo(
        () => vehicles.filter(v => v.isComboioVehicle).sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')),
        [vehicles]
    );
    const drainableVehicles = useMemo(
        () => vehicles.filter(v => !v.isComboioVehicle).sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')),
        [vehicles]
    );
    const selectedDrainingVehicle = useMemo(
        () => drainableVehicles.find(v => v.id === formData.drainingVehicleId),
        [formData.drainingVehicleId, drainableVehicles]
    );
    // Receptores da transfusão: qualquer equipamento diferente da origem
    const receivingVehicles = useMemo(
        () => vehicles.filter(v => v.id !== formData.drainingVehicleId)
            .sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')),
        [vehicles, formData.drainingVehicleId]
    );
    const selectedReceivingVehicle = useMemo(
        () => receivingVehicles.find(v => v.id === formData.receivingVehicleId),
        [formData.receivingVehicleId, receivingVehicles]
    );

    // Abastecimentos da origem, mais recentes primeiro
    const originRefuelings = useMemo(() => {
        if (!formData.drainingVehicleId) return [];
        return refuelings
            .filter(r => String(r.vehicleId) === String(formData.drainingVehicleId)
                && parseFloat(r.litrosAbastecidos) > 0)
            .sort((a, b) => recDate(b) - recDate(a));
    }, [refuelings, formData.drainingVehicleId]);

    // Auto-seleciona o combustível pela abastecida mais recente da origem
    useEffect(() => {
        if (originRefuelings.length > 0) {
            const key = toComboioFuelKey(originRefuelings[0].fuelType);
            if (key) setFormData(prev => ({ ...prev, fuelType: key }));
        }
    }, [originRefuelings]);

    // Pré-preenche a leitura do receptor com o valor atual do veículo
    useEffect(() => {
        if (selectedReceivingVehicle) {
            setFormData(prev => ({
                ...prev,
                odometro: selectedReceivingVehicle.odometro ?? '',
                horimetro: selectedReceivingVehicle.horimetro ?? '',
            }));
        }
    }, [selectedReceivingVehicle]);

    // Disponível para drenagem = soma das 2 últimas abastecidas do combustível escolhido
    const disponivel = useMemo(() => {
        if (!formData.fuelType) return null;
        const matching = originRefuelings.filter(r => toComboioFuelKey(r.fuelType) === formData.fuelType);
        const last2 = matching.slice(0, 2);
        if (last2.length === 0) return 0;
        return last2.reduce((s, r) => s + (parseFloat(r.litrosAbastecidos) || 0), 0);
    }, [originRefuelings, formData.fuelType]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    // Campo de leitura do receptor (odômetro OU horímetro conforme o tipo)
    const receiverReading = useMemo(() => {
        if (!selectedReceivingVehicle) return null;
        const usesKm = getAllowedReadingTypes(selectedReceivingVehicle.tipo).includes('odometro');
        return usesKm ? { name: 'odometro', label: 'Odômetro (Km)' } : { name: 'horimetro', label: 'Horímetro (Hr)' };
    }, [selectedReceivingVehicle]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { destino, drainingVehicleId, comboioVehicleId, receivingVehicleId, liters, fuelType } = formData;

        if (!drainingVehicleId || !liters || !fuelType) {
            setAlertMessage("Preencha origem, combustível e litros.");
            return;
        }
        if (destino === 'comboio' && !comboioVehicleId) {
            setAlertMessage("Selecione o comboio de destino.");
            return;
        }
        if (destino === 'transfusao' && !receivingVehicleId) {
            setAlertMessage("Selecione o equipamento receptor.");
            return;
        }

        const litersVal = parseFloat(liters);
        if (!(litersVal > 0)) {
            setAlertMessage("Informe uma litragem válida.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                destino,
                drainingVehicleId,
                liters: litersVal,
                date: new Date(formData.date + 'T12:00:00Z').toISOString(),
                fuelType,
                reason: formData.reason,
                createdBy: {
                    userId: user?.id || user?.uid,
                    userEmail: user?.email || 'sistema@frotasmak.com'
                }
            };
            if (destino === 'comboio') {
                payload.comboioVehicleId = comboioVehicleId;
            } else if (destino === 'transfusao') {
                payload.receivingVehicleId = receivingVehicleId;
                payload.obraId = selectedReceivingVehicle?.obraAtualId || selectedDrainingVehicle?.obraAtualId || null;
                if (receiverReading?.name === 'odometro') payload.odometro = parseFloat(formData.odometro) || null;
                if (receiverReading?.name === 'horimetro') payload.horimetro = parseFloat(formData.horimetro) || null;
            }
            await apiClient.createComboioDrenagem(payload);
            setAlertMessage("Drenagem registrada com sucesso.");
            reloadData();
            onClose();
        } catch (error) {
            setAlertMessage(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const destinos = [
        { key: 'comboio', label: 'Comboio', icon: Truck, desc: 'Devolve ao tanque do comboio' },
        { key: 'transfusao', label: 'Transfusão', icon: ArrowRightLeft, desc: 'Abastece outro equipamento' },
        { key: 'eliminado', label: 'Eliminado', icon: Trash2, desc: 'Combustível contaminado' },
    ];

    return (
        <div className="mak-modal-backdrop p-2 sm:p-4">
            <div className="mak-modal max-w-lg">
                <div className="mak-modal-header">
                    <h2 className="mak-modal-title">Registrar Drenagem</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
                    <p className="text-sm text-gray-500">Retira combustível de um veículo. O destino define para onde o combustível vai.</p>

                    {/* DESTINO */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Destino *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {destinos.map(({ key, label, icon: Icon, desc }) => (
                                <button
                                    type="button"
                                    key={key}
                                    onClick={() => setFormData(prev => ({ ...prev, destino: key }))}
                                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition ${
                                        formData.destino === key
                                            ? 'bg-orange-500 text-white border-orange-500'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'
                                    }`}
                                    title={desc}
                                >
                                    <Icon size={18} />
                                    <span className="font-semibold">{label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                            {destinos.find(d => d.key === formData.destino)?.desc}
                        </p>
                    </div>

                    {/* ORIGEM */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Drenar de (Origem) *</label>
                        <SearchableSelect
                            items={drainableVehicles}
                            value={formData.drainingVehicleId}
                            onChange={(item) => handleChange({ target: { name: 'drainingVehicleId', value: item?.id || '' } })}
                            getLabel={(v) => `${v.registroInterno} - ${v.modelo || ''}`.trim()}
                            getSubLabel={(v) => v.placa || ''}
                            placeholder="Selecione o veículo de origem..."
                            required
                        />
                    </div>

                    {/* DESTINO: COMBOIO */}
                    {formData.destino === 'comboio' && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Para Comboio (Destino) *</label>
                            <SearchableSelect
                                items={comboioVehicles}
                                value={formData.comboioVehicleId}
                                onChange={(item) => handleChange({ target: { name: 'comboioVehicleId', value: item?.id || '' } })}
                                getLabel={(v) => v.registroInterno || ''}
                                getSubLabel={(v) => v.placa || ''}
                                placeholder="Selecione o comboio destino..."
                                required
                            />
                        </div>
                    )}

                    {/* DESTINO: TRANSFUSÃO */}
                    {formData.destino === 'transfusao' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Transferir para (Receptor) *</label>
                                <SearchableSelect
                                    items={receivingVehicles}
                                    value={formData.receivingVehicleId}
                                    onChange={(item) => handleChange({ target: { name: 'receivingVehicleId', value: item?.id || '' } })}
                                    getLabel={(v) => `${v.registroInterno} - ${v.modelo || ''}`.trim()}
                                    getSubLabel={(v) => v.placa || ''}
                                    placeholder="Selecione o equipamento receptor..."
                                    required
                                />
                            </div>
                            {receiverReading && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">{receiverReading.label} do receptor *</label>
                                    <input
                                        name={receiverReading.name}
                                        type="number"
                                        step="0.1"
                                        value={formData[receiverReading.name]}
                                        onChange={handleChange}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Leitura atual: {getVehicleMainReading(selectedReceivingVehicle).value} {getVehicleMainReading(selectedReceivingVehicle).unit}
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Combustível *</label>
                            <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full p-2 border rounded" required>
                                <option value="">Auto</option>
                                <option value="dieselComum">Diesel Comum</option>
                                <option value="dieselS10">Diesel S10</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Litros *</label>
                            <input name="liters" type="number" step="0.1" value={formData.liters} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                    </div>

                    {/* DISPONÍVEL (informativo) */}
                    {formData.drainingVehicleId && formData.fuelType && (
                        <div className="text-xs bg-blue-50 border border-blue-100 text-blue-700 rounded p-2">
                            Disponível (2 últimas abastecidas): <strong>{Number(disponivel || 0).toFixed(2)} L</strong>
                            <span className="text-blue-400"> — referência, não bloqueia.</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1">Data *</label>
                        <input name="date" type="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Motivo {formData.destino === 'eliminado' && <span className="text-gray-400">(ex.: contaminação)</span>}
                        </label>
                        <textarea name="reason" value={formData.reason} onChange={handleChange} className="w-full p-2 border rounded" rows="2"></textarea>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-orange-500 text-white rounded font-bold flex items-center gap-2">
                            {isSaving && <Loader className="animate-spin" size={16} />} Registrar Drenagem
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ComboioDrenagemModal;
