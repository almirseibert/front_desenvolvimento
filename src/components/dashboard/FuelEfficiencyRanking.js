import React, { useState, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { getAllowedReadingTypes } from '../../utils/vehicleRules';

const FuelEfficiencyRanking = ({ vehicles = [], refuelings = [] }) => {
    const [filterType, setFilterType] = useState('todos');

    const types = useMemo(() => {
        const uniqueTypes = [...new Set(vehicles.map(v => v.tipo))].sort();
        return ['todos', ...uniqueTypes];
    }, [vehicles]);

    const rankingData = useMemo(() => {
        if (!vehicles.length || !refuelings.length) return { best: [], worst: [] };

        const stats = vehicles.map(vehicle => {
            const allowedTypes = getAllowedReadingTypes(vehicle.tipo);
            const isKm = allowedTypes.includes('odometro');
            const unit = isKm ? 'Km/L' : 'L/Hr';

            // Pega apenas abastecimentos concluídos deste veículo
            const history = refuelings
                .filter(r => r.vehicleId === vehicle.id && r.status === 'Concluída')
                .sort((a,b) => new Date(a.date) - new Date(b.date)); // Ordena do mais antigo para o mais novo

            if (history.length < 2) return null;

            // Soma litros (ignorando o primeiro abastecimento do intervalo, pois ele é o marco zero da leitura)
            const totalLiters = history.slice(1).reduce((acc, r) => acc + (parseFloat(r.litrosAbastecidos) || 0), 0);
            
            let startReading = 0, endReading = 0;
            
            // CORREÇÃO UNIFICADA: Usa apenas 'odometro' ou 'horimetro'
            if (isKm) {
                const first = history[0];
                const last = history[history.length - 1];
                startReading = parseFloat(first.odometro || 0);
                endReading = parseFloat(last.odometro || 0);
            } else {
                const first = history[0];
                const last = history[history.length - 1];
                // Regra Unificada: usa apenas vehicle.horimetro no banco
                startReading = parseFloat(first.horimetro || 0);
                endReading = parseFloat(last.horimetro || 0);
            }

            const diff = endReading - startReading;
            if (diff <= 0 || totalLiters <= 0) return null;

            let average = 0;
            if (isKm) {
                average = diff / totalLiters; // Km por Litro (Maior = Melhor)
            } else {
                average = totalLiters / diff; // Litros por Hora (Menor = Melhor)
            }

            return {
                id: vehicle.id,
                code: vehicle.registroInterno,
                model: vehicle.modelo,
                type: vehicle.tipo,
                average,
                unit,
                isKm 
            };
        }).filter(Boolean);

        const filteredStats = filterType === 'todos' ? stats : stats.filter(s => s.type === filterType);

        const sorted = [...filteredStats].sort((a, b) => {
            if (a.unit !== b.unit) return a.unit.localeCompare(b.unit);
            // Se for Km/L, maior é melhor. Se for L/Hr, menor é melhor.
            if (a.isKm) return b.average - a.average; 
            return a.average - b.average; 
        });

        return {
            best: sorted.slice(0, 5),
            worst: sorted.reverse().slice(0, 5)
        };
    }, [vehicles, refuelings, filterType]);

    const ListItem = ({ item, rank, isBest }) => (
        <div className="flex justify-between items-center p-1.5 bg-gray-50 rounded border border-gray-100 text-xs hover:bg-gray-100 transition">
            <div className="flex items-center gap-2">
                <span className={`font-bold w-4 h-4 flex items-center justify-center rounded-full text-[10px] ${isBest ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {rank}
                </span>
                <div>
                    <p className="font-bold text-gray-800">{item.code}</p>
                    <p className="text-[10px] text-gray-500 truncate w-20">{item.model}</p>
                </div>
            </div>
            <div className="text-right">
                <p className={`font-bold ${isBest ? 'text-green-600' : 'text-red-600'}`}>
                    {item.average.toFixed(2)} <span className="text-[9px] text-gray-400 font-normal">{item.unit}</span>
                </p>
            </div>
        </div>
    );

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Activity size={18} className="text-purple-600"/> Eficiência
                </h3>
                <div className="relative">
                    <Filter size={12} className="absolute left-2 top-2 text-gray-400"/>
                    <select 
                        value={filterType} 
                        onChange={(e) => setFilterType(e.target.value)} 
                        className="text-xs pl-6 pr-2 py-1 border rounded bg-gray-50 max-w-[120px]"
                    >
                        <option value="todos">Todos</option>
                        {types.filter(t => t !== 'todos').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="bg-green-50/30 p-2 rounded-lg border border-green-100 flex flex-col">
                    <h4 className="text-[10px] font-bold text-green-700 uppercase mb-2 flex items-center gap-1 shrink-0">
                        <TrendingUp size={12}/> Mais Econômicos
                    </h4>
                    <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
                        {rankingData.best.length > 0 ? rankingData.best.map((item, idx) => (
                            <ListItem key={item.id} item={item} rank={idx+1} isBest={true} />
                        )) : <p className="text-[10px] text-gray-400 italic text-center py-4">Sem dados</p>}
                    </div>
                </div>

                <div className="bg-red-50/30 p-2 rounded-lg border border-red-100 flex flex-col">
                    <h4 className="text-[10px] font-bold text-red-700 uppercase mb-2 flex items-center gap-1 shrink-0">
                        <TrendingDown size={12}/> Maior Consumo
                    </h4>
                    <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
                         {rankingData.worst.length > 0 ? rankingData.worst.map((item, idx) => (
                            <ListItem key={item.id} item={item} rank={idx+1} isBest={false} />
                        )) : <p className="text-[10px] text-gray-400 italic text-center py-4">Sem dados</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FuelEfficiencyRanking;