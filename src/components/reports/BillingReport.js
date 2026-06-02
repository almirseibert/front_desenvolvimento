import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ClipboardCheck, Printer, Loader } from 'lucide-react';
import { SectionHeader } from './ReportComponents';
import apiClient from '../../services/apiClient'; // Ajuste o caminho conforme necessidade
import SearchableObraSelect from '../SearchableObraSelect';

const BillingReport = ({ obras, vehicles }) => {
    const [selectedObraId, setSelectedObraId] = useState('');
    const [localDailyLogs, setLocalDailyLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const sortedObras = useMemo(() => {
        return [...obras].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }, [obras]);

    useEffect(() => {
        if (!selectedObraId) {
            setLocalDailyLogs([]);
            return;
        }

        const fetchLogs = async () => {
            setLoading(true);
            try {
                const logs = await apiClient.getDailyLogs(selectedObraId);
                setLocalDailyLogs(logs || []);
            } catch (error) {
                console.error("Erro ao buscar logs para relatório:", error);
                setLocalDailyLogs([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [selectedObraId]);

    const generatePDF = () => {
        const obra = obras.find(o => o.id === selectedObraId);
        if (!obra) return;

        const doc = new jsPDF();
        doc.setFontSize(16); doc.text(`Relatório de Faturamento: ${obra.nome}`, 14, 20);
        doc.setFontSize(10); doc.text(`Comparativo: Contratado vs. Realizado (Apontamentos)`, 14, 26);

        const executedByType = {};
        localDailyLogs.forEach(log => {
            const vehicle = vehicles.find(v => v.id === log.vehicleId);
            const type = vehicle ? vehicle.tipo : 'Outros';
            if (!executedByType[type]) executedByType[type] = 0;
            const val = parseFloat(log.totalHours !== undefined ? log.totalHours : log.total_hours);
            executedByType[type] += (isNaN(val) ? 0 : val);
        });

        const tableBody = [];
        const contracted = obra.horasContratadasPorTipo || {};
        const allTypes = new Set([...Object.keys(contracted), ...Object.keys(executedByType)]);
        const sortedTypes = Array.from(allTypes).sort();
        const extraRowsIndices = [];

        sortedTypes.forEach((type, index) => {
            const cont = parseFloat(contracted[type] || 0);
            const exec = executedByType[type] || 0;
            const balance = cont - exec;
            const percent = cont > 0 ? ((exec / cont) * 100).toFixed(1) + '%' : '-';
            
            if (cont === 0 && exec > 0) extraRowsIndices.push(index);

            tableBody.push([type, cont.toFixed(1), exec.toFixed(1), balance.toFixed(1), percent]);
        });

        autoTable(doc, {
            startY: 35,
            head: [['Grupo de Equipamento', 'Hrs Contratadas', 'Hrs Faturadas', 'Saldo', '% Exec.']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [234, 179, 8], textColor: [0,0,0] },
            columnStyles: { 3: { fontStyle: 'bold' } },
            didParseCell: function (data) {
                if (data.section === 'body' && extraRowsIndices.includes(data.row.index)) {
                    data.cell.styles.fillColor = [255, 200, 200];
                    data.cell.styles.textColor = [150, 0, 0];
                }
            }
        });

        const totalCont = Object.values(contracted).reduce((a,b) => a + parseFloat(b||0), 0);
        const totalExec = Object.values(executedByType).reduce((a,b) => a + b, 0);
        
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text(`Total Faturado na Obra: ${totalExec.toFixed(1)} hrs`, 14, doc.lastAutoTable.finalY + 10);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`Total Contratado: ${totalCont.toFixed(1)} hrs`, 14, doc.lastAutoTable.finalY + 16);
        
        if (extraRowsIndices.length > 0) {
            doc.setFontSize(8); doc.setTextColor(150, 0, 0);
            doc.text("* Equipamentos em vermelho não constam no contrato original, mas possuem horas apontadas.", 14, doc.lastAutoTable.finalY + 22);
        }

        doc.save(`Faturamento_${obra.nome}.pdf`);
    };

    return (
        <div className="animate-fade-in">
             <SectionHeader icon={ClipboardCheck} title="Relatório de Faturamento" description="Comparativo financeiro: Horas Contratadas vs. Horas Apontadas nos diários." />
             <div className="bg-white p-6 rounded-lg border shadow-sm max-w-2xl">
                <label className="block text-sm font-bold text-gray-700 mb-2">Selecione a Obra</label>
                <div className="flex gap-3">
                    <SearchableObraSelect
                        obras={sortedObras.filter(o => o.status === 'ativa')}
                        value={selectedObraId}
                        onChange={(obra) => setSelectedObraId(obra?.id || '')}
                        placeholder="Buscar obra pelo nome..."
                        className="flex-1"
                    />
                    <button onClick={generatePDF} disabled={!selectedObraId || loading} className="btn-primary bg-yellow-500 hover:bg-yellow-600 text-black border-none flex items-center gap-2 disabled:bg-gray-300">
                        {loading ? <Loader className="animate-spin" size={18}/> : <Printer size={18}/>} 
                        Gerar Comparativo
                    </button>
                </div>
                {localDailyLogs.length > 0 && <p className="text-xs text-green-600 mt-2 font-medium">✓ {localDailyLogs.length} registros encontrados para esta obra.</p>}
             </div>
        </div>
    );
};

export default BillingReport;