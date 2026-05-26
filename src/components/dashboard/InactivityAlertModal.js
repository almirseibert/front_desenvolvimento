import React, { useState, useMemo, useEffect } from 'react';
import { X, Clock, CheckCircle, Loader, AlertTriangle, ShieldCheck, Fuel } from 'lucide-react';

const InactivityAlertModal = ({ 
    alert, 
    onClose, 
    onObserve, 
    onProlong, 
    apiClient, 
    setAlertMessage, 
    refuelings = [], 
    obras = [], 
    vehicles = [],
    employees = [] 
}) => {
    const [prolongDays, setProlongDays] = useState(7);
    const [observation, setObservation] = useState(alert.observation || '');
    const [isSaving, setIsSaving] = useState(false);

    // 1. RESOLUÇÃO DE NOMES (Lookup Robust)
    const alertData = useMemo(() => {
        // --- Obra ---
        let obraNome = alert.obra?.nome || alert.obra_nome;
        if (!obraNome) {
            const obraId = alert.obraId || alert.obra_id;
            const foundObra = obras.find(o => String(o.id) === String(obraId));
            if (foundObra) obraNome = foundObra.nome;
        }

        // --- Veículo ---
        let veiculoNome = alert.vehicle?.registroInterno;
        let veiculoModelo = alert.vehicle?.modelo;
        let veiculoId = alert.vehicle?.id || alert.vehicleId || alert.vehicle_id;

        if (!veiculoNome && veiculoId) {
            const foundVehicle = vehicles.find(v => String(v.id) === String(veiculoId));
            if (foundVehicle) {
                veiculoNome = foundVehicle.registroInterno;
                veiculoModelo = foundVehicle.modelo;
            }
        }

        // --- Operador ---
        let operadorNome = alert.operator?.nome || alert.operator_nome;
        if (!operadorNome) {
            // Tenta buscar no veículo (alguns sistemas vinculam motorista ao veículo)
            const foundVehicle = vehicles.find(v => String(v.id) === String(veiculoId));
            if (foundVehicle && foundVehicle.motoristaId) {
                const foundEmp = employees.find(e => String(e.id) === String(foundVehicle.motoristaId));
                if (foundEmp) operadorNome = foundEmp.nome;
            }
            // Tenta buscar no próprio alerta se tiver operatorId
            if (!operadorNome && (alert.operatorId || alert.operator_id)) {
                const opId = alert.operatorId || alert.operator_id;
                const foundEmp = employees.find(e => String(e.id) === String(opId));
                if (foundEmp) operadorNome = foundEmp.nome;
            }
        }

        return {
            id: alert.id,
            vehicleId: veiculoId,
            vehicleCode: veiculoNome || 'Veículo Desconhecido',
            vehicleModel: veiculoModelo || '',
            obraName: obraNome || 'Obra Desconhecida / Não Alocado',
            operatorName: operadorNome || 'Operador não identificado'
        };
    }, [alert, obras, vehicles, employees]);

    // 2. LÓGICA DE CORREÇÃO EM TEMPO REAL
    const realStatus = useMemo(() => {
        if (!alertData.vehicleId || !refuelings.length) return null;

        // Filtra abastecimentos deste veículo (Concluídos)
        const vehicleRefuels = refuelings
            .filter(r => String(r.vehicleId) === String(alertData.vehicleId) && r.status === 'Concluída')
            .sort((a,b) => {
                const dateA = new Date(a.date || a.created_at || a.data || 0);
                const dateB = new Date(b.date || b.created_at || b.data || 0);
                return dateB - dateA;
            });

        const now = new Date();
        
        // Cenário A: Veículo nunca abasteceu no sistema
        if (vehicleRefuels.length === 0) {
            // Fallback para a data do alerta, se existir e for válida
            if (alert.lastRefuelingDate) {
                const alertDate = new Date(alert.lastRefuelingDate);
                if (!isNaN(alertDate.getTime())) {
                    const days = Math.floor(Math.abs(now - alertDate) / (1000 * 60 * 60 * 24));
                    return {
                        dateStr: alertDate.toLocaleDateString('pt-BR'),
                        daysInactive: days,
                        isFalsePositive: false
                    };
                }
            }
            return null; // Sem dados confiáveis
        }

        // Cenário B: Encontramos abastecimentos reais
        const latest = vehicleRefuels[0];
        // Tenta encontrar o campo de data correto (priorizando date ou created_at)
        const dateRaw = latest.date || latest.created_at || latest.data;
        
        if (!dateRaw) return null; 

        const latestDate = new Date(dateRaw);
        if (isNaN(latestDate.getTime())) return null; 

        // Calcula dias inativo
        const diffTime = Math.abs(now - latestDate);
        const daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        const isFalsePositive = daysInactive < 7; 

        return {
            date: latestDate,
            dateStr: latestDate.toLocaleDateString('pt-BR') + ` às ${latestDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`,
            daysInactive: isNaN(daysInactive) ? 0 : daysInactive,
            isFalsePositive,
            fuelStation: latest.posto || 'Posto Interno/Comboio'
        };
    }, [alertData.vehicleId, refuelings, alert.lastRefuelingDate]);

    // Define valores de exibição
    const displayDate = realStatus ? realStatus.dateStr : (
        alert.lastRefuelingDate && !isNaN(new Date(alert.lastRefuelingDate).getTime()) 
        ? new Date(alert.lastRefuelingDate).toLocaleDateString('pt-BR') 
        : 'Sem registro'
    );
    
    const displayDays = realStatus ? realStatus.daysInactive : (
        (alert.daysSinceLastRefuel && !isNaN(parseInt(alert.daysSinceLastRefuel))) 
        ? alert.daysSinceLastRefuel 
        : '?'
    );

    // Efeito para preencher automaticamente a observação
    useEffect(() => {
        if (realStatus?.isFalsePositive && !observation) {
            setObservation(`Correção Automática: Veículo abastecido em ${realStatus.dateStr}. Alerta invalidado.`);
        }
    }, [realStatus, observation]);

    const handleResolve = async () => {
        if (!observation && !realStatus?.isFalsePositive) return setAlertMessage("Adicione uma observação.");
        
        setIsSaving(true);
        try {
            await apiClient.updateInactivityAlert(alert.id, {
                status: 'Resolvido',
                observation: observation,
                dismissedAt: new Date().toISOString(),
            });
            onObserve(); 
        } catch (error) {
            setAlertMessage("Erro ao resolver alerta.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleProlong = async () => {
        const days = parseInt(prolongDays, 10);
        if (isNaN(days) || days <= 0) return setAlertMessage("Dias inválidos.");

        setIsSaving(true);
        try {
            const newAlertUntilDate = new Date();
            newAlertUntilDate.setDate(newAlertUntilDate.getDate() + days);

            await apiClient.updateInactivityAlert(alert.id, {
                status: 'Prolongado',
                observation: observation || `Prolongado por ${days} dia(s).`,
                prolongedUntil: newAlertUntilDate.toISOString(),
                prolongedByDays: days,
            });
            onProlong();
        } catch (error) {
            setAlertMessage("Erro ao prorrogar.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        // Z-Index aumentado para 10000 para garantir que fique acima de tudo
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10] p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 border border-gray-200">
                {/* Header */}
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Clock className="text-orange-600" size={20}/>
                            Detalhes de Inatividade
                        </h2>
                        <p className="text-sm text-gray-600 font-medium">
                            {alertData.vehicleCode} <span className="text-gray-400">|</span> {alertData.vehicleModel}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-5">
                    
                    {/* CARD DE STATUS (Dinâmico) */}
                    {realStatus?.isFalsePositive ? (
                        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded shadow-sm animate-pulse-slow">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="text-green-600 shrink-0 mt-0.5" size={24} />
                                <div>
                                    <h4 className="text-sm font-bold text-green-800 uppercase tracking-wide">Situação Normalizada</h4>
                                    <p className="text-sm text-green-700 mt-1 leading-relaxed">
                                        Detectamos um abastecimento recente. Este alerta não é mais válido.
                                    </p>
                                    <div className="mt-2 text-xs font-mono text-green-800 bg-green-100 inline-block px-2 py-1 rounded">
                                        Último Abastecimento: {realStatus.dateStr}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex gap-3 items-start">
                            <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={24}/>
                            <div>
                                <h4 className="text-sm font-bold text-red-800 uppercase tracking-wide">Inatividade Crítica</h4>
                                <p className="text-sm text-red-700 mt-1">
                                    Veículo parado há <strong>{displayDays} dias</strong> sem registro de abastecimento.
                                </p>
                                <p className="text-xs text-red-600 mt-1">
                                    Local: <strong>{alertData.obraName}</strong>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* DETALHES TÉCNICOS */}
                    <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div>
                            <span className="flex items-center gap-1 font-bold text-gray-500 text-[10px] uppercase mb-1">
                                <Fuel size={10}/> Último Registro
                            </span>
                            <span className="font-medium text-gray-900 block">{displayDate}</span>
                            {realStatus?.fuelStation && <span className="text-xs text-gray-500 truncate block">{realStatus.fuelStation}</span>}
                        </div>
                        <div>
                            <span className="font-bold block text-gray-500 text-[10px] uppercase mb-1">Dias s/ Abastecer</span>
                            <span className={`text-lg font-bold ${(!realStatus || realStatus.daysInactive > 7) ? 'text-red-600' : 'text-green-600'}`}>
                                {displayDays}
                            </span>
                        </div>
                        <div className="col-span-2 border-t border-gray-200 pt-2 mt-1">
                             <span className="font-bold block text-gray-500 text-[10px] uppercase mb-1">Operador / Responsável</span>
                             <span className="text-gray-800">{alertData.operatorName}</span>
                        </div>
                    </div>

                    {/* CAMPO DE OBSERVAÇÃO */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ação / Observação {realStatus?.isFalsePositive ? '(Automático)' : '*'}
                        </label>
                        <textarea
                            value={observation}
                            onChange={e => setObservation(e.target.value)}
                            rows="2"
                            className="w-full p-3 border border-gray-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                            placeholder={realStatus?.isFalsePositive ? "Opcional: O sistema detectou abastecimento recente." : "Descreva o motivo (ex: Veículo em manutenção, Operador de férias...)"}
                        />
                    </div>

                    {/* AÇÕES (Prorrogar escondido se for falso positivo) */}
                    {!realStatus?.isFalsePositive && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <div className="w-24">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prorrogar</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={prolongDays}
                                        onChange={e => setProlongDays(e.target.value)}
                                        min="1"
                                        className="w-full pl-2 pr-8 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                    <span className="absolute right-2 top-1.5 text-xs text-gray-400">dias</span>
                                </div>
                            </div>
                            <button 
                                onClick={handleProlong} 
                                disabled={isSaving || !prolongDays} 
                                className="mt-5 flex-1 py-1.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded text-sm font-medium transition-colors"
                            >
                                {isSaving ? <Loader size={14} className="animate-spin inline mr-1"/> : <Clock size={14} className="inline mr-1"/>} 
                                Prorrogar Alerta
                            </button>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleResolve} 
                        disabled={isSaving || (!observation && !realStatus?.isFalsePositive)} 
                        className={`px-5 py-2 text-white rounded shadow-sm disabled:opacity-50 flex gap-2 items-center text-sm font-bold transition-all transform active:scale-95 ${realStatus?.isFalsePositive ? 'bg-green-600 hover:bg-green-700 ring-2 ring-green-200' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isSaving ? <Loader size={16} className="animate-spin"/> : <CheckCircle size={16}/>} 
                        {realStatus?.isFalsePositive ? 'Invalidar Alerta (Resolver)' : 'Registrar & Resolver'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InactivityAlertModal;