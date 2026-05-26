import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';

const ManualFinishObraModal = ({ obra, onClose, apiClient, reloadData, setAlertMessage }) => {
    const [dataFim, setDataFim] = useState(obra?.dataFim ? new Date(obra.dataFim).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await apiClient.finishObra(obra.id, { dataFim });
            setAlertMessage('Obra finalizada com sucesso!');
            reloadData();
            onClose();
        } catch (error) {
             console.error("Erro ao finalizar obra:", error);
             setAlertMessage(error.message || 'Falha ao finalizar a obra. Verifique se ainda há veículos alocados.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold">Finalizar Obra</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200" disabled={isSubmitting}><X size={20}/></button>
                </div>
                <div className="p-6">
                    <p className="text-gray-600 mb-4 text-sm">Tem certeza de que deseja finalizar a obra "{obra.nome}"?</p>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Data de Finalização *</label>
                        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm" required/>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium" disabled={isSubmitting}>Cancelar</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-red-400 flex items-center justify-center gap-2 text-sm">
                        {isSubmitting ? <><Loader className="animate-spin" size={18}/> Finalizando...</> : 'Confirmar Finalização'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualFinishObraModal;