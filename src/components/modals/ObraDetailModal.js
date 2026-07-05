import React, { useState, useMemo, useEffect } from 'react';
import { X, Loader, Edit, BarChart3, Truck, Calendar, MapPin, AlertTriangle, Clock, RefreshCw, User, ClipboardList, Trash2, CornerDownRight } from 'lucide-react';
import ProtectedComponent from '../ProtectedComponent';
import SearchableSelect from '../SearchableSelect';
import { formatObraNome } from '../../utils/obraFormat';

// --- COMPONENTES AUXILIARES INTERNOS ---

const ProgressBar = ({ value, max, color = 'bg-yellow-400', label }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const displayValue = isFinite(value) ? value.toFixed(1) : '0.0';
    const displayMax = isFinite(max) ? max.toFixed(1) : '0.0';
    
    // Cor dinâmica baseada no status se nenhuma cor for forçada
    let finalColor = color;
    if (color === 'dynamic') {
        finalColor = 'bg-blue-600';
        if (percentage >= 30) finalColor = 'bg-yellow-500';
        if (percentage >= 70) finalColor = 'bg-violet-500';
        if (percentage >= 100) finalColor = 'bg-red-500';
    }

    return (
         <div className="mb-3">
            <div className="flex justify-between mb-1 text-xs font-medium text-gray-700">
                <span>{label}</span>
                <span>{displayValue} / {displayMax} {label.includes('Km') ? 'Km' : 'h'} ({percentage.toFixed(0)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                <div
                    className={`h-full ${finalColor} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                ></div>
            </div>
        </div>
    );
};

const EditActiveVehicleAssignmentModal = ({ assignment, vehicle, employees = [], onClose, onSave, setAlertMessage }) => {
    const [editedData, setEditedData] = useState({
        dataEntrada: assignment?.dataEntrada ? new Date(assignment.dataEntrada).toISOString().split('T')[0] : '',
        employeeId: assignment?.employeeId || '',
        leituraEntrada: assignment?.horimetroEntrada ?? assignment?.odometroEntrada ?? '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        const leitura = parseFloat(editedData.leituraEntrada);
        if (!editedData.dataEntrada || !editedData.employeeId || isNaN(leitura)) {
             setAlertMessage("Preencha Data, Operador e Leitura Inicial válidos.");
             return;
        }

        setIsSaving(true);
        try {
            await onSave(vehicle.id, assignment.id, editedData);
            onClose();
        } catch (error) {
            // Tratado no pai
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="mak-modal max-w-md">
                 <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">Editar Alocação Ativa</h2>
                     <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200" disabled={isSaving}><X size={20}/></button>
                 </div>
                 <div className="p-6 space-y-4">
                    <p className="text-sm font-medium text-gray-700">{vehicle?.registroInterno} - {vehicle?.modelo}</p>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Início na obra *</label>
                        <input type="date" name="dataEntrada" value={editedData.dataEntrada} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 text-sm" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Operador *</label>
                        <SearchableSelect
                            items={(employees || []).filter(e => e.status === 'ativo' && !e.statusAfastamentoTipo).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))}
                            value={editedData.employeeId}
                            onChange={(item) => handleInputChange({ target: { name: 'employeeId', value: item?.id || '' } })}
                            getLabel={(e) => `${e.nome}${e.funcao ? ` · ${e.funcao}` : ''}`}
                            placeholder="Selecione..."
                            required
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Leitura Inicial (Horímetro/Odômetro) *</label>
                        <input type="number" step="0.1" name="leituraEntrada" value={editedData.leituraEntrada} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 text-sm" required/>
                    </div>
                 </div>
                 <div className="p-4 bg-gray-50 border-t flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium" disabled={isSaving}>Cancelar</button>
                    <button onClick={handleSubmit} disabled={isSaving} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center justify-center gap-2 text-sm">
                        {isSaving ? <><Loader className="animate-spin" size={18}/> Salvando...</> : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EditPastVehicleAssignmentModal = ({ assignment, vehicle, employees = [], onClose, onSave, setAlertMessage }) => {
    const [editedData, setEditedData] = useState({
        dataEntrada: assignment?.dataEntrada ? new Date(assignment.dataEntrada).toISOString().split('T')[0] : '',
        dataSaida: assignment?.dataSaida ? new Date(assignment.dataSaida).toISOString().split('T')[0] : '',
        employeeId: assignment?.employeeId || '',
        leituraEntrada: assignment?.horimetroEntrada ?? assignment?.odometroEntrada ?? '',
        leituraSaida: assignment?.horimetroSaida ?? assignment?.odometroSaida ?? '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        const leituraEnt = parseFloat(editedData.leituraEntrada);
        const leituraSai = parseFloat(editedData.leituraSaida);

        if (!editedData.dataEntrada || !editedData.dataSaida || isNaN(leituraEnt) || isNaN(leituraSai)) {
            setAlertMessage("Preencha todas as datas e leituras válidas.");
            return;
        }
        if (leituraSai < leituraEnt) {
             setAlertMessage("Leitura final não pode ser menor que a inicial.");
             return;
        }
        if (new Date(editedData.dataSaida) < new Date(editedData.dataEntrada)) {
             setAlertMessage("Data final não pode ser anterior à data inicial.");
             return;
        }

        setIsSaving(true);
        try {
            await onSave(vehicle.id, assignment.id, editedData);
            onClose();
        } catch (error) {
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="mak-modal max-w-md">
                 <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">Editar Histórico do Veículo</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200" disabled={isSaving}><X size={20}/></button>
                 </div>
                 <div className="p-6 space-y-4">
                    <p className="text-sm font-medium text-gray-700">{vehicle?.registroInterno} - {vehicle?.modelo}</p>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Início na obra *</label>
                            <input type="date" name="dataEntrada" value={editedData.dataEntrada} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 text-sm" required/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fim na obra *</label>
                            <input type="date" name="dataSaida" value={editedData.dataSaida} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 text-sm" required/>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Operador</label>
                         <select name="employeeId" value={editedData.employeeId} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 text-sm bg-white">
                             <option value="">Selecione...</option>
                             {(employees || []).filter(e => e.status === 'ativo' && !e.statusAfastamentoTipo).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.nome}{emp.funcao ? ` · ${emp.funcao}` : ''}</option>
                             ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Leitura Inicial *</label>
                            <input type="number" step="0.1" name="leituraEntrada" value={editedData.leituraEntrada} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 text-sm" required/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Leitura Final *</label>
                            <input type="number" step="0.1" name="leituraSaida" value={editedData.leituraSaida} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 text-sm" required/>
                        </div>
                    </div>
                 </div>
                 <div className="p-4 bg-gray-50 border-t flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium" disabled={isSaving}>Cancelar</button>
                    <button onClick={handleSubmit} disabled={isSaving} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center justify-center gap-2 text-sm">
                        {isSaving ? <><Loader className="animate-spin" size={18}/> Salvando...</> : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL DO MODAL DE DETALHES ---

const ObraDetailModal = ({ user, obra, vehicles = [], onClose, setAlertMessage, equipmentTypesForHours = [], vehicleGroups = {}, employees = [], apiClient, reloadData }) => {
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'vehicles'
    const [isSaving, setIsSaving] = useState(false);
    
    // ESTADO PARA OS DETALHES COMPLETOS DA OBRA (Incluindo Faturamento por Tipo)
    const [detailedObra, setDetailedObra] = useState(obra);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Campos de Edição Manual (Metros Quadrados e Prancha)
    const [kmConcluidoPrancha, setKmConcluidoPrancha] = useState(obra?.kmConcluidoPrancha?.toString() || '');
    const [editedSectorsKm, setEditedSectorsKm] = useState(() =>
        (Array.isArray(obra.sectors) ? obra.sectors : [])
        .reduce((acc, s) => ({ ...acc, [s.name]: s.kmConcluido?.toString() || '' }), {})
    );
    
    // Estado para leituras de veículos ativos (apenas para atualização de manutenção/registro, não impacta faturamento)
    const [updatingReadings, setUpdatingReadings] = useState({});

    // Modais Internos
    const [isEditAssignmentModalOpen, setIsEditAssignmentModalOpen] = useState(false);
    const [assignmentToEdit, setAssignmentToEdit] = useState(null);
    const [isEditPastAssignmentModalOpen, setIsEditPastAssignmentModalOpen] = useState(false);
    const [pastAssignmentToEdit, setPastAssignmentToEdit] = useState(null);
    const [deletingHistoryId, setDeletingHistoryId] = useState(null);

    // --- FUNÇÃO DE BUSCA DE DETALHES ---
    const fetchDetails = async () => {
        if (!obra?.id) return;
        setIsLoadingDetails(true);
        try {
            let data;
            // Prioriza método específico se existir, senão chamada direta
            if (apiClient.getObraById) {
                data = await apiClient.getObraById(obra.id);
            } else if (apiClient.get) {
                const response = await apiClient.get(`/obras/${obra.id}`);
                data = response.data || response;
            } else {
                // Fallback
                data = obra;
            }
            
            if (data) {
                setDetailedObra(data);
                // Sincroniza estados locais
                setKmConcluidoPrancha(data.kmConcluidoPrancha?.toString() || '');
                setEditedSectorsKm(
                    (Array.isArray(data.sectors) ? data.sectors : [])
                    .reduce((acc, s) => ({ ...acc, [s.name]: s.kmConcluido?.toString() || '' }), {})
                );
            }
        } catch (error) {
            console.error("Erro ao carregar detalhes da obra:", error);
            // Não sobrescreve detailedObra com erro, mantém o que tem
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // --- EFEITO: BUSCA INICIAL ---
    useEffect(() => {
        fetchDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [obra?.id]); 


    // --- CÁLCULOS ---

    const { activeVehicles, pastVehicles } = useMemo(() => {
        // Usa detailedObra para garantir histórico mais atual, se disponível
        const sourceObra = detailedObra || obra;
        const historico = Array.isArray(sourceObra.historicoVeiculos) ? sourceObra.historicoVeiculos : [];
        
        const active = historico.filter(h => !h.dataSaida)
            .map(h => ({ ...h, vehicle: vehicles.find(v => v.id === h.veiculoId) }))
            .filter(h => h.vehicle) 
            .sort((a, b) => (a.vehicle.registroInterno || '').localeCompare(b.vehicle.registroInterno || ''));
            
        const past = historico.filter(h => h.dataSaida)
             .map(h => ({ ...h, vehicle: vehicles.find(v => v.id === h.veiculoId) }))
             .sort((a, b) => new Date(b.dataSaida) - new Date(a.dataSaida));
             
        return { activeVehicles: active, pastVehicles: past };
    }, [detailedObra, obra, vehicles]);

    // Lógica Central de Progresso: BASEADA NO FATURAMENTO (Dados de detailedObra)
    const progressData = useMemo(() => {
        const sourceObra = detailedObra || obra;
        const data = { 
            contratado: {}, 
            concluido: {}, 
            totalContratado: 0, 
            totalConcluido: 0, 
            totalKmContratado: 0, 
            totalKmConcluido: 0 
        };
        
        const currentContractType = sourceObra.contractType || 'horas';
        
        // Parse seguro das horas contratadas (caso venha como string JSON)
        const horasContratadasParsed = typeof sourceObra.horasContratadasPorTipo === 'string' 
            ? JSON.parse(sourceObra.horasContratadasPorTipo) 
            : (sourceObra.horasContratadasPorTipo || {});

        if (currentContractType === 'horas') {
             // 1. Preenche com os dados detalhados (Realizado por Tipo)
             Object.keys(horasContratadasParsed).forEach(type => {
                const contracted = parseFloat(horasContratadasParsed[type] || 0);
                
                // Tenta pegar do detalhado (realizadoPorTipo), se não existir, assume 0
                const realized = parseFloat(sourceObra.realizadoPorTipo?.[type] || 0);

                data.contratado[type] = contracted;
                data.concluido[type] = realized;

                data.totalContratado += contracted;
                data.totalConcluido += realized;
            });
            
            // 2. Adiciona horas "extras" (tipos não contratados mas que trabalharam)
            if (sourceObra.realizadoPorTipo) {
                Object.keys(sourceObra.realizadoPorTipo).forEach(type => {
                    if (!data.contratado[type]) {
                        const extra = parseFloat(sourceObra.realizadoPorTipo[type] || 0);
                        data.totalConcluido += extra;
                    }
                });
            }

            // FALLBACK
            if (data.totalConcluido === 0 && sourceObra.totalHorasRealizadas > 0 && (!sourceObra.realizadoPorTipo || Object.keys(sourceObra.realizadoPorTipo).length === 0)) {
                data.totalConcluido = parseFloat(sourceObra.totalHorasRealizadas);
            }

        } else if (currentContractType === 'metrosQuadrados') {
             (Array.isArray(sourceObra.sectors) ? sourceObra.sectors : []).forEach(sector => {
                const contracted = parseFloat(sector.kmContratado || 0);
                const concluded = parseFloat(editedSectorsKm[sector.name] ?? (sector.kmConcluido || 0)); 
                data.totalKmContratado += contracted;
                data.totalKmConcluido += concluded;
            });
        }
        return data;
    }, [detailedObra, obra, editedSectorsKm]);

    // --- HANDLERS ---

    const handleReadingChange = (vehicleId, value) => setUpdatingReadings(prev => ({ ...prev, [vehicleId]: value }));
    const handleSectorKmChange = (sectorName, value) => setEditedSectorsKm(prev => ({ ...prev, [sectorName]: value }));

    const handleSaveAssignmentEdit = async (vehicleId, historyEntryId, editedData) => {
        await apiClient.updateObraHistoryEntry(obra.id, historyEntryId, editedData);
        setAlertMessage("Alocação ativa atualizada com sucesso!");
        fetchDetails(); 
        reloadData(); 
        setIsEditAssignmentModalOpen(false);
    };

    const handleSavePastAssignmentEdit = async (vehicleId, historyEntryId, editedData) => {
        await apiClient.updateObraHistoryEntry(obra.id, historyEntryId, editedData);
        setAlertMessage("Histórico atualizado com sucesso!");
        fetchDetails();
        reloadData();
        setIsEditPastAssignmentModalOpen(false);
    };

    const handleDeleteHistoryEntry = async (historyEntryId) => {
        if (!window.confirm('Deseja excluir este registro de alocação? Esta ação não pode ser desfeita.')) return;
        setDeletingHistoryId(historyEntryId);
        try {
            await apiClient.deleteObraHistoryEntry(obra.id, historyEntryId);
            setAlertMessage("Registro excluído com sucesso!");
            fetchDetails();
            reloadData();
        } catch (error) {
            setAlertMessage(error.message || "Erro ao excluir registro.");
        } finally {
            setDeletingHistoryId(null);
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        let obraUpdatePayload = {};
        let vehicleUpdates = [];

        // Atualização de Km de Prancha (Manual)
        const newPranchaKm = parseFloat(kmConcluidoPrancha);
        if (!isNaN(newPranchaKm) && newPranchaKm !== (detailedObra.kmConcluidoPrancha || 0)) {
            obraUpdatePayload.kmConcluidoPrancha = newPranchaKm;
        }

        // Atualização de Setores
        if (detailedObra.contractType === 'metrosQuadrados') {
            const currentSectors = Array.isArray(detailedObra.sectors) ? detailedObra.sectors : [];
            const updatedSectors = currentSectors.map(sector => {
                const currentKm = parseFloat(sector.kmConcluido || 0);
                const newKm = parseFloat(editedSectorsKm[sector.name]);
                if (!isNaN(newKm) && newKm !== currentKm) {
                    return { ...sector, kmConcluido: newKm };
                }
                return sector;
            });
            
            if (JSON.stringify(updatedSectors) !== JSON.stringify(currentSectors)) {
                obraUpdatePayload.sectors = updatedSectors;
            }
        }

        // Atualização de Leituras de Veículos
        Object.entries(updatingReadings).forEach(([vehicleId, newReadingStr]) => {
             if (newReadingStr !== undefined && newReadingStr !== '') {
                 const newReading = parseFloat(newReadingStr);
                 const vehicle = vehicles.find(v => v.id === vehicleId);
                 
                 if (vehicle && !isNaN(newReading)) {
                     const vehicleGroup = Object.keys(vehicleGroups).find(group => vehicleGroups[group]?.includes(vehicle.tipo));
                     const updateData = {};
                     
                     if (vehicleGroup === 'Máquinas Pesadas') {
                         updateData.horimetro = newReading;
                     } else if (vehicleGroup === 'Caminhões') {
                         updateData.horimetro = newReading;
                     } else if (vehicleGroup === 'Veículos Leves') {
                          updateData.odometro = newReading;
                     }

                     if (Object.keys(updateData).length > 0) {
                         vehicleUpdates.push({ id: vehicleId, data: updateData });
                     }
                 }
             }
        });

        if (Object.keys(obraUpdatePayload).length === 0 && vehicleUpdates.length === 0) {
             setAlertMessage("Nenhuma alteração para salvar.");
             setIsSaving(false);
             return;
        }

        try {
            const promises = [];
            if (Object.keys(obraUpdatePayload).length > 0) {
                promises.push(apiClient.updateObra(obra.id, obraUpdatePayload));
            }
            vehicleUpdates.forEach(update => {
                promises.push(apiClient.updateVehicle(update.id, update.data));
            });

            await Promise.all(promises);

            setAlertMessage("Alterações salvas com sucesso!");
            setUpdatingReadings({});
            fetchDetails(); 
            reloadData();
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            setAlertMessage(error.message || "Ocorreu um erro ao salvar as alterações.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- RENDERIZAÇÃO ---

    return (
        <div className="mak-modal-backdrop p-2 sm:p-4 backdrop-blur-sm">
            <div className="mak-modal max-w-5xl">
                
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-start bg-white rounded-t-xl sticky top-0 z-10">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-800">{formatObraNome(detailedObra)}</h2>
                        <div className="flex flex-wrap gap-4 mt-2">
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                                <MapPin size={14}/> <span>{detailedObra.localizacao || 'Localização não definida'}</span>
                            </div>
                            {detailedObra.responsavel && (
                                <div className="flex items-center gap-1 text-gray-600 text-sm font-medium">
                                    <User size={14}/> Resp: {detailedObra.responsavel}
                                </div>
                            )}
                            {detailedObra.fiscal && (
                                <div className="flex items-center gap-1 text-gray-600 text-sm font-medium">
                                    <ClipboardList size={14}/> Fiscal: {detailedObra.fiscal}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-4 mt-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${detailedObra.status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {detailedObra.status === 'ativa' ? 'Em Andamento' : 'Finalizada'}
                            </span>
                            <span className="text-sm font-medium border-l pl-4 border-gray-300">
                                Contrato: {detailedObra.contractType === 'metrosQuadrados' ? 'Por Produção (m²)' : 'Por Horas'}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition"><X size={24} className="text-gray-400"/></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-6 bg-gray-50">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 pt-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <BarChart3 size={18}/> Visão Geral & Progresso
                    </button>
                    <button 
                        onClick={() => setActiveTab('vehicles')}
                        className={`pb-3 pt-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'vehicles' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Truck size={18}/> Veículos Alocados ({activeVehicles.length})
                    </button>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    
                    {/* --- ABA: VISÃO GERAL --- */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-fadeIn">
                            
                            {/* Painel de Progresso */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                        <AlertTriangle className="text-yellow-500" size={20}/> Status do Contrato
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {isLoadingDetails && <span className="text-xs text-blue-500 flex items-center gap-1"><Loader size={12} className="animate-spin"/> Atualizando...</span>}
                                        <button onClick={fetchDetails} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500" title="Atualizar dados"><RefreshCw size={16}/></button>
                                    </div>
                                </div>

                                {/* Contrato por HORAS */}
                                {detailedObra.contractType === 'horas' && (
                                    <>
                                        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                            <ProgressBar 
                                                label="Progresso Total (Horas)" 
                                                value={progressData.totalConcluido} 
                                                max={progressData.totalContratado} 
                                                color="dynamic"
                                            />
                                            <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                                                * Dados sincronizados com apontamentos do Faturamento (daily_work_logs).
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                            {Object.keys(progressData.contratado).map(type => {
                                                const contracted = progressData.contratado[type] || 0;
                                                // Exibe apenas se houver contrato ou horas realizadas
                                                if (contracted === 0 && (progressData.concluido[type] || 0) === 0) return null;
                                                
                                                return (
                                                    <ProgressBar 
                                                        key={type}
                                                        label={type}
                                                        value={progressData.concluido[type] || 0}
                                                        max={contracted}
                                                        color="bg-blue-400"
                                                    />
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {/* Contrato por M² */}
                                {detailedObra.contractType === 'metrosQuadrados' && (
                                    <>
                                        <div className="mb-6">
                                            <ProgressBar 
                                                label="Progresso Total (Km Lineares)" 
                                                value={progressData.totalKmConcluido} 
                                                max={progressData.totalKmContratado} 
                                                color="bg-green-500"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            {(Array.isArray(detailedObra.sectors) ? detailedObra.sectors : []).map(sector => (
                                                <div key={sector.name} className="flex items-center gap-4">
                                                    <div className="flex-1">
                                                        <ProgressBar 
                                                            label={sector.name}
                                                            value={parseFloat(editedSectorsKm[sector.name] ?? (sector.kmConcluido || 0))}
                                                            max={parseFloat(sector.kmContratado || 0)}
                                                            color="bg-green-300"
                                                        />
                                                    </div>
                                                    <ProtectedComponent requiredPermission="editor">
                                                        <div className="w-32">
                                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Atualizar (Km)</label>
                                                            <input 
                                                                type="number" 
                                                                step="0.1" 
                                                                className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-green-500 outline-none"
                                                                value={editedSectorsKm[sector.name]}
                                                                onChange={(e) => handleSectorKmChange(sector.name, e.target.value)}
                                                                placeholder={sector.kmConcluido}
                                                            />
                                                        </div>
                                                    </ProtectedComponent>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Deslocamento de Prancha (Comum a ambos) */}
                                {(parseFloat(detailedObra.kmContratadoPrancha) > 0) && (
                                    <div className="mt-6 pt-6 border-t">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 mr-4">
                                                <ProgressBar 
                                                    label="Deslocamento Prancha" 
                                                    value={parseFloat(kmConcluidoPrancha) || 0} 
                                                    max={parseFloat(detailedObra.kmContratadoPrancha) || 0} 
                                                    color="bg-purple-400"
                                                />
                                            </div>
                                            <ProtectedComponent requiredPermission="editor">
                                                <div className="w-32">
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Atualizar (Km)</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.1"
                                                        className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-purple-500 outline-none"
                                                        value={kmConcluidoPrancha}
                                                        onChange={(e) => setKmConcluidoPrancha(e.target.value)}
                                                        placeholder={detailedObra.kmConcluidoPrancha}
                                                    />
                                                </div>
                                            </ProtectedComponent>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Botão de Salvar (Aparece se houver edições manuais) */}
                            <ProtectedComponent requiredPermission="editor">
                                {(kmConcluidoPrancha !== (detailedObra.kmConcluidoPrancha?.toString() || '') || 
                                  (detailedObra.contractType === 'metrosQuadrados' && JSON.stringify(editedSectorsKm) !== JSON.stringify(detailedObra.sectors?.reduce((acc, s) => ({ ...acc, [s.name]: s.kmConcluido?.toString() || '' }), {})))
                                ) && (
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={handleSaveChanges} 
                                            disabled={isSaving}
                                            className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-lg flex items-center gap-2 disabled:bg-gray-400"
                                        >
                                            {isSaving ? <Loader className="animate-spin" size={20}/> : <Edit size={20}/>}
                                            Salvar Atualizações Manuais
                                        </button>
                                    </div>
                                )}
                            </ProtectedComponent>
                        </div>
                    )}

                    {/* --- ABA: VEÍCULOS --- */}
                    {activeTab === 'vehicles' && (
                        <div className="space-y-6 animate-fadeIn">
                            {/* Veículos Ativos */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                    <Truck size={16}/> Na Obra Agora
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {activeVehicles.length > 0 ? activeVehicles.map(h => {
                                        const { vehicle } = h;
                                        const vehicleGroup = Object.keys(vehicleGroups).find(group => vehicleGroups[group]?.includes(vehicle.tipo));
                                        
                                        // Definição da leitura atual (apenas para visualização/manutenção)
                                        let currentReading = 0;
                                        let readingLabel = 'Leitura';
                                        
                                        if (vehicleGroup === 'Máquinas Pesadas') {
                                            currentReading = parseFloat(vehicle.horimetro) || 0;
                                            readingLabel = 'Horímetro';
                                        } else if (vehicleGroup === 'Caminhões') {
                                            currentReading = parseFloat(vehicle.horimetro) || 0;
                                            readingLabel = 'Horímetro';
                                        } else { 
                                            currentReading = parseFloat(vehicle.odometro) || 0;
                                            readingLabel = 'Odômetro';
                                        }

                                        const initialReading = parseFloat(h.horimetroEntrada ?? h.odometroEntrada ?? 0);
                                        const partialReading = Math.max(0, currentReading - initialReading);

                                        // Reboques/acessórios atrelados a este veículo (aparecem aninhados)
                                        const attachedChildren = (vehicle.linkedChildren || [])
                                            .map(c => vehicles.find(v => v.id === c.id))
                                            .filter(Boolean);

                                        return (
                                          <div key={h.id}>
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                        {vehicle.registroInterno}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 flex items-center gap-1.5">
                                                            {vehicle.modelo}
                                                            {vehicle.isOutsourced && (
                                                                <span title="Veículo terceirizado" className="text-[9px] font-bold uppercase bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-1.5 py-px">3º</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{vehicle.tipo}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Entrada</span>
                                                        {new Date(h.dataEntrada).toLocaleDateString('pt-BR')}
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Operador</span>
                                                        {h.employeeName || 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Parcial ({readingLabel})</span>
                                                        <span className="font-bold text-blue-600">{partialReading.toFixed(1)}</span>
                                                    </div>
                                                </div>

                                                <ProtectedComponent requiredPermission="editor">
                                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                                        <div className="flex-1 sm:w-24">
                                                            <label className="block text-[10px] font-bold text-gray-400 mb-1">Atualizar Leitura</label>
                                                            <input 
                                                                type="number" 
                                                                step="0.1" 
                                                                className="w-full p-2 text-xs border rounded bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition"
                                                                placeholder={currentReading}
                                                                value={updatingReadings[vehicle.id] || ''}
                                                                onChange={(e) => handleReadingChange(vehicle.id, e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => { setAssignmentToEdit(h); setIsEditAssignmentModalOpen(true); }}
                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full mt-4"
                                                            title="Editar Detalhes da Alocação"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        {user?.user_type === 'admin' && (
                                                            <button
                                                                onClick={() => handleDeleteHistoryEntry(h.id)}
                                                                disabled={deletingHistoryId === h.id}
                                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full mt-4"
                                                                title="Excluir Alocação (Admin)"
                                                            >
                                                                {deletingHistoryId === h.id ? <Loader size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                                                            </button>
                                                        )}
                                                    </div>
                                                </ProtectedComponent>
                                            </div>
                                            {attachedChildren.length > 0 && (
                                                <div className="ml-6 mt-1 space-y-1">
                                                    {attachedChildren.map(child => (
                                                        <div key={child.id} className="flex items-center gap-2 bg-violet-50/60 border border-violet-100 rounded-md px-3 py-1.5 text-xs">
                                                            <CornerDownRight size={13} className="text-violet-400 shrink-0"/>
                                                            <span className="font-bold text-violet-800">{child.registroInterno}</span>
                                                            <span className="text-gray-500">{child.modelo || child.tipo}</span>
                                                            {child.isOutsourced && (
                                                                <span title="Veículo terceirizado" className="text-[9px] font-bold uppercase bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-1.5 py-px">3º</span>
                                                            )}
                                                            <span className="ml-auto text-[10px] font-bold uppercase text-violet-500">Atrelado</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                          </div>
                                        );
                                    }) : (
                                        <div className="text-center py-8 bg-white border border-dashed rounded-lg text-gray-400">
                                            Nenhum veículo ativo nesta obra no momento.
                                        </div>
                                    )}
                                </div>
                                
                                <ProtectedComponent requiredPermission="editor">
                                    {Object.keys(updatingReadings).length > 0 && (
                                        <div className="mt-4 flex justify-end">
                                            <button 
                                                onClick={handleSaveChanges} 
                                                disabled={isSaving}
                                                className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700 flex items-center gap-2"
                                            >
                                                {isSaving ? <Loader className="animate-spin" size={16}/> : <Edit size={16}/>}
                                                Salvar Leituras de Veículos
                                            </button>
                                        </div>
                                    )}
                                </ProtectedComponent>
                            </div>

                            {/* Histórico Passado */}
                            <div className="pt-6 border-t">
                                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                    <Clock size={16}/> Histórico de Saídas
                                </h3>
                                <div className="bg-white border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-100 text-gray-600 font-bold text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-2">Veículo</th>
                                                <th className="px-4 py-2">Período</th>
                                                <th className="px-4 py-2">Operador</th>
                                                <th className="px-4 py-2 text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {pastVehicles.length > 0 ? pastVehicles.map(h => (
                                                <tr key={h.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2">
                                                        <div className="font-bold text-gray-800">{h.vehicle?.registroInterno}</div>
                                                        <div className="text-xs text-gray-500">{h.vehicle?.modelo}</div>
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">
                                                        {new Date(h.dataEntrada).toLocaleDateString('pt-BR')} até {new Date(h.dataSaida).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">{h.employeeName || '-'}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <ProtectedComponent requiredPermission="editor">
                                                                <button
                                                                    onClick={() => { setPastAssignmentToEdit(h); setIsEditPastAssignmentModalOpen(true); }}
                                                                    className="text-gray-400 hover:text-blue-600"
                                                                    title="Editar"
                                                                >
                                                                    <Edit size={16}/>
                                                                </button>
                                                            </ProtectedComponent>
                                                            {user?.user_type === 'admin' && (
                                                                <button
                                                                    onClick={() => handleDeleteHistoryEntry(h.id)}
                                                                    disabled={deletingHistoryId === h.id}
                                                                    className="text-gray-400 hover:text-red-600"
                                                                    title="Excluir (Admin)"
                                                                >
                                                                    {deletingHistoryId === h.id ? <Loader size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-6 text-center text-gray-400 italic">
                                                        Nenhum histórico anterior.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Fixo */}
                <div className="p-4 bg-gray-50 border-t flex justify-end rounded-b-xl">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300 transition"
                    >
                        Fechar
                    </button>
                </div>
            </div>

            {/* Modais de Edição de Alocação (Mantidos iguais à sua versão, apenas renderizados condicionalmente) */}
            {isEditAssignmentModalOpen && assignmentToEdit && (
                <EditActiveVehicleAssignmentModal
                    assignment={assignmentToEdit}
                    vehicle={vehicles.find(v => v.id === assignmentToEdit.veiculoId)}
                    employees={employees}
                    onClose={() => setIsEditAssignmentModalOpen(false)}
                    onSave={handleSaveAssignmentEdit}
                    setAlertMessage={setAlertMessage}
                />
            )}
            {isEditPastAssignmentModalOpen && pastAssignmentToEdit && (
                <EditPastVehicleAssignmentModal
                    assignment={pastAssignmentToEdit}
                    vehicle={vehicles.find(v => v.id === pastAssignmentToEdit.veiculoId)}
                    employees={employees}
                    onClose={() => setIsEditPastAssignmentModalOpen(false)}
                    onSave={handleSavePastAssignmentEdit}
                    setAlertMessage={setAlertMessage}
                />
            )}
        </div>
    );
};

export default ObraDetailModal;

