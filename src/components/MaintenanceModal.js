import React, { useState } from 'react';
import { Loader, X, Wrench } from 'lucide-react';

const MaintenanceModal = ({ user, vehicle, onClose, apiClient, setAlertMessage, reloadData }) => {
    const isCurrentlyInMaintenance = vehicle.status === 'Em Manutenção' || vehicle.status === 'Aguardando Manutenção';
    const [status, setStatus] = useState(isCurrentlyInMaintenance ? vehicle.status : 'Aguardando Manutenção');
    const [location, setLocation] = useState(vehicle.maintenanceLocation?.details || 'Pátio MAK Lajeado');
    const [isSaving, setIsSaving] = useState(false);
    const [endLocation, setEndLocation] = useState('Pátio MAK Lajeado');

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            await apiClient.startVehicleMaintenance(vehicle.id, { status, location });
            setAlertMessage(`Status de manutenção atualizado para "${status}".`);
            reloadData();
            onClose();
        } catch (error) {
            console.error("Erro ao iniciar manutenção:", error);
            setAlertMessage(error.response?.data?.message || "Falha ao atualizar o status de manutenção.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEndMaintenance = async () => {
        setIsSaving(true);
        try {
            await apiClient.endVehicleMaintenance(vehicle.id, { location: endLocation }); 
            setAlertMessage("Veículo liberado da manutenção.");
            reloadData();
            onClose();
        } catch (error) {
            console.error("Erro ao finalizar manutenção:", error);
            setAlertMessage(error.response?.data?.message || "Falha ao finalizar a manutenção.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-yellow-50">
                    <h2 className="text-xl font-bold text-yellow-800 flex items-center gap-2">
                        <Wrench size={24} /> Gerir Manutenção
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-yellow-100 transition-colors" disabled={isSaving}>
                        <X size={18} className="text-yellow-800"/>
                    </button>
                </div>
                
                <div className="p-6 space-y-5">
                     <div className="bg-gray-100 p-3 rounded text-sm text-gray-700">
                        <strong>Veículo:</strong> {vehicle.registroInterno} - {vehicle.placa} <br/>
                        <span className="text-xs text-gray-500">{vehicle.marca} {vehicle.modelo}</span>
                     </div>

                    {!isCurrentlyInMaintenance ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Definir Status *</label>
                                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-yellow-500" required>
                                    <option value="Aguardando Manutenção">Aguardando Manutenção</option>
                                    <option value="Em Manutenção">Em Manutenção</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Localização da Oficina/Pátio *</label>
                                <input 
                                    type="text" 
                                    value={location} 
                                    onChange={e => setLocation(e.target.value)} 
                                    placeholder="Ex: Oficina Mecânica Central" 
                                    className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-yellow-500" 
                                    required 
                                />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900">
                                <p className="mb-1">O veículo está atualmente: <strong>{vehicle.status}</strong></p>
                                <p>Localização Atual: <strong>{vehicle.maintenanceLocation?.details || 'Não informado'}</strong></p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Local de Disponibilidade após Liberar *</label>
                                <input 
                                    type="text" 
                                    value={endLocation} 
                                    onChange={e => setEndLocation(e.target.value)} 
                                    placeholder="Ex: Pátio MAK Lajeado" 
                                    className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500" 
                                    required 
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700" disabled={isSaving}>Cancelar</button>
                    {isCurrentlyInMaintenance ? (
                        <button 
                            onClick={handleEndMaintenance} 
                            disabled={isSaving || !endLocation} 
                            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center justify-center gap-2 text-sm shadow-sm"
                        >
                            {isSaving ? <><Loader className="animate-spin" size={18}/> Finalizando...</> : "Finalizar Manutenção"}
                        </button>
                    ) : (
                        <button 
                            onClick={handleSubmit} 
                            disabled={isSaving || !status || !location} 
                            className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 disabled:bg-yellow-300 flex items-center justify-center gap-2 text-sm shadow-sm"
                        >
                            {isSaving ? <><Loader className="animate-spin" size={18}/> Confirmar...</> : "Iniciar Manutenção"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MaintenanceModal;