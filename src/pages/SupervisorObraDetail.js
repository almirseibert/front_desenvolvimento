import React, { useState, useEffect, useCallback } from 'react';
import { 
    ArrowLeft, DollarSign, Truck, Save, Loader, 
    AlertTriangle, MessageSquare, FileText, FileDown
} from 'lucide-react';
import apiClient from '../services/apiClient';

// Importação das bibliotecas de PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================================
// CONFIGURAÇÃO DO LOGO
// ============================================================================
// INSTRUÇÃO: Converta o arquivo do logo da MAK para Base64 em um site como https://www.base64-image.de/
// E substitua a string abaixo pelo resultado.
const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAbkAAAD8CAYAAADqttpDAAAACXBIWXMAABcSAAAXEgFnn9JSAAAF+mlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDE5LTA1LTE1VDA5OjIyOjM1LTAzOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAxOS0wNS0xNVQwOTo1ODoyMC0wMzowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAxOS0wNS0xNVQwOTo1ODoyMC0wMzowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpkZTdiNjM2Yy00ZmE1LTRhNDEtOTA2OS02ZWEyZTlhNjMwM2UiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpjMjhmMjVkNC04YTFjLTY4NDMtOTYzYy0yMzZkOTM1ZmFhNGQiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo4MzQyN2Q3MC02MjE5LTQ4NGItYjk0My05ODliNWRhNmU4YTEiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjgzNDI3ZDcwLTYyMTktNDg0Yi1iOTQzLTk4OWI1ZGE2ZThhMSIgc3RFdnQ6d2hlbj0iMjAxOS0wNS0xNVQwOToyMjozNS0wMzowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDpkZTdiNjM2Yy00ZmE1LTRhNDEtOTA2OS02ZWEyZTlhNjMwM2UiIHN0RXZ0OndoZW49IjIwMTktMDUtMTVUMDk6NTg6MjAtMDM6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE5IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4dyPGNAABLY0lEQVR4nO2deZwcR3X4v9Xdc+zu7C3LkizJlu9DtmTLsuRDvrANONgGG8JlbMfcEBKSXwghAQJJOBIIEEIgBwSMsQmHwYDBB4fvQ4dt+bbu+1xp793Zmenu+v1RM9JodnZ2Zndm+pj66tP27mxP9Zua7nr1Xr33Skgp0Wg0Go0mjBheC6DRaDQaTa3QSk6j0Wg0oUUrOY1Go9GEFq3kNBqNRhNatJLTaDQaTWjRSk6j0Wg0oUUrOY1Go9GEFq3kNBqNRhNatJLT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)BORw0KGgoAAAANSUhEUgAAAEAAAABACAQAAAAAYLlVAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAADsQAAA7EAZUrDhsAAAAHdElNRQfmAg0KDwAbx48gAAAAHUlEQVRo3u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAJAwmAAAFzJ7O5AAAAAElFTkSuQmCC"; // Placeholder transparente

