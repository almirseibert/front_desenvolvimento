import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Printer, Droplet, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { SectionHeader, FilterSection } from './ReportComponents';
import SearchableObraSelect from '../SearchableObraSelect';
import SearchableSelect from '../SearchableSelect';

const SupplyOrdersReport = ({ 
    supplyOrders = [], 
    refuelings = [],   
    vehicles = [], 
    obras = [], 
    partners = [], 
    gasStations = [], 
    employees = [] 
}) => {
    // --- 0. Tratamento Robusto de Props ---
    const rawOrders = useMemo(() => {
        if (Array.isArray(refuelings) && refuelings.length > 0) return refuelings;
        if (Array.isArray(supplyOrders) && supplyOrders.length > 0) return supplyOrders;
        return [];
    }, [supplyOrders, refuelings]);

    const rawPartners = Array.isArray(partners) ? partners : (Array.isArray(gasStations) ? gasStations : []);

    const [filters, setFilters] = useState({ 
        vehicleId: '', 
        obraId: '', 
        partnerId: '', 
        startDate: '',
        endDate: ''
    });

    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [selectAll, setSelectAll] = useState(false);

    // Helpers de ordenação e Data
    const sortAlphaNum = (a, b) => (a || '').toString().localeCompare((b || '').toString(), undefined, { numeric: true, sensitivity: 'base' });

    const getSafeDateObj = (dateInput) => {
        if (!dateInput) return new Date(0);
        if (dateInput instanceof Date) return dateInput;
        if (typeof dateInput.toDate === 'function') return dateInput.toDate();
        
        const str = String(dateInput).trim();
        const isoStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
        try {
            const d = new Date(isoStr);
            return isNaN(d.getTime()) ? new Date(0) : d;
        } catch { return new Date(0); }
    };

    const partnersData = useMemo(() => {
        let list = [...rawPartners];
        if (list.length === 0 && rawOrders.length > 0) {
            const uniquePartners = new Map();
            rawOrders.forEach(o => {
                if (o.partnerId && !uniquePartners.has(o.partnerId)) {
                    uniquePartners.set(o.partnerId, { 
                        id: o.partnerId, 
                        razaoSocial: o.partnerName || o.postoNome || 'Posto Desconhecido' 
                    });
                }
            });
            list = Array.from(uniquePartners.values());
        }
        return list;
    }, [rawPartners, rawOrders]);

    const sortedVehicles = useMemo(() => [...vehicles].sort((a, b) => sortAlphaNum(a.registroInterno, b.registroInterno)), [vehicles]);
    const sortedPartners = useMemo(() => [...partnersData].sort((a, b) => sortAlphaNum(a.razaoSocial, b.razaoSocial)), [partnersData]);
    const sortedObras = useMemo(() => [...obras].filter(o => o.status === 'ativa').sort((a, b) => sortAlphaNum(a.nome, b.nome)), [obras]);

    // --- 3. Filtragem Flexível para Resolver Status ("nada funciona") ---
    const filteredOrders = useMemo(() => {
        // Correção Crucial: Deixar o termo "aberta" ou status similares abrangentes para não sumir dados
        const openOrders = rawOrders.filter(o => {
            const currentStatus = (o.status || '').trim().toLowerCase();
            return ['aberta', 'aberto', 'pendente', 'em aberto'].includes(currentStatus);
        });

        const start = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null;
        const end = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : null;

        return openOrders.map(order => {
            const vehicle = vehicles.find(v => v.id === order.vehicleId);
            const partner = partnersData.find(p => p.id === order.partnerId);
            const obra = obras.find(o => o.id === order.obraId);
            const employee = employees.find(e => e.id === order.employeeId);
            const dateObj = getSafeDateObj(order.data || order.date || order.createdAt); // Adicionado fallback para createdAt
            
            return {
                ...order,
                id: order.id,
                vehicleName: vehicle ? `${vehicle.registroInterno} - ${vehicle.modelo}` : (order.vehicleName || 'N/A'),
                partnerName: partner ? (partner.razaoSocial || partner.nome) : (order.partnerName || order.postoNome || 'Posto N/A'),
                obraName: obra ? obra.nome : 'N/A',
                driverName: employee ? employee.nome : (order.employeeName || 'N/A'),
                formattedDate: dateObj.getTime() > 0 ? dateObj.toLocaleDateString('pt-BR') : 'Data Inválida',
                rawDate: dateObj,
                orderNumber: order.authNumber ? `#${String(order.authNumber).padStart(6, '0')}` : 'N/A',
                rawAuthNumber: Number(order.authNumber) || 0,
                quantity: order.isFillUp ? 'Completo' : `${order.litrosLiberados || order.quantidade || 0} L`,
                status: (order.status || 'Aberta').toUpperCase()
            };
        }).filter(order => {
            const matchVeh = filters.vehicleId ? order.vehicleId === filters.vehicleId : true;
            const matchObra = filters.obraId ? order.obraId === filters.obraId : true;
            const matchPartner = filters.partnerId ? order.partnerId === filters.partnerId : true;
            
            let matchDate = true;
            if (start && end) matchDate = order.rawDate >= start && order.rawDate <= end;
            else if (start) matchDate = order.rawDate >= start;
            else if (end) matchDate = order.rawDate <= end;

            return matchVeh && matchObra && matchPartner && matchDate;
        })
        .sort((a,b) => b.rawAuthNumber - a.rawAuthNumber); 

    }, [rawOrders, vehicles, obras, partnersData, employees, filters]);

    useEffect(() => {
        setSelectAll(filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length);
    }, [selectedOrderIds, filteredOrders]);

    const handleGeneratePDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Relatório de Ordens de Abastecimento em Aberto', 14, 22);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
        
        const body = filteredOrders
            .filter(o => selectedOrderIds.includes(o.id))
            .map(o => [
                o.formattedDate,
                o.orderNumber,
                o.vehicleName,
                o.driverName,
                o.partnerName,
                o.obraName,
                o.fuelType || o.tipoCombustivel || '-',
                o.quantity,
                o.status
            ]);

        autoTable(doc, {
            startY: 35,
            head: [['Data Emissão', 'Nº Ordem', 'Veículo', 'Motorista', 'Posto', 'Obra', 'Combustível', 'Qtd Autorizada', 'Status']],
            body,
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38] }, 
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 35 }, 4: { cellWidth: 30 } }
        });
        doc.save('Relatorio_Ordens_Aberto.pdf');
    };

    if (rawOrders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-lg text-center animate-fade-in">
                <AlertCircle className="text-yellow-500 mb-3" size={40} />
                <h3 className="font-bold text-gray-700 text-lg">Nenhuma Ordem Localizada</h3>
                <p className="text-sm text-gray-500 max-w-md mb-4">
                    Nenhuma ordem de abastecimento encontrada na lista.
                </p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-4">
            <SectionHeader icon={Droplet} title="Ordens de Abastecimento (Em Aberto)" description="Controle de ordens emitidas ainda não conciliadas." />
            
            <FilterSection>
                <div className="col-span-1 md:col-span-2 flex gap-2">
                    <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500">De:</label>
                        <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="input-field" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Até:</label>
                        <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="input-field" />
                    </div>
                </div>

                <SearchableSelect
                    items={sortedVehicles}
                    value={filters.vehicleId}
                    onChange={(item) => setFilters({...filters, vehicleId: item?.id || ''})}
                    getLabel={(v) => `${v.registroInterno} - ${v.modelo || ''}`.trim()}
                    getSubLabel={(v) => v.placa || ''}
                    placeholder="Todos os Veículos"
                />

                <SearchableSelect
                    items={sortedPartners}
                    value={filters.partnerId}
                    onChange={(item) => setFilters({...filters, partnerId: item?.id || ''})}
                    getLabel={(p) => p.razaoSocial || p.nome || 'Sem Nome'}
                    getSubLabel={(p) => p.cidade || ''}
                    placeholder={`Todos os Postos (${sortedPartners.length})`}
                />

                <SearchableObraSelect
                    obras={sortedObras}
                    value={filters.obraId}
                    onChange={(obra) => setFilters({...filters, obraId: obra?.id || ''})}
                    placeholder="Todas as Obras"
                    includeInactive={true}
                />
            </FilterSection>

            <div className="border rounded-lg max-h-[500px] overflow-y-auto bg-white custom-scrollbar shadow-sm">
                <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 sticky top-0 uppercase text-gray-600 font-bold z-10 shadow-sm">
                        <tr>
                            <th className="p-3 w-10 text-center">
                                <input type="checkbox" checked={selectAll} onChange={e => {setSelectAll(e.target.checked); setSelectedOrderIds(e.target.checked ? filteredOrders.map(x=>x.id) : [])}} disabled={filteredOrders.length === 0} className="rounded text-red-600 focus:ring-red-500"/>
                            </th>
                            <th className="p-3">Data</th>
                            <th className="p-3">Nº Ordem</th>
                            <th className="p-3">Veículo</th>
                            <th className="p-3">Posto</th>
                            <th className="p-3">Qtd</th>
                            <th className="p-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredOrders.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-gray-400">Nenhuma ordem listada como 'Aberta' com os filtros atuais.</td></tr>
                        ) : (
                            filteredOrders.map(o => (
                                <tr key={o.id} className={`hover:bg-red-50 transition-colors ${selectedOrderIds.includes(o.id) ? 'bg-red-50' : ''}`}>
                                    <td className="p-3 text-center">
                                        <input type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={() => setSelectedOrderIds(p => p.includes(o.id) ? p.filter(x=>x!==o.id) : [...p, o.id])} className="rounded text-red-600 focus:ring-red-500"/>
                                    </td>
                                    <td className="p-3">{o.formattedDate}</td>
                                    <td className="p-3 font-bold text-gray-800">{o.orderNumber}</td>
                                    <td className="p-3 font-medium">{o.vehicleName}</td>
                                    <td className="p-3 truncate max-w-[150px]" title={o.partnerName}>{o.partnerName}</td>
                                    <td className="p-3 font-bold">{o.quantity}</td>
                                    <td className="p-3"><span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-[10px] font-bold">{o.status}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end pt-2">
                <button onClick={handleGeneratePDF} disabled={selectedOrderIds.length === 0} className="btn-primary w-full md:w-auto bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-white font-bold shadow">
                    <Printer size={18}/> Gerar PDF ({selectedOrderIds.length})
                </button>
            </div>
        </div>
    );
};

export default SupplyOrdersReport;