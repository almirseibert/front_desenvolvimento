import React, { useState, useEffect, useMemo } from 'react';
import { Loader, TrendingDown, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { getAllowedReadingTypes, getGroupForType } from '../../utils/vehicleRules';

/**
 * Formulário de confirmação de baixa (dados do cupom fiscal).
 *
 * Extraído de ConfirmRefuelingModal para ser embutido INLINE dentro do modal
 * de Conferência de Baixa (AdminSolicitacoesPage), mantendo a foto do cupom
 * sempre visível ao lado. Não renderiza wrapper de modal.
 *
 * Campos já exibidos no painel de conferência foram removidos aqui para não
 * duplicar (Ordem #, Combustível, Liberado, Obs, Posto, Obra e o box
 * "Financeiro (Obra)"). Aqui ficam apenas os campos exclusivos da baixa.
 */
const BaixaForm = ({
    user,
    order,
    onClose,
    setAlertMessage,
    apiClient,
    reloadData,
    onAfterConfirm,
    refuelings = [],
    vehicles = [],
    partners = [],
    employees = [],
    PasswordConfirmationModal
}) => {
    const [litros, setLitros] = useState(order.litrosLiberados || '');
    const [litrosArla, setLitrosArla] = useState(order.litrosLiberadosArla || '');

    const [precoUnitario, setPrecoUnitario] = useState('');
    const [initialPartnerPrice, setInitialPartnerPrice] = useState(0);

    const [precoUnitarioArla, setPrecoUnitarioArla] = useState('');
    const [initialPartnerPriceArla, setInitialPartnerPriceArla] = useState(0);

    const [invoiceNumber, setInvoiceNumber] = useState(order.invoiceNumber || '');

    const suggestedReading = order.horimetro || order.odometro || '';
    const [kmOuHrConfirmado, setKmOuHrConfirmado] = useState(suggestedReading);

    const [outrosValorConfirmado, setOutrosValorConfirmado] = useState('');
    const [averageAlert, setAverageAlert] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [readingBlock, setReadingBlock] = useState(null);
    const [litrosBlock, setLitrosBlock] = useState(null);
    const [priceBlock, setPriceBlock] = useState(null);
    const [priceWarning, setPriceWarning] = useState(null);

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPriceUpdateDialog, setShowPriceUpdateDialog] = useState(false);
    const [showFinalConfirm, setShowFinalConfirm] = useState(false);

    const blockReason = readingBlock || litrosBlock || priceBlock;

    const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- Lookups ---
    const partnerInfo = useMemo(() => {
        if (!order.partnerId) return null;
        return partners.find(p => p.id === order.partnerId) || null;
    }, [order.partnerId, partners]);

    const vehicleInfo = useMemo(() => {
        if (!order.vehicleId) return null;
        return vehicles.find(v => v.id === order.vehicleId) || null;
    }, [order.vehicleId, vehicles]);

    const driverInfo = useMemo(() => {
        if (!order.employeeId) return null;
        return employees.find(e => e.id === order.employeeId) || null;
    }, [order.employeeId, employees]);

    // --- Totais ---
    const valorCombustivel = useMemo(
        () => (parseFloat(litros) || 0) * (parseFloat(precoUnitario) || 0),
        [litros, precoUnitario]
    );
    const valorArla = useMemo(
        () => order.needsArla ? (parseFloat(litrosArla) || 0) * (parseFloat(precoUnitarioArla) || 0) : 0,
        [order.needsArla, litrosArla, precoUnitarioArla]
    );
    const valorOutros = useMemo(
        () => order.outrosGeraValor ? (parseFloat(outrosValorConfirmado) || 0) : 0,
        [order.outrosGeraValor, outrosValorConfirmado]
    );
    const valorTotal = valorCombustivel + valorArla + valorOutros;

    // --- 1. Inicializa Preços do Posto (combustível + arla) ---
    useEffect(() => {
        if (order.partnerId && partners.length > 0) {
            const partner = partners.find(p => p.id === order.partnerId);
            if (partner && partner.fuel_prices) {
                if (order.fuelType) {
                    const currentPrice = partner.fuel_prices[order.fuelType];
                    if (currentPrice) {
                        setPrecoUnitario(currentPrice);
                        setInitialPartnerPrice(parseFloat(currentPrice));
                    }
                }
                if (order.needsArla) {
                    const arlaPrice = partner.fuel_prices['Arla'];
                    if (arlaPrice) {
                        setPrecoUnitarioArla(arlaPrice);
                        setInitialPartnerPriceArla(parseFloat(arlaPrice));
                    }
                }
            }
        }
    }, [order.partnerId, order.fuelType, order.needsArla, partners]);

    // --- 2. Validação Leitura ---
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
            } else {
                const limiteKm = getGroupForType(vehicle.tipo) === 'Caminhões de Trecho' ? 2000 : 1000;
                if (isKm && (current - last) > limiteKm) {
                    setReadingBlock(`Salto excessivo de Km (> ${limiteKm}).`);
                }
            }
        }
    }, [kmOuHrConfirmado, order.vehicleId, vehicles]);

    // --- 3. Validação Litros vs Liberados ---
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

    // --- 4. Validação Preço vs Cadastro ---
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

    // --- 5. Médias (últimos 3 abastecimentos + atual) ---
    const mediaStats = useMemo(() => {
        if (!order.vehicleId || refuelings.length === 0) return null;

        const history = refuelings
            .filter(r => r.vehicleId === order.vehicleId && r.status === 'Concluída')
            .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

        if (history.length < 2) return null;

        const items = [];
        for (let i = 0; i < Math.min(history.length - 1, 3); i++) {
            const rCurrent = history[i];
            const rPrev = history[i + 1];
            const l = parseFloat(rCurrent.litrosAbastecidos || 0);
            const valCurr = parseFloat(rCurrent.horimetro || rCurrent.odometro || 0);
            const valPrev = parseFloat(rPrev.horimetro || rPrev.odometro || 0);
            if (l > 0 && valCurr > valPrev) {
                items.push({
                    data: rCurrent.data,
                    media: (valCurr - valPrev) / l,
                    litros: l
                });
            }
        }
        if (items.length === 0) return null;

        const combinedAvg = items.reduce((s, i) => s + i.media, 0) / items.length;

        const lastReading = parseFloat(history[0].horimetro || history[0].odometro || 0);
        const currentReading = parseFloat(kmOuHrConfirmado) || 0;
        const currentLitros = parseFloat(litros) || 0;
        let currentAvg = null;
        if (currentReading > lastReading && currentLitros > 0) {
            currentAvg = (currentReading - lastReading) / currentLitros;
        }

        return { items, combinedAvg, currentAvg };
    }, [refuelings, order.vehicleId, kmOuHrConfirmado, litros]);

    // --- 6. Alerta de Média ---
    useEffect(() => {
        setAverageAlert(null);
        if (!mediaStats || mediaStats.currentAvg == null) return;
        const { combinedAvg, currentAvg } = mediaStats;
        if (currentAvg < (combinedAvg * 0.75)) {
            setAverageAlert(`⚠️ ALERTA: Média caiu >25% (Atual: ${currentAvg.toFixed(2)} / Base: ${combinedAvg.toFixed(2)})`);
        }
    }, [mediaStats]);

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
                pricePerLiterArla: order.needsArla ? (parseFloat(precoUnitarioArla) || 0) : 0,
                confirmedReading: parseFloat(kmOuHrConfirmado) || 0,
                confirmedBy: user,
                outrosValor: order.outrosGeraValor ? (parseFloat(outrosValorConfirmado) || 0) : 0,
                invoiceNumber: invoiceNumber,
                updatePartnerPrice: shouldUpdatePartnerPrice
            };

            await apiClient.confirmRefuelingOrder(order.id, payload);
            if (onAfterConfirm) await onAfterConfirm();
            setAlertMessage("Abastecimento confirmado!");
            reloadData();
            if (onClose) onClose();
        } catch (error) {
            setAlertMessage("Erro ao confirmar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const partnerName = partnerInfo?.razaoSocial || '-';
    const driverName = driverInfo?.nome || '-';
    const vehicleRegistro = vehicleInfo?.registroInterno || '-';
    const vehicleModelo = vehicleInfo?.modelo || '-';
    const vehiclePlaca = vehicleInfo?.placa || '';

    // --- TELA DE REVISÃO FINAL (inline — não cobre a foto do cupom) ---
    if (showFinalConfirm) {
        return (
            <div className="bg-white border-2 border-blue-200 rounded-lg p-3 text-xs animate-fadeIn">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                        <CheckCircle size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Confira antes de gravar</h3>
                </div>
                <p className="text-[10px] text-gray-500 text-center mb-3">Compare cada linha com o cupom fiscal ao lado.</p>

                {/* Identificação */}
                <div className="bg-gray-50 border border-gray-200 rounded p-2 mb-2 text-[11px] space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Posto:</span><span className="font-bold text-right">{partnerName}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Veículo:</span><span className="font-bold text-right">{vehicleRegistro} — {vehicleModelo}{vehiclePlaca ? ` (${vehiclePlaca})` : ''}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Motorista:</span><span className="font-bold text-right">{driverName}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Ordem:</span><span className="font-bold">#{String(order.authNumber).padStart(6, '0')}</span></div>
                </div>

                {/* Valores */}
                <div className="bg-gray-50 border border-gray-200 rounded p-2 mb-2 text-[11px] space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Combustível:</span><span className="font-bold">{(parseFloat(litros) || 0).toFixed(2)} L × R$ {(parseFloat(precoUnitario) || 0).toFixed(3)} = {fmtBRL(valorCombustivel)}</span></div>
                    {order.needsArla && (
                        <div className="flex justify-between"><span className="text-gray-500">Arla:</span><span className="font-bold">{(parseFloat(litrosArla) || 0).toFixed(2)} L × R$ {(parseFloat(precoUnitarioArla) || 0).toFixed(3)} = {fmtBRL(valorArla)}</span></div>
                    )}
                    {order.outrosGeraValor && (
                        <div className="flex justify-between"><span className="text-gray-500">{order.outros || 'Outros'}:</span><span className="font-bold">{fmtBRL(valorOutros)}</span></div>
                    )}
                    <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="text-gray-700 font-bold">TOTAL DA NOTA:</span>
                        <span className="font-bold text-green-700 text-base">{fmtBRL(valorTotal)}</span>
                    </div>
                    {invoiceNumber && (
                        <div className="flex justify-between"><span className="text-gray-500">NF:</span><span className="font-bold">{invoiceNumber}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-gray-500">Leitura:</span><span className="font-bold">{kmOuHrConfirmado}</span></div>
                </div>

                {/* Médias */}
                {mediaStats && (
                    <div className="bg-gray-50 border border-gray-200 rounded p-2 mb-2 text-[11px]">
                        <div className="font-bold text-gray-700 mb-1">Médias (Km|Hr por litro)</div>
                        <div className="space-y-0.5">
                            {mediaStats.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between text-gray-600">
                                    <span>{idx + 1}º anterior {it.data ? `(${new Date(it.data).toLocaleDateString('pt-BR')})` : ''}:</span>
                                    <span className="font-mono">{it.media.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between border-t pt-1 mt-1">
                                <span className="font-bold text-gray-700">Média combinada:</span>
                                <span className="font-mono font-bold">{mediaStats.combinedAvg.toFixed(2)}</span>
                            </div>
                            {mediaStats.currentAvg != null && (
                                <div className={`flex justify-between font-bold ${
                                    mediaStats.currentAvg < mediaStats.combinedAvg * 0.75 ? 'text-red-700' :
                                    mediaStats.currentAvg < mediaStats.combinedAvg * 0.9 ? 'text-yellow-700' :
                                    'text-green-700'
                                }`}>
                                    <span>Média desta abastecida:</span>
                                    <span className="font-mono">{mediaStats.currentAvg.toFixed(2)} ({((mediaStats.currentAvg / mediaStats.combinedAvg - 1) * 100).toFixed(1)}%)</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showPriceUpdateDialog ? (
                    <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-center animate-fadeIn">
                        <div className="flex items-center justify-center gap-2 mb-2 text-yellow-700">
                            <AlertTriangle size={18} />
                            <h4 className="text-xs font-bold text-gray-800">Valor diferente do cadastro — atualizar preço do posto?</h4>
                        </div>
                        <div className="flex gap-2 w-full">
                            <button onClick={() => executeConfirm(false)} disabled={isSaving} className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 font-bold rounded text-xs hover:bg-gray-200">Não, manter antigo</button>
                            <button onClick={() => executeConfirm(true)} disabled={isSaving} className="flex-1 py-2 px-3 bg-yellow-400 text-gray-900 font-bold rounded text-xs hover:bg-yellow-500 shadow-sm">Sim, atualizar</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2 w-full mt-2">
                        <button onClick={() => setShowFinalConfirm(false)} disabled={isSaving} className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 font-bold rounded text-xs hover:bg-gray-200">Voltar e corrigir</button>
                        <button onClick={checkPriceAndSubmit} disabled={isSaving} className="flex-1 py-2 px-3 bg-green-500 text-white font-bold rounded text-xs hover:bg-green-600 shadow flex items-center justify-center gap-1">
                            {isSaving ? <Loader className="animate-spin" size={12} /> : 'Está correto, gravar'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // --- FORMULÁRIO DE ENTRADA (dados exclusivos da baixa) ---
    return (
        <form onSubmit={handleConfirmClick} className="bg-white border-2 border-blue-200 rounded-lg p-3 space-y-3 text-xs">
            <h5 className="text-[11px] font-bold text-blue-800 uppercase flex items-center gap-1">
                <CheckCircle size={13} /> Confirmar Baixa — dados do cupom
            </h5>

            {averageAlert && (
                <div className="p-2 bg-red-50 text-red-800 rounded border border-red-200 text-[10px] font-medium flex gap-1 items-center">
                    <TrendingDown size={12} /> {averageAlert}
                </div>
            )}

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

            {/* ARLA */}
            {order.needsArla && (
                <div className="p-2 bg-cyan-50 border border-cyan-200 rounded space-y-2">
                    <div className="text-[10px] font-bold text-cyan-900">Arla 32</div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Litros Arla *</label>
                        <input
                            type="number"
                            step="0.01"
                            value={litrosArla}
                            onChange={e => setLitrosArla(e.target.value)}
                            className="w-full p-1.5 border rounded focus:ring-1 focus:ring-yellow-400 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">
                            Preço por Litro Arla (R$) *
                            {initialPartnerPriceArla > 0 && <span className="font-normal text-gray-400 ml-1">(cadastrado: R$ {initialPartnerPriceArla.toFixed(3)})</span>}
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            value={precoUnitarioArla}
                            onChange={e => setPrecoUnitarioArla(e.target.value)}
                            className="w-full p-1.5 border rounded focus:ring-1 focus:ring-yellow-400 outline-none"
                            placeholder="0.000"
                            required
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-cyan-900 font-medium pt-1 border-t border-cyan-200">
                        <span>Subtotal Arla:</span>
                        <span className="font-bold">{fmtBRL(valorArla)}</span>
                    </div>
                </div>
            )}

            {/* OUTROS */}
            {order.outrosGeraValor && (
                <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                    <label className="block text-[10px] font-bold text-yellow-900 mb-0.5">Valor "{order.outros}" (R$) *</label>
                    <input
                        type="number"
                        step="0.01"
                        value={outrosValorConfirmado}
                        onChange={e => setOutrosValorConfirmado(e.target.value)}
                        className="w-full p-1.5 border border-yellow-400 rounded bg-white font-bold text-yellow-900 focus:ring-1 focus:ring-yellow-400 outline-none"
                        required
                        placeholder="0.00"
                    />
                </div>
            )}

            {/* VALOR TOTAL */}
            <div className="p-2 bg-green-50 border-2 border-green-300 rounded">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-green-800">VALOR TOTAL DA NOTA</span>
                    <span className="text-lg font-bold text-green-700">{fmtBRL(valorTotal)}</span>
                </div>
                <div className="text-[9px] text-green-700 mt-1 space-y-0.5 border-t border-green-200 pt-1">
                    <div className="flex justify-between">
                        <span>Combustível: {(parseFloat(litros) || 0).toFixed(2)} L × R$ {(parseFloat(precoUnitario) || 0).toFixed(3)}</span>
                        <span>{fmtBRL(valorCombustivel)}</span>
                    </div>
                    {order.needsArla && (
                        <div className="flex justify-between">
                            <span>Arla: {(parseFloat(litrosArla) || 0).toFixed(2)} L × R$ {(parseFloat(precoUnitarioArla) || 0).toFixed(3)}</span>
                            <span>{fmtBRL(valorArla)}</span>
                        </div>
                    )}
                    {order.outrosGeraValor && (
                        <div className="flex justify-between">
                            <span>{order.outros || 'Outros'}:</span>
                            <span>{fmtBRL(valorOutros)}</span>
                        </div>
                    )}
                </div>
                <p className="text-[9px] text-green-700 mt-1 italic">Confira no cupom fiscal ao lado</p>
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

            <div className="pt-1 flex justify-end gap-2">
                {blockReason ? (
                    <button onClick={handleConfirmClick} type="button" className="px-3 py-2 bg-red-500 text-white font-bold rounded hover:bg-red-600 shadow-md flex items-center gap-1">
                        <Lock size={12} /> Liberar (senha)
                    </button>
                ) : (
                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-green-500 text-white font-bold rounded hover:bg-green-600 shadow-md flex items-center gap-1">
                        {isSaving ? <Loader className="animate-spin" size={12} /> : <><CheckCircle size={14} /> Confirmar Baixa</>}
                    </button>
                )}
            </div>

            {showPasswordModal && (
                <PasswordConfirmationModal
                    message={`BLOQUEIO DE SEGURANÇA:\n${blockReason}\nInsira senha para autorizar.`}
                    onConfirm={handleAfterPassword}
                    onClose={() => setShowPasswordModal(false)}
                    apiClient={apiClient}
                />
            )}
        </form>
    );
};

export default BaixaForm;
