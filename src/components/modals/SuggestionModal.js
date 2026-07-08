import React, { useState } from 'react';
import { X, Lightbulb, Image as ImageIcon, Loader, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';

/**
 * Modal de sugestões do usuário. Qualquer usuário pode enviar um texto e
 * anexar prints (até 5 imagens). As sugestões vão para Administração → Comunicação → Sugestões.
 */
const SuggestionModal = ({ onClose, setAlertMessage }) => {
    const [texto, setTexto] = useState('');
    const [files, setFiles] = useState([]);
    const [sending, setSending] = useState(false);

    const addFiles = (e) => {
        const novos = Array.from(e.target.files || []);
        setFiles(prev => [...prev, ...novos].slice(0, 5));
        e.target.value = '';
    };

    const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

    const enviar = async () => {
        if (!texto.trim()) {
            if (setAlertMessage) setAlertMessage('Descreva sua sugestão antes de enviar.');
            return;
        }
        setSending(true);
        try {
            const fd = new FormData();
            fd.append('texto', texto.trim());
            files.forEach(f => fd.append('anexos', f));
            await apiClient.createSuggestion(fd);
            if (setAlertMessage) setAlertMessage('Sugestão enviada. Obrigado pela colaboração!');
            onClose();
        } catch (e) {
            if (setAlertMessage) setAlertMessage('Falha ao enviar sugestão: ' + e.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <Lightbulb size={18} className="text-yellow-500" /> Enviar sugestão
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full"><X size={18} /></button>
                </div>

                <div className="p-4 space-y-3">
                    <p className="text-xs text-gray-500">Conte-nos como podemos melhorar o sistema. Você pode anexar prints para ilustrar.</p>
                    <textarea
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        rows={5}
                        placeholder="Descreva sua sugestão ou o problema encontrado..."
                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
                        autoFocus
                    />

                    {files.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {files.map((f, i) => (
                                <div key={i} className="relative w-16 h-16 rounded border overflow-hidden group">
                                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                                    <button onClick={() => removeFile(i)} className="absolute top-0 right-0 bg-red-600 text-white p-0.5 opacity-0 group-hover:opacity-100 transition">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {files.length < 5 && (
                        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
                            <ImageIcon size={16} /> Anexar print(s)
                            <input type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />
                        </label>
                    )}
                </div>

                <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                    <button onClick={onClose} className="px-3 py-2 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200">Cancelar</button>
                    <button onClick={enviar} disabled={sending} className="px-4 py-2 bg-yellow-500 text-white rounded font-bold text-sm hover:bg-yellow-600 flex items-center gap-2 disabled:opacity-50">
                        {sending ? <Loader className="animate-spin" size={14} /> : <Lightbulb size={14} />} Enviar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuggestionModal;
