import React, { useEffect, useState, useCallback } from 'react';
import { Loader, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import Timeline3Trilhas from './Timeline3Trilhas';

const fmtMin = (min) => {
    if (!min) return '0min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (!h) return `${m}min`;
    if (!m) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
};

const TIPO_DOT = {
    maquina_alem_do_faturado:     'bg-red-500',
    faturado_alem_da_maquina:     'bg-orange-500',
    sem_lancamento_com_atividade: 'bg-amber-500',
    gap_ponto_maquina_inicio:     'bg-purple-500',
    gap_ponto_maquina_fim:        'bg-purple-500',
};

const DiscrepanciaDrill = ({ apiClient, discrepanciaId, onBack, setAlertMessage }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [justificativa, setJustificativa] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.getAnaliseDiscrepanciaDrill(discrepanciaId);
            setData(res);
            setJustificativa(res.justificativa || '');
        } catch (e) {
            setAlertMessage?.(e.message || 'Erro ao carregar drill.');
        } finally {
            setLoading(false);
        }
    }, [apiClient, discrepanciaId, setAlertMessage]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleJustificar = async () => {
        if (!justificativa.trim()) {
            setAlertMessage?.('Escreva uma justificativa antes de salvar.');
            return;
        }
        setSaving(true);
        try {
            await apiClient.justificarAnaliseDiscrepancia(discrepanciaId, justificativa.trim());
            setAlertMessage?.('Discrepância marcada como justificada.');
            await fetchData();
        } catch (e) {
            setAlertMessage?.(e.message || 'Erro ao justificar.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader className="animate-spin" size={32} style={{ color: '#9E7A42' }} />
            </div>
        );
    }
    if (!data) {
        return (
            <div className="p-10 text-center">
                <p className="text-slate-500 mb-4">Não foi possível carregar o detalhe desta discrepância.</p>
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-md text-white font-semibold inline-flex items-center gap-2"
                    style={{ background: '#9E7A42' }}
                >
                    <ArrowLeft size={14} /> Voltar
                </button>
            </div>
        );
    }

    const dataStr = (data.data || '').slice(0, 10);
    const fontes = data.fontesDisponiveis || {};
    const jaJustificado = !!data.justificadoEm;

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
                <button
                    onClick={onBack}
                    className="mt-1 p-1.5 rounded hover:bg-slate-200 transition-colors"
                    title="Voltar"
                >
                    <ArrowLeft size={18} className="text-slate-600" />
                </button>
                <div className="flex-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Detalhe da discrepância</p>
                    <h1 className="text-2xl font-bold text-slate-800">
                        {data.registroInterno || data.placa}
                        {data.operadorNome ? <span className="text-slate-400 font-normal"> / {data.operadorNome}</span> : null}
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {dataStr} · {data.obraNome || '(Sem obra atribuída)'} · fonte: {data.fonteSinal}
                    </p>
                </div>
                {jaJustificado && (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                        <ShieldCheck size={13} /> Justificada
                    </span>
                )}
            </div>

            {/* Narrativa */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
                <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{data.narrativa}</p>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow-sm p-5 mb-5">
                <h3 className="font-semibold text-slate-800 text-sm mb-4">Linha do tempo (24h)</h3>
                <Timeline3Trilhas
                    dataStr={dataStr}
                    faturado={data.faturadoIntervalos}
                    rastreador={data.rastreadorIntervalos}
                    ponto={data.pontoIntervalos}
                    pontoPending={!fontes.ponto}
                />
                {/* Legenda */}
                <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <Legenda color="bg-blue-500"    label="Faturado"   active={fontes.faturado} />
                    <Legenda color="bg-emerald-500" label="Rastreador" active={fontes.rastreador} />
                    <Legenda color="bg-purple-500" label="Ponto"       active={fontes.ponto} />
                </div>
            </div>

            {/* Lista de discrepâncias detectadas */}
            <div className="bg-white rounded-lg shadow-sm mb-5">
                <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800 text-sm">Discrepâncias detectadas</h3>
                </div>
                <ul className="divide-y divide-slate-100">
                    {(data.discrepancias || []).map((d, idx) => (
                        <li key={idx} className="px-4 py-2.5 flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TIPO_DOT[d.tipo] || 'bg-slate-400'}`} />
                            <span className="font-mono text-xs text-slate-500">{d.tipo}</span>
                            <span className="ml-auto font-bold text-slate-700">{fmtMin(d.magnitude_min)}</span>
                        </li>
                    ))}
                    {(!data.discrepancias || data.discrepancias.length === 0) && (
                        <li className="px-4 py-6 text-center text-slate-400 text-xs">Sem discrepâncias.</li>
                    )}
                </ul>
            </div>

            {/* Justificar */}
            <div className="bg-white rounded-lg shadow-sm p-5">
                <h3 className="font-semibold text-slate-800 text-sm mb-2">
                    {jaJustificado ? 'Justificativa registrada' : 'Justificar discrepância'}
                </h3>
                {jaJustificado && (
                    <p className="text-xs text-slate-500 mb-2">
                        Por <strong>{data.justificadoPor || '—'}</strong> em {new Date(data.justificadoEm).toLocaleString('pt-BR')}.
                    </p>
                )}
                <textarea
                    value={justificativa}
                    onChange={e => setJustificativa(e.target.value)}
                    disabled={jaJustificado || saving}
                    rows={3}
                    placeholder="Ex.: máquina ficou esperando carregamento da pá — confirmado com o supervisor da obra."
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
                {!jaJustificado && (
                    <button
                        onClick={handleJustificar}
                        disabled={saving || !justificativa.trim()}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded text-white font-semibold text-sm disabled:opacity-50"
                        style={{ background: '#9E7A42' }}
                    >
                        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Marcar como justificada
                    </button>
                )}
            </div>
        </div>
    );
};

const Legenda = ({ color, label, active }) => (
    <span className={`flex items-center gap-1.5 ${active ? 'text-slate-600' : 'text-slate-300 line-through'}`}>
        <span className={`w-3 h-3 rounded-sm ${active ? color : 'bg-slate-200'}`} />
        {label}
    </span>
);

export default DiscrepanciaDrill;