const SupervisorObraDetail = ({ obraId, onBack }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [crmNote, setCrmNote] = useState('');
    const [interactionType, setInteractionType] = useState('daily_log'); 
    const [agreedAction, setAgreedAction] = useState('');
    const [submittingCrm, setSubmittingCrm] = useState(false);

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

    const handleCrmSubmit = async (e) => {
        e.preventDefault();
        setSubmittingCrm(true);
        try {
            await apiClient.post('/supervisor/crm', {
                obra_id: obraId,
                interaction_type: interactionType,
                notes: crmNote,
                agreed_action: agreedAction
            });
            setCrmNote('');
            setAgreedAction('');
            fetchDetails(); 
        } catch (error) { alert('Erro ao salvar registro.'); } finally { setSubmittingCrm(false); }
    };

    const handleUpdateMission = async (vehicleId, location, date) => {
        try {
            await apiClient.post('/supervisor/vehicle-mission', {
                vehicle_id: vehicleId,
                next_location: location,
                release_date: date
            });
            const btn = document.getElementById(`btn-save-${vehicleId}`);
            if(btn) {
                btn.innerHTML = "OK";
                btn.className = "text-green-600 font-bold text-xs";
                setTimeout(() => { 
                    btn.innerHTML = "";
                    btn.className = "text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors";
                    fetchDetails();
                }, 1000);
            }
        } catch (e) { alert("Erro ao salvar destino."); }
    };

    // ============================================================================
    // GERADOR DE PDF PROFISSIONAL
    // ============================================================================
    const generateRealPDF = () => {
        if (!data) {
            alert("Aguarde o carregamento dos dados.");
            return;
        }
        
        const doc = new jsPDF();
        const { obra, contract, financeiro, producao, veiculos } = data;
        const totalPagesExp = '{total_pages_count_string}';

        // Cores Corporativas (Ajuste conforme a marca MAK)
        const colors = {
            primary: [30, 41, 59], // Slate 800 (Azul Escuro Profundo)
            secondary: [234, 179, 8], // Yellow 500 (Amarelo Construção)
            text: [51, 65, 85],    // Slate 700
            lightBg: [248, 250, 252] // Slate 50
        };

        // --- CABEÇALHO ---
        // 1. Logo (Esquerda)
        try {
            doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25); // x, y, w, h
        } catch (e) {
            console.warn("Logo inválido ou não carregado");
        }

        // 2. Título e Info (Direita)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(...colors.primary);
        doc.text("RELATÓRIO DE ACOMPANHAMENTO", 200, 20, { align: 'right' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("MAK SERVIÇOS E PAVIMENTAÇÕES LTDA", 200, 26, { align: 'right' });
        
        // Linha divisória amarela
        doc.setDrawColor(...colors.secondary);
        doc.setLineWidth(1);
        doc.line(14, 40, 200, 40);

        // --- INFO DA OBRA (Bloco Cinza) ---
        doc.setFillColor(...colors.lightBg);
        doc.rect(14, 45, 186, 25, 'F'); // Fundo cinza claro

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...colors.primary);
        doc.text(obra.nome.toUpperCase(), 18, 53);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...colors.text);
        doc.text(`Responsável: ${contract.responsavel_nome || 'N/D'}`, 18, 60);
        doc.text(`Fiscal: ${contract.fiscal_nome || 'N/D'}`, 18, 65);
        
        doc.text(`Data Emissão: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 195, 65, { align: 'right' });

        // --- SEÇÃO 1: RESUMO EXECUTIVO (KPIs) ---
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.primary);
        doc.text("RESUMO FINANCEIRO E FÍSICO", 14, 82);

        // Tabela de Resumo (Estilo Clean)
        autoTable(doc, {
            startY: 85,
            head: [['Indicador Financeiro', 'Valor (R$)', 'Indicador Físico', 'Quantitativo']],
            body: [
                ['Valor Total Contrato', formatCurrency(financeiro.total_contrato), 'Horas Contratadas', (producao.saldo_horas + producao.horas_executadas).toFixed(0)],
                ['Total Despesas', formatCurrency(financeiro.total_despesas), 'Horas Executadas', producao.horas_executadas.toFixed(0)],
                ['A Faturar (Estimado)', formatCurrency(financeiro.pendente_faturamento), 'Saldo de Horas', producao.saldo_horas.toFixed(0)],
                ['Percentual Financeiro', '-', 'Progresso Físico', `${((producao.horas_executadas / (producao.saldo_horas + producao.horas_executadas || 1)) * 100).toFixed(1)}%`]
            ],
            theme: 'plain', // Sem grades pesadas
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { 
                fillColor: colors.primary, 
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: colors.text },
                2: { fontStyle: 'bold', textColor: colors.text }
            },
            didDrawCell: (data) => {
                // Adiciona uma linha fina abaixo de cada row
                if (data.section === 'body' && data.column.index === 3) {
                     doc.setDrawColor(220, 220, 220);
                     doc.line(data.cell.x - 130, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                }
            }
        });

        // --- SEÇÃO 2: FROTA (Tabela Detalhada) ---
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.primary);
        doc.text("ALOCAÇÃO DE FROTA E EQUIPAMENTOS", 14, finalY);
        
        const rows = veiculos.map(v => [
            v.placa || v.re || '-',
            `${v.marca || ''} ${v.modelo || ''} (${v.tipo})`.substring(0, 35), // Limita tamanho
            v.operador_atual || 'A Definir',
            v.total_executado?.toFixed(1) || '0.0',
            v.media_diaria?.toFixed(1) || '0.0',
            v.proximo_destino || '-'
        ]);

        autoTable(doc, {
            startY: finalY + 4,
            head: [['Identificação', 'Equipamento', 'Operador', 'Total (h)', 'Média/Dia', 'Próx. Destino']],
            body: rows,
            theme: 'striped', // Linhas alternadas
            headStyles: { 
                fillColor: colors.primary,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left'
            },
            styles: { 
                fontSize: 8, 
                cellPadding: 3,
                textColor: colors.text
            },
            columnStyles: {
                3: { halign: 'center' }, // Centraliza números
                4: { halign: 'center' }
            },
            alternateRowStyles: {
                fillColor: colors.lightBg
            }
        });

        // --- SEÇÃO 3: OBSERVAÇÕES ---
        if (crmNote) {
            const noteY = doc.lastAutoTable.finalY + 15;
            // Verifica se cabe na página
            if (noteY > 250) {
                doc.addPage();
                doc.text("OBSERVAÇÕES DA SESSÃO", 14, 20);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.text(crmNote, 14, 28, { maxWidth: 180 });
            } else {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text("OBSERVAÇÕES DA SESSÃO", 14, noteY);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                // Caixa de texto com fundo leve
                doc.setFillColor(255, 253, 240); // Amarelo muito claro
                doc.rect(14, noteY + 3, 182, 20, 'F');
                doc.text(crmNote, 16, noteY + 10, { maxWidth: 178 });
            }
        }

        // --- RODAPÉ EM TODAS AS PÁGINAS ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            const footerText = `Página ${i} de ${totalPagesExp}`;
            doc.text(footerText, 195, 285, { align: 'right' });
            doc.text("Gerado pelo Sistema Frotas MAK", 14, 285);
        }

        doc.save(`Relatorio_MAK_${obra.nome.substring(0, 15).replace(/\s/g, '_')}.pdf`);
    };

    const calculateEndDate = () => {
        if (!data) return { date: new Date(), diasRestantes: 0 };
        const { producao } = data;
        const saldo = producao?.saldo_horas || 0;
        const ritmo = producao?.media_diaria_atual || 1;

        if (saldo <= 0) return { date: new Date(), diasRestantes: 0 };

        const diasRestantes = Math.ceil(saldo / ritmo);
        let date = new Date();
        let added = 0;
        while(added < diasRestantes && added < 2000) {
            date.setDate(date.getDate() + 1);
            if(date.getDay() !== 0 && date.getDay() !== 6) added++;
        }
        return { date, diasRestantes };
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader className="animate-spin text-blue-600" /></div>;
    if (!data) return <div>Erro ao carregar dados.</div>;

    const { obra, contract, financeiro, producao, veiculos, crm_history } = data;
    const previsao = calculateEndDate();
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    return (
        <div className="bg-slate-100 min-h-screen pb-20">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-4 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={20}/></button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">{obra?.nome}</h1>
                        <p className="text-xs text-slate-500">Contrato: {formatCurrency(contract?.total_value)}</p>
                    </div>
                </div>
                <button 
                    onClick={generateRealPDF}
                    className="flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-sm" style={{background:'#1c1a17'}} onMouseEnter={e=>e.currentTarget.style.background='#2e2820'} onMouseLeave={e=>e.currentTarget.style.background='#1c1a17'}
                >
                    <FileDown size={16} /> Baixar Relatório PDF
                </button>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* 1. CARTÃO DE PREVISÃO */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-8 shadow-lg relative overflow-hidden">
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <h3 className="text-slate-400 font-bold uppercase text-xs mb-2">Previsão de Término</h3>
                            <div className="text-4xl font-bold text-white mb-1">
                                {previsao.date.toLocaleDateString('pt-BR')}
                            </div>
                            <p className="text-sm text-slate-300">
                                Restam aprox. <strong className="text-yellow-400">{previsao.diasRestantes} dias úteis</strong>
                            </p>
                        </div>
                        <div className="border-l border-slate-700 pl-8">
                            <h3 className="text-slate-400 font-bold uppercase text-xs mb-2">Ritmo Teórico (8h/Máq)</h3>
                            <div className="text-3xl font-bold text-blue-400 mb-1">
                                {contract.is_hidden ? '-' : `${producao?.media_diaria_atual?.toFixed(0)}h`} <span className="text-sm text-slate-400">/dia</span>
                            </div>
                        </div>
                        <div className="border-l border-slate-700 pl-8">
                            <h3 className="text-slate-400 font-bold uppercase text-xs mb-2">Saldo Contratual</h3>
                            <div className="text-3xl font-bold text-green-400 mb-1">
                                {producao?.saldo_horas?.toFixed(0)}h
                            </div>
                            <div className="w-full bg-slate-700 h-2 rounded-full mt-2">
                                <div 
                                    className="bg-green-400 h-2 rounded-full" 
                                    style={{width: `${(1 - (producao?.saldo_horas / (contract?.total_hours_contracted || 1))) * 100}%`}}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. GRID UNIFICADO */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Veículos */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Truck size={18} /> Equipamentos Alocados
                            </h3>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-bold">
                                    <tr>
                                        <th className="px-4 py-2">Veículo</th>
                                        <th className="px-4 py-2">Total Exec.</th>
                                        <th className="px-4 py-2">Previsão</th>
                                        <th className="px-4 py-2">Próximo Destino</th>
                                        <th className="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(veiculos || []).map(v => (
                                        <MachineRow 
                                            key={v.id} 
                                            vehicle={v} 
                                            globalEndDate={previsao.date}
                                            onSave={handleUpdateMission} 
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Financeiro */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <DollarSign size={18} /> Resumo Financeiro
                            </h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-xs text-blue-600 uppercase font-bold">Medido (Físico)</p>
                                    <p className="text-lg font-bold text-blue-800">{formatCurrency(financeiro?.valor_produzido)}</p>
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg">
                                    <p className="text-xs text-red-600 uppercase font-bold">Despesas</p>
                                    <p className="text-lg font-bold text-red-800">{formatCurrency(financeiro?.total_despesas)}</p>
                                </div>
                            </div>
                            
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-center">
                                <p className="text-xs text-yellow-700 uppercase font-bold">Pendente Faturamento</p>
                                <p className="text-2xl font-bold text-yellow-800">{formatCurrency(financeiro?.pendente_faturamento)}</p>
                            </div>

                            <div className="mt-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Por Categoria</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                    {(financeiro?.categorias || []).map((cat, i) => (
                                        <div key={i} className="flex justify-between text-xs border-b border-slate-50 pb-1">
                                            <span className="text-slate-600">{cat.category || 'Outros'}</span>
                                            <span className="font-medium text-slate-800">{formatCurrency(cat.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. DIÁRIO */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <MessageSquare size={18}/> Novo Registro
                        </h3>
                        <form onSubmit={handleCrmSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                                <select 
                                    className="w-full mt-1 border rounded p-2 text-sm bg-slate-50 outline-none"
                                    value={interactionType}
                                    onChange={e => setInteractionType(e.target.value)}
                                >
                                    <option value="daily_log">Diário de Bordo</option>
                                    <option value="billing_milestone">Marco de Cobrança</option>
                                    <option value="routine">Rotina Diária</option>
                                    <option value="issue">Problema/Impedimento</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                                <textarea 
                                    className="w-full mt-1 border rounded p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                    rows="4"
                                    placeholder="Descreva o acontecimento..."
                                    value={crmNote}
                                    onChange={e => setCrmNote(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Ação Acordada</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 border rounded p-2 text-sm"
                                    placeholder="Ex: Enviar medição..."
                                    value={agreedAction}
                                    onChange={e => setAgreedAction(e.target.value)}
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={submittingCrm}
                                className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"
                            >
                                {submittingCrm ? <Loader size={16} className="animate-spin"/> : <Save size={16}/>}
                                Salvar Registro
                            </button>
                        </form>
                    </div>

                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <FileText size={18}/> Histórico de Registros
                        </h3>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                            {(crm_history || []).map((log) => (
                                <div key={log.id} className="relative pl-6 border-l-2 border-slate-200 pb-4 last:pb-0">
                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                                        log.interaction_type === 'billing_milestone' ? 'bg-green-500' :
                                        log.interaction_type === 'issue' ? 'bg-red-500' : 'bg-blue-400'
                                    }`}></div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                            {log.interaction_type}
                                        </span>
                                        <span className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 mb-1">{log.notes}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-xs text-slate-400 italic">Por: {log.supervisor_name || 'Sistema'}</span>
                                        {log.agreed_action && (
                                            <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 flex items-center gap-1">
                                                <AlertTriangle size={10} /> {log.agreed_action}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {(crm_history || []).length === 0 && <p className="text-slate-400 text-sm text-center">Nenhum registro.</p>}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const MachineRow = ({ vehicle, globalEndDate, onSave }) => {
    const [location, setLocation] = useState(vehicle.proximo_destino || '');
    const [date, setDate] = useState(
        vehicle.data_liberacao_manual 
        ? vehicle.data_liberacao_manual.split('T')[0] 
        : globalEndDate.toISOString().split('T')[0]
    );

    return (
        <tr className="hover:bg-slate-50">
            <td className="px-4 py-3">
                <div className="font-bold text-slate-700">{vehicle.modelo}</div>
                <div className="text-[10px] text-slate-400">{vehicle.placa || vehicle.re || '-'}</div>
            </td>
            <td className="px-4 py-3">
                <span className="text-xs font-bold text-slate-700">{vehicle.total_executado?.toFixed(1) || '0.0'}h</span>
            </td>
            <td className="px-4 py-3">
                <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="border border-slate-300 rounded p-1 text-slate-600 text-xs w-full focus:border-blue-500 outline-none"
                />
            </td>
            <td className="px-4 py-3">
                <input 
                    type="text" 
                    placeholder="Destino..." 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="border-b border-slate-300 bg-transparent py-1 w-full text-xs outline-none focus:border-blue-500 placeholder:text-slate-300"
                />
            </td>
            <td className="px-4 py-3 text-right">
                <button 
                    id={`btn-save-${vehicle.id}`}
                    onClick={() => onSave(vehicle.id, location, date)}
                    className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"
                >
                    <Save size={16} />
                </button>
            </td>
        </tr>
    );
};

export default SupervisorObraDetail;