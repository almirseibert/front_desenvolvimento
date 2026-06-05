import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Eye, Edit, Trash2,
    Clock, HardHat, Loader, X, Truck
} from 'lucide-react';
import apiClient from '../services/apiClient';
import SearchableObraSelect from '../components/SearchableObraSelect';
import SearchableSelect from '../components/SearchableSelect';

// --- COMPONENTES AUXILIARES ---

// Função para formatar a duração (mantida)
const formatDuration = (milliseconds) => {
    if (isNaN(milliseconds) || milliseconds < 0) return '0h 0m';
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
};

// Modal de Detalhes (ajustado para usar new Date())
const LogDetailModal = ({ log, onClose }) => {
    if (!log) return null;
    // Converte datas string da API para Date objects
    const logDate = new Date(log.logDate);
    const startTime = new Date(log.startTime);
    const endTime = log.endTime ? new Date(log.endTime) : null;
    const breaks = (log.breaks || []).map(b => ({
        start: new Date(b.start),
        end: new Date(b.end)
    }));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold">Detalhes do Registro</h3>
                        <p className="text-sm text-gray-500">{new Date(log.logDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - {log.employeeName}</p>
                    </div>
                     <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-3 text-sm max-h-[60vh] overflow-y-auto">
                    <p><strong>Veículo:</strong> {log.vehicleName}</p>
                    <p><strong>Obra:</strong> {log.obraName}</p>
                    <p><strong>Início da Jornada:</strong> {startTime.toLocaleTimeString('pt-BR')}</p>
                    <p><strong>Fim da Jornada:</strong> {endTime ? endTime.toLocaleTimeString('pt-BR') : 'Em Aberto'}</p>
                    {/* Leituras Iniciais */}
                    <div>
                        <strong>Leituras Iniciais:</strong>
                        <ul className="list-disc pl-5 mt-1 text-xs">
                            {log.startReadings?.odometro != null && <li>Odômetro: {log.startReadings.odometro}</li>}
                            {log.startReadings?.horimetro != null && <li>Horímetro: {log.startReadings.horimetro}</li>}
                        </ul>
                    </div>
                     {/* Leituras Finais */}
                     {log.endReadings && (
                        <div>
                            <strong>Leituras Finais:</strong>
                            <ul className="list-disc pl-5 mt-1 text-xs">
                                {log.endReadings?.odometro != null && <li>Odômetro: {log.endReadings.odometro}</li>}
                                {log.endReadings?.horimetro != null && <li>Horímetro: {log.endReadings.horimetro}</li>}
                            </ul>
                        </div>
                     )}
                    {/* Intervalos */}
                    {breaks.length > 0 && (
                        <div>
                            <strong>Intervalos:</strong>
                            <ul className="list-disc pl-5 mt-1 text-xs">
                                {breaks.map((b, index) => (
                                    <li key={index}>
                                        {b.start.toLocaleTimeString('pt-BR')} - {b.end.toLocaleTimeString('pt-BR')} ({formatDuration(b.end.getTime() - b.start.getTime())})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* Observações */}
                    {log.notes && <p><strong>Observações:</strong> <span className="italic">"{log.notes}"</span></p>}
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Fechar</button>
                </div>
            </div>
        </div>
    );
};

// Modal de Edição (ATUALIZADO para receber fetchLogs)
const LogEditModal = ({
    log, vehicle, vehicleGroups, onClose,
    apiClient, setAlertMessage, PasswordConfirmationModal,
    fetchLogs // <-- Prop para recarregar dados
}) => {
    // Estado inicial preenchido com dados do log
    const [formData, setFormData] = useState({
        startReadings: log.startReadings || {},
        endReadings: log.endReadings || {},
        notes: log.notes || ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false); // Para confirmar edição

    // Determina o grupo do veículo (mantido)
    const vehicleGroup = useMemo(() => {
        if (!vehicle) return null;
        return Object.keys(vehicleGroups).find(g => vehicleGroups[g].includes(vehicle.tipo));
    }, [vehicle, vehicleGroups]);

    // Handler para mudanças nos inputs (mantido)
    const handleChange = (e) => {
        const { name, value, dataset } = e.target;
        const { type, field } = dataset; // type: 'startReadings' or 'endReadings', field: 'odometro', etc.

        if (type) {
            // Atualiza leituras dentro de startReadings ou endReadings
            setFormData(prev => ({
                ...prev,
                [type]: {
                    ...prev[type],
                    // Converte para número ou mantém 0
                    [field]: parseFloat(value) || 0
                }
            }));
        } else {
            // Atualiza outros campos (ex: notes)
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Abre o modal de senha para confirmar
    const handleConfirmEdit = (e) => {
        e.preventDefault();
        // Adicionar validação aqui se necessário (ex: leituras finais >= iniciais)
        setShowPasswordModal(true);
    };

    // Função que salva após confirmação de senha
    const handleSave = async () => {
        setIsSaving(true);
        // Prepara os dados para enviar à API (apenas os campos editáveis)
        const dataToUpdate = {
            startReadings: formData.startReadings,
            endReadings: formData.endReadings,
            notes: formData.notes
        };

        try {
            // Chama a API para atualizar o log
            await apiClient.updateDiarioDeBordo(log.id, dataToUpdate);
            setAlertMessage("Registro atualizado com sucesso!");
            setShowPasswordModal(false); // Fecha modal de senha
            onClose(); // Fecha modal de edição
            fetchLogs(); // <-- RECARREGA OS DADOS DA PÁGINA
        } catch (error) {
            console.error("Erro ao atualizar registro via API:", error);
            setAlertMessage(error.message || "Falha ao atualizar o registro.");
            // Mantém modal de senha aberto
        } finally {
            setIsSaving(false);
        }
    };

    // Função para renderizar campos de leitura (mantida e simplificada)
    const renderReadingFields = (type) => {
        const readings = formData[type] || {};
        return (
            <div className="space-y-2 p-3 bg-gray-50 rounded border">
                <h4 className="font-semibold text-gray-700">{type === 'startReadings' ? 'Leituras Iniciais' : 'Leituras Finais'}</h4>
                {/* Odômetro */}
                {(vehicleGroup === 'Veículos Leves' || vehicleGroup === 'Caminhões') && (
                    <div><label className="text-xs font-medium text-gray-600">Odômetro (Km)</label><input type="number" step="0.1" data-type={type} data-field="odometro" value={readings.odometro ?? ''} onChange={handleChange} className="w-full p-1 border rounded bg-white"/></div>
                )}
                {/* Horímetro (Caminhões e Máquinas Pesadas) */}
                {(vehicleGroup === 'Caminhões' || vehicleGroup === 'Máquinas Pesadas') && (
                    <div><label className="text-xs font-medium text-gray-600">Horímetro (Hr)</label><input type="number" step="0.1" data-type={type} data-field="horimetro" value={readings.horimetro ?? ''} onChange={handleChange} className="w-full p-1 border rounded bg-white"/></div>
                )}
            </div>
        );
    };

    // Renderização do modal de edição
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                 {/* Cabeçalho */}
                <div className="p-6 border-b flex justify-between items-center">
                     <h3 className="text-xl font-bold">Editar Registro</h3>
                     <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={20}/></button>
                </div>
                {/* Formulário */}
                <form onSubmit={handleConfirmEdit}>
                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {/* Grid para leituras */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderReadingFields('startReadings')}
                            {renderReadingFields('endReadings')}
                        </div>
                        {/* Campo de Observações */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Observações</label>
                            <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className="mt-1 w-full p-2 border rounded-md bg-gray-50 focus:ring-yellow-500 focus:border-yellow-500"/>
                        </div>
                    </div>
                    {/* Rodapé com botões */}
                    <div className="p-4 bg-gray-50 border-t flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Cancelar</button>
                        {/* Botão de salvar abre o modal de senha */}
                        <button type="submit" disabled={isSaving} className="px-4 py-2 mak-btn mak-btn-primary">
                             {isSaving ? <><Loader size={16} className="animate-spin" /> Salvando...</> : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
                 {/* Modal de Confirmação de Senha */}
                 {showPasswordModal &&
                     <PasswordConfirmationModal
                         message="Confirme sua senha para salvar as alterações neste registro."
                         onConfirm={handleSave}
                         onClose={() => setShowPasswordModal(false)}
                         apiClient={apiClient} // Passa apiClient
                     />
                 }
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL (ATUALIZADO) ---
const ControleDiarioPage = ({
    apiClient, // Recebe apiClient
    obras, vehicles, vehicleGroups, employees,
    PasswordConfirmationModal, // Recebe o componente global
    setAlertMessage
}) => {
    const [logs, setLogs] = useState([]); // Estado para logs carregados da API
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados dos modais (mantidos)
    const [detailModalLog, setDetailModalLog] = useState(null);
    const [deleteModalLogId, setDeleteModalLogId] = useState(null);
    const [editModalLog, setEditModalLog] = useState(null); // Guarda { log, vehicle }

    // Estados dos filtros (mantidos)
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(1); // Primeiro dia do mês atual
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); // Dia atual
    const [filterType, setFilterType] = useState('geral');
    const [selectedObraId, setSelectedObraId] = useState('');
    const [selectedVehicleType, setSelectedVehicleType] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

    // Memoização de listas ordenadas (mantida)
    const sortedObras = useMemo(() => (obras || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')), [obras]);
    const sortedEmployees = useMemo(() => (employees || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')), [employees]);
    const vehicleTypes = useMemo(() => {
        if (!vehicleGroups) return [];
        const allTypes = Object.values(vehicleGroups).flat();
        return [...new Set(allTypes)].sort();
    }, [vehicleGroups]);

    // Efeito para buscar logs da API com base nas datas (AGORA EM useCallback)
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Chama apiClient para buscar logs fechados no período
            // Adiciona queryParams para passar as datas e o status para a API
            const queryParams = new URLSearchParams({
                startDate,
                endDate,
                status: 'Fechado'
            }).toString();

            // Ajuste para garantir que a URL seja construída corretamente
            const fetchedLogs = await apiClient.getDiarioDeBordo(`?${queryParams}`);

            setLogs(fetchedLogs || []); // Garante que seja um array
        } catch (err) {
            console.error("Erro ao buscar logs do diário via API:", err);
            setError(err.message || "Falha ao carregar os dados. Verifique sua conexão ou permissões.");
            setLogs([]); // Limpa logs em caso de erro
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, apiClient]); // Depende das datas e do apiClient

    // Efeito que chama a busca (agora depende do fetchLogs)
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Filtra os logs localmente com base nos filtros da UI (mantido)
    const filteredLogs = useMemo(() => {
        if (!Array.isArray(logs)) return [];
        return logs.filter(log => {
            // Filtro por Obra
            if (filterType === 'obra' && selectedObraId && log.obraId !== selectedObraId) {
                return false;
            }
            // Filtro por Tipo de Veículo
            if (filterType === 'vehicleType' && selectedVehicleType) {
                const vehicle = vehicles.find(v => v.id === log.vehicleId);
                if (!vehicle || vehicle.tipo !== selectedVehicleType) return false;
            }
            // Filtro por Funcionário
            if (filterType === 'employee' && selectedEmployeeId && log.employeeId !== selectedEmployeeId) {
                return false;
            }
            // Se passou por todos os filtros ou é 'geral'
            return true;
        });
    }, [logs, filterType, selectedObraId, selectedVehicleType, selectedEmployeeId, vehicles]);

    // Calcula os resumos (ATUALIZADO para usar new Date())
    const summaryData = useMemo(() => {
        let totalJornadaMs = 0;
        let totalHorasMaquina = 0;
        let totalKm = 0; // Adicionado para Km

        filteredLogs.forEach(log => {
            const startTime = new Date(log.startTime);
            const endTime = log.endTime ? new Date(log.endTime) : null;

            // Calcula duração da jornada
            if (endTime) {
                totalJornadaMs += endTime.getTime() - startTime.getTime();
                 // Desconta pausas
                 (log.breaks || []).forEach(b => {
                     totalJornadaMs -= (new Date(b.end).getTime() - new Date(b.start).getTime());
                 });
            }

            // Calcula horas/km
            if (log.endReadings && log.startReadings) {
                const vehicle = vehicles.find(v => v.id === log.vehicleId);
                const vehicleGroup = vehicle ? Object.keys(vehicleGroups).find(g => vehicleGroups[g].includes(vehicle.tipo)) : null;

                const startOdo = parseFloat(log.startReadings.odometro || 0);
                const endOdo = parseFloat(log.endReadings.odometro || 0);
                const startHor = parseFloat(log.startReadings.horimetro || 0);
                const endHor = parseFloat(log.endReadings.horimetro || 0);

                if (vehicleGroup === 'Veículos Leves') {
                    if (endOdo >= startOdo) totalKm += (endOdo - startOdo);
                } else if (vehicleGroup === 'Caminhões') {
                    if (endOdo >= startOdo) totalKm += (endOdo - startOdo);
                    if (endHor >= startHor) totalHorasMaquina += (endHor - startHor);
                } else if (vehicleGroup === 'Máquinas Pesadas') {
                    if (endHor >= startHor) totalHorasMaquina += (endHor - startHor);
                }
            }
        });

        return {
            totalJornada: formatDuration(totalJornadaMs),
            totalHorasMaquina: totalHorasMaquina.toFixed(1), // 1 casa decimal para horas
            totalKm: totalKm.toFixed(1), // 1 casa decimal para Km
        };
    }, [filteredLogs, vehicles, vehicleGroups]);

    // Função para deletar (ATUALIZADA para chamar fetchLogs)
    const handleDeleteConfirm = async () => {
        if (!deleteModalLogId) return;
        try {
            // Chama a API para deletar o log
            await apiClient.deleteDiarioDeBordo(deleteModalLogId);
            setAlertMessage("Registro excluído com sucesso!");
            fetchLogs(); // <-- RECARREGA OS DADOS DA PÁGINA
        } catch (error) {
            console.error("Erro ao excluir registro via API:", error);
            setAlertMessage(error.message || "Falha ao excluir o registro.");
        } finally {
            setDeleteModalLogId(null); // Fecha o modal de senha
        }
    };

    // Renderização Principal (ajustes nos cálculos de exibição)
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 font-sans">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">Análise de Diário de Bordo</h1>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-lg shadow-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end text-sm">
                {/* Inputs de Data */}
                <div>
                    <label className="block font-medium text-gray-700">Data Início</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-white"/>
                </div>
                <div>
                    <label className="block font-medium text-gray-700">Data Fim</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-white"/>
                </div>
                {/* Select de Tipo de Filtro */}
                <div>
                    <label className="block font-medium text-gray-700">Filtrar por</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-white">
                        <option value="geral">Geral</option>
                        <option value="obra">Obra</option>
                        <option value="vehicleType">Grupo de Veículo</option>
                        <option value="employee">Funcionário</option>
                    </select>
                </div>
                {/* Select Condicional */}
                <div className="min-h-[42px]">
                    {filterType === 'obra' && (
                        <SearchableObraSelect
                            obras={sortedObras}
                            value={selectedObraId}
                            onChange={(obra) => setSelectedObraId(obra?.id || '')}
                            placeholder="Buscar obra..."
                        />
                    )}
                    {filterType === 'vehicleType' && (
                        <SearchableSelect
                            items={vehicleTypes.map(t => ({ id: t, label: t }))}
                            value={selectedVehicleType}
                            onChange={(item) => setSelectedVehicleType(item?.id || '')}
                            getLabel={(t) => t.label}
                            placeholder="Selecione um Tipo"
                        />
                    )}
                     {filterType === 'employee' && (
                        <SearchableSelect
                            items={sortedEmployees}
                            value={selectedEmployeeId}
                            onChange={(item) => setSelectedEmployeeId(item?.id || '')}
                            getLabel={(e) => e.nome}
                            getSubLabel={(e) => e.profissao || ''}
                            placeholder="Selecione um Funcionário"
                        />
                    )}
                </div>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Jornada */}
                <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-4 border-l-4 border-blue-500">
                    <div className="p-3 rounded-full bg-blue-100 text-blue-600"><Clock size={32}/></div>
                    <div>
                        <p className="text-3xl md:text-4xl font-bold text-gray-800">{summaryData.totalJornada}</p>
                        <p className="text-sm font-medium text-gray-500">Total de Horas de Jornada</p>
                    </div>
                </div>
                 {/* Total Horas Máquina */}
                <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-4 border-l-4 border-green-500">
                    <div className="p-3 rounded-full bg-green-100 text-green-600"><HardHat size={32}/></div>
                    <div>
                        <p className="text-3xl md:text-4xl font-bold text-gray-800">{summaryData.totalHorasMaquina} <span className="text-xl">hrs</span></p>
                        <p className="text-sm font-medium text-gray-500">Total de Horas Máquina</p>
                    </div>
                </div>
                 {/* Total KM Rodado */}
                 <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-4 border-l-4 border-yellow-500">
                    <div className="p-3 rounded-full bg-yellow-100 text-yellow-600"><Truck size={32}/></div>
                    <div>
                        <p className="text-3xl md:text-4xl font-bold text-gray-800">{summaryData.totalKm} <span className="text-xl">km</span></p>
                        <p className="text-sm font-medium text-gray-500">Total KM Rodados</p>
                    </div>
                </div>
            </div>

            {/* Tabela de Registros */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden " style={{ border: "1px solid #f0ebe3" }}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-700">Registros Detalhados</h2>
                    {/* Adicionar botão de exportar CSV aqui se necessário */}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 min-w-[768px]">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">Funcionário</th>
                                <th className="px-6 py-3">Veículo</th>
                                <th className="px-6 py-3">Data</th>
                                <th className="px-6 py-3 text-center">Jornada Líquida</th>
                                <th className="px-6 py-3 text-center">Horas/KM</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center p-6"><Loader className="animate-spin inline mr-2 text-gray-500"/> Carregando...</td></tr>
                            ) : error ? (
                                <tr><td colSpan="6" className="text-center p-6 text-red-600 font-medium">{error}</td></tr>
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map(log => {
                                    // Recalcula durações e horas/km para exibição
                                    const startTime = new Date(log.startTime);
                                    const endTime = log.endTime ? new Date(log.endTime) : null;
                                    let jornadaMs = endTime ? endTime.getTime() - startTime.getTime() : 0;
                                     (log.breaks || []).forEach(b => {
                                         jornadaMs -= (new Date(b.end).getTime() - new Date(b.start).getTime());
                                     });

                                    const vehicle = vehicles.find(v => v.id === log.vehicleId);
                                    const vehicleGroup = vehicle ? Object.keys(vehicleGroups).find(g => vehicleGroups[g].includes(vehicle.tipo)) : null;
                                    let horasKm = 0;
                                    let unit = '';

                                     if (log.endReadings && log.startReadings) {
                                         const startOdo = parseFloat(log.startReadings.odometro || 0);
                                         const endOdo = parseFloat(log.endReadings.odometro || 0);
                                         const startHor = parseFloat(log.startReadings.horimetro || 0);
                                         const endHor = parseFloat(log.endReadings.horimetro || 0);

                                         if (vehicleGroup === 'Veículos Leves') {
                                             if (endOdo >= startOdo) { horasKm = (endOdo - startOdo); unit = 'km'; }
                                         } else if (vehicleGroup === 'Caminhões') {
                                             if (endHor >= startHor) { horasKm = (endHor - startHor); unit = 'hrs'; }
                                             else if (endOdo >= startOdo) { horasKm = (endOdo - startOdo); unit = 'km'; }
                                         } else if (vehicleGroup === 'Máquinas Pesadas') {
                                             if (endHor >= startHor) { horasKm = (endHor - startHor); unit = 'hrs'; }
                                         }
                                     }

                                    return (
                                        <tr key={log.id} className="bg-white border-b hover:bg-gray-50 transition-colors duration-150">
                                            <td className="px-6 py-4 font-medium text-gray-900">{log.employeeName || 'N/A'}</td>
                                            <td className="px-6 py-4">{log.vehicleName || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">{new Date(log.logDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                            <td className="px-6 py-4 text-center">{formatDuration(jornadaMs)}</td>
                                            <td className="px-6 py-4 text-center font-medium">{horasKm.toFixed(1)} <span className="text-xs">{unit}</span></td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button onClick={() => setDetailModalLog(log)} title="Ver Detalhes" className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full transition"><Eye size={16}/></button>
                                                    <button onClick={() => setEditModalLog({ log, vehicle })} title="Editar" className="p-1 text-gray-400 hover:text-[#9E7A42] hover:bg-[#f5f2ed] rounded-full transition"><Edit size={16}/></button>
                                                    <button onClick={() => setDeleteModalLogId(log.id)} title="Excluir" className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition"><Trash2 size={16}/></button>

                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr><td colSpan="6" className="text-center p-6 text-gray-500">Nenhum registro encontrado para os filtros selecionados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modais */}
            {detailModalLog && <LogDetailModal log={detailModalLog} onClose={() => setDetailModalLog(null)} />}
            {/* Modal de Exclusão agora usa PasswordConfirmationModal */}
            {deleteModalLogId &&
                <PasswordConfirmationModal
                    message="Tem a certeza de que deseja excluir este registro? Esta ação não pode ser desfeita."
                    onConfirm={handleDeleteConfirm}
                    onClose={() => setDeleteModalLogId(null)}
                    apiClient={apiClient} // Passa apiClient
                />}
            {/* Modal de Edição recebe apiClient E fetchLogs */}
            {editModalLog &&
                <LogEditModal
                    log={editModalLog.log}
                    vehicle={editModalLog.vehicle}
                    vehicleGroups={vehicleGroups}
                    apiClient={apiClient} // Passa apiClient
                    setAlertMessage={setAlertMessage}
                    onClose={() => setEditModalLog(null)}
                    PasswordConfirmationModal={PasswordConfirmationModal} // Passa o componente global
                    fetchLogs={fetchLogs} // <-- Passa a função de recarregar
                />}
        </div>
    );
};

export default ControleDiarioPage;



