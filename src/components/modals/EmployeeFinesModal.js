import React from 'react';
import { X, ShieldAlert } from 'lucide-react';

const EmployeeFinesModal = ({ employee, fines = [], onClose }) => {
    // Filtragem segura
    const employeeFines = fines.filter(f => 
        (f.employeeId && String(f.employeeId) === String(employee?.id)) ||
        (f.motoristaId && String(f.motoristaId) === String(employee?.id)) // Suporte a legado
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-red-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-red-800 flex items-center gap-2">
                        <ShieldAlert size={20}/> Multas Associadas
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-red-100 rounded-full text-red-800"><X size={20}/></button>
                </div>
                
                <div className="p-4 bg-gray-50 border-b">
                    <p className="text-sm text-gray-700 font-bold">{employee?.nome}</p>
                    <p className="text-xs text-gray-500">Total de Multas: {employeeFines.length}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                    {employeeFines.length === 0 ? (
                        <p className="text-center text-gray-400 py-8 italic">Nenhuma multa registrada para este funcionário.</p>
                    ) : (
                        employeeFines.map(fine => (
                            <div key={fine.id} className="border border-red-100 rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase tracking-wider">
                                        {fine.codigoInfracao || 'N/A'}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono">
                                        {fine.dataInfração ? new Date(fine.dataInfração).toLocaleDateString() : 'Sem data'}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-gray-800 mb-1">{fine.descricao || 'Sem descrição'}</p>
                                <p className="text-xs text-gray-500 mb-2">{fine.localInfracao || 'Local não informado'}</p>
                                
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                                    <span className="text-sm font-bold text-gray-700">R$ {parseFloat(fine.valor || 0).toFixed(2)}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                        fine.paymentStatus === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {fine.paymentStatus || 'Pendente'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeFinesModal;