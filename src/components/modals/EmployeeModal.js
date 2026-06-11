import React, { useState, useEffect } from 'react';
import { X, Loader, FileText, Save, Stethoscope, Briefcase, User, Shield, PlusCircle } from 'lucide-react';

const EmployeeModal = ({ 
    user, 
    employee, 
    onClose, 
    setAlertMessage, 
    apiClient, 
    reloadData 
}) => {
    const [activeTab, setActiveTab] = useState('dados');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const isAdmin = user && user.user_type && user.user_type.toLowerCase() === 'admin';

    // Estado inicial
    const [formData, setFormData] = useState({
        nome: '',
        vulgo: '',
        registroInterno: '',
        dataAdmissao: '',
        cpf: '',
        rg: '',
        dataNascimento: '',
        funcao: '',
        endereco: '',
        cidade: '',
        contato: '',
        email: '',
        status: 'ativo',
        isPlaceholder: false,
        // CNH: Mapeamos para um objeto para facilitar a UI
        cnh: { numero: '', categoria: '', validade: '', emissao: '', exameToxicologicoVencimento: '', anexo: null },
        // ASO: Nova aba
        aso: { dataEmissao: '', validade: '', anexo: null, observacao: '' },
        epi: { dataEntrega: '', anexo: null },
        certificados: []
    });

    useEffect(() => {
        if (employee) {
            // Lógica para recuperar CNH de colunas planas OU JSON
            const cnhData = employee.cnh || {};
            const cnhNumero = cnhData.numero || employee.cnhNumero || '';
            const cnhCategoria = cnhData.categoria || employee.cnhCategoria || '';
            const cnhValidade = formatDateForInput(cnhData.validade || employee.cnhVencimento);
            
            // Novos campos RH (Emissão CNH e Toxicológico)
            const cnhEmissao = formatDateForInput(employee.cnhEmissao);
            const exameToxicologicoVencimento = formatDateForInput(employee.exameToxicologicoVencimento);

            setFormData({
                nome: employee.nome || '',
                vulgo: employee.vulgo || '',
                registroInterno: employee.registroInterno || '',
                dataAdmissao: formatDateForInput(employee.dataAdmissao || employee.dataContratacao),
                cpf: employee.cpf || '',
                rg: employee.rg || '',
                dataNascimento: formatDateForInput(employee.dataNascimento),
                funcao: employee.funcao || '',
                endereco: employee.endereco || '',
                cidade: employee.cidade || '',
                contato: employee.contato || employee.telefone || '',
                email: employee.email || '',
                status: employee.status || 'ativo',
                isPlaceholder: employee.isPlaceholder === 1 || employee.isPlaceholder === true,

                cnh: {
                    numero: cnhNumero,
                    categoria: cnhCategoria,
                    validade: cnhValidade,
                    emissao: cnhEmissao,
                    exameToxicologicoVencimento: exameToxicologicoVencimento,
                    anexo: cnhData.anexo || null
                },
                
                aso: parseJson(employee.aso, { dataEmissao: '', validade: '', anexo: null, observacao: '' }),
                epi: parseJson(employee.epi, { dataEntrega: '', anexo: null }),
                certificados: parseJson(employee.certificados, [])
            });
        }
    }, [employee]);

    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        try { return new Date(dateString).toISOString().split('T')[0]; } catch { return ''; }
    };

    const parseJson = (val, defaultVal) => {
        if (!val) return defaultVal;
        if (typeof val === 'object') return val;
        try { return JSON.parse(val); } catch { return defaultVal; }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNestedChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: { ...prev[section], [field]: value }
        }));
    };

    // Handler especial para data de emissão da CNH para auto-sugerir toxicológico
    const handleCnhEmissaoChange = (val) => {
        setFormData(prev => {
            const newData = { ...prev, cnh: { ...prev.cnh, emissao: val } };
            
            // Sugere vencimento de toxicológico 2.5 anos (30 meses) após a emissão
            // APENAS se o campo de toxicológico ainda estiver vazio
            if (val && !prev.cnh.exameToxicologicoVencimento) {
                const [year, month, day] = val.split('-').map(Number);
                // Aguarda o ano estar completamente preenchido (4 dígitos) antes de calcular
                if (year >= 1000 && month && day) {
                    let totalMonths = (year * 12 + (month - 1)) + 30;
                    const newYear = Math.floor(totalMonths / 12);
                    const newMonth = (totalMonths % 12) + 1;
                    newData.cnh.exameToxicologicoVencimento = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
            }
            
            return newData;
        });
    };

    const handleFileUpload = async (e, section) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const data = new FormData();
        data.append('file', file);
        try {
            const res = await apiClient.uploadFile(data);
            const fileUrl = res.data?.url || res.url;
            setFormData(prev => ({
                ...prev,
                [section]: { ...prev[section], anexo: fileUrl }
            }));
        } catch (error) {
            console.error("Erro upload", error);
            setAlertMessage("Erro ao enviar arquivo. Tente novamente.");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Prepara payload compatível com backend
            const payload = {
                ...formData,
                isPlaceholder: formData.isPlaceholder ? 1 : 0,
                // Envia campos planos de CNH explicitamente para o backend salvar nas colunas do MySQL
                cnhNumero: formData.cnh.numero,
                cnhCategoria: formData.cnh.categoria,
                cnhVencimento: formData.cnh.validade,
                cnhEmissao: formData.cnh.emissao,
                exameToxicologicoVencimento: formData.cnh.exameToxicologicoVencimento
            };

            // Apenas administradores podem alterar a flag de fictício.
            // Para outros usuários, preservamos o valor já gravado no banco.
            if (!isAdmin) {
                if (employee) {
                    payload.isPlaceholder = (employee.isPlaceholder === 1 || employee.isPlaceholder === true) ? 1 : 0;
                } else {
                    payload.isPlaceholder = 0;
                }
            }

            if (employee) {
                await apiClient.updateEmployee(employee.id, payload);
                setAlertMessage("Funcionário atualizado com sucesso!");
            } else {
                await apiClient.createEmployee(payload);
                setAlertMessage("Funcionário cadastrado com sucesso!");
            }
            reloadData();
            onClose();
        } catch (error) {
            setAlertMessage(`Erro: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fadeIn">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {employee ? <User size={20}/> : <PlusCircle size={20}/>}
                        {employee ? 'Editar Funcionário' : 'Novo Funcionário'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
                </div>

                <div className="flex border-b px-6 pt-2 bg-white sticky top-0 z-10">
                    {[
                        { id: 'dados', label: 'Dados Pessoais', icon: User },
                        { id: 'cnh', label: 'CNH e Exames', icon: FileText },
                        { id: 'aso', label: 'Atestado Médico (ASO)', icon: Stethoscope },
                        { id: 'epi', label: 'EPIs', icon: Shield }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
                                activeTab === tab.id ? 'border-yellow-400 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <tab.icon size={16}/> {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 bg-white">
                    {/* DADOS PESSOAIS */}
                    {activeTab === 'dados' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo *</label>
                                <input required name="nome" value={formData.nome} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" placeholder="Nome do funcionário"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vulgo (Apelido)</label>
                                <input name="vulgo" value={formData.vulgo} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF *</label>
                                <input required name="cpf" value={formData.cpf} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" placeholder="000.000.000-00"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RG</label>
                                <input name="rg" value={formData.rg} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Registro Interno</label>
                                <input name="registroInterno" value={formData.registroInterno} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Admissão</label>
                                <input type="date" name="dataAdmissao" value={formData.dataAdmissao} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Nascimento</label>
                                <input type="date" name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Função / Cargo</label>
                                <select name="funcao" value={formData.funcao} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none bg-white">
                                    <option value="">Selecione...</option>
                                    <option value="Administrativo">Administrativo</option>
                                    <option value="Auxiliar de Mecânico">Auxiliar de Mecânico</option>
                                    <option value="Auxiliar de Pavimentação">Auxiliar de Pavimentação</option>
                                    <option value="Borracheiro">Borracheiro</option>
                                    <option value="Eletricista Automotivo">Eletricista Automotivo</option>
                                    <option value="Lavador">Lavador</option>
                                    <option value="Mecânico">Mecânico</option>
                                    <option value="Motorista">Motorista</option>
                                    <option value="Operador de Máquina">Operador de Máquina</option>
                                    <option value="Pintor">Pintor</option>
                                    <option value="Soldador">Soldador</option>
                                    <option value="Supervisor de Obras">Supervisor de Obras</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endereço</label>
                                <input name="endereco" value={formData.endereco} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade</label>
                                <input name="cidade" value={formData.cidade} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>

                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone / Contato</label>
                                <input name="contato" value={formData.contato} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                            </div>

                            {isAdmin && (
                                <div className="md:col-span-3 mt-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="isPlaceholder"
                                            checked={!!formData.isPlaceholder}
                                            onChange={e => setFormData(prev => ({ ...prev, isPlaceholder: e.target.checked }))}
                                            className="mt-0.5 h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                                        />
                                        <span>
                                            <span className="block text-sm font-bold text-purple-800">Funcionário fictício (placeholder)</span>
                                            <span className="block text-xs text-purple-700 mt-0.5">
                                                Marque para usar este cadastro apenas como vínculo temporário (ex: alocações sem motorista real). Visível somente para administradores.
                                            </span>
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CNH */}
                    {activeTab === 'cnh' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
                                <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><FileText size={18}/> Dados da CNH e Exame Toxicológico</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-blue-700 uppercase mb-1">Número Registro</label>
                                        <input value={formData.cnh?.numero || ''} onChange={e => handleNestedChange('cnh', 'numero', e.target.value)} className="w-full p-2.5 border border-blue-200 rounded-lg bg-white"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-blue-700 uppercase mb-1">Categoria</label>
                                        <input value={formData.cnh?.categoria || ''} onChange={e => handleNestedChange('cnh', 'categoria', e.target.value)} className="w-full p-2.5 border border-blue-200 rounded-lg bg-white" placeholder="Ex: AE"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-blue-700 uppercase mb-1">Data Emissão CNH</label>
                                        <input type="date" value={formData.cnh?.emissao || ''} onChange={e => handleCnhEmissaoChange(e.target.value)} className="w-full p-2.5 border border-blue-200 rounded-lg bg-white"/>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-blue-700 uppercase mb-1">Vencimento CNH</label>
                                        <input type="date" value={formData.cnh?.validade || ''} onChange={e => handleNestedChange('cnh', 'validade', e.target.value)} className="w-full p-2.5 border border-blue-200 rounded-lg bg-white"/>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-blue-700 uppercase mb-1" title="Vencimento do Exame Toxicológico">Vencimento Toxicológico</label>
                                        <input type="date" value={formData.cnh?.exameToxicologicoVencimento || ''} onChange={e => handleNestedChange('cnh', 'exameToxicologicoVencimento', e.target.value)} className="w-full p-2.5 border border-blue-200 rounded-lg bg-white"/>
                                    </div>

                                    <div className="md:col-span-3 mt-2">
                                        <label className="text-xs font-bold text-blue-700 uppercase mb-1">Anexo CNH Digitalizada</label>
                                        <div className="flex gap-3 items-center bg-white p-3 rounded-lg border border-blue-200 border-dashed">
                                            <input type="file" onChange={e => handleFileUpload(e, 'cnh')} className="text-sm text-gray-500"/>
                                            {uploading && <Loader className="animate-spin text-blue-600" size={20}/>}
                                            {formData.cnh?.anexo ? (
                                                <a href={formData.cnh.anexo} target="_blank" rel="noopener noreferrer" className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-200 transition">Ver Anexo Atual</a>
                                            ) : <span className="text-xs text-gray-400 italic">Nenhum arquivo</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NOVA ABA: ASO */}
                    {activeTab === 'aso' && (
                        <div className="space-y-6 animate-fadeIn">
                             <div className="bg-green-50 p-5 rounded-lg border border-green-100">
                                <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2"><Stethoscope size={18}/> Atestado de Saúde Ocupacional (ASO)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-green-700 uppercase mb-1">Data de Emissão (Realização)</label>
                                        <input type="date" value={formData.aso?.dataEmissao || ''} onChange={e => handleNestedChange('aso', 'dataEmissao', e.target.value)} className="w-full p-2.5 border border-green-200 rounded-lg bg-white"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-green-700 uppercase mb-1">Data de Validade (Vencimento)</label>
                                        <input type="date" value={formData.aso?.validade || ''} onChange={e => handleNestedChange('aso', 'validade', e.target.value)} className="w-full p-2.5 border border-green-200 rounded-lg bg-white"/>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-green-700 uppercase mb-1">Observações / Tipo de Exame</label>
                                        <input 
                                            value={formData.aso?.observacao || ''} 
                                            onChange={e => handleNestedChange('aso', 'observacao', e.target.value)} 
                                            className="w-full p-2.5 border border-green-200 rounded-lg bg-white"
                                            placeholder="Ex: Admissional, Periódico, Demissional..."
                                        />
                                    </div>
                                    <div className="md:col-span-2 mt-2">
                                        <label className="text-xs font-bold text-green-700 uppercase mb-1">Anexo ASO Digitalizado</label>
                                        <div className="flex gap-3 items-center bg-white p-3 rounded-lg border border-green-200 border-dashed">
                                            <input type="file" onChange={e => handleFileUpload(e, 'aso')} className="text-sm text-gray-500"/>
                                            {uploading && <Loader className="animate-spin text-green-600" size={20}/>}
                                            {formData.aso?.anexo ? (
                                                <a href={formData.aso.anexo} target="_blank" rel="noopener noreferrer" className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-200 transition">Ver Anexo Atual</a>
                                            ) : <span className="text-xs text-gray-400 italic">Nenhum arquivo</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EPIs */}
                    {activeTab === 'epi' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-orange-50 p-5 rounded-lg border border-orange-100">
                                <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><Shield size={18}/> Ficha de EPI</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-orange-700 uppercase mb-1">Data da Última Entrega</label>
                                        <input type="date" value={formData.epi?.dataEntrega || ''} onChange={e => handleNestedChange('epi', 'dataEntrega', e.target.value)} className="w-full p-2.5 border border-orange-200 rounded-lg bg-white"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-orange-700 uppercase mb-1">Ficha de Entrega Digitalizada</label>
                                        <div className="flex gap-3 items-center bg-white p-3 rounded-lg border border-orange-200 border-dashed">
                                            <input type="file" onChange={e => handleFileUpload(e, 'epi')} className="text-sm text-gray-500"/>
                                            {uploading && <Loader className="animate-spin text-orange-600" size={20}/>}
                                            {formData.epi?.anexo ? (
                                                <a href={formData.epi.anexo} target="_blank" rel="noopener noreferrer" className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold hover:bg-orange-200 transition">Ver Anexo Atual</a>
                                            ) : <span className="text-xs text-gray-400 italic">Nenhum arquivo</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </form>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-bold text-sm transition shadow-sm">Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={loading || uploading} 
                        className="px-6 py-2.5 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 font-bold text-sm flex items-center gap-2 disabled:opacity-50 shadow-sm transition transform active:scale-95"
                    >
                        {loading ? <Loader className="animate-spin" size={18}/> : <Save size={18}/>}
                        {employee ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmployeeModal;