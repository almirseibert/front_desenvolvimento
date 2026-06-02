import React, { useState, useEffect } from 'react';
import { ArrowLeft, Truck, Filter, Calendar } from 'lucide-react';
import apiClient from '../services/apiClient';

const AllocationForecastPage = ({ onBack }) => {
    const [allocations, setAllocations] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filtros
    const [filterObra, setFilterObra] = useState('');
    const [filterTipo, setFilterTipo] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const data = await apiClient.get('/supervisor/allocations');
                setAllocations(data);
                setFiltered(data);
            } catch (error) {
                console.error("Erro:", error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        let res = allocations;
        if (filterObra) res = res.filter(a => a.obra_atual.toLowerCase().includes(filterObra.toLowerCase()));
        if (filterTipo) res = res.filter(a => a.tipo.toLowerCase().includes(filterTipo.toLowerCase()));
        setFiltered(res);
    }, [filterObra, filterTipo, allocations]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    return (
        <div className="bg-slate-100 min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={20} className="text-slate-600"/>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Previsão de Desmobilização Global</h1>
                        <p className="text-xs text-slate-500">Listagem de todos os equipamentos alocados e suas datas estimadas de saída</p>
                    </div>
                </div>

                {/* Filtros */}
                <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase">Filtrar por Obra</label>
                        <input 
                            type="text" 
                            className="w-full border rounded p-2 text-sm mt-1" 
                            placeholder="Nome da obra..."
                            value={filterObra}
                            onChange={e => setFilterObra(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase">Filtrar por Tipo</label>
                        <input 
                            type="text" 
                            className="w-full border rounded p-2 text-sm mt-1" 
                            placeholder="Escavadeira, Caminhão..."
                            value={filterTipo}
                            onChange={e => setFilterTipo(e.target.value)}
                        />
                    </div>
                    <div className="text-slate-400 p-2">
                        <Filter size={20} />
                    </div>
                </div>

                {/* Tabela */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">Equipamento</th>
                                    <th className="px-6 py-4">Obra Atual</th>
                                    <th className="px-6 py-4">Grupo</th>
                                    <th className="px-6 py-4">Previsão Saída</th>
                                    <th className="px-6 py-4">Próximo Destino</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">Carregando...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">Nenhum equipamento encontrado.</td></tr>
                                ) : filtered.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{item.modelo}</div>
                                            <div className="text-xs text-slate-500">{item.placa}</div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-blue-600">{item.obra_atual}</td>
                                        <td className="px-6 py-4 text-slate-600">{item.tipo}</td>
                                        <td className="px-6 py-4">
                                            <div className={`flex items-center gap-2 ${item.is_manual ? 'text-blue-600 font-bold' : 'text-slate-600'}`}>
                                                <Calendar size={14} />
                                                {formatDate(item.previsao_liberacao)}
                                                {item.is_manual && <span className="text-[10px] bg-blue-100 px-1 rounded">Manual</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 flex items-center gap-2">
                                            <Truck size={14} />
                                            {item.proximo_destino}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AllocationForecastPage;