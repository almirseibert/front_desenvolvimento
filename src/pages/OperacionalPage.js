import React, { useState, useMemo, useEffect } from 'react';
import {
    Activity, Search, X, ArrowRight, AlertTriangle,
    BarChart2, ChevronLeft, PackageX, Truck, TrendingUp,
    Gauge, MapPin, User, Clock, Fuel, FileText, Mail, Phone, Send
} from 'lucide-react';
import apiClientModule from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import { formatObraNome } from '../utils/obraFormat';
import { getAllowedReadingTypes } from '../utils/vehicleRules';
import TerceirizadoBadge from '../components/ui/TerceirizadoBadge';

const GAP_THRESHOLD_DAYS = 10;

const JUSTIFICATIVA_LABELS = {
    chuva: 'Chuva',
    maquina_parada: 'Máquina Parada',
    feriado: 'Feriado / Folga',
    outro: 'Outro',
};

const OperacionalPage = ({
    vehicles = [],
    obras = [],
    employees = [],
    vehicleGroups = {},
    dailyWorkLogs = [],
    refuelings = [],
    setAlertMessage,
    navigate,
    apiClient = apiClientModule,
}) => {
    const { isViewer } = useAuth();

    const [activeView, setActiveView] = useState('obra');

    // ==========================================================
    // HELPERS COMPARTILHADOS
    // ==========================================================

    const isHeavyVehicle = (tipo) => !vehicleGroups['Veículos Leves']?.includes(tipo);

    const formatDecimalToTime = (decimal) => {
        const val = parseFloat(decimal);
        if (isNaN(val) || val === 0) return '00:00';
        const hours = Math.floor(val);
        const minutes = Math.round((val - hours) * 60);
        const fh = minutes === 60 ? hours + 1 : hours;
        const fm = minutes === 60 ? 0 : minutes;
        return `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
    };

    const formatDateToBR = (dateString) => {
        if (!dateString) return '—';
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    };

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    // ==========================================================
    // VIEW: POR OBRA — estados
    // ==========================================================

    const [obraId, setObraId] = useState('');
    const [obraLogs, setObraLogs] = useState([]);
    const [loadingObra, setLoadingObra] = useState(false);
    const [obraSearch, setObraSearch] = useState('');
    const [obraRisk, setObraRisk] = useState('');
    const [obraStatus, setObraStatus] = useState('ativas');
    const [obraHasActive, setObraHasActive] = useState('');
    const [obraSort, setObraSort] = useState('risco');
    const [obraDetailStatus, setObraDetailStatus] = useState('todos');
    const [obraDetailSort, setObraDetailSort] = useState('padrao');
    const [showCentroCusto, setShowCentroCusto] = useState(false);

    useEffect(() => {
        if (obraId && activeView === 'obra') fetchObraData();
        if (!obraId) setObraLogs([]);
    }, [obraId, activeView]);

    const fetchObraData = async () => {
        const obra = obras.find(o => o.id === obraId);
        if (!obra) return;
        setLoadingObra(true);
        try {
            const startDate = obra.dataInicio.split('T')[0];
            const endDate = obra.dataFim ? obra.dataFim.split('T')[0] : new Date().toISOString().split('T')[0];
            const logs = await apiClient.getDailyLogs(obraId, { startDate, endDate });
            setObraLogs(logs || []);
        } catch {
            setAlertMessage('Erro ao carregar dados da obra.');
        } finally {
            setLoadingObra(false);
        }
    };

    // ==========================================================
    // VIEW: POR OBRA — memos
    // ==========================================================

    const riskConfig = {
        critico: { border: 'border-red-500', badge: 'bg-red-100 text-red-700',       label: 'Sem Registro' },
        atencao: { border: 'border-orange-400', badge: 'bg-orange-100 text-orange-700', label: 'Atenção'    },
        ok:      { border: 'border-green-500', badge: 'bg-green-100 text-green-700',  label: 'Operando'    },
    };

    const obrasComRisco = useMemo(() => {
        return obras.filter(o => showCentroCusto || (o.tipo_registro || 'obra') !== 'centro_custo').map(obra => {
            const isFinished = obra.status === 'finalizada' || obra.status === 'Finalizada' ||
                obra.status === 'Concluída' || obra.status === 'Inativa' ||
                (obra.dataFim && new Date(obra.dataFim) < today);

            const historico = obra.historicoVeiculos || [];
            const pesados = historico.filter(h => {
                const v = vehicles.find(vv => vv.id === h.veiculoId);
                return v && isHeavyVehicle(v.tipo);
            });

            const ativos = pesados.filter(h => !h.dataSaida).length;
            const inativos = new Set(pesados.filter(h => !!h.dataSaida).map(h => h.veiculoId)).size;
            const totalUnicos = new Set(pesados.map(h => h.veiculoId)).size;
            const totalHoras = parseFloat(obra.totalHorasRealizadas) || 0;

            const inicio = obra.dataInicio ? new Date(obra.dataInicio) : null;
            inicio?.setHours(0, 0, 0, 0);
            const diasDeObra = inicio ? Math.max(1, Math.floor((today - inicio) / 86400000)) : 0;

            let riskScore = 0;
            let riskLevel = 'ok';
            const riskReasons = [];

            let equipSemLancamento10d = 0;
            if (!isFinished) {
                if (ativos > 0 && totalHoras === 0 && diasDeObra > 7) {
                    riskScore += 10;
                    riskReasons.push(`${ativos} equip. ativo${ativos > 1 ? 's' : ''} sem nenhum lançamento após ${diasDeObra}d de obra`);
                }
                const pesadosAtivos = historico.filter(h => {
                    const v = vehicles.find(vv => vv.id === h.veiculoId);
                    return v && isHeavyVehicle(v.tipo) && !h.dataSaida;
                });
                pesadosAtivos.forEach(h => {
                    const entrada = new Date(h.dataEntrada);
                    entrada.setHours(0, 0, 0, 0);
                    if (Math.floor((today - entrada) / 86400000) <= 10) return;
                    const vehicleLogs = (dailyWorkLogs || []).filter(l => {
                        if (String(l.vehicleId) !== String(h.veiculoId)) return false;
                        const logDate = new Date(l.date.split('T')[0] + 'T00:00:00Z');
                        return logDate >= entrada;
                    });
                    const lastLogDate = [...vehicleLogs].sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date?.split('T')[0] || null;
                    const daysSinceLast = lastLogDate
                        ? Math.floor((today - new Date(lastLogDate + 'T12:00:00Z')) / 86400000)
                        : Math.floor((today - entrada) / 86400000);
                    if (daysSinceLast > 10) equipSemLancamento10d++;
                });
                if (equipSemLancamento10d > 0) {
                    riskScore += 3;
                    riskReasons.push(`${equipSemLancamento10d} equip. ativo${equipSemLancamento10d > 1 ? 's' : ''} sem lançamento há mais de 10 dias`);
                }
                if (riskReasons.length === 0) {
                    riskReasons.push('Nenhum fator de risco identificado.');
                    riskReasons.push(`${ativos} equip. ativo${ativos > 1 ? 's' : ''} com lançamentos registrados.`);
                }
            } else {
                riskReasons.push('Obra finalizada — avaliação do período encerrado.');
                if (totalHoras > 0) riskReasons.push(`Total registrado: ${formatDecimalToTime(totalHoras)}h.`);
            }

            if (riskScore >= 10) riskLevel = 'critico';
            else if (riskScore >= 3) riskLevel = 'atencao';
            else riskLevel = 'ok';

            return { obra, isFinished, ativos, inativos, equipSemLancamento10d, totalUnicos, totalHoras, diasDeObra, riskLevel, riskScore, riskReasons };
        }).sort((a, b) => {
            if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
            if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
            if (b.ativos !== a.ativos) return b.ativos - a.ativos;
            return a.obra.nome.localeCompare(b.obra.nome);
        });
    }, [obras, vehicles, vehicleGroups, dailyWorkLogs, today, showCentroCusto]);

    const obrasFiltradas = useMemo(() => {
        let result = [...obrasComRisco];
        if (obraStatus === 'ativas') result = result.filter(o => !o.isFinished);
        else if (obraStatus === 'finalizadas') result = result.filter(o => o.isFinished);
        if (obraRisk) result = result.filter(o => o.riskLevel === obraRisk);
        if (obraHasActive === 'sim') result = result.filter(o => o.ativos > 0);
        else if (obraHasActive === 'nao') result = result.filter(o => o.ativos === 0);
        if (obraSearch.trim()) result = result.filter(o => o.obra.nome.toLowerCase().includes(obraSearch.toLowerCase().trim()));
        if (obraSort === 'risco') {
            const riskOrder = { critico: 0, atencao: 1, ok: 2 };
            result = [...result].sort((a, b) => {
                if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
                if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
                if (b.ativos !== a.ativos) return b.ativos - a.ativos;
                return a.obra.nome.localeCompare(b.obra.nome);
            });
        } else if (obraSort === 'dataInicio') {
            result = [...result].sort((a, b) => new Date(a.obra.dataInicio) - new Date(b.obra.dataInicio));
        } else if (obraSort === 'semLancamento') {
            result = [...result].sort((a, b) => {
                const sA = a.totalHoras === 0 ? a.diasDeObra * 1000 : a.diasDeObra / Math.max(1, a.totalHoras);
                const sB = b.totalHoras === 0 ? b.diasDeObra * 1000 : b.diasDeObra / Math.max(1, b.totalHoras);
                return sB - sA;
            });
        }
        return result;
    }, [obrasComRisco, obraSearch, obraRisk, obraStatus, obraHasActive, obraSort]);

    const hasObraFilters = obraSearch !== '' || obraRisk !== '' || obraStatus !== 'ativas' || obraHasActive !== '' || obraSort !== 'risco';

    const clearObraFilters = () => {
        setObraSearch(''); setObraRisk(''); setObraStatus('ativas');
        setObraHasActive(''); setObraSort('risco');
    };

    const obraStats = useMemo(() => {
        if (!obraId) return { vehicleStats: [], summary: null };
        const obra = obras.find(o => o.id === obraId);
        if (!obra?.historicoVeiculos) return { vehicleStats: [], summary: null };

        const horasContratadasRaw = obra.horasContratadasPorTipo;
        const horasContratadas = typeof horasContratadasRaw === 'string'
            ? JSON.parse(horasContratadasRaw || '{}')
            : (horasContratadasRaw || {});
        const totalContratado = Object.values(horasContratadas).reduce((s, h) => s + (parseFloat(h) || 0), 0);

        const vehicleHistoryMap = {};
        obra.historicoVeiculos.forEach(h => {
            if (!vehicleHistoryMap[h.veiculoId]) vehicleHistoryMap[h.veiculoId] = [];
            vehicleHistoryMap[h.veiculoId].push(h);
        });

        const vehicleStats = Object.entries(vehicleHistoryMap).map(([vehicleId, periods]) => {
            const vehicle = vehicles.find(v => String(v.id) === String(vehicleId));
            if (!vehicle || !isHeavyVehicle(vehicle.tipo)) return null;

            const sortedPeriods = [...periods].sort((a, b) => new Date(a.dataEntrada) - new Date(b.dataEntrada));
            const activePeriod = sortedPeriods.find(p => !p.dataSaida);
            const isActive = !!activePeriod;
            const relevantPeriod = activePeriod ?? sortedPeriods[sortedPeriods.length - 1];
            const entryDate = relevantPeriod?.dataEntrada || null;

            const vehicleLogs = obraLogs.filter(l => String(l.vehicleId) === String(vehicleId));
            const totalHours = vehicleLogs.reduce((acc, l) => acc + parseFloat(l.totalHours || 0), 0);

            // allDays de todos os períodos — usado apenas para cobertura total (daysWithLogs / totalDays)
            const allDaysSet = new Set();
            const logDateSet = new Set(vehicleLogs.map(l => l.date.split('T')[0]));
            periods.forEach(p => {
                let d = new Date(p.dataEntrada); d.setHours(0, 0, 0, 0);
                const end = p.dataSaida ? new Date(p.dataSaida) : today; end.setHours(0, 0, 0, 0);
                while (d <= end) { allDaysSet.add(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
            });
            const allDays = [...allDaysSet].sort();
            const daysWithLogs = allDays.filter(d => logDateSet.has(d)).length;

            // Gap e lastLogDate calculados apenas no período atual/mais recente
            const periodStartStr = relevantPeriod.dataEntrada.split('T')[0];
            const periodEndStr = relevantPeriod.dataSaida
                ? relevantPeriod.dataSaida.split('T')[0]
                : new Date().toISOString().split('T')[0];

            const currentPeriodDays = [];
            { const cur = new Date(periodStartStr + 'T00:00:00Z');
              const end = new Date(periodEndStr + 'T00:00:00Z');
              while (cur <= end) { currentPeriodDays.push(cur.toISOString().split('T')[0]); cur.setUTCDate(cur.getUTCDate() + 1); } }

            const currentPeriodLogSet = new Set(
                vehicleLogs.map(l => l.date.split('T')[0]).filter(d => d >= periodStartStr && d <= periodEndStr)
            );

            let maxGapHistorico = 0, gapAcc = 0;
            currentPeriodDays.forEach(d => {
                if (!currentPeriodLogSet.has(d)) { gapAcc++; maxGapHistorico = Math.max(maxGapHistorico, gapAcc); }
                else gapAcc = 0;
            });

            const sortedCurrentLogs = vehicleLogs
                .filter(l => { const d = l.date.split('T')[0]; return d >= periodStartStr && d <= periodEndStr; })
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastLogDate = sortedCurrentLogs[0]?.date?.split('T')[0] || null;
            const daysSinceLast = lastLogDate ? Math.floor((today - new Date(lastLogDate)) / 86400000) : null;
            const maxGap = Math.max(maxGapHistorico, daysSinceLast ?? 0);

            const contractedHours = parseFloat(horasContratadas[vehicle.tipo] || 0);
            const coveragePercent = contractedHours > 0 ? (totalHours / contractedHours) * 100 : null;

            let status = 'ok';
            if (currentPeriodLogSet.size === 0 && currentPeriodDays.length > 3) status = 'nunca';
            else if (maxGap > GAP_THRESHOLD_DAYS) status = 'atencao';

            return {
                vehicleId: String(vehicleId), vehicle, isActive,
                periods: sortedPeriods,
                totalDays: allDays.length, daysWithLogs, totalHours, contractedHours,
                lastLogDate, daysSinceLast, maxGap, status, coveragePercent,
                lastLogJustificativaTipo: sortedCurrentLogs[0]?.justificativaTipo || null,
                entryDate,
            };
        }).filter(Boolean).sort((a, b) => {
            const order = { nunca: 0, atencao: 1, ok: 2 };
            if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
            return (a.vehicle.registroInterno || '').localeCompare(b.vehicle.registroInterno || '');
        });

        const withAlerts = vehicleStats.filter(v => v.status !== 'ok').length;
        const totalHorasObra = vehicleStats.reduce((acc, v) => acc + v.totalHours, 0);
        const allLogDates = [...obraLogs].map(l => l.date.split('T')[0]).sort();

        return {
            vehicleStats,
            summary: {
                total: vehicleStats.length,
                active: vehicleStats.filter(v => v.isActive).length,
                withAlerts, totalHoras: totalHorasObra, totalContratado,
                lastLog: allLogDates[allLogDates.length - 1] || null,
            }
        };
    }, [obraId, obraLogs, obras, vehicles, vehicleGroups, today]);

    const obraStatsFiltered = useMemo(() => {
        let stats = [...(obraStats.vehicleStats || [])];
        if (obraDetailStatus === 'ativos') stats = stats.filter(s => s.isActive);
        else if (obraDetailStatus === 'inativos') stats = stats.filter(s => !s.isActive);
        if (obraDetailSort === 'horas') stats = stats.sort((a, b) => b.totalHours - a.totalHours);
        else if (obraDetailSort === 'gap') stats = stats.sort((a, b) => b.maxGap - a.maxGap);
        else if (obraDetailSort === 'cobertura') {
            stats = stats.sort((a, b) => {
                if (a.coveragePercent === null && b.coveragePercent === null) return 0;
                if (a.coveragePercent === null) return 1;
                if (b.coveragePercent === null) return -1;
                return a.coveragePercent - b.coveragePercent;
            });
        }
        return stats;
    }, [obraStats.vehicleStats, obraDetailStatus, obraDetailSort]);

    // ==========================================================
    // VIEW: POR OBRA — render helpers
    // ==========================================================

    const renderRiskBadge = (riskLevel, riskScore, riskReasons, size = 'sm') => {
        const cfg = riskConfig[riskLevel];
        const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
        return (
            <div className="relative group inline-block">
                <span className={`cursor-help rounded-full font-bold ${sizeClass} ${cfg.badge}`}>{cfg.label}</span>
                <div className="pointer-events-none absolute right-0 top-full mt-2 z-50 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-3.5">
                    <div className="absolute -top-1.5 right-4 w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
                    <p className="font-bold mb-2 text-yellow-400 uppercase tracking-wider text-[10px]">Composição do status</p>
                    <ul className="space-y-1.5">
                        {riskReasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-snug">
                                <span className="mt-px shrink-0 text-yellow-400">·</span>
                                <span>{reason}</span>
                            </li>
                        ))}
                    </ul>
                    {riskScore > 0 && (
                        <p className="mt-2.5 pt-2 border-t border-gray-700 text-gray-400 text-[10px]">
                            Score: <span className="font-bold text-white">{riskScore} pts</span>
                            {riskScore >= 10 ? ' — Sem Registro (≥ 10)' : riskScore >= 3 ? ' — Atenção (3–9)' : ''}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    const renderStatusBadge = (status, isActive) => {
        if (status === 'nunca') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Sem lançamentos</span>;
        if (status === 'atencao') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">Gap &gt; {GAP_THRESHOLD_DAYS}d</span>;
        if (!isActive) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Encerrado</span>;
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Sem gaps</span>;
    };

    const renderCoverageBar = (coveragePercent, totalHours, contractedHours) => {
        if (coveragePercent === null || contractedHours === 0) {
            return (
                <div className="text-xs text-gray-400 italic leading-tight">
                    {totalHours > 0 ? formatDecimalToTime(totalHours) + 'h' : '—'}
                    <span className="block text-[10px] text-gray-300">s/ contrato</span>
                </div>
            );
        }
        const isOver = coveragePercent > 100;
        const barWidth = Math.min(coveragePercent, 100);
        const color = isOver ? 'bg-blue-500' : barWidth === 0 ? 'bg-red-400' : barWidth < 50 ? 'bg-orange-400' : barWidth < 80 ? 'bg-yellow-400' : 'bg-green-500';
        return (
            <div>
                <div className="flex items-center gap-2 mb-0.5">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
                        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className={`text-xs font-medium w-8 text-right ${isOver ? 'text-blue-600' : 'text-gray-600'}`}>{Math.round(coveragePercent)}%</span>
                </div>
                <span className="text-[10px] text-gray-400">{formatDecimalToTime(totalHours)} / {formatDecimalToTime(contractedHours)}h</span>
            </div>
        );
    };

    // ==========================================================
    // VIEW: POR MÁQUINA — estados
    // ==========================================================

    const [maqSearch, setMaqSearch] = useState('');
    const [maqCriticality, setMaqCriticality] = useState('');
    const [maqObraId, setMaqObraId] = useState('');
    const [showWithoutObra, setShowWithoutObra] = useState(false);
    const [maqSort, setMaqSort] = useState('dias');
    const [selectedMachineId, setSelectedMachineId] = useState(null);
    const [requestForm, setRequestForm] = useState(null); // null | 'obra' | 'operador'
    const [requestValue, setRequestValue] = useState(null); // obra ou employee sugerido
    const [requestObs, setRequestObs] = useState('');
    const [requestSubmitting, setRequestSubmitting] = useState(false);

    const closeMachineModal = () => {
        setSelectedMachineId(null);
        setRequestForm(null);
        setRequestValue(null);
        setRequestObs('');
    };

    const openRequestForm = (tipo) => {
        setRequestForm(tipo);
        setRequestValue(null);
        setRequestObs('');
    };

    const [relatorioSubmitting, setRelatorioSubmitting] = useState(false);
    const [relatorioPreview, setRelatorioPreview] = useState(null); // { operador, mensagem, canais, payload }
    const [relatorioPreviewLoading, setRelatorioPreviewLoading] = useState(false);

    const abrirPreviewRelatorio = async () => {
        if (!selectedMachine?.operator) return;
        const payload = {
            employeeId: selectedMachine.operator.id,
            veiculo_registro: selectedMachine.vehicle.registroInterno || null,
            obra_nome: selectedMachine.currentObra ? formatObraNome(selectedMachine.currentObra) : null,
            dias: selectedMachine.daysSinceLastLog,
        };
        setRelatorioPreviewLoading(true);
        try {
            const res = await apiClient.previewRelatorioHoras(payload);
            setRelatorioPreview({ ...res, payload });
        } catch (e) {
            setAlertMessage(e.message || 'Erro ao montar a pré-visualização da cobrança.');
        } finally {
            setRelatorioPreviewLoading(false);
        }
    };

    const confirmarEnvioRelatorio = async () => {
        if (!relatorioPreview?.payload) return;
        setRelatorioSubmitting(true);
        try {
            const res = await apiClient.solicitarRelatorioHoras(relatorioPreview.payload);
            const canais = (res?.enviados || []).map(c => c === 'whatsapp' ? 'WhatsApp' : 'e-mail').join(' e ');
            setAlertMessage(canais ? `Cobrança enviada ao operador por ${canais}.` : 'Cobrança enviada ao operador.');
            setRelatorioPreview(null);
        } catch (e) {
            setAlertMessage(e.message || 'Erro ao enviar a cobrança ao operador.');
        } finally {
            setRelatorioSubmitting(false);
        }
    };

    const submitOperationalRequest = async () => {
        if (!selectedMachine || !requestValue) return;
        setRequestSubmitting(true);
        try {
            const isObra = requestForm === 'obra';
            await apiClient.createOperationalRequest({
                tipo: isObra ? 'mudanca_obra' : 'mudanca_operador',
                veiculo_id: selectedMachine.vehicle.id,
                veiculo_registro: selectedMachine.vehicle.registroInterno || null,
                obra_atual_id: selectedMachine.currentObra?.id || null,
                obra_atual_nome: selectedMachine.currentObra ? formatObraNome(selectedMachine.currentObra) : null,
                operador_atual_nome: selectedMachine.operator?.nome || selectedMachine.operator?.name || null,
                valor_sugerido_id: requestValue.id || null,
                valor_sugerido_nome: isObra ? formatObraNome(requestValue) : (requestValue.nome || requestValue.name),
                observacao: requestObs.trim() || null,
            });
            setAlertMessage('Requisição enviada ao administrador.');
            setRequestForm(null);
            setRequestValue(null);
            setRequestObs('');
        } catch (e) {
            const detail = e?.data?.detail || e?.data?.code || e?.message || '';
            setAlertMessage('Erro ao enviar requisição.' + (detail ? ` Detalhe: ${detail}` : ''));
        } finally {
            setRequestSubmitting(false);
        }
    };

    // ==========================================================
    // VIEW: POR MÁQUINA — memos
    // ==========================================================

    const machineData = useMemo(() => {
        const heavyVehicles = vehicles.filter(v => isHeavyVehicle(v.tipo) && v.ativo !== false);

        return heavyVehicles.map(vehicle => {
            let currentObra = null;
            let currentPeriod = null;
            for (const obra of obras) {
                const period = (obra.historicoVeiculos || []).find(
                    h => String(h.veiculoId) === String(vehicle.id) && !h.dataSaida
                );
                if (period) { currentObra = obra; currentPeriod = period; break; }
            }

            const allPeriods = obras.flatMap(o =>
                (o.historicoVeiculos || [])
                    .filter(h => String(h.veiculoId) === String(vehicle.id))
                    .map(h => ({ ...h, obra: o }))
            ).sort((a, b) => new Date(b.dataEntrada) - new Date(a.dataEntrada));

            const operatorId = currentPeriod?.employeeId;
            const operator = operatorId ? employees.find(e => String(e.id) === String(operatorId)) : null;

            const vehicleLogs = (dailyWorkLogs || []).filter(l => String(l.vehicleId) === String(vehicle.id));
            const sortedLogs = [...vehicleLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastLogDate = sortedLogs[0]?.date?.split('T')[0] || null; // sem filtro — usado em gapAfterReallocation

            // Para máquinas inativas, o gap é: último lançamento → dataSaida (não → hoje)
            let displayLastLogDate = lastLogDate;
            let daysSinceLastLog = null;
            if (!currentObra) {
                const lastPeriod = allPeriods.find(p => p.dataSaida); // allPeriods já está ordenado por dataEntrada desc
                const reallocationDate = lastPeriod
                    ? new Date(lastPeriod.dataSaida.split('T')[0] + 'T12:00:00Z')
                    : null;
                if (reallocationDate) {
                    const logsBeforeReallocation = sortedLogs.filter(l =>
                        new Date(l.date.split('T')[0] + 'T12:00:00Z') <= reallocationDate
                    );
                    displayLastLogDate = logsBeforeReallocation[0]?.date?.split('T')[0] || null;
                    if (displayLastLogDate) {
                        daysSinceLastLog = Math.floor((reallocationDate - new Date(displayLastLogDate + 'T12:00:00Z')) / 86400000);
                    }
                }
            } else {
                if (lastLogDate) {
                    daysSinceLastLog = Math.floor((today - new Date(lastLogDate + 'T12:00:00Z')) / 86400000);
                }
            }

            const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
            let gapAfterReallocation = false;
            let recentDepartureObra = null;
            for (const p of allPeriods) {
                if (!p.dataSaida) continue;
                const leftDate = new Date(p.dataSaida.split('T')[0] + 'T12:00:00Z');
                if (leftDate < thirtyDaysAgo) continue;
                const lastLogD = lastLogDate ? new Date(lastLogDate + 'T12:00:00Z') : null;
                if (!lastLogD || lastLogD < leftDate) {
                    gapAfterReallocation = true;
                    recentDepartureObra = p.obra;
                    break;
                }
            }

            let criticality;
            if (!currentObra) criticality = 'sem_obra';
            else if (vehicleLogs.length === 0) criticality = 'nunca';
            else if (daysSinceLastLog > 7) criticality = 'critico';
            else if (daysSinceLastLog > 3) criticality = 'atencao';
            else criticality = 'ok';

            return { vehicle, currentObra, operator, lastLogDate: displayLastLogDate, daysSinceLastLog, neverLogged: vehicleLogs.length === 0, criticality, gapAfterReallocation, recentDepartureObra };
        });
    }, [vehicles, obras, dailyWorkLogs, employees, vehicleGroups, today]);

    const maqSummary = useMemo(() => ({
        emObra: machineData.filter(m => m.currentObra).length,
        semLancamento3: machineData.filter(m => m.currentObra && (m.daysSinceLastLog === null || m.daysSinceLastLog > 3)).length,
        semLancamento7: machineData.filter(m => m.currentObra && (m.daysSinceLastLog === null || m.daysSinceLastLog > 7)).length,
        nunca: machineData.filter(m => m.criticality === 'nunca').length,
        semObra: machineData.filter(m => m.criticality === 'sem_obra').length,
        gap: machineData.filter(m => m.gapAfterReallocation).length,
    }), [machineData]);

    const selectedMachine = useMemo(() => {
        if (!selectedMachineId) return null;
        const base = machineData.find(m => String(m.vehicle.id) === String(selectedMachineId));
        if (!base) return null;

        // Total de horas registradas (todos os lançamentos do veículo)
        const vehicleLogs = (dailyWorkLogs || []).filter(l => String(l.vehicleId) === String(selectedMachineId));
        const totalHoras = vehicleLogs.reduce((acc, l) => acc + parseFloat(l.totalHours || 0), 0);
        const totalLancamentos = vehicleLogs.filter(l => parseFloat(l.totalHours || 0) > 0).length;

        // Última leitura registrada no abastecimento (horímetro/odômetro)
        const usaKm = getAllowedReadingTypes(base.vehicle.tipo).includes('odometro');
        const leituraLabel = usaKm ? 'Odômetro' : 'Horímetro';
        const leituraUnidade = usaKm ? 'Km' : 'h';
        const vehicleRefuelings = (refuelings || [])
            .filter(r => String(r.vehicleId) === String(selectedMachineId))
            .map(r => ({ ...r, leitura: usaKm ? parseFloat(r.odometro || 0) : parseFloat(r.horimetro || 0) }))
            .filter(r => r.leitura > 0)
            .sort((a, b) => new Date(b.data) - new Date(a.data));
        const ultimoAbastecimento = vehicleRefuelings[0] || null;

        return {
            ...base,
            totalHoras,
            totalLancamentos,
            leituraLabel,
            leituraUnidade,
            ultimaLeitura: ultimoAbastecimento ? ultimoAbastecimento.leitura : null,
            ultimaLeituraData: ultimoAbastecimento ? ultimoAbastecimento.data : null,
        };
    }, [selectedMachineId, machineData, dailyWorkLogs, refuelings]);

    const activeObras = useMemo(() =>
        obras.filter(o => {
            const s = (o.status || '').toLowerCase();
            return s !== 'finalizada' && s !== 'concluída' && s !== 'inativa' && (o.tipo_registro || 'obra') !== 'centro_custo';
        }),
        [obras]
    );

    const maqFiltered = useMemo(() => {
        let result = [...machineData];
        if (!showWithoutObra && maqCriticality !== 'sem_obra') result = result.filter(m => m.currentObra);
        if (maqCriticality) result = result.filter(m => m.criticality === maqCriticality);
        if (maqObraId) result = result.filter(m => String(m.currentObra?.id) === String(maqObraId));
        if (maqSearch.trim()) {
            const s = maqSearch.toLowerCase().trim();
            result = result.filter(m =>
                (m.vehicle.registroInterno || '').toLowerCase().includes(s) ||
                (m.vehicle.tipo || '').toLowerCase().includes(s) ||
                (m.vehicle.modelo || '').toLowerCase().includes(s) ||
                (m.vehicle.placa || '').toLowerCase().includes(s) ||
                (m.currentObra?.nome || '').toLowerCase().includes(s)
            );
        }
        const critOrder = { nunca: 0, critico: 1, atencao: 2, sem_obra: 3, ok: 4 };
        if (maqSort === 'maquina') result.sort((a, b) => (a.vehicle.registroInterno || '').localeCompare(b.vehicle.registroInterno || ''));
        else if (maqSort === 'obra') result.sort((a, b) => (a.currentObra?.nome || 'zzz').localeCompare(b.currentObra?.nome || 'zzz'));
        else result.sort((a, b) => {
            if (critOrder[a.criticality] !== critOrder[b.criticality]) return critOrder[a.criticality] - critOrder[b.criticality];
            return (b.daysSinceLastLog ?? 9999) - (a.daysSinceLastLog ?? 9999);
        });
        return result;
    }, [machineData, showWithoutObra, maqCriticality, maqObraId, maqSearch, maqSort]);

    const maqCritConfig = {
        nunca:    { row: 'bg-red-50 border-l-4 border-red-600',    badge: 'bg-red-100 text-red-700',      label: 'Nunca lançou' },
        critico:  { row: 'bg-red-50 border-l-4 border-red-400',    badge: 'bg-red-100 text-red-600',      label: 'Crítico'      },
        atencao:  { row: 'bg-orange-50 border-l-4 border-orange-400', badge: 'bg-orange-100 text-orange-700', label: 'Atenção'   },
        ok:       { row: 'border-l-4 border-green-400',             badge: 'bg-green-100 text-green-700', label: 'Em dia'       },
        sem_obra: { row: 'bg-gray-50 border-l-4 border-gray-300',   badge: 'bg-gray-100 text-gray-500',   label: 'Sem obra'     },
    };

    const MaqStatusBadge = ({ vehicle }) => {
        const status = vehicle.computedStatus || vehicle.status || 'Desconhecido';
        let cls = 'bg-gray-100 text-gray-600';
        if (status === 'Em Obra') cls = 'bg-blue-100 text-blue-700';
        else if (status === 'Em Operação') cls = 'bg-indigo-100 text-indigo-700';
        else if (status === 'Disponível') cls = 'bg-green-100 text-green-700';
        else if (status.includes('Manutenção') || status === 'Oficina') cls = 'bg-yellow-100 text-yellow-700';
        else if (status === 'Parada' || status === 'Inativo') cls = 'bg-red-100 text-red-600';
        return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{status}</span>;
    };

    const hasMaqFilters = maqSearch || maqCriticality || maqObraId || showWithoutObra;
    const clearMaqFilters = () => { setMaqSearch(''); setMaqCriticality(''); setMaqObraId(''); setShowWithoutObra(false); };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const [y, m, d] = dateStr.split('T')[0].split('-');
        return `${d}/${m}/${y}`;
    };

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" mb-1 flex items-center gap-2">
                <Activity className="text-yellow-500" /> Central Operacional
            </h1>
            <p className="text-gray-500 text-sm mb-6">Monitoramento de lançamentos por obra e por equipamento</p>

            {/* Abas de visão */}
            <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-lg shadow-sm px-2">
                <button
                    onClick={() => setActiveView('obra')}
                    className={`py-3 px-5 font-semibold text-sm flex items-center gap-2 transition-colors border-b-2 -mb-px ${activeView === 'obra' ? 'border-[#9E7A42] text-[#9E7A42]' : 'border-transparent text-[#9a8a78] hover:text-[#6a5e4e]'}`}
                >
                    <BarChart2 size={16} /> Por Obra
                </button>
                <button
                    onClick={() => setActiveView('maquina')}
                    className={`py-3 px-5 font-semibold text-sm flex items-center gap-2 transition-colors border-b-2 -mb-px ${activeView === 'maquina' ? 'border-[#9E7A42] text-[#9E7A42]' : 'border-transparent text-[#9a8a78] hover:text-[#6a5e4e]'}`}
                >
                    <Truck size={16} /> Por Máquina
                </button>
            </div>

            {/* ===== VISÃO: POR OBRA ===== */}
            {activeView === 'obra' && (
                <div className="space-y-6">
                    {!obraId ? (
                        <>
                            {/* Cards globais */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-4">
                                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Obras Ativas</p>
                                    <p style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">{obrasComRisco.filter(o => !o.isFinished).length}</p>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-4">
                                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Sem Registro</p>
                                    <p className="text-2xl font-bold text-red-600">{obrasComRisco.filter(o => o.riskLevel === 'critico').length}</p>
                                    <p className="text-xs text-gray-400 mt-1">+7d sem nenhum lançamento</p>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border-l-4 border-orange-400 p-4">
                                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Atenção</p>
                                    <p className="text-2xl font-bold text-orange-500">{obrasComRisco.filter(o => o.riskLevel === 'atencao').length}</p>
                                    <p className="text-xs text-gray-400 mt-1">equip. sem lançar há +10d</p>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border-l-4 border-green-500 p-4">
                                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Operando</p>
                                    <p className="text-2xl font-bold text-green-600">{obrasComRisco.filter(o => o.riskLevel === 'ok' && !o.isFinished).length}</p>
                                </div>
                            </div>

                            {/* Filtros */}
                            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                                    <div className="relative w-full md:w-64">
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                        <input type="text" placeholder="Buscar obra..." value={obraSearch} onChange={e => setObraSearch(e.target.value)}
                                            className="pl-9 pr-4 py-2 border rounded-lg w-full text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none" />
                                    </div>
                                    <div className="flex bg-gray-100 p-1 rounded-lg text-sm">
                                        {[['ativas', 'Ativas'], ['finalizadas', 'Finalizadas'], ['todas', 'Todas']].map(([val, label]) => (
                                            <button key={val} onClick={() => setObraStatus(val)} className={`px-3 py-1 rounded-md font-medium transition-all ${obraStatus === val ? 'bg-white shadow text-yellow-600' : 'text-[#9a8a78] hover:text-[#6a5e4e]'}`}>{label}</button>
                                        ))}
                                    </div>
                                    <select value={obraSort} onChange={e => setObraSort(e.target.value)} className="text-sm border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-yellow-400 outline-none">
                                        <option value="risco">Ordenar: Por risco</option>
                                        <option value="dataInicio">Ordenar: Data de início</option>
                                        <option value="semLancamento">Ordenar: Sem lançamento</option>
                                    </select>
                                </div>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                                        {[['', 'Todos'], ['critico', 'Sem Registro'], ['atencao', 'Atenção'], ['ok', 'Operando']].map(([val, label]) => (
                                            <button key={val} onClick={() => setObraRisk(val)} className={`px-3 py-1 rounded-md font-medium transition-all ${obraRisk === val ? 'bg-white shadow text-yellow-600' : 'text-[#9a8a78] hover:text-[#6a5e4e]'}`}>{label}</button>
                                        ))}
                                    </div>
                                    <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                                        {[['', 'Todos equip.'], ['sim', 'Com ativos'], ['nao', 'Sem ativos']].map(([val, label]) => (
                                            <button key={val} onClick={() => setObraHasActive(val)} className={`px-3 py-1 rounded-md font-medium transition-all ${obraHasActive === val ? 'bg-white shadow text-yellow-600' : 'text-[#9a8a78] hover:text-[#6a5e4e]'}`}>{label}</button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setShowCentroCusto(v => !v)}
                                        className={`px-3 py-1 rounded-md font-medium text-xs transition-all border ${showCentroCusto ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : 'bg-white border-gray-200 text-[#9a8a78] hover:text-[#6a5e4e]'}`}
                                        title="Exibir/Ocultar Centros de Custo"
                                    >
                                        {showCentroCusto ? 'Ocultar Centros de Custo' : 'Exibir Centros de Custo'}
                                    </button>
                                    <div className="ml-auto flex items-center gap-3">
                                        <span className="text-xs text-gray-400">{obrasFiltradas.length} {obrasFiltradas.length === 1 ? 'obra' : 'obras'}</span>
                                        {hasObraFilters && (
                                            <button onClick={clearObraFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
                                                <X size={13} /> Limpar filtros
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Grid de cards de obras */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {obrasFiltradas.map(({ obra, isFinished, ativos, equipSemLancamento10d, totalHoras, diasDeObra, riskLevel, riskScore, riskReasons }) => {
                                    const cfg = riskConfig[riskLevel];
                                    return (
                                        <div key={obra.id} onClick={() => setObraId(obra.id)}
                                            className={`bg-white rounded-xl shadow-sm border-l-4 ${cfg.border} hover:shadow-md transition-all cursor-pointer p-5 flex flex-col justify-between`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base font-bold text-gray-800 truncate" title={formatObraNome(obra)}>{formatObraNome(obra)}</h3>
                                                    <p className="text-xs text-gray-400 mt-0.5">{isFinished ? 'Finalizada' : `Em andamento · ${diasDeObra}d`}</p>
                                                </div>
                                                <div className="ml-3 shrink-0">{renderRiskBadge(riskLevel, riskScore, riskReasons)}</div>
                                            </div>
                                            <div className="space-y-2 text-sm mb-4">
                                                <div className="flex justify-between border-b border-dashed border-gray-100 pb-2">
                                                    <span className="text-gray-500 flex items-center gap-1"><Truck size={13} /> Equip. pesados ativos</span>
                                                    <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${ativos > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{ativos}</span>
                                                </div>
                                                {equipSemLancamento10d > 0 && (
                                                    <div className="flex justify-between border-b border-dashed border-gray-100 pb-2">
                                                        <span className="text-gray-500 flex items-center gap-1"><AlertTriangle size={13} className="text-orange-400" /> Sem lançamento há +10d</span>
                                                        <span className="font-bold px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-600">{equipSemLancamento10d}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 flex items-center gap-1"><TrendingUp size={13} /> Horas lançadas</span>
                                                    <span className="font-bold text-gray-700">{formatDecimalToTime(totalHoras)}</span>
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t border-gray-100">
                                                <span className="text-xs text-yellow-600 font-semibold">Ver cobertura detalhada →</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {obrasFiltradas.length === 0 && (
                                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed">
                                    <AlertTriangle className="mx-auto mb-4" style={{ color: "#e8e0d4" }} size={48} />
                                    <p className="text-gray-400 font-medium">Nenhuma obra encontrada.</p>
                                    {hasObraFilters && <button onClick={clearObraFilters} className="mt-3 text-sm text-yellow-600 hover:text-yellow-700 font-semibold">Limpar filtros</button>}
                                </div>
                            )}
                        </>
                    ) : (
                        /* DETALHE DA OBRA */
                        <div className="space-y-6">
                            <button onClick={() => { setObraId(''); setObraLogs([]); }}
                                className="flex items-center gap-2 text-sm text-[#9a8a78] hover:text-[#6a5e4e] font-medium transition-colors">
                                <ChevronLeft size={16} /> Voltar para todas as obras
                            </button>

                            <div className="flex items-center justify-between">
                                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">{formatObraNome(obras.find(o => o.id === obraId))}</h2>
                                {(() => {
                                    const r = obrasComRisco.find(o => o.obra.id === obraId);
                                    return r ? renderRiskBadge(r.riskLevel, r.riskScore, r.riskReasons, 'md') : null;
                                })()}
                            </div>

                            {loadingObra ? (
                                <div className="py-16 text-center text-gray-400">Carregando dados de cobertura...</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-4">
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Equipamentos</p>
                                            <p style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">{obraStats.summary?.total ?? '—'}</p>
                                            <p className="text-xs text-gray-400 mt-1">{obraStats.summary?.active ?? 0} ativos na obra</p>
                                        </div>
                                        <div className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${(obraStats.summary?.withAlerts ?? 0) > 0 ? 'border-red-500' : 'border-green-500'}`}>
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Com Alertas</p>
                                            <p className={`text-2xl font-bold ${(obraStats.summary?.withAlerts ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{obraStats.summary?.withAlerts ?? '—'}</p>
                                            <p className="text-xs text-gray-400 mt-1">{(obraStats.summary?.withAlerts ?? 0) === 0 ? 'Nenhum gap crítico' : 'requerem atenção'}</p>
                                        </div>
                                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-yellow-500 p-4">
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Lançado</p>
                                            <p style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">{formatDecimalToTime(obraStats.summary?.totalHoras ?? 0)}</p>
                                            {(obraStats.summary?.totalContratado ?? 0) > 0 ? (() => {
                                                const pct = Math.min(((obraStats.summary.totalHoras / obraStats.summary.totalContratado) * 100), 100);
                                                const barColor = pct < 50 ? 'bg-orange-400' : pct < 80 ? 'bg-yellow-400' : 'bg-green-500';
                                                return (
                                                    <>
                                                        <p className="text-xs text-gray-400 mt-1">de {formatDecimalToTime(obraStats.summary.totalContratado)}h contratadas</p>
                                                        <div className="mt-2 bg-gray-200 rounded-full h-1.5">
                                                            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </>
                                                );
                                            })() : <p className="text-xs text-gray-400 mt-1">horas na obra</p>}
                                        </div>
                                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-gray-300 p-4">
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Último Lançamento</p>
                                            <p style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">{obraStats.summary?.lastLog ? formatDateToBR(obraStats.summary.lastLog) : '—'}</p>
                                            <p className="text-xs text-gray-400 mt-1">em qualquer equip.</p>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 border-b border-gray-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <h2 className="font-bold text-gray-700 flex items-center gap-2">
                                                    <Activity size={16} className="text-yellow-500" />
                                                    Cobertura de Lançamentos por Equipamento
                                                </h2>
                                                <span className="text-xs text-gray-400">Gap crítico: &gt; {GAP_THRESHOLD_DAYS} dias</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                                                    {[['todos', 'Todos'], ['ativos', 'Somente Ativos'], ['inativos', 'Somente Inativos']].map(([val, label]) => (
                                                        <button key={val} onClick={() => setObraDetailStatus(val)} className={`px-3 py-1 rounded-md font-medium transition-all ${obraDetailStatus === val ? 'bg-white shadow text-yellow-600' : 'text-[#9a8a78] hover:text-[#6a5e4e]'}`}>{label}</button>
                                                    ))}
                                                </div>
                                                <select value={obraDetailSort} onChange={e => setObraDetailSort(e.target.value)} className="text-xs border rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-yellow-400 outline-none">
                                                    <option value="padrao">Ordenar: Padrão (status)</option>
                                                    <option value="horas">Ordenar: Mais horas</option>
                                                    <option value="gap">Ordenar: Maior gap</option>
                                                    <option value="cobertura">Ordenar: Menor cobertura</option>
                                                </select>
                                                <span className="text-xs text-gray-400 ml-auto">{obraStatsFiltered.length} equip.</span>
                                            </div>
                                        </div>

                                        {obraStats.vehicleStats.length === 0 ? (
                                            <div className="py-12 text-center text-gray-400">
                                                <PackageX size={36} className="mx-auto mb-2 opacity-30" />
                                                <p>Nenhum equipamento pesado registrado nesta obra.</p>
                                            </div>
                                        ) : obraStatsFiltered.length === 0 ? (
                                            <div className="py-10 text-center text-gray-400 text-sm">Nenhum equipamento corresponde ao filtro.</div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left">Equipamento</th>
                                                            <th className="px-4 py-3 text-left">Situação</th>
                                                            <th className="px-4 py-3 text-left">Entrada na Obra</th>
                                                            <th className="px-4 py-3 text-left">Status</th>
                                                            <th className="px-4 py-3 text-left">Cobertura contratada</th>
                                                            <th className="px-4 py-3 text-center">Maior gap</th>
                                                            <th className="px-4 py-3 text-left">Último lançamento</th>
                                                            <th className="px-4 py-3 text-right">Horas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {obraStatsFiltered.map(stat => (
                                                            <tr key={stat.vehicleId} className={`hover:bg-gray-50 ${stat.status === 'nunca' ? 'bg-red-50' : stat.status === 'atencao' ? 'bg-orange-50' : ''}`}>
                                                                <td className="px-4 py-3">
                                                                    <p className="font-semibold text-gray-800 flex items-center gap-1.5">{stat.vehicle.registroInterno} <TerceirizadoBadge vehicle={stat.vehicle} /></p>
                                                                    <p className="text-xs text-gray-400">{stat.vehicle.tipo} · {stat.vehicle.marca} {stat.vehicle.modelo}</p>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {stat.isActive
                                                                        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Ativo</span>
                                                                        : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Inativo</span>
                                                                    }
                                                                    {!stat.isActive && stat.status !== 'ok' && (
                                                                        <p className="text-[10px] text-red-500 mt-1 leading-tight">Período encerrado — gaps permanentes</p>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {stat.entryDate ? (
                                                                        <div>
                                                                            <span className="text-gray-700 text-sm">{formatDateToBR(stat.entryDate)}</span>
                                                                            {stat.isActive && (
                                                                                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                                                                                    {(() => {
                                                                                        const entry = new Date(stat.entryDate.split('T')[0] + 'T00:00:00Z');
                                                                                        const dias = Math.floor((today - entry) / 86400000);
                                                                                        return dias > 0 ? `${dias}d na obra` : 'hoje';
                                                                                    })()}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-300 text-xs">—</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">{renderStatusBadge(stat.status, stat.isActive)}</td>
                                                                <td className="px-4 py-3 min-w-[150px]">{renderCoverageBar(stat.coveragePercent, stat.totalHours, stat.contractedHours)}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`text-xs font-bold ${stat.maxGap > GAP_THRESHOLD_DAYS ? 'text-red-600' : stat.maxGap > 5 ? 'text-orange-500' : 'text-gray-500'}`}>{stat.maxGap}d</span>
                                                                    {stat.isActive && stat.daysSinceLast !== null && stat.daysSinceLast === stat.maxGap && stat.maxGap > 0 && (
                                                                        <p className="text-[10px] text-orange-400 leading-tight">atual</p>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {stat.lastLogDate ? (
                                                                        <div>
                                                                            <span className="text-gray-700">{formatDateToBR(stat.lastLogDate)}</span>
                                                                            {stat.lastLogJustificativaTipo && (
                                                                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                                                                                    {JUSTIFICATIVA_LABELS[stat.lastLogJustificativaTipo] || stat.lastLogJustificativaTipo}
                                                                                </span>
                                                                            )}
                                                                            {stat.isActive && stat.daysSinceLast !== null && (
                                                                                <span className={`ml-2 text-xs ${stat.daysSinceLast > GAP_THRESHOLD_DAYS ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>({stat.daysSinceLast}d atrás)</span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-red-400 font-semibold text-xs">Nunca preenchido</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-bold text-gray-700">{formatDecimalToTime(stat.totalHours)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ===== VISÃO: POR MÁQUINA ===== */}
            {activeView === 'maquina' && (
                <div className="space-y-4">
                    {/* Cards de resumo */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-3">
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Em Obra</p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">{maqSummary.emObra}</p>
                            <p className="text-xs text-gray-400 mt-0.5">equip. ativos</p>
                        </div>
                        <div className={`bg-white rounded-xl shadow-sm border-l-4 border-orange-400 p-3 cursor-pointer hover:shadow-md transition-shadow ${maqCriticality === 'atencao' ? 'ring-2 ring-orange-400' : ''}`}
                            onClick={() => setMaqCriticality(maqCriticality === 'atencao' ? '' : 'atencao')}>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Sem Lançar &gt; 3d</p>
                            <p className="text-2xl font-bold text-orange-500">{maqSummary.semLancamento3}</p>
                            <p className="text-xs text-gray-400 mt-0.5">requerem atenção</p>
                        </div>
                        <div className={`bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-3 cursor-pointer hover:shadow-md transition-shadow ${maqCriticality === 'critico' ? 'ring-2 ring-red-500' : ''}`}
                            onClick={() => setMaqCriticality(maqCriticality === 'critico' ? '' : 'critico')}>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Sem Lançar &gt; 7d</p>
                            <p className="text-2xl font-bold text-red-600">{maqSummary.semLancamento7}</p>
                            <p className="text-xs text-gray-400 mt-0.5">críticos</p>
                        </div>
                        <div className={`bg-white rounded-xl shadow-sm border-l-4 border-red-700 p-3 cursor-pointer hover:shadow-md transition-shadow ${maqCriticality === 'nunca' ? 'ring-2 ring-red-700' : ''}`}
                            onClick={() => setMaqCriticality(maqCriticality === 'nunca' ? '' : 'nunca')}>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Nunca Lançaram</p>
                            <p className="text-2xl font-bold text-red-700">{maqSummary.nunca}</p>
                            <p className="text-xs text-gray-400 mt-0.5">em obra ativa</p>
                        </div>
                        <div className={`bg-white rounded-xl shadow-sm border-l-4 border-gray-400 p-3 cursor-pointer hover:shadow-md transition-shadow ${maqCriticality === 'sem_obra' ? 'ring-2 ring-gray-400' : ''}`}
                            onClick={() => setMaqCriticality(maqCriticality === 'sem_obra' ? '' : 'sem_obra')}>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Sem Obra</p>
                            <p className="text-2xl font-bold text-gray-600">{maqSummary.semObra}</p>
                            <p className="text-xs text-gray-400 mt-0.5">disponíveis/oficina</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-400 p-3">
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Gap Pós-Realocar</p>
                            <p className="text-2xl font-bold text-purple-600">{maqSummary.gap}</p>
                            <p className="text-xs text-gray-400 mt-0.5">revisão pendente</p>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="bg-white rounded-xl shadow-sm p-4">
                        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input type="text" placeholder="Buscar máquina, frota, obra..." value={maqSearch} onChange={e => setMaqSearch(e.target.value)}
                                    className="pl-9 pr-4 py-2 border rounded-lg w-full text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none" />
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg text-xs flex-wrap gap-0.5">
                                {[['', 'Todos'], ['nunca', 'Nunca lançou'], ['critico', 'Crítico'], ['atencao', 'Atenção'], ['ok', 'Em dia']].map(([val, label]) => (
                                    <button key={val} onClick={() => setMaqCriticality(val)} className={`px-3 py-1 rounded-md font-medium transition-all ${maqCriticality === val ? 'bg-white shadow text-yellow-600' : 'text-[#9a8a78] hover:text-[#6a5e4e]'}`}>{label}</button>
                                ))}
                            </div>
                            <div className="min-w-[220px]">
                                <SearchableSelect
                                    items={activeObras}
                                    value={maqObraId}
                                    onChange={(item) => setMaqObraId(item?.id || '')}
                                    getLabel={(o) => formatObraNome(o)}
                                    placeholder="Todas as obras"
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                                <input type="checkbox" checked={showWithoutObra} onChange={e => setShowWithoutObra(e.target.checked)} className="rounded accent-yellow-500" />
                                Mostrar sem obra
                            </label>
                            <div className="md:ml-auto flex items-center gap-3">
                                <span className="text-xs text-gray-400">{maqFiltered.length} equip.</span>
                                {hasMaqFilters && (
                                    <button onClick={clearMaqFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                                        <X size={12} /> Limpar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabela */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
                            <span className="font-medium">Ordenar:</span>
                            {[['dias', 'Por criticidade'], ['maquina', 'Por máquina'], ['obra', 'Por obra']].map(([val, label]) => (
                                <button key={val} onClick={() => setMaqSort(val)} className={`font-medium transition-colors ${maqSort === val ? 'text-yellow-600 underline' : 'hover:text-gray-700'}`}>{label}</button>
                            ))}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                        <th className="px-4 py-3 text-left">Máquina</th>
                                        <th className="px-4 py-3 text-left">Obra Atual</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-center">Ult. Lançamento</th>
                                        <th className="px-4 py-3 text-center">Dias Sem Lançar</th>
                                        <th className="px-4 py-3 text-left">Operador</th>
                                        <th className="px-4 py-3 text-center">Situação</th>
                                        {!isViewer && <th className="px-4 py-3 text-center">Ação</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {maqFiltered.length === 0 && (
                                        <tr>
                                            <td colSpan={isViewer ? 7 : 8} className="text-center py-16 text-gray-400">
                                                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                                                Nenhum equipamento encontrado.
                                            </td>
                                        </tr>
                                    )}
                                    {maqFiltered.map(({ vehicle, currentObra, operator, lastLogDate, daysSinceLastLog, criticality, gapAfterReallocation, recentDepartureObra }) => {
                                        const cfg = maqCritConfig[criticality] || maqCritConfig.sem_obra;
                                        return (
                                            <tr key={vehicle.id} onClick={() => setSelectedMachineId(vehicle.id)} title="Ver detalhes do equipamento"
                                                className={`border-b last:border-b-0 hover:brightness-95 transition-all cursor-pointer ${cfg.row}`}>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-gray-800 flex items-center gap-1.5">{vehicle.registroInterno || '—'} <TerceirizadoBadge vehicle={vehicle} /></div>
                                                    <div className="text-xs text-gray-500">{vehicle.tipo}{vehicle.modelo ? ` · ${vehicle.modelo}` : ''}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {currentObra ? <span className="text-gray-700">{formatObraNome(currentObra)}</span>
                                                        : recentDepartureObra ? <span className="text-gray-400 text-xs italic">Saiu de: {formatObraNome(recentDepartureObra)}</span>
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-3"><MaqStatusBadge vehicle={vehicle} /></td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={!lastLogDate ? 'text-red-500 font-semibold' : 'text-gray-600'}>{formatDate(lastLogDate)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {daysSinceLastLog === null
                                                        ? <span className="font-bold text-red-700">Nunca</span>
                                                        : <span className={`font-bold text-lg ${daysSinceLastLog > 7 ? 'text-red-600' : daysSinceLastLog > 3 ? 'text-orange-500' : 'text-green-600'}`}>{daysSinceLastLog}d</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    {operator
                                                        ? <span className="text-gray-700 text-xs">{operator.nome || operator.name || '—'}</span>
                                                        : <span className="text-gray-400 text-xs italic">Não definido</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}>{cfg.label}</span>
                                                        {gapAfterReallocation && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Gap realocação</span>}
                                                    </div>
                                                </td>
                                                {!isViewer && (
                                                    <td className="px-4 py-3 text-center">
                                                        {currentObra
                                                            ? <button onClick={(e) => { e.stopPropagation(); navigate('billing', { tab: 'lancamentos', obraId: currentObra.id, vehicleId: vehicle.id }); }}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 text-xs font-semibold rounded-lg transition-colors">
                                                                Lançar <ArrowRight size={12} />
                                                              </button>
                                                            : <span className="text-gray-300 text-xs">—</span>
                                                        }
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {maqFiltered.length > 0 && (
                            <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-400 flex flex-wrap items-center gap-4">
                                <span className="font-medium text-gray-500">Legenda:</span>
                                {[['bg-red-700', 'Nunca lançou'], ['bg-red-400', 'Crítico (>7d)'], ['bg-orange-400', 'Atenção (3–7d)'], ['bg-green-400', 'Em dia (≤3d)'], ['bg-purple-400', 'Gap pós-realocação']].map(([color, label]) => (
                                    <span key={label} className="flex items-center gap-1.5">
                                        <span className={`w-2.5 h-2.5 rounded-full ${color} inline-block`} />{label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== MODAL: DETALHES DO EQUIPAMENTO ===== */}
            {selectedMachine && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    onClick={closeMachineModal}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        {/* Cabeçalho */}
                        <div className="flex items-start justify-between p-5 border-b border-gray-100">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
                                    <Truck size={22} className="text-yellow-600" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-gray-800 truncate flex items-center gap-2">{selectedMachine.vehicle.registroInterno || 'Equipamento'} <TerceirizadoBadge vehicle={selectedMachine.vehicle} /></h3>
                                    <p className="text-xs text-gray-500 truncate">
                                        {selectedMachine.vehicle.tipo}
                                        {selectedMachine.vehicle.modelo ? ` · ${selectedMachine.vehicle.modelo}` : ''}
                                        {selectedMachine.vehicle.placa ? ` · ${selectedMachine.vehicle.placa}` : ''}
                                    </p>
                                </div>
                            </div>
                            <button onClick={closeMachineModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Corpo — informações */}
                        <div className="p-5 space-y-3">
                            {/* Última leitura no abastecimento — destaque */}
                            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Gauge size={16} className="text-yellow-600" />
                                    <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">
                                        Último {selectedMachine.leituraLabel} (abastecimento)
                                    </span>
                                </div>
                                {selectedMachine.ultimaLeitura !== null ? (
                                    <>
                                        <p className="text-2xl font-bold text-gray-800">
                                            {selectedMachine.ultimaLeitura.toLocaleString('pt-BR')} <span className="text-base font-semibold text-gray-500">{selectedMachine.leituraUnidade}</span>
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                            <Fuel size={12} /> Registrado em {formatDate(selectedMachine.ultimaLeituraData)}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Nenhuma leitura de abastecimento registrada.</p>
                                )}
                            </div>

                            {/* Grade de infos */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold uppercase mb-1"><MapPin size={13} /> Obra atual</div>
                                    {selectedMachine.currentObra
                                        ? <p className="text-sm font-medium text-gray-800">{formatObraNome(selectedMachine.currentObra)}</p>
                                        : selectedMachine.recentDepartureObra
                                            ? <p className="text-sm text-gray-400 italic">Saiu de: {formatObraNome(selectedMachine.recentDepartureObra)}</p>
                                            : <p className="text-sm text-gray-400 italic">Sem obra vinculada</p>}
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold uppercase mb-1"><User size={13} /> Operador</div>
                                    {selectedMachine.operator
                                        ? <p className="text-sm font-medium text-gray-800">{selectedMachine.operator.nome || selectedMachine.operator.name || '—'}</p>
                                        : <p className="text-sm text-gray-400 italic">Não definido</p>}
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold uppercase mb-1"><Clock size={13} /> Horas registradas</div>
                                    <p className="text-sm font-medium text-gray-800">
                                        {formatDecimalToTime(selectedMachine.totalHoras)}
                                        <span className="text-xs text-gray-400 font-normal"> · {selectedMachine.totalLancamentos} lançamento{selectedMachine.totalLancamentos === 1 ? '' : 's'}</span>
                                    </p>
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold uppercase mb-1"><Activity size={13} /> Último lançamento</div>
                                    {selectedMachine.lastLogDate ? (
                                        <p className="text-sm font-medium text-gray-800">
                                            {formatDate(selectedMachine.lastLogDate)}
                                            {selectedMachine.daysSinceLastLog !== null && (
                                                <span className={`text-xs font-normal ${selectedMachine.daysSinceLastLog > 7 ? 'text-red-500' : selectedMachine.daysSinceLastLog > 3 ? 'text-orange-500' : 'text-gray-400'}`}> · {selectedMachine.daysSinceLastLog}d atrás</span>
                                            )}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-red-500 font-medium">Nunca lançou</p>
                                    )}
                                </div>
                            </div>

                            {/* Ações — solicitações ao administrador */}
                            {!isViewer && (
                                <div className="pt-3 border-t border-gray-100 space-y-3">
                                    {!requestForm ? (
                                        <div className="space-y-2">
                                        {selectedMachine.operator && (
                                            <button onClick={abrirPreviewRelatorio} disabled={relatorioPreviewLoading || relatorioSubmitting}
                                                title={selectedMachine.daysSinceLastLog === null ? 'Operador nunca lançou horas' : `Cobrar lançamento (${selectedMachine.daysSinceLastLog}d pendente)`}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                                                <FileText size={14} /> {relatorioPreviewLoading ? 'Carregando pré-visualização...' : 'Solicitar Relatório de Horas'}
                                            </button>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <button onClick={() => openRequestForm('obra')}
                                                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-sm font-semibold rounded-lg transition-colors">
                                                <MapPin size={14} /> Solicitar mudança de obra
                                            </button>
                                            <button onClick={() => openRequestForm('operador')}
                                                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 text-sm font-semibold rounded-lg transition-colors">
                                                <User size={14} /> Solicitar mudança de operador
                                            </button>
                                        </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-gray-200 p-3 space-y-2.5 bg-gray-50">
                                            <p className="text-sm font-semibold text-gray-700">
                                                {requestForm === 'obra' ? 'Sugerir a real obra do equipamento' : 'Sugerir o real operador'}
                                            </p>
                                            <SearchableSelect
                                                items={requestForm === 'obra' ? activeObras : employees}
                                                value={requestValue?.id || ''}
                                                onChange={(item) => setRequestValue(item)}
                                                getLabel={(o) => requestForm === 'obra' ? formatObraNome(o) : (o.nome || o.name || '—')}
                                                placeholder={requestForm === 'obra' ? 'Selecione a obra...' : 'Selecione o operador...'}
                                            />
                                            <textarea
                                                value={requestObs}
                                                onChange={e => setRequestObs(e.target.value)}
                                                rows={2}
                                                placeholder="Observação (opcional)"
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
                                            />
                                            <div className="flex items-center gap-2 justify-end">
                                                <button onClick={() => { setRequestForm(null); setRequestValue(null); setRequestObs(''); }}
                                                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium">
                                                    Cancelar
                                                </button>
                                                <button onClick={submitOperationalRequest} disabled={!requestValue || requestSubmitting}
                                                    className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold rounded-lg disabled:opacity-50 transition-colors">
                                                    {requestSubmitting ? 'Enviando...' : 'Enviar requisição'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {relatorioPreview && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !relatorioSubmitting && setRelatorioPreview(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FileText size={18} className="text-yellow-600" />
                                Confirmar envio da cobrança
                            </h3>
                            <button onClick={() => !relatorioSubmitting && setRelatorioPreview(null)} className="text-gray-400 hover:text-gray-700 disabled:opacity-40" disabled={relatorioSubmitting}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            <p className="text-sm text-gray-600">
                                Confira os dados antes de enviar. A cobrança será enviada por <strong>{relatorioPreview.canais.map(c => c === 'whatsapp' ? 'WhatsApp' : 'e-mail').join(' e ') || 'nenhum canal'}</strong>.
                            </p>

                            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2 text-sm">
                                <div className="flex items-start gap-2">
                                    <User size={14} className="text-gray-500 mt-0.5" />
                                    <div>
                                        <div className="text-xs text-gray-500">Operador</div>
                                        <div className="font-semibold text-gray-800">{relatorioPreview.operador.nome || '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Phone size={14} className="text-gray-500 mt-0.5" />
                                    <div>
                                        <div className="text-xs text-gray-500">WhatsApp cadastrado</div>
                                        <div className={`font-mono ${relatorioPreview.operador.contato ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                                            {relatorioPreview.operador.contato || 'não cadastrado'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Mail size={14} className="text-gray-500 mt-0.5" />
                                    <div>
                                        <div className="text-xs text-gray-500">E-mail cadastrado</div>
                                        <div className={relatorioPreview.operador.email ? 'text-gray-800' : 'text-gray-400 italic'}>
                                            {relatorioPreview.operador.email || 'não cadastrado'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wide">Mensagem que será enviada</div>
                                <div className="bg-white border border-gray-300 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                                    {relatorioPreview.mensagem || <span className="text-gray-400 italic">Mensagem vazia.</span>}
                                </div>
                            </div>

                            {!relatorioPreview.operador.contato && !relatorioPreview.operador.email && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg p-2.5">
                                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                    Operador sem WhatsApp e sem e-mail. O envio falhará.
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
                            <button onClick={() => setRelatorioPreview(null)} disabled={relatorioSubmitting}
                                className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-50">
                                Cancelar
                            </button>
                            <button onClick={confirmarEnvioRelatorio} disabled={relatorioSubmitting || relatorioPreview.canais.length === 0}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold rounded-lg disabled:opacity-50">
                                <Send size={14} /> {relatorioSubmitting ? 'Enviando...' : 'Confirmar e enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OperacionalPage;



