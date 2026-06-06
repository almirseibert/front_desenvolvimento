import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader, TrendingDown, TrendingUp, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
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

    const [precoUnitario, setPrecoUnitario] = useState('');
    const [initialPartnerPrice, setInitialPartnerPrice] = useState(0);

    const [invoiceNumber, setInvoiceNumber] = useState(order.invoiceNumber || '');

    const suggestedReading = order.horimetro || order.odometro || '';
    const [kmOuHrConfirmado, setKmOuHrConfirmado] = useState(suggestedReading);

    const [outrosValorConfirmado, setOutrosValorConfirmado] = useState('');
    const [averageAlert, setAverageAlert] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [obraStatus, setObraStatus] = useState(null);

    // Bloqueios separados — combinamos em blockReason abaixo
    const [readingBlock, setReadingBlock] = useState(null);
    const [litrosBlock, setLitrosBlock] = useState(null);
    const [priceBlock, setPriceBlock] = useState(null);
    const [priceWarning, setPriceWarning] = useState(null);

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPriceUpdateDialog, setShowPriceUpdateDialog] = useState(false);
    const [showFinalConfirm, setShowFinalConfirm] = useState(false);

    const blockReason = readingBlock || litrosBlock || priceBlock;

    const valorTotal = useMemo(() => {
        const l = parseFloat(litros) || 0;
        const p = parseFloat(precoUnitario) || 0;
        return l * p;
    }, [litros, precoUnitario]);

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

    // --- 3. Validação Leitura (regressão e saltos) ---
    useEffect(() => {
        setReadingBlock(null);
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
            last = parseFloat(vehicle.horimetro || 0);
            if (last === 0) last = parseFloat(vehicle.horimetroDigital || 0);
        }

        const current = parseFloat(kmOuHrConfirmado);

        if (!isNaN(current) && last > 0) {
            if (current < last) {
                setReadingBlock(`Leitura (${current}) menor que a atual do sistema (${last}).`);
            } else if (isHr && (current - last) > 50) {
                setReadingBlock(`Salto excessivo de Horímetro (> 50h). Diferença: ${(current - last).toFixed(1)}h.`);
            } else if (isKm && (current - last) > 1000) {
                setReadingBlock(`Salto excessivo de Km (> 1000).`);
            }
        }
    }, [kmOuHrConfirmado, order.vehicleId, vehicles]);

    // --- 4. Validação Litros vs Liberados (anti-erro de digitação) ---
    useEffect(() => {
        setLitrosBlock(null);
        const l = parseFloat(litros);
        const liberados = parseFloat(order.litrosLiberados);
        if (!l || !liberados || liberados <= 0) return;

        if (l > liberados * 1.10) {
            setLitrosBlock(`Litros (${l}) acima do liberado +10% (máx: ${(liberados * 1.10).toFixed(2)} L). Verifique se não trocou as casas.`);
        } else if (l < liberados * 0.30) {
            setLitrosBlock(`Litros (${l}) muito abaixo do liberado (${liberados} L). Verifique se não trocou as casas.`);
        }
    }, [litros, order.litrosLiberados]);

    // --- 5. Validação Preço vs Cadastro (10% aviso, 25% bloqueio) ---
    useEffect(() => {
        setPriceBlock(null);
        setPriceWarning(null);
        const p = parseFloat(precoUnitario);
        if (!p || initialPartnerPrice <= 0) return;

        const diffPct = Math.abs(p - initialPartnerPrice) / initialPartnerPrice;
        if (diffPct > 0.25) {
            setPriceBlock(`Preço (R$ ${p.toFixed(3)}) varia ${(diffPct * 100).toFixed(1)}% do cadastrado (R$ ${initialPartnerPrice.toFixed(3)}). Possível erro de digitação.`);
        } else if (diffPct > 0.10) {
            setPriceWarning(`Preço varia ${(diffPct * 100).toFixed(1)}% do cadastrado. Confirme.`);
        }
    }, [precoUnitario, initialPartnerPrice]);

    // --- 6. Alerta de Média ---
    useEffect(() => {
        setAverageAlert(null);

        if (!litros || !kmOuHrConfirmado || parseFloat(litros) <= 0) return;

        const history = refuelings
            .filter(r => r.vehicleId === order.vehicleId && r.status === 'Concluída')
            .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

        if (history.length === 0) return;

        const currentReading = parseFloat(kmOuHrConfirmado);
        const lastRefuel = history[0];
        const lastReading = parseFloat(lastRefuel.horimetro || lastRefuel.odometro || 0);

        if (currentReading <= lastReading) return;

        const diff = currentReading - lastReading;
        const currentAverage = diff / parseFloat(litros);

        let sumAvgs = 0;
        let count = 0;

        for (let i = 0; i < Math.min(history.length - 1, 3); i++) {
            const rCurrent = history[i];
            const rPrev = history[i + 1];
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
        if (e) e.preventDefault();

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

        setShowFinalConfirm(true);
    };

    const handleAfterPassword = () => {
        setShowPasswordModal(false);
        setShowFinalConfirm(true);
    };

    const checkPriceAndSubmit = () => {
        setShowFinalConfirm(false);
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

    const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm border border-gray-200 flex flex-col relative overflow-hidden max-h-[95vh]">
                <div className="p-3 border-b flex justify-between items-center bg-gray-50 rounded-t-lg shrink-0">
                    <h2 className="text-base font-bold text-gray-800">Confirmar Abastecimento</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full"><X size={16} /></button>
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
                                <h4 className="font-bold text-gray-700 flex items-center gap-1"><TrendingUp size={10} /> Obra</h4>
                                <span className="font-bold text-blue-600">{obraStatus.percentual.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1">
                                <div className={`h-1 rounded-full ${obraStatus.percentual > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(obraStatus.percentual, 100)}%` }}></div>
                            </div>
                            <div className="flex justify-between mt-0.5 text-gray-500">
                                <span>Gasto: {fmtBRL(obraStatus.totalGasto)}</span>
                                <span>Total: {fmtBRL(obraStatus.valorContrato)}</span>
                            </div>
                        </div>
                    )}

                    {averageAlert && (
                        <div className="p-2 bg-red-50 text-red-800 rounded border border-red-200 text-[10px] font-medium flex gap-1 items-center">
                            <TrendingDown size={12} /> {averageAlert}
                        </div>
                    )}

                    {/* CAMPOS — UM ABAIXO DO OUTRO */}

                    {/* Litros Abastecidos */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">
                            Litros Abastecidos *
                            {order.litrosLiberados && <span className="font-normal text-gray-400 ml-1">(liberado: {order.litrosLiberados} L)</span>}
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            value={litros}
                            onChange={e => setLitros(e.target.value)}
                            className={`w-full p-1.5 border rounded font-bold text-sm focus:ring-1 focus:ring-yellow-400 outline-none ${litrosBlock ? 'bg-red-50 border-red-400' : ''}`}
                            required
                            autoFocus
                        />
                        {litrosBlock && (
                            <p className="text-[10px] text-red-700 mt-0.5 font-medium flex gap-1 items-start">
                                <AlertTriangle size={10} className="shrink-0 mt-0.5" /> {litrosBlock}
                            </p>
                        )}
                    </div>

                    {/* Preço por Litro */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">
                            Preço por Litro (R$) *
                            {initialPartnerPrice > 0 && <span className="font-normal text-gray-400 ml-1">(cadastrado: R$ {initialPartnerPrice.toFixed(3)})</span>}
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            value={precoUnitario}
                            onChange={e => setPrecoUnitario(e.target.value)}
                            className={`w-full p-1.5 border rounded font-bold text-sm focus:ring-1 focus:ring-yellow-400 outline-none ${
                                priceBlock ? 'bg-red-50 border-red-400' :
                                priceWarning ? 'bg-yellow-50 border-yellow-400' : ''
                            }`}
                            placeholder="0.000"
                        />
                        {priceBlock && (
                            <p className="text-[10px] text-red-700 mt-0.5 font-medium flex gap-1 items-start">
                                <AlertTriangle size={10} className="shrink-0 mt-0.5" /> {priceBlock}
                            </p>
                        )}
                        {!priceBlock && priceWarning && (
                            <p className="text-[10px] text-yellow-700 mt-0.5 font-medium">⚠ {priceWarning}</p>
                        )}
                    </div>

                    {/* VALOR TOTAL — somente visual, não editável */}
                    <div className="p-2 bg-green-50 border-2 border-green-300 rounded">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-green-800">VALOR TOTAL (confira no cupom)</span>
                            <span className="text-lg font-bold text-green-700">{fmtBRL(valorTotal)}</span>
                        </div>
                        <p className="text-[9px] text-green-700 mt-0.5">
                            {(parseFloat(litros) || 0).toFixed(2)} L × R$ {(parseFloat(precoUnitario) || 0).toFixed(3)}
                        </p>
                    </div>

                    {/* Nota Fiscal */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Nota Fiscal (NF)</label>
                        <input
                            type="text"
                            value={invoiceNumber}
                            onChange={e => setInvoiceNumber(e.target.value)}
                            className="w-full p-1.5 border rounded font-bold uppercase focus:ring-1 focus:ring-yellow-400 outline-none"
                            placeholder="Nº da NF"
                        />
                    </div>

                    {order.needsArla && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Litros Arla 32 *</label>
                            <input type="number" step="0.01" value={litrosArla} onChange={e => setLitrosArla(e.target.value)} className="w-full p-1.5 border rounded focus:ring-1 focus:ring-yellow-400 outline-none" required />
                        </div>
                    )}

                    {order.outrosGeraValor && (
                        <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                            <label className="block text-[10px] font-bold text-yellow-900 mb-0.5">Valor "{order.outros}" (R$) *</label>
                            <input type="number" step="0.01" value={outrosValorConfirmado} onChange={e => setOutrosValorConfirmado(e.target.value)} className="w-full p-1.5 border border-yellow-400 rounded bg-white font-bold text-yellow-900 focus:ring-1 focus:ring-yellow-400 outline-none" required placeholder="0.00" />
                        </div>
                    )}

                    {/* Leitura Painel */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Leitura Painel (Atual) *</label>
                        <input
                            type="number"
                            step="0.1"
                            value={kmOuHrConfirmado}
                            onChange={e => setKmOuHrConfirmado(e.target.value)}
                            className={`w-full p-1.5 border rounded focus:ring-1 focus:ring-yellow-400 outline-none ${readingBlock ? 'bg-red-50 border-red-400' : ''}`}
                            required
                        />
                        <p className="text-[9px] text-gray-400 text-right">Sugerido: {suggestedReading}</p>
                        {readingBlock && (
                            <p className="text-[10px] text-red-700 mt-0.5 font-medium flex gap-1 items-start">
                                <AlertTriangle size={10} className="shrink-0 mt-0.5" /> {readingBlock}
                            </p>
                        )}
                    </div>

                    <div className="pt-1 flex justify-end gap-2 shrink-0">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded font-bold hover:bg-gray-200">Cancelar</button>
                        {blockReason ? (
                            <button onClick={handleConfirmClick} type="button" className="px-3 py-1.5 bg-red-500 text-white font-bold rounded hover:bg-red-600 shadow-md flex items-center gap-1">
                                <Lock size={12} /> Liberar
                            </button>
                        ) : (
                            <button type="submit" disabled={isSaving} className="px-3 py-1.5 bg-green-500 text-white font-bold rounded hover:bg-green-600 shadow-md flex items-center gap-1">
                                {isSaving ? <Loader className="animate-spin" size={12} /> : 'Confirmar'}
                            </button>
                        )}
                    </div>
                </form>

                {/* RESUMO FINAL — força revisão antes de gravar */}
                {showFinalConfirm && (
                    <div className="absolute inset-0 bg-white bg-opacity-98 z-20 flex flex-col items-center justify-center p-5 text-center animate-fadeIn overflow-y-auto">
                        <div className="bg-blue-100 p-3 rounded-full mb-3 text-blue-600">
                            <CheckCircle size={28} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800 mb-1">Confira antes de gravar</h3>
                        <p className="text-[10px] text-gray-500 mb-3">Compare cada linha com o cupom fiscal.</p>
                        <div className="w-full bg-gray-50 border border-gray-200 rounded p-3 space-y-1.5 text-xs mb-4">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Litros:</span>
                                <span className="font-bold">{(parseFloat(litros) || 0).toFixed(2)} L</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Preço/L:</span>
                                <span className="font-bold">R$ {(parseFloat(precoUnitario) || 0).toFixed(3)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1.5 mt-1.5">
                                <span className="text-gray-700 font-bold">Total:</span>
                                <span className="font-bold text-green-700 text-base">{fmtBRL(valorTotal)}</span>
                            </div>
                            {invoiceNumber && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">NF:</span>
                                    <span className="font-bold">{invoiceNumber}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">Leitura:</span>
                                <span className="font-bold">{kmOuHrConfirmado}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full">
                            <button onClick={() => setShowFinalConfirm(false)} className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 font-bold rounded text-xs hover:bg-gray-200">Voltar e corrigir</button>
                            <button onClick={checkPriceAndSubmit} disabled={isSaving} className="flex-1 py-2 px-3 bg-green-500 text-white font-bold rounded text-xs hover:bg-green-600 shadow">Está correto, gravar</button>
                        </div>
                    </div>
                )}

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
                        onConfirm={handleAfterPassword}
                        onClose={() => setShowPasswordModal(false)}
                        apiClient={apiClient}
                    />
                )}
            </div>
        </div>
    );
};

export default ConfirmRefuelingModal;
