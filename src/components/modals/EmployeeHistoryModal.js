import React, { useState, useEffect } from 'react';
import { X, Loader, HardHat, AlertCircle } from 'lucide-react';

const EmployeeHistoryModal = ({ employee, onClose, apiClient }) => {
    // Inicializa com estrutura completa
    const [history, setHistory] = useState({ rh: [], obras: [], veiculos: [], outros: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!employee) return;
            setLoading(true);
            setError(null);
            try {
                const res = await apiClient.get(`/employees/${employee.id}/history`);
                const data = res.data || res;
                setHistory({
                    rh: data.rh || [],
                    obras: data.obras || [],
                    veiculos: data.veiculos || [],
                    outros: data.outros || []
                });
            } catch (err) {
                console.error("Erro ao buscar histórico", err);
                setError("Não foi possível carregar o histórico completo.");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [employee, apiClient]);

    return (
        <div className="mak-modal-backdrop">
            <div className="mak-modal w-full max-w-$3 h-[600px] flex flex-col animate-fadeIn">
                <div className="mak-modal-header">
                    <div>
                        <h2 className="mak-modal-title">
                            <HardHat size={20} className="text-yellow-600"/> Histórico de Obras
                        </h2>
                        <p className="text-xs text-gray-500 font-medium">{employee?.nome}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
                </div>

                {/* SEM ABAS - APENAS LISTAGEM DIRETA */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-gray-400">
                            <Loader className="animate-spin mr-2"/> Carregando...
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2">
                            <AlertCircle size={24} />
                            <p>{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.obras && history.obras.length > 0 ? (
                                history.obras.map((h, i) => (
                                    <div key={i} className="bg-white border p-4 rounded-lg shadow-sm flex justify-between items-center hover:shadow-md transition">
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{h.obraNome}</p>
                                            <p className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">{h.role}</p>
                                            {h.vehicleInfo && <p className="text-xs text-blue-600 font-bold mt-1">{h.vehicleInfo}</p>}
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <span className="text-xs font-mono text-green-700 bg-green-50 px-2 py-0.5 rounded">IN: {new Date(h.startDate).toLocaleDateString()}</span>
                                            {h.endDate ? 
                                                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">OUT: {new Date(h.endDate).toLocaleDateString()}</span> 
                                                : <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Ativo</span>
                                            }
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-400 text-sm mt-10 flex flex-col items-center">
                                    <HardHat size={32} className="mb-2 opacity-20"/>
                                    Nenhum histórico de obras encontrado.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeHistoryModal;

