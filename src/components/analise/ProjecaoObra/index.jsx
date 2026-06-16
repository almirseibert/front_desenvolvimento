import React, { useState, useCallback } from 'react';
import {
    TrendingUp, Fuel, AlertTriangle, CheckCircle, Clock,
    HardHat, ChevronRight, RefreshCw, Info,
} from 'lucide-react';
import SearchableObraSelect from '../../SearchableObraSelect';
import apiClient from '../../../services/apiClient';

// ─── Paleta ─────────────────────────────────────────────────────────────────
const C = {
    gold:     '#9E7A42',
    goldLt:   '#f5efe4',
    bg:       '#f5f3ef',
    border:   '#e5e0d8',
    text:     '#1e1a14',
    textMid:  '#5a4e3a',
    textSub:  '#9a8c7a',
    green:    '#16a34a',
    greenBg:  '#f0fdf4',
    greenBd:  '#bbf7d0',
    red:      '#dc2626',
    redBg:    '#fef2f2',
    redBd:    '#fecaca',
    yellow:   '#ca8a04',
    yellowBg: '#fefce8',
    yellowBd: '#fef08a',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
    v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const fmtPct = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);

// 'YYYY-MM-DD' → 'DD/MM/YYYY'  |  'YYYY-MM-DD' → 'DD/MM' quando shortMonth=true
const fmtData = (iso, shortMonth = false) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return shortMonth ? `${d}/${m}` : `${d}/${m}/${y}`;
};

const colorForPercent = (pct, limiar = 20) => {
    if (pct == null) return { text: C.textSub, bg: C.bg, bd: C.border };
    if (pct > limiar)      return { text: C.red,    bg: C.redBg,    bd: C.redBd };
    if (pct > limiar * 0.8) return { text: C.yellow, bg: C.yellowBg, bd: C.yellowBd };
    return                        { text: C.green,  bg: C.greenBg,  bd: C.greenBd };
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }) {
    return (
        <div className="rounded-xl p-4 flex flex-col gap-1"
            style={{ background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
            <div className="flex items-center gap-2" style={{ color: C.textSub, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {React.cloneElement(icon, { size: 12 })}
                {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text, lineHeight: 1.2 }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: C.textSub }}>{sub}</div>}
        </div>
    );
}

function GaugeCombustivel({ percentualAtual, projecaoFinal }) {
    const LIMIAR = 20;
    const MAX    = Math.max(40, (projecaoFinal || 0) * 1.2, (percentualAtual || 0) * 1.2);
    const barAtual  = Math.min(((percentualAtual || 0) / MAX) * 100, 100);
    const barProj   = Math.min(((projecaoFinal  || 0) / MAX) * 100, 100);
    const limiarPos = Math.min((LIMIAR / MAX) * 100, 100);

    const colAtual = colorForPercent(percentualAtual, LIMIAR);
    const colProj  = colorForPercent(projecaoFinal,   LIMIAR);

    return (
        <div className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
            <div className="flex items-center gap-2 mb-4" style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>
                <Fuel size={14} style={{ color: C.gold }} />
                Combustível vs Faturamento
            </div>

            {/* Barra atual */}
            <div className="mb-3">
                <div className="flex justify-between mb-1" style={{ fontSize: 11, color: C.textSub }}>
                    <span>Realizado até agora</span>
                    <span style={{ fontWeight: 700, color: colAtual.text }}>{fmtPct(percentualAtual)}</span>
                </div>
                <div className="relative w-full h-3 rounded-full" style={{ background: C.bg }}>
                    <div className="h-3 rounded-full transition-all"
                        style={{ width: `${barAtual}%`, background: colAtual.text }} />
                    {/* Linha do limiar */}
                    <div className="absolute top-0 h-3 w-px"
                        style={{ left: `${limiarPos}%`, background: '#1e1a14', opacity: 0.3 }} />
                </div>
            </div>

            {/* Barra projetada */}
            <div className="mb-4">
                <div className="flex justify-between mb-1" style={{ fontSize: 11, color: C.textSub }}>
                    <span>Projeção ao final da obra</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: colProj.text }}>{fmtPct(projecaoFinal)}</span>
                </div>
                <div className="relative w-full h-4 rounded-full" style={{ background: C.bg }}>
                    <div className="h-4 rounded-full transition-all"
                        style={{ width: `${barProj}%`, background: colProj.text, opacity: 0.85 }} />
                    <div className="absolute top-0 h-4 w-px"
                        style={{ left: `${limiarPos}%`, background: '#1e1a14', opacity: 0.35 }} />
                </div>
            </div>

            {/* Legenda do limiar */}
            <div className="flex items-center gap-1.5 pt-2" style={{ fontSize: 10, color: C.textSub, borderTop: `1px solid ${C.border}` }}>
                <div className="w-px h-3" style={{ background: '#1e1a14', opacity: 0.35 }} />
                <span>Limite interno: 20% do faturamento</span>
                {projecaoFinal > LIMIAR
                    ? <span className="ml-auto font-bold" style={{ color: C.red }}>⚠ Projeção acima do limite</span>
                    : <span className="ml-auto font-bold" style={{ color: C.green }}>✓ Projeção dentro do limite</span>
                }
            </div>
        </div>
    );
}

