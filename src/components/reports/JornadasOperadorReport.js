import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Clock, Printer, Loader } from 'lucide-react';
import SearchableSelect from '../SearchableSelect';
import apiClient from '../../services/apiClient';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtMin = (min) => {
    if (!min) return '0h';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (!h) return `${m}min`;
    if (!m) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
};

const fmtDateBr = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
};

const fmtIntervalos = (ivs) => {
    if (!Array.isArray(ivs) || !ivs.length) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return ivs.map(iv => {
        const ini = new Date(iv.inicio);
        const fim = new Date(iv.fim);
        return `${pad(ini.getHours())}:${pad(ini.getMinutes())}–${pad(fim.getHours())}:${pad(fim.getMinutes())}`;
    }).join(', ');
};

const TIPO_LABEL = {
    maquina_alem_do_faturado: 'Rodou além do faturado',
    faturado_alem_da_maquina: 'Faturado sem rastreador',
    sem_lancamento_com_atividade: 'Atividade sem lançamento',
    gap_ponto_maquina_inicio: 'Operador presente, máquina desligada',
    gap_ponto_maquina_fim: 'Máquina parou antes do operador sair',
};

// Cores RGB para o PDF (jsPDF não entende Tailwind).
const COR = {
    faturado:   [37, 99, 235],   // blue-600
    rastreador: [16, 185, 129],  // emerald-500
    ponto:      [168, 85, 247],  // purple-500
    texto:      [30, 26, 20],
    cinzaClaro: [240, 240, 240],
    cinzaMed:   [180, 180, 180],
    discrep:    [220, 38, 38],   // red-600
};

// Desenha 3 barras horizontais agregadas (faturado/rastreador/ponto).
const drawBarrasAgregadas = (doc, x, y, w, totais) => {
    const maxMin = Math.max(totais.faturado || 0, totais.rastreador || 0, totais.ponto || 0, 1);
    const linhas = [
        { label: 'Faturado',   v: totais.faturado,   cor: COR.faturado },
        { label: 'Rastreador', v: totais.rastreador, cor: COR.rastreador },
        { label: 'Ponto',      v: totais.ponto,      cor: COR.ponto },
    ];
    const labelW = 28;
    const valueW = 22;
    const barAreaW = w - labelW - valueW;
    const barH = 7;
    const gap = 4;

    doc.setFontSize(9);
    linhas.forEach((ln, i) => {
        const yy = y + i * (barH + gap);
        doc.setTextColor(...COR.texto);
        doc.text(ln.label, x, yy + barH - 1.5);

        doc.setFillColor(...COR.cinzaClaro);
        doc.rect(x + labelW, yy, barAreaW, barH, 'F');

        const ratio = (ln.v || 0) / maxMin;
        if (ratio > 0) {
            doc.setFillColor(...ln.cor);
            doc.rect(x + labelW, yy, barAreaW * ratio, barH, 'F');
        }

        doc.setTextColor(...COR.texto);
        doc.text(fmtMin(ln.v), x + labelW + barAreaW + 2, yy + barH - 1.5);
    });
    return y + linhas.length * (barH + gap);
};

// Mini-Gantt 24h, 3 trilhas (uma máquina). Devolve y após desenhar.
const drawGantt = (doc, x, y, w, ivsFat, ivsRas, ivsPon, dataStr) => {
    const dayStart = new Date(`${dataStr}T00:00:00`).getTime();
    const dayEnd   = dayStart + 24 * 60 * 60 * 1000;
    const labelW = 22;
    const trilhaW = w - labelW;
    const trilhaH = 4;
    const gap = 1.5;

    const trilhas = [
        { label: 'Faturado',   ivs: ivsFat || [], cor: COR.faturado },
        { label: 'Rastreador', ivs: ivsRas || [], cor: COR.rastreador },
        { label: 'Ponto',      ivs: ivsPon || [], cor: COR.ponto },
    ];

    doc.setFontSize(7);
    trilhas.forEach((t, i) => {
        const yy = y + i * (trilhaH + gap);
        doc.setTextColor(...COR.texto);
        doc.text(t.label, x, yy + trilhaH - 0.8);
        doc.setFillColor(...COR.cinzaClaro);
        doc.rect(x + labelW, yy, trilhaW, trilhaH, 'F');

        for (const iv of t.ivs) {
            const ini = Math.max(new Date(iv.inicio).getTime(), dayStart);
            const fim = Math.min(new Date(iv.fim).getTime(), dayEnd);
            if (fim <= ini) continue;
            const xi = x + labelW + ((ini - dayStart) / (dayEnd - dayStart)) * trilhaW;
            const xf = x + labelW + ((fim - dayStart) / (dayEnd - dayStart)) * trilhaW;
            doc.setFillColor(...t.cor);
            doc.rect(xi, yy, Math.max(0.4, xf - xi), trilhaH, 'F');
        }
    });

    // Eixo de horas
    const totalH = trilhas.length * (trilhaH + gap);
    const eixoY = y + totalH + 0.5;
    doc.setDrawColor(...COR.cinzaMed);
    doc.setFontSize(6);
    for (let h = 0; h <= 24; h += 3) {
        const xx = x + labelW + (h / 24) * trilhaW;
        doc.line(xx, y, xx, eixoY);
        doc.text(`${String(h).padStart(2, '0')}h`, xx - 2, eixoY + 2.5);
    }
    return eixoY + 4;
};

