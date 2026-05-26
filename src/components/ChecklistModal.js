import React, { useEffect, useState } from 'react';
import { X, FileText, Calendar, Download, Loader, AlertCircle } from 'lucide-react';

const ChecklistModal = ({ vehicle, onClose, apiClient }) => {
    const [checklists, setChecklists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Formata data para pt-BR
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch { return 'Data Inválida'; }
    };

    // Busca os checklists ao abrir
    useEffect(() => {
        const fetchChecklists = async () => {
            try {
                // Supondo que você criou este método no apiClient
                // Se não, pode ser: const data = await apiClient.get(`/vehicles/${vehicle.id}/checklists`);
                const data = await apiClient.getVehicleChecklists(vehicle.id);
                setChecklists(data || []);
            } catch (err) {
                console.error("Erro ao carregar checklists:", err);
                setError("Não foi possível carregar o histórico.");
            } finally {
                setLoading(false);
            }
        };

        if (vehicle) fetchChecklists();
    }, [vehicle, apiClient]);

    // Função para abrir o PDF
    const handleOpenPdf = (path) => {
        if (!path) return;
        // Ajuste a URL base conforme seu ambiente (dev/prod)
        const apiBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace('/api', '');
        window.open(`${apiBaseUrl}${path}`, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-100">
                
                {/* Header */}
                <div className="p-5 border-b bg-gray-50 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="text-purple-600" size={24}/> Checklists Realizados
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Veículo: <span className="font-semibold text-gray-700">{vehicle.registroInterno} - {vehicle.placa}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
                            <Loader className="animate-spin text-purple-500" size={32} />
                            <span className="text-sm">Buscando registros...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-40 text-red-500 gap-2">
                            <AlertCircle size={32} />
                            <span className="text-sm">{error}</span>
                        </div>
                    ) : checklists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                            <FileText size={48} className="mb-2 opacity-20" />
                            <p>Nenhum checklist encontrado para este veículo.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {checklists.map((item) => (
                                <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                                    
                                    {/* Info Esquerda */}
                                    <div className="flex items-start gap-3">
                                        <div className="bg-purple-100 p-2.5 rounded-lg text-purple-600 shrink-0">
                                            <Calendar size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">Realizado em: {formatDate(item.data_checklist)}</p>
                                            {item.observacoes && (
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2 max-w-md">
                                                    <span className="font-semibold">Obs:</span> {item.observacoes}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ação Direita */}
                                    <button 
                                        onClick={() => handleOpenPdf(item.pdf_path)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-all w-full sm:w-auto justify-center"
                                    >
                                        <Download size={16} /> Baixar PDF
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChecklistModal;