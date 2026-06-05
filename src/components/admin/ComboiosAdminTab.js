import React, { useState, useEffect } from 'react';
import { Truck, RefreshCw, Loader, CheckCircle, XCircle, Save, Phone, Mail, MessageCircle, AlertTriangle, History, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import apiClient from '../../services/apiClient';

const Toast = ({ msg, tipo }) => msg ? (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
        tipo === 'erro' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
    }`}>
        {msg}
    </div>
) : null;

const ComboiosAdminTab = () => {
    const [comboios, setComboios] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [syncing, setSyncing]   = useState(false);
    const [edits, setEdits]       = useState({});
    const [savingId, setSavingId] = useState(null);
    const [toast, setToast]       = useState({ msg: '', tipo: 'ok' });
    // Histórico de períodos: { [vehicleId]: { open, loading, data } }
    const [periodos, setPeriodos] = useState({});

    const showToast = (msg, tipo = 'ok') => {
        setToast({ msg, tipo });
        setTimeout(() => setToast({ msg: '', tipo: 'ok' }), 3000);
    };

    const load = async () => {
        setLoading(true);
        try {
            const data = await apiClient.adminGetComboios();
            setComboios(Array.isArray(data) ? data : []);
            // Pré-popula campos editáveis com os valores atuais do partner
            const map = {};
            (data || []).forEach(c => {
                map[c.vehicleId] = {
                    telefone: c.partner?.telefone || '',
                    whatsapp: c.partner?.whatsapp || '',
                    email:    c.partner?.email    || '',
                };
            });
            setEdits(map);
        } catch (e) {
            showToast('Erro ao carregar comboios: ' + e.message, 'erro');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const r = await apiClient.adminSyncComboios();
            showToast(r.message || 'Sincronização concluída.');
            await load();
        } catch (e) {
            showToast('Erro na sincronização: ' + e.message, 'erro');
        } finally {
            setSyncing(false);
        }
    };

    const handleToggle = async (vehicleId, ativo) => {
        try {
            if (ativo) await apiClient.adminDeactivateComboio(vehicleId);
            else       await apiClient.adminActivateComboio(vehicleId);
            showToast(ativo ? 'Comboio desativado.' : 'Comboio ativado.');
            await load();
        } catch (e) {
            showToast('Erro: ' + e.message, 'erro');
        }
    };

    const handleSaveContacts = async (vehicleId) => {
        setSavingId(vehicleId);
        try {
            await apiClient.adminUpdateComboioPartnerContacts(vehicleId, edits[vehicleId] || {});
            showToast('Contatos atualizados.');
            await load();
        } catch (e) {
            showToast('Erro ao salvar: ' + e.message, 'erro');
        } finally {
            setSavingId(null);
        }
    };

    const updateField = (vehicleId, field, value) => {
        setEdits(prev => ({
            ...prev,
            [vehicleId]: { ...(prev[vehicleId] || {}), [field]: value }
        }));
    };

    const togglePeriodos = async (vehicleId) => {
        const current = periodos[vehicleId];
        if (current?.open) {
            setPeriodos(prev => ({ ...prev, [vehicleId]: { ...current, open: false } }));
            return;
        }
        setPeriodos(prev => ({ ...prev, [vehicleId]: { open: true, loading: true, data: [] } }));
        try {
            const data = await apiClient.adminGetComboioPeriodos(vehicleId);
            setPeriodos(prev => ({ ...prev, [vehicleId]: { open: true, loading: false, data: Array.isArray(data) ? data : [] } }));
        } catch (e) {
            showToast('Erro ao carregar períodos: ' + e.message, 'erro');
            setPeriodos(prev => ({ ...prev, [vehicleId]: { open: true, loading: false, data: [] } }));
        }
    };

    const fmtDate = (d) => d ? new Date(d).toLocaleString('pt-BR') : '—';
    const fmtLiters = (n) => `${(Number(n) || 0).toFixed(1)} L`;

    if (loading) return (
        <div className="flex justify-center items-center py-20 text-gray-500">
            <Loader className="animate-spin mr-2" /> Carregando comboios…
        </div>
    );

    return (
        <div className="space-y-5">
            <Toast {...toast} />

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Truck size={20} className="text-yellow-500" />
                        Veículos-Comboio
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Cada veículo marcado como comboio é espelhado em <code>partners</code> (tipo <strong>comboio</strong>)
                        para aparecer nas listas de postos e receber ordens.
                    </p>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="px-3 py-2 bg-yellow-400 hover:bg-yellow-300 rounded-lg text-sm font-bold flex items-center gap-1 disabled:opacity-50"
                >
                    {syncing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Sincronizar
                </button>
            </div>

            {comboios.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 p-4 rounded-lg flex items-center gap-3">
                    <AlertTriangle size={20} />
                    <span className="text-sm">
                        Nenhum veículo está marcado como comboio. Marque um veículo na página de Veículos para criá-lo aqui.
                    </span>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {comboios.map(c => {
                        const ativo = c.partner?.status_operacional === 'ATIVO';
                        const fields = edits[c.vehicleId] || {};
                        return (
                            <div key={c.vehicleId} className="bg-white border rounded-xl p-4 shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                            <Truck size={16} className="text-yellow-600" />
                                            {c.registroInterno} <span className="text-gray-400 font-normal">— {c.placa}</span>
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5">{c.modelo}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Partner: <code>{c.partnerId}</code>
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {c.partner ? (
                                            ativo ? (
                                                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded inline-flex items-center gap-1 font-bold">
                                                    <CheckCircle size={12}/> ATIVO
                                                </span>
                                            ) : (
                                                <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded inline-flex items-center gap-1 font-bold">
                                                    <XCircle size={12}/> BLOQUEADO
                                                </span>
                                            )
                                        ) : (
                                            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold">
                                                AUSENTE
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleToggle(c.vehicleId, ativo)}
                                            className="text-[11px] text-blue-600 hover:underline mt-1"
                                        >
                                            {ativo ? 'Desativar' : (c.partner ? 'Reativar' : 'Criar')}
                                        </button>
                                    </div>
                                </div>

                                <div className="border-t pt-3 space-y-2">
                                    <p className="text-[11px] uppercase font-bold text-gray-500">
                                        Contatos para envio de ordem
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 text-sm">
                                        <label className="flex items-center gap-2">
                                            <Phone size={14} className="text-gray-400 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Telefone"
                                                value={fields.telefone || ''}
                                                onChange={e => updateField(c.vehicleId, 'telefone', e.target.value)}
                                                className="flex-1 p-2 border rounded text-sm"
                                            />
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <MessageCircle size={14} className="text-green-500 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="WhatsApp (55519...)"
                                                value={fields.whatsapp || ''}
                                                onChange={e => updateField(c.vehicleId, 'whatsapp', e.target.value)}
                                                className="flex-1 p-2 border rounded text-sm"
                                            />
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <Mail size={14} className="text-blue-500 shrink-0" />
                                            <input
                                                type="email"
                                                placeholder="E-mail"
                                                value={fields.email || ''}
                                                onChange={e => updateField(c.vehicleId, 'email', e.target.value)}
                                                className="flex-1 p-2 border rounded text-sm"
                                            />
                                        </label>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <button
                                            onClick={() => togglePeriodos(c.vehicleId)}
                                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                                        >
                                            <History size={12}/> Histórico por obra
                                            {periodos[c.vehicleId]?.open
                                                ? <ChevronUp size={12}/>
                                                : <ChevronDown size={12}/>}
                                        </button>
                                        <button
                                            onClick={() => handleSaveContacts(c.vehicleId)}
                                            disabled={savingId === c.vehicleId}
                                            className="px-3 py-1.5 bg-gray-900 text-white rounded text-xs font-bold inline-flex items-center gap-1 hover:bg-gray-800 disabled:opacity-50"
                                        >
                                            {savingId === c.vehicleId
                                                ? <Loader size={12} className="animate-spin"/>
                                                : <Save size={12}/>}
                                            Salvar contatos
                                        </button>
                                    </div>
                                </div>

                                {periodos[c.vehicleId]?.open && (
                                    <div className="mt-3 border-t pt-3">
                                        {periodos[c.vehicleId].loading ? (
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Loader size={12} className="animate-spin"/> Carregando histórico…
                                            </div>
                                        ) : periodos[c.vehicleId].data.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">Sem períodos registrados ainda.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {periodos[c.vehicleId].data.map(p => (
                                                    <div key={p.id} className={`p-2 rounded border text-xs ${p.ativo ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="font-bold text-gray-800 flex items-center gap-1">
                                                                <MapPin size={11} className="text-blue-500"/>
                                                                {p.obra_nome || `obra:${p.obra_id}`}
                                                            </div>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.ativo ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}`}>
                                                                {p.ativo ? 'ATIVO' : 'encerrado'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-gray-600 mb-1">
                                                            {fmtDate(p.data_inicio)} → {p.data_fim ? fmtDate(p.data_fim) : 'agora'}
                                                        </div>
                                                        <div className="flex gap-3 text-[11px]">
                                                            <span className="text-blue-700">↑ Entrada: <strong>{fmtLiters(p.totais?.entrada)}</strong></span>
                                                            <span className="text-yellow-700">↓ Saída: <strong>{fmtLiters(p.totais?.saida)}</strong></span>
                                                            {Number(p.totais?.drenagem) > 0 && (
                                                                <span className="text-orange-700">⟲ Drenagem: <strong>{fmtLiters(p.totais.drenagem)}</strong></span>
                                                            )}
                                                            <span className="ml-auto text-gray-500">{p.totais?.qtdTotal || 0} transações</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ComboiosAdminTab;
