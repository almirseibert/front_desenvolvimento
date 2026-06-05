import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Loader, RefreshCw, User, Gauge, Wallet, Copy, Clock, Filter } from 'lucide-react';
import apiClient from '../../services/apiClient';

const TIPO_META = {
    regressao:        { label: 'Regressão',         cor: 'bg-red-100 text-red-800',       Icon: Gauge },
    salto_excessivo:  { label: 'Salto Excessivo',   cor: 'bg-orange-100 text-orange-800', Icon: Gauge },
    duplicado:        { label: 'Duplicado',          cor: 'bg-purple-100 text-purple-800', Icon: Copy  },
    orcamento:        { label: 'Estouro Orçamento', cor: 'bg-yellow-100 text-yellow-800', Icon: Wallet },
};

const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
};

const SolicitacaoErrosTab = () => {
    const [erros, setErros]     = useState([]);
    const [resumo, setResumo]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroUsuario, setFiltroUsuario] = useState('');
    const [filtroTipo, setFiltroTipo]       = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [logs, res] = await Promise.all([
                apiClient.adminGetSolicitacaoErros({ limit: 500 }),
                apiClient.adminGetSolicitacaoErrosResumo(),
            ]);
            setErros(Array.isArray(logs) ? logs : []);
            setResumo(res?.porUsuario || []);
        } catch (e) {
            console.error('Erro ao carregar log de erros:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const errosFiltrados = useMemo(() => {
        return erros.filter(e => {
            if (filtroUsuario && String(e.usuario_id) !== String(filtroUsuario)) return false;
            if (filtroTipo && e.tipo_erro !== filtroTipo) return false;
            return true;
        });
    }, [erros, filtroUsuario, filtroTipo]);

    const totalGeral = resumo.reduce((acc, r) => acc + Number(r.total || 0), 0);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20 text-gray-500">
                <Loader className="animate-spin mr-2" /> Carregando log de erros…
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <AlertTriangle size={20} className="text-orange-500" />
                        Erros de Solicitação de Abastecimento
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Histórico de tentativas inválidas dos motoristas no app (últimos 90 dias no resumo).
                    </p>
                </div>
                <button onClick={load} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm flex items-center gap-1">
                    <RefreshCw size={14} /> Atualizar
                </button>
            </div>

            {/* Resumo por usuário */}
            <div className="bg-white border rounded-xl p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <User size={14} /> Resumo por usuário (últimos 90 dias) — total: {totalGeral}
                </h3>
                {resumo.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum erro registrado.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Usuário</th>
                                    <th className="px-3 py-2 text-center">Total</th>
                                    <th className="px-3 py-2 text-center">Regressão</th>
                                    <th className="px-3 py-2 text-center">Salto</th>
                                    <th className="px-3 py-2 text-center">Duplicado</th>
                                    <th className="px-3 py-2 text-center">Orçamento</th>
                                    <th className="px-3 py-2 text-left">Último erro</th>
                                    <th className="px-3 py-2 text-center">Filtrar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {resumo.map(r => (
                                    <tr key={r.usuario_id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 font-medium">{r.usuario_nome || `#${r.usuario_id}`}</td>
                                        <td className="px-3 py-2 text-center font-bold text-red-700">{r.total}</td>
                                        <td className="px-3 py-2 text-center">{r.qtd_regressao || 0}</td>
                                        <td className="px-3 py-2 text-center">{r.qtd_salto || 0}</td>
                                        <td className="px-3 py-2 text-center">{r.qtd_duplicado || 0}</td>
                                        <td className="px-3 py-2 text-center">{r.qtd_orcamento || 0}</td>
                                        <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(r.ultimo_erro)}</td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                onClick={() => setFiltroUsuario(String(r.usuario_id))}
                                                className="text-xs text-blue-600 hover:underline"
                                            >Ver</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Log detalhado */}
            <div className="bg-white border rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Clock size={14} /> Log detalhado ({errosFiltrados.length})
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                        <Filter size={12} className="text-gray-400" />
                        <select
                            value={filtroTipo}
                            onChange={e => setFiltroTipo(e.target.value)}
                            className="border rounded px-2 py-1"
                        >
                            <option value="">Todos os tipos</option>
                            <option value="regressao">Regressão</option>
                            <option value="salto_excessivo">Salto Excessivo</option>
                            <option value="duplicado">Duplicado</option>
                            <option value="orcamento">Estouro Orçamento</option>
                        </select>
                        {filtroUsuario && (
                            <button
                                onClick={() => setFiltroUsuario('')}
                                className="px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                            >
                                Limpar usuário (#{filtroUsuario}) ✕
                            </button>
                        )}
                    </div>
                </div>

                {errosFiltrados.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-6 text-center">Sem erros para os filtros aplicados.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Data/Hora</th>
                                    <th className="px-3 py-2 text-left">Usuário</th>
                                    <th className="px-3 py-2 text-left">Veículo</th>
                                    <th className="px-3 py-2 text-left">Campo</th>
                                    <th className="px-3 py-2 text-left">Tipo</th>
                                    <th className="px-3 py-2 text-left">Mensagem</th>
                                    <th className="px-3 py-2 text-center">Informado</th>
                                    <th className="px-3 py-2 text-center">Anterior</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {errosFiltrados.map(e => {
                                    const meta = TIPO_META[e.tipo_erro] || { label: e.tipo_erro, cor: 'bg-gray-100 text-gray-700', Icon: AlertTriangle };
                                    const Icon = meta.Icon;
                                    return (
                                        <tr key={e.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(e.created_at)}</td>
                                            <td className="px-3 py-2 font-medium">{e.usuario_nome || `#${e.usuario_id}`}</td>
                                            <td className="px-3 py-2 text-xs">{e.veiculo_placa || e.veiculo_id || '—'}</td>
                                            <td className="px-3 py-2 text-xs uppercase font-bold">{e.campo_erro}</td>
                                            <td className="px-3 py-2">
                                                <span className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${meta.cor}`}>
                                                    <Icon size={11} /> {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-gray-700">{e.mensagem}</td>
                                            <td className="px-3 py-2 text-center text-xs">{e.valor_informado || '—'}</td>
                                            <td className="px-3 py-2 text-center text-xs">{e.valor_anterior || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SolicitacaoErrosTab;
