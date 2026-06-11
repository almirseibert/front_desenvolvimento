import React, { useState, useEffect } from 'react';
import { PlusCircle, Droplet, Users, X, Trash2, Edit2, CheckCircle, Loader } from 'lucide-react';
import ProtectedComponent from '../ProtectedComponent';
import SearchableObraSelect from '../SearchableObraSelect';
import SearchableSelect from '../SearchableSelect';
import { formatObraNome } from '../../utils/obraFormat';

const getVehicleName = (id, vehicles) => {
    const v = vehicles.find(v => String(v.id) === String(id));
    return v ? `${v.registroInterno} - ${v.placa}` : 'Não Identificado';
}

const getObraName = (id, obras) => {
    const o = obras.find(o => String(o.id) === String(id));
    return o ? formatObraNome(o) : 'Pátio / Não Alocado';
}

const WashingsTab = ({ vehicles = [], obras = [], setAlertMessage, apiClient }) => {
    const [lavagens, setLavagens] = useState([]);
    const [washingPartners, setWashingPartners] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [modalNovaLavagem, setModalNovaLavagem] = useState(false);
    const [modalParceiros, setModalParceiros] = useState(false);

    // Busca os dados do Banco
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const lavData = await apiClient.get('/washings');
            setLavagens(Array.isArray(lavData) ? lavData : []);
            
            const partData = await apiClient.get('/washings/partners');
            setWashingPartners(Array.isArray(partData) ? partData : []);
        } catch (error) {
            console.error("Erro ao buscar dados de lavagens:", error);
            setAlertMessage("Erro ao carregar o histórico de lavagens.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (apiClient) fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiClient]);

    const onSaveLavagem = async (data) => {
        try {
            await apiClient.post('/washings', data);
            setAlertMessage(`Lavagem registrada no Banco de Dados! Custo gerado na Obra: ${getObraName(data.obraId, obras)}`);
            fetchData();
            setModalNovaLavagem(false);
        } catch (error) {
            console.error(error);
            setAlertMessage("Erro ao salvar lavagem no sistema.");
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-10"><Loader className="animate-spin text-blue-600" size={32} /></div>;
    }

    return (
        <div className="animate-fadeIn">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                        <h3 className="mak-modal-title">
                            <Droplet size={18} className="text-blue-600"/> Histórico de Lavagens
                        </h3>
                        <p className="text-xs text-gray-500">Controle de higienização, com custos alocados por obra.</p>
                    </div>
                    <ProtectedComponent requiredPermission="editor">
                        <div className="flex gap-2">
                            <button onClick={() => setModalParceiros(true)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded text-xs font-bold flex items-center gap-1 hover:bg-gray-200 border border-gray-300 shadow-sm">
                                <Users size={14} /> Parceiros (Lava-Jatos)
                            </button>
                            <button onClick={() => setModalNovaLavagem(true)} className="bg-blue-600 text-white px-3 py-2 rounded text-xs font-bold flex items-center gap-1 hover:bg-blue-700 shadow-sm">
                                <PlusCircle size={14} /> Nova Lavagem
                            </button>
                        </div>
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
                                <th className="p-3">Local (Parceiro)</th>
                                <th className="p-3">Descrição / Serviço</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {lavagens.map(item => {
                                const pName = washingPartners.find(p => String(p.id) === String(item.parceiroId))?.nome || 'Não Informado';
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-bold text-gray-800">{getVehicleName(item.vehicleId, vehicles)}</td>
                                        <td className="p-3">{new Date(item.dataLavagem).toLocaleDateString('pt-BR')}</td>
                                        <td className="p-3 text-xs text-gray-600 font-medium">{getObraName(item.obraId, obras)}</td>
                                        <td className="p-3 text-red-600 font-bold">R$ {parseFloat(item.valor || 0).toFixed(2)}</td>
                                        <td className="p-3 text-gray-700">{pName}</td>
                                        <td className="p-3 text-gray-800 font-medium">{item.descricao || 'N/A'}</td>
                                    </tr>
                                )
                            })}
                            {lavagens.length === 0 && (
                                <tr><td colSpan="6" className="p-6 text-center text-gray-400 italic">Nenhuma lavagem registrada.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalNovaLavagem && (
                <NovaLavagemModal 
                    vehicles={vehicles} 
                    obras={obras}
                    washingPartners={washingPartners}
                    onClose={() => setModalNovaLavagem(false)}
                    onSave={onSaveLavagem}
                />
            )}

            {modalParceiros && (
                <WashingPartnersModal 
                    partners={washingPartners}
                    apiClient={apiClient}
                    fetchData={fetchData}
                    setAlertMessage={setAlertMessage}
                    onClose={() => setModalParceiros(false)}
                />
            )}
        </div>
    );
};

// --- Modais ---
const NovaLavagemModal = ({ vehicles, obras, washingPartners, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        vehicleId: '', obraId: '', dataLavagem: new Date().toISOString().split('T')[0], valor: '', parceiroId: '', descricao: ''
    });

    React.useEffect(() => {
        if (formData.vehicleId && !formData.obraId) {
            const v = vehicles.find(v => String(v.id) === String(formData.vehicleId));
            if (v && v.obraAtualId) setFormData(prev => ({...prev, obraId: v.obraAtualId}));
        }
    }, [formData.vehicleId, vehicles]);

    const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
    const save = () => {
        if(!formData.vehicleId || !formData.obraId) return alert("Selecione o veículo e a obra (Centro de Custo).");
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="mak-modal max-w-sm">
                <div className="px-4 py-3 border-b bg-blue-50 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-blue-800">Registrar Lavagem</h2>
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
                    <div>
                        <label className="block text-xs font-semibold mb-1">Centro de Custo (Obra) *</label>
                        <SearchableObraSelect
                            obras={obras}
                            value={formData.obraId}
                            onChange={(obra) => setFormData(prev => ({...prev, obraId: obra?.id || ''}))}
                            placeholder="Selecione a Obra..."
                            includeInactive={true}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold mb-1">Data *</label>
                            <input type="date" name="dataLavagem" value={formData.dataLavagem} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" required/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1">Valor (R$)</label>
                            <input type="number" step="0.01" name="valor" value={formData.valor} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" placeholder="0.00"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1">Lava-Jato (Parceiro)</label>
                        <SearchableSelect
                            items={washingPartners}
                            value={formData.parceiroId}
                            onChange={(item) => handleChange({ target: { name: 'parceiroId', value: item?.id || '' } })}
                            getLabel={(p) => p.nome}
                            placeholder="Selecione (Opcional)..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1">Tipo de Serviço</label>
                        <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} className="w-full p-2 border rounded text-sm outline-none" placeholder="Ex: Lavagem Simples, Geral..."/>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded">Cancelar</button>
                        <button onClick={save} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded shadow">Salvar Lavagem</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const WashingPartnersModal = ({ partners, apiClient, fetchData, setAlertMessage, onClose }) => {
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!nome) return;
        setIsSaving(true);
        try {
            if (editingId) {
                await apiClient.put(`/washings/partners/${editingId}`, { nome, telefone });
                setAlertMessage("Parceiro atualizado no banco.");
            } else {
                await apiClient.post('/washings/partners', { nome, telefone });
                setAlertMessage("Novo parceiro cadastrado no banco.");
            }
            setNome('');
            setTelefone('');
            setEditingId(null);
            fetchData(); // Atualiza a lista na aba principal
        } catch (error) {
            console.error(error);
            setAlertMessage("Erro ao salvar parceiro.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (p) => {
        setEditingId(p.id);
        setNome(p.nome);
        setTelefone(p.telefone || '');
    };

    const handleRemove = async (id) => {
        if (window.confirm("Deseja realmente remover este Lava-Jato?")) {
            try {
                await apiClient.delete(`/washings/partners/${id}`);
                setAlertMessage("Parceiro excluído com sucesso.");
                fetchData();
            } catch (error) {
                console.error(error);
                setAlertMessage("Erro ao excluir parceiro.");
            }
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setNome('');
        setTelefone('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="mak-modal max-w-md">
                <div className="px-4 py-3 border-b bg-gray-100 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-800">Parceiros de Lavagem (Lava-Jatos)</h2>
                    <button onClick={onClose} className="text-gray-500"><X size={16}/></button>
                </div>
                
                <div className="p-4 bg-blue-50 border-b">
                    <h4 className="text-xs font-bold mb-2 text-blue-900">
                        {editingId ? 'Editando Parceiro' : 'Adicionar Novo Parceiro'}
                    </h4>
                    <div className="flex gap-2">
                        <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do Lava-Jato..." className="flex-1 p-2 border rounded text-xs outline-none focus:ring-1 focus:ring-blue-500"/>
                        <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone..." className="w-28 p-2 border rounded text-xs outline-none focus:ring-1 focus:ring-blue-500"/>
                        <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-3 rounded font-bold text-xs hover:bg-blue-700 shadow-sm flex items-center gap-1">
                            {isSaving ? <Loader size={14} className="animate-spin"/> : (editingId ? <CheckCircle size={14}/> : <PlusCircle size={14}/>)} 
                            {editingId ? 'Salvar' : 'Add'}
                        </button>
                        {editingId && (
                            <button onClick={cancelEdit} className="bg-gray-200 text-gray-700 px-2 rounded font-bold text-xs hover:bg-gray-300">
                                <X size={14}/>
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-4 max-h-60 overflow-y-auto bg-white">
                    {partners.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">Nenhum parceiro cadastrado no sistema.</p>
                    ) : (
                        <ul className="space-y-2">
                            {partners.map(p => (
                                <li key={p.id} className="flex justify-between items-center p-2 border border-gray-200 rounded bg-gray-50 text-xs hover:border-blue-300 transition-colors">
                                    <div>
                                        <p className="font-bold text-gray-800">{p.nome}</p>
                                        <p className="text-gray-500">{p.telefone || 'Sem telefone'}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEdit(p)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded transition"><Edit2 size={14}/></button>
                                        <button onClick={() => handleRemove(p.id)} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition"><Trash2 size={14}/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WashingsTab;
