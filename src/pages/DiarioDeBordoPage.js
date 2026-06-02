import React, { useState, useEffect, useMemo } from 'react';
// REMOVIDO: Imports do Firebase (firestore, auth) e Dexie
import { useAuth } from '../contexts/AuthContext';
// REMOVIDO: useOfflineContext
import { Play, Coffee, StopCircle, LogOut, Loader, History, AlertCircle, Truck, ChevronLeft, X } from 'lucide-react'; // Ícones mantidos
// REMOVIDO: signOut
import ProtectedComponent from '../components/ProtectedComponent'; // Ajuste o caminho se necessário
// Importa apiClient (será passado via props)
// import apiClient from '../services/apiClient'; // Não precisa importar, vem via props

// REMOVIDO: Componente OfflineSyncStatus

// ===================================================================================
// PÁGINA DE DIÁRIO DE BORDO
// ===================================================================================
const DiarioDeBordoPage = ({
    apiClient, // Recebe apiClient
    employees, vehicles, obras,
    setAlertMessage,
    vehicleGroups,
    reloadData // Recebe reloadData do App.js
}) => {
    const { user, isOperator, logout } = useAuth(); // Usa logout do contexto
    // REMOVIDO: useOfflineContext

    // Estados
    const [isLoading, setIsLoading] = useState(true); // Loading inicial (dados funcionário/veículo)
    const [isFetchingLog, setIsFetchingLog] = useState(false); // Loading ao buscar log ativo
    const [isProcessing, setIsProcessing] = useState(false); // Para ações (iniciar/finalizar)
    const [myEmployeeData, setMyEmployeeData] = useState(null);
    const [allocatedVehicles, setAllocatedVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [activeLog, setActiveLog] = useState(null); // Log ativo buscado da API
    const [recentLogs, setRecentLogs] = useState([]); // Logs recentes buscados da API
    const [showAllocationWarning, setShowAllocationWarning] = useState(false);
    const [hasCheckedWarning, setHasCheckedWarning] = useState(false);
    const [endReadings, setEndReadings] = useState({
        odometro: '', horimetro: ''
    });
    const [notesInput, setNotesInput] = useState('');

    // Função auxiliar para formatar datas (USA new Date())
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            // Usa UTC para garantir que a data não mude com o fuso
            return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch (e) {
            return 'Data inválida';
        }
    };
     // Função auxiliar para formatar hora (USA new Date())
     const formatTime = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            // Mostra hora local baseada no timestamp ISO
            return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return 'Hora inválida';
        }
    };

    // Efeito para encontrar funcionário e veículos alocados (lógica mantida, USA new Date())
    useEffect(() => {
        if (user && employees?.length > 0 && vehicles?.length > 0) {
            // Encontra dados do funcionário logado
            const employeeData = employees.find(e => e.userId === user.id);
            setMyEmployeeData(employeeData);

            if (employeeData) {
                // Encontra veículos onde o funcionário é o último alocado
                const employeeVehicles = vehicles.filter(v => {
                    const history = Array.isArray(v.history) ? v.history : []; // Garante que é array
                    if (history.length === 0) return false;

                    // Encontra a entrada de histórico mais recente (baseada em startDate)
                    const lastHistoryEntry = history.reduce((latest, entry) => {
                        if (!latest?.startDate) return entry;
                        if (!entry?.startDate) return latest;
                        // Compara datas
                        return new Date(latest.startDate) > new Date(entry.startDate) ? latest : entry;
                    }, null);

                    // Verifica se a última entrada não tem data final e pertence ao funcionário
                    return lastHistoryEntry && !lastHistoryEntry.endDate && lastHistoryEntry.details?.employeeId === employeeData.id;
                });
                setAllocatedVehicles(employeeVehicles);

                if (employeeVehicles.length === 1) {
                    setSelectedVehicle(employeeVehicles[0]);
                }
                 // Exibe aviso de alocação
                 if (employeeVehicles.length > 0 && !hasCheckedWarning) {
                    setShowAllocationWarning(true);
                    setHasCheckedWarning(true);
                 } else if (employeeVehicles.length === 0) {
                     setShowAllocationWarning(false);
                 }
            } else {
                 setAllocatedVehicles([]);
            }
             setIsLoading(false); // Terminou o loading inicial
        } else if (user && (!employees || employees.length === 0 || !vehicles || vehicles.length === 0)) {
            setIsLoading(true); // Continua carregando se dados globais não chegaram
        } else {
            setIsLoading(false);
            setMyEmployeeData(null);
            setAllocatedVehicles([]);
        }
    }, [user, employees, vehicles, hasCheckedWarning]);

    // Efeito para buscar log ATIVO da API
    useEffect(() => {
        // Reseta se não houver veículo
        if (!user || !myEmployeeData || !selectedVehicle) {
            setActiveLog(null);
            setNotesInput('');
            setEndReadings({ odometro: '', horimetro: '' });
            return;
        }

        let isMounted = true;
        const fetchActiveLog = async () => {
            setIsFetchingLog(true); // Indica carregamento do log
            try {
                // Busca logs abertos ou em almoço para este funcionário e veículo
                const logs = await apiClient.getDiarioDeBordo({
                    employeeId: myEmployeeData.id,
                    vehicleId: selectedVehicle.id,
                    status: 'Aberto' // O backend deve idealmente retornar "Aberto" E "Em Almoço"
                });

                if (!isMounted) return;

                // Encontra o log ativo (status Aberto ou Em Almoço) mais recente
                const foundActiveLog = (logs || [])
                    .filter(log => ["Aberto", "Em Almoço"].includes(log.status))
                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()) // Mais recente
                    [0]; // Pega o primeiro

                setActiveLog(foundActiveLog || null);
                // Preenche notas se já houver um log ativo
                if (foundActiveLog) {
                    setNotesInput(foundActiveLog.notes || '');
                } else {
                     // Limpa campos se não houver log ativo
                    setEndReadings({ odometro: '', horimetro: '' });
                    setNotesInput('');
                }

            } catch (error) {
                console.error("Erro ao buscar log ativo via API:", error);
                setAlertMessage("Falha ao verificar status da jornada atual.");
                if (isMounted) setActiveLog(null);
            } finally {
                if (isMounted) setIsFetchingLog(false);
            }
        };

        fetchActiveLog();

        return () => { isMounted = false; };

    }, [user, myEmployeeData, selectedVehicle, apiClient, setAlertMessage]);

    // Efeito para buscar logs RECENTES (Fechados) da API
    useEffect(() => {
        if (!myEmployeeData) {
            setRecentLogs([]);
            return;
        }

        let isMounted = true;
        const fetchRecentLogs = async () => {
            try {
                // Busca os últimos 5 logs fechados do funcionário
                const logs = await apiClient.getDiarioDeBordo({
                    employeeId: myEmployeeData.id,
                    status: "Fechado",
                    // A API deve lidar com ordenação e limite
                });

                 if (!isMounted) return;

                 const sortedLimitedLogs = (logs || [])
                     .sort((a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime())
                     .slice(0, 5);

                setRecentLogs(sortedLimitedLogs);

            } catch (error) {
                console.error("Erro ao buscar logs recentes via API:", error);
                 if (isMounted) setRecentLogs([]);
            }
        };

        fetchRecentLogs();

        return () => { isMounted = false; };

    }, [myEmployeeData, apiClient, activeLog]); // Recarrega histórico quando activeLog muda (ex: ao fechar)

    // Memoização de dados derivados (mantida)
    const vehicleGroup = useMemo(() => {
        if (!selectedVehicle || !vehicleGroups) return null;
        return Object.keys(vehicleGroups).find(g => vehicleGroups[g]?.includes(selectedVehicle.tipo));
    }, [selectedVehicle, vehicleGroups]);
    const myObra = useMemo(() => {
        if (selectedVehicle && selectedVehicle.obraAtualId) {
            return obras?.find(o => o.id === selectedVehicle.obraAtualId);
        }
        return null;
    }, [selectedVehicle, obras]);

    // Função para buscar o último log fechado (USA API)
    const getLastClosedLog = async () => {
         if (!myEmployeeData) return null;
         try {
             const logs = await apiClient.getDiarioDeBordo({
                 employeeId: myEmployeeData.id,
                 status: "Fechado",
             });
             const lastLog = (logs || [])
                 .sort((a,b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
                 [0]; // Pega o mais recente
             return lastLog || null;
         } catch (error) {
              console.error("Erro ao buscar último log fechado:", error);
              return null;
         }
    };

    // Handler para INICIAR Jornada (USA API)
    const handleStartJourney = async () => {
        if (!selectedVehicle || !myEmployeeData || isProcessing) return;

        // Validação de descanso (usa getLastClosedLog com API)
        const lastLog = await getLastClosedLog();
        if (lastLog && lastLog.endTime) {
            const lastEndTime = new Date(lastLog.endTime);
            const now = new Date();
            const diffHours = (now.getTime() - lastEndTime.getTime()) / (1000 * 60 * 60);

            if (diffHours < 11) {
                setAlertMessage(`Descanso mínimo de 11 horas não cumprido. Faltam ${Math.ceil(11 - diffHours)} horas.`);
                return;
            }
        }

        setIsProcessing(true);

        // Prepara leituras iniciais (baseadas no veículo - UNIFICADO)
        const startReadings = {
            odometro: parseFloat(selectedVehicle.odometro || 0) || null,
            horimetro: parseFloat(selectedVehicle.horimetro || 0) || null,
        };

        // Prepara dados para a API
        const newLogData = {
            employeeId: myEmployeeData.id,
            vehicleId: selectedVehicle.id,
            obraId: myObra?.id || null,
            // logDate, status, startTime, startReadings, createdBy
            // são preenchidos pelo backend (endpoint /start-journey)
            startReadings: startReadings, // Envia leituras atuais
        };

        try {
            // Chama a API para iniciar a jornada
            const createdLog = await apiClient.startDiarioJourney(newLogData);

            setAlertMessage("Jornada iniciada com sucesso!");
            // Define o log ativo com a resposta da API
            setActiveLog(createdLog);
            setNotesInput(''); // Limpa notas
            setEndReadings({ odometro: '', horimetro: '' }); // Limpa leituras finais
        } catch (error) {
            console.error("Erro ao iniciar jornada via API:", error);
            setAlertMessage(error.message || "Falha ao iniciar a jornada.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Handler para INICIAR Intervalo (USA API)
    const handleStartLunch = async () => {
        if (!activeLog || isProcessing) return;
        setIsProcessing(true);

        // const lunchStartTime = new Date().toISOString(); // Backend deve definir isso

        try {
            // Chama a API para iniciar o intervalo
            // O backend define 'status' = 'Em Almoço' e 'lunchStartTime'
            const updatedLog = await apiClient.startBreak(activeLog.id);

            setAlertMessage("Intervalo iniciado.");
            // Atualiza o estado local com a resposta da API
            setActiveLog(updatedLog);
        } catch (error) {
            console.error("Erro ao iniciar intervalo via API:", error);
            setAlertMessage(error.message || "Falha ao iniciar o intervalo.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Handler para FINALIZAR Intervalo (USA API)
    const handleEndLunch = async () => {
        if (!activeLog || !activeLog.lunchStartTime || isProcessing) return;

        // Validação de tempo mínimo (USA new Date())
        const lunchStart = new Date(activeLog.lunchStartTime);
        const now = new Date();
        const diffMinutes = (now.getTime() - lunchStart.getTime()) / 60000;

        if (diffMinutes < 60) {
            setAlertMessage(`Intervalo mínimo de 1 hora não cumprido. Faltam ${Math.ceil(60 - diffMinutes)} minutos.`);
            return;
        }

        setIsProcessing(true);
        
        try {
            // Chama a API para finalizar o intervalo
            // O backend define 'status' = 'Aberto', calcula duração e adiciona ao array 'breaks'
            const updatedLog = await apiClient.endBreak(activeLog.id);

            setAlertMessage("Retorno do intervalo registrado.");
            // Atualiza o estado local com a resposta da API
            setActiveLog(updatedLog);
        } catch (error) {
            console.error("Erro ao finalizar intervalo via API:", error);
            setAlertMessage(error.message || "Falha ao finalizar o intervalo.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Handler para FINALIZAR Jornada (USA API)
    const handleEndJourney = async () => {
        if (!activeLog || isProcessing) return;

        // Validação de tempo mínimo (USA new Date())
        const journeyStart = new Date(activeLog.startTime);
        const now = new Date();
        const journeyMinutes = (now.getTime() - journeyStart.getTime()) / 60000;
        if (journeyMinutes < 15) { // Mantido 15 min
            setAlertMessage("Tempo mínimo de jornada (15 min) não atingido.");
            return;
        }

        // Validação das leituras finais
        const finalReadings = {};
        const vehicleUpdate = {}; // Leituras a serem atualizadas no veículo
        let hasAtLeastOneReading = false;
        let readingError = false;
        let errorMsg = "Leitura final inválida: ";

        const startOdo = parseFloat(activeLog.startReadings?.odometro || 0);
        const startHor = parseFloat(activeLog.startReadings?.horimetro || 0);

        const endOdoInput = parseFloat(endReadings.odometro || 0);
        const endHorInput = parseFloat(endReadings.horimetro || 0);

        if (vehicleGroup === 'Veículos Leves' || vehicleGroup === 'Caminhões') {
             if (endReadings.odometro) { // Verifica se o campo foi preenchido
                 if (endOdoInput < startOdo) { readingError = true; errorMsg += `Odômetro (${endOdoInput} < ${startOdo})`; }
                 finalReadings.odometro = endOdoInput;
                 vehicleUpdate.odometro = endOdoInput;
                 hasAtLeastOneReading = true;
            }
        }
        
        if (vehicleGroup === 'Caminhões' || vehicleGroup === 'Máquinas Pesadas') {
            if (endReadings.horimetro) {
                 if (endHorInput < startHor) { readingError = true; errorMsg += `${readingError ? ', ' : ''}Horímetro (${endHorInput} < ${startHor})`; }
                 finalReadings.horimetro = endHorInput;
                 vehicleUpdate.horimetro = endHorInput;
                 hasAtLeastOneReading = true;
            }
        }

        if (readingError) {
            setAlertMessage(errorMsg + ".");
            return;
        }
        if (!hasAtLeastOneReading) {
            setAlertMessage("Preencha pelo menos uma leitura final.");
            return;
        }

        setIsProcessing(true);

        // Prepara dados para a API
        const finalLogData = {
            // status: 'Fechado', // Backend define
            // endTime: now.toISOString(), // Backend define
            endReadings: finalReadings, // Objeto com leituras preenchidas
            notes: notesInput,
            vehicleUpdate: vehicleUpdate, // Objeto com leituras a serem atualizadas no veículo
        };

        try {
            // Chama a API para finalizar a jornada
            // O backend define status='Fechado', endTime, e atualiza o veículo
            await apiClient.endJourney(activeLog.id, finalLogData);

            setAlertMessage("Jornada finalizada com sucesso!");
            setActiveLog(null); // Volta para a tela de iniciar jornada
            reloadData(); // CHAMA reloadData para atualizar o veículo no App.js

        } catch (error) {
            console.error("Erro ao finalizar jornada via API:", error);
            setAlertMessage(error.message || "Falha ao finalizar a jornada.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Handler para mudança nas leituras finais (mantido)
    const handleReadingChange = (e) => {
        const { name, value } = e.target;
        const numericValue = value === '' ? '' : (parseFloat(value) || 0);
        setEndReadings(prev => ({...prev, [name]: numericValue }));
    };

    // Funções de renderização (ajustadas para usar ?. e new Date())
    const renderStartReadings = () => {
        if (!activeLog?.startReadings) return null;
        const readings = activeLog.startReadings;
        return (
             <div className="text-sm text-gray-600 space-y-1">
                 {(vehicleGroup === 'Veículos Leves' || vehicleGroup === 'Caminhões') &&
                     <p><strong>Odômetro Inicial:</strong> {readings.odometro?.toFixed(1) ?? 'N/A'} km</p>}
                 {(vehicleGroup === 'Caminhões' || vehicleGroup === 'Máquinas Pesadas') &&
                     <p><strong>Horímetro Inicial:</strong> {readings.horimetro?.toFixed(1) ?? 'N/A'} hrs</p>}
            </div>
        );
    };

    const renderEndReadingFields = () => {
        return <div className="space-y-4">
            {(vehicleGroup === 'Veículos Leves' || vehicleGroup === 'Caminhões') && (
                <div>
                    <label className="block text-sm font-medium text-gray-700">Odômetro Final (km)*</label>
                    <input type="number" step="0.1" name="odometro" value={endReadings.odometro} onChange={handleReadingChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"/>
                </div>
            )}
            {(vehicleGroup === 'Caminhões' || vehicleGroup === 'Máquinas Pesadas') && (
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Horímetro Final (hrs)*</label>
                    <input type="number" step="0.1" name="horimetro" value={endReadings.horimetro} onChange={handleReadingChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"/>
                </div>
            )}
            {(vehicleGroup === 'Caminhões' || vehicleGroup === 'Máquinas Pesadas') &&
                <div className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded-md border border-yellow-200">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0"/>
                    <span>É obrigatório preencher pelo menos um campo de leitura final.</span>
                </div>
            }
        </div>
    };

    const renderCurrentReadings = () => {
         if (!selectedVehicle) return null;
         return (
             <div className="text-sm text-gray-600 space-y-1">
                 {(vehicleGroup === 'Veículos Leves' || vehicleGroup === 'Caminhões') &&
                    <p><strong>Odômetro Atual:</strong> {selectedVehicle.odometro?.toFixed(1) ?? 'N/A'} km</p>}
                 {(vehicleGroup === 'Caminhões' || vehicleGroup === 'Máquinas Pesadas') &&
                    <p><strong>Horímetro Atual:</strong> {selectedVehicle.horimetro?.toFixed(1) ?? 'N/A'} hrs</p>}
             </div>
         );
    };

    // Telas de Loading e Acesso Negado
    if (isLoading) { // Loading inicial (busca funcionário/veículos)
        return <div className="flex items-center justify-center min-h-screen"><Loader className="animate-spin text-yellow-500" size={48} /></div>;
    }

    if (!myEmployeeData || allocatedVehicles.length === 0) {
        // Acesso negado
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-red-600 mb-2">Acesso Restrito</h2>
                    <p className="text-gray-700">
                         {!myEmployeeData ? "Não foi possível encontrar seus dados de funcionário." : "Nenhum veículo está alocado para você."}
                    </p>
                    <p className="text-gray-500 mt-2 text-sm">Por favor, contacte o administrador ou o setor de Frotas.</p>
                     <button onClick={logout} className="mt-6 flex items-center justify-center gap-2 w-full py-2 px-4 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 transition"><LogOut size={20}/> Sair</button>
                </div>
            </div>
        );
    }

    // Tela de Seleção de Veículo
    if (!selectedVehicle) {
        return (
            <div className="min-h-screen bg-gray-100 font-sans">
                {/* Cabeçalho */}
                <header className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-20">
                    <div>
                        <h1 className="text-xl font-bold">Seleção de Veículo</h1>
                        <p className="text-sm text-gray-300">{myEmployeeData.nome}</p>
                    </div>
                    <button onClick={logout} title="Sair" className="p-2 rounded-full text-gray-300 hover:bg-gray-700 hover:text-white transition"><LogOut size={20}/></button>
                </header>
                <main className="p-4 md:p-6">
                     {/* Aviso de Alocação */}
                     {showAllocationWarning && (
                        <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded-r-lg text-orange-800 mb-6 flex items-start gap-3 shadow">
                            <AlertCircle size={24} className="flex-shrink-0 text-orange-600 mt-0.5"/>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg">Atenção!</h3>
                                <p className="text-sm">
                                    Verifique os veículos alocados abaixo. Se algum não estiver mais sob sua responsabilidade, informe imediatamente o setor de Frotas.
                                </p>
                            </div>
                            <button onClick={() => setShowAllocationWarning(false)} title="Fechar aviso" className="ml-auto p-1 rounded-full text-orange-600 hover:bg-orange-200 transition">
                                <X size={20} />
                            </button>
                        </div>
                     )}
                     {/* Lista de Veículos */}
                    <div className="bg-white p-6 rounded-lg shadow-lg " style={{ border: "1px solid #f0ebe3" }}>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" mb-4">Selecione o veículo/equipamento</h2>
                        <div className="space-y-3">
                            {allocatedVehicles.map(vehicle => {
                                const obra = vehicle.obraAtualId ? obras?.find(o => o.id === vehicle.obraAtualId) : null;
                                return (
                                    <button
                                        key={vehicle.id}
                                        onClick={() => setSelectedVehicle(vehicle)}
                                        className="w-full text-left p-4 border rounded-lg hover:bg-[#fdf8f0] hover:border-[#9E7A42] transition flex items-center gap-4 shadow-sm bg-gray-50 border-gray-200"
                                    >
                                        <Truck size={40} className="text-gray-500 flex-shrink-0"/>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-gray-900 truncate">{vehicle.registroInterno} - {vehicle.modelo}</p>
                                            <p className="text-sm text-gray-600 truncate">{obra ? `Obra: ${obra.nome}` : 'Operacional / Pátio'}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>
        );
    }
    
    // Tela Principal de Operação
    return (
        <div className="min-h-screen bg-gray-100 font-sans">
             {/* Cabeçalho */}
            <header className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-20">
                <div>
                    <h1 className="text-xl font-bold">Diário de Bordo</h1>
                    <p className="text-sm text-gray-300">{myEmployeeData.nome}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedVehicle(null)} className="flex items-center gap-1 text-sm py-1 px-3 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white transition">
                        <ChevronLeft size={16}/>
                        Trocar Veículo
                    </button>
                    <button onClick={logout} title="Sair" className="p-2 rounded-full text-gray-300 hover:bg-gray-700 hover:text-white transition"><LogOut size={20}/></button>
                </div>
            </header>

            <main className="p-4 md:p-6 space-y-6">
                {/* REMOVIDO: OfflineSyncStatus */}
                
                {/* Loading de Log Ativo */}
                {isFetchingLog && (
                    <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-gray-300 flex justify-center items-center h-48">
                         <Loader className="animate-spin text-yellow-500" size={32} />
                         <p className="ml-4 text-gray-600">Verificando jornada...</p>
                    </div>
                )}

                {/* Card de Jornada Ativa / Iniciar Jornada */}
                {!isFetchingLog && activeLog ? (
                    // --- JORNADA EM ANDAMENTO ---
                    <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-green-500">
                        {activeLog.status === 'Em Almoço' ? (
                            // --- EM INTERVALO ---
                            <div>
                                <h2 className="text-2xl font-bold text-yellow-600 mb-4 flex items-center gap-2"><Coffee /> Em Intervalo</h2>
                                <p className="text-sm text-gray-600 mb-4"><strong>Início do Intervalo:</strong> {formatTime(activeLog.lunchStartTime)}</p>
                                <button onClick={handleEndLunch} disabled={isProcessing} className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 mak-btn mak-btn-dark">
                                    {isProcessing ? <Loader className="animate-spin" size={20} /> : <Play size={20} />}
                                    Retornar do Intervalo
                                </button>
                            </div>
                        ) : (
                            // --- JORNADA ABERTA ---
                            <div>
                                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" mb-4">Jornada em Andamento</h2>
                                <div className="space-y-2 mb-6 border-b pb-4">
                                    <p className="text-sm"><strong>Veículo:</strong> {selectedVehicle.registroInterno} - {selectedVehicle.modelo}</p>
                                    <p className="text-sm"><strong>Obra/Local:</strong> {activeLog.obraName || 'N/A'}</p>
                                    <p className="text-sm"><strong>Início:</strong> {formatTime(activeLog.startTime)}</p>
                                    {renderStartReadings()}
                                </div>

                                <button onClick={handleStartLunch} disabled={isProcessing} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#9E7A42] text-white font-bold rounded-lg hover:bg-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed mb-6 shadow hover:shadow-md">
                                    {isProcessing ? <Loader className="animate-spin" size={20}/> : <Coffee size={20} />}
                                    Iniciar Intervalo
                                </button>

                                <div className="bg-gray-50 p-4 rounded-lg " style={{ border: "1px solid #f0ebe3" }}>
                                    <h3 className="font-bold mb-3 text-gray-700">Finalizar Jornada</h3>
                                    {renderEndReadingFields()}
                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700">Observações</label>
                                        <textarea
                                            value={notesInput}
                                            onChange={(e) => setNotesInput(e.target.value)}
                                            rows="2"
                                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                                            placeholder="Adicione notas (opcional)..."
                                        />
                                    </div>
                                    <button onClick={handleEndJourney} disabled={isProcessing} className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow hover:shadow-md">
                                        {isProcessing ? <Loader className="animate-spin" size={20}/> : <StopCircle size={20} />}
                                        Finalizar Jornada
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // --- INICIAR NOVA JORNADA ---
                    !isFetchingLog && ( // Só mostra se não estiver buscando log
                        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
                             <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" mb-4">Iniciar Nova Jornada</h2>
                             <div className="space-y-2 mb-6 border-b pb-4">
                                <p className="text-sm"><strong>Veículo:</strong> {selectedVehicle.registroInterno} - {selectedVehicle.modelo}</p>
                                <p className="text-sm"><strong>Obra/Local Atual:</strong> {myObra?.nome || 'Pátio/Operacional'}</p>
                                {renderCurrentReadings()}
                             </div>
                             <button onClick={handleStartJourney} disabled={isProcessing} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow hover:shadow-md">
                                {isProcessing ? <Loader className="animate-spin" size={20}/> : <Play size={20} />}
                                Iniciar Jornada
                            </button>
                        </div>
                    )
                )}

                {/* Histórico Recente */}
                <div className="bg-white p-6 rounded-lg shadow-lg " style={{ border: "1px solid #f0ebe3" }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" mb-4 flex items-center gap-2"><History /> Histórico Recente (Últimas 5)</h2>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {recentLogs.length > 0 ? recentLogs.map(log => {
                             const vehicle = vehicles?.find(v => v.id === log.vehicleId);
                             const vehicleGroup = vehicle ? Object.keys(vehicleGroups).find(g => vehicleGroups[g]?.includes(vehicle.tipo)) : null;
                             let readingLabel = 'Leitura';
                             let readingValue = 'N/A';

                             if (log.endReadings && log.startReadings) {
                                 const startOdo = parseFloat(log.startReadings.odometro || 0);
                                 const endOdo = parseFloat(log.endReadings.odometro || 0);
                                 const startHor = parseFloat(log.startReadings.horimetro || 0);
                                 const endHor = parseFloat(log.endReadings.horimetro || 0);
                                 let diff = 0;
                                 let unit = '';

                                 if (vehicleGroup === 'Veículos Leves') {
                                      if(endOdo >= startOdo) diff = endOdo - startOdo; unit = 'km'; readingLabel = 'Odômetro';
                                 } else if (vehicleGroup === 'Caminhões') {
                                     if (endHor >= startHor) { diff = endHor - startHor; unit = 'hrs'; readingLabel = 'Horímetro'; }
                                     else if (endOdo >= startOdo) { diff = endOdo - startOdo; unit = 'km'; readingLabel = 'Odômetro'; }
                                 } else if (vehicleGroup === 'Máquinas Pesadas') {
                                     if (endHor >= startHor) { diff = endHor - startHor; unit = 'hrs'; readingLabel = 'Horímetro'; }
                                 }
                                 readingValue = `${diff.toFixed(1)} ${unit}`;
                             }


                            return (
                                <div key={log.id} className="bg-gray-50 p-3 rounded-md " style={{ border: "1px solid #f0ebe3" }}>
                                    <p className="font-semibold text-sm">{formatDate(log.logDate)} - {log.obraName || 'N/A'}</p>
                                    <p className="text-xs text-gray-600">
                                         {readingLabel}: {readingValue}
                                    </p>
                                    {log.notes && <p className="text-xs text-gray-500 mt-1 italic">Obs: {log.notes}</p>}
                                </div>
                            );
                        }) : <p className="text-gray-500 text-sm text-center py-6">Nenhuma jornada finalizada recentemente.</p>}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DiarioDeBordoPage;



