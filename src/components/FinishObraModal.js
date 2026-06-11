import React, { useState } from 'react';
import { formatObraNome } from '../utils/obraFormat';

// --- Modal para perguntar se deseja finalizar a obra ---
// Extraído de VehiclePage.js (usado por ObraAllocationModal)
const FinishObraModal = ({ obra, onClose, onConfirm }) => {
    const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4"> {/* Aumenta z-index */}
            <div className="mak-modal max-w-md">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold">Finalizar Obra?</h2>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-gray-700 text-sm">Este é o último veículo ativo na obra "{formatObraNome(obra)}". Deseja marcar a obra como finalizada ao desalocar este veículo?</p>
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Data de Finalização da Obra</label>
                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm" />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-4">
                    {/* Botão "Não" agora apenas fecha o modal, permitindo que handleDeallocate(false) seja chamado */}
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium">Não, Manter Obra Ativa</button>
                    {/* Botão "Sim" chama onConfirm passando a data */}
                    <button onClick={() => onConfirm(dataFim)} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm">Sim, Finalizar Obra</button>
                </div>
            </div>
        </div>
    );
};

export default FinishObraModal;
