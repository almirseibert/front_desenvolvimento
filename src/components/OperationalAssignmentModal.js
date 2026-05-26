import React, { useState, useMemo } from 'react';
import { Loader, X, AlertTriangle, Shield, HardHat } from 'lucide-react';
import { checkVehicleRestrictions } from '../utils/vehicleRules';

const OperationalAssignmentModal = ({ user, vehicle, employees = [], revisions = [], onClose, setAlertMessage, apiClient, reloadData, operationalSubGroups = [], PasswordConfirmationModal }) => {
    
    // Tenta obter dados da alocação atual
    let currentAssignment = null;
    if (vehicle.operationalAssignment) {
        if (typeof vehicle.operationalAssignment === 'string') {
            try { currentAssignment = JSON.parse(vehicle.operationalAssignment); } catch { /* ignora erro */ }
        } else {
            currentAssignment = vehicle.operationalAssignment;
        }
    }

    const [subGroup, setSubGroup] = useState(currentAssignment?.subGroup || '');
    const [employeeId, setEmployeeId] = useState(currentAssignment?.employeeId || '');
    const [observacoes, setObservacoes] = useState(currentAssignment?.observacoes || ''); 
    const [isSaving, setIsSaving] = useState(false);
    const [locationAfterUnassign, setLocationAfterUnassign] = useState('Pátio MAK Lajeado');

    // Estados de Segurança
    const [restrictionAlert, setRestrictionAlert] = useState(null);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    // Filtra funcionários disponíveis
    const availableEmployees = useMemo(() =>
        (employees || [])
            .filter(e => e.status !== 'inativo') 
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
    [employees]);

    // --- VERIFICAÇÃO DE RESTRIÇÕES ---
    const validateRestrictions = () => {
        setRestrictionAlert(null);
        // Regra Centralizada: checkVehicleRestrictions verifica documentos, CNH e manutenções vencidas
        const issues = checkVehicleRestrictions(vehicle, revisions);
        
        const blockingIssues = issues.filter(i => i.type === 'bloqueio' || i.type === 'vencido');
        const warningIssues = issues.filter(i => i.type === 'aviso');

        if (blockingIssues.length > 0 || warningIssues.length > 0) {
            setRestrictionAlert(issues.map(i => i.message));
            return false;
        }
        return true;
    };

    const handleAssignClick = () => {
        if (!subGroup || !employeeId) {
            setAlertMessage("Selecione o subgrupo e o funcionário.");
            return;
        }
        
        // Se houver restrições (documento vencido, manutenção), pede senha
        if (!validateRestrictions()) {
            return;
        }

        executeAssign();
    };

    const executeAssign = async () => {
        setIsSaving(true);
        try {
            await apiClient.assignVehicleToOperational(vehicle.id, { subGroup, employeeId, observacoes });
            setAlertMessage("Veículo alocado para operação com sucesso!");
            reloadData();
            onClose();
        } catch (error) {
            console.error("Erro ao alocar veículo para operação:", error);
            setAlertMessage(error.response?.data?.message || "Falha ao alocar o veículo.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnassign = async () => {
        if (!locationAfterUnassign) {
            setAlertMessage("Informe o local de disponibilidade.");
            return;
        }
        setIsSaving(true);
        try {
            await apiClient.unassignVehicleFromOperational(vehicle.id, { location: locationAfterUnassign });
            setAlertMessage("Alocação operacional finalizada.");
            reloadData();
            onClose();
        } catch (error) {
            console.error("Erro ao finalizar alocação:", error);
            setAlertMessage(error.response?.data?.message || "Falha ao finalizar a alocação.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
                    
                    {/* Cabeçalho */}
                    <div className="p-6 border-b flex justify-between items-center bg-blue-50 flex-none rounded-t-lg">
                        <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                            <HardHat size={24} /> Alocação Operacional
                        </h2>
                         <button onClick={onClose} className="p-2 rounded-full hover:bg-blue-100 transition-colors" disabled={isSaving}><X size={18}/></button>
                    </div>

                    {/* Conteúdo com Rolagem */}
                    <div className="flex-1 overflow-y-auto">
                        
                        {/* Alertas de Restrição */}
                        {restrictionAlert && restrictionAlert.length > 0 && !currentAssignment && (
                            <div className="bg-red-50 p-4 border-b border-red-100 animate-pulse-once">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="text-red-600 shrink-0 mt-1" size={24} />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-red-800 text-sm uppercase tracking-wide mb-1">Restrições Detectadas</h3>
                                        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                            {restrictionAlert.map((msg, idx) => <li key={idx}>{msg}</li>)}
                                        </ul>
                                        <div className="mt-3 bg-white bg-opacity-50 p-2 rounded text-xs text-red-800 font-semibold border border-red-100">
                                            Autorização de supervisor necessária.
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setShowPasswordConfirm(true)}
                                            className="mt-3 w-full py-2 bg-red-600 text-white rounded font-bold text-sm hover:bg-red-700 shadow-sm flex items-center justify-center gap-2 transition-all"
                                        >
                                            <Shield size={16} /> AUTORIZAR COM SENHA
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Formulário */}
                        <div className="p-6 space-y-4">
                            <div className="text-sm text-gray-600 mb-2 bg-gray-100 p-3 rounded border border-gray-200">
                                <strong>Veículo:</strong> {vehicle.registroInterno} - {vehicle.marca} {vehicle.modelo}
                            </div>

                            {currentAssignment ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded border border-blue-100 text-blue-800 text-sm shadow-sm">
                                        <p className="mb-1">Alocado no grupo: <strong>{currentAssignment.subGroup || 'N/A'}</strong></p>
                                        <p>Responsável: <strong>{currentAssignment.employeeName || 'N/A'}</strong></p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Local de Disponibilidade após Desalocar *</label>
                                        <input
                                             type="text"
                                             value={locationAfterUnassign}
                                             onChange={e => setLocationAfterUnassign(e.target.value)}
                                             placeholder="Ex: Pátio MAK Lajeado"
                                             className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm"
                                             required
                                         />
                                    </div>
                                    <button onClick={handleUnassign} disabled={isSaving || !locationAfterUnassign} className="w-full px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-red-300 flex items-center justify-center gap-2 text-sm shadow">
                                        {isSaving ? <Loader className="animate-spin" size={18}/> : "Finalizar Operação"}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Alocar no Grupo *</label>
                                        <select value={subGroup} onChange={e => setSubGroup(e.target.value)} className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 text-sm" required>
                                            <option value="">Selecione...</option>
                                            {(operationalSubGroups || []).map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Alocar para Funcionário *</label>
                                        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 text-sm" required>
                                            <option value="">Selecione...</option>
                                            {availableEmployees.map(e => <option key={e.id} value={e.id}>{e.nome} ({e.funcao})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                                        <textarea
                                            value={observacoes}
                                            onChange={e => setObservacoes(e.target.value)}
                                            rows="3"
                                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm"
                                            placeholder="Detalhes adicionais..."
                                        />
                                    </div>
                                    <button 
                                        onClick={handleAssignClick} 
                                        disabled={isSaving || !subGroup || !employeeId || restrictionAlert !== null} 
                                        className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-colors shadow"
                                    >
                                        {isSaving ? <Loader className="animate-spin" size={18}/> : "Alocar Veículo"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showPasswordConfirm && PasswordConfirmationModal && (
                <PasswordConfirmationModal
                    message="ATENÇÃO: Existem impedimentos (Bloqueio ou Vencimentos). Confirme com sua senha para forçar a alocação."
                    onConfirm={async () => {
                        await executeAssign();
                        setShowPasswordConfirm(false);
                    }}
                    onClose={() => setShowPasswordConfirm(false)}
                />
            )}
        </>
    );
};

export default OperationalAssignmentModal;