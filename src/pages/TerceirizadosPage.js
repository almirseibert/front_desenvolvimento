import React, { useState, useMemo } from 'react';
import {
    Truck, Building2, PlusCircle, ChevronRight, ArrowLeft, Search, Clock,
    FileDown, Loader, AlertTriangle,
} from 'lucide-react';
import { useData, useEnsureResources } from '../contexts/DataContext';
import ProtectedComponent from '../components/ProtectedComponent';
import TerceirizadoPagamentoModal from '../components/modals/TerceirizadoPagamentoModal';
import ContratoTerceiroModal from '../components/modals/ContratoTerceiroModal';
import ContratoDetalheModal from '../components/modals/ContratoDetalheModal';
import { computeContrato, computeContratosPorTerceiro } from '../utils/terceirizados';
import { gerarTerceiroExtratoPdf } from '../utils/terceiroExtratoPdf';

const fmtBRL = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtH = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' h';

// Origem do backend p/ abrir PDFs estáticos (/uploads/...), sem o sufixo /api.
const FILE_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

const saldoClass = (v) => (v > 0 ? 'text-red-600' : v < 0 ? 'text-blue-600' : 'text-green-600');

const StatusBadge = ({ status }) => {
    const map = {
        ativo:     { t: 'Ativo', c: 'bg-green-50 text-green-700 border-green-200' },
        concluido: { t: 'Concluído', c: 'bg-gray-100 text-gray-600 border-gray-200' },
        cancelado: { t: 'Cancelado', c: 'bg-red-50 text-red-700 border-red-200' },
    };
    const s = map[status] || map.ativo;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.c}`}>{s.t}</span>;
};

const KpiCard = ({ label, value, tone = 'gray' }) => {
    const tones = {
        gray:  { bg: '#f8fafc', text: '#334155' },
        blue:  { bg: '#eff6ff', text: '#1e40af' },
        red:   { bg: '#fef2f2', text: '#991b1b' },
        green: { bg: '#f0fdf4', text: '#166534' },
    };
    const t = tones[tone] || tones.gray;
    return (
        <div className="rounded-xl border border-gray-100 p-4" style={{ background: t.bg }}>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.text }}>{label}</div>
            <div className="text-lg font-extrabold mt-1" style={{ color: t.text }}>{value}</div>
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

    const [selectedTerceiroId, setSelectedTerceiroId] = useState(null);
    const [busca, setBusca] = useState('');
    const [contratoModal, setContratoModal] = useState(null);   // { contrato } | { contrato: null }
    const [pagamentoModal, setPagamentoModal] = useState(null); // { contrato, locador, pagamento? }
    const [detalheId, setDetalheId] = useState(null);           // contrato.id aberto no modal de detalhe
    const [confirmDelete, setConfirmDelete] = useState(null);   // contrato
    const [confirmDeletePag, setConfirmDeletePag] = useState(null); // pagamento
    const [pdfLoadingId, setPdfLoadingId] = useState(null);
    const [extratoLoading, setExtratoLoading] = useState(false);

    const reload = () => { refresh?.('terceiroContratos'); refresh?.('terceirizadoPagamentos'); };

    const ctx = useMemo(() => ({
        vehicles, obras, dailyWorkLogs, refuelings, comboioTransactions, partners,
        pagamentos: terceirizadoPagamentos,
    }), [vehicles, obras, dailyWorkLogs, refuelings, comboioTransactions, partners, terceirizadoPagamentos]);

    const terceiroPorId = useMemo(() => new Map(partners.map((p) => [p.id, p])), [partners]);
    const obraNome = useMemo(() => {
        const m = new Map(obras.map((o) => [o.id, o.nome]));
        return (id) => m.get(id) || '—';
    }, [obras]);

    // Lista completa de locadores para o modal de contrato (inclui os sem contrato).
    const terceirosParaModal = useMemo(() => {
        const byId = new Map();
        const add = (id) => { if (id && !byId.has(id) && terceiroPorId.get(id)) byId.set(id, terceiroPorId.get(id)); };
        partners.forEach((p) => { if (p.tipo_parceiro === 'locador') byId.set(p.id, p); });
        vehicles.forEach((v) => { if (v.isOutsourced) add(v.locadorId); });
        terceiroContratos.forEach((c) => add(c.locadorId));
        return [...byId.values()].sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || ''));
    }, [partners, vehicles, terceiroContratos, terceiroPorId]);

    // Nível 1 — terceiros que têm contrato, com agregados (saldo devido em destaque).
    const grupos = useMemo(() => {
        const ids = [...new Set(terceiroContratos.map((c) => c.locadorId))];
        return ids
            .map((id) => ({ terceiro: terceiroPorId.get(id) || { id, razaoSocial: '—' }, ...computeContratosPorTerceiro(id, terceiroContratos, ctx) }))
            .sort((a, b) => b.saldo - a.saldo);
    }, [terceiroContratos, terceiroPorId, ctx]);

    const gruposFiltrados = useMemo(() => {
        const q = busca.trim().toLowerCase();
        if (!q) return grupos;
        return grupos.filter((g) => (g.terceiro.razaoSocial || '').toLowerCase().includes(q));
    }, [grupos, busca]);

    const grupoSel = useMemo(
        () => grupos.find((g) => g.terceiro.id === selectedTerceiroId) || null,
        [grupos, selectedTerceiroId]);

    const contratoDetalhe = useMemo(() => {
        if (!detalheId) return null;
        const c = terceiroContratos.find((x) => x.id === detalheId);
        if (!c) return null;
        return { r: computeContrato(c, ctx), terceiro: terceiroPorId.get(c.locadorId) || null };
    }, [detalheId, terceiroContratos, ctx, terceiroPorId]);

    const adiantamentosDetalhe = useMemo(() => {
        if (!detalheId) return [];
        return terceirizadoPagamentos
            .filter((p) => p.contratoId === detalheId)
            .sort((a, b) => dataSort(b) - dataSort(a));
    }, [detalheId, terceirizadoPagamentos]);

    const handleGerarPdf = async (contrato) => {
        setPdfLoadingId(contrato.id);
        try {
            const { url } = await apiClient.gerarContratoPdf(contrato.id);
            window.open(`${FILE_ORIGIN}${url}?v=${Date.now()}`, '_blank', 'noopener');
            refresh?.('terceiroContratos');
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao gerar PDF do contrato.');
        } finally {
            setPdfLoadingId(null);
        }
    };

    const handleExtrato = () => {
        if (!grupoSel) return;
        setExtratoLoading(true);
        try {
            gerarTerceiroExtratoPdf(grupoSel.terceiro, ctx, terceiroContratos, obraNome);
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao gerar extrato do terceiro.');
        } finally {
            setExtratoLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await apiClient.deleteTerceiroContrato(confirmDelete.id);
            setAlertMessage?.('Contrato excluído.');
            if (detalheId === confirmDelete.id) setDetalheId(null);
            reload();
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao excluir contrato.');
        } finally {
            setConfirmDelete(null);
        }
    };

    const handleDeletePagamento = async () => {
        if (!confirmDeletePag) return;
        try {
            await apiClient.deleteTerceirizadoPagamento(confirmDeletePag.id);
            setAlertMessage?.('Pagamento excluído.');
            refresh?.('terceirizadoPagamentos');
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao excluir pagamento.');
        } finally {
            setConfirmDeletePag(null);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
            {/* ===================== NÍVEL 1 — TERCEIROS ===================== */}
            {!grupoSel && (
                <>
                    <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14' }} className="flex items-center gap-2">
                                <Truck className="text-purple-500" /> Terceirizados
                            </h1>
                            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                                Quanto devemos a cada terceiro. Entre em um para ver os contratos e o histórico.
                            </p>
                        </div>
                        <ProtectedComponent requiredPermission="editor">
                            <button onClick={() => setContratoModal({ contrato: null })}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                                <PlusCircle size={16} /> Novo Contrato
                            </button>
                        </ProtectedComponent>
                    </div>

                    <div className="relative max-w-sm mb-4">
                        <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar terceiro"
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-white" />
                    </div>

                    {gruposFiltrados.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400 text-sm">
                            {grupos.length === 0
                                ? <>Nenhum contrato de terceirizado cadastrado. Clique em <b>Novo Contrato</b> para começar.</>
                                : 'Nenhum terceiro corresponde à busca.'}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow divide-y divide-gray-100">
                            {gruposFiltrados.map((g) => (
                                <button key={g.terceiro.id} onClick={() => setSelectedTerceiroId(g.terceiro.id)}
                                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 text-left">
                                    <Truck size={20} className="text-purple-400 shrink-0" />
                                    <div className="min-w-0">
                                        <div className="font-bold text-gray-800 truncate">{g.terceiro.razaoSocial}</div>
                                        <div className="text-xs text-gray-400">
                                            {g.contratos.length} contrato(s) · {g.numObras} obra(s) · {g.numMaquinas} máquina(s)
                                        </div>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <div className="text-[11px] text-gray-400 uppercase font-bold">Devemos</div>
                                        <div className={`text-lg font-extrabold ${saldoClass(g.saldo)}`}>{fmtBRL(g.saldo)}</div>
                                    </div>
                                    <ChevronRight size={18} className="text-gray-300 shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ===================== NÍVEL 2 — DOSSIÊ DO TERCEIRO ===================== */}
            {grupoSel && (
                <>
                    <button onClick={() => { setSelectedTerceiroId(null); setBusca(''); }}
                        className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mb-3 font-medium">
                        <ArrowLeft size={15} /> Terceiros
                    </button>

                    <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14' }} className="flex items-center gap-2">
                                <Truck className="text-purple-500" /> {grupoSel.terceiro.razaoSocial}
                            </h1>
                            {grupoSel.terceiro.cnpj && <p className="text-xs text-gray-400 mt-1">CNPJ {grupoSel.terceiro.cnpj}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleExtrato} disabled={extratoLoading}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                                {extratoLoading ? <Loader size={14} className="animate-spin" /> : <FileDown size={14} />} Extrato
                            </button>
                            <ProtectedComponent requiredPermission="editor">
                                <button onClick={() => setContratoModal({ contrato: null, locadorId: grupoSel.terceiro.id })}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                                    <PlusCircle size={16} /> Novo Contrato
                                </button>
                            </ProtectedComponent>
                        </div>
                    </div>

                    {/* Números do terceiro */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <KpiCard label="Contratado" value={fmtBRL(grupoSel.valorTotal)} tone="gray" />
                        <KpiCard label="Diesel abatido" value={fmtBRL(grupoSel.diesel)} tone="blue" />
                        <KpiCard label="Pagamentos" value={fmtBRL(grupoSel.adiantamentos)} tone="gray" />
                        <KpiCard label="Saldo a pagar" value={fmtBRL(grupoSel.saldo)} tone={grupoSel.saldo > 0 ? 'red' : grupoSel.saldo < 0 ? 'blue' : 'green'} />
                    </div>

                    <div className="text-xs text-gray-500 font-semibold mb-2">Contratos ({grupoSel.contratos.length})</div>
                    <div className="bg-white rounded-xl shadow overflow-x-auto">
                        <table className="w-full text-sm min-w-[640px]">
                            <thead>
                                <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                                    <th className="p-3">Contrato</th>
                                    <th className="p-3">Obra · máquina</th>
                                    <th className="p-3 text-right">Valor</th>
                                    <th className="p-3 text-right">Diesel</th>
                                    <th className="p-3 text-right">Pagto.</th>
                                    <th className="p-3 text-right">Saldo</th>
                                    <th className="p-3">Progresso</th>
                                    <th className="p-3 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {grupoSel.contratos.map((r) => {
                                    const c = r.contrato;
                                    const semMaquina = (c.status || 'ativo') === 'ativo' && r.numMaquinas === 0;
                                    return (
                                        <tr key={c.id} onClick={() => setDetalheId(c.id)}
                                            className="border-b border-gray-50 hover:bg-purple-50/40 cursor-pointer">
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-800">{c.numero}</span>
                                                    <StatusBadge status={c.status} />
                                                </div>
                                                {semMaquina && (
                                                    <div className="text-[10px] text-amber-700 flex items-center gap-1 mt-0.5">
                                                        <AlertTriangle size={10} /> sem máquina
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-gray-500 text-xs">
                                                <div className="flex items-center gap-1"><Building2 size={11} /> {obraNome(c.obraId)}</div>
                                                {c.tipoMaquina && <div className="text-gray-400">{c.tipoMaquina} · {r.numMaquinas} máq.</div>}
                                            </td>
                                            <td className="p-3 text-right text-gray-800">{fmtBRL(r.valorTotal)}</td>
                                            <td className="p-3 text-right text-blue-700">{fmtBRL(r.diesel)}</td>
                                            <td className="p-3 text-right text-gray-700">{fmtBRL(r.adiantamentos)}</td>
                                            <td className={`p-3 text-right font-bold ${saldoClass(r.saldo)}`}>{fmtBRL(r.saldo)}</td>
                                            <td className="p-3">
                                                <div className="w-20">
                                                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                        <div className="h-full bg-purple-500" style={{ width: `${Math.max(0, Math.min(1, r.progresso || 0)) * 100}%` }} />
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1"><Clock size={9} /> {fmtH(r.horasExecutadas)} / {fmtH(r.horasContratadas)}</div>
                                                </div>
                                            </td>
                                            <td className="p-3"><ChevronRight size={16} className="text-gray-300" /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ===================== MODAIS ===================== */}
            {contratoDetalhe && (
                <ContratoDetalheModal
                    r={contratoDetalhe.r}
                    terceiro={contratoDetalhe.terceiro}
                    obraNome={obraNome}
                    ctx={ctx}
                    adiantamentos={adiantamentosDetalhe}
                    pdfLoading={pdfLoadingId === detalheId}
                    onClose={() => setDetalheId(null)}
                    onGerarPdf={handleGerarPdf}
                    onEditContrato={() => setContratoModal({ contrato: contratoDetalhe.r.contrato })}
                    onDeleteContrato={() => setConfirmDelete(contratoDetalhe.r.contrato)}
                    onNovoAdiantamento={() => setPagamentoModal({ contrato: contratoDetalhe.r.contrato, locador: contratoDetalhe.terceiro })}
                    onEditAdiantamento={(p) => setPagamentoModal({ contrato: contratoDetalhe.r.contrato, locador: contratoDetalhe.terceiro, pagamento: p })}
                    onDeleteAdiantamento={(p) => setConfirmDeletePag(p)}
                />
            )}

            {contratoModal && (
                <ContratoTerceiroModal
                    contrato={contratoModal.contrato}
                    initialLocadorId={contratoModal.locadorId || ''}
                    terceiros={terceirosParaModal}
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
                    pagamento={pagamentoModal.pagamento}
                    saldo={pagamentoModal.contrato?.id === contratoDetalhe?.r?.contrato?.id ? contratoDetalhe?.r?.saldo : undefined}
                    user={user}
                    apiClient={apiClient}
                    setAlertMessage={setAlertMessage}
                    onClose={() => setPagamentoModal(null)}
                    onSaved={() => refresh?.('terceirizadoPagamentos')}
                />
            )}

            {confirmDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-5">
                        <h3 className="text-base font-bold text-gray-800 mb-2">Excluir contrato {confirmDelete.numero}?</h3>
                        <p className="text-sm text-gray-500 mb-4">Esta ação não pode ser desfeita. Os pagamentos vinculados a ele deixarão de ser abatidos.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300">Cancelar</button>
                            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDeletePag && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-5">
                        <h3 className="text-base font-bold text-gray-800 mb-2">Excluir pagamento de {fmtBRL(confirmDeletePag.valor)}?</h3>
                        <p className="text-sm text-gray-500 mb-4">Esta ação não pode ser desfeita. O saldo a pagar do contrato será recalculado.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDeletePag(null)} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300">Cancelar</button>
                            <button onClick={handleDeletePagamento} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Ordena pagamentos por data desc, tolerando formatos string.
const dataSort = (p) => {
    const v = p?.data;
    if (!v) return 0;
    const d = new Date(String(v).includes('T') ? v : `${String(v).split(' ')[0]}T00:00:00`);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

export default TerceirizadosPage;
