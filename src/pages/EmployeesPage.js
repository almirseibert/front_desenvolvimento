import React, { useState, useMemo } from 'react';
import {
    PlusCircle,
    ChevronsUpDown,
    UserX,
    UserCheck,
    Edit,
    Clock,
    ShieldAlert,
    Trash2,
    Users,
    Loader,
    RefreshCw,
    Search,
    MapPin,
    Phone,
    Hash,
    Truck,
    CalendarCheck,
    BellRing,
    CalendarDays,
    X
} from 'lucide-react';

// Imports dos Modais
import EmployeeModal from '../components/modals/EmployeeModal';
import EmployeeHistoryModal from '../components/modals/EmployeeHistoryModal';
import EmployeeFinesModal from '../components/modals/EmployeeFinesModal';
import StatusChangeModal from '../components/modals/StatusChangeModal';

const EDITOR_ROLES_EMP = ['admin', 'gerencia', 'editor'];
const ProtectedComponent = ({ requiredPermission, user, children }) => {
    if (!user || !user.user_type) return null;
    const userRole = user.user_type.toLowerCase();
    const requiredRole = requiredPermission.toLowerCase();
    if (requiredRole === 'admin' && userRole !== 'admin') return null;
    if (requiredRole === 'editor' && !EDITOR_ROLES_EMP.includes(userRole)) return null;
    return <>{children}</>;
};

