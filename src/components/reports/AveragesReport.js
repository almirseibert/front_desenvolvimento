import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Activity, Printer } from 'lucide-react';
import { SectionHeader, FilterSection } from './ReportComponents';
import { getGroupUnit, getReadingSourceForUnit, computeConsumption } from '../../utils/vehicleRules';
import { formatObraNome } from '../../utils/obraFormat';
import SearchableObraSelect from '../SearchableObraSelect';

// Helper para ordenação alfanumérica
const sortAlphaNum = (a, b) => (a || '').toString().localeCompare((b || '').toString(), 'pt-BR', { numeric: true, sensitivity: 'base' });

const AveragesReport = ({ vehicles = [], obras = [], refuelings = [], vehicleGroups = {} }) => {
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        vehicleIds: [],
        obraId: '',
        groupId: ''
    });

    const handleVehicleSelection = (e) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        setFilters(prev => ({ ...prev, vehicleIds: selectedOptions }));
    };

    const filteredVehiclesList = useMemo(() => {
        let list = [...vehicles];
        if (filters.groupId) {
            list = list.filter(v => v.grupo === filters.groupId);
        }
        return list.sort((a, b) => sortAlphaNum(a.registroInterno || a.placa, b.registroInterno || b.placa));
    }, [vehicles, filters.groupId]);

    const reportData = useMemo(() => {
        if (!refuelings || refuelings.length === 0) return [];

        let filteredRefuelings = [...refuelings];

        if (filters.startDate) {
            const start = new Date(filters.startDate).setHours(0, 0, 0, 0);
            filteredRefuelings = filteredRefuelings.filter(r => new Date(r.data || r.dataAbastecimento).getTime() >= start);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate).setHours(23, 59, 59, 999);
            filteredRefuelings = filteredRefuelings.filter(r => new Date(r.data || r.dataAbastecimento).getTime() <= end);
        }
        if (filters.obraId) {
            filteredRefuelings = filteredRefuelings.filter(r => (r.obraId || r.obraAtual) === filters.obraId);
        }
        if (filters.vehicleIds.length > 0) {
            filteredRefuelings = filteredRefuelings.filter(r => filters.vehicleIds.includes(r.vehicleId || r.veiculoId));
        }

        const grouped = {};

        filteredRefuelings.forEach(r => {
            const vId = r.vehicleId || r.veiculoId;
            if (!vId) return;
            if (!grouped[vId]) {
                const vehicleObj = vehicles.find(v => v.id === vId) || {};
                const unit = getGroupUnit(vehicleObj.tipo);
                const isKm = getReadingSourceForUnit(unit) === 'odometro';

                grouped[vId] = {
                    vehicleId: vId,
                    placa: vehicleObj.placa || 'N/A',
                    nome: vehicleObj.nome || 'Desconhecido',
                    grupo: vehicleObj.grupo || vehicleObj.tipo || 'N/A',
                    obraAtual: vehicleObj.obraAtual || 'N/A',
                    isKm: isKm,
                    consumoUnit: unit,
                    totalLiters: 0,
                    leituras: []
                };
            }

            // Campos reais da tabela refuelings: litrosAbastecidos, odometro, horimetro
            grouped[vId].totalLiters += parseFloat(r.litrosAbastecidos || r.quantidade || 0);

            const leituraAtual = parseFloat(grouped[vId].isKm
                ? (r.odometro || r.odometroAtual)
                : (r.horimetro || r.horimetroAtual));
            if (!isNaN(leituraAtual) && leituraAtual > 0) {
                grouped[vId].leituras.push(leituraAtual);
            }
        });

        return Object.values(grouped).map(item => {
            let totalUsage = 0;
            let average = 0;

            if (item.leituras.length > 1) {
                const min = Math.min(...item.leituras);
                const max = Math.max(...item.leituras);
                totalUsage = max - min;
            } else if (item.leituras.length === 1) {
               const ref = filteredRefuelings.find(r => (r.vehicleId || r.veiculoId) === item.vehicleId);
               const anterior = parseFloat(item.isKm
                   ? (ref?.odometroAnterior || 0)
                   : (ref?.horimetroAnterior || 0));
               if (anterior > 0) totalUsage = item.leituras[0] - anterior;
            }

            if (totalUsage > 0 && item.totalLiters > 0) {
                average = computeConsumption(item.consumoUnit, totalUsage, item.totalLiters) || 0;
            }

            return {
                ...item,
                totalUsage,
                average: average.toFixed(2),
                unit: item.isKm ? 'Km' : 'Hr',
                avgUnit: item.consumoUnit
            };
        }).sort((a, b) => sortAlphaNum(a.placa, b.placa));

    }, [refuelings, filters, vehicles]);

    const totalLitersGlobal = reportData.reduce((acc, curr) => acc + curr.totalLiters, 0);

    const handleGeneratePDF = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(16);
        doc.text('Relatório de Consumo e Médias - Frotas MAK', 14, 15);
        doc.setFontSize(10);
        doc.text(`Período: ${filters.startDate ? new Date(filters.startDate).toLocaleDateString('pt-BR') : 'Início'} até ${filters.endDate ? new Date(filters.endDate).toLocaleDateString('pt-BR') : 'Hoje'}`, 14, 22);
        
        const obraNome = filters.obraId ? (formatObraNome(obras.find(o => o.id === filters.obraId)) || 'Todas') : 'Todas as Obras';
        doc.text(`Obra: ${obraNome}`, 14, 27);
        doc.text(`Total Litros Consumidos (Filtro): ${totalLitersGlobal.toFixed(2)} L`, 14, 32);

        const tableColumn = ["Placa/Nome", "Tipo", "Obra Atual", "Unidade", "Total Consumido (L)", "Uso Total (Km/Hr)", "Média"];
        const tableRows = reportData.map(item => [
            `${item.placa} - ${item.nome}`,
            item.grupo,
            item.obraAtual,
            item.unit,
            item.totalLiters.toFixed(2),
            item.totalUsage > 0 ? item.totalUsage.toFixed(2) : 'N/A',
            item.average > 0 ? `${item.average} ${item.avgUnit}` : 'N/A'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`Medias_Consumo_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div>
            <SectionHeader icon={Activity} title="Relatório de Médias e Consumo" description="Análise de Km/L e L/Hr por equipamento e obra." />
            
            <FilterSection>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Data Inicial</label>
                    <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full p-2 border rounded bg-white text-sm" />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Data Final</label>
                    <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full p-2 border rounded bg-white text-sm" />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Filtrar por Obra</label>
                    <SearchableObraSelect
                        obras={[...obras].sort((a, b) => sortAlphaNum(a.nome, b.nome))}
                        value={filters.obraId}
                        onChange={(obra) => setFilters({...filters, obraId: obra?.id || ''})}
                        placeholder="Todas as Obras"
                        includeInactive={true}
                    />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Tipo de Equipamento</label>
                    <select value={filters.groupId} onChange={e => setFilters({...filters, groupId: e.target.value, vehicleIds: []})} className="w-full p-2 border rounded bg-white text-sm">
                        <option value="">Todos os Tipos</option>
                        {Object.keys(vehicleGroups).sort(sortAlphaNum).map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>
            </FilterSection>

            <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2 flex items-center gap-2">
                    Selecione Equipamentos Específicos (Segure Ctrl para múltiplos)
                </label>
                <select 
                    multiple 
                    value={filters.vehicleIds} 
                    onChange={handleVehicleSelection} 
                    className="w-full h-32 p-2 border rounded bg-white text-sm custom-scrollbar focus:ring-2 focus:ring-teal-500"
                >
                    {filteredVehiclesList.map(v => {
                        const grupoOuSubgrupo = v.sub_tipo || v.tipo || v.grupo || '';
                        const partes = [v.registroInterno, v.placa, grupoOuSubgrupo, v.modelo].filter(Boolean);
                        return (
                            <option key={v.id} value={v.id}>{partes.join(' - ')}</option>
                        );
                    })}
                </select>
                <p className="text-xs text-gray-400 mt-1">Se nenhum for selecionado, todos os visíveis no filtro serão considerados.</p>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-teal-50 rounded-lg border border-teal-100 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-teal-600 uppercase mb-1">Total de Equipamentos</span>
                    <span className="text-2xl font-black text-teal-800">{reportData.length}</span>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-blue-600 uppercase mb-1">Litros Consumidos (Total)</span>
                    <span className="text-2xl font-black text-blue-800">{totalLitersGlobal.toFixed(2)} L</span>
                </div>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden mb-4">
                <div className="overflow-x-auto custom-scrollbar max-h-[400px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 font-bold text-gray-600">Placa / Nome</th>
                                <th className="p-3 font-bold text-gray-600">Tipo</th>
                                <th className="p-3 font-bold text-gray-600">Obra Atual</th>
                                <th className="p-3 font-bold text-gray-600 text-right">Consumo (L)</th>
                                <th className="p-3 font-bold text-gray-600 text-right">Uso Total (Km/Hr)</th>
                                <th className="p-3 font-bold text-gray-600 text-center">Média</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reportData.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Nenhum registro de abastecimento encontrado.</td></tr>
                            ) : (
                                reportData.map(item => (
                                    <tr key={item.vehicleId} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium text-gray-800">{item.placa} - {item.nome}</td>
                                        <td className="p-3 text-gray-600">{item.grupo}</td>
                                        <td className="p-3 text-gray-600 max-w-[150px] truncate" title={item.obraAtual}>{item.obraAtual}</td>
                                        <td className="p-3 text-right font-medium">{item.totalLiters.toFixed(2)}</td>
                                        <td className="p-3 text-right text-gray-600">{item.totalUsage > 0 ? item.totalUsage.toFixed(2) : '-'} {item.unit}</td>
                                        <td className="p-3 text-center">
                                            {item.average > 0 ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-bold">
                                                    {item.average} {item.avgUnit}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">Sem dados suficientes</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <button onClick={handleGeneratePDF} disabled={reportData.length === 0} className="btn-primary w-full md:w-auto bg-teal-600 hover:bg-teal-700 flex items-center justify-center gap-2">
                <Printer size={18}/> Exportar Relatório PDF
            </button>
        </div>
    );
};

export default AveragesReport;