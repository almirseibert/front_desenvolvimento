import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, MapPin, User, Check, Trash2, RefreshCw, ArrowRight } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useData } from '../../contexts/DataContext';

const TIPO_META = {
    mudanca_obra:     { label: 'Mudança de obra',     Icon: MapPin, color: 'text-blue-600 bg-blue-100' },
    mudanca_operador: { label: 'Mudança de operador', Icon: User,   color: 'text-purple-600 bg-purple-100' },
};

const formatDateTime = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d)) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const RequisicoesAdminTab = () => {
    const { socket } = useData();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pendente');
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await apiClient.getOperationalRequests();
            setRequests(Array.isArray(data) ? data : []);
        } catch {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!socket) return;
        const onSync = (payload) => {
            if (!payload?.targets || payload.targets.includes('operationalRequests')) load();
        };
        const onNotif = (d) => { if (d?.tipo === 'requisicao_operacional') load(); };
        socket.on('server:sync', onSync);
        socket.on('admin:notificacao', onNotif);
        return () => {
            socket.off('server:sync', onSync);
            socket.off('admin:notificacao', onNotif);
        };
    }, [socket, load]);

    const handleResolve = async (id) => {
        setBusyId(id);
        try { await apiClient.resolveOperationalRequest(id); await load(); }
        catch { alert('Não foi possível marcar como resolvida.'); }
        finally { setBusyId(null); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Descartar esta requisição? Esta ação não pode ser desfeita.')) return;
        setBusyId(id);
        try { await apiClient.deleteOperationalRequest(id); await load(); }
        catch { alert('Não foi possível descartar a requisição.'); }
        finally { setBusyId(null); }
    };

    const filtered = requests.filter(r => filter === 'todas' ? true : (r.status || 'pendente') === filter);
    const pendingCount = requests.filter(r => (r.status || 'pendente') === 'pendente').length;

    return (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Inbox size={18} className="text-yellow-500" />
                        Requisições Operacionais
                        {pendingCount > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">{pendingCount} pendente{pendingCount === 1 ? '' : 's'}</span>
                        )}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Sugestões enviadas pela Central Operacional sobre a real obra/operador de cada equipamento.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                        {[['pendente', 'Pendentes'], ['resolvida', 'Resolvidas'], ['todas', 'Todas']].map(([val, label]) => (
                            <button key={val} onClick={() => setFilter(val)}
                                className={`px-3 py-1 rounded-md font-medium transition-all ${filter === val ? 'bg-white shadow text-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
                        ))}
                    </div>
                    <button onClick={load} title="Atualizar" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Carregando requisições...</div>
            ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                    <Inbox size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma requisição {filter !== 'todas' ? filter === 'pendente' ? 'pendente' : 'resolvida' : ''}.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(r => {
                        const meta = TIPO_META[r.tipo] || { label: r.tipo, Icon: Inbox, color: 'text-gray-600 bg-gray-100' };
                        const Icon = meta.Icon;
                        const atual = r.tipo === 'mudanca_obra' ? r.obra_atual_nome : r.operador_atual_nome;
                        const isResolved = (r.status || 'pendente') === 'resolvida';
                        return (
                            <div key={r.id} className={`rounded-xl border p-4 ${isResolved ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-200'}`}>
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
                                                <Icon size={12} /> {meta.label}
                                            </span>
                                            <span className="font-bold text-gray-800">{r.veiculo_registro || r.veiculo_id}</span>
                                            {isResolved && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Resolvida</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-700 flex-wrap">
                                            <span className="text-gray-400">{atual || '—'}</span>
                                            <ArrowRight size={14} className="text-gray-400" />
                                            <span className="font-semibold text-gray-800">{r.valor_sugerido_nome}</span>
                                        </div>
                                        {r.observacao && <p className="text-sm text-gray-500 mt-1.5 italic">"{r.observacao}"</p>}
                                        <p className="text-xs text-gray-400 mt-2">
                                            {r.solicitante_email || 'Usuário'} · {formatDateTime(r.created_at)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {!isResolved && (
                                            <button onClick={() => handleResolve(r.id)} disabled={busyId === r.id}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                                                <Check size={13} /> Resolver
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(r.id)} disabled={busyId === r.id}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg disabled:opacity-50">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RequisicoesAdminTab;