// --- MODAL INLINE: AFASTAMENTO / FÉRIAS ---
const LeaveStatusModal = ({ employee, onClose, apiClient, reloadData, setAlertMessage }) => {
    const [tipo, setTipo] = useState(employee.statusAfastamentoTipo || 'ferias');
    const [dataTermino, setDataTermino] = useState(
        employee.statusAfastamentoTermino ? new Date(employee.statusAfastamentoTermino).toISOString().split('T')[0] : ''
    );
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiClient.post(`/employees/${employee.id}/leave-status`, { tipo, dataTermino });
            setAlertMessage('Status de afastamento atualizado!');
            reloadData();
            onClose();
        } catch (error) {
            setAlertMessage('Erro ao atualizar afastamento.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async () => {
        setIsSaving(true);
        try {
            await apiClient.post(`/employees/${employee.id}/leave-status`, { tipo: null, dataTermino: null });
            setAlertMessage('Funcionário retornou às atividades normais!');
            reloadData();
            onClose();
        } catch (error) {
            setAlertMessage('Erro ao retornar funcionário.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold flex items-center gap-2"><CalendarDays className="text-orange-500" size={20}/> Gerenciar Afastamento</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded text-gray-500"><X size={20} /></button>
                </div>
                <div className="p-4 space-y-4">
                    <p className="text-sm text-gray-600">Configurando para: <strong>{employee.nome}</strong></p>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Motivo / Tipo</label>
                        <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-orange-400 outline-none text-sm">
                            <option value="ferias">Férias</option>
                            <option value="atestado">Atestado / Licença</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Data Prevista de Retorno (Fim do Prazo)</label>
                        <input type="date" value={dataTermino} onChange={e => setDataTermino(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-orange-400 outline-none text-sm"/>
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-between gap-2">
                    {employee.statusAfastamentoTipo ? (
                        <button onClick={handleRemove} disabled={isSaving} className="px-4 py-2 border border-green-500 text-green-700 hover:bg-green-50 font-bold rounded-lg text-sm">Finalizar Antecipado</button>
                    ) : <div></div>}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100 font-bold">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving || !dataTermino} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-sm disabled:opacity-50">
                            {isSaving ? 'Salvando...' : 'Aplicar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmployeesPage = ({ 
    user, 
    employees = [], 
    vehicles = [], 
    fines = [], 
    apiClient, 
    setAlertMessage, 
    reloadData, 
    PasswordConfirmationModal 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('ativos');
    const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'ascending' });
    
    // Controle dos Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isFinesModalOpen, setIsFinesModalOpen] = useState(false);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Estados de Seleção
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [employeeForHistory, setEmployeeForHistory] = useState(null);
    const [employeeForFines, setEmployeeForFines] = useState(null);
    const [employeeForStatusChange, setEmployeeForStatusChange] = useState(null);
    const [employeeToDelete, setEmployeeToDelete] = useState(null);

    // Modal RH
    const [leaveModalEmp, setLeaveModalEmp] = useState(null);

    const [isSyncing, setIsSyncing] = useState(false);

    const calculateDaysAvailable = (lastDate) => {
        if (!lastDate) return 0;
        const end = new Date(lastDate);
        const now = new Date();
        const diffTime = Math.abs(now - end);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getAllocationInfo = (employeeId) => {
        const emp = employees.find(e => e.id === employeeId);
        
        if (emp && emp.alocacaoAtual && emp.alocacaoAtual.isAllocated) {
            return {
                status: 'alocado',
                description: emp.alocacaoAtual.description || 'Alocado'
            };
        }

        if (!vehicles || vehicles.length === 0) return { status: 'disponivel', description: 'Disponível' };

        const allocatedVehicles = vehicles.filter(v => {
            let isAssigned = false;
            if (v.operationalAssignment) {
                let assignment = v.operationalAssignment;
                if (typeof assignment === 'string') {
                    try { assignment = JSON.parse(assignment); } catch(e) {}
                }
                if (assignment && assignment.employeeId && String(assignment.employeeId) === String(employeeId)) {
                    isAssigned = true;
                }
            }
            const isDriver = v.driverId && String(v.driverId) === String(employeeId);
            return isAssigned || isDriver;
        });
        
        if (allocatedVehicles.length > 0) {
            const vehicleNames = allocatedVehicles.map(v => {
                if (v.registroInterno) return `${v.registroInterno}`;
                if (v.placa) return `Placa: ${v.placa}`;
                return v.modelo || 'Veículo';
            });
            return { status: 'alocado', description: vehicleNames.join(', ') };
        }

        return { status: 'disponivel', description: 'Disponível' };
    };

    const processedEmployees = useMemo(() => {
        return employees.filter(emp => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                (emp.nome && emp.nome.toLowerCase().includes(searchLower)) ||
                (emp.vulgo && emp.vulgo.toLowerCase().includes(searchLower)) ||
                (emp.funcao && emp.funcao.toLowerCase().includes(searchLower)) ||
                (emp.cidade && emp.cidade.toLowerCase().includes(searchLower)) ||
                (emp.registroInterno && emp.registroInterno.toString().includes(searchLower));

            if (!matchesSearch) return false;

            const statusLower = emp.status ? emp.status.toLowerCase() : 'ativo';
            const isInactive = statusLower === 'inativo' || statusLower === 'desligado';
            
            if (activeTab === 'ativos') return !isInactive;
            if (activeTab === 'inativos') return isInactive;
            
            return true;
        });
    }, [employees, searchTerm, activeTab]);

    const sortedEmployees = useMemo(() => {
        let sortableItems = [...processedEmployees];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key] ? a[sortConfig.key].toString().toLowerCase() : '';
                const valB = b[sortConfig.key] ? b[sortConfig.key].toString().toLowerCase() : '';
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [processedEmployees, sortConfig]);

    const counts = useMemo(() => {
        const inativos = employees.filter(e => {
            const s = e.status ? e.status.toLowerCase() : '';
            return s === 'inativo' || s === 'desligado';
        }).length;
        return {
            ativos: employees.length - inativos,
            inativos: inativos
        };
    }, [employees]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleDelete = async () => {
        if (employeeToDelete) {
            try {
                await apiClient.deleteEmployee(employeeToDelete.id);
                setAlertMessage('Funcionário excluído com sucesso.');
                setIsDeleteModalOpen(false);
                setEmployeeToDelete(null);
                reloadData();
            } catch (error) {
                setAlertMessage('Erro ao excluir: ' + (error.message || 'Erro desconhecido'));
            }
        }
    };

    const handleConfirmStatusChange = async (date) => {
        if (employeeForStatusChange) {
            try {
                const currentStatus = employeeForStatusChange.status ? employeeForStatusChange.status.toLowerCase() : '';
                const newStatus = (currentStatus === 'ativo') ? 'inativo' : 'ativo';
                
                await apiClient.put(`/employees/${employeeForStatusChange.id}/status`, {
                    status: newStatus,
                    date: date
                });

                setAlertMessage(`Status alterado para ${newStatus.toUpperCase()}.`);
                setIsStatusModalOpen(false);
                setEmployeeForStatusChange(null);
                reloadData();
            } catch (error) {
                setAlertMessage('Erro ao alterar status: ' + error.message);
            }
        }
    };

    const handleSyncUsers = async () => {
        if (!window.confirm("Esta ação criará logins para todos os funcionários ativos sem acesso.\nLogin: CPF@frotamak.com | Senha: CPF\n\nContinuar?")) {
            return;
        }
        setIsSyncing(true);
        try {
            const response = await apiClient.post('/employees/sync-users', {});
            setAlertMessage(`Sincronização concluída! ${response.details || response.message}`);
        } catch (error) {
            setAlertMessage("Erro ao sincronizar: " + (error.message || "Erro desconhecido"));
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-fadeIn space-y-6">
            
            {/* Cabeçalho */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-xl" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
                <div>
                    <h1 className="flex items-center gap-2" style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14' }}>
                        <Users size={20} style={{ color: '#9E7A42' }}/> Gestão de Funcionários
                    </h1>
                    <p style={{ fontSize: 13, color: '#9a8a78', marginTop: 2 }}>Gerencie cadastros, alocações e documentos.</p>
                </div>

                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <ProtectedComponent requiredPermission="admin" user={user}>
                        <button onClick={handleSyncUsers} disabled={isSyncing}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 mak-btn mak-btn-dark text-sm">
                            {isSyncing ? <Loader className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                            Sincronizar Acessos
                        </button>
                    </ProtectedComponent>
                    <ProtectedComponent requiredPermission="editor" user={user}>
                        <button onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 mak-btn mak-btn-primary text-sm">
                            <PlusCircle size={16}/> Novo Funcionário
                        </button>
                    </ProtectedComponent>
                </div>
            </div>

            {/* Abas e Busca */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
                <div className="flex flex-col md:flex-row" style={{ borderBottom: '1px solid #f0ebe3' }}>
                    <div className="flex w-full md:w-auto">
                        <button onClick={() => setActiveTab('ativos')}
                            className="flex-1 md:flex-none px-6 py-3.5 text-sm font-bold flex items-center gap-2 transition-colors"
                            style={{ borderBottom: activeTab === 'ativos' ? '2px solid #9E7A42' : '2px solid transparent', color: activeTab === 'ativos' ? '#9E7A42' : '#9a8a78', background: activeTab === 'ativos' ? '#fdf8f0' : 'transparent', border: 'none', borderBottom: activeTab === 'ativos' ? '2px solid #9E7A42' : '2px solid transparent', cursor: 'pointer' }}>
                            Ativos
                            <span style={{ background: '#d1fae5', color: '#065f46', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 9999 }}>{counts.ativos}</span>
                        </button>
                        <button onClick={() => setActiveTab('inativos')}
                            className="flex-1 md:flex-none px-6 py-3.5 text-sm font-bold flex items-center gap-2 transition-colors"
                            style={{ borderBottom: activeTab === 'inativos' ? '2px solid #b03828' : '2px solid transparent', color: activeTab === 'inativos' ? '#b03828' : '#9a8a78', background: activeTab === 'inativos' ? '#fdf0ec' : 'transparent', border: 'none', borderBottom: activeTab === 'inativos' ? '2px solid #b03828' : '2px solid transparent', cursor: 'pointer' }}>
                            Inativos
                            <span style={{ background: '#fdf0ec', color: '#b03828', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 9999 }}>{counts.inativos}</span>
                        </button>
                    </div>

                    <div className="flex-1 p-3 flex items-center" style={{ borderLeft: '1px solid #f0ebe3' }}>
                        <div className="relative w-full max-w-md mx-auto md:mr-auto md:ml-4">
                            <Search className="absolute left-3 top-2.5" size={15} style={{ color: '#b0a090' }} />
                            <input
                                type="text"
                                placeholder="Buscar: Nome, Vulgo, Função, Cidade, Registro..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('nome')}>
                                    Nome / Registro <ChevronsUpDown size={14} className="inline ml-1 text-gray-400"/>
                                </th>
                                <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('funcao')}>
                                    Função <ChevronsUpDown size={14} className="inline ml-1 text-gray-400"/>
                                </th>
                                <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('cidade')}>
                                    Cidade <ChevronsUpDown size={14} className="inline ml-1 text-gray-400"/>
                                </th>
                                <th className="p-4">Contato</th>
                                <th className="p-4 text-center">Status / Alocação</th>
                                <th className="p-4 text-center">Ações RH</th>
                                <th className="p-4 text-center">Ações Gerais</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {sortedEmployees.map(emp => {
                                const allocation = getAllocationInfo(emp.id);
                                const isInactive = emp.status && (emp.status.toLowerCase() === 'inativo' || emp.status.toLowerCase() === 'desligado');
                                const isOnLeave = emp.statusAfastamentoTipo != null;
                                
                                // Verifica se retornou de férias há menos de 7 dias
                                const returnedRecently = emp.dataRetornoAfastamento && Math.abs(new Date() - new Date(emp.dataRetornoAfastamento)) <= (7 * 86400000);
                                
                                // Cálculo de dias disponíveis
                                const daysAvailable = allocation.status === 'disponivel' && emp.lastAllocationEnd 
                                    ? calculateDaysAvailable(emp.lastAllocationEnd) 
                                    : 0;

                                return (
                                    <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${isInactive ? 'bg-gray-50/50' : (isOnLeave ? 'bg-orange-50/30' : '')}`}>
                                        
                                        {/* Nome e Registro */}
                                        <td className="p-4 align-top">
                                            <div className="font-bold text-gray-800 text-base flex items-center gap-2">
                                                {emp.nome} 
                                                {emp.vulgo && <span className="text-gray-500 font-normal ml-1">({emp.vulgo})</span>}
                                                {returnedRecently && <BellRing size={16} className="text-blue-500 animate-pulse" title="Retornou de Afastamento Recentemente" />}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono mt-0.5 flex items-center gap-1" title="Registro Interno">
                                                <Hash size={10} />
                                                Reg: {emp.registroInterno || '-'}
                                            </div>
                                        </td>

                                        {/* Função */}
                                        <td className="p-4 align-top text-gray-700 font-medium">
                                            {emp.funcao || '-'}
                                        </td>

                                        {/* Cidade */}
                                        <td className="p-4 align-top text-gray-600">
                                            <div className="flex items-start gap-1.5">
                                                <MapPin size={14} className="mt-0.5 text-gray-400 shrink-0"/>
                                                {emp.cidade || emp.endereco || '-'}
                                            </div>
                                        </td>

                                        {/* Contato */}
                                        <td className="p-4 align-top text-gray-600">
                                            {emp.contato || emp.telefone ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Phone size={14} className="text-gray-400"/>
                                                    {emp.contato || emp.telefone}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs">Sem contato</span>
                                            )}
                                        </td>

                                        {/* Status e Alocação */}
                                        <td className="p-4 align-top text-center">
                                            {isInactive ? (
                                                 <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-red-100 text-red-700">
                                                    Inativo
                                                 </span>
                                            ) : isOnLeave ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase bg-orange-100 text-orange-700 border border-orange-200">
                                                        {emp.statusAfastamentoTipo}
                                                    </span>
                                                    {emp.statusAfastamentoTermino && <span className="text-[10px] text-gray-500">Volta: {new Date(emp.statusAfastamentoTermino).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    {allocation.status === 'alocado' ? (
                                                        <>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                                                <Truck size={12}/> Alocado
                                                            </span>
                                                            <span className="text-xs text-gray-600 font-bold max-w-[160px] text-center" title={allocation.description}>
                                                                {allocation.description}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                                                Disponível
                                                            </span>
                                                            {daysAvailable > 0 ? (
                                                                <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium bg-gray-50 px-1.5 py-0.5 rounded " style={{ border: "1px solid #f0ebe3" }}>
                                                                    <CalendarCheck size={10}/> +{daysAvailable} dias
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400 italic">Nunca Alocado</span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* COLUNA: AÇÕES DE RH (Afastamento mantido) */}
                                        <td className="p-4 align-top">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => setLeaveModalEmp(emp)} className={`p-2 rounded-lg transition-colors ${isOnLeave ? 'text-orange-600 bg-orange-100' : 'text-orange-500 hover:bg-orange-50'}`} title="Gerenciar Férias / Afastamento">
                                                    <CalendarDays size={18}/>
                                                </button>
                                            </div>
                                        </td>

                                        {/* COLUNA: AÇÕES GERAIS */}
                                        <td className="p-4 align-top">
                                            <div className="flex justify-center gap-1">
                                                <button 
                                                    onClick={() => { setEmployeeForHistory(emp); setIsHistoryModalOpen(true); }} 
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                                                    title="Histórico de Obras"
                                                >
                                                    <Clock size={18}/>
                                                </button>
                                                
                                                <button 
                                                    onClick={() => { setEmployeeForFines(emp); setIsFinesModalOpen(true); }} 
                                                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" 
                                                    title="Visualizar Multas"
                                                >
                                                    <ShieldAlert size={18}/>
                                                </button>

                                                <ProtectedComponent requiredPermission="editor" user={user}>
                                                    <button 
                                                        onClick={() => { setEditingEmployee(emp); setIsModalOpen(true); }} 
                                                        className="p-2 text-yellow-600 hover:bg-[#fdf8f0] rounded-lg transition-colors" 
                                                        title="Editar Cadastro"
                                                    >
                                                        <Edit size={18}/>
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={() => { setEmployeeForStatusChange(emp); setIsStatusModalOpen(true); }} 
                                                        className={`p-2 rounded-lg transition-colors ${
                                                            isInactive ? 'text-green-600 hover:bg-green-50' : 'text-gray-500 hover:bg-gray-100'
                                                        }`}
                                                        title={isInactive ? "Reativar Funcionário" : "Inativar Funcionário"}
                                                    >
                                                        {isInactive ? <UserCheck size={18}/> : <UserX size={18}/>}
                                                    </button>
                                                </ProtectedComponent>
                                                
                                                <ProtectedComponent requiredPermission="admin" user={user}>
                                                    <button 
                                                        onClick={() => { setEmployeeToDelete(emp); setIsDeleteModalOpen(true); }} 
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                                        title="Excluir Definitivamente"
                                                    >
                                                        <Trash2 size={18}/>
                                                    </button>
                                                </ProtectedComponent>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {sortedEmployees.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="text-center p-8 text-gray-400 italic">
                                        Nenhum funcionário encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modais Gerais */}
            {isModalOpen && (
                <EmployeeModal 
                    user={user} 
                    employee={editingEmployee} 
                    onClose={() => setIsModalOpen(false)} 
                    setAlertMessage={setAlertMessage} 
                    apiClient={apiClient} 
                    reloadData={reloadData}
                />
            )}
            
            {isHistoryModalOpen && (
                <EmployeeHistoryModal 
                    employee={employeeForHistory} 
                    onClose={() => setIsHistoryModalOpen(false)} 
                    apiClient={apiClient} 
                />
            )}
            
            {isFinesModalOpen && (
                <EmployeeFinesModal 
                    employee={employeeForFines} 
                    fines={fines} 
                    onClose={() => setIsFinesModalOpen(false)} 
                />
            )}
            
            {isStatusModalOpen && employeeForStatusChange && (
                <StatusChangeModal 
                    employee={employeeForStatusChange} 
                    onClose={() => setIsStatusModalOpen(false)} 
                    onConfirm={handleConfirmStatusChange} 
                />
            )}

            {isDeleteModalOpen && PasswordConfirmationModal && (
                <PasswordConfirmationModal 
                    message="ATENÇÃO: Confirme sua senha para EXCLUIR este funcionário permanentemente." 
                    onConfirm={handleDelete} 
                    onClose={() => setIsDeleteModalOpen(false)} 
                    apiClient={apiClient} 
                />
            )}

            {/* Modal RH */}
            {leaveModalEmp && (
                <LeaveStatusModal 
                    employee={leaveModalEmp} 
                    onClose={() => setLeaveModalEmp(null)} 
                    apiClient={apiClient} 
                    reloadData={reloadData} 
                    setAlertMessage={setAlertMessage} 
                />
            )}
        </div>
    );
};

export default EmployeesPage;


