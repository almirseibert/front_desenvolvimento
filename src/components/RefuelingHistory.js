import React, { useMemo, useState } from 'react';
import { Download, Printer, Droplet, Loader, Filter, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getGroupUnit, getReadingSourceForUnit, computeConsumption } from '../utils/vehicleRules';

const RefuelingHistory = ({ 
    vehicleId, 
    refuelings = [], 
    vehicles = [], 
    vehicleGroups = {}, 
    partners = [],
    employees = [],
    onGeneratePDF
}) => {
    
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Estados para Filtro de Período
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // --- HELPER: Validação de Data ---
    const isValidDbDate = (dateString) => {
        if (!dateString) return false;
        const str = String(dateString);
        return str.length > 5 && !str.startsWith('0000') && str !== '1970-01-01T00:00:00.000Z';
    };

    const formatDateSafe = (dateInput) => {
        if (!isValidDbDate(dateInput)) return 'N/A';
        try {
            let dateStr = String(dateInput);
            if (dateStr.includes(' ') && !dateStr.includes('T')) dateStr = dateStr.replace(' ', 'T');
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Data Inválida';
            return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).toLocaleDateString('pt-BR');
        } catch { return 'Erro'; }
    };

    const getSafeDateObj = (dateInput) => {
        if (!isValidDbDate(dateInput)) return new Date(0);
        try {
            let dateStr = String(dateInput);
            if (dateStr.includes(' ') && !dateStr.includes('T')) dateStr = dateStr.replace(' ', 'T');
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? new Date(0) : d;
        } catch { return new Date(0); }
    };

    // --- LÓGICA CENTRAL DE PROCESSAMENTO ---
    const processedData = useMemo(() => {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (!vehicle || !Array.isArray(refuelings)) {
            return { filteredHistory: [], overallAverage: null, unit: 'N/A', readingLabel: 'Leitura', totalLitrosPeriodo: 0, totalPercorridoPeriodo: 0 };
        }

        // 1. Determina Unidade (conforme configuração do grupo) e leitura usada
        const unit = getGroupUnit(vehicle.tipo);                 // 'L/h' | 'h/L' | 'Km/L' | 'L/Km'
        const readingSource = getReadingSourceForUnit(unit);     // 'odometro' | 'horimetro'
        const readingLabel = readingSource === 'odometro' ? 'Odômetro' : 'Horímetro';

        // 2. Ordena Histórico Completo (Decrescente)
        const sortedFullHistory = refuelings
            .filter(r => r.vehicleId === vehicleId && r.status === 'Concluída')
            .sort((a,b) => getSafeDateObj(b.data || b.date).getTime() - getSafeDateObj(a.data || a.date).getTime());

        // 3. Calcula Médias Individuais no Histórico Completo
        const fullHistoryCalculated = sortedFullHistory.map((current, index) => {
            const previous = sortedFullHistory[index + 1]; 
            
            let average = null;
            let diff = 0;
            
            const getReading = (item) => parseFloat((readingSource === 'horimetro' ? item.horimetro : item.odometro) || 0);

            const displayReading = (readingSource === 'horimetro' ? current.horimetro : current.odometro) || '-';
            const displayPartner = current.partnerName || partners.find(p => p.id === current.partnerId)?.razaoSocial || 'N/A';

            if (previous) {
                const currentVal = getReading(current);
                const previousVal = getReading(previous);
                diff = currentVal - previousVal;
                const liters = parseFloat(current.litrosAbastecidos || 0);

                if (diff > 0 && liters > 0) {
                    average = computeConsumption(unit, diff, liters);
                }
            }

            return { ...current, average, diff, displayReading, readingLabel, displayPartner, rawDate: getSafeDateObj(current.data || current.date) };
        });

        // 4. Aplica Filtro de Data
        let filteredHistory = fullHistoryCalculated;

        if (startDate) {
            const start = new Date(`${startDate}T00:00:00`);
            filteredHistory = filteredHistory.filter(h => h.rawDate >= start);
        }
        if (endDate) {
            const end = new Date(`${endDate}T23:59:59`);
            filteredHistory = filteredHistory.filter(h => h.rawDate <= end);
        }

        // 5. Calcula Média Geral do Período Filtrado
        let overallAverage = null;
        let totalLitrosPeriodo = 0;
        let totalPercorridoPeriodo = 0;

        if (filteredHistory.length > 0) {
            totalPercorridoPeriodo = filteredHistory.reduce((acc, curr) => acc + (curr.diff || 0), 0);
            totalLitrosPeriodo = filteredHistory.reduce((acc, curr) => acc + (parseFloat(curr.litrosAbastecidos) || 0), 0);

            if (totalPercorridoPeriodo > 0 && totalLitrosPeriodo > 0) {
                overallAverage = computeConsumption(unit, totalPercorridoPeriodo, totalLitrosPeriodo);
            }
        }

        return { filteredHistory, overallAverage, unit, readingLabel, totalLitrosPeriodo, totalPercorridoPeriodo };
    }, [vehicleId, refuelings, vehicles, vehicleGroups, partners, startDate, endDate]);

    // --- PDF ---
    const generateHistoryPDF = () => {
        setIsGeneratingPdf(true);
        try {
            const vehicle = vehicles.find(v => v.id === vehicleId);
            if (!vehicle) {
                alert("Veículo não identificado.");
                setIsGeneratingPdf(false);
                return;
            }

            // Instancia jsPDF diretamente (sem loadScript)
            const doc = new jsPDF();

            // Cabeçalho
            doc.setFontSize(16);
            doc.text(`Histórico de Consumo - ${vehicle.registroInterno}`, 14, 20);
            doc.setFontSize(10);
            doc.text(`Veículo: ${vehicle.modelo} - Placa: ${vehicle.placa}`, 14, 26);
            
            // Subtítulo com Período
            let periodText = "Período: Completo";
            if (startDate || endDate) {
                const s = startDate ? new Date(startDate).toLocaleDateString('pt-BR') : 'Início';
                const e = endDate ? new Date(endDate).toLocaleDateString('pt-BR') : 'Hoje';
                periodText = `Período: ${s} até ${e}`;
            }
            doc.text(periodText, 14, 32);

            // Resumo do Período
            doc.setFontSize(10);
            doc.setFillColor(240, 248, 255); // Azul claro background
            doc.rect(14, 38, 180, 18, 'F');
            doc.setFont(undefined, 'bold');
            doc.text(`Resumo do Período:`, 16, 44);
            doc.setFont(undefined, 'normal');
            
            const resumoX = 16;
            const resumoY = 50;
            const gap = 45;
            
            doc.text(`Total Abastecido: ${processedData.totalLitrosPeriodo.toFixed(2)} L`, resumoX, resumoY);
            doc.text(`Total Percorrido: ${processedData.totalPercorridoPeriodo.toFixed(1)} ${getReadingSourceForUnit(processedData.unit) === 'horimetro' ? 'Hr' : 'Km'}`, resumoX + gap, resumoY);
            doc.text(`Média Geral: ${processedData.overallAverage ? processedData.overallAverage.toFixed(2) : '--'} ${processedData.unit}`, resumoX + (gap * 2), resumoY);

            // Tabela
            autoTable(doc, {
                startY: 60,
                head: [['Data', 'Posto', processedData.readingLabel, 'Litros', `Média (${processedData.unit})`]],
                body: processedData.filteredHistory.map(h => [
                    formatDateSafe(h.data || h.date),
                    h.displayPartner,
                    h.displayReading,
                    (h.litrosAbastecidos || 0).toFixed(2),
                    h.average ? h.average.toFixed(2) : '-'
                ]),
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
            });

            doc.save(`Historico_${vehicle.registroInterno}_${startDate || 'Inicio'}_${endDate || 'Fim'}.pdf`);
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Erro ao gerar PDF: " + error.message);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (!vehicleId) return (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400">
            <Droplet size={40} className="mb-2 opacity-50"/>
            <p>Selecione um veículo para visualizar a análise de consumo.</p>
        </div>
    );

    return (
        <div className="animate-fadeIn space-y-4">
            {/* BARRA DE FILTRO E RESUMO */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                    
                    {/* Filtros */}
                    <div className="flex items-center gap-2 w-full md:w-auto bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 text-gray-600 font-bold text-xs uppercase mr-2">
                            <Filter size={14}/> Filtro:
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">De</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)}
                                className="p-1 border rounded text-xs focus:ring-1 focus:ring-blue-400 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Até</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)}
                                className="p-1 border rounded text-xs focus:ring-1 focus:ring-blue-400 outline-none"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button 
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="ml-1 p-1 text-red-500 hover:bg-red-50 rounded"
                                title="Limpar Filtro"
                            >
                                <X size={14}/>
                            </button>
                        )}
                    </div>

                    {/* Botão PDF */}
                    <button 
                        onClick={generateHistoryPDF} 
                        disabled={isGeneratingPdf}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100 font-bold text-xs shadow-sm transition disabled:opacity-50"
                    >
                        {isGeneratingPdf ? <Loader className="animate-spin" size={14}/> : <Download size={14}/>} 
                        {startDate || endDate ? 'PDF (Período)' : 'PDF (Completo)'}
                    </button>
                </div>

                {/* Resumo/Cards */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Média do Período</span>
                        <div className="text-xl font-bold text-blue-600">
                            {processedData.overallAverage ? processedData.overallAverage.toFixed(2) : '--'}
                            <span className="text-xs text-blue-400 ml-1">{processedData.unit}</span>
                        </div>
                    </div>
                    <div className="text-center border-l border-r border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Total Abastecido</span>
                        <div className="text-xl font-bold text-gray-700">
                            {processedData.totalLitrosPeriodo.toFixed(0)}
                            <span className="text-xs text-gray-400 ml-1">Litros</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Percorrido/Trabalhado</span>
                        <div className="text-xl font-bold text-gray-700">
                            {processedData.totalPercorridoPeriodo.toFixed(0)}
                            <span className="text-xs text-gray-400 ml-1">{getReadingSourceForUnit(processedData.unit) === 'horimetro' ? 'Horas' : 'Km'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABELA */}
            <div className="overflow-hidden border rounded-lg shadow-sm">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-600 font-bold text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="p-3">Data</th>
                                <th className="p-3">Posto</th>
                                <th className="p-3 text-right">{processedData.readingLabel}</th>
                                <th className="p-3 text-right">Litros</th>
                                <th className="p-3 text-right">Média</th>
                                <th className="p-3 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {processedData.filteredHistory.length > 0 ? (
                                processedData.filteredHistory.map(h => (
                                    <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3 whitespace-nowrap">{formatDateSafe(h.data || h.date)}</td>
                                        <td className="p-3 truncate max-w-[140px]" title={h.displayPartner}>{h.displayPartner}</td>
                                        <td className="p-3 text-right font-mono text-gray-600">{h.displayReading}</td>
                                        <td className="p-3 text-right font-bold">{h.litrosAbastecidos?.toFixed(2)}</td>
                                        <td className={`p-3 text-right font-bold ${!h.average ? 'text-gray-300' : 'text-blue-600'}`}>
                                            {h.average?.toFixed(2) || '-'}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => onGeneratePDF(h, vehicles, partners, employees, vehicleGroups)} 
                                                className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition"
                                                title="Reimprimir 2ª Via"
                                            >
                                                <Printer size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-400 italic">
                                        Nenhum registro encontrado para este período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RefuelingHistory;