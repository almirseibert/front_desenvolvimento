import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Truck, Printer } from 'lucide-react';
import { SectionHeader, FilterSection } from './ReportComponents';
import SearchableObraSelect from '../SearchableObraSelect';
import SearchableSelect from '../SearchableSelect';

const VehicleReport = ({ vehicles = [], obras = [], vehicleGroups = {} }) => {
    const [filters, setFilters] = useState({ type: '', obraId: '', status: '', group: '' });
    const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    
    // Configuração de Colunas
    const allColumns = useMemo(() => [
        { key: 'registroInterno', label: 'Registro Interno' },
        { key: 'placa', label: 'Placa' },
        { key: 'tipo', label: 'Grupo' },
        { key: 'marca', label: 'Marca' },
        { key: 'modelo', label: 'Modelo' },
        { key: 'status', label: 'Status' },
        { key: 'obraAtual', label: 'Obra/Local Atual' },
        { key: 'leituraPrincipal', label: 'Leitura Principal' },
        { key: 'ano_fabricacao', label: 'Ano Fab.' },
        { key: 'ano_modelo', label: 'Ano Mod.' },
        { key: 'chassi', label: 'Chassi' },
    ], []);

    const [selectedColumns, setSelectedColumns] = useState(['registroInterno', 'placa', 'tipo', 'modelo', 'status', 'obraAtual', 'leituraPrincipal']);

    // Filtragem de Veículos
    const filteredVehicles = useMemo(() => {
        const groups = vehicleGroups || {};
        return vehicles
            .map(v => {
                if (!v) return null;
                const vehicleGroup = Object.keys(groups).find(key => groups[key]?.includes(v.tipo)) || 'Outros';
                
                // Formata leitura
                let leituraPrincipal = '';
                if (vehicleGroup === 'Máquinas Pesadas') leituraPrincipal = `${v.horimetro ?? 'N/A'} Hr`;
                else if (vehicleGroup === 'Caminhões') leituraPrincipal = `${v.horimetro ?? 'N/A'} Hr`;
                else leituraPrincipal = `${v.odometro ?? 'N/A'} Km`;

                const obra = obras.find(o => o.id === v.obraAtualId);
                const obraAtual = obra ? obra.nome : (v.localizacaoAtual || 'N/A');
                
                return { ...v, vehicleGroup, leituraPrincipal, obraAtual };
            }).filter(Boolean)
            .filter(v => (
                (filters.type ? v.tipo === filters.type : true) &&
                (filters.obraId ? v.obraAtualId === filters.obraId : true) &&
                (filters.status ? v.status === filters.status : true) &&
                (filters.group ? v.vehicleGroup === filters.group : true)
            ))
            .sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || ''));
    }, [vehicles, filters, vehicleGroups, obras]);

    useEffect(() => {
        if (filteredVehicles.length > 0) {
            setSelectAll(selectedVehicleIds.length === filteredVehicles.length);
        } else {
            setSelectAll(false);
        }
    }, [selectedVehicleIds, filteredVehicles]);

    const handleSelectAll = (e) => {
        const checked = e.target.checked;
        setSelectAll(checked);
        setSelectedVehicleIds(checked ? filteredVehicles.map(v => v.id) : []);
    };

    const handleGeneratePDF = () => {
        if (selectedVehicleIds.length === 0 || selectedColumns.length === 0) return alert("Selecione ao menos um veículo e uma coluna.");
        
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(18);
        doc.text('Relatório de Veículos - Frota MAK', 14, 22);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
        
        const headers = selectedColumns.map(colKey => allColumns.find(c => c.key === colKey)?.label || colKey);
        const body = filteredVehicles
            .filter(v => selectedVehicleIds.includes(v.id))
            .map(vehicle => selectedColumns.map(colKey => vehicle[colKey] != null ? String(vehicle[colKey]) : ''));

        autoTable(doc, {
            startY: 35,
            head: [headers],
            body,
            theme: 'striped',
            headStyles: { fillColor: [3, 105, 161] },
            styles: { fontSize: 8, cellPadding: 2 },
        });
        doc.save('Relatorio_Veiculos_MAK.pdf');
    };

    const vehicleTypes = useMemo(() => [...new Set((vehicles || []).map(v => v?.tipo).filter(Boolean))].sort(), [vehicles]);
    const vehicleGroupOptions = useMemo(() => vehicleGroups ? Object.keys(vehicleGroups).sort() : [], [vehicleGroups]);

    return (
        <div className="animate-fade-in">
            <SectionHeader icon={Truck} title="Relatório Geral de Veículos" description="Listagem completa da frota com filtros por tipo, grupo e localização." />

            <FilterSection>
                <select value={filters.group} onChange={e => setFilters({...filters, group: e.target.value})} className="input-field">
                    <option value="">Todos os Tipos</option>
                    {vehicleGroupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    <option value="Outros">Outros</option>
                </select>
                <SearchableSelect
                    items={vehicleTypes.map(t => ({ id: t, label: t }))}
                    value={filters.type}
                    onChange={(item) => setFilters({...filters, type: item?.id || ''})}
                    getLabel={(t) => t.label}
                    placeholder="Todos os Grupos"
                />
                <SearchableObraSelect
                    obras={obras}
                    value={filters.obraId}
                    onChange={(obra) => setFilters({...filters, obraId: obra?.id || ''})}
                    placeholder="Todas as Obras"
                    includeInactive={true}
                />
                <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="input-field">
                    <option value="">Todos os Status</option>
                    {[...new Set(vehicles.map(v => v.status))].filter(Boolean).sort().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </FilterSection>

            <div className="mb-4 p-4 bg-white border rounded-lg">
                <h4 className="font-semibold text-sm mb-3">Colunas Visíveis</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                    {allColumns.map(col => (
                        <label key={col.key} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input 
                                type="checkbox" 
                                checked={selectedColumns.includes(col.key)} 
                                onChange={() => setSelectedColumns(p => p.includes(col.key) ? p.filter(c => c !== col.key) : [...p, col.key])} 
                                className="rounded text-red-600 focus:ring-red-500"
                            />
                            {col.label}
                        </label>
                    ))}
                </div>
            </div>

            <div className="border rounded-lg max-h-80 overflow-y-auto mb-4 custom-scrollbar bg-white">
                <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 sticky top-0 z-10 uppercase text-gray-600 font-bold">
                        <tr>
                            <th className="p-3 w-10 text-center"><input type="checkbox" checked={selectAll} onChange={handleSelectAll} className="rounded text-red-600 focus:ring-red-500"/></th>
                            <th className="p-3">Registro</th>
                            <th className="p-3">Placa</th>
                            <th className="p-3">Grupo</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Local Atual</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredVehicles.map(v => (
                            <tr key={v.id} className={`hover:bg-red-50 ${selectedVehicleIds.includes(v.id) ? 'bg-red-50' : ''}`}>
                                <td className="p-3 text-center"><input type="checkbox" checked={selectedVehicleIds.includes(v.id)} onChange={() => setSelectedVehicleIds(prev => prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id])} className="rounded text-red-600 focus:ring-red-500"/></td>
                                <td className="p-3 font-bold text-gray-700">{v.registroInterno}</td>
                                <td className="p-3">{v.placa}</td>
                                <td className="p-3">{v.tipo}</td>
                                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${v.status === 'Disponível' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{v.status}</span></td>
                                <td className="p-3 text-gray-500 truncate max-w-[150px]">{v.obraAtual}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button onClick={handleGeneratePDF} disabled={selectedVehicleIds.length === 0} className="btn-primary w-full md:w-auto flex items-center justify-center gap-2">
                <Printer size={18}/> Gerar PDF ({selectedVehicleIds.length})
            </button>
        </div>
    );
};

export default VehicleReport;