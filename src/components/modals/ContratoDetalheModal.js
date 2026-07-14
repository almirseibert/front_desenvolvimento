import React, { useMemo, useState } from 'react';
import {
    X, FileText, FileDown, Pencil, Trash2, Loader, Clock, Wallet, Droplet,
    PlusCircle, AlertTriangle, Building2,
} from 'lucide-react';
import ProtectedComponent from '../ProtectedComponent';
import { getContratoAbastecimentos } from '../../utils/terceirizados';

const fmtBRL = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtH = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' h';
const fmtL = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L';
const fmtDate = (v) => {
    if (!v) return '—';
    const d = v instanceof Date ? v : new Date(String(v).includes('T') ? v : `${String(v).split(' ')[0]}T00:00:00`);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};
const saldoClass = (v) => (v > 0 ? 'text-red-600' : v < 0 ? 'text-blue-600' : 'text-green-600');

// Paleta categórica para a barra de composição do plano (distinta do roxo do progresso).
const PLANO_CORES = ['#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#64748b', '#f43f5e', '#14b8a6'];

const StatusBadge = ({ status }) => {
    const map = {
        ativo:     { t: 'Ativo', c: 'bg-green-50 text-green-700 border-green-200' },
        concluido: { t: 'Concluído', c: 'bg-gray-100 text-gray-600 border-gray-200' },
        cancelado: { t: 'Cancelado', c: 'bg-red-50 text-red-700 border-red-200' },
    };
    const s = map[status] || map.ativo;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.c}`}>{s.t}</span>;
};

/**
 * ContratoDetalheModal — detalhe de um contrato de terceirizado.
 * Números do contrato + históricos de adiantamento e abastecimento.
 * O lançamento/edição/exclusão de adiantamento é delegado ao pai (via callbacks).
 *
 * Props:
 *  r            resultado de computeContrato (contrato, valorTotal, diesel, adiantamentos, saldo, ...)
 *  terceiro     locador
 *  obraNome     (id) => nome
 *  ctx          contexto de dados (vehicles/refuelings/comboio/partners) p/ abastecimentos
 *  adiantamentos [{ id, data, valor, descricao, created_by_email }]
 *  pdfLoading   bool
 *  onClose, onGerarPdf, onEditContrato, onDeleteContrato
 *  onNovoAdiantamento, onEditAdiantamento(p), onDeleteAdiantamento(p)
 */
const ContratoDetalheModal = ({
    r, terceiro, obraNome, ctx, adiantamentos = [], pdfLoading,
    onClose, onGerarPdf, onEditContrato, onDeleteContrato,
    onNovoAdiantamento, onEditAdiantamento, onDeleteAdiantamento,
}) => {
    const c = r.contrato;
    const [aba, setAba] = useState('adiantamentos'); // 'adiantamentos' | 'abastecimentos'

    const abastecimentos = useMemo(() => getContratoAbastecimentos(c, ctx), [c, ctx]);
    const totalAdiant = adiantamentos.reduce((a, p) => a + (Number(p.valor) || 0), 0);
    const semMaquina = (c.status || 'ativo') === 'ativo' && r.numMaquinas === 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto">
                {/* Cabeçalho */}
                <div className="flex items-start justify-between p-4 border-b sticky top-0 bg-white z-10">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <FileText size={18} className="text-purple-500" />
                            <span className="text-lg font-bold text-gray-800">{c.numero}</span>
                            <StatusBadge status={c.status} />
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            {terceiro?.razaoSocial || '—'} · <Building2 size={12} /> {obraNome(c.obraId)}
                            {c.tipoMaquina ? ` · ${c.tipoMaquina}` : ''}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => onGerarPdf(c)} disabled={pdfLoading} title="Gerar PDF do contrato"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                            {pdfLoading ? <Loader size={13} className="animate-spin" /> : <FileDown size={13} />} PDF
                        </button>
                        <ProtectedComponent requiredPermission="editor">
                            <button onClick={onEditContrato} title="Editar contrato"
                                className="p-1.5 text-gray-500 rounded-lg hover:bg-gray-200"><Pencil size={14} /></button>
                            <button onClick={onDeleteContrato} title="Excluir contrato"
                                className="p-1.5 text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                        </ProtectedComponent>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 ml-1"><X size={18} /></button>
                    </div>
                </div>

                <div className="p-4">
                    {/* Números */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3"><div className="text-[10px] uppercase font-bold text-gray-400">Valor contrato</div><div className="text-sm font-bold text-gray-800">{fmtBRL(r.valorTotal)}</div></div>
                        <div className="bg-gray-50 rounded-lg p-3"><div className="text-[10px] uppercase font-bold text-gray-400">Diesel abatido</div><div className="text-sm font-bold text-blue-700">{fmtBRL(r.diesel)}</div></div>
                        <div className="bg-gray-50 rounded-lg p-3"><div className="text-[10px] uppercase font-bold text-gray-400">Pagamentos</div><div className="text-sm font-bold text-gray-700">{fmtBRL(r.adiantamentos)}</div></div>
                        <div className="bg-gray-50 rounded-lg p-3"><div className="text-[10px] uppercase font-bold text-gray-400">Saldo a pagar</div><div className={`text-sm font-bold ${saldoClass(r.saldo)}`}>{fmtBRL(r.saldo)}</div></div>
                    </div>

                    {/* Progresso físico */}
                    <div className="mt-3">
                        <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1 mb-1"><Clock size={11} /> Progresso físico</div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${Math.max(0, Math.min(1, r.progresso || 0)) * 100}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{fmtH(r.horasExecutadas)} / {fmtH(r.horasContratadas)}</span>
                        </div>
                    </div>

                    {semMaquina && (
                        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                            <AlertTriangle size={13} /> Contrato ativo sem máquina vinculada — nenhum diesel é abatido. Edite o contrato e marque a máquina.
                        </div>
                    )}
                    {r.saldo < 0 && (
                        <p className="text-[11px] text-blue-600 mt-3">
                            ⚠ Diesel + pagamentos já ultrapassaram o valor do contrato — o terceiro deve {fmtBRL(-r.saldo)} à MAK.
                        </p>
                    )}

                    {/* Plano contratado por subgrupo — composição do valor (parte do todo, NÃO progresso) */}
                    {r.itensContratados.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-2">Plano contratado por subgrupo</div>
                            {/* Barra de composição: uma única barra fatiada por subgrupo */}
                            <div className="flex w-full h-3 rounded-full overflow-hidden mb-2.5">
                                {r.itensContratados.map((it, i) => {
                                    const share = r.valorTotal > 0 ? (it.subtotal / r.valorTotal) * 100 : 0;
                                    return <div key={i} title={`${it.type}: ${fmtBRL(it.subtotal)}`} style={{ width: `${share}%`, background: PLANO_CORES[i % PLANO_CORES.length] }} />;
                                })}
                            </div>
                            <div className="space-y-1">
                                {r.itensContratados.map((it, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PLANO_CORES[i % PLANO_CORES.length] }} />
                                            {it.type}
                                        </span>
                                        <span className="text-gray-500">{fmtH(it.horas)} × {fmtBRL(it.valorHora)}/h · <span className="font-bold text-gray-800">{fmtBRL(it.subtotal)}</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Máquinas do contrato — horas e diesel por máquina (sem barra, para não confundir com progresso) */}
                    {r.equipamentos.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-2">Máquinas do contrato</div>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                                        <th className="p-1.5">Máquina</th>
                                        <th className="p-1.5 text-right">Horas exec.</th>
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
                                            <td className="p-1.5 text-right text-gray-700">{fmtH(e.horas)}</td>
                                            <td className="p-1.5 text-right">{fmtL(e.litros)}</td>
                                            <td className="p-1.5 text-right text-blue-700">{fmtBRL(e.diesel)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Abas de histórico */}
                    <div className="flex gap-1 mt-5 border-b border-gray-100">
                        {[['adiantamentos', <><Wallet size={13} /> Pagamentos ({adiantamentos.length})</>],
                          ['abastecimentos', <><Droplet size={13} /> Abastecimentos ({abastecimentos.length})</>]].map(([key, label]) => (
                            <button key={key} onClick={() => setAba(key)}
                                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition
                                    ${aba === key ? 'border-purple-500 text-purple-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {aba === 'adiantamentos' && (
                        <div className="mt-3">
                            <ProtectedComponent requiredPermission="editor">
                                <button onClick={onNovoAdiantamento}
                                    className="w-full mb-3 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                                    <PlusCircle size={14} /> Lançar pagamento
                                </button>
                            </ProtectedComponent>
                            {adiantamentos.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-8">
                                    <Wallet size={22} className="mx-auto mb-2 text-gray-300" />
                                    Nenhum pagamento lançado para este contrato ainda.
                                </div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                                            <th className="p-1.5">Data</th><th className="p-1.5">Referência</th>
                                            <th className="p-1.5 text-right">Valor</th><th className="p-1.5 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adiantamentos.map((p) => (
                                            <tr key={p.id} className="border-b border-gray-50 align-top">
                                                <td className="p-1.5 whitespace-nowrap text-gray-700">{fmtDate(p.data)}</td>
                                                <td className="p-1.5">
                                                    <div className="text-gray-700">{p.descricao || <span className="text-gray-400">—</span>}</div>
                                                    {p.created_by_email && <div className="text-[10px] text-gray-400">{p.created_by_email}</div>}
                                                </td>
                                                <td className="p-1.5 text-right font-semibold text-gray-800 whitespace-nowrap">{fmtBRL(p.valor)}</td>
                                                <td className="p-1.5 text-right">
                                                    <ProtectedComponent requiredPermission="editor">
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <button onClick={() => onEditAdiantamento(p)} title="Editar" className="p-1 text-gray-400 rounded hover:bg-gray-100 hover:text-gray-600"><Pencil size={12} /></button>
                                                            <button onClick={() => onDeleteAdiantamento(p)} title="Excluir" className="p-1 text-red-400 rounded hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>
                                                        </div>
                                                    </ProtectedComponent>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-200">
                                            <td className="p-1.5 text-gray-500 font-semibold" colSpan={2}>Total pago</td>
                                            <td className="p-1.5 text-right font-bold text-gray-800">{fmtBRL(totalAdiant)}</td><td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    )}

                    {aba === 'abastecimentos' && (
                        <div className="mt-3">
                            {abastecimentos.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-8">
                                    <Droplet size={22} className="mx-auto mb-2 text-gray-300" />
                                    Nenhum abastecimento das máquinas deste contrato no período.
                                </div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                                            <th className="p-1.5">Data</th><th className="p-1.5">Máquina</th><th className="p-1.5">Fonte</th>
                                            <th className="p-1.5 text-right">Litros</th><th className="p-1.5 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {abastecimentos.map((a, i) => (
                                            <tr key={i} className="border-b border-gray-50">
                                                <td className="p-1.5 whitespace-nowrap text-gray-700">{fmtDate(a.date)}</td>
                                                <td className="p-1.5">
                                                    <span className="font-semibold text-gray-700">{a.vehicle?.registroInterno || a.vehicle?.placa || '—'}</span>
                                                    {a.vehicle?.tipo && <span className="text-gray-400"> · {a.vehicle.tipo}</span>}
                                                </td>
                                                <td className="p-1.5 text-gray-500">{a.fonte === 'comboio' ? 'Comboio' : 'Posto'}</td>
                                                <td className="p-1.5 text-right">{fmtL(a.litros)}</td>
                                                <td className="p-1.5 text-right text-blue-700">{fmtBRL(a.valor)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-200">
                                            <td className="p-1.5 text-gray-500 font-semibold" colSpan={3}>Total abatido</td>
                                            <td className="p-1.5 text-right font-semibold text-gray-700">{fmtL(r.litros)}</td>
                                            <td className="p-1.5 text-right font-bold text-blue-700">{fmtBRL(r.diesel)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContratoDetalheModal;
