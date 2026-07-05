import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Calendar, Loader, Lightbulb } from 'lucide-react';

import KPIRow from '../components/dashboard/KPIRow';
import ObrasFocus from '../components/dashboard/ObrasFocus';
import RankingObras from '../components/dashboard/RankingObras';
import PulseChart from '../components/dashboard/PulseChart';
import AlertsCompact from '../components/dashboard/AlertsCompact';
import AgendaModal from '../components/modals/AgendaModal';
import SuggestionModal from '../components/modals/SuggestionModal';

const fmtPeriod = (start, end) => {
    if (!start || !end) return '';
    const [, , sd] = start.split('-');
    const [, em, ed] = end.split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${sd}/${meses[parseInt(start.split('-')[1], 10) - 1]} – ${ed}/${meses[parseInt(em, 10) - 1]}`;
};

const Dashboard = ({ navigate, apiClient, setAlertMessage }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAgenda, setShowAgenda] = useState(false);
    const [showSuggestion, setShowSuggestion] = useState(false);
    const [notificacoesAgenda, setNotificacoesAgenda] = useState(0);

    const load = useCallback(async () => {
        try {
            setError(null);
            const summary = await apiClient.getDashboardHomeSummary();
            setData(summary);
        } catch (e) {
            console.error('Erro carregando dashboard:', e);
            setError(e.message || 'Erro ao carregar o painel.');
        } finally {
            setLoading(false);
        }
    }, [apiClient]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 300000);
        return () => clearInterval(interval);
    }, [load]);

    useEffect(() => {
        const fetchAgenda = async () => {
            try {
                if (apiClient && apiClient.get) {
                    const response = await apiClient.get('/agenda/notificacoes');
                    if (response.data) setNotificacoesAgenda(response.data.length);
                }
            } catch (e) { /* silencioso */ }
        };
        fetchAgenda();
        const interval = setInterval(fetchAgenda, 300000);
        return () => clearInterval(interval);
    }, [apiClient]);

    const period = data?.period;
    const consolidatedUntil = period?.consolidatedUntil;

    return (
        <div className="space-y-4 pb-10">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-stone-900 inline-flex items-center gap-2">
                        <Activity size={18} className="text-amber-700" /> Painel executivo
                    </h1>
                    <p className="text-xs text-stone-500 mt-0.5">
                        {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                        {period && (
                            <>
                                {' · '}janela {fmtPeriod(period.start, period.end)}
                                {' · '}<span className="text-stone-400">consolidado até {consolidatedUntil?.split('-').reverse().join('/')}</span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSuggestion(true)}
                        className="bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <Lightbulb size={16} className="text-yellow-500" /> Sugestão
                    </button>
                    <button
                        onClick={() => setShowAgenda(true)}
                        className="relative bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <Calendar size={16} /> Agenda / Avisos
                        {notificacoesAgenda > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                {notificacoesAgenda}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {loading && !data && (
                <div className="flex items-center justify-center py-20 text-stone-500">
                    <Loader size={20} className="animate-spin mr-2" /> Carregando painel…
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                    {error} <button onClick={load} className="underline ml-2">Tentar novamente</button>
                </div>
            )}

            {data && (
                <>
                    <KPIRow kpis={data.kpis} />

                    <ObrasFocus
                        obras={data.obrasEmFoco || []}
                        onNavigateAll={() => navigate && navigate('obras')}
                    />

                    <RankingObras ranking={data.ranking} />

                    <PulseChart pulse={data.pulse} />

                    <AlertsCompact alerts={data.alerts} navigate={navigate} />
                </>
            )}

            {showSuggestion && (
                <SuggestionModal
                    onClose={() => setShowSuggestion(false)}
                    setAlertMessage={setAlertMessage || ((m) => window.alert(m))}
                />
            )}

            <AgendaModal
                isOpen={showAgenda}
                onClose={() => setShowAgenda(false)}
                onEventUpdate={() => {}}
            />
        </div>
    );
};

export default Dashboard;
