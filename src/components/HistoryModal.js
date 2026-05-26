import React, { useMemo, useState, useEffect } from 'react';
import { X, Loader, MapPin, Wrench, FileText, AlertTriangle, User, ArrowRight, Disc } from 'lucide-react';

const HistoryModal = ({ vehicle, onClose, obras = [], apiClient, employees = [] }) => {
    
    const [fetchedHistory, setFetchedHistory] = useState(null);
    const [loading, setLoading] = useState(false);

    // Busca histórico completo
    useEffect(() => {
        const loadHistory = async () => {
            if (vehicle && (!vehicle.history || vehicle.history.length === 0) && apiClient) {
                setLoading(true);
                try {
                    const fullVehicleData = await apiClient.getVehicleById(vehicle.id);
                    if (fullVehicleData && fullVehicleData.history) {
                        setFetchedHistory(fullVehicleData.history);
                    }
                } catch (error) {
                    console.error("Erro ao carregar histórico:", error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadHistory();
    }, [vehicle, apiClient]);

    const historySource = fetchedHistory || vehicle?.history || [];

    // --- LÓGICA DE UNIFICAÇÃO E DESDUPLICAÇÃO ---
    const history = useMemo(() => {
        if (!Array.isArray(historySource)) return [];

        // 1. Normalização dos dados de diferentes tabelas
        const normalized = historySource.map(item => {
            const details = item.details || {};
            // Tenta capturar leituras de colunas específicas de 'obras_historico_veiculos'
            const leituraEntrada = details.odometroEntrada || details.horimetroEntrada || details.odometroInicial || details.horimetroInicial || details.leituraEntrada;
            const leituraSaida = details.odometroSaida || details.horimetroSaida || details.odometroFinal || details.horimetroFinal || details.leituraSaida;
            
            return {
                ...item,
                timestamp: new Date(item.startDate).getTime(),
                leituraEntradaRaw: parseFloat(leituraEntrada || 0),
                leituraSaidaRaw: parseFloat(leituraSaida || 0),
                leituraDisplay: { entrada: leituraEntrada, saida: leituraSaida },
                normalizedType: (item.historyType || item.type || '').toLowerCase()
            };
        });

        // 2. Ordenação por data decrescente
        normalized.sort((a, b) => b.timestamp - a.timestamp);

        // 3. Desduplicação Inteligente
        // Agrupa eventos muito próximos (mesmo dia/hora e mesmo tipo)
        const uniqueHistory = [];
        
        for (let i = 0; i < normalized.length; i++) {
            const current = normalized[i];
            const next = normalized[i + 1];

            // Verifica se o próximo item é uma duplicata do atual
            // Critério: Mesma data (tolerância de 5 min) e mesmo tipo
            if (next) {
                const timeDiff = Math.abs(current.timestamp - next.timestamp);
                const sameType = current.normalizedType === next.normalizedType || 
                                 (current.normalizedType === 'obra' && next.normalizedType === 'allocation');

                if (timeDiff < 5 * 60 * 1000 && sameType) {
                    // DUPLICATA DETECTADA: Mantém o que tiver mais dados (ex: leitura de saída preenchida ou observações)
                    const currentHasData = current.leituraDisplay.saida || current.details?.observacoes;
                    const nextHasData = next.leituraDisplay.saida || next.details?.observacoes;

                    if (nextHasData && !currentHasData) {
                        continue; // Pula o atual, vai pegar o próximo na iteração
                    }
                    // Senão, mantém o atual e avança o índice principal para pular o próximo no loop
                    uniqueHistory.push(current);
                    i++; 
                    continue;
                }
            }
            uniqueHistory.push(current);
        }

        return uniqueHistory;
    }, [historySource]);

    const renderHistoryDetail = (h) => {
        const details = h.details || {};
        const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR') : 'N/A';
        const startDate = formatDate(h.startDate);
        const endDate = h.endDate ? formatDate(h.endDate) : 'Atual';

        // Helper para exibir leitura
        const displayReading = (val, type) => {
             if (!val) return type === 'saida' ? (h.endDate ? 'N/A' : 'Em uso') : 'N/A';
             return val;
        };

        const leituraEntrada = displayReading(h.leituraDisplay?.entrada, 'entrada');
        const leituraSaida = displayReading(h.leituraDisplay?.saida, 'saida');

        switch(h.normalizedType) { 
            case 'obra':
            case 'allocation': // Caso venha com nome diferente do backend
                 const obraNome = details.obraNome || (obras.find(o => o.id === details.obraId)?.nome) || 'Obra Desconhecida';
                 const employeeName = details.employeeName || (employees.find(e => e.id === details.employeeId)?.nome) || 'Não informado';
                
                return (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-800 flex items-center gap-1"><MapPin size={12}/> Alocação em Obra</span>
                            <span className="text-[10px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full">{startDate} - {endDate}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <p className="text-gray-700 break-words" title={obraNome}>Obra: <strong>{obraNome}</strong></p>
                            <p className="text-gray-600 flex items-center gap-1 break-words" title={employeeName}><User size={10} className="shrink-0" /> {employeeName}</p>
                        </div>
                        
                        <div className="flex items-center gap-2 text-[11px] text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100 mt-0.5">
                            <span className="font-medium text-gray-500">Leituras:</span>
                            <span>{leituraEntrada}</span>
                            <ArrowRight size={10} className="text-gray-400" />
                            <span className={leituraSaida === 'Em uso' ? 'text-green-600 font-bold' : ''}>{leituraSaida}</span>
                        </div>
                        
                        {details.observacoes && (
                            <p className="text-[10px] text-gray-500 italic mt-0.5 border-l-2 border-green-200 pl-1.5 break-words">
                                "{details.observacoes}"
                            </p>
                        )}
                    </div>
                );
            case 'operacional':
                return (
                    <div className="flex flex-col gap-1">
                         <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-800 flex items-center gap-1"><FileText size={12}/> Operacional</span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{startDate} - {endDate}</span>
                        </div>
                        <p className="text-xs text-gray-600">Grupo: {details.subGroup}</p>
                        {details.observacoes && (
                             <p className="text-[10px] text-gray-500 italic break-words">Obs: {details.observacoes}</p>
                        )}
                    </div>
                );
            case 'manutencao':
                 return (
                    <div className="flex flex-col gap-1">
                         <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-800 flex items-center gap-1"><Wrench size={12}/> Manutenção</span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{startDate} - {endDate}</span>
                        </div>
                        <p className="text-xs text-gray-600">{details.status} - {details.location}</p>
                    </div>
                );
             case 'pneu': // Suporte a tire_transactions
                 return (
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-orange-700 flex items-center gap-1"><Disc size={12}/> Pneus</span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{startDate}</span>
                        </div>
                        <p className="text-xs text-gray-600">{details.acao} - Posição: {details.posicao}</p>
                        <p className="text-[10px] text-gray-500">Modelo: {details.modeloPneu}</p>
                    </div>
                 );
             case 'multa':
                 return (
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-red-700 flex items-center gap-1"><AlertTriangle size={12}/> Multa</span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{startDate}</span>
                        </div>
                        <p className="text-xs text-gray-600">R$ {details.valor} ({details.status})</p>
                    </div>
                 );
            default:
                return (
                    <div>
                        <span className="font-bold text-gray-700 capitalize text-xs">{h.historyType || h.type}</span>
                        <span className="block text-[10px] text-gray-400">{startDate}</span>
                    </div>
                );
        }
    };

    const getHistoryStyle = (type) => {
        switch(type) {
            case 'obra': 
            case 'allocation': return 'bg-green-50 border-l-2 border-green-500 hover:bg-green-100 transition-colors';
            case 'operacional': return 'bg-blue-50 border-l-2 border-blue-500 hover:bg-blue-100 transition-colors';
            case 'manutencao': return 'bg-yellow-50 border-l-2 border-yellow-500 hover:bg-yellow-100 transition-colors';
            case 'multa': return 'bg-red-50 border-l-2 border-red-500 hover:bg-red-100 transition-colors';
            case 'pneu': return 'bg-orange-50 border-l-2 border-orange-500 hover:bg-orange-100 transition-colors';
            default: return 'bg-gray-50 border-l-2 border-gray-300';
        }
    };

    if (!vehicle) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            {/* O modal foi ajustado de max-w-md para max-w-3xl para dar mais largura horizontal */}
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-scale-in">
                <div className="p-3 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div>
                        <h3 className="text-base font-bold text-gray-800">Histórico de Eventos</h3>
                        <p className="text-[10px] text-gray-500 font-mono">{vehicle.registroInterno} • {vehicle.placa}</p>
                    </div>
                     <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 transition"><X size={16}/></button>
                </div>
                
                <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-20 text-xs">
                            <Loader className="animate-spin text-yellow-500 mb-2" size={20} />
                            <span className="text-gray-500">A procurar histórico completo...</span>
                        </div>
                    ) : history.length > 0 ? (
                        <ul className="space-y-2">
                            {history.map((h, index) => (
                                <li key={h.id || index} className={`p-2.5 rounded-md shadow-sm border border-transparent ${getHistoryStyle(h.normalizedType)}`}>
                                    {renderHistoryDetail(h)}
                                </li>
                             ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-center text-sm py-4">Nenhum histórico encontrado.</p>
                    )}
                </div>
                
                <div className="p-3 bg-gray-50 border-t flex justify-end rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold text-gray-700 transition">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default HistoryModal;