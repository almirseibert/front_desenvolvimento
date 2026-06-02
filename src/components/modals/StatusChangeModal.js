import React, { useState } from 'react';
import { X, AlertTriangle, Calendar } from 'lucide-react';

const StatusChangeModal = ({ employee, onClose, onConfirm }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    const isDeactivating = !employee.status || employee.status.toLowerCase() === 'ativo';
    const actionText = isDeactivating ? 'Inativar/Desligar' : 'Reativar/Readmitir';
    const colorClass = isDeactivating ? 'red' : 'green';

    return (
        <div className="mak-modal-backdrop">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
                <div className={`p-4 bg-${colorClass}-50 border-b border-${colorClass}-100 flex items-center gap-3`}>
                    <div className={`p-2 bg-${colorClass}-100 rounded-full text-${colorClass}-600`}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className={`font-bold text-${colorClass}-900`}>{actionText}</h3>
                        <p className={`text-xs text-${colorClass}-700`}>{employee.nome}</p>
                    </div>
                </div>

                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">
                        {isDeactivating 
                            ? "Ao inativar este funcionário, o acesso dele ao sistema será revogado."
                            : "O funcionário será marcado como ativo novamente."
                        }
                    </p>

                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Data do Evento ({isDeactivating ? 'Desligamento' : 'Readmissão'})
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none"
                        />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 flex gap-3">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-2 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-lg transition"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={() => onConfirm(date)} 
                        className={`flex-1 py-2 text-white font-bold text-sm rounded-lg shadow transition bg-${colorClass}-600 hover:bg-${colorClass}-700`}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StatusChangeModal;
