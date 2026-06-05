import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Fuel, Download, Filter } from 'lucide-react';
import { SectionHeader, FilterSection } from './ReportComponents';

const fmt = (n) => n != null ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fmtL = (n) => n != null ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L' : '-';
const fmtR = (n) => n != null ? 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

const FUEL_TYPES = ['Todos', 'Diesel S10', 'Diesel S500', 'Gasolina', 'Etanol', 'Arla 32'];

const FuelConsumptionReport = ({ obras = [], vehicles = [], refuelings = [], expenses = [] }) => {
    const [filterObraId, setFilterObraId] = useState('');
    const [filterFuelType, setFilterFuelType] = useState('Todos');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const obraOptions = useMemo(() =>
        [...obras].filter(o => o.tipo_registro !== 'centro_custo').sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
        [obras]
    );

    const reportData = useMemo(() => {
        const dateFrom = filterDateFrom ? new Date(filterDateFrom + 'T00:00:00') : null;
        const dateTo = filterDateTo ? new Date(filterDateTo + 'T23:59:59') : null;

        // Filtrar abastecimentos concluídos
        const filtered = refuelings.filter(r => {
            if (r.status !== 'Concluída') return false;
            if (filterObraId && r.obraId !== filterObraId) return false;
            if (filterFuelType !== 'Todos' && r.fuelType !== filterFuelType) return false;
            const d = new Date(r.data || r.date || r.created_at);
            if (dateFrom && d < dateFrom) return false;
            if (dateTo && d > dateTo) return false;
            return true;
        });

        // Agrupar por obra
        const byObra = {};
        filtered.forEach(r => {
            const obraId = r.obraId || '__sem_obra__';
            if (!byObra[obraId]) {
                const obra = obras.find(o => o.id === obraId);
                byObra[obraId] = {
                    obraId,
                    obraNome: obra?.nome || (obraId === '__sem_obra__' ? 'Sem obra vinculada' : 'Obra não encontrada'),
                    byFuel: {},
                    totalLitros: 0,
                    totalValor: 0,
                    qtdOrdens: 0,
                };
            }
            const litros = parseFloat(r.litrosAbastecidos || r.liters || 0);
            const valor = (litros * parseFloat(r.pricePerLiter || r.price || 0)) + parseFloat(r.outrosValor || 0);
            const fuel = r.fuelType || 'Não especificado';
            if (!byObra[obraId].byFuel[fuel]) byObra[obraId].byFuel[fuel] = { litros: 0, valor: 0, ordens: 0 };
            byObra[obraId].byFuel[fuel].litros += litros;
            byObra[obraId].byFuel[fuel].valor += valor;
            byObra[obraId].byFuel[fuel].ordens += 1;
            byObra[obraId].totalLitros += litros;
            byObra[obraId].totalValor += valor;
            byObra[obraId].qtdOrdens += 1;
        });

        return Object.values(byObra).sort((a, b) => a.obraNome.localeCompare(b.obraNome));
    }, [refuelings, obras, filterObraId, filterFuelType, filterDateFrom, filterDateTo]);

    const totals = useMemo(() => ({
        litros: reportData.reduce((s, r) => s + r.totalLitros, 0),
        valor: reportData.reduce((s, r) => s + r.totalValor, 0),
        ordens: reportData.reduce((s, r) => s + r.qtdOrdens, 0),
    }), [reportData]);

    const handleGeneratePDF = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Relatório de Consumo de Combustível por Obra', 14, 18);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        let subtitle = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
        if (filterDateFrom || filterDateTo) subtitle += ` | Período: ${filterDateFrom || '...'} a ${filterDateTo || '...'}`;
        if (filterFuelType !== 'Todos') subtitle += ` | Combustível: ${filterFuelType}`;
        doc.text(subtitle, 14, 26);

        const rows = [];
        reportData.forEach(obra => {
            Object.entries(obra.byFuel).forEach(([fuel, data], idx) => {
                rows.push([
                    idx === 0 ? obra.obraNome : '',
                    fuel,
                    data.ordens,
                    fmtL(data.litros),
                    fmtR(data.valor),
                ]);
            });
            if (Object.keys(obra.byFuel).length > 1) {
                rows.push([
                    { content: 'TOTAL ' + obra.obraNome, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [245,245,220] } },
                    { content: obra.qtdOrdens, styles: { fontStyle: 'bold', fillColor: [245,245,220] } },
                    { content: fmtL(obra.totalLitros), styles: { fontStyle: 'bold', fillColor: [245,245,220] } },
                    { content: fmtR(obra.totalValor), styles: { fontStyle: 'bold', fillColor: [245,245,220] } },
                ]);
            }
        });

        autoTable(doc, {
            startY: 32,
            head: [['Obra', 'Tipo Combustível', 'Ordens', 'Total Litros', 'Total R$']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [30, 26, 20], fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 80 }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        });

        const finalY = doc.lastAutoTable?.finalY || 32 + rows.length * 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`TOTAL GERAL: ${totals.ordens} ordens | ${fmtL(totals.litros)} | ${fmtR(totals.valor)}`, 14, finalY + 10);

        doc.save(`consumo_obra_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div>
            <SectionHeader
                icon={Fuel}
                title="Consumo de Combustível por Obra"
                description="Consolidado de litros e valores de combustível agrupados por obra."
            />

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 bg-gray-50 p-4 rounded-lg border">
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Obra</label>
                    <select value={filterObraId} onChange={e => setFilterObraId(e.target.value)} className="p-2 border rounded w-full text-sm bg-white">
                        <option value="">Todas as Obras</option>
                        {obraOptions.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de Combustível</label>
                    <select value={filterFuelType} onChange={e => setFilterFuelType(e.target.value)} className="p-2 border rounded w-full text-sm bg-white">
                        {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data De</label>
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="p-2 border rounded w-full text-sm bg-white" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data Até</label>
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="p-2 border rounded w-full text-sm bg-white" />
                </div>
            </div>

            {/* Totalizador */}
            {reportData.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-600 font-bold uppercase">Ordens</p>
                        <p className="text-2xl font-bold text-blue-800">{totals.ordens}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-bold uppercase">Total Litros</p>
                        <p className="text-2xl font-bold text-green-800">{fmtL(totals.litros)}</p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                        <p className="text-xs text-yellow-700 font-bold uppercase">Total Valor</p>
                        <p className="text-2xl font-bold text-yellow-800">{fmtR(totals.valor)}</p>
                    </div>
                </div>
            )}

            {/* Tabela */}
            <div className="overflow-x-auto rounded-lg border mb-6">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="p-3 text-left">Obra</th>
                            <th className="p-3 text-left">Combustível</th>
                            <th className="p-3 text-center">Ordens</th>
                            <th className="p-3 text-right">Litros</th>
                            <th className="p-3 text-right">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Nenhum dado encontrado para os filtros selecionados.</td></tr>
                        ) : (
                            reportData.map((obra, obraIdx) => (
                                Object.entries(obra.byFuel).map(([fuel, data], fuelIdx) => (
                                    <tr key={`${obra.obraId}-${fuel}`} className={obraIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        {fuelIdx === 0 && (
                                            <td className="p-3 font-semibold" rowSpan={Object.keys(obra.byFuel).length}>
                                                {obra.obraNome}
                                                <div className="text-xs text-gray-400">{obra.qtdOrdens} ordens</div>
                                            </td>
                                        )}
                                        <td className="p-3 text-gray-700">{fuel}</td>
                                        <td className="p-3 text-center">{data.ordens}</td>
                                        <td className="p-3 text-right font-mono">{fmtL(data.litros)}</td>
                                        <td className="p-3 text-right font-mono">{fmtR(data.valor)}</td>
                                    </tr>
                                ))
                            ))
                        )}
                    </tbody>
                    {reportData.length > 0 && (
                        <tfoot>
                            <tr className="bg-gray-800 text-white font-bold">
                                <td colSpan={2} className="p-3">TOTAL GERAL</td>
                                <td className="p-3 text-center">{totals.ordens}</td>
                                <td className="p-3 text-right font-mono">{fmtL(totals.litros)}</td>
                                <td className="p-3 text-right font-mono">{fmtR(totals.valor)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            <button
                onClick={handleGeneratePDF}
                disabled={reportData.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <Download size={16} /> Exportar PDF
            </button>
        </div>
    );
};

export default FuelConsumptionReport;
