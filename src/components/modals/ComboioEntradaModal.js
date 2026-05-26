import React, { useState, useEffect, useMemo } from 'react';
import { Loader, X, AlertTriangle, FileText } from 'lucide-react';

const ComboioEntradaModal = ({ 
    user, 
    comboioVehicle, 
    transactionData = null, 
    partners = [], 
    employees = [], 
    onClose, 
    setAlertMessage, 
    apiClient, 
    generateAuthorizationPDF, 
    obras = [], 
    extraObraOptions = [], 
    reloadData,
    comboioTransactions = [] 
}) => {
    const isEditing = !!transactionData;

    const [formData, setFormData] = useState({
        partnerId: '',
        liters: '',
        date: new Date().toISOString().split('T')[0],
        fuelType: '',
        employeeId: '',
        invoiceNumber: '', 
        pricePerLiter: ''  
    });
    
    const [initialPartnerPrice, setInitialPartnerPrice] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [showPriceUpdateDialog, setShowPriceUpdateDialog] = useState(false);

    // Carrega dados se for edição
    useEffect(() => {
        if (isEditing && transactionData) {
            setFormData({
                partnerId: transactionData.partnerId || '',
                liters: transactionData.liters || '',
                date: transactionData.date ? new Date(transactionData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                fuelType: transactionData.fuelType || '',
                employeeId: transactionData.employeeId || '',
                invoiceNumber: transactionData.invoiceNumber || '',
                pricePerLiter: '' 
            });
        }
    }, [isEditing, transactionData]);

    // Atualiza preço sugerido
    useEffect(() => {
        if (formData.partnerId && formData.fuelType) {
            const partner = partners.find(p => p.id === formData.partnerId);
            if (partner && partner.fuel_prices) {
                const price = parseFloat(partner.fuel_prices[formData.fuelType] || 0);
                if (price > 0) {
                    setInitialPartnerPrice(price);
                    if (!isEditing && !formData.pricePerLiter) {
                        setFormData(prev => ({ ...prev, pricePerLiter: price.toString() }));
                    }
                }
            }
        }
    }, [formData.partnerId, formData.fuelType, partners, isEditing]);

    const sortedEmployees = useMemo(() => [...employees].sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [employees]);
    const sortedPartners = useMemo(() => [...partners].sort((a,b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || '')), [partners]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handlePreSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.partnerId || !formData.liters || !formData.fuelType || !formData.employeeId) {
            setAlertMessage("Preencha todos os campos obrigatórios (*).");
            return;
        }

        const liters = parseFloat(formData.liters);
        if (isNaN(liters) || liters <= 0) {
            setAlertMessage("Quantidade de litros inválida.");
            return;
        }

        if (formData.invoiceNumber) {
            const isDuplicate = comboioTransactions.some(t => 
                t.type === 'entrada' &&
                t.partnerId === formData.partnerId &&
                t.invoiceNumber === formData.invoiceNumber &&
                t.id !== transactionData?.id
            );
            
            if (isDuplicate) {
                setAlertMessage(`A Nota Fiscal ${formData.invoiceNumber} já consta lançada para este posto.`);
                return;
            }
        }

        const inputPrice = parseFloat(formData.pricePerLiter);
        if (initialPartnerPrice > 0 && inputPrice > 0 && Math.abs(inputPrice - initialPartnerPrice) > 0.01) {
            setShowPriceUpdateDialog(true);
        } else {
            executeSubmit(false);
        }
    };

    const executeSubmit = async (updatePartnerPrice) => {
        setShowPriceUpdateDialog(false);
        setIsSaving(true);

        const liters = parseFloat(formData.liters);
        
        // CORREÇÃO DO ERRO 500: Passando null explicitamente para campos opcionais removidos (obraId)
        const payload = {
            id: isEditing ? transactionData.id : undefined,
            comboioVehicleId: comboioVehicle.id,
            partnerId: formData.partnerId,
            employeeId: formData.employeeId,
            obraId: null, // Fix: Envia NULL explicitamente
            liters: liters,
            date: new Date(formData.date + 'T12:00:00Z').toISOString(),
            fuelType: formData.fuelType,
            odometro: null, 
            horimetro: null, 
            invoiceNumber: formData.invoiceNumber || null,
            pricePerLiter: parseFloat(formData.pricePerLiter) || 0,
            updatePartnerPrice: updatePartnerPrice,
            createdBy: {
                userId: user.id || user.uid,
                userEmail: user.email || 'sistema@frotasmak.com'
            }
        };

        try {
            let response;
            if (isEditing) {
                response = await apiClient.updateComboioTransaction(transactionData.id, payload);
                setAlertMessage("Entrada atualizada com sucesso!");
            } else {
                response = await apiClient.createComboioEntrada(payload);
                setAlertMessage("Entrada registrada com sucesso!");
            }
            
            // GERA PDF AUTOMÁTICO (Entrada)
            if (!isEditing) {
                const partner = partners.find(p => p.id === formData.partnerId);
                const pdfData = {
                    ...payload,
                    authNumber: response.refuelingOrder?.authNumber || 0,
                    litrosAbastecidos: liters,
                    partnerName: partner?.razaoSocial || 'N/A',
                    vehicleId: comboioVehicle.id, // O "Veículo" aqui é o próprio comboio
                    createdBy: { userEmail: user.email },
                    isEntrada: true // Flag para o gerador saber que é entrada
                };
                generateAuthorizationPDF(pdfData, [comboioVehicle], partners, employees, {});
            }

            reloadData();
            onClose();
        } catch (error) {
            console.error(error);
            setAlertMessage(error.message || "Erro ao salvar entrada.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] flex flex-col relative overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Editar Entrada' : 'Entrada de Combustível'}</h2>
                    <button onClick={onClose} disabled={isSaving}><X size={20}/></button>
                </div>
                
                <form onSubmit={handlePreSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-100 rounded text-blue-800 mb-2">
                            Comboio: <strong>{comboioVehicle?.registroInterno} - {comboioVehicle?.modelo}</strong>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block font-medium mb-1">Posto Fornecedor *</label>
                            <select name="partnerId" value={formData.partnerId} onChange={handleChange} className="w-full p-2 border rounded" required>
                                <option value="">Selecione...</option>
                                {sortedPartners.map(p => <option key={p.id} value={p.id}>{p.razaoSocial}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block font-medium mb-1">Nota Fiscal (NF)</label>
                            <input 
                                name="invoiceNumber" 
                                type="text" 
                                value={formData.invoiceNumber} 
                                onChange={handleChange} 
                                className="w-full p-2 border rounded font-bold uppercase" 
                                placeholder="Nº NF"
                            />
                        </div>
                        <div>
                            <label className="block font-medium mb-1">Preço Litro (R$)</label>
                            <input 
                                name="pricePerLiter" 
                                type="number" 
                                step="0.001" 
                                value={formData.pricePerLiter} 
                                onChange={handleChange} 
                                className={`w-full p-2 border rounded ${initialPartnerPrice > 0 && parseFloat(formData.pricePerLiter) !== initialPartnerPrice ? 'bg-yellow-50 border-yellow-300' : ''}`} 
                                placeholder="0.000"
                            />
                        </div>

                        <div>
                            <label className="block font-medium mb-1">Tipo de Combustível *</label>
                            <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full p-2 border rounded" required>
                                <option value="">Selecione...</option>
                                <option value="dieselComum">Diesel Comum</option>
                                <option value="dieselS10">Diesel S10</option>
                            </select>
                        </div>

                        <div>
                            <label className="block font-medium mb-1">Litros *</label>
                            <input name="liters" type="number" step="0.01" value={formData.liters} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>

                        <div>
                            <label className="block font-medium mb-1">Funcionário *</label>
                            <select name="employeeId" value={formData.employeeId} onChange={handleChange} className="w-full p-2 border rounded" required>
                                <option value="">Selecione...</option>
                                {sortedEmployees.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block font-medium mb-1">Data *</label>
                            <input name="date" type="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                    </div>
                </form>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-lg">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
                    <button onClick={handlePreSubmit} disabled={isSaving} className="px-4 py-2 bg-yellow-400 font-bold rounded hover:bg-yellow-500 flex items-center gap-2">
                        {isSaving ? <Loader className="animate-spin" size={16}/> : <FileText size={16}/>} {isEditing ? 'Salvar' : 'Salvar & PDF'}
                    </button>
                </div>

                {showPriceUpdateDialog && (
                    <div className="absolute inset-0 bg-white bg-opacity-95 z-20 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                        <div className="bg-yellow-100 p-3 rounded-full mb-3 text-yellow-600">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800 mb-2">Valor Diferente do Cadastro</h3>
                        <p className="text-xs text-gray-600 mb-4">
                            O valor informado (R$ {parseFloat(formData.pricePerLiter).toFixed(3)}) é diferente do valor atual no cadastro do posto (R$ {initialPartnerPrice.toFixed(3)}).
                            <br/><br/>
                            <strong>Deseja atualizar o valor no cadastro do posto?</strong>
                        </p>
                        <div className="flex gap-2 w-full">
                            <button 
                                onClick={() => executeSubmit(false)}
                                className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 font-bold rounded text-xs hover:bg-gray-200"
                            >
                                Não, manter antigo
                            </button>
                            <button 
                                onClick={() => executeSubmit(true)}
                                className="flex-1 py-2 px-3 bg-yellow-400 text-gray-900 font-bold rounded text-xs hover:bg-yellow-500 shadow-sm"
                            >
                                Sim, atualizar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComboioEntradaModal;