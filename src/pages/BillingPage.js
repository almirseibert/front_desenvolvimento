import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Calendar, CheckCircle, Clock, FileText, Filter, AlertTriangle,
    Download, Search, Save, Lock, ArrowRight, User, Printer, X,
    Trash2, Copy, ChevronLeft, ChevronRight, Building2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext'; // Importar Auth Context
import SearchableObraSelect from '../components/SearchableObraSelect';
import { formatObraNome } from '../utils/obraFormat';
import TerceirizadoBadge, { terceirizadoPdfMark } from '../components/ui/TerceirizadoBadge';

const RECENT_OBRAS_KEY = 'mak_billing_recent_obras';

const JUSTIFICATIVA_LABELS = {
    chuva: 'Chuva',
    maquina_parada: 'Máquina Parada',
    feriado: 'Feriado / Folga',
    outro: 'Outro',
};

const BillingPage = ({ 
    user: userProp, // Renomeado para evitar conflito com user do hook
    obras = [], 
    vehicles = [], 
    employees = [], 
    vehicleGroups = {}, 
    setAlertMessage,
    PasswordConfirmationModal,
    initialFilter = null,
}) => {
    // Pega a permissão de visualizador do contexto
    const { isViewer } = useAuth();

    // --- ESTADOS GERAIS ---
    // Se for visualizador, começa na aba relatório obrigatoriamente
    const [activeTab, setActiveTab] = useState(isViewer ? 'relatorio' : 'controle'); 
    const [selectedObraId, setSelectedObraId] = useState('');
    const [loadingLogs, setLoadingLogs] = useState(false);
    
    // --- ESTADOS CONTROLE DIÁRIO ---
    const [controlMonth, setControlMonth] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });
    const [controlVehicleId, setControlVehicleId] = useState('');
    const [dailyLogs, setDailyLogs] = useState([]); 
    const [localChanges, setLocalChanges] = useState({}); 
    const [isSaving, setIsSaving] = useState(false);
    const [justificativaOpenDate, setJustificativaOpenDate] = useState(null);
    const [activeRowDate, setActiveRowDate] = useState(null);
    const [quickFill, setQuickFill] = useState({ morningStart: '', morningEnd: '', afternoonStart: '', afternoonEnd: '' });

    // --- ESTADOS RELATÓRIO/FATURAMENTO ---
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportVehicleId, setReportVehicleId] = useState('');
    const [reportData, setReportData] = useState([]);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [pendingDateChange, setPendingDateChange] = useState(null);
    const [periodPreset, setPeriodPreset] = useState('custom');

    // --- HISTÓRICO DE OBRAS RECENTES ---
    const [recentObraIds, setRecentObraIds] = useState(() => {
        try {
            const stored = localStorage.getItem(RECENT_OBRAS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // --- ESTADOS SELETOR DE MÊS (RELATÓRIO) ---
    const [showMonthPickerReport, setShowMonthPickerReport] = useState(false);
    const [reportPickerYear, setReportPickerYear] = useState(new Date().getFullYear());
    const monthPickerReportRef = useRef(null);

    // --- ESTADOS SELETOR DE MÊS (CONTROLE) ---
    const [showMonthPickerControl, setShowMonthPickerControl] = useState(false);
    const [controlPickerYear, setControlPickerYear] = useState(new Date().getFullYear());
    const monthPickerControlRef = useRef(null);

    // --- REFS ---
    const todayRowRef = useRef(null);

    // Efeito para garantir que visualizador nunca acesse a aba controle
    useEffect(() => {
        if (isViewer && activeTab === 'controle') {
            setActiveTab('relatorio');
        }
    }, [isViewer, activeTab]);

    // Fechar month pickers ao clicar fora
    useEffect(() => {
        const handleMouseDown = (e) => {
            if (monthPickerReportRef.current && !monthPickerReportRef.current.contains(e.target)) {
                setShowMonthPickerReport(false);
            }
            if (monthPickerControlRef.current && !monthPickerControlRef.current.contains(e.target)) {
                setShowMonthPickerControl(false);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, []);

    // ===================================================================================
    // HELPERS DE DATA E HORA
    // ===================================================================================

    const formatDateToBR = (dateString) => {
        if (!dateString) return '';
        const cleanDate = dateString.split('T')[0]; 
        const [year, month, day] = cleanDate.split('-');
        return `${day}/${month}/${year}`;
    };

    const getDayOfWeek = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString.split('T')[0] + 'T12:00:00Z');
        const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        return days[date.getUTCDay()];
    };

    const getDayOfWeekShort = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString.split('T')[0] + 'T12:00:00Z');
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return days[date.getUTCDay()];
    };

    const isWeekend = (dateString) => {
        if (!dateString) return false;
        const date = new Date(dateString.split('T')[0] + 'T12:00:00Z');
        const day = date.getUTCDay();
        return day === 0 || day === 6;
    };

    const getDaysInMonth = (yearMonth) => {
        if (!yearMonth) return [];
        const [year, month] = yearMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = [];
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dayStr = String(d).padStart(2, '0');
            const monthStr = String(month).padStart(2, '0');
            days.push(`${year}-${monthStr}-${dayStr}`);
        }
        return days;
    };

    const formatDecimalToTime = (decimal) => {
        const val = parseFloat(decimal);
        if (isNaN(val) || val === 0) return '00:00';
        
        const hours = Math.floor(val);
        const minutes = Math.round((val - hours) * 60);
        
        const finalHours = minutes === 60 ? hours + 1 : hours;
        const finalMinutes = minutes === 60 ? 0 : minutes;

        return `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
    };

    const calculateTimeDiffDecimal = (start, end) => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        const diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
        return diffMinutes > 0 ? diffMinutes / 60 : 0;
    };

    const getImageDataUrl = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = url;
        });
    };

    // --- EFEITOS ---
    useEffect(() => {
        if (selectedObraId && activeTab === 'controle' && controlVehicleId && controlMonth) {
            fetchDailyLogsForControl();
        } else if (activeTab === 'controle') {
            setDailyLogs([]); 
        }
    }, [selectedObraId, controlMonth, controlVehicleId, activeTab]);

    useEffect(() => {
        if (selectedObraId && activeTab === 'relatorio' && reportStartDate && reportEndDate) {
            fetchReportData();
        }
    }, [selectedObraId, reportStartDate, reportEndDate, reportVehicleId, activeTab]);

    // --- FUNÇÕES AUXILIARES ---

    const getObraVehicles = useMemo(() => {
        if (!selectedObraId) return [];
        const obra = obras.find(o => o.id === selectedObraId);
        if (!obra || !obra.historicoVeiculos) return [];

        const vehicleMap = new Map();
        
        obra.historicoVeiculos.forEach(h => {
            const existing = vehicleMap.get(h.veiculoId);
            const isMoreRecent = !existing || new Date(h.dataEntrada) > new Date(existing.entryData.dataEntrada);
            
            if (isMoreRecent) {
                const vehicle = vehicles.find(v => v.id === h.veiculoId);
                if (vehicle) {
                    const tipo = vehicle.tipo || '';
                    const isLight = vehicleGroups['Veículos Leves']?.includes(tipo);

                    if (!isLight) {
                        vehicleMap.set(h.veiculoId, {
                            ...vehicle,
                            statusNaObra: h.dataSaida ? 'historico' : 'presente',
                            entryData: h
                        });
                    }
                }
            }
        });

        return Array.from(vehicleMap.values()).sort((a, b) => {
            const labelA = `${a.registroInterno || ''} ${a.tipo || ''} ${a.marca || ''} ${a.modelo || ''}`.toLowerCase();
            const labelB = `${b.registroInterno || ''} ${b.tipo || ''} ${b.marca || ''} ${b.modelo || ''}`.toLowerCase();
            return labelA.localeCompare(labelB);
        });
    }, [selectedObraId, obras, vehicles, vehicleGroups]);

    // Separação de Obras Ativas e Finalizadas
    const { activeObras, inactiveObras } = useMemo(() => {
        const active = [];
        const inactive = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Zera hora para comparar apenas datas

        obras.filter(o => (o.tipo_registro || 'obra') !== 'centro_custo').forEach(obra => {
            let isFinished = false;

            // Critério 1: Status explícito (se existir essa propriedade no futuro)
            if (obra.status === 'Finalizada' || obra.status === 'Concluída' || obra.status === 'Inativa') {
                isFinished = true;
            } 
            // Critério 2: Data Fim já passou
            else if (obra.dataFim) {
                const fim = new Date(obra.dataFim);
                // Adiciona margem até o final do dia
                fim.setHours(23, 59, 59, 999);
                if (fim < new Date()) {
                    isFinished = true;
                }
            }

            if (isFinished) {
                inactive.push(obra);
            } else {
                active.push(obra);
            }
        });

        // Ordenação alfabética dentro de cada grupo
        active.sort((a, b) => a.nome.localeCompare(b.nome));
        inactive.sort((a, b) => a.nome.localeCompare(b.nome));

        return { activeObras: active, inactiveObras: inactive };
    }, [obras]);


    // Obra selecionada e status
    const selectedObra = useMemo(() => obras.find(o => o.id === selectedObraId), [selectedObraId, obras]);
    const obraIsActive = useMemo(() => {
        if (!selectedObra) return false;
        if (selectedObra.status === 'Finalizada' || selectedObra.status === 'Concluída' || selectedObra.status === 'Inativa') return false;
        if (selectedObra.dataFim) {
            const fim = new Date(selectedObra.dataFim);
            fim.setHours(23, 59, 59, 999);
            return fim >= new Date();
        }
        return true;
    }, [selectedObra]);

    // Índice O(1) de daily logs por dia (substitui .find() dentro de loops)
    const dailyLogsByDate = useMemo(() => {
        const map = new Map();
        dailyLogs.forEach(l => {
            const key = (l.date || '').split('T')[0];
            if (key) map.set(key, l);
        });
        return map;
    }, [dailyLogs]);

    // Total decimal do mês — derivado uma vez, consumido pelo tfoot
    const monthTotalDecimal = useMemo(() => {
        if (!controlVehicleId) return 0;
        return getDaysInMonth(controlMonth).reduce((acc, dayDate) => {
            const existingLog = dailyLogsByDate.get(dayDate) || {};
            const changes = localChanges[dayDate] || {};
            if (changes._clear) return acc;
            const justTipo = changes.justificativaTipo !== undefined ? changes.justificativaTipo : (existingLog.justificativaTipo || null);
            if (justTipo) return acc;
            const mS = changes.morningStart !== undefined ? changes.morningStart : (existingLog.morningStart || '');
            const mE = changes.morningEnd !== undefined ? changes.morningEnd : (existingLog.morningEnd || '');
            const aS = changes.afternoonStart !== undefined ? changes.afternoonStart : (existingLog.afternoonStart || '');
            const aE = changes.afternoonEnd !== undefined ? changes.afternoonEnd : (existingLog.afternoonEnd || '');
            return acc + calculateTimeDiffDecimal(mS, mE) + calculateTimeDiffDecimal(aS, aE);
        }, 0);
    }, [controlMonth, controlVehicleId, dailyLogsByDate, localChanges]);

    // Progresso de preenchimento do mês
    const monthProgress = useMemo(() => {
        if (!controlVehicleId) return null;
        const days = getDaysInMonth(controlMonth);
        const workdays = days.filter(d => !isWeekend(d));
        const filled = workdays.filter(d => {
            const log = dailyLogsByDate.get(d) || {};
            const changes = localChanges[d] || {};
            if (changes._clear) return false;
            const justTipo = changes.justificativaTipo !== undefined ? changes.justificativaTipo : (log.justificativaTipo || null);
            if (justTipo) return true;
            const mS = changes.morningStart !== undefined ? changes.morningStart : (log.morningStart || '');
            const mE = changes.morningEnd !== undefined ? changes.morningEnd : (log.morningEnd || '');
            const aS = changes.afternoonStart !== undefined ? changes.afternoonStart : (log.afternoonStart || '');
            const aE = changes.afternoonEnd !== undefined ? changes.afternoonEnd : (log.afternoonEnd || '');
            return !!(mS || mE || aS || aE);
        });
        return { filled: filled.length, total: workdays.length };
    }, [controlMonth, dailyLogsByDate, localChanges, controlVehicleId]);

    // Obras recentes resolvidas (filtra IDs que não existem mais)
    const recentObras = useMemo(() => {
        return recentObraIds
            .map(id => obras.find(o => o.id === id))
            .filter(Boolean);
    }, [recentObraIds, obras]);

    // Equipamentos que possuem horas no período selecionado
    const vehiclesWithDataInPeriod = useMemo(() => {
        if (!reportData.length || !reportStartDate || !reportEndDate) return getObraVehicles;
        const idsWithData = new Set(
            reportData.filter(l => parseFloat(l.totalHours || 0) > 0 || l.justificativaTipo).map(l => l.vehicleId)
        );
        return getObraVehicles.filter(v => idsWithData.has(v.id));
    }, [reportData, getObraVehicles, reportStartDate, reportEndDate]);

    // Retorna o funcionário que tinha a máquina na data informada,
    // consultando o histórico de alocações da obra (dataEntrada/dataSaida).
    // Se dateKey não for fornecido, usa a alocação mais recente como fallback.
    const getDefaultOperator = (dateKey) => {
        const obra = obras.find(o => o.id === selectedObraId);
        if (!obra) return '';

        const allocations = obra.historicoVeiculos
            .filter(h => h.veiculoId === controlVehicleId)
            .sort((a, b) => new Date(b.dataEntrada) - new Date(a.dataEntrada));

        if (!allocations.length) return '';

        if (dateKey) {
            const date = new Date(dateKey + 'T00:00:00');
            const active = allocations.find(h => {
                const entrada = new Date(h.dataEntrada + 'T00:00:00');
                const saida = h.dataSaida ? new Date(h.dataSaida + 'T23:59:59') : null;
                return entrada <= date && (!saida || saida >= date);
            });
            if (active) return active.employeeId || '';
        }

        // Fallback: alocação mais recente (para dias sem cobertura no histórico)
        return allocations[0].employeeId || '';
    };

    // --- HELPERS DE NAVEGAÇÃO E COMBOBOX ---

    const formatMonthLabel = (yearMonth) => {
        if (!yearMonth) return '';
        const [year, month] = yearMonth.split('-').map(Number);
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${months[month - 1]} ${year}`;
    };

    const navigateMonth = (direction) => {
        const [year, month] = controlMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + direction, 1);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        setControlMonth(`${y}-${m}`);
    };

    const scrollToToday = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const todayMonth = `${y}-${m}`;
        if (controlMonth !== todayMonth) {
            setControlMonth(todayMonth);
            setTimeout(() => {
                if (todayRowRef.current) todayRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        } else {
            if (todayRowRef.current) todayRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const applyPreset = (preset) => {
        const now = new Date();
        let start, end;
        if (preset === 'week') {
            const day = now.getDay();
            start = new Date(now); start.setDate(now.getDate() - day);
            end = new Date(now); end.setDate(now.getDate() + (6 - day));
        } else if (preset === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (preset === 'lastmonth') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (preset === '3months') {
            start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        const fmt = d => d.toISOString().split('T')[0];
        setReportStartDate(fmt(start));
        setReportEndDate(fmt(end));
        setPeriodPreset(preset);
    };

    const applyMonthToReport = (year, monthIndex) => {
        const start = new Date(year, monthIndex, 1);
        const end = new Date(year, monthIndex + 1, 0);
        const fmt = d => d.toISOString().split('T')[0];
        setReportStartDate(fmt(start));
        setReportEndDate(fmt(end));
        setPeriodPreset('specificMonth');
        setShowMonthPickerReport(false);
    };

    const applyMonthToControl = (year, monthIndex) => {
        const m = String(monthIndex + 1).padStart(2, '0');
        setControlMonth(`${year}-${m}`);
        setShowMonthPickerControl(false);
    };

    const saveRecentObra = (obraId) => {
        const updated = [obraId, ...recentObraIds.filter(id => id !== obraId)].slice(0, 10);
        setRecentObraIds(updated);
        try { localStorage.setItem(RECENT_OBRAS_KEY, JSON.stringify(updated)); } catch {}
    };

    const handleObraSelect = (obra) => {
        setSelectedObraId(obra.id);
        saveRecentObra(obra.id);
    };

    const handleObraClear = () => {
        setSelectedObraId('');
    };

    const appliedInitialFilterRef = useRef(null);
    useEffect(() => {
        if (!initialFilter) return;
        if (appliedInitialFilterRef.current === initialFilter) return;
        appliedInitialFilterRef.current = initialFilter;

        const { obraId, vehicleId, tab } = initialFilter;
        const targetTab = tab === 'lancamentos' ? 'controle' : tab;
        if (targetTab && !(isViewer && targetTab === 'controle')) {
            setActiveTab(targetTab);
        }
        if (obraId) {
            setSelectedObraId(obraId);
            saveRecentObra(obraId);
        }
        if (vehicleId) {
            setControlVehicleId(vehicleId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialFilter]);

    // --- API CALLS ---

    const fetchDailyLogsForControl = async () => {
        setLoadingLogs(true);
        try {
            const [year, month] = controlMonth.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;

            const logs = await apiClient.getDailyLogs(selectedObraId, { 
                startDate, 
                endDate,
                vehicleId: controlVehicleId 
            });
            setDailyLogs(logs || []);
            setLocalChanges({});
        } catch (error) {
            console.error(error);
            setAlertMessage("Erro ao carregar registros diários.");
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchReportData = async () => {
        setLoadingLogs(true);
        try {
            const filters = { 
                startDate: reportStartDate, 
                endDate: reportEndDate
            };
            
            if (reportVehicleId) {
                filters.vehicleId = reportVehicleId;
            }

            const logs = await apiClient.getDailyLogs(selectedObraId, filters);
            setReportData(logs || []);
        } catch (error) {
            console.error(error);
            setAlertMessage("Erro ao carregar dados do relatório.");
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleSaveDailyLogs = async () => {
        setIsSaving(true);
        const promises = [];

        Object.keys(localChanges).forEach(dateKey => {
            const changes = localChanges[dateKey];
            const existingLog = dailyLogs.find(l => l.date.startsWith(dateKey));

            if (changes._clear) {
                if (existingLog?.id) promises.push(apiClient.deleteDailyLog(existingLog.id));
                return;
            }

            const justificativaTipo = changes.justificativaTipo !== undefined
                ? changes.justificativaTipo
                : (existingLog?.justificativaTipo || null);

            const payload = {
                id: existingLog ? existingLog.id : null,
                obraId: selectedObraId,
                vehicleId: controlVehicleId,
                date: dateKey,
                employeeId: changes.employeeId || existingLog?.employeeId || getDefaultOperator(dateKey),
                morningStart: justificativaTipo ? null : (changes.morningStart !== undefined ? changes.morningStart : (existingLog?.morningStart || null)),
                morningEnd: justificativaTipo ? null : (changes.morningEnd !== undefined ? changes.morningEnd : (existingLog?.morningEnd || null)),
                afternoonStart: justificativaTipo ? null : (changes.afternoonStart !== undefined ? changes.afternoonStart : (existingLog?.afternoonStart || null)),
                afternoonEnd: justificativaTipo ? null : (changes.afternoonEnd !== undefined ? changes.afternoonEnd : (existingLog?.afternoonEnd || null)),
                observation: changes.observation !== undefined ? changes.observation : (existingLog?.observation || null),
                justificativaTipo,
            };

            const morning = calculateTimeDiffDecimal(payload.morningStart, payload.morningEnd);
            const afternoon = calculateTimeDiffDecimal(payload.afternoonStart, payload.afternoonEnd);
            payload.totalHours = justificativaTipo ? '0.00' : (morning + afternoon).toFixed(2);

            if (!justificativaTipo && payload.totalHours === '0.00' && !payload.observation) {
                if (existingLog?.id) promises.push(apiClient.deleteDailyLog(existingLog.id));
                return;
            }

            promises.push(apiClient.upsertDailyLog(payload));
        });

        try {
            await Promise.all(promises);
            setAlertMessage("Registros salvos com sucesso!");
            fetchDailyLogsForControl();
        } catch (error) {
            setAlertMessage("Erro ao salvar alguns registros. Verifique a conexão.");
        } finally {
            setIsSaving(false);
        }
    };

    const TIME_FIELD_ORDER = ['morningStart', 'morningEnd', 'afternoonStart', 'afternoonEnd'];

    const handleInputChange = (dateKey, field, value) => {
        setLocalChanges(prev => ({
            ...prev,
            [dateKey]: { ...prev[dateKey], [field]: value }
        }));
    };

    // Validação de ordem crescente (mStart ≤ mEnd ≤ aStart ≤ aEnd) roda só no blur,
    // não a cada tecla: o <input type="time"> autocompleta dígitos ambíguos
    // (ex: "1" vira "01:00") enquanto o usuário ainda está digitando o segundo dígito,
    // o que disparava o alerta prematuramente (ex: ao tentar digitar "12" a partir de "1").
    const handleTimeBlur = (dateKey, field) => {
        setLocalChanges(prev => {
            const existingLog = dailyLogs.find(l => l.date.startsWith(dateKey)) || {};
            const current = { ...existingLog, ...(prev[dateKey] || {}) };
            const value = current[field];
            const idx = TIME_FIELD_ORDER.indexOf(field);
            if (idx === -1 || !value) return prev;

            for (let i = 0; i < idx; i++) {
                const prevVal = current[TIME_FIELD_ORDER[i]];
                if (prevVal && value < prevVal) {
                    setAlertMessage(`O horário não pode ser menor que o campo anterior (${prevVal}).`);
                    return {
                        ...prev,
                        [dateKey]: { ...prev[dateKey], [field]: '' }
                    };
                }
            }

            const cleared = {};
            for (let i = idx + 1; i < TIME_FIELD_ORDER.length; i++) {
                const nextField = TIME_FIELD_ORDER[i];
                if (current[nextField] && current[nextField] < value) {
                    cleared[nextField] = '';
                }
            }
            if (Object.keys(cleared).length === 0) return prev;
            return {
                ...prev,
                [dateKey]: { ...prev[dateKey], ...cleared }
            };
        });
    };

    const handleSetJustificativa = (dateKey, tipo) => {
        setLocalChanges(prev => ({
            ...prev,
            [dateKey]: {
                ...prev[dateKey],
                justificativaTipo: tipo,
                morningStart: null,
                morningEnd: null,
                afternoonStart: null,
                afternoonEnd: null,
            }
        }));
        setJustificativaOpenDate(null);
    };

    const handleRemoveJustificativa = (dateKey) => {
        setLocalChanges(prev => ({
            ...prev,
            [dateKey]: { ...prev[dateKey], justificativaTipo: null }
        }));
    };

    const handleClearDay = (dateKey) => {
        setLocalChanges(prev => ({
            ...prev,
            [dateKey]: {
                employeeId: '',
                morningStart: null,
                morningEnd: null,
                afternoonStart: null,
                afternoonEnd: null,
                justificativaTipo: null,
                observation: null,
                _clear: true,
            }
        }));
    };

    const handleCloneFromLastDay = (dateKey) => {
        const allDays = getDaysInMonth(controlMonth);
        const currentIndex = allDays.indexOf(dateKey);

        for (let i = currentIndex - 1; i >= 0; i--) {
            const d = allDays[i];
            const existingLog = dailyLogs.find(l => l.date.startsWith(d));
            const changes = localChanges[d];

            const localHasHours = changes && !changes._clear &&
                (changes.morningStart || changes.morningEnd || changes.afternoonStart || changes.afternoonEnd);
            const dbHasHours = existingLog && parseFloat(existingLog.totalHours || 0) > 0;

            if (dbHasHours || localHasHours) {
                const source = { ...existingLog, ...(changes || {}) };
                setLocalChanges(prev => ({
                    ...prev,
                    [dateKey]: {
                        ...prev[dateKey],
                        employeeId: source.employeeId || getDefaultOperator(d) || getDefaultOperator(dateKey) || '',
                        morningStart: source.morningStart || null,
                        morningEnd: source.morningEnd || null,
                        afternoonStart: source.afternoonStart || null,
                        afternoonEnd: source.afternoonEnd || null,
                        justificativaTipo: null,
                        _clear: false,
                    }
                }));
                return;
            }
        }
        setAlertMessage("Nenhum dia anterior com horas lançadas encontrado neste mês.");
    };

    // Aplica os horários do painel "quick fill" a todos os dias úteis vazios (não sobrescreve).
    // Conta como "vazio" o dia que não tem horas no banco nem em localChanges, e não está limpo/justificado.
    const applyQuickFillToWorkdays = () => {
        const { morningStart, morningEnd, afternoonStart, afternoonEnd } = quickFill;
        if (!morningStart && !morningEnd && !afternoonStart && !afternoonEnd) {
            setAlertMessage("Preencha ao menos um horário no painel para aplicar.");
            return;
        }
        if (morningStart && morningEnd && morningEnd < morningStart) {
            setAlertMessage("Fim da manhã não pode ser menor que o início.");
            return;
        }
        if (afternoonStart && afternoonEnd && afternoonEnd < afternoonStart) {
            setAlertMessage("Fim da tarde não pode ser menor que o início.");
            return;
        }
        if (morningEnd && afternoonStart && afternoonStart < morningEnd) {
            setAlertMessage("Início da tarde não pode ser menor que o fim da manhã.");
            return;
        }

        const days = getDaysInMonth(controlMonth).filter(d => !isWeekend(d));
        const updates = {};
        let count = 0;
        days.forEach(d => {
            const log = dailyLogsByDate.get(d) || {};
            const changes = localChanges[d] || {};
            if (changes._clear) return;
            const justTipo = changes.justificativaTipo !== undefined ? changes.justificativaTipo : (log.justificativaTipo || null);
            if (justTipo) return;
            const has =
                (changes.morningStart || log.morningStart) ||
                (changes.morningEnd || log.morningEnd) ||
                (changes.afternoonStart || log.afternoonStart) ||
                (changes.afternoonEnd || log.afternoonEnd);
            if (has) return;
            updates[d] = {
                ...changes,
                employeeId: changes.employeeId !== undefined ? changes.employeeId : (log.employeeId || getDefaultOperator(d)),
                morningStart: morningStart || null,
                morningEnd: morningEnd || null,
                afternoonStart: afternoonStart || null,
                afternoonEnd: afternoonEnd || null,
            };
            count++;
        });
        if (count === 0) {
            setAlertMessage("Nenhum dia útil vazio encontrado neste mês.");
            return;
        }
        setLocalChanges(prev => ({ ...prev, ...updates }));
        setAlertMessage(`Horários aplicados a ${count} dia(s) útil(eis) vazio(s).`);
    };

    // Avança o foco depois de 4 dígitos numéricos digitados (HH + MM).
    // Não usa o value do input porque o <input type="time"> autocompleta segmentos
    // ambíguos (ex: "5" vira "05"), o que dispararia o pulo prematuramente.
    const handleTimeFocus = (e) => { e.target.dataset.digits = '0'; };

    const handleTimeKeyDown = (e, dayDate, currentField) => {
        if (e.key < '0' || e.key > '9') return;
        const count = (parseInt(e.target.dataset.digits || '0', 10)) + 1;
        e.target.dataset.digits = String(count);
        if (count < 4) return;
        const idx = TIME_FIELD_ORDER.indexOf(currentField);
        if (idx === -1 || idx === TIME_FIELD_ORDER.length - 1) return;
        const nextField = TIME_FIELD_ORDER[idx + 1];
        // setTimeout para o dígito atual ser aplicado antes do foco mudar
        setTimeout(() => {
            const next = document.querySelector(`[data-tk="${dayDate}-${nextField}"]`);
            if (next && !next.disabled) {
                next.focus();
                next.dataset.digits = '0';
            }
        }, 0);
    };

    const handleDateRangeChange = (field, value) => {
        const obra = obras.find(o => o.id === selectedObraId);
        if (obra) {
            const startLimit = new Date(obra.dataInicio);
            const endLimit = obra.dataFim ? new Date(obra.dataFim) : new Date();
            const checkDate = new Date(value);
            checkDate.setHours(12,0,0,0);
            startLimit.setHours(0,0,0,0);
            endLimit.setHours(23,59,59,999);

            if (!isNaN(checkDate.getTime()) && (checkDate < startLimit || checkDate > endLimit)) {
                setPendingDateChange({ field, value });
                setShowPasswordModal(true);
                return;
            }
        }
        if (field === 'start') setReportStartDate(value);
        else setReportEndDate(value);
        setPeriodPreset('custom');
    };

    const confirmDateChange = () => {
        if (pendingDateChange) {
            if (pendingDateChange.field === 'start') setReportStartDate(pendingDateChange.value);
            else setReportEndDate(pendingDateChange.value);
            setPendingDateChange(null);
        }
    };

    // ===================================================================================
    // GERAÇÃO DE PDF
    // ===================================================================================

    const generateDetailedPDF = async () => {
        const doc = new jsPDF('l', 'mm', 'a4'); 
        const obra = obras.find(o => o.id === selectedObraId);
        
        let vehicleLabel = "Todos";
        let frotaLabel = "";
        let operatorLabel = "Diversos";

        if (reportVehicleId) {
            const v = vehicles.find(ve => ve.id === reportVehicleId);
            if (v) {
                vehicleLabel = `${v.tipo} ${v.marca} ${v.modelo}${terceirizadoPdfMark(v)}`;
                frotaLabel = `${v.registroInterno}${terceirizadoPdfMark(v)}`;
                const operators = reportData.map(d => d.employeeName).filter(Boolean);
                if (operators.length > 0) {
                    const mode = operators.sort((a,b) =>
                        operators.filter(v => v===a).length - operators.filter(v => v===b).length
                    ).pop();
                    operatorLabel = mode;
                }
            }
        }

        try {
            const logoUrl = 'https://i.postimg.cc/pVnwyfRq/MAK-Servi-os-Logotipo.png';
            const logoData = await getImageDataUrl(logoUrl);
            doc.addImage(logoData, 'PNG', 240, 10, 40, 15); 
        } catch (err) {
            console.warn("Logo não carregado", err);
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("RELATÓRIO DE SERVIÇOS", 14, 15);
        doc.setFontSize(12);
        doc.text("PLANILHA DE HORAS", 14, 21);
        
        doc.setLineWidth(0.5);
        doc.line(14, 28, 283, 28); 

        doc.setFontSize(10);
        doc.text("DADOS DE IDENTIFICAÇÃO", 14, 33);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text("Obra:", 14, 40);
        doc.setFont('helvetica', 'normal');
        doc.text(formatObraNome(obra) || '', 40, 40);

        doc.setFont('helvetica', 'bold');
        doc.text("Equipamento:", 140, 40);
        doc.setFont('helvetica', 'normal');
        doc.text(vehicleLabel, 165, 40);

        doc.setFont('helvetica', 'bold');
        doc.text("Frota:", 14, 46);
        doc.setFont('helvetica', 'normal');
        doc.text(frotaLabel, 40, 46);

        doc.setFont('helvetica', 'bold');
        doc.text("Período:", 140, 46);
        doc.setFont('helvetica', 'normal');
        const periodoStr = `${formatDateToBR(reportStartDate)} A ${formatDateToBR(reportEndDate)}`;
        doc.text(periodoStr, 165, 46);

        doc.setFont('helvetica', 'bold');
        doc.text("Operador:", 14, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(operatorLabel, 40, 52);

        const sortedReportData = [...reportData]
            .filter(log => !log.justificativaTipo)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const tableBody = sortedReportData.map(log => {
            const morningHours = calculateTimeDiffDecimal(log.morningStart, log.morningEnd);
            const afternoonHours = calculateTimeDiffDecimal(log.afternoonStart, log.afternoonEnd);
            
            return [
                formatDateToBR(log.date), 
                getDayOfWeek(log.date),
                log.morningStart ? log.morningStart.slice(0, 5) : '',
                log.morningEnd ? log.morningEnd.slice(0, 5) : '',
                formatDecimalToTime(morningHours),
                log.afternoonStart ? log.afternoonStart.slice(0, 5) : '',
                log.afternoonEnd ? log.afternoonEnd.slice(0, 5) : '',
                formatDecimalToTime(afternoonHours),
                formatDecimalToTime(log.totalHours),
                log.observation || ''
            ];
        });

        autoTable(doc, {
            startY: 58,
            head: [
                [
                    { content: 'DATA', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                    { content: 'DIA DA SEMANA', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                    { content: 'MANHÃ', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'TARDE', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'TOTAL DIA', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                    { content: 'DESCRIÇÃO DOS SERVIÇOS', rowSpan: 2, styles: { valign: 'middle', halign: 'left' } },
                ],
                [
                    { content: 'INÍCIO', styles: { halign: 'center' } },
                    { content: 'TÉRMINO', styles: { halign: 'center' } },
                    { content: 'TOTAL', styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: 'INÍCIO', styles: { halign: 'center' } },
                    { content: 'TÉRMINO', styles: { halign: 'center' } },
                    { content: 'TOTAL', styles: { halign: 'center', fontStyle: 'bold' } },
                ]
            ],
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: 22, halign: 'center' },
                1: { cellWidth: 28, halign: 'center' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 15, halign: 'center' },
                4: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
                5: { cellWidth: 15, halign: 'center' },
                6: { cellWidth: 15, halign: 'center' },
                7: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
                8: { cellWidth: 20, halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] },
                9: { }
            },
            alternateRowStyles: { fillColor: [255, 255, 255] }
        });

        const totalDecimal = reportData.filter(l => !l.justificativaTipo).reduce((acc, curr) => acc + parseFloat(curr.totalHours), 0);
        const finalY = doc.lastAutoTable.finalY + 5;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("TOTAL HORAS MÊS:", 180, finalY + 5);
        doc.setFontSize(12);
        doc.text(formatDecimalToTime(totalDecimal), 220, finalY + 5);

        doc.save(`Relatorio_Servicos_${frotaLabel || 'Geral'}_${reportStartDate}.pdf`);
    };

    const generateSummaryPDF = () => {
        const doc = new jsPDF();
        const obra = obras.find(o => o.id === selectedObraId);
        const vehicleInfo = reportVehicleId ? `Veículo: ${vehicles.find(v => v.id === reportVehicleId)?.registroInterno}` : 'Geral';

        const groupSummary = {};
        const typeSummary = {};
        const vehicleSummary = {};

        reportData.filter(log => !log.justificativaTipo).forEach(log => {
            const type = log.tipo || 'Outros';
            const group = Object.keys(vehicleGroups).find(g => vehicleGroups[g].includes(type)) || 'Outros';

            if (!typeSummary[type]) typeSummary[type] = { hours: 0, vehicles: new Set() };
            typeSummary[type].hours += parseFloat(log.totalHours);
            typeSummary[type].vehicles.add(log.registroInterno);

            if (!groupSummary[group]) groupSummary[group] = { hours: 0 };
            groupSummary[group].hours += parseFloat(log.totalHours);

            const vId = log.vehicleId;
            if (!vehicleSummary[vId]) {
                vehicleSummary[vId] = {
                    label: `${log.registroInterno} - ${log.modelo}${terceirizadoPdfMark(vehicles.find(v => v.id === vId))}`,
                    type: type,
                    hours: 0
                };
            }
            vehicleSummary[vId].hours += parseFloat(log.totalHours);
        });

        doc.setFontSize(16);
        doc.text(`Resumo de Horas: ${formatObraNome(obra) || 'N/A'}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Filtro: ${vehicleInfo} | Período: ${formatDateToBR(reportStartDate)} a ${formatDateToBR(reportEndDate)}`, 14, 22);

        const groupTableData = Object.keys(groupSummary).map(group => [group, formatDecimalToTime(groupSummary[group].hours)]);
        doc.setFontSize(12);
        doc.text("Resumo por Tipo de Veículos", 14, 30);
        autoTable(doc, { startY: 32, head: [['Tipo', 'Horas Totais']], body: groupTableData, headStyles: { fillColor: [50, 50, 50], textColor: [255,255,255], fontStyle: 'bold' }, theme: 'grid' });

        const typeTableData = Object.keys(typeSummary).map(type => [type, typeSummary[type].vehicles.size, formatDecimalToTime(typeSummary[type].hours)]);
        doc.setFontSize(12);
        doc.text("Detalhamento por Grupo de Equipamento", 14, doc.lastAutoTable.finalY + 10);
        autoTable(doc, { startY: doc.lastAutoTable.finalY + 12, head: [['Grupo de Equipamento', 'Qtd Veículos', 'Horas Totais']], body: typeTableData, headStyles: { fillColor: [250, 204, 21], textColor: [0,0,0], fontStyle: 'bold' } });

        const vehicleTableData = Object.values(vehicleSummary).sort((a, b) => a.label.localeCompare(b.label)).map(v => [v.label, v.type, formatDecimalToTime(v.hours)]);
        let finalY = doc.lastAutoTable.finalY; 
        if (finalY > 240) { doc.addPage(); finalY = 20; }
        doc.setFontSize(12);
        doc.text("Detalhamento por Equipamento", 14, finalY + 10);
        autoTable(doc, { startY: finalY + 12, head: [['Equipamento', 'Grupo', 'Horas Totais']], body: vehicleTableData, headStyles: { fillColor: [250, 204, 21], textColor: [0,0,0], fontStyle: 'bold' } });

        doc.save(`Resumo_${obra?.nome}_${reportStartDate}.pdf`);
    };

    // --- RENDERIZAÇÃO ---
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" mb-6 flex items-center gap-2">
                <FileText className="text-yellow-500" /> Faturamento & Controle
            </h1>

            {/* Seleção de Obra */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Selecione a Obra</label>
                <SearchableObraSelect
                    obras={obras.filter(o => (o.tipo_registro || 'obra') !== 'centro_custo')}
                    value={selectedObraId}
                    onChange={(obra) => obra ? handleObraSelect(obra) : handleObraClear()}
                    placeholder="Buscar obra pelo nome..."
                    includeInactive={true}
                    storageKey={RECENT_OBRAS_KEY}
                />
            </div>

            {/* Estado vazio orientado */}
            {!selectedObraId && (
                <div className="bg-white rounded-lg shadow p-12 flex flex-col items-center text-center">
                    <Building2 size={48} className="text-gray-200 mb-4" />
                    <p className="text-gray-500 font-medium mb-1">Nenhuma obra selecionada</p>
                    <p className="text-gray-400 text-sm mb-6">Selecione uma obra acima para acessar o controle de horas ou gerar relatórios.</p>

                    {recentObras.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-2">
                            <span className="text-xs text-gray-400 w-full mb-1">Acessadas recentemente:</span>
                            {recentObras.slice(0, 5).map(obra => {
                                const isActive = activeObras.some(a => a.id === obra.id);
                                return (
                                    <button key={obra.id} onClick={() => handleObraSelect(obra)}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition font-medium ${
                                            isActive
                                                ? 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100'
                                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                        }`}>
                                        {formatObraNome(obra)}
                                        {!isActive && <span className="ml-1 opacity-50 text-[10px]">(finalizada)</span>}
                                    </button>
                                );
                            })}
                        </div>
                    ) : activeObras.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2">
                            <span className="text-xs text-gray-400 w-full mb-1">Acesso rápido:</span>
                            {activeObras.slice(0, 4).map(obra => (
                                <button key={obra.id} onClick={() => handleObraSelect(obra)}
                                    className="px-3 py-1.5 text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-full hover:bg-yellow-100 transition font-medium">
                                    {formatObraNome(obra)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {selectedObraId && (
                <>
                    {/* Card de contexto da obra */}
                    <div className={`flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg mb-4 border ${obraIsActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <Building2 size={20} className={obraIsActive ? 'text-green-600' : 'text-red-500'} />
                        <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm truncate ${obraIsActive ? 'text-green-800' : 'text-red-700'}`}>{formatObraNome(selectedObra)}</p>
                            <p className="text-xs text-gray-500">
                                {selectedObra?.dataInicio ? formatDateToBR(selectedObra.dataInicio) : '?'}
                                {' → '}
                                {selectedObra?.dataFim ? formatDateToBR(selectedObra.dataFim) : 'Em andamento'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500">
                                <span className="font-bold text-gray-700">{getObraVehicles.filter(v => v.statusNaObra === 'presente').length}</span> equip. ativos
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-bold ${obraIsActive ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700'}`}>
                                {obraIsActive ? 'Ativa' : 'Finalizada'}
                            </span>
                        </div>
                    </div>

                    {/* Aviso de alterações não salvas */}
                    {activeTab === 'controle' && Object.keys(localChanges).length > 0 && (
                        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 mb-4 text-sm">
                            <p className="text-amber-800 font-medium">
                                <AlertTriangle size={15} className="inline mr-1.5 mb-0.5" />
                                Você tem <span className="font-bold">{Object.keys(localChanges).length}</span> dia(s) com alterações não salvas.
                            </p>
                            <button onClick={handleSaveDailyLogs} disabled={isSaving}
                                className="px-3 py-1 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600 disabled:opacity-60 transition">
                                {isSaving ? 'Salvando...' : 'Salvar agora'}
                            </button>
                        </div>
                    )}

                    {/* Abas */}
                    <div className="flex mb-6" style={{ borderBottom: "1px solid #e8e0d4" }}>
                        {!isViewer && (
                            <button
                                onClick={() => setActiveTab('controle')}
                                className={`py-2 px-6 font-semibold flex items-center gap-2 ${activeTab === 'controle' ? 'border-b-2 border-[#9E7A42] text-[#9E7A42]' : 'text-gray-500'}`}
                            >
                                <Clock size={18}/> Controle Diário
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('relatorio')}
                            className={`py-2 px-6 font-semibold flex items-center gap-2 ${activeTab === 'relatorio' ? 'border-b-2 border-[#9E7A42] text-[#9E7A42]' : 'text-gray-500'}`}
                        >
                            <Download size={18}/> Relatórios & Faturamento
                        </button>
                    </div>

                    {/* CONTEÚDO DA ABA: CONTROLE DIÁRIO */}
                    {activeTab === 'controle' && !isViewer && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row items-end gap-4 bg-gray-50 p-4 rounded-md border">
                                <div className="flex-1 w-full">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Equipamento</label>
                                    <select
                                        value={controlVehicleId}
                                        onChange={(e) => setControlVehicleId(e.target.value)}
                                        className="w-full p-2 border rounded text-sm bg-white"
                                    >
                                        <option value="">-- Selecione o Equipamento --</option>
                                        {getObraVehicles.filter(v => v.statusNaObra === 'presente').length > 0 && (
                                            <optgroup label="Presentes na obra">
                                                {getObraVehicles.filter(v => v.statusNaObra === 'presente').map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.registroInterno} - {v.tipo} - {v.marca} - {v.modelo}{terceirizadoPdfMark(v)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {getObraVehicles.filter(v => v.statusNaObra === 'historico').length > 0 && (
                                            <optgroup label="Saíram da obra (histórico)">
                                                {getObraVehicles.filter(v => v.statusNaObra === 'historico').map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.registroInterno} - {v.tipo} - {v.marca} - {v.modelo}{terceirizadoPdfMark(v)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                                <div className="w-full md:w-auto">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Mês de Referência</label>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => navigateMonth(-1)} title="Mês anterior"
                                            className="p-2 rounded border bg-white hover:bg-gray-100 transition text-gray-600">
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className="relative" ref={monthPickerControlRef}>
                                            <button
                                                onClick={() => { setControlPickerYear(parseInt(controlMonth.split('-')[0])); setShowMonthPickerControl(v => !v); }}
                                                className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap border rounded bg-white hover:bg-[#fdf8f0] hover:border-[#9E7A42] transition"
                                                title="Selecionar mês/ano"
                                            >
                                                {formatMonthLabel(controlMonth)}
                                            </button>
                                            {showMonthPickerControl && (
                                                <div className="absolute z-40 top-full mt-1 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl p-3 w-64" style={{ border: "1px solid #f0ebe3" }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <button onClick={() => setControlPickerYear(y => y - 1)} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={16}/></button>
                                                        <span className="font-bold text-sm text-gray-700">{controlPickerYear}</span>
                                                        <button onClick={() => setControlPickerYear(y => y + 1)} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={16}/></button>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => {
                                                            const isSelected = controlMonth === `${controlPickerYear}-${String(i+1).padStart(2,'0')}`;
                                                            return (
                                                                <button key={i} onClick={() => applyMonthToControl(controlPickerYear, i)}
                                                                    className={`py-1.5 rounded text-xs font-semibold transition ${isSelected ? 'bg-[#9E7A42] text-white' : 'hover:bg-[#fdf8f0] text-gray-700'}`}>
                                                                    {m}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => navigateMonth(1)} title="Próximo mês"
                                            className="p-2 rounded border bg-white hover:bg-gray-100 transition text-gray-600">
                                            <ChevronRight size={16} />
                                        </button>
                                        <button onClick={scrollToToday} title="Ir para hoje"
                                            className="px-2 py-2 rounded border bg-white hover:bg-[#fdf8f0] hover:border-[#9E7A42] transition text-xs font-bold text-yellow-600 whitespace-nowrap">
                                            Hoje
                                        </button>
                                    </div>
                                </div>
                                <div className="w-full md:w-auto">
                                    <button
                                        onClick={handleSaveDailyLogs}
                                        disabled={isSaving || Object.keys(localChanges).length === 0}
                                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm font-semibold"
                                    >
                                        {isSaving ? 'Salvando...' : (
                                            <>
                                                Salvar Mês
                                                {Object.keys(localChanges).length > 0 && (
                                                    <span className="bg-white text-green-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                        {Object.keys(localChanges).length}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        <Save size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Indicador de progresso do mês */}
                            {monthProgress && (
                                <div className="bg-white rounded-lg shadow px-4 py-3">
                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                                        <span>{monthProgress.filled} de {monthProgress.total} dias úteis preenchidos</span>
                                        <span className="font-bold">{monthProgress.total > 0 ? Math.round((monthProgress.filled / monthProgress.total) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-300 ${monthProgress.total > 0 && (monthProgress.filled / monthProgress.total) >= 0.8 ? 'bg-green-500' : 'bg-yellow-400'}`}
                                            style={{ width: `${monthProgress.total > 0 ? (monthProgress.filled / monthProgress.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Painel Quick Fill — aplica horários a dias úteis vazios */}
                            {controlVehicleId && (
                                <div className="bg-white shadow rounded-lg p-4">
                                    <div className="flex flex-col md:flex-row md:items-end gap-3">
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-gray-700 uppercase mb-2">Preenchimento rápido</p>
                                            <p className="text-[11px] text-gray-500 mb-2">Aplica os horários abaixo a todos os dias úteis vazios deste mês. Não sobrescreve dias já preenchidos ou justificados.</p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                {[
                                                    { f: 'morningStart', l: 'Manhã início' },
                                                    { f: 'morningEnd', l: 'Manhã fim' },
                                                    { f: 'afternoonStart', l: 'Tarde início' },
                                                    { f: 'afternoonEnd', l: 'Tarde fim' },
                                                ].map(({ f, l }) => (
                                                    <div key={f}>
                                                        <label className="block text-[10px] text-gray-500">{l}</label>
                                                        <input
                                                            type="time"
                                                            value={quickFill[f]}
                                                            onChange={(e) => setQuickFill(q => ({ ...q, [f]: e.target.value }))}
                                                            className="time-input-clean w-full text-xs p-1 border rounded text-center"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={applyQuickFillToWorkdays}
                                            className="px-4 py-2 bg-[#9E7A42] text-white text-xs font-semibold rounded hover:bg-[#8a6a34] transition whitespace-nowrap"
                                        >
                                            Aplicar a dias úteis vazios
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Tabela de Dias do Mês */}
                            <div className="bg-white shadow rounded-lg overflow-hidden">
                                {loadingLogs ? (
                                    <div className="p-8 text-center text-gray-500">Carregando registros...</div>
                                ) : !controlVehicleId ? (
                                    <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                                        <ArrowRight size={32} className="mb-2 opacity-20"/>
                                        <p>Selecione um equipamento e o mês para lançar as horas.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-3">Dia</th>
                                                    <th className="px-4 py-3">Operador</th>
                                                    <th className="px-4 py-3 text-center" colSpan={2}>Manhã (Início - Fim)</th>
                                                    <th className="px-4 py-3 text-center" colSpan={2}>Tarde (Início - Fim)</th>
                                                    <th className="px-4 py-3 text-center">Total</th>
                                                    <th className="px-4 py-3">Obs</th>
                                                    <th className="px-4 py-3 text-center">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {(() => {
                                                    const now = new Date();
                                                    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                                                    const calcDiff = (s, e) => {
                                                        if (!s || !e) return 0;
                                                        const [h1, m1] = s.split(':').map(Number);
                                                        const [h2, m2] = e.split(':').map(Number);
                                                        return Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
                                                    };

                                                    return getDaysInMonth(controlMonth).map(dayDate => {
                                                        const existingLog = dailyLogsByDate.get(dayDate) || {};
                                                        const changes = localChanges[dayDate] || {};
                                                        const isCleared = !!changes._clear;

                                                        const justificativaTipo = isCleared ? null : (
                                                            changes.justificativaTipo !== undefined
                                                                ? changes.justificativaTipo
                                                                : (existingLog.justificativaTipo || null)
                                                        );

                                                        const employeeId = changes.employeeId !== undefined ? changes.employeeId : (existingLog.employeeId || getDefaultOperator(dayDate));
                                                        const mStart = (justificativaTipo || isCleared) ? '' : (changes.morningStart !== undefined ? changes.morningStart : (existingLog.morningStart || ''));
                                                        const mEnd = (justificativaTipo || isCleared) ? '' : (changes.morningEnd !== undefined ? changes.morningEnd : (existingLog.morningEnd || ''));
                                                        const aStart = (justificativaTipo || isCleared) ? '' : (changes.afternoonStart !== undefined ? changes.afternoonStart : (existingLog.afternoonStart || ''));
                                                        const aEnd = (justificativaTipo || isCleared) ? '' : (changes.afternoonEnd !== undefined ? changes.afternoonEnd : (existingLog.afternoonEnd || ''));
                                                        const obs = isCleared ? '' : (changes.observation !== undefined ? changes.observation : (existingLog.observation || ''));

                                                        const totalDecimal = justificativaTipo ? 0 : (calcDiff(mStart, mEnd) + calcDiff(aStart, aEnd));
                                                        const hasHours = !!(mStart || mEnd || aStart || aEnd);
                                                        // Pares incompletos (só início ou só fim): borda âmbar para destacar
                                                        const morningPartial = !justificativaTipo && !isCleared && ((!!mStart) !== (!!mEnd));
                                                        const afternoonPartial = !justificativaTipo && !isCleared && ((!!aStart) !== (!!aEnd));
                                                        const partialBorder = 'ring-1 ring-amber-400 border-amber-400';
                                                        const isToday = dayDate === todayStr;
                                                        const isWknd = isWeekend(dayDate);
                                                        const dow = getDayOfWeekShort(dayDate);
                                                        const dayNumber = dayDate.split('-')[2];
                                                        const isActive = activeRowDate === dayDate;

                                                        let rowBg = '';
                                                        if (isCleared) rowBg = 'bg-red-50';
                                                        else if (justificativaTipo) rowBg = 'bg-yellow-50';
                                                        else if (isToday) rowBg = 'bg-blue-50';
                                                        else if (isWknd) rowBg = 'bg-slate-50';

                                                        return (
                                                            <tr
                                                                key={dayDate}
                                                                ref={isToday ? todayRowRef : null}
                                                                className={`hover:bg-gray-50 transition-colors ${rowBg} ${isActive ? 'border-l-2 border-yellow-400' : 'border-l-2 border-transparent'}`}
                                                                onFocus={() => setActiveRowDate(dayDate)}
                                                            >
                                                                <td className="px-3 py-2 font-medium border-r w-28">
                                                                    <div className="flex flex-col leading-tight">
                                                                        <span>
                                                                            {dayNumber}
                                                                            <span className="text-xs text-gray-400 font-normal"> / {dayDate.split('-')[1]}</span>
                                                                        </span>
                                                                        <span className={`text-[10px] font-semibold ${isWknd ? 'text-orange-500' : 'text-gray-400'}`}>{dow}</span>
                                                                    </div>
                                                                    {isToday && <span className="text-[9px] bg-yellow-200 text-yellow-800 px-1 rounded mt-0.5 inline-block">Hoje</span>}
                                                                </td>
                                                                <td className="px-2 py-2 w-48">
                                                                    <select
                                                                        value={employeeId}
                                                                        disabled={isCleared}
                                                                        onChange={(e) => handleInputChange(dayDate, 'employeeId', e.target.value)}
                                                                        className="w-full text-xs p-1 border rounded bg-white focus:border-yellow-500 disabled:bg-gray-100 disabled:text-gray-400"
                                                                    >
                                                                        <option value="">-- Operador --</option>
                                                                        {employees.sort((a,b)=>a.nome.localeCompare(b.nome)).map(emp => (
                                                                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td className="px-1 py-2 w-20"><input data-tk={`${dayDate}-morningStart`} type="time" value={mStart} disabled={!!justificativaTipo || isCleared} onFocus={handleTimeFocus} onKeyDown={(e) => handleTimeKeyDown(e, dayDate, 'morningStart')} onChange={(e) => handleInputChange(dayDate, 'morningStart', e.target.value)} onBlur={() => handleTimeBlur(dayDate, 'morningStart')} title={morningPartial ? 'Período da manhã incompleto' : ''} className={`time-input-clean w-full text-xs p-1 border rounded text-center disabled:bg-gray-100 disabled:text-gray-400 ${morningPartial ? partialBorder : ''}`}/></td>
                                                                <td className="px-1 py-2 w-20 border-r"><input data-tk={`${dayDate}-morningEnd`} type="time" value={mEnd} min={mStart || undefined} disabled={!!justificativaTipo || isCleared} onFocus={handleTimeFocus} onKeyDown={(e) => handleTimeKeyDown(e, dayDate, 'morningEnd')} onChange={(e) => handleInputChange(dayDate, 'morningEnd', e.target.value)} onBlur={() => handleTimeBlur(dayDate, 'morningEnd')} title={morningPartial ? 'Período da manhã incompleto' : ''} className={`time-input-clean w-full text-xs p-1 border rounded text-center disabled:bg-gray-100 disabled:text-gray-400 ${morningPartial ? partialBorder : ''}`}/></td>
                                                                <td className="px-1 py-2 w-20"><input data-tk={`${dayDate}-afternoonStart`} type="time" value={aStart} min={mEnd || mStart || undefined} disabled={!!justificativaTipo || isCleared} onFocus={handleTimeFocus} onKeyDown={(e) => handleTimeKeyDown(e, dayDate, 'afternoonStart')} onChange={(e) => handleInputChange(dayDate, 'afternoonStart', e.target.value)} onBlur={() => handleTimeBlur(dayDate, 'afternoonStart')} title={afternoonPartial ? 'Período da tarde incompleto' : ''} className={`time-input-clean w-full text-xs p-1 border rounded text-center disabled:bg-gray-100 disabled:text-gray-400 ${afternoonPartial ? partialBorder : ''}`}/></td>
                                                                <td className="px-1 py-2 w-20 border-r"><input data-tk={`${dayDate}-afternoonEnd`} type="time" value={aEnd} min={aStart || mEnd || mStart || undefined} disabled={!!justificativaTipo || isCleared} onChange={(e) => handleInputChange(dayDate, 'afternoonEnd', e.target.value)} onBlur={() => handleTimeBlur(dayDate, 'afternoonEnd')} title={afternoonPartial ? 'Período da tarde incompleto' : ''} className={`time-input-clean w-full text-xs p-1 border rounded text-center disabled:bg-gray-100 disabled:text-gray-400 ${afternoonPartial ? partialBorder : ''}`}/></td>
                                                                <td className="px-2 py-2 text-center w-28">
                                                                    {justificativaTipo ? (
                                                                        <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                                                                            {JUSTIFICATIVA_LABELS[justificativaTipo]}
                                                                        </span>
                                                                    ) : isCleared ? (
                                                                        <span className="text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-semibold">Limpar</span>
                                                                    ) : (
                                                                        <span className={`font-bold text-sm ${totalDecimal > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                                                                            {formatDecimalToTime(totalDecimal)}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder={justificativaTipo === 'outro' ? 'Descreva o motivo...' : 'Obs...'}
                                                                        value={obs}
                                                                        disabled={isCleared}
                                                                        onChange={(e) => handleInputChange(dayDate, 'observation', e.target.value)}
                                                                        className="w-full text-xs p-1 border-b focus:border-yellow-500 outline-none bg-transparent disabled:text-gray-400"
                                                                    />
                                                                </td>
                                                                <td className="px-2 py-2 w-28">
                                                                    <div className="flex items-center justify-center gap-0.5">
                                                                        <div className="relative">
                                                                            <button
                                                                                onClick={() => setJustificativaOpenDate(justificativaOpenDate === dayDate ? null : dayDate)}
                                                                                disabled={hasHours || isCleared}
                                                                                title="Justificar ausência"
                                                                                className={`p-1.5 rounded transition ${justificativaTipo ? 'text-yellow-500 bg-yellow-100' : 'hover:bg-yellow-100 text-yellow-500'} disabled:text-gray-300 disabled:cursor-not-allowed`}
                                                                            >
                                                                                <AlertTriangle size={14}/>
                                                                            </button>
                                                                            {justificativaOpenDate === dayDate && (
                                                                                <div className="absolute z-20 right-0 mt-1 bg-white rounded-lg shadow-xl p-1 min-w-max" style={{ border: "1px solid #f0ebe3" }}>
                                                                                    {Object.entries(JUSTIFICATIVA_LABELS).map(([tipo, label]) => (
                                                                                        <button
                                                                                            key={tipo}
                                                                                            onClick={() => handleSetJustificativa(dayDate, tipo)}
                                                                                            className="block w-full text-left text-xs px-3 py-2 hover:bg-[#fdf8f0] rounded text-gray-700 hover:text-yellow-800"
                                                                                        >
                                                                                            {label}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleClearDay(dayDate)}
                                                                            title="Limpar dia (remove horas e justificativa)"
                                                                            className="p-1.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition"
                                                                        >
                                                                            <Trash2 size={14}/>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleCloneFromLastDay(dayDate)}
                                                                            title="Clonar último dia com horas lançadas"
                                                                            className="p-1.5 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition"
                                                                        >
                                                                            <Copy size={14}/>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                            {controlVehicleId && (
                                                <tfoot>
                                                    <tr className="bg-gray-800 text-white text-xs font-bold">
                                                        <td colSpan={6} className="px-4 py-2 text-right uppercase tracking-wide">Total do Mês</td>
                                                        <td className="px-2 py-2 text-center text-base">
                                                            {formatDecimalToTime(monthTotalDecimal)}
                                                        </td>
                                                        <td colSpan={2} className="px-4 py-2"></td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CONTEÚDO DA ABA: RELATÓRIOS & FATURAMENTO */}
                    {activeTab === 'relatorio' && (
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-lg border grid gap-4">
                                <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2"><Filter size={16}/> Filtros do Relatório</h3>

                                {/* Atalhos de período */}
                                <div className="flex flex-wrap gap-2 items-center">
                                    {[
                                        { key: 'week', label: 'Esta semana' },
                                        { key: 'month', label: 'Este mês' },
                                        { key: 'lastmonth', label: 'Mês anterior' },
                                        { key: '3months', label: 'Últimos 3 meses' },
                                        { key: 'custom', label: 'Personalizado' },
                                    ].map(p => (
                                        <button key={p.key} onClick={() => p.key === 'custom' ? setPeriodPreset('custom') : applyPreset(p.key)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${periodPreset === p.key ? 'bg-[#9E7A42] text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-300 hover:border-[#9E7A42] hover:text-[#9E7A42]'}`}>
                                            {p.label}
                                        </button>
                                    ))}

                                    {/* Seletor de mês específico */}
                                    <div className="relative" ref={monthPickerReportRef}>
                                        <button
                                            onClick={() => { setReportPickerYear(new Date().getFullYear()); setShowMonthPickerReport(v => !v); }}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1 ${periodPreset === 'specificMonth' ? 'bg-[#9E7A42] text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-300 hover:border-[#9E7A42] hover:text-[#9E7A42]'}`}>
                                            <Calendar size={12}/> Mês específico
                                        </button>
                                        {showMonthPickerReport && (
                                            <div className="absolute z-40 top-full mt-1 left-0 bg-white rounded-xl shadow-2xl p-3 w-64" style={{ border: "1px solid #f0ebe3" }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <button onClick={() => setReportPickerYear(y => y - 1)} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={16}/></button>
                                                    <span className="font-bold text-sm text-gray-700">{reportPickerYear}</span>
                                                    <button onClick={() => setReportPickerYear(y => y + 1)} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={16}/></button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => {
                                                        const isSelected = periodPreset === 'specificMonth' &&
                                                            reportStartDate === `${reportPickerYear}-${String(i+1).padStart(2,'0')}-01`;
                                                        return (
                                                            <button key={i} onClick={() => applyMonthToReport(reportPickerYear, i)}
                                                                className={`py-1.5 rounded text-xs font-semibold transition ${isSelected ? 'bg-[#9E7A42] text-white' : 'hover:bg-[#fdf8f0] text-gray-700'}`}>
                                                                {m}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>


                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">Data Inicial</label>
                                        <input
                                            type="date"
                                            value={reportStartDate}
                                            onChange={(e) => handleDateRangeChange('start', e.target.value)}
                                            className="w-full p-2 border rounded mt-1 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">Data Final</label>
                                        <input
                                            type="date"
                                            value={reportEndDate}
                                            onChange={(e) => handleDateRangeChange('end', e.target.value)}
                                            className="w-full p-2 border rounded mt-1 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">Filtrar Equipamento</label>
                                        <select
                                            value={reportVehicleId}
                                            onChange={(e) => setReportVehicleId(e.target.value)}
                                            className="w-full p-2 border rounded mt-1 text-sm"
                                        >
                                            <option value="">Todos os equipamentos</option>
                                            {(reportStartDate && reportEndDate) ? (
                                                <>
                                                    {vehiclesWithDataInPeriod.length > 0 && (
                                                        <optgroup label={`Com registros no período (${vehiclesWithDataInPeriod.length})`}>
                                                            {vehiclesWithDataInPeriod.map(v => (
                                                                <option key={v.id} value={v.id}>
                                                                    {v.registroInterno} - {v.tipo} - {v.marca} - {v.modelo}{terceirizadoPdfMark(v)}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {getObraVehicles.filter(v => !vehiclesWithDataInPeriod.find(vd => vd.id === v.id)).length > 0 && (
                                                        <optgroup label={`Sem registros no período (${getObraVehicles.length - vehiclesWithDataInPeriod.length})`}>
                                                            {getObraVehicles.filter(v => !vehiclesWithDataInPeriod.find(vd => vd.id === v.id)).map(v => (
                                                                <option key={v.id} value={v.id}>
                                                                    {v.registroInterno} - {v.tipo} - {v.marca} - {v.modelo}{terceirizadoPdfMark(v)}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </>
                                            ) : (
                                                getObraVehicles.map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.registroInterno} - {v.tipo} - {v.marca} - {v.modelo}{terceirizadoPdfMark(v)}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={generateDetailedPDF} disabled={!reportData.length} className="flex-1 py-2 px-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center gap-2 text-xs font-bold">
                                            <Printer size={16}/> Detalhado
                                        </button>
                                        <button onClick={generateSummaryPDF} disabled={!reportData.length} className="flex-1 py-2 px-3 bg-[#9E7A42] text-white rounded hover:bg-yellow-600 disabled:bg-gray-300 flex items-center justify-center gap-2 text-xs font-bold">
                                            <Printer size={16}/> Resumo
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Resumo por GRUPOS */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(reportData.filter(l => !l.justificativaTipo).reduce((acc, curr) => {
                                    const type = curr.tipo || 'Outros';
                                    const group = Object.keys(vehicleGroups).find(g => vehicleGroups[g].includes(type)) || 'Outros';
                                    acc[group] = (acc[group] || 0) + parseFloat(curr.totalHours);
                                    return acc;
                                }, {})).map(([group, hours]) => (
                                    <div key={group} className="bg-gray-800 text-white p-4 rounded shadow">
                                        <h3 className="text-xs font-bold uppercase opacity-80">{group}</h3>
                                        <p className="text-2xl font-bold">{formatDecimalToTime(hours)} h</p>
                                    </div>
                                ))}
                            </div>

                            {/* Resumo por TIPOS */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                {Object.entries(reportData.filter(l => !l.justificativaTipo).reduce((acc, curr) => {
                                    const type = curr.tipo || 'Outros';
                                    acc[type] = (acc[type] || 0) + parseFloat(curr.totalHours);
                                    return acc;
                                }, {})).map(([tipo, hours]) => (
                                    <div key={tipo} className="bg-white p-3 rounded shadow border-l-4 border-yellow-400">
                                        <h3 className="text-[10px] font-bold text-gray-500 uppercase">{tipo}</h3>
                                        <p className="text-lg font-bold text-gray-800">{formatDecimalToTime(hours)} h</p>
                                    </div>
                                ))}
                                <div className="bg-blue-600 p-3 rounded shadow text-white md:col-span-1">
                                    <h3 className="text-[10px] font-bold uppercase opacity-80">Total Geral</h3>
                                    <p className="text-lg font-bold">
                                        {formatDecimalToTime(reportData.filter(l => !l.justificativaTipo).reduce((acc, curr) => acc + parseFloat(curr.totalHours), 0))} h
                                    </p>
                                </div>
                            </div>

                            {/* Tabela de Visualização Rápida */}
                            <div className="bg-white shadow rounded-lg overflow-hidden mt-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-100 uppercase text-xs font-bold">
                                            <tr>
                                                <th className="px-4 py-2">Data</th>
                                                <th className="px-4 py-2">Equipamento</th>
                                                <th className="px-4 py-2">Operador</th>
                                                <th className="px-4 py-2">Total Horas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.slice(0, 50).map(log => (
                                                <tr key={log.id} className="border-b hover:bg-gray-50">
                                                    {/* DATA CORRIGIDA NA VISUALIZAÇÃO DE TELA */}
                                                    <td className="px-4 py-2">{formatDateToBR(log.date)}</td>
                                                    <td className="px-4 py-2 font-medium">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {log.registroInterno} <span className="text-gray-500 font-normal text-xs">({log.tipo})</span>
                                                            <TerceirizadoBadge vehicle={vehicles.find(v => v.id === log.vehicleId)} />
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">{log.employeeName}</td>
                                                    <td className="px-4 py-2 font-bold text-blue-600">{formatDecimalToTime(log.totalHours)}</td>
                                                </tr>
                                            ))}
                                            {reportData.length > 50 && (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-2 text-gray-500 italic">...e mais {reportData.length - 50} registros. Baixe o PDF para ver tudo.</td>
                                                </tr>
                                            )}
                                            {reportData.length === 0 && (
                                                 <tr>
                                                    <td colSpan="4" className="text-center py-8 text-gray-500 italic">Nenhum registro encontrado para o período/filtro selecionado.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal de Senha */}
            {showPasswordModal && (
                <PasswordConfirmationModal 
                    onConfirm={confirmDateChange} 
                    onClose={() => { setShowPasswordModal(false); setPendingDateChange(null); }}
                    apiClient={apiClient}
                    message="A data selecionada está fora do período de vigência da obra. Insira sua senha para liberar."
                />
            )}
        </div>
    );
};

export default BillingPage;


