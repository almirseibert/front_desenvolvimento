import React, { useState, useMemo } from 'react';
import { Loader, Search, Printer, ArrowDownCircle, ArrowUpCircle, Droplet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiClient from '../../services/apiClient';
import { formatObraNome } from '../../utils/obraFormat';

const FUEL_OPTIONS = ['', 'Diesel S10', 'Diesel S500', 'Diesel Comum', 'Arla', 'Gasolina', 'Etanol'];

const fmtL = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L';
const fmtDate = (d) => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const ComboioVolumeReport = ({ vehicles = [], obras = [] }) => {
    const comboios = useMemo(
        () => vehicles.filter(v => v.isComboioVehicle).sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')),
        [vehicles]
    );

    const today = new Date().toISOString().slice(0, 10);
    const firstOfMonth = today.slice(0, 8) + '01';

    const [comboioId, setComboioId] = useState('');
    const [from, setFrom] = useState(firstOfMonth);
    const [to, setTo] = useState(today);
    const [fuelType, setFuelType] = useState('');
    const [obraId, setObraId] = useState('');
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState(null);
    const [result, setResult] = useState(null);

    const gerar = async () => {
        if (!comboioId) { setErro('Selecione um comboio.'); return; }
        setErro(null);
        setLoading(true);
        setResult(null);
        try {
            const params = { comboioVehicleId: comboioId, from, to };
            if (fuelType) params.fuelType = fuelType;
            if (obraId) params.obraId = obraId;
            const data = await apiClient.getComboioReport(params);
            setResult(data);
        } catch (e) {
            setErro(e.message || 'Falha ao gerar relatório.');
        } finally {
            setLoading(false);
        }
    };

    const comboioNome = useMemo(() => {
        const c = comboios.find(v => v.id === comboioId);
        return c ? `${c.registroInterno || c.placa}${c.modelo ? ' — ' + c.modelo : ''}` : '';
    }, [comboioId, comboios]);

    const exportarPDF = () => {
        if (!result) return;
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text('Relatório de Volume — Comboio', 14, 16);
        doc.setFontSize(10);
        doc.text(`Comboio: ${comboioNome}`, 14, 24);
        doc.text(`Período: ${from.split('-').reverse().join('/')} a ${to.split('-').reverse().join('/')}`, 14, 30);
        if (fuelType) doc.text(`Combustível: ${fuelType}`, 14, 36);

        autoTable(doc, {
            startY: 42,
            head: [['Indicador', 'Litragem']],
            body: [
                ['Saldo inicial (na data inicial)', fmtL(result.saldoInicial)],
                ['Entradas no período', fmtL(result.totalEntradas)],
                ['Saídas no período', fmtL(result.totalSaidas)],
                ['Saldo final (até a data final)', fmtL(result.saldoFinal)],
            ],
        });

        if (result.porObra?.length) {
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 8,
                head: [['Obra abastecida', 'Litros', 'Qtd']],
                body: result.porObra.map(o => [o.obraName || '—', fmtL(o.litros), o.qtd]),
            });
        }
        doc.save(`comboio_volume_${comboioNome || 'relatorio'}.pdf`);
    };

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Droplet size={20} className="text-cyan-600" /> Volume de Combustível — Comboio</h2>
                <p className="text-sm text-gray-500">Entradas e saídas do tanque do comboio, com saldo inicial e final no período.</p>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-lg border">
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Comboio *</label>
                    <select value={comboioId} onChange={e => setComboioId(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                        <option value="">Selecione…</option>
                        {comboios.map(c => <option key={c.id} value={c.id}>{c.registroInterno || c.placa} {c.modelo ? `— ${c.modelo}` : ''}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Data inicial *</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full p-2 border rounded text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Data final *</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full p-2 border rounded text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de combustível</label>
                    <select value={fuelType} onChange={e => setFuelType(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                        {FUEL_OPTIONS.map(f => <option key={f} value={f}>{f || 'Todos'}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Obra abastecida (saídas)</label>
                    <select value={obraId} onChange={e => setObraId(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                        <option value="">Todas</option>
                        {obras.map(o => <option key={o.id} value={o.id}>{formatObraNome(o)}</option>)}
                    </select>
                </div>
                <div className="flex items-end">
                    <button onClick={gerar} disabled={loading} className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                        {loading ? <Loader className="animate-spin" size={16} /> : <Search size={16} />} Gerar
                    </button>
                </div>
            </div>

            {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{erro}</div>}

            {result && (
                <div className="space-y-4">
                    {/* Cards de saldo */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white border rounded-lg p-3">
                            <p className="text-[11px] text-gray-500 uppercase font-bold">Saldo inicial</p>
                            <p className="text-lg font-bold text-gray-800">{fmtL(result.saldoInicial)}</p>
                            <p className="text-[10px] text-gray-400">em {from.split('-').reverse().join('/')}</p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-[11px] text-green-700 uppercase font-bold flex items-center gap-1"><ArrowDownCircle size={12} /> Entradas</p>
                            <p className="text-lg font-bold text-green-700">{fmtL(result.totalEntradas)}</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-[11px] text-red-700 uppercase font-bold flex items-center gap-1"><ArrowUpCircle size={12} /> Saídas</p>
                            <p className="text-lg font-bold text-red-700">{fmtL(result.totalSaidas)}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-[11px] text-blue-700 uppercase font-bold">Saldo final</p>
                            <p className="text-lg font-bold text-blue-700">{fmtL(result.saldoFinal)}</p>
                            <p className="text-[10px] text-gray-400">em {to.split('-').reverse().join('/')}</p>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={exportarPDF} className="px-3 py-1.5 bg-gray-800 text-white rounded text-sm font-bold flex items-center gap-2 hover:bg-gray-700">
                            <Printer size={14} /> Exportar PDF
                        </button>
                    </div>

                    {/* Por obra */}
                    {result.porObra?.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-2">Saídas por obra abastecida</h3>
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                                        <tr><th className="px-4 py-2 text-left">Obra</th><th className="px-4 py-2 text-right">Litros</th><th className="px-4 py-2 text-right">Qtd</th></tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {result.porObra.map((o, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-4 py-2">{o.obraName || '—'}</td>
                                                <td className="px-4 py-2 text-right font-medium">{fmtL(o.litros)}</td>
                                                <td className="px-4 py-2 text-right text-gray-500">{o.qtd}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Transações */}
                    {result.transacoes?.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-2">Movimentações no período ({result.transacoes.length})</h3>
                            <div className="overflow-x-auto rounded-lg border max-h-96 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase text-gray-600 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Data</th>
                                            <th className="px-3 py-2 text-left">Tipo</th>
                                            <th className="px-3 py-2 text-left">Combustível</th>
                                            <th className="px-3 py-2 text-left">Destino / Origem</th>
                                            <th className="px-3 py-2 text-right">Litros</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {result.transacoes.map(t => (
                                            <tr key={t.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(t.date)}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${t.type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {t.type === 'entrada' ? 'Entrada' : 'Saída'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-gray-600">{t.fuelType || '—'}</td>
                                                <td className="px-3 py-2 text-gray-600 max-w-xs truncate">
                                                    {t.type === 'entrada' ? (t.partnerName || '—') : (t.receivingVehicleName || t.obraName || '—')}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium">{fmtL(t.liters)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ComboioVolumeReport;
