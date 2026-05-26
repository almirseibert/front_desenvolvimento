import React, { useState } from 'react';
import apiClient from '../services/apiClient';

const ChangePasswordModal = ({ isOpen, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As novas senhas não conferem.' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Mínimo de 6 caracteres.' });
            return;
        }

        setLoading(true);
        try {
            await apiClient.changePassword({ currentPassword, newPassword });
            setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
            setTimeout(() => {
                onClose();
                // Limpa campos
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setMessage(null);
            }, 1500);
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Erro ao alterar senha.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Alterar Senha</h2>
                
                {message && (
                    <div className={`p-2 mb-3 rounded text-sm text-center ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase">Senha Atual</label>
                        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full p-2 border rounded focus:border-yellow-500 outline-none" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase">Nova Senha</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 border rounded focus:border-yellow-500 outline-none" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase">Confirmar Nova Senha</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-2 border rounded focus:border-yellow-500 outline-none" required />
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-bold">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-yellow-400 text-gray-900 rounded hover:bg-yellow-500 text-sm font-bold disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;