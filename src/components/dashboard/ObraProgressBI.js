import React, { useState, useMemo } from 'react';
import { HardHat, DollarSign, Clock } from 'lucide-react';
import { vehicleGroups } from '../../utils/vehicleRules';
import SearchableObraSelect from '../SearchableObraSelect';
import { formatObraNome } from '../../utils/obraFormat';
import TerceirizadoObraResumo from '../analise/TerceirizadoObraResumo';

const ObraProgressBI = ({ obras = [], vehicles = [], dailyWorkLogs = [] }) => {
    const [selectedObraId, setSelectedObraId] = useState('');

    const activeObras = useMemo(() => {
        return obras
            .filter(o => o.status === 'ativa' && (o.tipo_registro || 'obra') !== 'centro_custo')
            .sort((a,b) => a.nome.localeCompare(b.nome));
    }, [obras]);

    const obraData = useMemo(() => {
        if (!selectedObraId) return null;
        const obra = activeObras.find(o => o.id === selectedObraId);
        if (!obra) return null;

        // 1. CÁLCULO REAL (Baseado em leituras de máquinas/veículos)
        let totalExecutadoHoras = 0;
        let totalExecutadoKmPrancha = parseFloat(obra.kmConcluidoPrancha) || 0;

        (obra.historicoVeiculos || []).forEach(hist => {
            if (!hist.dataSaida) { // Veículo ainda na obra
                const vehicle = vehicles.find(v => v.id === hist.veiculoId);
                if (vehicle) {
                    const isKm = vehicleGroups['Caminhões de Trecho']?.includes(vehicle.tipo);
                    
                    // CORREÇÃO UNIFICADA: Usa apenas horimetro ou odometro. 
                    // Regra #8: Caminhões/Pesados usam horimetro. Leves/Trecho usam odometro.
                    const currentReading = isKm 
                        ? parseFloat(vehicle.odometro || 0) 
                        : parseFloat(vehicle.horimetro || 0); // Unificado
                        
                    // Busca a leitura inicial registrada no histórico de alocação
                    const startReading = isKm 
                        ? parseFloat(hist.details?.odometroEntrada || 0) 
                        : parseFloat(hist.details?.horimetroEntrada || 0);
                    
                    if (currentReading > startReading) {
                        const diff = currentReading - startReading;
                        if (obra.contractType === 'prancha' && isKm) {
                            totalExecutadoKmPrancha += diff;
                        } else if (!isKm) {
                            totalExecutadoHoras += diff;
                        }
                    }
                }
            }
        });

        if (obra.contractType !== 'prancha') {
            totalExecutadoHoras += parseFloat(obra.horasAdicionaisCaminhao || 0);
        }

        // 2. CÁLCULO FATURADO (Baseado nos logs diários de trabalho)
        let faturado = parseFloat(obra.totalHorasRealizadas) || 0;

        // Se o totalHorasRealizadas estiver zerado, tenta calcular somando os apontamentos diários
        if (faturado === 0 && dailyWorkLogs && dailyWorkLogs.length > 0) {
            let safeLogs = [];
            // Tratamento robusto para diferentes formatos de retorno da API
            if (Array.isArray(dailyWorkLogs)) safeLogs = dailyWorkLogs;
            else if (dailyWorkLogs.data && Array.isArray(dailyWorkLogs.data)) safeLogs = dailyWorkLogs.data;

            const targetObraId = String(obra.id).trim();
            const logsDestaObra = safeLogs.filter(log => {
                const logObraId = log.obraId || log.obra_id; 
                return logObraId && String(logObraId).trim() === targetObraId;
            });
            
            const calculatedFromLogs = logsDestaObra.reduce((sum, log) => {
                const val = parseFloat(log.totalHours !== undefined ? log.totalHours : log.total_hours);
                return sum + (isNaN(val) ? 0 : val);
            }, 0);

            if (calculatedFromLogs > 0) faturado = calculatedFromLogs;
        }

        // 3. CÁLCULO CONTRATADO
        const type = obra.contractType || 'horas';
        let contratado = 0;
        let unit = 'hrs';

        if (type === 'horas') {
            let horasObj = obra.horasContratadasPorTipo;
            if (typeof horasObj === 'string') {
                try { horasObj = JSON.parse(horasObj); } catch (e) { horasObj = {}; }
            } else if (!horasObj) { horasObj = {}; }
            contratado = Object.values(horasObj).reduce((a, b) => a + (parseFloat(b)||0), 0);
        } else if (type === 'prancha') {
            contratado = parseFloat(obra.kmContratadoPrancha || 0);
            unit = 'km';
        } else {
            const sectorsList = typeof obra.sectors === 'string' ? JSON.parse(obra.sectors || '[]') : (obra.sectors || []);
            contratado = sectorsList.reduce((acc, sec) => acc + (parseFloat(sec.totalArea) || 0), 0);
            unit = 'm²';
        }

        return {
            nome: formatObraNome(obra),
            real: type === 'prancha' ? totalExecutadoKmPrancha : totalExecutadoHoras,
            faturado: faturado,
            contratado: contratado,
            unit: unit,
            totalHorasRealizadas: obra.totalHorasRealizadas 
        };
    }, [selectedObraId, activeObras, vehicles, dailyWorkLogs]);

    const ProgressBar = ({ value, max, color }) => {
        const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
        return (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }}></div>
            </div>
        );
    };

    return (
        <div className="bg-white p-4 rounded-xl h-full flex flex-col" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)' }}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14' }}>
                    <HardHat size={16} style={{ color: '#9E7A42' }}/> Progresso da Obra
                </h3>
                <SearchableObraSelect
                    obras={activeObras}
                    value={selectedObraId}
                    onChange={(obra) => setSelectedObraId(obra?.id || '')}
                    placeholder="Buscar obra..."
                    className="max-w-[200px]"
                />
            </div>

            {obraData ? (
                <div className="flex-1 flex flex-col justify-center space-y-6">
                    <div>
                        <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                            <span className="flex items-center gap-1"><Clock size={12}/> Execução Real (Máquinas)</span>
                            <span>{obraData.contratado > 0 ? ((obraData.real / obraData.contratado)*100).toFixed(1) : 0}%</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                            <span>{obraData.real.toFixed(1)} {obraData.unit}</span>
                            <span>Meta: {obraData.contratado.toFixed(1)} {obraData.unit}</span>
                        </div>
                        <ProgressBar value={obraData.real} max={obraData.contratado} color="bg-blue-600" />
                    </div>

                    <div>
                        {obraData.unit === 'hrs' ? (
                            <div>
                                <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                                    <span className="flex items-center gap-1"><DollarSign size={12}/> Faturamento vs Contrato</span>
                                    <span>{obraData.contratado > 0 ? ((obraData.faturado / obraData.contratado)*100).toFixed(1) : 0}%</span>
                                </div>
                                <ProgressBar value={obraData.faturado} max={obraData.contratado} color="bg-green-500" />
                                <p className="text-[9px] text-gray-400 mt-1 italic text-right">
                                    Fonte: {obraData.faturado === parseFloat(obraData.totalHorasRealizadas) ? 'Cadastro da Obra' : 'Soma de Logs Diários'}
                                </p>
                            </div>
                        ) : (
                            <div className="text-center p-2 bg-gray-50 rounded border border-dashed text-[10px] text-gray-400">
                                Comparativo de Faturamento disponível apenas para contratos por Hora.
                            </div>
                        )}
                    </div>

                    <TerceirizadoObraResumo obraId={selectedObraId} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm italic">
                    <HardHat size={32} className="mb-2 opacity-20"/>
                    <p className="mt-2">Selecione uma obra ativa para ver a análise.</p>
                </div>
            )}
        </div>
    );
};

export default ObraProgressBI;