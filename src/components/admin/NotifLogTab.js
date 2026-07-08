import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';

const STATUS_CONFIG = {
    sent:    { label: 'Enviado',  color: 'green',  Icon: CheckCircle  },
    failed:  { label: 'Falhou',   color: 'red',    Icon: XCircle      },
    skipped: { label: 'Ignorado', color: 'gray',   Icon: AlertCircle  },
};

const CHANNEL_LABELS = { email: 'E-mail', whatsapp: 'WhatsApp', push: 'Push' };

const EVENT_LABELS = {
    combustivel_obra_20pct: 'Combustível da obra',
    obra_progresso:         'Progresso de obra',
    obra_criada:            'Obra criada',
    cnh_vencendo:           'CNH vencendo',
    cnh_vencida:            'CNH vencida',
    multa_lancada:          'Multa lançada',
    ordem_gerada:           'Ordem gerada',
};

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const NotifLogTab = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterEvent, setFilterEvent] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterEvent)  params.event_type = filterEvent;
            if (filterStatus) params.status = filterStatus;
            const data = await apiClient.getNotificationLog(params);
            setLogs(data || []);
        } catch (e) {
            console.warn('NotifLog:', e.message);
        } finally {
            setLoading(false);
        }
    }, [filterEvent, filterStatus]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap gap-3 items-center">
                <select
                    value={filterEvent}
                    onChange={e => setFilterEvent(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                >
                    <option value="">Todos os eventos</option>
                    {Object.entries(EVENT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
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
                <button
                    onClick={load}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Atualizar
                </button>
                <span className="text-xs text-gray-400 ml-auto">{logs.length} registro(s)</span>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-2 text-left">Data</th>
                            <th className="px-4 py-2 text-left">Evento</th>
                            <th className="px-4 py-2 text-left">Canal</th>
                            <th className="px-4 py-2 text-left">Destinatário</th>
                            <th className="px-4 py-2 text-left">Status</th>
                            <th className="px-4 py-2 text-left">Detalhe</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.length === 0 && !loading && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                    Nenhum registro encontrado.
                                </td>
                            </tr>
                        )}
                        {logs.map(log => {
                            const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.skipped;
                            const Icon = sc.Icon;
                            const colorClass = {
                                green: 'text-green-600',
                                red:   'text-red-600',
                                gray:  'text-gray-400',
                            }[sc.color];

                            let payloadSummary = '';
                            try {
                                const p = typeof log.payload_json === 'string'
                                    ? JSON.parse(log.payload_json)
                                    : log.payload_json;
                                if (p?.obra)    payloadSummary = `Obra: ${p.obra}`;
                                if (p?.pct)     payloadSummary += ` • ${p.pct}%`;
                                if (p?.gastoAtual && p?.orcamento)
                                    payloadSummary += ` (R$ ${p.gastoAtual} / R$ ${p.orcamento})`;
                            } catch { /* ignora */ }

                            return (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                                    <td className="px-4 py-2 font-medium text-gray-800">
                                        {EVENT_LABELS[log.event_type] || log.event_type}
                                    </td>
                                    <td className="px-4 py-2 text-gray-600">
                                        {CHANNEL_LABELS[log.channel] || log.channel}
                                    </td>
                                    <td className="px-4 py-2 text-gray-700 max-w-xs truncate" title={log.contact}>
                                        {log.contact}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`flex items-center gap-1 font-medium ${colorClass}`}>
                                            <Icon size={14}/> {sc.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 text-xs max-w-xs truncate" title={log.error_msg || payloadSummary}>
                                        {log.error_msg || payloadSummary || '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default NotifLogTab;