function QuinzenaTimeline({ quinzenas, horasContratadas }) {
    const META_DELTA = 30; // % mínimo por quinzena

    return (
        <div className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
            <div className="flex items-center gap-2 mb-4" style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>
                <TrendingUp size={14} style={{ color: C.gold }} />
                Evolução por Quinzena
                <span className="ml-auto" style={{ fontSize: 10, color: C.textSub, fontWeight: 400 }}>
                    Meta: ≥{META_DELTA}% por quinzena
                </span>
            </div>

            {quinzenas.length === 0 && (
                <p style={{ fontSize: 12, color: C.textSub, fontStyle: 'italic' }}>
                    Sem lançamentos registrados.
                </p>
            )}

            <div className="space-y-3">
                {quinzenas.map((q) => {
                    const col = q.atingiuMeta
                        ? { text: C.green,  bg: C.greenBg,  bd: C.greenBd }
                        : q.horasLancadas === 0
                            ? { text: C.textSub, bg: C.bg, bd: C.border }
                            : { text: C.red, bg: C.redBg, bd: C.redBd };

                    const barW = Math.min(q.deltaPercent / META_DELTA * 100, 200); // >100% = acima da meta

                    return (
                        <div key={q.numero}>
                            <div className="flex items-center gap-2 mb-1">
                                {/* Badge quinzena */}
                                <div className="shrink-0 rounded-md px-2 py-0.5 text-center"
                                    style={{ fontSize: 10, fontWeight: 700, minWidth: 28,
                                        background: col.bg, color: col.text, border: `1px solid ${col.bd}` }}>
                                    {q.numero}ª
                                </div>

                                {/* Datas */}
                                <span style={{ fontSize: 10, color: C.textSub, whiteSpace: 'nowrap' }}>
                                    {fmtData(q.dataInicio, true)} – {fmtData(q.dataFim, true)}
                                </span>

                                {/* Ícone de status */}
                                {q.encerrada && (
                                    q.atingiuMeta
                                        ? <CheckCircle size={12} style={{ color: C.green }} />
                                        : q.horasLancadas > 0
                                            ? <AlertTriangle size={12} style={{ color: C.red }} />
                                            : null
                                )}

                                {/* Delta % */}
                                <span className="ml-auto" style={{ fontSize: 11, fontWeight: 700, color: col.text }}>
                                    {q.deltaPercent > 0 ? `+${fmtPct(q.deltaPercent)}` : '—'}
                                </span>

                                {/* Acumulado */}
                                <span style={{ fontSize: 10, color: C.textSub, width: 40, textAlign: 'right' }}>
                                    {fmtPct(q.percentualAcumulado)}
                                </span>
                            </div>

                            {/* Barra de progresso da quinzena */}
                            <div className="flex items-center gap-2 pl-9">
                                <div className="flex-1 h-1.5 rounded-full" style={{ background: C.bg }}>
                                    <div className="h-1.5 rounded-full transition-all"
                                        style={{
                                            width: `${Math.min(barW, 100)}%`,
                                            background: barW > 100 ? C.green : col.text,
                                        }} />
                                </div>
                                <span style={{ fontSize: 10, color: C.textSub, width: 36, textAlign: 'right' }}>
                                    {q.horasLancadas > 0 ? `${q.horasLancadas}h` : '0h'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legenda */}
            <div className="flex gap-4 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.textSub }}>
                <span className="flex items-center gap-1"><CheckCircle size={10} style={{ color: C.green }} /> Atingiu meta</span>
                <span className="flex items-center gap-1"><AlertTriangle size={10} style={{ color: C.red }} /> Abaixo da meta</span>
                <span style={{ marginLeft: 'auto' }}>Acumulado = % do total contratado</span>
            </div>
        </div>
    );
}

function ProjecaoPrazo({ faturamento }) {
    const { percentualConcluido, diasParaFinalizar, ritmoHorasPorDia, diasComLancamento, totalHorasFaturadas } = faturamento;

    // Análise: meta de 45 dias
    const META_DIAS = 45;
    const diasDecorridos = diasComLancamento; // proxy — dias com lançamento
    const diasRestantes  = diasParaFinalizar;
    const totalEstimado  = diasRestantes != null ? diasDecorridos + diasRestantes : null;
    const dentroDoAlvo   = totalEstimado != null && totalEstimado <= META_DIAS;
    const col = totalEstimado == null
        ? { text: C.textSub, bg: C.bg, bd: C.border }
        : dentroDoAlvo
            ? { text: C.green, bg: C.greenBg, bd: C.greenBd }
            : { text: C.red,   bg: C.redBg,   bd: C.redBd };

    return (
        <div className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
            <div className="flex items-center gap-2 mb-4" style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>
                <Clock size={14} style={{ color: C.gold }} />
                Projeção de Prazo
            </div>

            {/* Barra de progresso geral */}
            <div className="mb-4">
                <div className="flex justify-between mb-1" style={{ fontSize: 11, color: C.textSub }}>
                    <span>Progresso físico (horas faturadas)</span>
                    <span style={{ fontWeight: 800, color: C.text }}>{fmtPct(percentualConcluido)}</span>
                </div>
                <div className="w-full h-3 rounded-full" style={{ background: C.bg }}>
                    <div className="h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(percentualConcluido, 100)}%`, background: C.gold }} />
                </div>
                <div className="flex justify-between mt-1" style={{ fontSize: 10, color: C.textSub }}>
                    <span>{totalHorasFaturadas}h lançadas</span>
                    <span>{faturamento.horasContratadas ? `${faturamento.horasContratadas}h contratadas` : ''}</span>
                </div>
            </div>

            {/* Cards de prazo */}
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg p-2.5 text-center" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{ritmoHorasPorDia > 0 ? `${ritmoHorasPorDia}h` : '—'}</div>
                    <div style={{ fontSize: 10, color: C.textSub }}>por dia lançado</div>
                </div>
                <div className="rounded-lg p-2.5 text-center" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{diasParaFinalizar != null ? `${diasParaFinalizar}d` : '—'}</div>
                    <div style={{ fontSize: 10, color: C.textSub }}>dias restantes*</div>
                </div>
                <div className="rounded-lg p-2.5 text-center" style={{ background: col.bg, border: `1px solid ${col.bd}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: col.text }}>{totalEstimado != null ? `${totalEstimado}d` : '—'}</div>
                    <div style={{ fontSize: 10, color: col.text }}>total estimado</div>
                </div>
            </div>

            {/* Veredito */}
            {totalEstimado != null && (
                <div className="mt-3 rounded-lg px-3 py-2 flex items-center gap-2"
                    style={{ background: col.bg, border: `1px solid ${col.bd}`, fontSize: 11 }}>
                    {dentroDoAlvo
                        ? <CheckCircle size={13} style={{ color: col.text }} />
                        : <AlertTriangle size={13} style={{ color: col.text }} />
                    }
                    <span style={{ color: col.text, fontWeight: 600 }}>
                        {dentroDoAlvo
                            ? `No ritmo atual, a obra termina em ${totalEstimado} dias — dentro da meta de ${META_DIAS} dias.`
                            : `No ritmo atual, a obra levará ${totalEstimado} dias — ${totalEstimado - META_DIAS} dias além da meta de ${META_DIAS}.`
                        }
                    </span>
                </div>
            )}
            <p style={{ fontSize: 9, color: C.textSub, marginTop: 6, fontStyle: 'italic' }}>
                * Dias restantes estimados com base no ritmo médio de dias com lançamento.
            </p>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const ProjecaoObra = ({ obras = [] }) => {
    const [selectedObra, setSelectedObra] = useState(null);
    const [dados, setDados]               = useState(null);
    const [loading, setLoading]           = useState(false);
    const [erro, setErro]                 = useState(null);

    const activeObras = obras.filter(o =>
        o.status === 'ativa' && (o.tipo_registro || 'obra') !== 'centro_custo'
    );

    const carregar = useCallback(async (obra) => {
        if (!obra) { setDados(null); return; }
        setLoading(true);
        setErro(null);
        try {
            const data = await apiClient.getProjecaoObra(obra.id);
            setDados(data);
        } catch (e) {
            setErro(e.message || 'Erro ao carregar projeção.');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleObraChange = (obra) => {
        setSelectedObra(obra || null);
        carregar(obra || null);
    };

    const handleRefresh = () => selectedObra && carregar(selectedObra);

    // ── Render: estado vazio ──────────────────────────────────────────────────
    if (!selectedObra || (!loading && !dados && !erro)) {
        return (
            <div className="flex flex-col h-full" style={{ background: C.bg }}>
                <Header
                    obras={activeObras}
                    selectedObra={selectedObra}
                    onObraChange={handleObraChange}
                    onRefresh={handleRefresh}
                    loading={loading}
                />
                <div className="flex-1 flex flex-col items-center justify-center" style={{ color: C.textSub }}>
                    <HardHat size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ fontSize: 14 }}>Selecione uma obra ativa para visualizar a projeção.</p>
                </div>
            </div>
        );
    }

    // ── Render: carregando ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col h-full" style={{ background: C.bg }}>
                <Header obras={activeObras} selectedObra={selectedObra} onObraChange={handleObraChange} onRefresh={handleRefresh} loading />
                <div className="flex-1 flex items-center justify-center" style={{ color: C.textSub, fontSize: 13 }}>
                    <RefreshCw size={16} className="animate-spin mr-2" /> Calculando projeção…
                </div>
            </div>
        );
    }

    // ── Render: erro ──────────────────────────────────────────────────────────
    if (erro) {
        return (
            <div className="flex flex-col h-full" style={{ background: C.bg }}>
                <Header obras={activeObras} selectedObra={selectedObra} onObraChange={handleObraChange} onRefresh={handleRefresh} loading={false} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="rounded-xl p-6 text-center" style={{ background: C.redBg, border: `1px solid ${C.redBd}`, maxWidth: 400 }}>
                        <AlertTriangle size={24} style={{ color: C.red, margin: '0 auto 8px' }} />
                        <p style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>{erro}</p>
                        <button onClick={handleRefresh} className="mt-3 px-4 py-1.5 rounded-lg text-white text-sm"
                            style={{ background: C.red }}>Tentar novamente</button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render principal ──────────────────────────────────────────────────────
    const { faturamento, combustivel } = dados;
    const semFaturamento = faturamento.totalRS === 0;
    const semHoras       = faturamento.totalHorasFaturadas === 0;

    return (
        <div className="flex flex-col h-full" style={{ background: C.bg }}>
            <Header
                obras={activeObras}
                selectedObra={selectedObra}
                onObraChange={handleObraChange}
                onRefresh={handleRefresh}
                loading={false}
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Aviso sem dados */}
                {semHoras && (
                    <div className="rounded-xl px-4 py-3 flex items-center gap-2"
                        style={{ background: C.yellowBg, border: `1px solid ${C.yellowBd}`, fontSize: 12, color: C.yellow }}>
                        <Info size={14} />
                        Esta obra ainda não possui horas lançadas. As projeções serão exibidas após o primeiro lançamento.
                    </div>
                )}

                {/* Aviso sem valoresPorTipo */}
                {!semHoras && !dados.obra.temValoresPorTipo && (
                    <div className="rounded-xl px-4 py-3 flex items-center gap-2"
                        style={{ background: C.yellowBg, border: `1px solid ${C.yellowBd}`, fontSize: 12, color: C.yellow }}>
                        <Info size={14} />
                        Os valores por tipo de equipamento não estão configurados nesta obra.
                        O faturamento em R$ e a % de combustível não podem ser calculados.
                        Configure os preços no cadastro da obra para habilitar estas métricas.
                    </div>
                )}

                {/* KPIs rápidos */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KpiCard
                        icon={<TrendingUp />}
                        label="Progresso físico"
                        value={fmtPct(faturamento.percentualConcluido)}
                        sub={`${faturamento.totalHorasFaturadas}h de ${faturamento.horasContratadas || '?'}h`}
                        color={C.gold}
                    />
                    <KpiCard
                        icon={<Clock />}
                        label="Dias restantes*"
                        value={faturamento.diasParaFinalizar != null ? `${faturamento.diasParaFinalizar}d` : '—'}
                        sub={`Ritmo: ${faturamento.ritmoHorasPorDia}h/dia`}
                    />
                    <KpiCard
                        icon={<Fuel />}
                        label="Combustível atual"
                        value={fmtPct(combustivel.percentualAtual)}
                        sub={dados.obra.temValoresPorTipo ? `de ${fmtBRL(faturamento.totalRS)} faturados` : 'Valores não configurados'}
                        color={colorForPercent(combustivel.percentualAtual).text}
                    />
                    <KpiCard
                        icon={<ChevronRight />}
                        label="Projeção combustível"
                        value={combustivel.semDados ? '—' : fmtPct(combustivel.projecaoFinalPercent)}
                        sub={combustivel.semDados ? 'Sem abastecimentos registrados' : (combustivel.alertaCritico ? '⚠ Acima do limite de 20%' : '✓ Dentro do limite')}
                        color={colorForPercent(combustivel.projecaoFinalPercent).text}
                    />
                </div>

                {/* Layout de dois painéis */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Coluna esquerda: prazo + quinzenas */}
                    <div className="space-y-4">
                        <ProjecaoPrazo faturamento={{ ...faturamento, horasContratadas: dados.obra.horasContratadas }} />
                        <QuinzenaTimeline
                            quinzenas={faturamento.quinzenas}
                            horasContratadas={dados.obra.horasContratadas}
                        />
                    </div>

                    {/* Coluna direita: combustível */}
                    <div className="space-y-4">
                        {combustivel.semDados ? (
                            <div className="rounded-xl p-6 flex flex-col items-center justify-center text-center"
                                style={{ background: '#fff', border: `1px solid ${C.border}`, minHeight: 160 }}>
                                <Fuel size={28} style={{ color: C.textSub, opacity: 0.3, marginBottom: 8 }} />
                                <p style={{ fontSize: 13, color: C.textSub }}>Nenhum abastecimento vinculado a esta obra.</p>
                                <p style={{ fontSize: 11, color: C.textSub, marginTop: 4, fontStyle: 'italic' }}>
                                    Vincule os abastecimentos à obra ao registrar as ordens de combustível.
                                </p>
                            </div>
                        ) : (
                            <>
                                <GaugeCombustivel
                                    percentualAtual={combustivel.percentualAtual}
                                    projecaoFinal={combustivel.projecaoFinalPercent}
                                />

                                {/* Detalhe combustível */}
                                <div className="rounded-xl p-4 space-y-2"
                                    style={{ background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        Detalhes do Combustível
                                    </p>
                                    <Row label="Total de litros consumidos" value={`${combustivel.totalLitros.toLocaleString('pt-BR')} L`} />
                                    <Row label="Custo total combustível" value={fmtBRL(combustivel.totalCustoRS)} />
                                    <Row label="Faturamento realizado" value={dados.obra.temValoresPorTipo ? fmtBRL(faturamento.totalRS) : '—'} />
                                    <Row label="% atual sobre faturamento" value={fmtPct(combustivel.percentualAtual)} emphasis />
                                    <Row label="Projeção ao 100% da obra" value={fmtPct(combustivel.projecaoFinalPercent)} emphasis
                                        alert={combustivel.alertaCritico} />

                                    <div className="pt-2 mt-1" style={{ borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.textSub, fontStyle: 'italic' }}>
                                        Projeção linear: mantendo o ritmo atual de custo por hora faturada até o final da obra.
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

function Row({ label, value, emphasis, alert }) {
    return (
        <div className="flex justify-between items-center py-1" style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 12, color: C.textMid }}>{label}</span>
            <span style={{
                fontSize: emphasis ? 13 : 12,
                fontWeight: emphasis ? 700 : 400,
                color: alert ? C.red : emphasis ? C.text : C.textSub,
            }}>{value}</span>
        </div>
    );
}

function Header({ obras, selectedObra, onObraChange, onRefresh, loading }) {
    return (
        <div className="shrink-0 px-4 py-3 flex items-center gap-3"
            style={{ background: '#fff', borderBottom: `1px solid ${C.border}` }}>
            <HardHat size={16} style={{ color: C.gold }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Projeção de Obra</span>
            <div className="flex-1 max-w-xs ml-2">
                <SearchableObraSelect
                    obras={obras}
                    value={selectedObra?.id || ''}
                    onChange={onObraChange}
                    placeholder="Selecione uma obra ativa…"
                />
            </div>
            {selectedObra && (
                <button onClick={onRefresh} disabled={loading}
                    className="ml-auto p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                    title="Atualizar">
                    <RefreshCw size={14} style={{ color: C.textSub }} className={loading ? 'animate-spin' : ''} />
                </button>
            )}
        </div>
    );
}

export default ProjecaoObra;
