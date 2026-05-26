import React, { useState, useEffect } from 'react';
import { X, Loader, TrendingDown, TrendingUp, Lock, AlertTriangle } from 'lucide-react';
import { getAllowedReadingTypes } from '../../utils/vehicleRules';

const ConfirmRefuelingModal = ({ 
    user, 
    order, 
    onClose, 
    setAlertMessage, 
    apiClient, 
    reloadData,
    refuelings = [],
    obras = [],
    expenses = [],
    vehicles = [], 
    partners = [], 
    PasswordConfirmationModal 
}) => {
    const [litros, setLitros] = useState(order.litrosLiberados || '');
    const [litrosArla, setLitrosArla] = useState(order.litrosLiberadosArla || '');
    
    // Estado do Preço
    const [precoUnitario, setPrecoUnitario] = useState(''); 
    const [initialPartnerPrice, setInitialPartnerPrice] = useState(0);

    // Estado para NF
    const [invoiceNumber, setInvoiceNumber] = useState(order.invoiceNumber || '');

    // Sugestão de leitura (Unificada)
    const suggestedReading = order.horimetro ||  order.odometro || '';
    const [kmOuHrConfirmado, setKmOuHrConfirmado] = useState(suggestedReading);
    
    const [outrosValorConfirmado, setOutrosValorConfirmado] = useState('');
    const [averageAlert, setAverageAlert] = useState(null); 
    const [isSaving, setIsSaving] = useState(false);
    
    // --- ESTADO PROGRESSO FINANCEIRO ---
    const [obraStatus, setObraStatus] = useState(null);

    // --- ESTADO BLOQUEIO ---
    const [blockReason, setBlockReason] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    // --- ESTADO ATUALIZAÇÃO DE PREÇO ---
    const [showPriceUpdateDialog, setShowPriceUpdateDialog] = useState(false);

    // --- 1. Inicializa Preço do Posto ---
    useEffect(() => {
        if (order.partnerId && order.fuelType && partners.length > 0) {
            const partner = partners.find(p => p.id === order.partnerId);
            if (partner && partner.fuel_prices) {
                const currentPrice = partner.fuel_prices[order.fuelType];
                if (currentPrice) {
                    setPrecoUnitario(currentPrice);
                    setInitialPartnerPrice(parseFloat(currentPrice));
                }
            }
        }
    }, [order.partnerId, order.fuelType, partners]);

    // --- 2. Cálculo de Progresso Financeiro ---
    useEffect(() => {
        if (order.obraId && obras.length > 0) { 
            const obra = obras.find(o => o.id === order.obraId);
            
            if (!obra) {
                setObraStatus(null);
                return;
            }

            const totalFuelExpenses = expenses
                .filter(e => e.obraId === order.obraId && (e.category === 'Combustível' || e.fuelType))
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

            const valorTotalObra = parseFloat(obra.valorTotalContrato || obra.valorContrato || 0);
            
            if (valorTotalObra > 0) {
                const percentual = (totalFuelExpenses / valorTotalObra) * 100;
                setObraStatus({
                    totalGasto: totalFuelExpenses,
                    valorContrato: valorTotalObra,
                    percentual: percentual
                });
            } else {
                setObraStatus(null);
            }
        } else {
            setObraStatus(null);
        }
    }, [order.obraId, obras, expenses]);

    // --- 3. Validação Rigorosa (Unificada) ---
    useEffect(() => {
        setBlockReason(null);
        if (!kmOuHrConfirmado || !order.vehicleId) return;

        const vehicle = vehicles.find(v => v.id === order.vehicleId);
        if (!vehicle) return;

        const allowedTypes = getAllowedReadingTypes(vehicle.tipo);
        const isKm = allowedTypes.includes('odometro');
        const isHr = allowedTypes.includes('horimetro');
        
        let last = 0;
        if (isKm) {
            last = parseFloat(vehicle.odometro || 0);
        } else {
            // Unificado: Pega horimetro, fallback para legados
            last = parseFloat(vehicle.horimetro || 0);
            if (last === 0) last = parseFloat(vehicle.horimetroDigital || 0);
        }

        const current = parseFloat(kmOuHrConfirmado);
        
        if (!isNaN(current) && last > 0) {
            // Regra: Bloqueio de Regressão (Somente se for ESTRITAMENTE menor. Valores iguais passam direto sem senha)
            if (current < last) {
                setBlockReason(`Leitura (${current}) menor que a atual do sistema (${last}).`);
            }
            // Regra: Saltos
            else if (isHr && (current - last) > 50) {
                setBlockReason(`Salto excessivo de Horímetro (> 50h). Diferença: ${(current - last).toFixed(1)}h.`);
            }
            else if (isKm && (current - last) > 1000) {
                setBlockReason(`Salto excessivo de Km (> 1000).`);
            }
        }
    }, [kmOuHrConfirmado, order.vehicleId, vehicles]);

    // --- 4. Alerta de Média ---
    useEffect(() => {
        setAverageAlert(null);

        if (!litros || !kmOuHrConfirmado || parseFloat(litros) <= 0) return;
        
        const history = refuelings
            .filter(r => r.vehicleId === order.vehicleId && r.status === 'Concluída')
            .sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));
        
        if (history.length === 0) return;

        const currentReading = parseFloat(kmOuHrConfirmado);
        const lastRefuel = history[0];
        // Leitura anterior unificada
        const lastReading = parseFloat(lastRefuel.horimetro || lastRefuel.odometro || 0);

        if (currentReading <= lastReading) return;

        const diff = currentReading - lastReading;
        const currentAverage = diff / parseFloat(litros); 

        // Média Histórica
        let sumAvgs = 0;
        let count = 0;
        
        for (let i = 0; i < Math.min(history.length - 1, 3); i++) {
            const rCurrent = history[i];
            const rPrev = history[i+1];
            const l = parseFloat(rCurrent.litrosAbastecidos || 0);
            const valCurr = parseFloat(rCurrent.horimetro || rCurrent.odometro || 0);
            const valPrev = parseFloat(rPrev.horimetro || rPrev.odometro || 0);
            
            if (l > 0 && valCurr > valPrev) {
                sumAvgs += (valCurr - valPrev) / l;
                count++;
            }
        }

        if (count > 0) {
            const baselineAverage = sumAvgs / count;
            if (currentAverage < (baselineAverage * 0.75)) {
                setAverageAlert(`⚠️ ALERTA: Média caiu >25% (Atual: ${currentAverage.toFixed(2)} / Base: ${baselineAverage.toFixed(2)})`);
            }
        }

    }, [litros, kmOuHrConfirmado, refuelings, order.vehicleId]);

    // --- HANDLERS ---
    const handleConfirmClick = (e) => {
        e.preventDefault();
        
        if (invoiceNumber && order.partnerId) {
            const nfStr = invoiceNumber.toString().trim();
            const isDuplicate = refuelings.some(r => 
                r.partnerId === order.partnerId && 
                r.invoiceNumber === nfStr && 
                r.id !== order.id
            );

            if (isDuplicate) {
                setAlertMessage(`A Nota Fiscal ${nfStr} já consta lançada para este posto.`);
                return;
            }
        }

        if (blockReason) {
            setShowPasswordModal(true);
            return;
        }

        checkPriceAndSubmit();
    };

    const checkPriceAndSubmit = () => {
        setShowPasswordModal(false);
        const inputPrice = parseFloat(precoUnitario);
        if (initialPartnerPrice > 0 && inputPrice > 0 && Math.abs(inputPrice - initialPartnerPrice) > 0.01) {
            setShowPriceUpdateDialog(true);
        } else {
            executeConfirm(false);
        }
    };

    const executeConfirm = async (shouldUpdatePartnerPrice) => {
        setShowPriceUpdateDialog(false);
        setIsSaving(true);
        try {
            const payload = {
                litrosAbastecidos: parseFloat(litros) || 0,
                litrosAbastecidosArla: order.needsArla ? (parseFloat(litrosArla) || 0) : 0,
                pricePerLiter: parseFloat(precoUnitario) || 0,
                confirmedReading: parseFloat(kmOuHrConfirmado) || 0,
                confirmedBy: user,
                outrosValor: order.outrosGeraValor ? (parseFloat(outrosValorConfirmado) || 0) : 0,
                invoiceNumber: invoiceNumber,
                updatePartnerPrice: shouldUpdatePartnerPrice
            };

            await apiClient.confirmRefuelingOrder(order.id, payload);
            setAlertMessage("Abastecimento confirmado!");
            reloadData();
            onClose();
        } catch (error) {
            setAlertMessage("Erro ao confirmar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm border border-gray-200 flex flex-col relative overflow-hidden">
                <div className="p-3 border-b flex justify-between items-center bg-gray-50 rounded-t-lg shrink-0">
                    <h2 className="text-base font-bold text-gray-800">Confirmar Abastecimento</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full"><X size={16}/></button>
                </div>
                
                <form onSubmit={handleConfirmClick} className="p-3 space-y-3 overflow-y-auto flex-1 text-xs">
                    {/* INFO DA ORDEM */}
                    <div className="bg-blue-50 p-2 rounded text-[10px] border border-blue-100">
                        <div className="flex justify-between font-bold">
                            <span>#{String(order.authNumber).padStart(6, '0')}</span>
                            <span>{order.fuelType}</span>
                        </div>
                        {order.litrosLiberados && <p>Liberado: {order.litrosLiberados} L</p>}
                        {order.outros && <p className="mt-1 border-t border-blue-200 pt-0.5">Obs: {order.outros}</p>}
                    </div>

                    {/* PROGRESSO FINANCEIRO */}
                    {obraStatus && (
                        <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[10px]">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="font-bold text-gray-700 flex items-center gap-1"><TrendingUp size={10}/> Obra</h4>
                                <span className="font-bold text-blue-600">{obraStatus.percentual.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1">
                                <div className={`h-1 rounded-full ${obraStatus.percentual > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${Math.min(obraStatus.percentual, 100)}%`}}></div>
                            </div>
                             <div className="flex justify-between mt-0.5 text-gray-500">
                                <span>Gasto: {obraStatus.totalGasto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                                <span>Total: {obraStatus.valorContrato.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                            </div>
                        </div>
                    )}

                    {averageAlert && (
                        <div className="p-2 bg-red-50 text-red-800 rounded border border-red-200 text-[10px] font-medium flex gap-1 items-center">
                            <TrendingDown size={12}/> {averageAlert}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Nota Fiscal (NF)</label>
                            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full p-1 border rounded font-bold uppercase focus:ring-1 focus:ring-yellow-400 outline-none" placeholder="Nº NF"/>
                        </div>
                         <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Preço Litro (R$)</label>
                            <input 
                                type="number" 
                                step="0.001" 
                                value={precoUnitario} 
                                onChange={e => setPrecoUnitario(e.target.value)} 
                                className={`w-full p-1 border rounded focus:ring-1 focus:ring-yellow-400 outline-none ${initialPartnerPrice > 0 && parseFloat(precoUnitario) !== initialPartnerPrice ? 'bg-yellow-50 border-yellow-300' : ''}`} 
                                placeholder="0.000"
                            />
                        </div>
                    </div>

                    <div>
                         <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Lts Abastecidos *</label>
                         <input type="number" step="0.001" value={litros} onChange={e => setLitros(e.target.value)} className="w-full p-1 border rounded font-bold focus:ring-1 focus:ring-yellow-400 outline-none" required autoFocus/>
                    </div>
                    
                    {order.needsArla && (
                         <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Lts Arla 32 *</label>
                            <input type="number" step="0.01" value={litrosArla} onChange={e => setLitrosArla(e.target.value)} className="w-full p-1 border rounded focus:ring-1 focus:ring-yellow-400 outline-none" required />
                        </div>
                    )}

                    {order.outrosGeraValor && (
                        <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                            <label className="block text-[10px] font-bold text-yellow-900 mb-0.5">Valor "{order.outros}" (R$) *</label>
                            <input type="number" step="0.01" value={outrosValorConfirmado} onChange={e => setOutrosValorConfirmado(e.target.value)} className="w-full p-1 border border-yellow-400 rounded bg-white font-bold text-yellow-900 focus:ring-1 focus:ring-yellow-400 outline-none" required placeholder="0.00"/>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Leitura Painel (Atual) *</label>
                        <input type="number" step="0.1" value={kmOuHrConfirmado} onChange={e => setKmOuHrConfirmado(e.target.value)} className="w-full p-1 border rounded focus:ring-1 focus:ring-yellow-400 outline-none" required/>
                        <p className="text-[9px] text-gray-400 text-right">Sugerido: {suggestedReading}</p>
                    </div>

                    <div className="pt-1 flex justify-end gap-2 shrink-0">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded font-bold hover:bg-gray-200">Cancelar</button>
                        {blockReason ? (
                            <button onClick={handleConfirmClick} type="button" className="px-3 py-1.5 bg-red-500 text-white font-bold rounded hover:bg-red-600 shadow-md flex items-center gap-1">
                                <Lock size={12}/> Liberar
                            </button>
                        ) : (
                            <button type="submit" disabled={isSaving} className="px-3 py-1.5 bg-green-500 text-white font-bold rounded hover:bg-green-600 shadow-md flex items-center gap-1">
                                {isSaving ? <Loader className="animate-spin" size={12}/> : 'Confirmar'}
                            </button>
                        )}
                    </div>
                </form>

                {showPriceUpdateDialog && (
                    <div className="absolute inset-0 bg-white bg-opacity-95 z-10 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                        <div className="bg-yellow-100 p-3 rounded-full mb-3 text-yellow-600">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800 mb-2">Valor Diferente do Cadastro</h3>
                        <div className="flex gap-2 w-full">
                            <button 
                                onClick={() => executeConfirm(false)}
                                className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 font-bold rounded text-xs hover:bg-gray-200"
                            >
                                Não, manter antigo
                            </button>
                            <button 
                                onClick={() => executeConfirm(true)}
                                className="flex-1 py-2 px-3 bg-yellow-400 text-gray-900 font-bold rounded text-xs hover:bg-yellow-500 shadow-sm"
                            >
                                Sim, atualizar
                            </button>
                        </div>
                    </div>
                )}

                {showPasswordModal && (
                    <PasswordConfirmationModal
                        message={`BLOQUEIO DE SEGURANÇA:\n${blockReason}\nInsira senha para autorizar.`}
                        onConfirm={checkPriceAndSubmit} 
                        onClose={() => setShowPasswordModal(false)}
                        apiClient={apiClient}
                    />
                )}
            </div>
        </div>
    );
};

export default ConfirmRefuelingModal;