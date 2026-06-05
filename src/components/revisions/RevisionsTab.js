import React, { useState, useMemo } from 'react';
import { Edit, Clock, CheckCircle, X, Loader, History, FileText, Wrench, Calendar } from 'lucide-react';
import ProtectedComponent from '../ProtectedComponent';
import { checkReadingConsistency, checkVehicleRestrictions, getVehicleMainReading } from '../../utils/vehicleRules';

const isValidDbDate = (dateString) => {
    return dateString && dateString.length > 8 && !dateString.startsWith('0000');
};

const RevisionsTab = ({
    user, vehicles = [], revisions = [], setAlertMessage, apiClient, reloadData, PasswordConfirmationModal
}) => {
    const [editingRevision, setEditingRevision] = useState(null);
    const [completingRevision, setCompletingRevision] = useState(null);
    const [historyModalVehicle, setHistoryModalVehicle] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const combinedData = useMemo(() => {
        const validVehicles = Array.isArray(vehicles) ? vehicles : [];
        const validRevisions = Array.isArray(revisions) ? revisions : [];

        const sortedVehicles = [...validVehicles].filter(v =>
            !v.isOutsourced && v.ativo !== 0 && !v.isSucata
        ).sort((a, b) => {
            const regA = a.registroInterno || '';
            const regB = b.registroInterno || '';
            const numA = parseInt(regA.replace(/\D/g, ''));
            const numB = parseInt(regB.replace(/\D/g, ''));
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return regA.localeCompare(regB);
        });

        return sortedVehicles.map(vehicle => {
            if (!vehicle) return null;
            const revision = validRevisions.find(r => r.vehicleId === vehicle.id) || { vehicleId: vehicle.id, historico: [] };
            return { ...vehicle, revision };
        }).filter(item => {
            if (!item) return false;
            const searchLower = searchTerm.toLowerCase();
            return !searchLower ||
                   (item.placa || '').toLowerCase().includes(searchLower) ||
                   (item.registroInterno || '').toLowerCase().includes(searchLower) ||
                   (item.marca || '').toLowerCase().includes(searchLower) ||
                   (item.modelo || '').toLowerCase().includes(searchLower);
        });
    }, [vehicles, revisions, searchTerm]);

     const formatNextRevisionDate = (dateString) => {
         if (!isValidDbDate(dateString)) return '-';
         try {
             const date = new Date(dateString);
             return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).toLocaleDateString('pt-BR');
         } catch (e) { return '-'; }
     };

     const formatNextRevisionReading = (revision, vehicle) => {
        if (!revision) return '-';
        const readingInfo = getVehicleMainReading(vehicle);
        const unit = readingInfo.unit;
        
        let reading;
        if (unit === 'Hr') {
            reading = revision.proximaRevisaoHorimetro;
            if ((reading === null || reading === undefined) && revision.proximaRevisaoOdometro > 0) {
                 reading = revision.proximaRevisaoOdometro;
            }
        } else {
            reading = revision.proximaRevisaoOdometro;
        }

        if (reading == null || reading <= 0) return '-';
        return `${parseFloat(reading).toFixed(1)} ${unit}`;
     };

    return (
        <div className="animate-fadeIn">
            <div className="mb-4 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                <input
                    type="text"
                    placeholder="Buscar por registro, placa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-gray-50 focus:ring-1 focus:ring-blue-500 text-sm outline-none"
                />
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                <div className="hidden md:grid grid-cols-12 gap-2 p-3 font-semibold text-[11px] text-gray-500 border-b bg-gray-50 uppercase tracking-wider">
                    <div className="col-span-3">Veículo</div>
                    <div className="col-span-2 text-right">Leitura Atual</div>
                    <div className="col-span-2 text-center">Próx. Data</div>
                    <div className="col-span-2 text-right">Próx. Leitura</div>
                    <div className="col-span-2">Status / Agendamento</div>
                    <div className="col-span-1 text-center">Ações</div>
                </div>

                {combinedData.map(item => {
                    if (!item || !item.revision) return null;
                    const { revision, ...vehicle } = item;
                    const issues = checkVehicleRestrictions(vehicle, [revision]);
                    
                    const readingInfo = getVehicleMainReading(vehicle);
                    const currentReading = parseFloat(readingInfo.raw || 0);
                    
                    const nextReading = readingInfo.unit === 'Km' ? revision.proximaRevisaoOdometro : revision.proximaRevisaoHorimetro;
                    const nextDate = revision.proximaRevisaoData ? new Date(revision.proximaRevisaoData) : null;
                    const today = new Date();
                    
                    const warnLimitReading = revision.avisoAntecedenciaKmHr || (readingInfo.unit === 'Km' ? 1000 : 50);
                    const warnLimitDays = revision.avisoAntecedenciaDias || 30;

                    let isAntecedenceWarning = false;
                    const warningDetails = [];

                    if (nextReading && currentReading < nextReading) {
                        const remaining = nextReading - currentReading;
                        if (remaining <= warnLimitReading) {
                            isAntecedenceWarning = true;
                            warningDetails.push(`Faltam ${remaining.toFixed(0)} ${readingInfo.unit}`);
                        }
                    }

                    if (nextDate && nextDate > today) {
                        const diffTime = Math.abs(nextDate - today);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                        if (diffDays <= warnLimitDays) {
                            isAntecedenceWarning = true;
                            warningDetails.push(`Faltam ${diffDays} dias`);
                        }
                    }

                    const maintenanceIssues = issues.filter(i => i.category === 'manutencao');
                    const docIssues = issues.filter(i => i.category === 'documentacao' || i.category === 'legal');
                    
                    const isMaintOverdue = maintenanceIssues.some(i => i.type === 'error');
                    const isMaintWarning = maintenanceIssues.some(i => i.type === 'warning') || isAntecedenceWarning;
                    
                    const isDocOverdue = docIssues.some(i => i.type === 'error');
                    const isDocWarning = docIssues.some(i => i.type === 'warning');

                    let rowBgClass = 'bg-white hover:bg-gray-50'; 
                    let borderClass = 'border-l-4 border-transparent';

                    if (isMaintOverdue || isDocOverdue) {
                        rowBgClass = 'bg-red-50 hover:bg-red-100'; 
                        borderClass = 'border-l-4 border-red-500';
                    } else if (isMaintWarning || isDocWarning) {
                        rowBgClass = 'bg-yellow-50 hover:bg-yellow-100'; 
                        borderClass = 'border-l-4 border-yellow-400';
                    }

                    const currentReadingStr = `${currentReading.toFixed(1)} ${readingInfo.unit}`;
                    const nextDateStr = formatNextRevisionDate(revision.proximaRevisaoData);
                    const nextReadingStr = formatNextRevisionReading(revision, vehicle);
                    const description = revision.descricao || <span className="text-gray-400 italic font-light">Sem agendamento</span>; 
                    
                    const hasHistory = revision.historico && revision.historico.length > 0;
                    const historyIconClass = hasHistory ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 hover:text-gray-500';

                    return (
                        <div key={vehicle.id} className={`grid grid-cols-1 md:grid-cols-12 gap-y-1 gap-x-2 items-center px-3 py-2 border-b last:border-b-0 text-xs relative transition-colors ${rowBgClass} ${borderClass}`}>
                            <div className="md:col-span-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1 min-w-[36px]">
                                        {(isMaintOverdue || isMaintWarning) && (
                                            <div className="group relative">
                                                {/* Ícone atualizado para Chave de Boca (Wrench) */}
                                                <Wrench size={14} className={isMaintOverdue ? "text-red-600 animate-pulse" : "text-yellow-600"} />
                                                <span className="absolute left-4 top-0 hidden group-hover:block bg-gray-800 text-white text-[10px] p-2 rounded z-10 w-48 shadow-lg">
                                                    {isMaintOverdue ? "VENCIDA: " : "ALERTA: "}
                                                    {maintenanceIssues.map(i => i.message).join(', ')}
                                                    {isAntecedenceWarning && warningDetails.length > 0 && (
                                                        <div className="mt-1 pt-1 border-t border-gray-600 text-yellow-300">
                                                            Atenção: {warningDetails.join(' e ')}
                                                        </div>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                        {(isDocOverdue || isDocWarning) && (
                                            <div className="group relative">
                                                <FileText size={14} className={isDocOverdue ? "text-red-600" : "text-yellow-600"} />
                                                <span className="absolute left-4 top-0 hidden group-hover:block bg-gray-800 text-white text-[10px] p-1 rounded z-10 w-40 shadow-lg">
                                                    {docIssues.map(i => i.message).join(', ')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 leading-tight">{vehicle.registroInterno}</p>
                                        <p className="text-[10px] text-gray-500 leading-tight">{vehicle.modelo} ({vehicle.placa})</p>
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-2 text-left md:text-right font-mono font-medium text-blue-700">{currentReadingStr}</div>
                            <div className="md:col-span-2 text-left md:text-center text-gray-700">{nextDateStr}</div>
                            <div className="md:col-span-2 text-left md:text-right text-gray-700">{nextReadingStr}</div>
                            <div className="md:col-span-2 text-gray-600 truncate text-[11px]" title={typeof description === 'string' ? description : ''}>{description}</div>
                            <div className="md:col-span-1 flex items-center justify-end md:justify-center gap-1 mt-1 md:mt-0">
                                <ProtectedComponent requiredPermission="editor">
                                    <button onClick={() => setEditingRevision(item)} className="p-1 text-gray-500 hover:text-[#9E7A42] hover:bg-white rounded border border-transparent hover:border-gray-200" title="Agendar">
                                        <Edit size={14} />
                                    </button>
                                    <button onClick={() => setCompletingRevision(item)} className="p-1 text-gray-500 hover:text-green-600 hover:bg-white rounded border border-transparent hover:border-gray-200" title="Concluir">
                                        <CheckCircle size={14} />
                                    </button>
                                </ProtectedComponent>
                                <button onClick={() => setHistoryModalVehicle(item)} className={`p-1 rounded border border-transparent hover:border-gray-200 ${historyIconClass}`} title="Histórico">
                                    <History size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {editingRevision && (
                <ScheduleRevisionModal
                    vehicle={editingRevision}
                    onClose={() => setEditingRevision(null)}
                    setAlertMessage={setAlertMessage}
                    apiClient={apiClient}
                    reloadData={reloadData}
                />
            )}

            {completingRevision && (
                <CompleteRevisionModal 
                    user={user} 
                    vehicle={completingRevision} 
                    onClose={() => setCompletingRevision(null)} 
                    setAlertMessage={setAlertMessage} 
                    apiClient={apiClient} 
                    reloadData={reloadData} 
                    PasswordConfirmationModal={PasswordConfirmationModal} 
                />
            )}
            
            {historyModalVehicle && (
                <RevisionHistoryModal 
                    vehicle={historyModalVehicle} 
                    onClose={() => setHistoryModalVehicle(null)} 
                />
            )}
        </div>
    );
};

// ============================================================================
// MODAIS INTERNOS DE REVISÃO (Mantidos e Isolados aqui)
// ============================================================================
const ScheduleRevisionModal = ({ vehicle, onClose, setAlertMessage, apiClient, reloadData }) => {
    const readingInfo = getVehicleMainReading(vehicle);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        descricao: vehicle.revision?.descricao || '',
        proximaRevisaoData: vehicle.revision?.proximaRevisaoData ? vehicle.revision.proximaRevisaoData.split('T')[0] : '',
        proximaRevisaoLeitura: readingInfo.unit === 'Km' 
            ? (vehicle.revision?.proximaRevisaoOdometro || '') 
            : (vehicle.revision?.proximaRevisaoHorimetro || ''),
        avisoAntecedenciaKmHr: vehicle.revision?.avisoAntecedenciaKmHr || '',
        avisoAntecedenciaDias: vehicle.revision?.avisoAntecedenciaDias || ''
    });

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                vehicleId: vehicle.id,
                descricao: formData.descricao,
                proximaRevisaoData: formData.proximaRevisaoData || null,
                proximaRevisaoOdometro: readingInfo.unit === 'Km' ? formData.proximaRevisaoLeitura : null,
                proximaRevisaoHorimetro: readingInfo.unit === 'Hr' ? formData.proximaRevisaoLeitura : null,
                avisoAntecedenciaKmHr: formData.avisoAntecedenciaKmHr || null,
                avisoAntecedenciaDias: formData.avisoAntecedenciaDias || null
            };

            if (apiClient && apiClient.updateRevisionPlan) {
                await apiClient.updateRevisionPlan(vehicle.id, payload);
                setAlertMessage("Agendamento salvo com sucesso!");
                if (reloadData) reloadData();
                onClose();
            } else {
                alert("Simulação: Agendamento salvo!");
                onClose();
            }
        } catch (error) {
            console.error(error);
            setAlertMessage("Erro ao salvar agendamento.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="mak-modal max-w-sm">
                <div className="px-4 py-3 border-b bg-yellow-50 flex justify-between items-center">
                    <h2 className="text-base font-bold text-yellow-800 flex items-center gap-2">
                        <Calendar size={18} className="text-yellow-600"/> Agendar Manutenção
                    </h2>
                    <button onClick={onClose}><X size={18}/></button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="bg-gray-50 p-2 rounded text-xs text-gray-700 border">
                        Veículo: <strong>{vehicle.registroInterno}</strong> ({readingInfo.raw} {readingInfo.unit})
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição do Plano</label>
                        <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-yellow-500 outline-none" placeholder="Ex: Troca de Óleo 10k"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Data Meta</label>
                            <input type="date" name="proximaRevisaoData" value={formData.proximaRevisaoData} onChange={handleChange} className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-yellow-500 outline-none"/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Leitura Meta ({readingInfo.unit})</label>
                            <input type="number" name="proximaRevisaoLeitura" value={formData.proximaRevisaoLeitura} onChange={handleChange} className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-yellow-500 outline-none"/>
                        </div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mt-2">
                        <div className="text-[10px] font-bold text-yellow-700 uppercase border-b border-yellow-200 pb-1 mb-2 flex items-center gap-1">
                            <Wrench size={12}/> Alertas de Antecedência (Amarelo)
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-medium text-gray-600 mb-1">Avisar antes de (Dias)</label>
                                <input type="number" name="avisoAntecedenciaDias" value={formData.avisoAntecedenciaDias} onChange={handleChange} className="w-full p-1.5 border border-yellow-300 rounded text-xs focus:border-yellow-500 outline-none" placeholder="Padrão: 30"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-gray-600 mb-1">Avisar antes de ({readingInfo.unit})</label>
                                <input type="number" name="avisoAntecedenciaKmHr" value={formData.avisoAntecedenciaKmHr} onChange={handleChange} className="w-full p-1.5 border border-yellow-300 rounded text-xs focus:border-yellow-500 outline-none" placeholder={readingInfo.unit === 'Km' ? "Padrão: 1000" : "Padrão: 50"}/>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-3 gap-2 border-t">
                        <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-3 py-1.5 bg-[#9E7A42] text-white rounded text-xs font-bold hover:bg-yellow-600 flex items-center gap-1 shadow">
                            {isSaving ? <Loader size={12} className="animate-spin"/> : <CheckCircle size={12}/>} Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CompleteRevisionModal = ({ user, vehicle, onClose, setAlertMessage, apiClient, reloadData, PasswordConfirmationModal }) => {
    const readingInfo = getVehicleMainReading(vehicle);
    
    const suggestedNextReading = (() => {
        const current = parseFloat(readingInfo.raw || 0);
        const increment = readingInfo.unit === 'Hr' ? 250 : 10000;
        return (current + increment).toFixed(0);
    })();

    const [formData, setFormData] = useState({
        realizadaEm: new Date().toISOString().split('T')[0],
        leituraRealizada: readingInfo.raw ? readingInfo.raw.toString() : '',
        descricao: vehicle.revision?.descricao || '', 
        proximaDescricao: '',
        custo: '',
        notaFiscal: '',
        proximaRevisaoData: '',
        proximaRevisaoLeitura: '',
        avisoAntecedenciaKmHr: vehicle.revision?.avisoAntecedenciaKmHr || '',
        avisoAntecedenciaDias: vehicle.revision?.avisoAntecedenciaDias || ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [blockMessage, setBlockMessage] = useState('');

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handlePreSubmit = () => {
        if (!vehicle || !vehicle.id) {
            setAlertMessage("Erro Crítico: ID inválido.");
            return;
        }

        const fieldType = readingInfo.unit === 'Km' ? 'odometro' : 'horimetro';
        const check = checkReadingConsistency(vehicle, formData.leituraRealizada, fieldType);
        
        if (check.status === 'bloqueio') {
            setBlockMessage(check.message);
            setShowPassword(true);
        } else {
            executeSave();
        }
    };

    const executeSave = async () => {
        setIsSaving(true);
        setShowPassword(false);
        try {
            const payload = {
                vehicleId: vehicle.id,
                ...formData,
                realizadaPor: user?.email || 'Sistema'
            };

            if (apiClient && apiClient.completeRevision) {
                await apiClient.completeRevision(payload); 
                setAlertMessage("Sucesso: Manutenção registrada!");
                if (reloadData) reloadData();
                onClose();
            } else {
                alert("Simulação: Revisão concluída!");
                onClose();
            }
        } catch (error) {
            setAlertMessage(`Erro: ${error.message || "Falha ao concluir"}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-fadeInUp">
                <div className="px-4 py-3 border-b bg-green-50 flex justify-between items-center">
                    <h2 className="text-base font-bold text-green-800 flex items-center gap-2">
                        <CheckCircle size={18} className="text-green-600"/> Concluir Manutenção
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
                </div>
                
                <div className="p-4 space-y-3">
                    <div className="bg-blue-50 px-3 py-2 rounded border border-blue-100 flex justify-between items-center">
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-gray-800 truncate">{vehicle.registroInterno} - {vehicle.placa}</p>
                        </div>
                        <div className="text-right whitespace-nowrap ml-2">
                             <span className="text-[10px] text-gray-500 block uppercase">Atual</span>
                             <span className="font-mono font-bold text-blue-700 text-sm">
                                 {parseFloat(readingInfo.raw || 0).toFixed(1)} {readingInfo.unit}
                             </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Data Realização *</label>
                            <input type="date" name="realizadaEm" value={formData.realizadaEm} onChange={handleChange} className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 outline-none" required/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Nova Leitura ({readingInfo.unit}) *</label>
                            <input type="number" name="leituraRealizada" value={formData.leituraRealizada} onChange={handleChange} className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 outline-none" placeholder={readingInfo.label} required/>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Histórico: O que foi feito?</label>
                        <textarea name="descricao" value={formData.descricao} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 outline-none resize-none" rows="2" placeholder="Troca de óleo, filtros..."></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Custo Total (R$)</label>
                            <input type="number" step="0.01" name="custo" value={formData.custo} onChange={handleChange} className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 outline-none" placeholder="0.00"/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Nota Fiscal</label>
                            <input type="text" name="notaFiscal" value={formData.notaFiscal} onChange={handleChange} className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 outline-none" placeholder="Nº NF"/>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded border border-gray-200 mt-1">
                        <div className="text-[10px] font-bold text-gray-500 uppercase border-b border-gray-200 pb-1 mb-2 flex items-center gap-1">
                            <Clock size={12}/> Próxima Revisão (Meta)
                        </div>
                        
                        <div className="mb-2">
                            <label className="block text-[10px] font-medium text-gray-600 mb-1">Descrição do Próximo Agendamento</label>
                            <input type="text" name="proximaDescricao" value={formData.proximaDescricao} onChange={handleChange} className="w-full p-1.5 border border-gray-300 rounded text-xs focus:border-blue-500 outline-none" placeholder="Ex: Troca de Correias (50k)"/>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-medium text-gray-600 mb-1">Data Meta</label>
                                <input type="date" name="proximaRevisaoData" value={formData.proximaRevisaoData} onChange={handleChange} className="w-full p-1.5 border border-gray-300 rounded text-xs focus:border-blue-500 outline-none"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-gray-600 mb-1">Leitura Meta</label>
                                <input type="number" name="proximaRevisaoLeitura" value={formData.proximaRevisaoLeitura} onChange={handleChange} className="w-full p-1.5 border border-gray-300 rounded text-xs focus:border-blue-500 outline-none" placeholder={`Sug: ${suggestedNextReading}`}/>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-3 gap-2 border-t">
                        <button onClick={onClose} className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition">Cancelar</button>
                        <button onClick={handlePreSubmit} disabled={isSaving} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 flex items-center gap-1 shadow hover:shadow-md transition">
                            {isSaving ? <Loader size={14} className="animate-spin"/> : <CheckCircle size={14}/>} Confirmar
                        </button>
                    </div>
                </div>
            </div>
            
            {showPassword && (
                <PasswordConfirmationModal 
                    message={`Inconsistência:\n${blockMessage}\nSenha de supervisor necessária.`}
                    onConfirm={executeSave}
                    onClose={() => setShowPassword(false)}
                    apiClient={apiClient}
                />
            )}
        </div>
    );
};

const RevisionHistoryModal = ({ vehicle, onClose }) => {
    const history = vehicle?.revision?.historico || [];
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-fadeIn">
                <div className="p-3 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><History size={16}/> Histórico</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar bg-gray-50">
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-gray-400"><p className="text-sm">Nenhum registro.</p></div>
                    ) : (
                        history.map((h, i) => (
                            <div key={i} className="p-3 border border-gray-200 rounded bg-white shadow-sm text-sm">
                                <div className="flex justify-between font-bold text-gray-800 border-b pb-1 mb-1">
                                    <span>{new Date(h.data).toLocaleDateString('pt-BR')}</span>
                                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded border">{h.km} {getVehicleMainReading(vehicle).unit}</span>
                                </div>
                                <p className="text-gray-700 mb-1">{h.descricao}</p>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>{h.realizadaPor || 'Sistema'}</span>
                                    {h.notaFiscal && <span>NF: {h.notaFiscal}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default RevisionsTab;

