import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Download } from 'lucide-react';
import { SectionHeader } from './ReportComponents';
import { formatObraNome } from '../../utils/obraFormat';
import { terceirizadoPdfMark } from '../ui/TerceirizadoBadge';

const WorkPlanReport = ({ obras, vehicles, vehicleGroups, expenses = [], equipmentTypesForHours = [] }) => {
    const [pdfWorkplanSelectedObras, setPdfWorkplanSelectedObras] = useState([]);
    const [pdfWorkplanFilterStatus, setPdfWorkplanFilterStatus] = useState('ativa');

    // Helper de ordenação alfanumérica
    const sortAlphaNum = (a, b) => (a || '').toString().localeCompare((b || '').toString(), undefined, { numeric: true, sensitivity: 'base' });

    const obrasToDisplay = useMemo(() => {
        if (!obras) return [];
        return obras
            .filter(o => o.status === pdfWorkplanFilterStatus)
            .sort((a, b) => sortAlphaNum(a.nome, b.nome));
    }, [obras, pdfWorkplanFilterStatus]);

    useEffect(() => {
        setPdfWorkplanSelectedObras([]);
    }, [pdfWorkplanFilterStatus]);

    const exportWorkplanToPDF = () => {
        const doc = new jsPDF();
        
        pdfWorkplanSelectedObras
            .map(obraId => obras.find(o => o.id === obraId))
            .filter(Boolean)
            .sort((a, b) => sortAlphaNum(a.nome, b.nome))
            .forEach((obra, index) => {
                if (index > 0) doc.addPage();

                doc.setFontSize(18);
                doc.text(`Plano de Trabalho: ${formatObraNome(obra)}`, 14, 22);
                doc.setFontSize(11); doc.setTextColor(100);
                
                let currentY = 30;
                doc.setFontSize(12); doc.setFont('helvetica', 'bold');
                doc.text(`Período da Obra:`, 14, currentY); doc.setFont('helvetica', 'normal');
                currentY += 5;
                
                const dataInicioStr = obra.dataInicio ? new Date(obra.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
                const dataFimStr = obra.dataFim ? new Date(obra.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Em andamento';
                doc.text(`Início: ${dataInicioStr}`, 14, currentY); currentY += 5;
                doc.text(`Fim: ${dataFimStr}`, 14, currentY); currentY += 10;
                
                const progressData = { contratado: {}, concluido: {}, totalContratado: 0, totalConcluido: 0 };
                const uniqueEquipmentTypes = [...new Set(equipmentTypesForHours)];
                const allEquipmentTypes = [...uniqueEquipmentTypes];
                
                if (!allEquipmentTypes.includes('Caminhão')) allEquipmentTypes.push('Caminhão');
                
                // Zera concluidos
                allEquipmentTypes.forEach(type => {
                    progressData.concluido[type] = 0;
                });

                // CORREÇÃO SOLICITADA: Somar TODAS as horas contratadas do grupo 'Caminhões' para o item 'Caminhão'
                Object.entries(obra.horasContratadasPorTipo || {}).forEach(([tipo, horas]) => {
                    const horasNum = parseFloat(horas || 0);
                    if (horasNum <= 0) return;

                    const isCaminhao = vehicleGroups['Caminhões']?.includes(tipo);

                    if (isCaminhao) {
                        progressData.contratado['Caminhão'] = (progressData.contratado['Caminhão'] || 0) + horasNum;
                        progressData.totalContratado += horasNum;
                    } else {
                        progressData.contratado[tipo] = (progressData.contratado[tipo] || 0) + horasNum;
                        progressData.totalContratado += horasNum;
                        if (!allEquipmentTypes.includes(tipo)) {
                            allEquipmentTypes.push(tipo);
                        }
                    }
                });

                (obra.historicoVeiculos || []).forEach(h => {
                    const vehicle = vehicles.find(v => v.id === h.veiculoId);
                    if (!vehicle) return;

                    const vehicleGroup = Object.keys(vehicleGroups).find(group => vehicleGroups[group].includes(vehicle.tipo));
                    const equipType = equipmentTypesForHours.find(t => vehicle.tipo === t);
                    const isHourBased = vehicleGroup === 'Máquinas Pesadas' || vehicleGroup === 'Caminhões';

                    if (!isHourBased) return;
                    
                    const startReading = parseFloat(h.horimetroEntrada || h.odometroEntrada || 0);
                    let endReading;

                    if (h.dataSaida) {
                        endReading = parseFloat(h.horimetroSaida || h.odometroSaida || 0);
                    } else {
                         if (vehicleGroup === 'Máquinas Pesadas' || vehicleGroup === 'Caminhões') {
                            endReading = parseFloat(vehicle.horimetro || 0);
                        }
                    }

                    if (endReading >= startReading) {
                        const hours = endReading - startReading;
                        if (vehicleGroup === 'Caminhões') progressData.concluido['Caminhão'] = (progressData.concluido['Caminhão'] || 0) + hours;
                        else if (equipType) progressData.concluido[equipType] = (progressData.concluido[equipType] || 0) + hours;
                        else if (vehicle.tipo) {
                           progressData.concluido[vehicle.tipo] = (progressData.concluido[vehicle.tipo] || 0) + hours;
                           if(!allEquipmentTypes.includes(vehicle.tipo)) {
                               allEquipmentTypes.push(vehicle.tipo);
                               if(!progressData.contratado[vehicle.tipo]) progressData.contratado[vehicle.tipo] = 0;
                           }
                        }
                    }
                });

                const truckHours = parseFloat(obra.horasAdicionaisCaminhao || 0);
                if (progressData.concluido['Caminhão'] !== undefined) progressData.concluido['Caminhão'] += truckHours;
                else progressData.concluido['Caminhão'] = truckHours;
                
                const totalHorasCaminhoesConcluidas = progressData.concluido['Caminhão'] || 0;
                const totalHorasMaquinasConcluidas = Object.entries(progressData.concluido).reduce((sum, [type, hours]) => type !== 'Caminhão' ? sum + (hours || 0) : sum, 0);

                progressData.totalConcluido = totalHorasCaminhoesConcluidas + totalHorasMaquinasConcluidas;

                const progressBody = allEquipmentTypes.map(type => {
                    const contratado = progressData.contratado[type] || 0;
                    const concluido = progressData.concluido[type] || 0;
                    if (contratado === 0 && concluido === 0) return null;
                    return [type, contratado.toFixed(1), concluido.toFixed(1), (contratado - concluido).toFixed(1)];
                }).filter(Boolean);

                autoTable(doc, {
                    startY: currentY,
                    head: [['Grupo de Equipamento', 'Horas Contratadas', 'Horas Concluídas', 'Saldo']],
                    body: progressBody,
                    foot: [['TOTAL', progressData.totalContratado.toFixed(1), progressData.totalConcluido.toFixed(1), (progressData.totalContratado - progressData.totalConcluido).toFixed(1)]],
                    theme: 'striped',
                    headStyles: { fillColor: [255, 193, 7] },
                    footStyles: { fontStyle: 'bold', fillColor: [105, 105, 105] }
                });

                let finalY = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(12); doc.setFont('helvetica', 'bold');
                doc.text(`Percentual Geral Concluido: ${progressData.totalContratado > 0 ? ((progressData.totalConcluido / progressData.totalContratado) * 100).toFixed(2) : 0}%`, 14, finalY);
                finalY += 15;
                
                doc.setFontSize(16); doc.text('Histórico de Veículos na Obra', 14, finalY); finalY += 8;
                
                const vehicleHistoryBody = (obra.historicoVeiculos || []).map(h => {
                    const vehicle = vehicles.find(v => v.id === h.veiculoId);
                    if (!vehicle) return ['ID não encontrado', '', '', '', '', '', '', ''];
                    
                    const vehicleGroup = Object.keys(vehicleGroups).find(group => vehicleGroups[group].includes(vehicle.tipo));
                    
                    let startReading = 0;
                    let endReading = 0;
                    let readingLabel = '';

                    if (vehicleGroup === 'Máquinas Pesadas' || vehicleGroup === 'Caminhões') {
                        readingLabel = 'Horas';
                        startReading = parseFloat(h.horimetroEntrada || h.odometroEntrada || 0);
                        endReading = h.dataSaida ? parseFloat(h.horimetroSaida || h.odometroSaida || 0) : parseFloat(vehicle.horimetro || 0);
                    } else { 
                        readingLabel = 'Km';
                        startReading = parseFloat(h.odometroEntrada || 0);
                        endReading = h.dataSaida ? parseFloat(h.odometroSaida || 0) : parseFloat(vehicle.odometro || 0);
                    }

                    const totalWorked = (endReading >= startReading) ? (endReading - startReading).toFixed(1) : 'Erro';
                    
                    return [
                        (h.registroInterno || vehicle?.registroInterno || 'N/A') + terceirizadoPdfMark(vehicle),
                        h.tipo || vehicle?.tipo || 'N/A', 
                        h.employeeName || 'N/A', 
                        h.dataEntrada ? new Date(h.dataEntrada).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A', 
                        h.dataSaida ? new Date(h.dataSaida).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Presente', 
                        startReading.toFixed(1),
                        (h.dataSaida ? endReading.toFixed(1) : `${endReading.toFixed(1)} (Atual)`),
                        `${totalWorked} ${readingLabel}`
                    ];
                });

                if (vehicleHistoryBody.length > 0) {
                    autoTable(doc, { 
                        startY: finalY, 
                        head: [['Registro', 'Grupo', 'Funcionário', 'Entrada', 'Saída', 'Leitura Inicial', 'Leitura Final', 'Total Trab.']],
                        body: vehicleHistoryBody, 
                        theme: 'striped', 
                        headStyles: { fillColor: [60, 179, 113] } 
                    });
                    finalY = doc.lastAutoTable.finalY + 15;
                } else {
                    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(100); doc.text('Nenhum veículo alocado nesta obra.', 14, finalY); finalY += 15;
                }

                const obraExpenses = (expenses || []).filter(e => e.obraId === obra.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                const totalDespesas = obraExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
                
                doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('Despesas da Obra', 14, finalY); finalY += 8;

                if (obraExpenses.length > 0) {
                    autoTable(doc, { 
                        startY: finalY, 
                        head: [['Data', 'Descrição', 'Categoria', 'Valor (R$)']], 
                        body: obraExpenses.map(e => [ 
                            e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A', 
                            e.description,
                            e.category || 'Outros',
                            (parseFloat(e.amount) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                        ]), 
                        foot: [['Total', '', '', totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]], 
                        theme: 'striped', 
                        headStyles: { fillColor: [220, 53, 69] }, 
                        footStyles: { fontStyle: 'bold', fillColor: [105, 105, 105] } 
                    });
                } else {
                    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(100); doc.text('Nenhuma despesa registrada para esta obra.', 14, finalY);
                }
            });
        
        doc.save(`Plano_de_Trabalho_MAK.pdf`);
    };

    return (
        <div className="animate-fade-in">
            <SectionHeader icon={FileText} title="Relatório de Plano de Trabalho" description="Histórico físico, horas trabalhadas e despesas da obra." />
            
            <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="w-full sm:w-1/3">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Filtrar por Status</label>
                        <select value={pdfWorkplanFilterStatus} onChange={e => setPdfWorkplanFilterStatus(e.target.value)} className="input-field">
                            <option value="ativa">Obras Ativas</option>
                            <option value="finalizada">Obras Encerradas</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Selecione as Obras (Ctrl+Click)</label>
                        <select multiple value={pdfWorkplanSelectedObras} onChange={e => setPdfWorkplanSelectedObras(Array.from(e.target.selectedOptions, option => option.value))} className="w-full h-48 p-2 border rounded-lg bg-gray-50 custom-scrollbar">
                            {obrasToDisplay.map(o => <option key={o.id} value={o.id}>{formatObraNome(o)}{o.tipo_registro === 'centro_custo' ? ' (CC)' : ''}</option>)}
                        </select>
                    </div>
                </div>
                <button onClick={exportWorkplanToPDF} className="btn-primary bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 w-full sm:w-auto" disabled={pdfWorkplanSelectedObras.length === 0}>
                    <Download size={16}/>Gerar Plano de Trabalho ({pdfWorkplanSelectedObras.length})
                </button>
            </div>
        </div>
    );
};

export default WorkPlanReport;