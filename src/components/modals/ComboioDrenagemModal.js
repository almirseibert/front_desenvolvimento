import React, { useState, useMemo, useEffect } from 'react';
import { Loader, X } from 'lucide-react';
import SearchableSelect from '../SearchableSelect';

const ComboioDrenagemModal = ({ 
    user, 
    vehicles = [], 
    onClose, 
    setAlertMessage, 
    apiClient, 
    reloadData 
}) => {
    const [formData, setFormData] = useState({
        drainingVehicleId: '',
        comboioVehicleId: '',
        liters: '',
        date: new Date().toISOString().split('T')[0],
        fuelType: '',
        reason: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    // Listas
    const comboioVehicles = useMemo(() => vehicles.filter(v => v.isComboioVehicle).sort((a,b) => a.registroInterno.localeCompare(b.registroInterno)), [vehicles]);
    const drainableVehicles = useMemo(() => vehicles.filter(v => !v.isComboioVehicle).sort((a,b) => a.registroInterno.localeCompare(b.registroInterno)), [vehicles]);
    const selectedDrainingVehicle = useMemo(() => drainableVehicles.find(v => v.id === formData.drainingVehicleId), [formData.drainingVehicleId, drainableVehicles]);

    useEffect(() => {
        if (selectedDrainingVehicle) {
            // Seleciona automaticamente o primeiro combustível disponível no veículo
            const fuel = Object.entries(selectedDrainingVehicle.fuelLevels || {}).find(([_, l]) => l > 0)?.[0] || '';
            setFormData(prev => ({ ...prev, fuelType: fuel }));
        }
    }, [selectedDrainingVehicle]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { drainingVehicleId, comboioVehicleId, liters, fuelType } = formData;
        
        if (!drainingVehicleId || !comboioVehicleId || !liters || !fuelType) {
            setAlertMessage("Preencha todos os campos obrigatórios.");
            return;
        }

        const litersVal = parseFloat(liters);
        const stock = selectedDrainingVehicle?.fuelLevels?.[fuelType] || 0;

        if (litersVal > stock) {
            setAlertMessage(`Impossível drenar. Veículo possui apenas ${stock.toFixed(2)} L.`);
            return;
        }

        setIsSaving(true);
        try {
            await apiClient.createComboioDrenagem({
                comboioVehicleId,
                drainingVehicleId,
                liters: litersVal,
                date: new Date(formData.date + 'T12:00:00Z').toISOString(),
                fuelType,
                reason: formData.reason
            });
            setAlertMessage("Drenagem registrada com sucesso.");
            reloadData();
            onClose();
        } catch (error) {
            setAlertMessage(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mak-modal-backdrop p-2 sm:p-4">
            <div className="mak-modal max-w-lg">
                <div className="mak-modal-header">
                    <h2 className="mak-modal-title">Registrar Drenagem</h2>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
                    <p className="text-sm text-gray-500">Operação inversa: Retira combustível de um veículo e devolve para o tanque do comboio.</p>
                    
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

                    <div>
                        <label className="block text-sm font-medium mb-1">Data *</label>
                        <input name="date" type="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Motivo</label>
                        <textarea name="reason" value={formData.reason} onChange={handleChange} className="w-full p-2 border rounded" rows="2"></textarea>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-orange-500 text-white rounded font-bold flex items-center gap-2">
                           {isSaving && <Loader className="animate-spin" size={16}/>} Registrar Drenagem
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ComboioDrenagemModal;

