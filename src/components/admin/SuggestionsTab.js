import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Lightbulb, Check, Eye } from 'lucide-react';
import apiClient from '../../services/apiClient';

const STATUS = {
    nova:      { label: 'Nova',      color: 'bg-yellow-100 text-yellow-800' },
    lida:      { label: 'Lida',      color: 'bg-blue-100 text-blue-800' },
    resolvida: { label: 'Resolvida', color: 'bg-green-100 text-green-800' },
    arquivada: { label: 'Arquivada', color: 'bg-gray-200 text-gray-600' },
};

const fmtDate = (d) => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const SuggestionsTab = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');

    const baseURL = useMemo(() => (apiClient?.defaults?.baseURL || '').replace(/\/api\/?$/, ''), []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterStatus) params.status = filterStatus;
            const data = await apiClient.getSuggestions(params);
            setItems(data || []);
        } catch (e) {
            console.warn('Suggestions:', e.message);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { load(); }, [load]);

    const setStatus = async (id, status) => {
        try {
            await apiClient.updateSuggestionStatus(id, status);
            setItems(prev => prev.map(s => s.id === id ? { ...s, status } : s));
        } catch (e) {
            alert('Falha ao atualizar: ' + e.message);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-yellow-400 outline-none">
                    <option value="">Todos os status</option>
                    <option value="nova">Nova</option>
                    <option value="lida">Lida</option>
                    <option value="resolvida">Resolvida</option>
                    <option value="arquivada">Arquivada</option>
                </select>
                <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
                </button>
                <span className="text-xs text-gray-400 ml-auto">{items.length} sugestão(ões)</span>
            </div>

            {items.length === 0 && !loading ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
                    <Lightbulb size={32} className="mx-auto mb-2 opacity-30" />
                    Nenhuma sugestão registrada.
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map(s => {
                        const st = STATUS[s.status] || STATUS.nova;
                        return (
                            <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{s.user_nome || 'Usuário'}</p>
                                        <p className="text-[11px] text-gray-400">{fmtDate(s.created_at)}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.color}`}>{st.label}</span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{s.texto}</p>
                                {Array.isArray(s.anexos) && s.anexos.length > 0 && (
                                    <div className="flex gap-2 flex-wrap mb-3">
                                        {s.anexos.map((a, i) => (
                                            <a key={i} href={`${baseURL}${a}`} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded border overflow-hidden hover:ring-2 hover:ring-yellow-400">
                                                <img src={`${baseURL}${a}`} alt={`print ${i + 1}`} className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2 justify-end border-t pt-2">
                                    {s.status !== 'lida' && (
                                        <button onClick={() => setStatus(s.id, 'lida')} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1"><Eye size={13} /> Marcar lida</button>
                                    )}
                                    {s.status !== 'resolvida' && (
                                        <button onClick={() => setStatus(s.id, 'resolvida')} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"><Check size={13} /> Resolvida</button>
                                    )}
                                    {s.status !== 'arquivada' && (
                                        <button onClick={() => setStatus(s.id, 'arquivada')} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Arquivar</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SuggestionsTab;
