import React, { useState } from 'react';
import { Loader, X } from 'lucide-react';

const ComboioTransactionModal = ({ 
    user, 
    transaction, 
    onClose, 
    setAlertMessage, 
    apiClient, 
    PasswordConfirmationModal, 
    reloadData 
}) => {
    // Este modal é simplificado apenas para edição de litragem ou data, 
    // pois a lógica de edição completa de veículos/obras é muito complexa para reversão
    // Idealmente, deve-se excluir e refazer, mas aqui permitimos edições simples.
    
    const [formData, setFormData] = useState({
        liters: transaction.liters,
        date: new Date(transaction.date).toISOString().slice(0, 16), // datetime-local
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            await apiClient.updateComboioTransaction(transaction.id, {
                ...formData,
                date: new Date(formData.date).toISOString()
            });
            setAlertMessage("Transação atualizada.");
            reloadData();
            onClose();
        } catch (error) {
            setAlertMessage(error.message);
        } finally {
            setIsSaving(false);
            setShowPassword(false);
        }
    };

    return (
        <div className="mak-modal-backdrop ">
            <div className="mak-modal max-w-md">
                <div className="mak-modal-header">
                    <h2 className="text-lg font-bold">Editar Transação</h2>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200 rounded">
                        <strong>Atenção:</strong> Edições afetam o estoque de combustível e despesas. Para alterações de veículo, exclua e recrie.
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Litros</label>
                        <input type="number" step="0.01" value={formData.liters} onChange={e => setFormData({...formData, liters: e.target.value})} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Data</label>
                        <input type="datetime-local" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 border rounded" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                         <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                         <button onClick={() => setShowPassword(true)} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Salvar</button>
                    </div>
                </div>
                {showPassword && (
                    <PasswordConfirmationModal
                        message="Confirme sua senha para editar esta transação contábil."
                        onConfirm={handleSubmit}
                        onClose={() => setShowPassword(false)}
                        apiClient={apiClient}
                    />
                )}
            </div>
        </div>
    );
};

export default ComboioTransactionModal;


