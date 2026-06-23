import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExcavatorLoader from '../components/ui/ExcavatorLoader';
import {
    ArrowLeft, DollarSign, Truck, Save, Loader,
    AlertTriangle, MessageSquare, FileText, FileDown,
    Calendar, TrendingUp, Plus, Edit2, X, Filter, Clock,
    CheckCircle2, User
} from 'lucide-react';
import apiClient from '../services/apiClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatObraNome } from '../utils/obraFormat';

const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAQAAAAAYLlVAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAADsQAAA7EAZUrDhsAAAAHdElNRQfmAg0KDwAbx48gAAAAHUlEQVRo3u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAJAwmAAAFzJ7O5AAAAAElFTkSuQmCC";

const INTERACTION_TYPES = {
    daily_log:         { label: 'Diário de Bordo',  dot: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 border-blue-200' },
    billing_milestone: { label: 'Marco de Cobrança', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    routine:           { label: 'Rotina Diária',    dot: 'bg-slate-400',   chip: 'bg-slate-50 text-slate-700 border-slate-200' },
    issue:             { label: 'Problema',         dot: 'bg-red-500',     chip: 'bg-red-50 text-red-700 border-red-200' },
};

const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatGroupDate = (iso) => {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - target) / 86400000);
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const sanitizeFilename = (s) => (s || 'obra').toString().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60);

