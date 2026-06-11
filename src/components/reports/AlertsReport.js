import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertTriangle, Download } from 'lucide-react';
import { SectionHeader, FilterSection } from './ReportComponents';
import { checkVehicleRestrictions } from '../../utils/vehicleRules';
import { formatObraNome } from '../../utils/obraFormat';

const AlertsReport = ({ vehicles = [], employees = [], inactivityAlerts = [], obras = [], refuelings = [], revisions = [] }) => {
    const [filterType, setFilterType] = useState('Todos');

    const alerts = useMemo(() => {
        const list = [];
        const now = new Date();
        now.setHours(0,0,0,0);
        const thirtyDays = new Date(now);
        thirtyDays.setDate(now.getDate() + 30);

        // 1. Alertas de Veículos (Manutenção e Documentação - Sincronizado com Dashboard)
        vehicles.forEach(v => {
            const vehicleRevisions = revisions.filter(r => r.vehicleId === v.id);
            const restrictions = checkVehicleRestrictions(v, vehicleRevisions);

            restrictions.forEach(issue => {
                let type = 'Manutenção';
                if (issue.category === 'documento') type = 'Documentação';
                else if (issue.category === 'bloqueio') type = 'Bloqueio';

                const obraNome = formatObraNome(obras.find(o => o.id === v.obraAtualId)) || 'Local N/A';

                list.push({
                    entity: `${v.registroInterno} - ${v.placa}`,
                    type,
                    location: obraNome,
                    days: '-', 
                    message: issue.message,
                    date: new Date().toLocaleDateString('pt-BR'),
                    isCritical: issue.type === 'error'
                });
            });
        });

        // 2. Alertas de Funcionários (CNH)
        employees.forEach(emp => {
            // Filtro para apresentar APENAS funcionários Ativos
            if (emp.status && emp.status.toUpperCase() !== 'ATIVO') return;

            const cnhDateRaw = emp.cnhVencimento || emp.validadeCNH;

            if (cnhDateRaw) {
                let venc;
                if (typeof cnhDateRaw === 'string' && cnhDateRaw.includes('-')) {
                     const parts = cnhDateRaw.split('T')[0].split('-');
                     if (parts.length === 3) {
                         venc = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
                     } else {
                         venc = new Date(cnhDateRaw);
                     }
                } else {
                    venc = new Date(cnhDateRaw);
                }

                if (!isNaN(venc.getTime())) {
                    venc.setHours(0,0,0,0);
                    const diffTime = venc.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const daysLabel = diffDays < 0 ? `${Math.abs(diffDays)} dias vencido` : `${diffDays} dias para vencer`;

                    if (venc < now) {
                        list.push({
                            entity: emp.nome,
                            type: 'CNH',
                            location: 'RH / Pessoal',
                            days: daysLabel,
                            message: `CNH Vencida em ${venc.toLocaleDateString('pt-BR')}`,
                            date: venc.toLocaleDateString('pt-BR'),
                            isCritical: true
                        });
                    } else if (venc <= thirtyDays) {
                        list.push({
                            entity: emp.nome,
                            type: 'CNH',
                            location: 'RH / Pessoal',
                            days: daysLabel,
                            message: `CNH Vence em ${venc.toLocaleDateString('pt-BR')}`,
                            date: venc.toLocaleDateString('pt-BR'),
                            isCritical: false
                        });
                    }
                }
            }

            // Toxicológico
            const toxRaw = emp.exameToxicologicoVencimento;
            if (toxRaw) {
                let toxVenc;
                if (typeof toxRaw === 'string' && toxRaw.includes('-')) {
                    const parts = toxRaw.split('T')[0].split('-');
                    if (parts.length === 3) {
                        toxVenc = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
                    } else {
                        toxVenc = new Date(toxRaw);
                    }
                } else {
                    toxVenc = new Date(toxRaw);
                }

                if (!isNaN(toxVenc.getTime())) {
                    toxVenc.setHours(0,0,0,0);
                    const diffTime = toxVenc.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const daysLabel = diffDays < 0 ? `${Math.abs(diffDays)} dias vencido` : `${diffDays} dias para vencer`;

                    if (toxVenc < now) {
                        list.push({
                            entity: emp.nome,
                            type: 'CNH',
                            location: 'RH / Pessoal',
                            days: daysLabel,
                            message: `Exame Toxicológico Vencido em ${toxVenc.toLocaleDateString('pt-BR')}`,
                            date: toxVenc.toLocaleDateString('pt-BR'),
                            isCritical: true
                        });
                    } else if (toxVenc <= thirtyDays) {
                        list.push({
                            entity: emp.nome,
                            type: 'CNH',
                            location: 'RH / Pessoal',
                            days: daysLabel,
                            message: `Exame Toxicológico Vence em ${toxVenc.toLocaleDateString('pt-BR')}`,
                            date: toxVenc.toLocaleDateString('pt-BR'),
                            isCritical: false
                        });
                    }
                }
            }
        });

        // 3. Alertas de Inatividade (Sincronizado e 100% Dinâmico)
        const DIAS_LIMITE = 7; 

        vehicles.forEach(v => {
            if (v.status !== 'Em Obra') return;
            if (!v.obraAtualId) return;

            const vehRefuels = refuelings
                .filter(r => String(r.vehicleId) === String(v.id) && String(r.obraId) === String(v.obraAtualId) && r.status === 'Concluída')
                .sort((a,b) => {
                    const dA = new Date(a.data || a.date || a.created_at || 0);
                    const dB = new Date(b.data || b.date || b.created_at || 0);
                    return dB - dA; 
                });

            let lastRefuelDate = null;
            let daysInactive = null;
            let isBasedOnAllocation = false;

            if (vehRefuels.length > 0) {
                const latest = vehRefuels[0];
                const dRaw = latest.data || latest.date || latest.created_at;
                const dObj = new Date(dRaw);
                
                if (!isNaN(dObj.getTime())) {
                    lastRefuelDate = dObj;
                    const diffTime = Math.abs(now - dObj);
                    daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                }
            } else {
                const obra = obras.find(o => String(o.id) === String(v.obraAtualId));
                if (obra && obra.historicoVeiculos) {
                    const alocacao = obra.historicoVeiculos.find(h => String(h.veiculoId) === String(v.id) && !h.dataSaida);
                    if (alocacao && alocacao.dataEntrada) {
                        const dObj = new Date(alocacao.dataEntrada);
                        if (!isNaN(dObj.getTime())) {
                            lastRefuelDate = dObj;
                            const diffTime = Math.abs(now - dObj);
                            daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            isBasedOnAllocation = true;
                        }
                    }
                }
            }

            if (daysInactive === null || lastRefuelDate === null) return;

            if (daysInactive >= DIAS_LIMITE) {
                const backendAlert = inactivityAlerts.find(a => 
                    String(a.vehicleId || a.vehicle_id || a.vehicle?.id) === String(v.id) && 
                    String(a.obraId || a.obra_id || a.obra?.id) === String(v.obraAtualId) &&
                    ['Ativo', 'Pendente', 'Observado'].includes(a.status)
                );

                if (backendAlert && backendAlert.status === 'Observado') return;

                let obraNome = 'Obra Desconhecida';
                const foundObra = obras.find(o => String(o.id) === String(v.obraAtualId));
                if (foundObra) obraNome = formatObraNome(foundObra);

                const msgContext = isBasedOnAllocation ? 'desde a chegada na obra' : 'sem abastecer na obra';

                list.push({
                    entity: `${v.registroInterno} - ${v.placa}`,
                    type: 'Inatividade',
                    location: obraNome,
                    days: `${daysInactive} dias`,
                    message: `Parado há ${daysInactive} dias ${msgContext}.`,
                    date: lastRefuelDate.toLocaleDateString('pt-BR'),
                    isCritical: true
                });
            }
        });

        // Deduplicar por entity + type + message para evitar entradas duplicadas
        const seen = new Set();
        const deduped = list.filter(item => {
            const key = `${item.entity}|${item.type}|${item.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        return deduped.sort((a, b) => (a.isCritical === b.isCritical) ? 0 : a.isCritical ? -1 : 1);
    }, [vehicles, employees, inactivityAlerts, obras, refuelings, revisions]);

    const filteredAlerts = filterType === 'Todos' ? alerts : alerts.filter(a => a.type === filterType);

    const handleGeneratePDF = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(18); doc.setTextColor(220, 38, 38);
        doc.text(`Relatório de Alertas de Frota`, 14, 20);
        doc.setFontSize(10); doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Filtro: ${filterType}`, 14, 26);

        const body = filteredAlerts.map(a => [a.entity, a.type, a.location, a.days, a.message, a.date]);

        autoTable(doc, {
            startY: 32,
            head: [['Equipamento/Colaborador', 'Tipo', 'Local / Obra', 'Status/Dias', 'Detalhe', 'Data Ref.']],
            body,
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
            styles: { fontSize: 9 },
            columnStyles: { 0: { cellWidth: 40 }, 2: { cellWidth: 50 }, 4: { cellWidth: 80 } }
        });
        doc.save(`Relatorio_Alertas_${filterType}.pdf`);
    };

    return (
        <div className="animate-fade-in">
            <SectionHeader icon={AlertTriangle} title="Relatório de Alertas e Pendências" description="Consolidado de vencimentos (CNH, Documentos, Revisões), bloqueios e inatividade." />
            
            <FilterSection>
                <div className="col-span-full md:col-span-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Categoria</label>
                    <div className="flex flex-wrap gap-2">
                        {['Todos', 'Manutenção', 'Documentação', 'CNH', 'Bloqueio', 'Inatividade'].map(type => (
                            <button key={type} onClick={() => setFilterType(type)} className={`px-4 py-2 text-sm rounded-lg border transition ${filterType === type ? 'bg-red-600 text-white border-red-600 shadow' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
            </FilterSection>

            <div className="bg-white border rounded-lg shadow-sm mb-4">
                <div className="mak-modal-header">
                    <h4 className="font-bold text-gray-700">Pré-visualização ({filteredAlerts.length})</h4>
                    <button onClick={handleGeneratePDF} disabled={filteredAlerts.length === 0} className="text-red-600 hover:text-red-800 font-semibold text-sm flex items-center gap-1">
                        <Download size={16}/> Baixar PDF
                    </button>
                </div>
                <div className="max-h-80 overflow-y-auto custom-scrollbar p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-600 uppercase text-xs sticky top-0">
                            <tr>
                                <th className="p-3">Entidade</th>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Local / Obra</th>
                                <th className="p-3">Status / Dias</th>
                                <th className="p-3">Detalhe</th>
                                <th className="p-3">Data Ref.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredAlerts.map((a, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="p-3 font-medium">{a.entity}</td>
                                    <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700">{a.type}</span></td>
                                    <td className="p-3 text-gray-700">{a.location}</td>
                                    <td className="p-3 font-bold text-red-600">{a.days}</td>
                                    <td className={`p-3 ${a.isCritical ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>{a.message}</td>
                                    <td className="p-3 text-gray-500 text-xs">{a.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AlertsReport;
