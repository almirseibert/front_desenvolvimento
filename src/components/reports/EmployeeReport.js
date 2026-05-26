import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Users, Printer } from 'lucide-react';
import { SectionHeader, FilterSection } from './ReportComponents';

const EmployeeReport = ({ employees = [], obras = [], vehicles = [], fines = [] }) => {
    // Filtros
    const [filters, setFilters] = useState({ 
        cidade: '', 
        funcao: '', 
        status: 'ativo', 
        allocationStatus: 'todos', 
        obraId: '',
        startDate: '',
        endDate: ''
    });

    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    
    // Configuração de Colunas - Adicionadas as novas colunas por padrão
    const [selectedColumns, setSelectedColumns] = useState(['nome', 'funcao', 'allocationStatus', 'cidade', 'status', 'contato', 'obraAtual', 'historySummary']);

    // ADICIONADO: Novas colunas mapeadas
    const allColumns = useMemo(() => [
        { key: 'nome', label: 'Nome' },
        { key: 'vulgo', label: 'Apelido' },
        { key: 'funcao', label: 'Função' },
        { key: 'status', label: 'Status Cadastro' }, 
        { key: 'allocationStatus', label: 'Situação Atual' },
        { key: 'cidade', label: 'Cidade' }, 
        { key: 'contato', label: 'Telefone' },
        { key: 'cnhCategoria', label: 'Cat. CNH' }, // Nova
        { key: 'cnhVencimento', label: 'Venc. CNH' }, // Nova
        { key: 'toxicologicoVencimento', label: 'Venc. Toxicológico' }, // Nova
        { key: 'obraAtual', label: 'Obra Atual' },
        { key: 'veiculosAlocados', label: 'Veículos Alocados' },
        { key: 'multasPendentes', label: 'Multas Pendentes' },
        { key: 'dataDesalocamento', label: 'Última Saída' },
        { key: 'diasDisponivel', label: 'Dias Disponível' },
        { key: 'historySummary', label: 'Histórico no Período' } 
    ], []);

    // Função universal de ordenação Alfanumérica
    const sortAlphaNum = (a, b) => (a || '').toString().localeCompare((b || '').toString(), undefined, { numeric: true, sensitivity: 'base' });

    // 1. Mapear Alocações ATUAIS
    const currentAllocations = useMemo(() => {
        const allocations = new Map();
        obras.forEach(obra => {
            (Array.isArray(obra.historicoVeiculos) ? obra.historicoVeiculos : []).forEach(history => {
                if (history.employeeId && !history.dataSaida) { 
                    const vehicle = vehicles.find(v => v.id === history.veiculoId);
                    if (!allocations.has(history.employeeId)) allocations.set(history.employeeId, { obraId: obra.id, obraNome: obra.nome, vehicleRegistros: [] });
                    if (vehicle) allocations.get(history.employeeId).vehicleRegistros.push(vehicle.registroInterno || 'N/A');
                }
            });
        });
        return allocations;
    }, [obras, vehicles]);

    // 2. Processar Dados e Histórico
    const processedEmployees = useMemo(() => {
        const now = new Date();
        now.setHours(0,0,0,0);

        const startFilter = filters.startDate ? new Date(filters.startDate) : null;
        const endFilter = filters.endDate ? new Date(filters.endDate) : null;
        if (endFilter) endFilter.setHours(23, 59, 59);

        return employees.map(e => {
            const alloc = currentAllocations.get(e.id);
            const isAllocated = !!alloc;
            let statusAlocacao = e.status === 'inativo' ? 'Inativo' : (isAllocated ? 'Alocado' : 'Disponível');
            
            let dataDesalocamento = null;
            let diasDisponivel = null;
            let lastExitDate = null;

            obras.forEach(obra => {
                const historico = obra.historicoVeiculos || [];
                historico.forEach(h => {
                    if (h.employeeId === e.id && h.dataSaida) {
                        const saida = new Date(h.dataSaida);
                        if (!isNaN(saida.getTime())) {
                            if (!lastExitDate || saida > lastExitDate) lastExitDate = saida;
                        }
                    }
                });
            });

            if (statusAlocacao === 'Disponível') {
                if (lastExitDate) {
                    dataDesalocamento = lastExitDate.toLocaleDateString('pt-BR');
                    const diffTime = Math.abs(now - lastExitDate);
                    diasDisponivel = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                } else {
                    dataDesalocamento = '-';
                    diasDisponivel = '-';
                }
            } else {
                dataDesalocamento = 'Em Atividade';
                diasDisponivel = 0;
            }

            let historyLogs = [];
            if (startFilter && endFilter) {
                obras.forEach(obra => {
                    const historico = obra.historicoVeiculos || [];
                    historico.forEach(h => {
                        if (h.employeeId === e.id) {
                            const hStart = new Date(h.dataEntrada);
                            const hEnd = h.dataSaida ? new Date(h.dataSaida) : new Date();
                            
                            if (hStart <= endFilter && hEnd >= startFilter) {
                                const startStr = hStart.toLocaleDateString('pt-BR');
                                const endStr = h.dataSaida ? new Date(h.dataSaida).toLocaleDateString('pt-BR') : 'Atual';
                                historyLogs.push(`Obra: ${obra.nome}\nPeríodo: ${startStr} a ${endStr}`);
                            }
                        }
                    });
                });
            }
            
            const historySummary = historyLogs.length > 0 
                ? historyLogs.join('\n----------------\n') 
                : (startFilter && endFilter ? 'Sem registros.' : 'Selecione datas.');

            return {
                ...e,
                allocationStatus: statusAlocacao,
                obraAtual: alloc?.obraNome || 'N/A',
                isAllocated,
                dataDesalocamento,
                diasDisponivel,
                veiculosAlocados: alloc ? alloc.vehicleRegistros.join(', ') : '',
                historySummary 
            };
        });
    }, [employees, currentAllocations, obras, filters.startDate, filters.endDate, vehicles]);

    // 3. Filtragem Final e Ordenação Alfanumérica
    const filteredEmployees = useMemo(() => {
        return processedEmployees
            .filter(e => {
                const matchCidade = filters.cidade ? (e.cidade || '').toLowerCase() === filters.cidade.toLowerCase() : true;
                const matchFuncao = filters.funcao ? e.funcao === filters.funcao : true;
                const matchStatusCadastro = filters.status ? e.status === filters.status : true;
                const matchObra = filters.obraId 
                    ? (currentAllocations.get(e.id)?.obraId === filters.obraId || (filters.obraId === 'N/A' && !currentAllocations.has(e.id))) 
                    : true;

                let matchAllocStatus = true;
                if (filters.allocationStatus === 'alocado') matchAllocStatus = e.isAllocated;
                if (filters.allocationStatus === 'disponivel') matchAllocStatus = !e.isAllocated;

                return matchCidade && matchFuncao && matchStatusCadastro && matchObra && matchAllocStatus;
            })
            .sort((a, b) => sortAlphaNum(a.nome, b.nome));
    }, [processedEmployees, filters, currentAllocations]);

    useEffect(() => {
        setSelectAll(filteredEmployees.length > 0 && selectedEmployeeIds.length === filteredEmployees.length);
    }, [selectedEmployeeIds, filteredEmployees]);

    const handleGeneratePDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(18); 
        doc.text('Relatório de Funcionários - Frota MAK', 14, 22);
        doc.setFontSize(10);
        
        let subTitle = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
        if (filters.startDate && filters.endDate) {
            subTitle += ` | Período: ${new Date(filters.startDate).toLocaleDateString('pt-BR')} a ${new Date(filters.endDate).toLocaleDateString('pt-BR')}`;
        }
        if (filters.status) subTitle += ` | Status: ${filters.status.toUpperCase()}`;
        if (filters.cidade) subTitle += ` | Cidade: ${filters.cidade}`;
        
        doc.text(subTitle, 14, 28);
        
        const headers = selectedColumns.map(c => allColumns.find(col => col.key === c)?.label || c);
        
        const body = filteredEmployees.filter(e => selectedEmployeeIds.includes(e.id)).map(emp => {
            const cnhVenc = emp.cnhVencimento ? new Date(emp.cnhVencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
            const toxVenc = emp.toxicologicoVencimento ? new Date(emp.toxicologicoVencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
            const multas = fines.filter(f => f.employeeId === emp.id && f.status === 'Pendente').length;
            
            const data = { 
                ...emp, 
                cnhCategoria: emp.cnhCategoria || '-',
                cnhVencimento: cnhVenc,
                toxicologicoVencimento: toxVenc,
                multasPendentes: multas,
                dataDesalocamento: emp.dataDesalocamento,
                diasDisponivel: emp.diasDisponivel !== '-' ? `${emp.diasDisponivel} dias` : '-',
                historySummary: emp.historySummary,
                status: (emp.status || 'Ativo').toUpperCase(),
                cidade: emp.cidade || 'N/A'
            };
            return selectedColumns.map(col => data[col] || '');
        });

        autoTable(doc, { 
            startY: 35, 
            head: [headers], 
            body, 
            theme: 'striped', 
            headStyles: { fillColor: [34, 139, 34] }, 
            styles: { fontSize: 8, cellWidth: 'wrap', valign: 'middle' },
            columnStyles: {
                [selectedColumns.indexOf('historySummary')]: { cellWidth: 70, fontSize: 7 } 
            }
        });
        doc.save('Relatorio_Funcionarios.pdf');
    };

    return (
        <div className="animate-fade-in">
            <SectionHeader icon={Users} title="Relatório de Funcionários" description="Gestão de quadro, alocações e histórico detalhado." />
            
            <FilterSection>
                <div className="col-span-1 md:col-span-2 flex gap-2 border-r pr-4 border-gray-200">
                    <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Histórico De:</label>
                        <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="input-field" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Histórico Até:</label>
                        <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="input-field" />
                    </div>
                </div>

                <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="input-field">
                    <option value="ativo">Cadastro: Ativos</option>
                    <option value="inativo">Cadastro: Inativos</option>
                    <option value="">Cadastro: Todos</option>
                </select>

                <select value={filters.cidade} onChange={e => setFilters({...filters, cidade: e.target.value})} className="input-field">
                    <option value="">Todas as Cidades</option>
                    {[...new Set(employees.map(e => e.cidade).filter(Boolean))].sort(sortAlphaNum).map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select value={filters.allocationStatus} onChange={e => setFilters({...filters, allocationStatus: e.target.value})} className="input-field bg-yellow-50 border-yellow-200 text-yellow-800 font-medium">
                    <option value="todos">Situação: Todos</option>
                    <option value="alocado">Apenas Alocados</option>
                    <option value="disponivel">Apenas Disponíveis</option>
                </select>

                <select value={filters.funcao} onChange={e => setFilters({...filters, funcao: e.target.value})} className="input-field">
                    <option value="">Todas as Funções</option>
                    {[...new Set(employees.map(e => e.funcao).filter(Boolean))].sort(sortAlphaNum).map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                
                <select value={filters.obraId} onChange={e => setFilters({...filters, obraId: e.target.value})} className="input-field">
                    <option value="">Todas as Obras (Alocação)</option>
                    <option value="N/A">Sem Alocação</option>
                    {obras.filter(o => o.status === 'ativa').sort((a,b) => sortAlphaNum(a.nome, b.nome)).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
            </FilterSection>

            <div className="mb-4 bg-white p-3 rounded border">
                <span className="text-xs font-bold text-gray-500 uppercase mb-2 block">Colunas Visíveis (PDF)</span>
                <div className="flex flex-wrap gap-2">
                    {allColumns.map(col => (
                        <button 
                            key={col.key} 
                            onClick={() => setSelectedColumns(p => p.includes(col.key) ? p.filter(c => c !== col.key) : [...p, col.key])}
                            className={`px-2 py-1 text-xs rounded border transition ${selectedColumns.includes(col.key) ? 'bg-green-100 border-green-300 text-green-800 font-semibold' : 'bg-gray-50 text-gray-600'}`}
                        >
                            {col.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="border rounded-lg max-h-80 overflow-y-auto mb-4 bg-white custom-scrollbar">
                <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 sticky top-0 uppercase text-gray-600 font-bold z-10">
                        <tr>
                            <th className="p-3 w-10 text-center"><input type="checkbox" checked={selectAll} onChange={e => {setSelectAll(e.target.checked); setSelectedEmployeeIds(e.target.checked ? filteredEmployees.map(x=>x.id) : [])}} className="rounded text-green-600 focus:ring-green-500"/></th>
                            <th className="p-3">Nome</th>
                            <th className="p-3">Função</th>
                            <th className="p-3">Obra Atual</th>
                            <th className="p-3">Cadastro</th>
                            <th className="p-3">Cidade</th>
                            {selectedColumns.includes('historySummary') && <th className="p-3">Histórico</th>}
                            {/* Renderiza as colunas selecionadas dinamicamente na UI para validação visual */}
                            {selectedColumns.includes('cnhCategoria') && <th className="p-3">Cat. CNH</th>}
                            {selectedColumns.includes('cnhVencimento') && <th className="p-3">Venc. CNH</th>}
                            {selectedColumns.includes('toxicologicoVencimento') && <th className="p-3">Venc. Toxicológico</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredEmployees.map(e => (
                            <tr key={e.id} className={`hover:bg-green-50 ${selectedEmployeeIds.includes(e.id) ? 'bg-green-50' : ''}`}>
                                <td className="p-3 text-center"><input type="checkbox" checked={selectedEmployeeIds.includes(e.id)} onChange={() => setSelectedEmployeeIds(p => p.includes(e.id) ? p.filter(x=>x!==e.id) : [...p, e.id])} className="rounded text-green-600 focus:ring-green-500"/></td>
                                <td className="p-3 font-medium">{e.nome}</td>
                                <td className="p-3">{e.funcao}</td>
                                <td className="p-3 truncate max-w-[150px]">{e.obraAtual}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${e.status === 'ativo' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {e.status}
                                    </span>
                                </td>
                                <td className="p-3">{e.cidade}</td>
                                {selectedColumns.includes('historySummary') && (
                                    <td className="p-3 whitespace-pre-wrap text-gray-600 bg-gray-50 border-l text-[10px]">{e.historySummary}</td>
                                )}
                                {selectedColumns.includes('cnhCategoria') && <td className="p-3 font-bold">{e.cnhCategoria || '-'}</td>}
                                {selectedColumns.includes('cnhVencimento') && <td className="p-3">{e.cnhVencimento ? new Date(e.cnhVencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}</td>}
                                {selectedColumns.includes('toxicologicoVencimento') && <td className="p-3">{e.toxicologicoVencimento ? new Date(e.toxicologicoVencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button onClick={handleGeneratePDF} disabled={selectedEmployeeIds.length === 0} className="btn-primary w-full md:w-auto bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2">
                <Printer size={18}/> Gerar PDF ({selectedEmployeeIds.length})
            </button>
        </div>
    );
};

export default EmployeeReport;