import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HardHat, Printer } from 'lucide-react';
import { SectionHeader } from './ReportComponents';
import { formatObraNome } from '../../utils/obraFormat';

const ConstructionReport = ({ obras, vehicles, dailyWorkLogs, vehicleGroups }) => {
    const [statusFilter, setStatusFilter] = useState('ativa');
    const [selectedObraIds, setSelectedObraIds] = useState([]);
    const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
    const [selectAllVehicles, setSelectAllVehicles] = useState(false);

    const filteredObras = useMemo(() => {
        return obras
            .filter(o => statusFilter === 'todas' || o.status === statusFilter)
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [obras, statusFilter]);

    const filteredVehicles = useMemo(() => {
        if (selectedObraIds.length === 0) return [];
        return vehicles.filter(v => selectedObraIds.includes(v.obraAtualId))
                       .sort((a,b) => (a.registroInterno || '').localeCompare(b.registroInterno || ''));
    }, [vehicles, selectedObraIds]);

    const handleSelectAllVehicles = (e) => {
        setSelectAllVehicles(e.target.checked);
        setSelectedVehicleIds(e.target.checked ? filteredVehicles.map(v => v.id) : []);
    };

    const generatePDF = () => {
        if (selectedObraIds.length === 0) return alert("Selecione pelo menos uma obra.");

        const doc = new jsPDF();
        
        selectedObraIds.forEach((obraId, index) => {
            const obra = obras.find(o => o.id === obraId);
            if (!obra) return;
            
            if (index > 0) doc.addPage();

            doc.setFontSize(16); doc.setTextColor(0);
            doc.text(`Relatório de Obra: ${formatObraNome(obra)}`, 14, 20);
            doc.setFontSize(10); 
            doc.text(`Status: ${obra.status.toUpperCase()} | Local: ${obra.localizacao || 'N/A'}`, 14, 26);

            // Seção 1: Físico
            doc.setFontSize(12); doc.setFont('helvetica', 'bold');
            doc.text("1. Progresso Físico (Leituras de Horímetro/Odômetro)", 14, 35);
            
            const physicalBody = [];
            const history = obra.historicoVeiculos || [];
            const targetVehicles = selectedVehicleIds.length > 0 
                ? vehicles.filter(v => selectedVehicleIds.includes(v.id) && v.obraAtualId === obraId)
                : vehicles.filter(v => v.obraAtualId === obraId);

            targetVehicles.forEach(v => {
                const entry = history.find(h => h.veiculoId === v.id && !h.dataSaida);
                const group = Object.keys(vehicleGroups).find(g => vehicleGroups[g].includes(v.tipo));
                const isKm = group === 'Veículos Leves' || group === 'Caminhões de Trecho';
                
                let start = 0;
                let current = 0;
                let unit = isKm ? 'Km' : 'H';

                if (entry) {
                    if (isKm) {
                        start = parseFloat(entry.odometroEntrada || 0);
                        current = parseFloat(v.odometro || 0);
                    } else {
                        start = parseFloat(entry.horimetroEntrada || entry.odometroEntrada || 0);
                        current = parseFloat(v.horimetro || 0);
                    }
                }
                const worked = Math.max(0, current - start);
                physicalBody.push([v.registroInterno, v.tipo, `${start.toFixed(1)} ${unit}`, `${current.toFixed(1)} ${unit}`, `${worked.toFixed(1)} ${unit}`]);
            });

            if (physicalBody.length > 0) {
                autoTable(doc, {
                    startY: 40,
                    head: [['Registro', 'Grupo', 'Leitura Inicial', 'Leitura Atual', 'Executado']],
                    body: physicalBody,
                    theme: 'striped',
                    headStyles: { fillColor: [44, 62, 80] } 
                });
            } else {
                doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text("Nenhum veículo alocado atualmente.", 14, 45);
            }

            // Seção 2: Financeiro
            let currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 60;
            doc.setFontSize(12); doc.setFont('helvetica', 'bold');
            doc.text("2. Progresso Financeiro (Apontamentos de Faturamento)", 14, currentY);

            let safeLogs = [];
            if (Array.isArray(dailyWorkLogs)) safeLogs = dailyWorkLogs;
            else if (dailyWorkLogs && dailyWorkLogs.data && Array.isArray(dailyWorkLogs.data)) safeLogs = dailyWorkLogs.data;

            const targetObraId = String(obraId).trim();
            const billingLogs = safeLogs.filter(l => {
                const logObraId = l.obraId || l.obra_id;
                return logObraId && String(logObraId).trim() === targetObraId;
            });

            const billingByType = {};
            billingLogs.forEach(l => {
                const v = vehicles.find(veh => veh.id === l.vehicleId);
                const type = v ? v.tipo : 'Outros';
                if (!billingByType[type]) billingByType[type] = 0;
                const val = parseFloat(l.totalHours !== undefined ? l.totalHours : l.total_hours);
                billingByType[type] += (isNaN(val) ? 0 : val);
            });

            const financialBody = [];
            const contracted = obra.horasContratadasPorTipo || {};
            const allTypes = new Set([...Object.keys(contracted), ...Object.keys(billingByType)]);
            let totalContratado = 0;
            let totalFaturado = 0;

            allTypes.forEach(type => {
                const cont = parseFloat(contracted[type] || 0);
                const exec = billingByType[type] || 0;
                totalContratado += cont;
                totalFaturado += exec;
                
                financialBody.push([type, cont.toFixed(1), exec.toFixed(1), (cont - exec).toFixed(1), cont > 0 ? ((exec/cont)*100).toFixed(1) + '%' : '-']);
            });

            autoTable(doc, {
                startY: currentY + 5,
                head: [['Grupo', 'Hrs Contratadas', 'Hrs Faturadas', 'Saldo', '%']],
                body: financialBody,
                theme: 'grid',
                headStyles: { fillColor: [39, 174, 96] },
                foot: [['TOTAL', totalContratado.toFixed(1), totalFaturado.toFixed(1), (totalContratado - totalFaturado).toFixed(1), '-']],
                footStyles: { fillColor: [200, 200, 200], textColor: [0,0,0], fontStyle: 'bold' }
            });
        });

        doc.save('Relatorio_Obras_Completo.pdf');
    };

    return (
        <div className="animate-fade-in">
            <SectionHeader icon={HardHat} title="Relatório de Obras" description="Comparativo completo: Progresso Físico (Leituras) vs. Financeiro (Apontamentos)." />
            
            <div className="bg-white p-6 rounded-lg border shadow-sm">
                <div className="grid md:grid-cols-3 gap-6 mb-4">
                    <div>
                        <label className="label">Status da Obra</label>
                        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setSelectedObraIds([]); }} className="input-field">
                            <option value="ativa">Ativas</option>
                            <option value="finalizada">Finalizadas</option>
                            <option value="todas">Todas</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Selecionar Obras</label>
                        <select multiple value={selectedObraIds} onChange={e => setSelectedObraIds(Array.from(e.target.selectedOptions, o => o.value))} className="w-full h-32 p-2 border rounded text-sm custom-scrollbar">
                            {filteredObras.map(o => <option key={o.id} value={o.id}>{formatObraNome(o)}{o.tipo_registro === 'centro_custo' ? ' (CC)' : ''}</option>)}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Use Ctrl+Click para selecionar várias.</p>
                    </div>

                    <div>
                        <label className="label flex justify-between">
                            Selecionar Veículos
                            <span className="text-xs font-normal flex items-center gap-1"><input type="checkbox" checked={selectAllVehicles} onChange={handleSelectAllVehicles}/> Todos</span>
                        </label>
                        <select multiple value={selectedVehicleIds} onChange={e => setSelectedVehicleIds(Array.from(e.target.selectedOptions, o => o.value))} className="w-full h-32 p-2 border rounded text-sm custom-scrollbar" disabled={selectedObraIds.length === 0}>
                            {filteredVehicles.map(v => <option key={v.id} value={v.id}>{v.registroInterno} - {v.modelo}</option>)}
                        </select>
                    </div>
                </div>

                <button onClick={generatePDF} disabled={selectedObraIds.length === 0} className="btn-primary w-full md:w-auto flex items-center justify-center gap-2">
                    <Printer size={18}/> Gerar Relatório de Obras
                </button>
            </div>
        </div>
    );
};

export default ConstructionReport;