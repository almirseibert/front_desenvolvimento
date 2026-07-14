import React, { useState, useMemo } from 'react';
import {
    Truck, DollarSign, Droplet, Wallet, Building2, PlusCircle, FileText,
    Pencil, Trash2, ChevronDown, ChevronRight, Clock, Loader, FileDown, AlertTriangle,
} from 'lucide-react';
import { useData, useEnsureResources } from '../contexts/DataContext';
import ProtectedComponent from '../components/ProtectedComponent';
import TerceirizadoPagamentoModal from '../components/modals/TerceirizadoPagamentoModal';
import ContratoTerceiroModal from '../components/modals/ContratoTerceiroModal';
import { computeContratosPorTerceiro } from '../utils/terceirizados';

const fmtBRL = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtH = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' h';
const fmtL = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L';

// Origem do backend p/ abrir PDFs estáticos (/uploads/...), sem o sufixo /api.
const FILE_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

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

const StatusBadge = ({ status }) => {
    const map = {
        ativo:     { t: 'Ativo', c: 'bg-green-50 text-green-700 border-green-200' },
        concluido: { t: 'Concluído', c: 'bg-gray-100 text-gray-600 border-gray-200' },
        cancelado: { t: 'Cancelado', c: 'bg-red-50 text-red-700 border-red-200' },
    };
    const s = map[status] || map.ativo;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.c}`}>{s.t}</span>;
};

// Barra de progresso físico (horas executadas / contratadas)
const ProgressBar = ({ ratio }) => {
    const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
    return (
        <div className="w-full">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

const TerceirizadosPage = ({ user, apiClient, setAlertMessage }) => {
    useEnsureResources(['dailyWorkLogs', 'refuelings', 'comboioTransactions', 'terceirizadoPagamentos', 'terceiroContratos']);
    const {
        vehicles = [], obras = [], partners = [],
        dailyWorkLogs = [], refuelings = [], comboioTransactions = [],
        terceirizadoPagamentos = [], terceiroContratos = [], refresh,
    } = useData();

    const [expandedTerceiros, setExpandedTerceiros] = useState({});
    const [expandedContratos, setExpandedContratos] = useState({});
    const [contratoModal, setContratoModal] = useState(null);   // { contrato } | { contrato: null } (novo)
    const [pagamentoModal, setPagamentoModal] = useState(null); // { contrato, locador }
    const [confirmDelete, setConfirmDelete] = useState(null);   // contrato
    const [pdfLoadingId, setPdfLoadingId] = useState(null);

    const reload = () => { refresh?.('terceiroContratos'); refresh?.('terceirizadoPagamentos'); };

    const ctx = useMemo(() => ({
        vehicles, obras, dailyWorkLogs, refuelings, comboioTransactions, partners,
        pagamentos: terceirizadoPagamentos,
    }), [vehicles, obras, dailyWorkLogs, refuelings, comboioTransactions, partners, terceirizadoPagamentos]);

    // Terceiros = locadores (por tipo_parceiro, por veículo terceirizado ou por contrato existente)
    const terceiros = useMemo(() => {
        const byId = new Map();
        const add = (id) => {
            if (!id || byId.has(id)) return;
            const p = partners.find((x) => x.id === id);
            if (p) byId.set(id, p);
        };
        partners.forEach((p) => { if (p.tipo_parceiro === 'locador') byId.set(p.id, p); });
        vehicles.forEach((v) => { if (v.isOutsourced) add(v.locadorId); });
        terceiroContratos.forEach((c) => add(c.locadorId));
        return [...byId.values()].sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || ''));
    }, [partners, vehicles, terceiroContratos]);

    const obraNome = useMemo(() => {
        const m = new Map(obras.map((o) => [o.id, o.nome]));
        return (id) => m.get(id) || '—';
    }, [obras]);

    // Agrupa contratos por terceiro (só terceiros que têm contrato)
    const grupos = useMemo(() => {
        return terceiros
            .map((t) => ({ terceiro: t, ...computeContratosPorTerceiro(t.id, terceiroContratos, ctx) }))
            .filter((g) => g.contratos.length > 0)
            .sort((a, b) => b.saldo - a.saldo);
    }, [terceiros, terceiroContratos, ctx]);

    const totaisGerais = useMemo(() => grupos.reduce((a, g) => ({
        contratos: a.contratos + g.contratos.length,
        valorTotal: a.valorTotal + g.valorTotal,
        diesel: a.diesel + g.diesel,
        adiantamentos: a.adiantamentos + g.adiantamentos,
        saldo: a.saldo + g.saldo,
    }), { contratos: 0, valorTotal: 0, diesel: 0, adiantamentos: 0, saldo: 0 }), [grupos]);

    const toggleTerceiro = (id) => setExpandedTerceiros((s) => ({ ...s, [id]: !s[id] }));
    const toggleContrato = (id) => setExpandedContratos((s) => ({ ...s, [id]: !s[id] }));

    const handleGerarPdf = async (contrato) => {
        setPdfLoadingId(contrato.id);
        try {
            const { url } = await apiClient.gerarContratoPdf(contrato.id);
            window.open(`${FILE_ORIGIN}${url}`, '_blank', 'noopener');
            refresh?.('terceiroContratos');
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao gerar PDF do contrato.');
        } finally {
            setPdfLoadingId(null);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await apiClient.deleteTerceiroContrato(confirmDelete.id);
            setAlertMessage?.('Contrato excluído.');
            reload();
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao excluir contrato.');
        } finally {
            setConfirmDelete(null);
        }
    };

    const saldoTone = (v) => (v > 0 ? 'red' : v < 0 ? 'blue' : 'green');

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
            <div className="flex items-start justify-between mb-1 flex-wrap gap-3">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14' }} className="flex items-center gap-2">
                        <Truck className="text-purple-500" /> Terceirizados
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Contratos por terceiro e obra (valor fechado). As horas são acompanhamento físico;
                        o saldo a pagar é o valor do contrato menos o diesel fornecido e os adiantamentos.
                    </p>
                </div>
                <ProtectedComponent requiredPermission="editor">
                    <button onClick={() => setContratoModal({ contrato: null })}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        <PlusCircle size={16} /> Novo Contrato
                    </button>
                </ProtectedComponent>
            </div>

            {/* Totais gerais */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-6">
                <KpiCard icon={FileText} tone="purple" label="Contratos" value={totaisGerais.contratos} />
                <KpiCard icon={DollarSign} tone="gray" label="Valor contratado" value={fmtBRL(totaisGerais.valorTotal)} />
                <KpiCard icon={Droplet} tone="blue" label="Diesel abatido" value={fmtBRL(totaisGerais.diesel)} />
                <KpiCard icon={Wallet} tone="gray" label="Adiantamentos" value={fmtBRL(totaisGerais.adiantamentos)} />
                <KpiCard icon={DollarSign} tone={saldoTone(totaisGerais.saldo)} label="Saldo a pagar" value={fmtBRL(totaisGerais.saldo)} />
            </div>

            {grupos.length === 0 && (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400 text-sm">
                    Nenhum contrato de terceirizado cadastrado. Clique em <b>Novo Contrato</b> para começar.
                </div>
            )}

            <div className="space-y-3">
                {grupos.map((g) => {
                    const openT = !!expandedTerceiros[g.terceiro.id];
                    return (
                        <div key={g.terceiro.id} className="bg-white rounded-lg shadow overflow-hidden">
                            {/* Cabeçalho do terceiro */}
                            <button onClick={() => toggleTerceiro(g.terceiro.id)}
                                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left">
                                {openT ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                                <Truck size={18} className="text-purple-500" />
                                <span className="font-bold text-gray-800">{g.terceiro.razaoSocial}</span>
                                <span className="text-xs text-gray-400">
                                    {g.contratos.length} contrato(s) · {g.numObras} obra(s) · {g.numMaquinas} máquina(s)
                                </span>
                                <div className="ml-auto flex items-center gap-4 text-xs">
                                    <span className="text-gray-500">Diesel <b className="text-blue-700">{fmtBRL(g.diesel)}</b></span>
                                    <span className="text-gray-500">Saldo <b className={g.saldo > 0 ? 'text-red-600' : g.saldo < 0 ? 'text-blue-600' : 'text-green-600'}>{fmtBRL(g.saldo)}</b></span>
                                </div>
                            </button>

                            {/* Contratos do terceiro */}
                            {openT && (
                                <div className="border-t border-gray-100 divide-y divide-gray-100">
                                    {g.contratos.map((r) => {
                                        const c = r.contrato;
                                        const openC = !!expandedContratos[c.id];
                                        return (
                                            <div key={c.id} className="p-4 bg-gray-50/40">
                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                    <div className="flex items-start gap-2">
                                                        <button onClick={() => toggleContrato(c.id)} className="mt-0.5">
                                                            {openC ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                                        </button>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-gray-800 text-sm">{c.numero}</span>
                                                                <StatusBadge status={c.status} />
                                                            </div>
                                                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                                <Building2 size={12} /> {obraNome(c.obraId)}
                                                                {c.tipoMaquina ? ` · ${c.tipoMaquina}` : ''} · {r.numMaquinas} máq.
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button onClick={() => handleGerarPdf(c)} disabled={pdfLoadingId === c.id}
                                                            title="Gerar PDF do contrato"
                                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                                                            {pdfLoadingId === c.id ? <Loader size={13} className="animate-spin" /> : <FileDown size={13} />} PDF
                                                        </button>
                                                        <ProtectedComponent requiredPermission="editor">
                                                            <button onClick={() => setPagamentoModal({ contrato: c, locador: g.terceiro })}
                                                                title="Registrar adiantamento"
                                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                                                                <Wallet size={13} /> Adiantamento
                                                            </button>
                                                            <button onClick={() => setContratoModal({ contrato: c })}
                                                                title="Editar contrato"
                                                                className="p-1.5 text-gray-500 rounded-lg hover:bg-gray-200"><Pencil size={14} /></button>
                                                            <button onClick={() => setConfirmDelete(c)}
                                                                title="Excluir contrato"
                                                                className="p-1.5 text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                                                        </ProtectedComponent>
                                                    </div>
                                                </div>

                                                {/* Números do contrato */}
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 pl-6">
                                                    <div>
                                                        <div className="text-[10px] uppercase font-bold text-gray-400">Valor contrato</div>
                                                        <div className="text-sm font-bold text-gray-800">{fmtBRL(r.valorTotal)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] uppercase font-bold text-gray-400">Diesel abatido</div>
                                                        <div className="text-sm font-bold text-blue-700">{fmtBRL(r.diesel)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] uppercase font-bold text-gray-400">Adiantamentos</div>
                                                        <div className="text-sm font-bold text-gray-700">{fmtBRL(r.adiantamentos)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] uppercase font-bold text-gray-400">Saldo a pagar</div>
                                                        <div className={`text-sm font-bold ${r.saldo > 0 ? 'text-red-600' : r.saldo < 0 ? 'text-blue-600' : 'text-green-600'}`}>{fmtBRL(r.saldo)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                                                            <Clock size={11} /> Progresso
                                                        </div>
                                                        <div className="text-xs font-semibold text-gray-700">{fmtH(r.horasExecutadas)} / {fmtH(r.horasContratadas)}</div>
                                                        <ProgressBar ratio={r.progresso} />
                                                    </div>
                                                </div>

                                                {c.status === 'ativo' && r.numMaquinas === 0 && (
                                                    <div className="mt-2 ml-6 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                                        <AlertTriangle size={13} />
                                                        Contrato ativo sem máquina vinculada — nenhum diesel é abatido. Edite o contrato e marque a máquina.
                                                    </div>
                                                )}

                                                {r.saldo < 0 && (
                                                    <p className="text-[11px] text-blue-600 mt-2 pl-6">
                                                        ⚠ Diesel + adiantamentos já ultrapassaram o valor do contrato — o terceiro deve {fmtBRL(-r.saldo)} à MAK.
                                                    </p>
                                                )}

                                                {/* Drill por máquina */}
                                                {openC && r.equipamentos.length > 0 && (
                                                    <div className="mt-3 pl-6 overflow-x-auto">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                                                                    <th className="p-1.5">Máquina</th>
                                                                    <th className="p-1.5 text-right">Diesel (L)</th>
                                                                    <th className="p-1.5 text-right">Diesel (R$)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {r.equipamentos.map((e) => (
                                                                    <tr key={e.vehicle.id} className="border-b border-gray-50">
                                                                        <td className="p-1.5">
                                                                            <span className="font-semibold text-gray-700">{e.vehicle.registroInterno || e.vehicle.placa}</span>
                                                                            <span className="text-gray-400"> · {e.vehicle.tipo}{e.vehicle.modelo ? ` ${e.vehicle.modelo}` : ''}</span>
                                                                        </td>
                                                                        <td className="p-1.5 text-right">{fmtL(e.litros)}</td>
                                                                        <td className="p-1.5 text-right text-blue-700">{fmtBRL(e.diesel)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                                {openC && r.equipamentos.length === 0 && (
                                                    <p className="text-[11px] text-gray-400 mt-2 pl-6">Nenhuma máquina do terceiro alocada nesta obra ainda (alocação feita na tela de Obras).</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {contratoModal && (
                <ContratoTerceiroModal
                    contrato={contratoModal.contrato}
                    terceiros={terceiros}
                    obras={obras}
                    vehicles={vehicles}
                    contratos={terceiroContratos}
                    user={user}
                    apiClient={apiClient}
                    setAlertMessage={setAlertMessage}
                    onClose={() => setContratoModal(null)}
                    onSaved={reload}
                />
            )}

            {pagamentoModal && (
                <TerceirizadoPagamentoModal
                    locador={pagamentoModal.locador}
                    contrato={pagamentoModal.contrato}
                    user={user}
                    apiClient={apiClient}
                    setAlertMessage={setAlertMessage}
                    onClose={() => setPagamentoModal(null)}
                    onSaved={reload}
                />
            )}

            {confirmDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-5">
                        <h3 className="text-base font-bold text-gray-800 mb-2">Excluir contrato {confirmDelete.numero}?</h3>
                        <p className="text-sm text-gray-500 mb-4">Esta ação não pode ser desfeita. Os adiantamentos vinculados a ele deixarão de ser abatidos.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300">Cancelar</button>
                            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TerceirizadosPage;
