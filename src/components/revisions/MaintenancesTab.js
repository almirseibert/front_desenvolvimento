import React, { useState, useEffect } from 'react';
import { PlusCircle, Wrench, X, CheckCircle, ArrowRight, Loader } from 'lucide-react';
import ProtectedComponent from '../ProtectedComponent';
import SearchableObraSelect from '../SearchableObraSelect';
import SearchableSelect from '../SearchableSelect';

const getVehicleName = (id, vehicles) => {
    const v = vehicles.find(v => String(v.id) === String(id));
    return v ? `${v.registroInterno} - ${v.placa}` : 'Não Identificado';
}

const getObraName = (id, obras) => {
    const o = obras.find(o => String(o.id) === String(id));
    return o ? o.nome : 'Pátio / Não Alocado';
}

const MaintenancesTab = ({ vehicles = [], obras = [], setAlertMessage, apiClient }) => {
    const activeVehicles = vehicles.filter(v => !v.isOutsourced && v.ativo !== 0 && !v.isSucata);
    const [manutencoesProgramadas, setManutencoesProgramadas] = useState([]);
    const [manutencoesExecutadas, setManutencoesExecutadas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [modalNovaProgramada, setModalNovaProgramada] = useState(false);
    const [modalNovaExecutada, setModalNovaExecutada] = useState(null); 

    // Busca os dados reais do Banco de Dados
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const progData = await apiClient.get('/maintenances/scheduled');
            setManutencoesProgramadas(Array.isArray(progData) ? progData : []);
            
            const execData = await apiClient.get('/maintenances/executed');
            setManutencoesExecutadas(Array.isArray(execData) ? execData : []);
        } catch (error) {
            console.error("Erro ao buscar manutenções do banco:", error);
            setAlertMessage("Erro ao carregar os dados de manutenção.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (apiClient) fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiClient]);

    const handleExecuteProgramada = (prog) => {
        setModalNovaExecutada({
            vehicleId: prog.vehicleId,
            descricao: prog.descricao, 
            programadaId: prog.id
        });
    };

    const onSaveProgramada = async (data) => {
        try {
            await apiClient.post('/maintenances/scheduled', data);
            setAlertMessage("Relato salvo e programado com sucesso!");
            fetchData(); // Atualiza a lista com dados do banco
            setModalNovaProgramada(false);
        } catch (error) {
            console.error(error);
            setAlertMessage("Erro ao salvar relato no banco de dados.");
        }
    };

    const onSaveExecutada = async (data) => {
        try {
            await apiClient.post('/maintenances/executed', data);
            setAlertMessage(`Manutenção executada! Custo gerado na Obra: ${getObraName(data.obraId, obras)}`);
            fetchData(); // Atualiza a lista com dados do banco
            setModalNovaExecutada(null);
        } catch (error) {
            console.error(error);
            setAlertMessage("Erro ao registrar a execução da manutenção.");
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-10"><Loader className="animate-spin text-blue-600" size={32} /></div>;
    }

    return (
        <div className="animate-fadeIn space-y-6">
            {/* SEÇÃO: PROGRAMADAS (RELATOS) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="mak-modal-title">
                            <Wrench size={18} className="text-yellow-600"/> Manutenções Programadas
                        </h3>
                        <p className="text-xs text-gray-500">Defeitos, avarias ou quebras relatadas pela equipe.</p>
                    </div>
                    <ProtectedComponent requiredPermission="editor">
                        <button onClick={() => setModalNovaProgramada(true)} className="bg-[#9E7A42] text-white px-3 py-2 rounded text-xs font-bold flex items-center gap-1 hover:bg-yellow-600 shadow-sm">
                            <PlusCircle size={14} /> Novo Relato
                        </button>
                    </ProtectedComponent>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-bold text-xs uppercase">
                            <tr>
                                <th className="p-3">Veículo</th>
                                <th className="p-3">Data Relato</th>
                                <th className="p-3">Descrição / Defeito</th>
                                <th className="p-3">Relator</th>
                                <th className="p-3 text-center">Status / Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {manutencoesProgramadas.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-bold text-gray-800">{getVehicleName(item.vehicleId, vehicles)}</td>
                                    <td className="p-3">{new Date(item.dataRelato).toLocaleDateString('pt-BR')}</td>
                                    <td className="p-3 text-gray-700">{item.descricao}</td>
                                    <td className="p-3 text-gray-500">{item.relator || 'N/A'}</td>
                                    <td className="p-3 text-center">
                                        {item.status === 'Pendente' ? (
                                            <button onClick={() => handleExecuteProgramada(item)} className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-bold flex items-center justify-center gap-1 mx-auto transition shadow-sm">
                                                <ArrowRight size={12}/> Executar
                                            </button>
                                        ) : (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-1 w-fit mx-auto">
                                                <CheckCircle size={10}/> Concluído
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {manutencoesProgramadas.length === 0 && (
                                <tr><td colSpan="5" className="p-6 text-center text-gray-400 italic">Nenhum relato pendente.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SEÇÃO: EXECUTADAS */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="mak-modal-title">
                            <CheckCircle size={18} className="text-green-600"/> Manutenções Executadas
                        </h3>
                        <p className="text-xs text-gray-500">Histórico de intervenções realizadas, com custo alocado à obra.</p>
                    </div>
                    <ProtectedComponent requiredPermission="editor">
                        <button onClick={() => setModalNovaExecutada({})} className="bg-green-600 text-white px-3 py-2 rounded text-xs font-bold flex items-center gap-1 hover:bg-green-700 shadow-sm">
                            <PlusCircle size={14} /> Registrar Avulsa
                        </button>
                    </ProtectedComponent>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-bold text-xs uppercase">
                            <tr>
                                <th className="p-3">Veículo</th>
                                <th className="p-3">Data</th>
                                <th className="p-3">Centro Custo (Obra)</th>
                                <th className="p-3">Valor</th>
                                <th className="p-3">O que foi feito / Peças</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {manutencoesExecutadas.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-bold text-gray-800">{getVehicleName(item.vehicleId, vehicles)}</td>
                                    <td className="p-3">{new Date(item.dataManutencao).toLocaleDateString('pt-BR')}</td>
                                    <td className="p-3 text-xs text-gray-600 font-medium">{getObraName(item.obraId, obras)}</td>
                                    <td className="p-3 text-red-600 font-bold">R$ {parseFloat(item.valor || 0).toFixed(2)}</td>
                                    <td className="p-3">
                                        <p className="font-medium text-gray-800">{item.descricao}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Oficina: {item.oficina || 'Não informada'} | Peças: {item.pecasTrocadas || 'Nenhuma'}</p>
                                    </td>
                                </tr>
                            ))}
                            {manutencoesExecutadas.length === 0 && (
                                <tr><td colSpan="5" className="p-6 text-center text-gray-400 italic">Nenhum registro executado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalNovaProgramada && (
                <NovaProgramadaModal
                    vehicles={activeVehicles}
                    onClose={() => setModalNovaProgramada(false)}
                    onSave={onSaveProgramada}
                />
            )}

            {modalNovaExecutada && (
                <NovaExecutadaModal
                    vehicles={activeVehicles}
                    obras={obras}
                    defaultData={modalNovaExecutada} 
                    onClose={() => setModalNovaExecutada(null)}
                    onSave={onSaveExecutada}
                />
            )}
        </div>
    );
};

// ... MODAIS ...
const NovaProgramadaModal = ({ vehicles, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        vehicleId: '', dataRelato: new Date().toISOString().split('T')[0], descricao: '', relator: ''
    });
    
    const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
    
    const save = () => {
        if(!formData.vehicleId || !formData.descricao) return alert("Preencha veículo e descrição.");
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="mak-modal max-w-sm">
                <div className="px-4 py-3 border-b bg-yellow-50 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-yellow-800">Novo Relato / Defeito</h2>
                    <button onClick={onClose} className="text-gray-500"><X size={16}/></button>
                </div>
                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs font-semibold mb-1">Veículo *</label>
                        <SearchableSelect
                            items={vehicles}
                            value={formData.vehicleId}
                            onChange={(item) => handleChange({ target: { name: 'vehicleId', value: item?.id || '' } })}
                            getLabel={(v) => `${v.registroInterno} - ${v.placa}`}
                            getSubLabel={(v) => v.modelo || ''}
                            placeholder="Selecione..."
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold mb-1">Data Relato *</label>
                            <input type="date" name="dataRelato" value={formData.dataRelato} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" required/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1">Relator</label>
                            <input type="text" name="relator" value={formData.relator} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" placeholder="Nome..."/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1">Descrição do Defeito *</label>
                        <textarea name="descricao" value={formData.descricao} onChange={handleChange} rows="3" className="w-full p-2 border rounded text-sm outline-none resize-none" placeholder="Qual o problema?" required></textarea>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded">Cancelar</button>
                        <button onClick={save} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded shadow">Salvar Relato</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const NovaExecutadaModal = ({ vehicles, obras, defaultData = {}, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        vehicleId: defaultData.vehicleId || '', 
        obraId: '', 
        dataManutencao: new Date().toISOString().split('T')[0], 
        valor: '', 
        oficina: '', 
        descricao: defaultData.descricao || '', 
        pecasTrocadas: '',
        programadaId: defaultData.programadaId || null
    });

    React.useEffect(() => {
        if (formData.vehicleId && !formData.obraId) {
            const v = vehicles.find(v => String(v.id) === String(formData.vehicleId));
            if (v && v.obraAtualId) {
                setFormData(prev => ({...prev, obraId: v.obraAtualId}));
            }
        }
    }, [formData.vehicleId, vehicles]);

    const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
    
    const save = () => {
        if(!formData.vehicleId || !formData.descricao || !formData.obraId) return alert("Veículo, Obra (Centro de Custo) e Descrição são obrigatórios.");
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="mak-modal max-w-md">
                <div className="px-4 py-3 border-b bg-green-50 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-green-800">
                        {formData.programadaId ? 'Executar Manutenção Programada' : 'Registrar Manutenção Avulsa'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500"><X size={16}/></button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold mb-1">Veículo *</label>
                            <SearchableSelect
                                items={vehicles}
                                value={formData.vehicleId}
                                onChange={(item) => handleChange({ target: { name: 'vehicleId', value: item?.id || '' } })}
                                getLabel={(v) => `${v.registroInterno} - ${v.placa}`}
                                getSubLabel={(v) => v.modelo || ''}
                                placeholder="Selecione..."
                                disabled={!!formData.programadaId}
                                required
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold mb-1">Centro de Custo (Obra) *</label>
                            <SearchableObraSelect
                                obras={obras}
                                value={formData.obraId}
                                onChange={(obra) => setFormData(prev => ({...prev, obraId: obra?.id || ''}))}
                                placeholder="Selecione a Obra..."
                                includeInactive={true}
                            />
                            <p className="text-[9px] text-gray-500 mt-0.5">O valor informado será lançado como despesa nesta obra.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1">Data *</label>
                            <input type="date" name="dataManutencao" value={formData.dataManutencao} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" required/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1">Valor (R$)</label>
                            <input type="number" step="0.01" name="valor" value={formData.valor} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" placeholder="0.00"/>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold mb-1">Oficina/Mecânico</label>
                            <input type="text" name="oficina" value={formData.oficina} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" placeholder="Nome da oficina"/>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold mb-1">O que foi feito? *</label>
                            <textarea name="descricao" value={formData.descricao} onChange={handleChange} rows="2" className="w-full p-2 border rounded text-sm outline-none resize-none" placeholder="Serviço executado..." required></textarea>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold mb-1">Peças Trocadas</label>
                            <input type="text" name="pecasTrocadas" value={formData.pecasTrocadas} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" placeholder="Ex: Filtro de óleo, correia..."/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded">Cancelar</button>
                        <button onClick={save} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow">Salvar Manutenção</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenancesTab;

