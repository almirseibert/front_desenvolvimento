import React, { useMemo } from 'react';
import { X, AlertCircle, CheckCircle, Clock, FileText, User } from 'lucide-react';

// --- Modal de Multas do Veículo (Atualizado) ---
const VehicleFinesModal = ({ vehicle, fines = [], onClose }) => {
    
    // Filtra e ordena as multas (Memorizado para performance)
    const vehicleFines = useMemo(() => {
        return (fines || [])
            .filter(fine => fine.vehicleId === vehicle.id)
            .sort((a, b) => new Date(b.dataInfracao) - new Date(a.dataInfracao));
    }, [fines, vehicle]);

    // Helper para definir estilo e ícone do status
    const getStatusBadgeInfo = (status) => {
        // Normaliza para minúsculo para comparação segura
        const normalizedStatus = String(status || '').toLowerCase();

        if (normalizedStatus.includes('paga') || normalizedStatus.includes('pago')) {
            return { style: 'bg-green-100 text-green-800 border border-green-200', icon: <CheckCircle size={12} className="mr-1" /> };
        }
        if (normalizedStatus.includes('pendente')) {
            return { style: 'bg-yellow-100 text-yellow-800 border border-yellow-200', icon: <AlertCircle size={12} className="mr-1" /> };
        }
        if (normalizedStatus.includes('recurso')) {
            return { style: 'bg-blue-100 text-blue-800 border border-blue-200', icon: <Clock size={12} className="mr-1" /> };
        }
        if (normalizedStatus.includes('cancelad')) {
            return { style: 'bg-gray-100 text-gray-600 border border-gray-200', icon: <X size={12} className="mr-1" /> };
        }
        // Padrão
        return { style: 'bg-gray-100 text-gray-800', icon: null };
    };

    if (!vehicle) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
            <div className="mak-modal max-w-2xl">
                
                {/* Cabeçalho */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="mak-modal-title">
                            <FileText size={20} className="text-blue-600"/> 
                            Histórico de Multas
                        </h2>
                        <p className="text-gray-500 text-sm mt-0.5 font-mono">
                            {vehicle.placa} • {vehicle.marca} {vehicle.modelo}
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors focus:outline-none"
                        aria-label="Fechar"
                    >
                        <X size={20}/>
                    </button>
                </div>

                {/* Conteúdo Rolável */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50">
                    {vehicleFines.length > 0 ? (
                        <ul className="space-y-4">
                            {vehicleFines.map(fine => {
                                // CORREÇÃO CRÍTICA: Garante que é número antes de usar .toFixed
                                const valorNumerico = parseFloat(fine.valor || 0);
                                const badgeInfo = getStatusBadgeInfo(fine.paymentStatus || fine.status);

                                return (
                                    <li key={fine.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                            
                                            {/* Lado Esquerdo: Detalhes */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${badgeInfo.style}`}>
                                                        {badgeInfo.icon}
                                                        {fine.paymentStatus || fine.status || 'Indefinido'}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-medium">
                                                        {fine.dataInfracao ? new Date(fine.dataInfracao).toLocaleDateString('pt-BR') : 'Data N/A'}
                                                    </span>
                                                </div>
                                                
                                                <h3 className="font-bold text-gray-800 text-base mb-2">
                                                    {fine.descricao || 'Infração não especificada'}
                                                </h3>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <User size={14} className="text-gray-400"/>
                                                        <span className="truncate" title={fine.motoristaNome || fine.employeeInfo?.nome}>
                                                            {fine.motoristaNome || fine.employeeInfo?.nome || 'Condutor não informado'}
                                                        </span>
                                                    </div>
                                                    {fine.pontos > 0 && (
                                                        <div className="text-orange-600 font-medium flex items-center gap-1">
                                                            Pontos: {fine.pontos}
                                                        </div>
                                                    )}
                                                </div>

                                                {fine.observacoes && (
                                                    <div className="mt-3 pt-2 border-t border-dashed border-gray-100 text-xs text-gray-500">
                                                        <span className="font-semibold">Obs:</span> {fine.observacoes}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Lado Direito: Valor */}
                                            <div className="text-right min-w-[100px]">
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-0.5">Valor</p>
                                                <p className="mak-modal-title">
                                                    R$ {valorNumerico.toFixed(2).replace('.', ',')}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                            <div className="bg-green-50 p-4 rounded-full mb-4">
                                <CheckCircle size={40} className="text-green-500" />
                            </div>
                            <h3 className="mak-modal-title">Tudo certo!</h3>
                            <p className="text-gray-500">Nenhuma multa registrada para este veículo.</p>
                        </div>
                    )}
                </div>

                {/* Rodapé Fixo */}
                <div className="p-4 bg-white border-t border-gray-100 flex justify-end rounded-b-xl">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition-colors text-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VehicleFinesModal;
