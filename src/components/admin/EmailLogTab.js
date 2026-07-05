import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Eye, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

const STATUS_CONFIG = {
    sent:    { label: 'Enviado',  color: 'text-green-600', Icon: CheckCircle },
    failed:  { label: 'Falhou',   color: 'text-red-600',   Icon: XCircle },
    skipped: { label: 'Ignorado', color: 'text-gray-400',  Icon: AlertCircle },
};

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const EmailLogTab = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [detalhe, setDetalhe] = useState(null);
    const [loadingDetalhe, setLoadingDetalhe] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterStatus) params.status = filterStatus;
            const data = await apiClient.getEmailLog(params);
            setLogs(data || []);
        } catch (e) {
            console.warn('EmailLog:', e.message);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { load(); }, [load]);

    const abrirDetalhe = async (id) => {
        setLoadingDetalhe(true);
        setDetalhe({ id });
        try {
            const d = await apiClient.getEmailLogItem(id);
            setDetalhe(d);
        } catch (e) {
            setDetalhe({ id, erro: 'Falha ao carregar: ' + e.message });
        } finally {
            setLoadingDetalhe(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                >
                    <option value="">Todos os status</option>
                    <option value="sent">Enviado</option>
                    <option value="failed">Falhou</option>
                    <option value="skipped">Ignorado</option>
                </select>
                <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
                </button>
                <span className="text-xs text-gray-400 ml-auto">{logs.length} registro(s)</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-2 text-left">Data</th>
                            <th className="px-4 py-2 text-left">Destinatário</th>
                            <th className="px-4 py-2 text-left">Assunto</th>
                            <th className="px-4 py-2 text-left">Tipo</th>
                            <th className="px-4 py-2 text-left">Status</th>
                            <th className="px-4 py-2 text-left">Detalhe</th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.length === 0 && !loading && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum e-mail registrado.</td></tr>
                        )}
                        {logs.map(log => {
                            const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.skipped;
                            const Icon = sc.Icon;
                            return (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                                    <td className="px-4 py-2 text-gray-700 max-w-xs truncate" title={log.para}>{log.para}</td>
                                    <td className="px-4 py-2 text-gray-800 max-w-xs truncate" title={log.assunto}>{log.assunto || '—'}</td>
                                    <td className="px-4 py-2 text-gray-500 text-xs">{log.tipo || '—'}</td>
                                    <td className="px-4 py-2">
                                        <span className={`flex items-center gap-1 font-medium ${sc.color}`}>
                                            <Icon size={14} /> {sc.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 text-xs max-w-xs truncate" title={log.erro || ''}>{log.erro || '—'}</td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={() => abrirDetalhe(log.id)} className="text-gray-400 hover:text-gray-700" title="Ver conteúdo">
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {detalhe && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setDetalhe(null)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-bold text-gray-800">Conteúdo do e-mail</h3>
                            <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto text-sm space-y-2">
                            {loadingDetalhe ? (
                                <p className="text-gray-400">Carregando...</p>
                            ) : (
                                <>
                                    <p><span className="font-bold text-gray-500">Para:</span> {detalhe.para}</p>
                                    <p><span className="font-bold text-gray-500">Assunto:</span> {detalhe.assunto || '—'}</p>
                                    <p><span className="font-bold text-gray-500">Status:</span> {detalhe.status} {detalhe.erro ? `— ${detalhe.erro}` : ''}</p>
                                    <div className="border-t pt-2 mt-2">
                                        <p className="font-bold text-gray-500 mb-1">Corpo:</p>
                                        <div className="bg-gray-50 border rounded p-3 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: detalhe.corpo || '<em>Sem conteúdo</em>' }} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailLogTab;
