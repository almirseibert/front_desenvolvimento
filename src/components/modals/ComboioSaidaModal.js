import React, { useState, useMemo, useEffect } from 'react';
import { Loader, X, Lock, TrendingUp, AlertTriangle } from 'lucide-react';
import { getAllowedReadingTypes } from '../../utils/vehicleRules';

const ComboioSaidaModal = ({ 
    user, 
    comboioVehicle, 
    transactionData = null, 
    vehicles = [], 
    obras = [], 
    employees = [], 
    expenses = [], 
    onClose, 
    setAlertMessage, 
    apiClient, 
    extraObraOptions = [], 
    vehicleGroups = {}, 
    reloadData,
    PasswordConfirmationModal 
}) => {
    const isEditing = !!transactionData;

    const [formData, setFormData] = useState({
        receivingVehicleId: '',
        obraId: '',
        liters: '',
        date: new Date().toISOString().split('T')[0],
        fuelType: '',
        employeeId: '',
        odometro: '',
        horimetro: '',
    });
    
    const [isSaving, setIsSaving] = useState(false);
    const [vehicleIssues, setVehicleIssues] = useState([]);
    const [blockReason, setBlockReason] = useState(null); 
    const [pendingSubmission, setPendingSubmission] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [obraStatus, setObraStatus] = useState(null);

    const availableMachines = useMemo(() => vehicles.filter(v => !v.isComboioVehicle && v.id !== comboioVehicle?.id).sort((a,b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')), [vehicles, comboioVehicle]);
    const sortedObras = useMemo(() => obras.filter(o => o.status === 'ativa').sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [obras]);
    const sortedEmployees = useMemo(() => employees.sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [employees]);
    const selectedVehicle = useMemo(() => vehicles.find(v => v.id === formData.receivingVehicleId), [formData.receivingVehicleId, vehicles]);

    useEffect(() => {
        if (isEditing && transactionData) {
            setFormData({
                receivingVehicleId: transactionData.receivingVehicleId || '',
                obraId: transactionData.obraId || '',
                liters: transactionData.liters || '',
                date: transactionData.date ? new Date(transactionData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                fuelType: transactionData.fuelType || '',
                employeeId: transactionData.employeeId || '',
                odometro: transactionData.odometro || '',
                horimetro: transactionData.horimetro || '',
            });
        }
    }, [isEditing, transactionData]);

    useEffect(() => {
        if (!isEditing && selectedVehicle) {
            let autoObra = selectedVehicle.obraAtualId || '';
            let autoEmployee = '';
            
            if (selectedVehicle.operationalAssignment && selectedVehicle.operationalAssignment.employeeId) {
                 autoEmployee = selectedVehicle.operationalAssignment.employeeId;
            }

            setFormData(prev => ({
                ...prev,
                odometro: selectedVehicle.odometro || '',
                horimetro: selectedVehicle.horimetro || '',
                obraId: prev.obraId || autoObra,
                employeeId: prev.employeeId || autoEmployee
            }));

            const issues = [];
            if(selectedVehicle.naoPodeCircular) issues.push({ type: 'bloqueio', message: "Veículo marcado como NÃO PODE CIRCULAR" });
            setVehicleIssues(issues);
            setBlockReason(null);
        } else if (!selectedVehicle && !isEditing) {
            setVehicleIssues([]);
            setBlockReason(null);
        }
    }, [selectedVehicle, isEditing]);

    useEffect(() => {
        if (formData.obraId) {
            const obra = obras.find(o => o.id === formData.obraId);
            if (obra) {
                const totalGasto = expenses
                    .filter(e => e.obraId === formData.obraId && e.category === 'Combustível')
                    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
                
                const valorContrato = parseFloat(obra.valorTotalContrato || 0);
                const percentual = valorContrato > 0 ? (totalGasto / valorContrato) * 100 : 0;

                setObraStatus({ totalGasto, valorContrato, percentual });
            } else {
                setObraStatus(null);
            }
        } else {
            setObraStatus(null);
        }
    }, [formData.obraId, obras, expenses]);

    const checkBudgetLimit = (obraId, costToAdd) => {
        const obra = obras.find(o => o.id === obraId);
        if (!obra || !obra.valorTotalContrato || parseFloat(obra.valorTotalContrato) <= 0) return null;

        const limit = parseFloat(obra.valorTotalContrato) * 0.20; 
        const currentExpenses = expenses
            .filter(e => e.obraId === obraId && e.category === 'Combustível')
            .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        const newTotal = currentExpenses + costToAdd;

        if (newTotal >= limit) {
            return {
                message: `ORÇAMENTO EXCEDIDO: O custo ultrapassa 20% do contrato.`
            };
        }
        return null;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setBlockReason(null); 
    };

    // --- VALIDAÇÃO RIGOROSA EM TEMPO REAL ---
    useEffect(() => {
        if (!selectedVehicle || isEditing) return;
        
        let reason = null;
        
        const allowedTypes = getAllowedReadingTypes(selectedVehicle.tipo);
        const isKmVehicle = allowedTypes.includes('odometro');
        const isHourVehicle = allowedTypes.includes('horimetro'); 

        // 1. Validação KM
        if (isKmVehicle && formData.odometro) {
            const current = parseFloat(formData.odometro);
            const last = parseFloat(selectedVehicle.odometro || 0);
            
            if (!isNaN(current) && last > 0) {
                if (current <= last) reason = `Odômetro (${current}) menor/igual ao atual (${last}).`;
                else if (current - last > 1000) reason = `Salto excessivo de Km (> 1000).`;
            }
        }

        // 2. Validação HORAS (Unificado)
        if (isHourVehicle && formData.horimetro) {
            const current = parseFloat(formData.horimetro);
            // Busca o último valor unificado, ou fallback para legados se ainda existirem
            let last = parseFloat(selectedVehicle.horimetro || 0);

            if (!isNaN(current) && last > 0) {
                if (current <= last) reason = `Horímetro (${current}) menor/igual ao atual (${last}).`;
                else if (current - last > 50) reason = `Salto excessivo de Horas (> 50h).`;
            }
        }

        setBlockReason(reason);

    }, [formData.odometro, formData.horimetro, selectedVehicle, isEditing]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.receivingVehicleId || !formData.obraId || !formData.liters || !formData.fuelType || !formData.employeeId) {
            setAlertMessage("Preencha todos os campos obrigatórios.");
            return;
        }

        const liters = parseFloat(formData.liters);
        if (!isEditing) {
            const comboioStock = comboioVehicle?.fuelLevels?.[formData.fuelType] || 0;
            if (liters > comboioStock) {
                setAlertMessage(`Saldo insuficiente no comboio. Disponível: ${comboioStock.toFixed(2)} L.`);
                return;
            }
        }

        // 1. Bloqueio de Leitura (Senha necessária)
        if (blockReason && !isEditing) {
            setPendingSubmission(formData);
            setShowPasswordModal(true);
            return;
        }

        // 2. Bloqueio de Orçamento
        if (!isEditing) { 
            const estimatedCost = liters * 6.50; 
            const budgetCheck = checkBudgetLimit(formData.obraId, estimatedCost);
            
            if (budgetCheck) {
                setBlockReason(budgetCheck.message); 
                setPendingSubmission(formData);
                setShowPasswordModal(true);
                return;
            }
        }

        await processTransaction(formData);
    };

    const processTransaction = async (data) => {
        setIsSaving(true);
        try {
            const payload = {
                id: isEditing ? transactionData.id : undefined,
                comboioVehicleId: comboioVehicle.id,
                receivingVehicleId: data.receivingVehicleId,
                odometro: parseFloat(data.odometro) || null,
                horimetro: parseFloat(data.horimetro) || null,
                liters: parseFloat(data.liters),
                date: new Date(data.date + 'T12:00:00Z').toISOString(),
                fuelType: data.fuelType,
                obraId: data.obraId,
                employeeId: data.employeeId,
                createdBy: {
                    userId: user.id || user.uid,
                    userEmail: user.email || 'sistema@frotasmak.com'
                }
            };

            if (isEditing) {
                await apiClient.updateComboioTransaction(transactionData.id, payload);
                setAlertMessage("Abastecimento atualizado com sucesso!");
            } else {
                await apiClient.createComboioSaida(payload);
                setAlertMessage("Abastecimento registrado com sucesso!");
            }
            
            reloadData();
            onClose();

        } catch (error) {
            console.error(error);
            setAlertMessage(error.message || "Erro ao processar transação.");
        } finally {
            setIsSaving(false);
            setShowPasswordModal(false);
            setPendingSubmission(null);
        }
    };

    const handlePasswordOverride = () => {
        if (pendingSubmission) {
            processTransaction(pendingSubmission);
        }
    };

    // Renderiza Input Único Baseado no Tipo
    const renderReadingInputs = () => {
        if (!selectedVehicle) return null;
        const allowed = getAllowedReadingTypes(selectedVehicle.tipo);

        if (allowed.includes('odometro')) {
            return (
                <div>
                    <label className="block font-medium mb-1">Odômetro Final (Km) *</label>
                    <input name="odometro" type="number" step="0.1" value={formData.odometro} onChange={handleChange} className="w-full p-2 border rounded" required placeholder={`Atual: ${selectedVehicle.odometro}`} />
                </div>
            );
        } else {
            return (
                <div>
                    <label className="block font-medium mb-1">Horímetro Final (Hr) *</label>
                    <input name="horimetro" type="number" step="0.1" value={formData.horimetro} onChange={handleChange} className="w-full p-2 border rounded" required placeholder={`Atual: ${selectedVehicle.horimetro || 0}`} />
                    <p className="text-[10px] text-gray-400 mt-0.5">Unificado (Substitui Digital/Analógico)</p>
                </div>
            );
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[95vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Editar Distribuição' : 'Distribuição (Saída)'}</h2>
                    <button onClick={onClose} disabled={isSaving}><X size={20}/></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 text-sm">
                    {/* Avisos de Bloqueio */}
                    {blockReason && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded flex items-center gap-2 animate-pulse">
                            <Lock size={20} />
                            <span className="font-bold">{blockReason}</span>
                        </div>
                    )}
                    
                    {obraStatus && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                            <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-1">
                                <TrendingUp size={14}/> Progresso Financeiro
                            </h4>
                            <div className="flex justify-between text-blue-700">
                                <span>Gasto: {obraStatus.totalGasto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                                <span>Total: {obraStatus.valorContrato.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                            </div>
                            <div className="mt-1 w-full bg-blue-200 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${obraStatus.percentual > 80 ? 'bg-red-500' : 'bg-blue-600'}`} style={{width: `${Math.min(obraStatus.percentual, 100)}%`}}></div>
                            </div>
                            <div className="text-right mt-0.5 text-blue-600 font-bold">{obraStatus.percentual.toFixed(1)}%</div>
                        </div>
                    )}

                    {vehicleIssues.length > 0 && !isEditing && (
                        <div className="mb-4 space-y-2">
                            {vehicleIssues.map((issue, idx) => (
                                <div key={idx} className={`p-2 border rounded text-xs flex items-center gap-2 ${issue.type === 'bloqueio' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                    <AlertTriangle size={14} />
                                    {issue.message}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block font-medium mb-1">Veículo a Abastecer *</label>
                            <select name="receivingVehicleId" value={formData.receivingVehicleId} onChange={handleChange} className="w-full p-2 border rounded" required disabled={isEditing}>
                                <option value="">Selecione...</option>
                                {availableMachines.map(v => <option key={v.id} value={v.id}>{v.registroInterno} - {v.modelo}</option>)}
                            </select>
                        </div>

                        {renderReadingInputs()}

                        <div className="md:col-span-2">
                            <label className="block font-medium mb-1">Funcionário *</label>
                            <select name="employeeId" value={formData.employeeId} onChange={handleChange} className="w-full p-2 border rounded" required>
                                <option value="">Selecione...</option>
                                {sortedEmployees.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </select>
                        </div>

                        {/* OBRA MANTIDA AQUI (Obrigatório) */}
                        <div className="md:col-span-2">
                            <label className="block font-medium mb-1">Obra (Centro de Custo) *</label>
                            <select name="obraId" value={formData.obraId} onChange={handleChange} className="w-full p-2 border rounded" required>
                                <option value="">Selecione...</option>
                                {sortedObras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                {extraObraOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block font-medium mb-1">Combustível *</label>
                            <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full p-2 border rounded" required disabled={isEditing}>
                                <option value="">Selecione</option>
                                {Object.entries(comboioVehicle?.fuelLevels || {})
                                    .filter(([_, level]) => level > 0 || isEditing) 
                                    .map(([type, level]) => (
                                        <option key={type} value={type}>{type === 'dieselS10' ? 'Diesel S10' : 'Diesel Comum'} ({level.toFixed(1)} L)</option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <label className="block font-medium mb-1">Litros *</label>
                            <input name="liters" type="number" step="0.01" value={formData.liters} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block font-medium mb-1">Data *</label>
                            <input name="date" type="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                    </div>
                </form>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-lg">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
                    
                    {blockReason ? (
                        <button onClick={handleSubmit} type="button" className="px-4 py-2 bg-red-500 text-white font-bold rounded hover:bg-red-600 shadow-md flex items-center gap-1">
                            <Lock size={14}/> Liberar
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={isSaving || !selectedVehicle} className="px-4 py-2 bg-yellow-400 font-bold rounded hover:bg-yellow-500 flex items-center gap-2">
                            {isSaving && <Loader className="animate-spin" size={16}/>} {isEditing ? 'Salvar' : 'Registrar'}
                        </button>
                    )}
                </div>

                {showPasswordModal && (
                    <PasswordConfirmationModal
                        message={`BLOQUEIO DE SEGURANÇA:\n${blockReason || "Orçamento excedido."}\nInsira senha para autorizar.`}
                        onConfirm={handlePasswordOverride}
                        onClose={() => { setShowPasswordModal(false); setPendingSubmission(null); }}
                        apiClient={apiClient}
                    />
                )}
            </div>
        </div>
    );
};

export default ComboioSaidaModal;