// ── Geração do PDF ───────────────────────────────────────────────────────────

const gerarPDF = (data) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margem = 14;
    const contentW = pageW - margem * 2;

    // ─── Capa / Resumo ───
    doc.setFontSize(16);
    doc.setTextColor(...COR.texto);
    doc.text('Relatório de Jornadas por Operador', margem, 18);

    doc.setFontSize(11);
    doc.text(data.operador.nome, margem, 26);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`${data.operador.funcao || ''}  ·  Período: ${fmtDateBr(data.periodo.startDate)} a ${fmtDateBr(data.periodo.endDate)}`, margem, 31);

    // KPIs
    const kpis = [
        { label: 'Dias com atividade', v: String(data.resumo.diasComAtividade) },
        { label: 'Máquinas operadas',  v: String(data.resumo.maquinasOperadas) },
        { label: 'Discrepâncias',      v: String(data.resumo.totalDiscrepancias) },
        { label: 'Gap acumulado',      v: fmtMin(data.resumo.totalMagnitudeMin) },
    ];
    const kpiW = contentW / 4;
    let kpiY = 38;
    doc.setDrawColor(...COR.cinzaMed);
    kpis.forEach((k, i) => {
        const xx = margem + i * kpiW;
        doc.rect(xx, kpiY, kpiW - 2, 14);
        doc.setFontSize(13);
        doc.setTextColor(...COR.texto);
        doc.text(k.v, xx + 3, kpiY + 7);
        doc.setFontSize(7);
        doc.setTextColor(110);
        doc.text(k.label, xx + 3, kpiY + 11.5);
    });

    // Barras agregadas
    doc.setFontSize(10);
    doc.setTextColor(...COR.texto);
    doc.text('Comparativo agregado (Faturado × Rastreador × Ponto)', margem, kpiY + 22);
    const barrasYFim = drawBarrasAgregadas(doc, margem, kpiY + 25, contentW, data.totaisMin);

    if (!data.fontesDisponiveis.ponto) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('* Trilha "Ponto" aguardando integração — valores zerados.', margem, barrasYFim + 3);
    }

    // ─── Páginas: jornada por dia ───
    let y = barrasYFim + 12;
    const ensureSpace = (need) => {
        if (y + need > pageH - margem) {
            doc.addPage();
            y = margem;
        }
    };

    data.dias.forEach((dia) => {
        // Para cada máquina operada no dia, um bloco com mini-gantt + dados
        dia.maquinas.forEach((m, idx) => {
            const blocoH = 38;
            ensureSpace(blocoH);

            // Cabeçalho do bloco
            doc.setFontSize(9);
            doc.setTextColor(...COR.texto);
            const titulo = `${fmtDateBr(dia.data)}  ·  ${m.registroInterno || m.placa || '—'}${m.placa && m.registroInterno ? ` (${m.placa})` : ''}`;
            doc.text(titulo, margem, y);
            doc.setFontSize(8);
            doc.setTextColor(110);
            doc.text(m.obraNome || '(Sem obra)', margem, y + 4);
            if (m.discrepancias.length > 0) {
                doc.setTextColor(...COR.discrep);
                const txt = `${m.discrepancias.length} discrep. · ${fmtMin(m.discrepancias.reduce((s, d) => s + (d.magnitude_min || 0), 0))}`;
                doc.text(txt, pageW - margem - doc.getTextWidth(txt), y);
            }
            if (m.justificadoEm) {
                doc.setTextColor(34, 139, 34);
                const txt = 'Justificada';
                doc.text(txt, pageW - margem - doc.getTextWidth(txt), y + 4);
            }

            const ganttFim = drawGantt(
                doc, margem, y + 6, contentW,
                m.faturadoIntervalos, m.rastreadorIntervalos, m.pontoIntervalos, dia.data
            );

            // Linha de totais e discrepâncias
            doc.setFontSize(7);
            doc.setTextColor(...COR.texto);
            const tot = m.totaisMin;
            doc.text(
                `Faturado: ${fmtMin(tot.faturado)}   ·   Rastreador: ${fmtMin(tot.rastreador)}   ·   Ponto: ${fmtMin(tot.ponto)}`,
                margem, ganttFim + 1
            );
            if (m.discrepancias.length) {
                doc.setTextColor(...COR.discrep);
                const txt = m.discrepancias
                    .map(d => `${TIPO_LABEL[d.tipo] || d.tipo} (${fmtMin(d.magnitude_min)})`)
                    .join(' · ');
                const linhas = doc.splitTextToSize(txt, contentW);
                doc.text(linhas, margem, ganttFim + 5);
                y = ganttFim + 5 + linhas.length * 3 + 2;
            } else {
                y = ganttFim + 4;
            }

            // separador
            doc.setDrawColor(230);
            doc.line(margem, y, pageW - margem, y);
            y += 3;
        });
    });

    // ─── Tabela final de auditoria ───
    doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(...COR.texto);
    doc.text('Tabela detalhada (auditoria)', margem, 18);

    const rows = [];
    data.dias.forEach(dia => {
        dia.maquinas.forEach(m => {
            const fat = m.totaisMin.faturado;
            const ras = m.totaisMin.rastreador;
            rows.push([
                fmtDateBr(dia.data),
                m.registroInterno || m.placa || '—',
                m.obraNome || '—',
                fmtMin(fat),
                fmtMin(ras),
                fmtMin(m.totaisMin.ponto),
                (fat - ras >= 0 ? '+' : '') + fmtMin(Math.abs(fat - ras)),
                m.discrepancias.length
                    ? m.discrepancias.map(d => `${TIPO_LABEL[d.tipo] || d.tipo} (${fmtMin(d.magnitude_min)})`).join('\n')
                    : '—',
            ]);
        });
    });

    autoTable(doc, {
        startY: 24,
        head: [['Data', 'RE', 'Obra', 'Faturado', 'Rastreador', 'Ponto', 'Δ Fat-Ras', 'Discrepâncias']],
        body: rows,
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 26, 20], textColor: [255, 255, 255] },
        columnStyles: {
            7: { cellWidth: 55 },
        },
        didParseCell: (hookData) => {
            if (hookData.section === 'body' && hookData.column.index === 7) {
                if (hookData.cell.raw !== '—') {
                    hookData.cell.styles.textColor = COR.discrep;
                }
            }
        },
    });

    // Rodapé com paginação
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pages}`, pageW - margem, pageH - 6, { align: 'right' });
        doc.text('MAK Frotas — Análise Gerencial', margem, pageH - 6);
    }

    const nomeArquivo = `jornadas_${data.operador.nome.replace(/\s+/g, '_')}_${data.periodo.startDate}_a_${data.periodo.endDate}.pdf`;
    doc.save(nomeArquivo);
};

// ── Componente ───────────────────────────────────────────────────────────────

const defaultRange = () => {
    const today = new Date();
    const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = firstThisMonth.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);
    return { startDate, endDate };
};

const JornadasOperadorReport = ({ employees = [] }) => {
    const initial = defaultRange();
    const [employeeId, setEmployeeId] = useState('');
    const [startDate, setStartDate] = useState(initial.startDate);
    const [endDate, setEndDate] = useState(initial.endDate);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [preview, setPreview] = useState(null);

    const operadores = useMemo(() => {
        return employees
            .filter(e => e.status !== 'inativo')
            .filter(e => /operador|motorista/i.test(e.funcao || ''))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }, [employees]);

    const handleGerar = async () => {
        setErro('');
        if (!employeeId) { setErro('Selecione um operador.'); return; }
        if (!startDate || !endDate) { setErro('Informe o período.'); return; }
        if (startDate > endDate) { setErro('Data inicial maior que a final.'); return; }
        setLoading(true);
        try {
            const data = await apiClient.getJornadasOperador(employeeId, { startDate, endDate });
            setPreview(data);
            if (!data.dias.length) {
                setErro('Sem jornadas no período para esse operador.');
            } else {
                gerarPDF(data);
            }
        } catch (e) {
            setErro(e.message || 'Erro ao buscar jornadas.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-1">
                <Clock size={20} className="text-amber-600" />
                <h2 className="text-lg font-bold" style={{ color: '#1e1a14' }}>Jornadas por Operador</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">
                Comparativo Faturado × Rastreador × Ponto, dia a dia, para um operador num período.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Operador</label>
                    <SearchableSelect
                        items={operadores}
                        value={employeeId}
                        onChange={(item) => setEmployeeId(item ? item.id : '')}
                        getLabel={(e) => e.nome}
                        getSubLabel={(e) => e.funcao}
                        placeholder="Buscar operador..."
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Data inicial</label>
                    <input
                        type="date" value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-yellow-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Data final</label>
                    <input
                        type="date" value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-yellow-500"
                    />
                </div>
            </div>

            {erro && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
                    {erro}
                </div>
            )}

            <button
                onClick={handleGerar}
                disabled={loading || !employeeId}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-white font-semibold text-sm disabled:opacity-50"
                style={{ background: '#9E7A42' }}
            >
                {loading ? <Loader size={16} className="animate-spin" /> : <Printer size={16} />}
                {loading ? 'Gerando...' : 'Gerar PDF'}
            </button>

            {preview && preview.dias.length > 0 && (
                <div className="mt-6 text-xs text-gray-500">
                    Último relatório gerado: <strong>{preview.operador.nome}</strong> ·{' '}
                    {preview.resumo.diasComAtividade} dia(s) · {preview.resumo.maquinasOperadas} máquina(s) ·{' '}
                    {preview.resumo.totalDiscrepancias} discrepância(s).
                </div>
            )}
        </div>
    );
};

export default JornadasOperadorReport;
