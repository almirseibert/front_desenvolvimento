import React, { useState, useMemo } from 'react';
import { Truck, Calendar, DollarSign, Droplet, Clock, Wallet, Building2, PlusCircle, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useData, useEnsureResources } from '../contexts/DataContext';
import ProtectedComponent from '../components/ProtectedComponent';
import TerceirizadoPagamentoModal from '../components/modals/TerceirizadoPagamentoModal';
import {
    computeTerceirizadoPorVeiculo,
    computeTerceirizadoPorLocador,
    isVehicleTerceirizado,
} from '../utils/terceirizados';

const fmtBRL = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtH = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' h';
const fmtL = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L';

// Presets de período (retornam { inicio, fim } em 'YYYY-MM-DD')
const isoDay = (d) => d.toISOString().split('T')[0];
const buildPreset = (preset) => {
    const now = new Date();
    if (preset === 'mesAtual') {
        return { inicio: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)),
                 fim: isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    if (preset === 'mesPassado') {
        return { inicio: isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
                 fim: isoDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
    }
    if (preset === '3meses') {
        return { inicio: isoDay(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
                 fim: isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    return { inicio: '', fim: '' }; // 'tudo'
};

const KpiCard = ({ icon: Icon, label, value, tone = 'gray' }) => {
    const tones = {
        gray:   { bg: '#f8fafc', text: '#334155', icon: '#64748b' },
        purple: { bg: '#faf5ff', text: '#6b21a8', icon: '#a855f7' },
        blue:   { bg: '#eff6ff', text: '#1e40af', icon: '#3b82f6' },
        green:  { bg: '#f0fdf4', text: '#166534', icon: '#22c55e' },
        red:    { bg: '#fef2f2', text: '#991b1b', icon: '#ef4444' },
    };
    const t = tones[tone] || tones.gray;
    return (
        <div className="rounded-xl border border-gray-100 p-4" style={{ background: t.bg }}>
            <div className="flex items-center gap-2 mb-1">
                {Icon && <Icon size={15} style={{ color: t.icon }} />}
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.text }}>{label}</span>
            </div>
            <div className="text-lg font-extrabold" style={{ color: t.text }}>{value}</div>
        </div>
    );
};

const TerceirizadosPage = ({ user, apiClient, setAlertMessage }) => {
    useEnsureResources(['dailyWorkLogs', 'refuelings', 'comboioTransactions', 'terceirizadoPagamentos']);
    const {
        vehicles = [], partners = [],
        dailyWorkLogs = [], refuelings = [], comboioTransactions = [],
        terceirizadoPagamentos = [], refresh,
    } = useData();

    const [activeTab, setActiveTab] = useState('visao');
    const [presetKey, setPresetKey] = useState('mesAtual');
    const [period, setPeriod] = useState(() => buildPreset('mesAtual'));
    const [selectedLocadorId, setSelectedLocadorId] = useState('');
    const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);

    const reloadPagamentos = () => refresh?.('terceirizadoPagamentos');

    const applyPreset = (key) => {
        setPresetKey(key);
        setPeriod(buildPreset(key));
    };
    const setPeriodField = (field, value) => {
        setPresetKey('custom');
        setPeriod((p) => ({ ...p, [field]: value }));
    };

    const ctx = useMemo(() => ({
        dailyWorkLogs, refuelings, comboioTransactions, partners, pagamentos: terceirizadoPagamentos,
    }), [dailyWorkLogs, refuelings, comboioTransactions, partners, terceirizadoPagamentos]);

    const locadores = useMemo(
        () => partners.filter((p) => p.tipo_parceiro === 'locador'),
        [partners]
    );

    const terceirizados = useMemo(
        () => vehicles.filter(isVehicleTerceirizado),
        [vehicles]
    );

    // Visão Geral: agregado por locador (+ grupo "Sem locador")
    const resumoPorLocador = useMemo(() => {
        const grupos = locadores.map((l) => ({
            locador: l,
            ...computeTerceirizadoPorLocador(l.id, vehicles, ctx, period),
        }));

        // Equipamentos terceirizados sem locadorId vinculado
        const semLocadorVeiculos = terceirizados.filter((v) => !v.locadorId);
        if (semLocadorVeiculos.length > 0) {
            const equipamentos = semLocadorVeiculos.map((vehicle) => ({
                vehicle,
                ...computeTerceirizadoPorVeiculo(vehicle, ctx, period),
            }));
            const tot = equipamentos.reduce((a, e) => ({
                horas: a.horas + e.horas, devido: a.devido + e.devido,
                litros: a.litros + e.litros, combustivelAbatido: a.combustivelAbatido + e.combustivelAbatido,
                pagamentos: a.pagamentos + e.pagamentos, saldo: a.saldo + e.saldo,
            }), { horas: 0, devido: 0, litros: 0, combustivelAbatido: 0, pagamentos: 0, saldo: 0 });
            grupos.push({ locador: { id: '__none__', razaoSocial: 'Sem locador vinculado' }, equipamentos, ...tot });
        }
        return grupos.filter((g) => g.equipamentos.length > 0);
    }, [locadores, terceirizados, vehicles, ctx, period]);

    const totaisGerais = useMemo(() =>
        resumoPorLocador.reduce((a, g) => ({
            devido: a.devido + g.devido,
            combustivelAbatido: a.combustivelAbatido + g.combustivelAbatido,
            pagamentos: a.pagamentos + g.pagamentos,
            saldo: a.saldo + g.saldo,
        }), { devido: 0, combustivelAbatido: 0, pagamentos: 0, saldo: 0 }),
        [resumoPorLocador]);

    // Conta Corrente: por equipamento do locador selecionado
    const contaCorrente = useMemo(() => {
        if (!selectedLocadorId) return null;
        if (selectedLocadorId === '__none__') {
            const equipamentos = terceirizados
                .filter((v) => !v.locadorId)
                .map((vehicle) => ({ vehicle, ...computeTerceirizadoPorVeiculo(vehicle, ctx, period) }));
            return { equipamentos };
        }
        return computeTerceirizadoPorLocador(selectedLocadorId, vehicles, ctx, period);
    }, [selectedLocadorId, terceirizados, vehicles, ctx, period]);

    const selectedLocador = useMemo(() => {
        if (selectedLocadorId === '__none__') return { id: '__none__', razaoSocial: 'Sem locador vinculado' };
        return locadores.find((l) => l.id === selectedLocadorId) || null;
    }, [selectedLocadorId, locadores]);

    const periodoLabel = period.inicio || period.fim
        ? `${period.inicio || '…'} a ${period.fim || '…'}`
        : 'Todo o histórico';

    const PRESETS = [
        { key: 'mesAtual', label: 'Mês atual' },
        { key: 'mesPassado', label: 'Mês passado' },
        { key: '3meses', label: 'Últimos 3 meses' },
        { key: 'tudo', label: 'Tudo' },
    ];

    const exportExtratoPDF = () => {
        if (!contaCorrente || contaCorrente.equipamentos.length === 0) return;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Extrato de Terceirizado', 14, 16);
        doc.setFontSize(10);
        doc.text(`Locador: ${selectedLocador?.razaoSocial || '-'}`, 14, 23);
        doc.text(`Período: ${periodoLabel}`, 14, 28);
        const body = contaCorrente.equipamentos.map((e) => [
            `${e.vehicle.registroInterno || e.vehicle.placa} - ${e.vehicle.tipo}`,
            fmtH(e.horas), fmtBRL(e.tarifaHora), fmtBRL(e.devido),
            fmtL(e.litros), fmtBRL(e.combustivelAbatido), fmtBRL(e.pagamentos), fmtBRL(e.saldo),
        ]);
        const tot = contaCorrente.equipamentos.reduce((a, e) => ({
            horas: a.horas + e.horas, devido: a.devido + e.devido, litros: a.litros + e.litros,
            comb: a.comb + e.combustivelAbatido, pag: a.pag + e.pagamentos, saldo: a.saldo + e.saldo,
        }), { horas: 0, devido: 0, litros: 0, comb: 0, pag: 0, saldo: 0 });
        autoTable(doc, {
            startY: 33,
            head: [['Equipamento', 'Horas', 'Tarifa/h', 'Devido', 'Litros', 'Combustível', 'Pagamentos', 'Saldo']],
            body,
            foot: [['Total', fmtH(tot.horas), '', fmtBRL(tot.devido), fmtL(tot.litros), fmtBRL(tot.comb), fmtBRL(tot.pag), fmtBRL(tot.saldo)]],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [168, 85, 247] },
            footStyles: { fillColor: [243, 232, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
        });
        doc.save(`Extrato_Terceirizado_${(selectedLocador?.razaoSocial || 'locador').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14' }} className="mb-1 flex items-center gap-2">
                <Truck className="text-purple-500" /> Terceirizados
            </h1>
            <p className="text-sm text-gray-500 mb-6">
                Gestão de equipamentos locados: horas apuradas no Faturamento, combustível fornecido abatido e saldo a pagar por locador.
            </p>

            {/* Filtro de período */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-600 uppercase">Período</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {PRESETS.map((p) => (
                            <button key={p.key} onClick={() => applyPreset(p.key)}
                                className={`px-3 py-1.5 text-xs rounded-full border transition font-medium ${
                                    presetKey === p.key
                                        ? 'bg-purple-50 border-purple-200 text-purple-800'
                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-end gap-2 ml-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Início</label>
                            <input type="date" value={period.inicio} onChange={(e) => setPeriodField('inicio', e.target.value)}
                                className="p-2 border rounded-lg text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fim</label>
                            <input type="date" value={period.fim} onChange={(e) => setPeriodField('fim', e.target.value)}
                                className="p-2 border rounded-lg text-sm bg-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Totais gerais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <KpiCard icon={DollarSign} tone="purple" label="Devido (bruto)" value={fmtBRL(totaisGerais.devido)} />
                <KpiCard icon={Droplet} tone="blue" label="Combustível abatido" value={fmtBRL(totaisGerais.combustivelAbatido)} />
                <KpiCard icon={Wallet} tone="gray" label="Pagamentos" value={fmtBRL(totaisGerais.pagamentos)} />
                <KpiCard icon={DollarSign} tone={totaisGerais.saldo > 0 ? 'red' : 'green'} label="Saldo a pagar" value={fmtBRL(totaisGerais.saldo)} />
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-200 mb-4 bg-white rounded-t-lg pt-2 px-2 shadow-sm">
                <button onClick={() => setActiveTab('visao')}
                    className={`py-3 px-4 font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'visao' ? 'border-b-2 border-purple-500 text-purple-700 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Building2 size={16} /> Visão Geral
                </button>
                <button onClick={() => setActiveTab('conta')}
                    className={`py-3 px-4 font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'conta' ? 'border-b-2 border-purple-500 text-purple-700 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Wallet size={16} /> Conta Corrente
                </button>
            </div>

            {/* VISÃO GERAL */}
            {activeTab === 'visao' && (
                <div className="space-y-4">
                    {resumoPorLocador.length === 0 && (
                        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400 text-sm">
                            Nenhum equipamento terceirizado com movimentação no período ({periodoLabel}).
                        </div>
                    )}
                    {resumoPorLocador.map((g) => (
                        <div key={g.locador.id} className="bg-white rounded-lg shadow p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Truck size={16} className="text-purple-500" />
                                    <span className="font-bold text-gray-800">{g.locador.razaoSocial}</span>
                                    <span className="text-xs text-gray-400">({g.equipamentos.length} equip.)</span>
                                </div>
                                {g.locador.id !== '__none__' && (
                                    <button onClick={() => { setSelectedLocadorId(g.locador.id); setActiveTab('conta'); }}
                                        className="text-xs font-semibold text-purple-600 hover:underline">
                                        Ver conta corrente →
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <KpiCard icon={Clock} label="Horas" value={fmtH(g.horas)} />
                                <KpiCard icon={DollarSign} tone="purple" label="Devido" value={fmtBRL(g.devido)} />
                                <KpiCard icon={Droplet} tone="blue" label="Combustível" value={fmtBRL(g.combustivelAbatido)} />
                                <KpiCard icon={Wallet} label="Pagamentos" value={fmtBRL(g.pagamentos)} />
                                <KpiCard icon={DollarSign} tone={g.saldo > 0 ? 'red' : 'green'} label="Saldo" value={fmtBRL(g.saldo)} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CONTA CORRENTE */}
            {activeTab === 'conta' && (
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <label className="text-xs font-bold text-gray-600 uppercase">Locador</label>
                        <select value={selectedLocadorId} onChange={(e) => setSelectedLocadorId(e.target.value)}
                            className="p-2 border rounded-lg text-sm bg-white min-w-[240px]">
                            <option value="">— Selecionar locador —</option>
                            {locadores.map((l) => <option key={l.id} value={l.id}>{l.razaoSocial}</option>)}
                            {terceirizados.some((v) => !v.locadorId) && <option value="__none__">Sem locador vinculado</option>}
                        </select>
                        <span className="text-xs text-gray-400">Período: {periodoLabel}</span>
                        <div className="ml-auto flex items-center gap-2">
                            {contaCorrente && contaCorrente.equipamentos.length > 0 && (
                                <button onClick={exportExtratoPDF}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                                    <FileDown size={15} /> Extrato PDF
                                </button>
                            )}
                            {selectedLocador && selectedLocador.id !== '__none__' && (
                                <ProtectedComponent requiredPermission="editor">
                                    <button onClick={() => setPagamentoModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                                        <PlusCircle size={15} /> Registrar Pagamento
                                    </button>
                                </ProtectedComponent>
                            )}
                        </div>
                    </div>

                    {!contaCorrente && (
                        <div className="p-8 text-center text-gray-400 text-sm">Selecione um locador para ver a conta corrente.</div>
                    )}

                    {contaCorrente && contaCorrente.equipamentos.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">Nenhum equipamento locado deste locador com movimentação no período.</div>
                    )}

                    {contaCorrente && contaCorrente.equipamentos.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase text-gray-500 border-b">
                                        <th className="p-2">Equipamento</th>
                                        <th className="p-2 text-right">Horas</th>
                                        <th className="p-2 text-right">Tarifa/h</th>
                                        <th className="p-2 text-right">Devido</th>
                                        <th className="p-2 text-right">Litros</th>
                                        <th className="p-2 text-right">Combustível</th>
                                        <th className="p-2 text-right">Pagamentos</th>
                                        <th className="p-2 text-right">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contaCorrente.equipamentos.map((e) => (
                                        <tr key={e.vehicle.id} className="border-b hover:bg-gray-50">
                                            <td className="p-2">
                                                <span className="font-bold text-gray-800">{e.vehicle.registroInterno || e.vehicle.placa}</span>
                                                <span className="text-gray-400 text-xs"> · {e.vehicle.tipo}{e.vehicle.modelo ? ` ${e.vehicle.modelo}` : ''}</span>
                                            </td>
                                            <td className="p-2 text-right">{fmtH(e.horas)}</td>
                                            <td className="p-2 text-right">{fmtBRL(e.tarifaHora)}</td>
                                            <td className="p-2 text-right font-semibold text-purple-700">{fmtBRL(e.devido)}</td>
                                            <td className="p-2 text-right">{fmtL(e.litros)}</td>
                                            <td className="p-2 text-right text-blue-700">{fmtBRL(e.combustivelAbatido)}</td>
                                            <td className="p-2 text-right">{fmtBRL(e.pagamentos)}</td>
                                            <td className={`p-2 text-right font-bold ${e.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtBRL(e.saldo)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 font-bold text-gray-800">
                                        <td className="p-2">Total</td>
                                        <td className="p-2 text-right">{fmtH(contaCorrente.equipamentos.reduce((a, e) => a + e.horas, 0))}</td>
                                        <td className="p-2"></td>
                                        <td className="p-2 text-right text-purple-700">{fmtBRL(contaCorrente.equipamentos.reduce((a, e) => a + e.devido, 0))}</td>
                                        <td className="p-2 text-right">{fmtL(contaCorrente.equipamentos.reduce((a, e) => a + e.litros, 0))}</td>
                                        <td className="p-2 text-right text-blue-700">{fmtBRL(contaCorrente.equipamentos.reduce((a, e) => a + e.combustivelAbatido, 0))}</td>
                                        <td className="p-2 text-right">{fmtBRL(contaCorrente.equipamentos.reduce((a, e) => a + e.pagamentos, 0))}</td>
                                        <td className="p-2 text-right">{fmtBRL(contaCorrente.equipamentos.reduce((a, e) => a + e.saldo, 0))}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <p className="text-[11px] text-gray-400 mt-3">
                                Horas apuradas em Faturamento &amp; Controle. Combustível valorado pelo preço real de cada abastecimento (fallback: tabela do posto parceiro). Saldo = devido − combustível − pagamentos.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {pagamentoModalOpen && selectedLocador && selectedLocador.id !== '__none__' && (
                <TerceirizadoPagamentoModal
                    locador={selectedLocador}
                    equipamentos={(contaCorrente?.equipamentos || []).map((e) => e.vehicle)}
                    user={user}
                    apiClient={apiClient}
                    setAlertMessage={setAlertMessage}
                    onClose={() => setPagamentoModalOpen(false)}
                    onSaved={reloadPagamentos}
                />
            )}
        </div>
    );
};

export default TerceirizadosPage;