// ============================================================================
// SUPERVISOR OBRA DETAIL
// ============================================================================
const SupervisorObraDetail = ({ obraId, onBack }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [crmDrawerOpen, setCrmDrawerOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [historyFilter, setHistoryFilter] = useState('todos');

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/supervisor/obra/' + obraId);
            setData(res);
        } catch (error) {
            console.error("Erro:", error);
        } finally {
            setLoading(false);
        }
    }, [obraId]);

    useEffect(() => { if (obraId) fetchDetails(); }, [obraId, fetchDetails]);

    const previsao = useMemo(() => {
        if (!data) return { date: new Date(), diasRestantes: 0 };
        const saldo = data.producao?.saldo_horas || 0;
        const ritmo = data.producao?.media_diaria_atual || 1;
        if (saldo <= 0) return { date: new Date(), diasRestantes: 0 };
        const diasRestantes = Math.ceil(saldo / ritmo);
        let date = new Date();
        let added = 0;
        while (added < diasRestantes && added < 2000) {
            date.setDate(date.getDate() + 1);
            if (date.getDay() !== 0 && date.getDay() !== 6) added++;
        }
        return { date, diasRestantes };
    }, [data]);

    const historyByDay = useMemo(() => {
        if (!data?.crm_history?.length) return [];
        const filtered = historyFilter === 'todos'
            ? data.crm_history
            : data.crm_history.filter(h => h.interaction_type === historyFilter);
        const groups = new Map();
        filtered.forEach(h => {
            const key = new Date(h.created_at).toISOString().slice(0, 10);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(h);
        });
        return Array.from(groups.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([key, items]) => ({ key, label: formatGroupDate(key + 'T12:00:00'), items }));
    }, [data, historyFilter]);

    const handleUpdateMission = async (vehicleId, location, date) => {
        try {
            await apiClient.post('/supervisor/vehicle-mission', {
                vehicle_id: vehicleId,
                next_location: location,
                release_date: date,
            });
            setEditingVehicle(null);
            fetchDetails();
        } catch (e) { alert("Erro ao salvar destino."); }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center" style={{ background: '#f5f3ef' }}>
                <ExcavatorLoader size="md" />
            </div>
        );
    }
    if (!data) return <div className="p-8">Erro ao carregar dados.</div>;

    const { obra, contract, financeiro, producao, veiculos, crm_history } = data;

    const totalHoras = (producao?.saldo_horas || 0) + (producao?.horas_executadas || 0);
    const percHoras = totalHoras > 0 ? (producao.horas_executadas / totalHoras) * 100 : 0;
    const valorContrato = Number(contract?.total_value || financeiro?.total_contrato || 0);
    const valorProduzido = Number(financeiro?.valor_produzido || 0);
    const totalDespesas = Number(financeiro?.total_despesas || 0);
    const percFinanceiro = valorContrato > 0 ? (valorProduzido / valorContrato) * 100 : 0;
    const margem = valorProduzido - totalDespesas;
    const margemPerc = valorProduzido > 0 ? (margem / valorProduzido) * 100 : 0;

    const generateRealPDF = () => {
        const doc = new jsPDF();
        const totalPagesExp = '{total_pages_count_string}';
        const colors = {
            primary: [30, 41, 59],
            secondary: [234, 179, 8],
            text: [51, 65, 85],
            lightBg: [248, 250, 252],
        };

        try { doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25); } catch (e) { /* logo opcional */ }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(...colors.primary);
        doc.text("RELATÓRIO DE ACOMPANHAMENTO", 200, 20, { align: 'right' });

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("MAK SERVIÇOS E PAVIMENTAÇÕES LTDA", 200, 26, { align: 'right' });

        doc.setDrawColor(...colors.secondary);
        doc.setLineWidth(1);
        doc.line(14, 40, 200, 40);

        doc.setFillColor(...colors.lightBg);
        doc.rect(14, 45, 186, 25, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...colors.primary);
        doc.text(formatObraNome(obra).toUpperCase(), 18, 53);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...colors.text);
        doc.text(`Responsável: ${contract.responsavel_nome || 'N/D'}`, 18, 60);
        doc.text(`Fiscal: ${contract.fiscal_nome || 'N/D'}`, 18, 65);
        doc.text(`Emissão: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 195, 65, { align: 'right' });

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.primary);
        doc.text("RESUMO FINANCEIRO E FÍSICO", 14, 82);

        autoTable(doc, {
            startY: 85,
            head: [['Indicador Financeiro', 'Valor (R$)', 'Indicador Físico', 'Quantitativo']],
            body: [
                ['Valor Total Contrato', formatCurrency(valorContrato), 'Horas Contratadas', totalHoras.toFixed(0)],
                ['Total Despesas',       formatCurrency(totalDespesas), 'Horas Executadas',  producao.horas_executadas.toFixed(0)],
                ['A Faturar (Estimado)', formatCurrency(financeiro.pendente_faturamento), 'Saldo de Horas', producao.saldo_horas.toFixed(0)],
                ['Margem Operacional',   formatCurrency(margem),        'Progresso Físico',  `${percHoras.toFixed(1)}%`],
            ],
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: { 0: { fontStyle: 'bold', textColor: colors.text }, 2: { fontStyle: 'bold', textColor: colors.text } },
        });

        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.primary);
        doc.text("ALOCAÇÃO DE FROTA E EQUIPAMENTOS", 14, finalY);

        const rows = veiculos.map(v => [
            v.placa || v.re || '-',
            `${v.marca || ''} ${v.modelo || ''} (${v.tipo})`.substring(0, 35),
            v.operador_atual || 'A Definir',
            v.total_executado?.toFixed(1) || '0.0',
            v.media_diaria?.toFixed(1) || '0.0',
            v.proximo_destino || '-',
        ]);

        autoTable(doc, {
            startY: finalY + 4,
            head: [['Identificação', 'Equipamento', 'Operador', 'Total (h)', 'Média/Dia', 'Próx. Destino']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
            styles: { fontSize: 8, cellPadding: 3, textColor: colors.text },
            columnStyles: { 3: { halign: 'center' }, 4: { halign: 'center' } },
            alternateRowStyles: { fillColor: colors.lightBg },
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${totalPagesExp}`, 195, 285, { align: 'right' });
            doc.text("Gerado pelo Sistema Frotas MAK", 14, 285);
        }

        doc.save(`Relatorio_MAK_${sanitizeFilename(obra.nome)}.pdf`);
    };

    return (
        <div className="bg-slate-100 min-h-screen pb-20">
            {/* HEADER STICKY DENSO */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg font-bold text-slate-800 truncate">{formatObraNome(obra)}</h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1"><User size={11}/> {contract?.responsavel_nome || 'Sem responsável'}</span>
                            {contract?.fiscal_nome && <span className="flex items-center gap-1"><User size={11}/> Fiscal: {contract.fiscal_nome}</span>}
                            <span className="flex items-center gap-1"><DollarSign size={11}/> Contrato: <strong className="text-slate-700">{formatCurrency(valorContrato)}</strong></span>
                        </div>
                    </div>
                    <button
                        onClick={() => setCrmDrawerOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                    >
                        <Plus size={16} /> Novo Registro
                    </button>
                    <button
                        onClick={generateRealPDF}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                    >
                        <FileDown size={16} /> Relatório PDF
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* KPI STRIP */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiBlock
                        icon={Clock}
                        label="Horas executadas"
                        primary={`${producao.horas_executadas.toFixed(0)}h`}
                        secondary={`de ${totalHoras.toFixed(0)}h • ${percHoras.toFixed(1)}%`}
                        progress={percHoras}
                        progressColor={percHoras >= 90 ? 'bg-red-500' : percHoras >= 70 ? 'bg-yellow-400' : 'bg-emerald-500'}
                    />
                    <KpiBlock
                        icon={DollarSign}
                        label="Faturamento físico"
                        primary={formatCurrency(valorProduzido)}
                        secondary={`${percFinanceiro.toFixed(1)}% do contrato`}
                        progress={percFinanceiro}
                        progressColor="bg-blue-500"
                    />
                    <KpiBlock
                        icon={TrendingUp}
                        label="Margem operacional"
                        primary={formatCurrency(margem)}
                        secondary={`${margemPerc.toFixed(1)}% sobre o produzido`}
                        valueColor={margem >= 0 ? 'text-emerald-700' : 'text-red-600'}
                    />
                    <KpiBlock
                        icon={Calendar}
                        label="Previsão de término"
                        primary={previsao.diasRestantes > 0 ? previsao.date.toLocaleDateString('pt-BR') : '—'}
                        secondary={previsao.diasRestantes > 0 ? `Em ${previsao.diasRestantes} dias úteis` : 'Concluído'}
                    />
                    <KpiBlock
                        icon={Activity24}
                        label="Ritmo médio"
                        primary={contract.is_hidden ? '—' : `${(producao?.media_diaria_atual || 0).toFixed(1)}h/dia`}
                        secondary="Apurado nas últimas execuções"
                    />
                </div>

                {/* EVOLUÇÃO QUINZENAL — horas faturadas e % acumulada sobre o contrato */}
                <EvolucaoQuinzenal
                    quinzenas={producao?.quinzenas || []}
                    horasContratadas={contract.total_hours_contracted || 0}
                />

                {/* GRID PRINCIPAL */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* FINANCEIRO (2 col) */}
                    <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <DollarSign size={18} /> Resumo Financeiro
                            </h3>
                            <span className="text-xs text-slate-500">Contrato: <strong className="text-slate-700">{formatCurrency(valorContrato)}</strong></span>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FinanceCard tone="blue" label="Medido (físico)" value={formatCurrency(valorProduzido)} />
                            <FinanceCard tone="red" label="Despesas" value={formatCurrency(totalDespesas)} />
                            <FinanceCard tone="yellow" label="Pendente faturamento" value={formatCurrency(financeiro?.pendente_faturamento)} />
                        </div>
                        <div className="px-5 pb-5">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider">Despesas por categoria</h4>
                            <CategoryBars categorias={financeiro?.categorias || []} totalDespesas={totalDespesas} />
                        </div>
                    </div>

                    {/* EQUIPAMENTOS (1 col) */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Truck size={18} /> Equipamentos
                            </h3>
                            <span className="text-xs font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">{(veiculos || []).length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[480px] divide-y divide-slate-100">
                            {(veiculos || []).length === 0 && (
                                <div className="p-6 text-center text-slate-400 text-sm">Nenhum equipamento alocado.</div>
                            )}
                            {(veiculos || []).map(v => (
                                <VehicleRow
                                    key={v.id}
                                    vehicle={v}
                                    onEdit={() => setEditingVehicle(v)}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* HISTÓRICO */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <FileText size={18} /> Histórico de Registros
                            <span className="text-xs font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5 ml-1">{(crm_history || []).length}</span>
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter size={13} className="text-slate-400" />
                            {[
                                { id: 'todos', label: 'Todos' },
                                { id: 'daily_log', label: 'Diário' },
                                { id: 'routine', label: 'Rotina' },
                                { id: 'billing_milestone', label: 'Cobrança' },
                                { id: 'issue', label: 'Problemas' },
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setHistoryFilter(opt.id)}
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                                        historyFilter === opt.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-5">
                        {historyByDay.length === 0 && (
                            <p className="text-slate-400 text-sm text-center py-8">Nenhum registro neste filtro.</p>
                        )}
                        <div className="space-y-6">
                            {historyByDay.map(group => (
                                <div key={group.key}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Calendar size={13} className="text-slate-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{group.label}</span>
                                        <div className="flex-1 border-t border-slate-100"></div>
                                    </div>
                                    <div className="space-y-3">
                                        {group.items.map(log => {
                                            const cfg = INTERACTION_TYPES[log.interaction_type] || INTERACTION_TYPES.routine;
                                            return (
                                                <div key={log.id} className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                                                    <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${cfg.chip} flex items-center gap-1.5`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                                                            {cfg.label}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400">
                                                            {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            <span className="mx-1.5 text-slate-300">•</span>
                                                            {log.supervisor_name || 'Sistema'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{log.notes}</p>
                                                    {log.agreed_action && (
                                                        <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100">
                                                            <CheckCircle2 size={11} /> Ação acordada: {log.agreed_action}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* DRAWER: Novo Registro */}
            {crmDrawerOpen && (
                <CrmDrawer
                    obraId={obraId}
                    onClose={() => setCrmDrawerOpen(false)}
                    onSaved={() => { setCrmDrawerOpen(false); fetchDetails(); }}
                />
            )}

            {/* MODAL: Editar Destino */}
            {editingVehicle && (
                <MissionModal
                    vehicle={editingVehicle}
                    defaultDate={previsao.date.toISOString().split('T')[0]}
                    onClose={() => setEditingVehicle(null)}
                    onSave={handleUpdateMission}
                />
            )}
        </div>
    );
};

// ============================================================================
// SUB-COMPONENTES
// ============================================================================
const Activity24 = (props) => <TrendingUp {...props} />;

// Mostra as últimas 6 quinzenas de horas faturadas (daily_work_logs) e % acumulada
// sobre o contrato. Espelha a régua de quinzenas usada na Projeção de Obras —
// mesmas janelas de 15 dias ancoradas no início do contrato.
const EvolucaoQuinzenal = ({ quinzenas, horasContratadas }) => {
    const fmtData = (iso) => {
        if (!iso) return '—';
        const [, m, d] = iso.split('-');
        return `${d}/${m}`;
    };
    const fmtDataLonga = (iso) => {
        if (!iso) return '—';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    const maxHoras = useMemo(
        () => Math.max(1, ...quinzenas.map(q => q.horasLancadas || 0)),
        [quinzenas]
    );

    // Default selecionada: última quinzena (mais recente, normalmente "em curso")
    const [selectedNumero, setSelectedNumero] = useState(null);
    const effectiveSelected = useMemo(() => {
        if (!quinzenas.length) return null;
        const found = quinzenas.find(q => q.numero === selectedNumero);
        return found || quinzenas[quinzenas.length - 1];
    }, [quinzenas, selectedNumero]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <TrendingUp size={18} /> Evolução por quinzena
                    <span className="text-xs font-normal text-slate-500 ml-1">
                        últimas {quinzenas.length || 0} • horas faturadas
                    </span>
                </h3>
                {horasContratadas > 0 && (
                    <span className="text-xs text-slate-500">
                        Contrato: <strong className="text-slate-700">{Math.round(horasContratadas)}h</strong>
                    </span>
                )}
            </div>

            {quinzenas.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                    Sem lançamentos suficientes para montar a série quinzenal.
                </div>
            ) : (
                <div className="p-5">
                    {/* Painel de detalhes (master-detail) */}
                    {effectiveSelected && (
                        <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-bold text-slate-800">
                                        {effectiveSelected.numero}ª quinzena
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {fmtDataLonga(effectiveSelected.dataInicio)} a {fmtDataLonga(effectiveSelected.dataFim)}
                                    </span>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                    effectiveSelected.encerrada
                                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                                }`}>
                                    {effectiveSelected.encerrada ? 'Encerrada' : 'Em curso'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <DetailStat
                                    label="Horas faturadas"
                                    value={`${effectiveSelected.horasLancadas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`}
                                />
                                <DetailStat
                                    label="Máquinas faturando"
                                    value={`${effectiveSelected.maquinasFaturando ?? 0} / ${effectiveSelected.maquinasAlocadas ?? 0}`}
                                    sub="das alocadas"
                                />
                                <DetailStat
                                    label="Avanço no período"
                                    value={effectiveSelected.deltaPercent != null ? `+${effectiveSelected.deltaPercent.toFixed(1)}%` : '—'}
                                    sub="do contrato"
                                />
                                <DetailStat
                                    label="Acumulado"
                                    value={effectiveSelected.percentualAcumulado != null ? `${effectiveSelected.percentualAcumulado.toFixed(1)}%` : '—'}
                                    sub="do contrato"
                                />
                            </div>
                        </div>
                    )}

                    {/* Lista de quinzenas — cada item é clicável */}
                    <div className="space-y-2">
                        {quinzenas.map(q => {
                            const barW = (q.horasLancadas / maxHoras) * 100;
                            const corBarra = q.horasLancadas === 0
                                ? 'bg-slate-200'
                                : q.encerrada ? 'bg-blue-500' : 'bg-blue-300';
                            const isSelected = effectiveSelected?.numero === q.numero;
                            return (
                                <button
                                    key={q.numero}
                                    type="button"
                                    onClick={() => setSelectedNumero(q.numero)}
                                    className={`w-full text-left rounded-lg px-3 py-2 transition-colors border-l-4 ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-50/60'
                                            : 'border-transparent hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 mb-1 text-xs">
                                        <span className={`inline-flex items-center justify-center rounded-md font-bold px-2 py-0.5 min-w-[36px] ${
                                            isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {q.numero}ª
                                        </span>
                                        <span className="text-slate-500 tabular-nums whitespace-nowrap">
                                            {fmtData(q.dataInicio)} – {fmtData(q.dataFim)}
                                        </span>
                                        {!q.encerrada && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Em curso" />
                                        )}
                                        <span className="ml-auto text-slate-700 font-bold tabular-nums">
                                            {q.horasLancadas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h
                                        </span>
                                        <span className="text-slate-800 font-bold tabular-nums w-16 text-right">
                                            {q.percentualAcumulado != null ? `${q.percentualAcumulado.toFixed(1)}%` : '—'}
                                        </span>
                                    </div>
                                    <div className="ml-[44px] flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                                            <div className={`h-2 rounded ${corBarra} transition-all`} style={{ width: `${Math.min(barW, 100)}%` }} />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="pt-3 mt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                        Clique numa quinzena para ver máquinas faturando, avanço no período e status.
                    </div>
                </div>
            )}
        </div>
    );
};

const DetailStat = ({ label, value, sub }) => (
    <div>
        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800 mt-0.5 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
);

const KpiBlock = ({ icon: Icon, label, primary, secondary, progress, progressColor, valueColor }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
            <Icon size={13} /> {label}
        </div>
        <p className={`text-xl font-bold mt-2 ${valueColor || 'text-slate-800'}`}>{primary}</p>
        {secondary && <p className="text-[11px] text-slate-500 mt-1">{secondary}</p>}
        {typeof progress === 'number' && (
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className={`h-1.5 rounded-full ${progressColor || 'bg-blue-500'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
            </div>
        )}
    </div>
);

const FinanceCard = ({ tone, label, value }) => {
    const tones = {
        blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   text: 'text-blue-700',  value: 'text-blue-900' },
        red:    { bg: 'bg-red-50',    border: 'border-red-100',    text: 'text-red-700',   value: 'text-red-900' },
        yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', value: 'text-yellow-900' },
    }[tone] || {};
    return (
        <div className={`p-4 rounded-lg border ${tones.bg} ${tones.border}`}>
            <p className={`text-[11px] uppercase font-bold tracking-wider ${tones.text}`}>{label}</p>
            <p className={`text-xl font-bold mt-1 ${tones.value}`}>{value}</p>
        </div>
    );
};

const CategoryBars = ({ categorias, totalDespesas }) => {
    if (!categorias || categorias.length === 0) {
        return <p className="text-xs text-slate-400 italic">Sem despesas registradas no período.</p>;
    }
    const sorted = [...categorias].sort((a, b) => (b.total || 0) - (a.total || 0));
    const max = sorted[0]?.total || 1;
    return (
        <div className="space-y-2">
            {sorted.map((cat, i) => {
                const total = Number(cat.total || 0);
                const widthPerc = (total / max) * 100;
                const sharePerc = totalDespesas > 0 ? (total / totalDespesas) * 100 : 0;
                return (
                    <div key={i}>
                        <div className="flex justify-between items-baseline text-xs mb-1">
                            <span className="text-slate-700 font-medium truncate pr-2">{cat.category || 'Outros'}</span>
                            <span className="text-slate-500 tabular-nums">
                                <strong className="text-slate-800">{formatCurrency(total)}</strong>
                                <span className="text-slate-400 ml-1.5">({sharePerc.toFixed(1)}%)</span>
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded h-2 overflow-hidden">
                            <div className="h-2 rounded bg-gradient-to-r from-red-400 to-red-500" style={{ width: `${widthPerc}%` }}></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const VehicleRow = ({ vehicle, onEdit }) => {
    const dataLib = vehicle.data_liberacao_manual
        ? new Date(vehicle.data_liberacao_manual).toLocaleDateString('pt-BR')
        : null;
    return (
        <div className="p-4 hover:bg-slate-50 transition-colors">
            <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-800 truncate">{vehicle.modelo || 'Equipamento'}</div>
                    <div className="text-[11px] text-slate-400">{vehicle.placa || vehicle.re || '—'}{vehicle.tipo ? ` • ${vehicle.tipo}` : ''}</div>
                </div>
                <button
                    onClick={onEdit}
                    className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                >
                    <Edit2 size={12} /> Editar
                </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                <div>
                    <span className="text-slate-400 block">Total exec.</span>
                    <strong className="text-slate-700">{(vehicle.total_executado || 0).toFixed(1)}h</strong>
                </div>
                <div>
                    <span className="text-slate-400 block">Próx. destino</span>
                    <strong className="text-slate-700 truncate block">{vehicle.proximo_destino || '—'}</strong>
                </div>
                <div>
                    <span className="text-slate-400 block">Liberação</span>
                    <strong className="text-slate-700">{dataLib || '—'}</strong>
                </div>
            </div>
        </div>
    );
};

const MissionModal = ({ vehicle, defaultDate, onClose, onSave }) => {
    const [location, setLocation] = useState(vehicle.proximo_destino || '');
    const [date, setDate] = useState(
        vehicle.data_liberacao_manual ? vehicle.data_liberacao_manual.split('T')[0] : defaultDate
    );
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave(vehicle.id, location, date);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Editar destino</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <p className="text-xs text-slate-500">Equipamento</p>
                        <p className="font-bold text-slate-800">{vehicle.modelo} <span className="text-slate-400 font-normal">({vehicle.placa || vehicle.re || '—'})</span></p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Data de liberação prevista</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full mt-1 border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Próximo destino</label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Ex: Obra Centro Logístico — Itajaí"
                            className="w-full mt-1 border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CrmDrawer = ({ obraId, onClose, onSaved }) => {
    const [interactionType, setInteractionType] = useState('daily_log');
    const [notes, setNotes] = useState('');
    const [agreedAction, setAgreedAction] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await apiClient.post('/supervisor/crm', {
                obra_id: obraId,
                interaction_type: interactionType,
                notes,
                agreed_action: agreedAction,
            });
            onSaved();
        } catch (err) {
            alert('Erro ao salvar registro.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-slate-900/50" onClick={onClose}></div>
            <div className="w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare size={18} /> Novo registro
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white rounded"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {Object.entries(INTERACTION_TYPES).map(([id, cfg]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setInteractionType(id)}
                                    className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                                        interactionType === id
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                        <textarea
                            className="w-full mt-1 border border-slate-300 rounded-lg p-2 text-sm focus:border-blue-500 outline-none"
                            rows="6"
                            placeholder="Descreva o acontecimento..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Ação acordada (opcional)</label>
                        <input
                            type="text"
                            className="w-full mt-1 border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                            placeholder="Ex: Enviar medição até quinta..."
                            value={agreedAction}
                            onChange={(e) => setAgreedAction(e.target.value)}
                        />
                    </div>
                </form>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end">
                    <button type="button" onClick={onClose} className="px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || !notes}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                    >
                        {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Salvar registro
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SupervisorObraDetail;
