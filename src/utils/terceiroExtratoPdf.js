// src/utils/terceiroExtratoPdf.js
// Gera o extrato (PDF) de um terceiro: resumo por contrato + históricos de
// adiantamento e abastecimento. Client-side (jsPDF), reaproveitando os mesmos
// cálculos da tela (computeContratosPorTerceiro / getContratoAbastecimentos).

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { computeContratosPorTerceiro, getContratoAbastecimentos } from './terceirizados';

const fmtBRL = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtL = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L';
const fmtDate = (v) => {
    if (!v) return '—';
    const d = v instanceof Date ? v : new Date(String(v).includes('T') ? v : `${String(v).split(' ')[0]}T00:00:00`);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

/**
 * @param {object} terceiro  locador { razaoSocial, cnpj }
 * @param {object} ctx       contexto de dados (mesmo passado a computeContrato) + pagamentos
 * @param {array}  contratos terceiroContratos
 * @param {function} obraNome (id) => nome
 */
export const gerarTerceiroExtratoPdf = (terceiro, ctx, contratos, obraNome) => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pagamentos = ctx.pagamentos || [];
    const agg = computeContratosPorTerceiro(terceiro.id, contratos, ctx);

    doc.setFontSize(15); doc.setFont(undefined, 'bold');
    doc.text('Extrato de Terceirizado', 14, 18);
    doc.setFontSize(11); doc.setFont(undefined, 'normal');
    doc.text(terceiro.razaoSocial || '—', 14, 26);
    if (terceiro.cnpj) doc.text(`CNPJ ${terceiro.cnpj}`, 14, 32);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Emitido em ${fmtDate(new Date())}`, 14, terceiro.cnpj ? 38 : 32);
    doc.setTextColor(0);

    let y = terceiro.cnpj ? 44 : 38;

    // Resumo por contrato
    autoTable(doc, {
        startY: y,
        head: [['Contrato', 'Obra', 'Valor', 'Diesel', 'Pagto.', 'Saldo']],
        body: agg.contratos.map((r) => [
            r.contrato.numero,
            obraNome(r.contrato.obraId),
            fmtBRL(r.valorTotal), fmtBRL(r.diesel), fmtBRL(r.adiantamentos), fmtBRL(r.saldo),
        ]),
        foot: [['Total', '', fmtBRL(agg.valorTotal), fmtBRL(agg.diesel), fmtBRL(agg.adiantamentos), fmtBRL(agg.saldo)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [124, 58, 237] },
        footStyles: { fillColor: [243, 240, 255], textColor: 0, fontStyle: 'bold' },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Adiantamentos (todos os contratos do terceiro)
    const numeroPorId = new Map(contratos.map((c) => [c.id, c.numero]));
    const adiantamentos = pagamentos
        .filter((p) => contratos.some((c) => c.locadorId === terceiro.id && c.id === p.contratoId))
        .sort((a, b) => String(b.data).localeCompare(String(a.data)));

    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text('Pagamentos', 14, y); y += 2;
    autoTable(doc, {
        startY: y,
        head: [['Data', 'Contrato', 'Referência', 'Lançado por', 'Valor']],
        body: adiantamentos.length ? adiantamentos.map((p) => [
            fmtDate(p.data), numeroPorId.get(p.contratoId) || '—', p.descricao || '—', p.created_by_email || '—', fmtBRL(p.valor),
        ]) : [['—', '—', 'Nenhum pagamento', '—', fmtBRL(0)]],
        foot: [['', '', '', 'Total', fmtBRL(agg.adiantamentos)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [124, 58, 237] },
        footStyles: { fillColor: [243, 240, 255], textColor: 0, fontStyle: 'bold' },
        columnStyles: { 4: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Abastecimentos (por contrato)
    const abastLinhas = [];
    agg.contratos.forEach((r) => {
        getContratoAbastecimentos(r.contrato, ctx).forEach((a) => {
            abastLinhas.push([
                fmtDate(a.date), r.contrato.numero,
                a.vehicle?.registroInterno || a.vehicle?.placa || '—',
                a.fonte === 'comboio' ? 'Comboio' : 'Posto', fmtL(a.litros), fmtBRL(a.valor),
            ]);
        });
    });
    abastLinhas.sort((a, b) => String(b[0]).localeCompare(String(a[0])));

    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text('Abastecimentos', 14, y); y += 2;
    autoTable(doc, {
        startY: y,
        head: [['Data', 'Contrato', 'Máquina', 'Fonte', 'Litros', 'Valor']],
        body: abastLinhas.length ? abastLinhas : [['—', '—', 'Nenhum abastecimento', '—', '—', fmtBRL(0)]],
        foot: [['', '', '', '', 'Total', fmtBRL(agg.diesel)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        footStyles: { fillColor: [239, 246, 255], textColor: 0, fontStyle: 'bold' },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
    });

    const nomeArq = `extrato_${(terceiro.razaoSocial || 'terceiro').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(nomeArq);
};
