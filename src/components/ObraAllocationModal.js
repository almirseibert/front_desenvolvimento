import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Loader, X, AlertTriangle, Shield, Calendar, Gauge, MapPin, ChevronDown, Search, User, Building2 } from 'lucide-react';
import FinishObraModal from './FinishObraModal';
import { getAllowedReadingTypes, getVehicleMainReading, checkVehicleRestrictions, checkReadingConsistency } from '../utils/vehicleRules';

// --- Seletor de funcionário com pesquisa ---
const EmployeeSelector = ({ employees, value, onChange, accentColor = 'green' }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    const inputRef = useRef(null);

    const ring = accentColor === 'green' ? 'focus:ring-green-500 border-green-300' : 'focus:ring-blue-500 border-blue-300';
    const hover = accentColor === 'green' ? 'hover:bg-green-50' : 'hover:bg-blue-50';
    const selected_bg = accentColor === 'green' ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800';

    const filtered = useMemo(() =>
        employees.filter(e =>
            e.nome.toLowerCase().includes(search.toLowerCase()) ||
            (e.funcao || '').toLowerCase().includes(search.toLowerCase())
        ),
    [employees, search]);

    const selected = employees.find(e => String(e.id) === String(value));

    useEffect(() => {
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) inputRef.current.focus();
    }, [isOpen]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(o => !o)}
                className={`w-full p-2.5 border rounded-lg text-sm flex justify-between items-center bg-white transition focus:outline-none focus:ring-2 ${ring} ${!selected ? 'text-gray-400' : 'text-gray-800'}`}
            >
                <span className="flex items-center gap-2 truncate">
                    <User size={13} className="text-gray-400 shrink-0" />
                    {selected ? (
                        <span className="truncate">
                            {selected.nome}
                            {selected.funcao && <span className="text-gray-400 ml-1">· {selected.funcao}</span>}
                        </span>
                    ) : 'Selecione um funcionário...'}
                </span>
                <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 flex flex-col overflow-hidden">
                    <div className="p-2 border-b bg-gray-50">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Pesquisar por nome ou função..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-7 pr-3 py-1.5 text-xs border rounded focus:ring-1 focus:ring-green-500 focus:border-green-400 outline-none bg-white"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-44 custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="p-3 text-xs text-gray-400 text-center italic">Nenhum resultado para "{search}"</div>
                        ) : (
                            filtered.map(e => (
                                <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => { onChange(String(e.id)); setIsOpen(false); setSearch(''); }}
                                    className={`w-full text-left px-3 py-2 text-sm transition flex justify-between items-center ${hover} ${String(value) === String(e.id) ? selected_bg + ' font-semibold' : ''}`}
                                >
                                    <span>{e.nome}</span>
                                    {e.funcao && <span className="text-[11px] text-gray-400 ml-2 shrink-0">{e.funcao}</span>}
                                </button>
                            ))
                        )}
                    </div>

                    <div className="px-3 py-1.5 border-t bg-gray-50 text-[10px] text-gray-400 text-right">
                        {filtered.length} de {employees.length} funcionário(s) ativo(s)
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Modal principal ---
const ObraAllocationModal = ({
    user,
    vehicle,
    obras = [],
    employees = [],
    revisions = [],
    onClose,
    setAlertMessage,
    apiClient,
    reloadData,
    PasswordConfirmationModal
}) => {
    const isAllocated = !!vehicle.obraAtualId;

    const currentObraAllocation = useMemo(() => {
        return (Array.isArray(vehicle.history) ? vehicle.history : [])
            .find(h => (h.type === 'obra' || h.historyType === 'obra') && !h.endDate && !h.dataSaida);
    }, [vehicle.history]);

    // Data de entrada real buscada direto do historicoVeiculos da obra (fonte confiável)
    const realEntryDate = useMemo(() => {
        if (!vehicle.obraAtualId) return null;
        const obraData = obras.find(o => o.id === vehicle.obraAtualId);
        if (!obraData) return null;
        const historico = Array.isArray(obraData.historicoVeiculos) ? obraData.historicoVeiculos : [];
        const entry = historico.find(h => String(h.veiculoId) === String(vehicle.id) && !h.dataSaida);
        if (!entry?.dataEntrada) return null;
        try {
            return new Date(entry.dataEntrada).toISOString().split('T')[0];
        } catch {
            return null;
        }
    }, [vehicle.obraAtualId, vehicle.id, obras]);

    const [obraId, setObraId] = useState(isAllocated ? vehicle.obraAtualId : '');
    const [employeeId, setEmployeeId] = useState(currentObraAllocation?.details?.employeeId || '');

    const today = new Date().toISOString().split('T')[0];
    const [dataEntrada, setDataEntrada] = useState(today);
    const [dataSaida, setDataSaida] = useState(today);

    const [locationAfterDeallocate, setLocationAfterDeallocate] = useState('Pátio MAK Lajeado');
    const [observacoes, setObservacoes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [restrictionAlert, setRestrictionAlert] = useState(null);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [blockedAction, setBlockedAction] = useState(null);

    const allowedTypes = getAllowedReadingTypes(vehicle.tipo);
    const readingType = allowedTypes.includes('horimetro') ? 'horimetro' : 'odometro';
    const readingLabel = readingType === 'horimetro' ? 'Horímetro' : 'Odômetro';
    const currentVehicleReading = getVehicleMainReading(vehicle).value || '';
    const [readingValue, setReadingValue] = useState(currentVehicleReading.toString());

    const activeObras = useMemo(() =>
        obras.filter(o => o.status === 'ativa').sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
    [obras]);

    // Somente funcionários com status 'ativo'
    const activeEmployees = useMemo(() =>
        (employees || [])
            .filter(e => e.status === 'ativo')
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
    [employees]);

    const [isFinishObraModalOpen, setIsFinishObraModalOpen] = useState(false);
    const [obraToFinalize, setObraToFinalize] = useState(null);

    const currentObra = obras.find(o => o.id === vehicle.obraAtualId);

    const validateRestrictions = () => {
        setRestrictionAlert(null);
        const staticIssues = checkVehicleRestrictions(vehicle, revisions);
        const consistencyIssue = checkReadingConsistency(vehicle, readingValue, readingType);
        if (consistencyIssue.status === 'bloqueio') {
            staticIssues.push({ type: 'bloqueio', message: consistencyIssue.message });
        }
        const blockingIssues = staticIssues.filter(i => i.type === 'bloqueio' || i.type === 'vencido' || i.category === 'bloqueio');
        const warningIssues = staticIssues.filter(i => i.type === 'aviso' || i.type === 'warning');
        if (blockingIssues.length > 0 || warningIssues.length > 0) {
            setRestrictionAlert(staticIssues.map(i => i.message));
            return false;
        }
        return true;
    };

    const handleAllocateClick = (e) => {
        e.preventDefault();
        const readingFloat = parseFloat(readingValue);
        if (!obraId || !employeeId || readingValue === '' || isNaN(readingFloat)) {
            setAlertMessage('Preencha todos os campos obrigatórios.');
            return;
        }
        if (!validateRestrictions()) {
            setBlockedAction(() => executeAllocate);
            return;
        }
        executeAllocate();
    };

    const executeAllocate = async () => {
        setIsSaving(true);
        const selectedEmployee = employees.find(e => String(e.id) === String(employeeId));
        const employeeName = selectedEmployee ? selectedEmployee.nome : 'N/A';
        const val = parseFloat(readingValue);
        try {
            await apiClient.allocateVehicleToObra(vehicle.id, {
                obraId,
                employeeId,
                employeeName,
                dataEntrada,
                readingType,
                readingValue: val,
                observacoes: observacoes || '',
                horimetroEntrada: readingType === 'horimetro' ? val : 0,
                odometroEntrada: readingType === 'odometro' ? val : 0,
                horimetro: readingType === 'horimetro' ? val : 0,
                odometro: readingType === 'odometro' ? val : 0,
            });
            setAlertMessage('Veículo alocado com sucesso!');
            reloadData();
            onClose();
        } catch (error) {
            const msg = error.response?.data?.sqlMessage
                ? `Erro SQL: ${error.response.data.sqlMessage}`
                : (error.response?.data?.error || error.message);
            setAlertMessage('Erro ao alocar: ' + msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeallocateClick = () => {
        const readingFloat = parseFloat(readingValue);
        if (readingValue === '' || isNaN(readingFloat)) {
            setAlertMessage('Informe a leitura de saída.');
            return;
        }
        if (realEntryDate && dataSaida && new Date(dataSaida) < new Date(realEntryDate)) {
            setAlertMessage(`A data de saída (${new Date(dataSaida + 'T12:00:00').toLocaleDateString('pt-BR')}) não pode ser anterior à data de entrada (${new Date(realEntryDate + 'T12:00:00').toLocaleDateString('pt-BR')}).`);
            return;
        }
        if (!validateRestrictions()) {
            setBlockedAction(() => checkAndDeallocate);
            return;
        }
        checkAndDeallocate();
    };

    const checkAndDeallocate = () => {
        if (realEntryDate && dataSaida && new Date(dataSaida) < new Date(realEntryDate)) {
            setAlertMessage(`A data de saída (${new Date(dataSaida + 'T12:00:00').toLocaleDateString('pt-BR')}) não pode ser anterior à data de entrada (${new Date(realEntryDate + 'T12:00:00').toLocaleDateString('pt-BR')}).`);
            return;
        }
        const obraData = obras.find(o => o.id === vehicle.obraAtualId);
        if (!obraData) {
            executeDeallocate(false, null);
            return;
        }
        const historico = Array.isArray(obraData.historicoVeiculos) ? obraData.historicoVeiculos : [];
        const otherActiveVehicles = historico.filter(h => h.veiculoId !== vehicle.id && !h.dataSaida);
        if (otherActiveVehicles.length === 0) {
            setObraToFinalize(obraData);
            setIsFinishObraModalOpen(true);
        } else {
            executeDeallocate(false, null);
        }
    };

    const executeDeallocate = async (shouldFinalizeObra, dataFimObra) => {
        setIsSaving(true);
        const val = parseFloat(readingValue);
        try {
            await apiClient.deallocateVehicleFromObra(vehicle.id, {
                dataSaida,
                readingType,
                readingValue: val,
                location: locationAfterDeallocate,
                shouldFinalizeObra,
                dataFimObra,
                obraId: vehicle.obraAtualId,
                observacoes: observacoes || '',
                horimetroSaida: readingType === 'horimetro' ? val : 0,
                odometroSaida: readingType === 'odometro' ? val : 0,
                horimetro: readingType === 'horimetro' ? val : 0,
                odometro: readingType === 'odometro' ? val : 0,
            });
            setAlertMessage('Desalocado com sucesso!');
            reloadData();
            onClose();
        } catch (error) {
            const msg = error.response?.data?.sqlMessage
                ? `Erro SQL: ${error.response.data.sqlMessage}`
                : (error.response?.data?.error || error.message);
            setAlertMessage('Erro ao desalocar: ' + msg);
        } finally {
            setIsSaving(false);
        }
    };

    const accentColor = isAllocated ? 'red' : 'green';
    const headerBg = isAllocated
        ? 'bg-gradient-to-r from-red-600 to-red-700'
        : 'bg-gradient-to-r from-green-600 to-green-700';

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] animate-scale-in overflow-hidden">

                    {/* Cabeçalho colorido */}
                    <div className={`p-4 flex justify-between items-start ${headerBg} text-white rounded-t-xl`}>
                        <div>
                            <h2 className="text-base font-bold">
                                {isAllocated ? 'Desalocar Veículo da Obra' : 'Alocar Veículo em Obra'}
                            </h2>
                            <p className="text-xs opacity-80 mt-0.5">
                                {vehicle.registroInterno} · {vehicle.placa} · {readingLabel} atual: <strong>{currentVehicleReading}</strong>
                            </p>
                        </div>
                        <button onClick={onClose} disabled={isSaving} className="p-1.5 rounded-full hover:bg-white hover:bg-opacity-20 transition">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                        {/* Alerta de restrição */}
                        {restrictionAlert && (
                            <div className="bg-red-50 p-3 rounded-lg border border-red-200 flex items-start gap-3">
                                <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                                <div className="flex-1">
                                    <p className="font-bold text-red-800 text-xs uppercase mb-1">Restrições encontradas</p>
                                    <ul className="list-disc list-inside text-xs text-red-700 mb-2 space-y-0.5">
                                        {restrictionAlert.map((msg, i) => <li key={i}>{msg}</li>)}
                                    </ul>
                                    <button
                                        onClick={() => setShowPasswordConfirm(true)}
                                        className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 hover:bg-red-700 w-full justify-center"
                                    >
                                        <Shield size={12} /> LIBERAR COM SENHA GERENCIAL
                                    </button>
                                </div>
                            </div>
                        )}

                        {isAllocated ? (
                            /* ── DESALOCAÇÃO ── */
                            <div className="space-y-4">
                                {/* Info da obra atual */}
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-3">
                                    <Building2 size={16} className="text-gray-500 shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-semibold text-gray-800">{currentObra?.nome || 'Obra não identificada'}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Operador: <strong>{currentObraAllocation?.details?.employeeName || '—'}</strong>
                                            {realEntryDate && (
                                                <span className="ml-2">· Entrada: <strong>{new Date(realEntryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Data e leitura de saída */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                            <Calendar size={12} /> Data de Saída
                                        </label>
                                        <input
                                            type="date"
                                            value={dataSaida}
                                            min={realEntryDate || undefined}
                                            onChange={e => setDataSaida(e.target.value)}
                                            className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                            <Gauge size={12} /> {readingLabel} de Saída
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={readingValue}
                                            onChange={e => setReadingValue(e.target.value)}
                                            className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                                            placeholder="Leitura final"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                        <MapPin size={12} /> Destino após saída
                                    </label>
                                    <input
                                        type="text"
                                        value={locationAfterDeallocate}
                                        onChange={e => setLocationAfterDeallocate(e.target.value)}
                                        className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                                        placeholder="Ex: Pátio Sede"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Observações</label>
                                    <textarea
                                        rows="2"
                                        value={observacoes}
                                        onChange={e => setObservacoes(e.target.value)}
                                        className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none resize-none"
                                        placeholder="Observações sobre a saída..."
                                    />
                                </div>

                                <button
                                    onClick={handleDeallocateClick}
                                    disabled={isSaving}
                                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-lg shadow text-sm flex items-center justify-center gap-2 transition"
                                >
                                    {isSaving ? <Loader className="animate-spin" size={16} /> : 'Finalizar & Desalocar'}
                                </button>
                            </div>
                        ) : (
                            /* ── ALOCAÇÃO ── */
                            <div className="space-y-4">
                                {/* Obra destino */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                        <Building2 size={12} /> Obra Destino <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={obraId}
                                        onChange={e => setObraId(e.target.value)}
                                        className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none"
                                    >
                                        <option value="">Selecione a obra...</option>
                                        {activeObras.map(o => (
                                            <option key={o.id} value={o.id}>{o.nome}</option>
                                        ))}
                                    </select>
                                    {activeObras.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-1">Nenhuma obra ativa cadastrada.</p>
                                    )}
                                </div>

                                {/* Funcionário com busca */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                        <User size={12} /> Operador Responsável <span className="text-red-500">*</span>
                                    </label>
                                    <EmployeeSelector
                                        employees={activeEmployees}
                                        value={employeeId}
                                        onChange={setEmployeeId}
                                        accentColor="green"
                                    />
                                    {activeEmployees.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-1">Nenhum funcionário ativo encontrado.</p>
                                    )}
                                </div>

                                {/* Data e leitura de entrada */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                            <Calendar size={12} /> Data de Entrada <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={dataEntrada}
                                            onChange={e => setDataEntrada(e.target.value)}
                                            className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                            <Gauge size={12} /> {readingLabel} Entrada <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={readingValue}
                                            onChange={e => setReadingValue(e.target.value)}
                                            className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none"
                                            placeholder="Leitura inicial"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Observações</label>
                                    <textarea
                                        rows="2"
                                        value={observacoes}
                                        onChange={e => setObservacoes(e.target.value)}
                                        className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none resize-none"
                                        placeholder="Observações iniciais..."
                                    />
                                </div>

                                <button
                                    onClick={handleAllocateClick}
                                    disabled={isSaving}
                                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold rounded-lg shadow text-sm flex items-center justify-center gap-2 transition"
                                >
                                    {isSaving ? <Loader className="animate-spin" size={16} /> : 'Confirmar Alocação'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isFinishObraModalOpen && (
                <FinishObraModal
                    obra={obraToFinalize}
                    onClose={() => { setIsFinishObraModalOpen(false); executeDeallocate(false, null); }}
                    onConfirm={(dataFim) => { setIsFinishObraModalOpen(false); executeDeallocate(true, dataFim); }}
                />
            )}

            {showPasswordConfirm && PasswordConfirmationModal && (
                <PasswordConfirmationModal
                    message="Autorizar ação com restrições?"
                    onConfirm={async () => {
                        if (blockedAction) await blockedAction();
                        setShowPasswordConfirm(false);
                        setBlockedAction(null);
                    }}
                    onClose={() => { setShowPasswordConfirm(false); setBlockedAction(null); }}
                />
            )}
        </>
    );
};

export default ObraAllocationModal;
