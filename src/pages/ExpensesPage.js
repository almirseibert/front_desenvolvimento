import React, { useState, useMemo, useEffect } from 'react'; // 1. Importa o useEffect
// REMOVIDO: Imports do Firebase Firestore
import {
    Download,
    Edit,
    Trash2,
    Loader, // Adicionado
    PlusCircle // Adicionado
} from 'lucide-react';
import Papa from 'papaparse'; // Para exportar CSV
import apiClient from '../services/apiClient'; // Importa apiClient

// Importa componentes necessários
import ProtectedComponent from '../components/ProtectedComponent'; // Ajuste o caminho se necessário
import SearchableSelect from '../components/SearchableSelect';
// import { useAuth } from '../contexts/AuthContext'; // Removido, user vem via props

// ===================================================================================
// PÁGINA DE DESPESAS (ATUALIZADA PARA API)
// ===================================================================================
const ExpensesPage = ({
    user,              // Usuário logado (do AuthContext)
    obras,             // Lista de obras (via props do App.js)
    expenses,          // Lista de despesas (via props do App.js)
    apiClient,         // Cliente API (via props do App.js)
    PasswordConfirmationModal, // Componente Modal (via props do App.js)
    setAlertMessage,   // Função para exibir alertas (via props do App.js)
    reloadData         // Função para recarregar dados (via props do App.js)
}) => {
    // Estados da UI
    // *** 2. CORREÇÃO: Lê a última obra selecionada do sessionStorage ***
    const [selectedObra, setSelectedObra] = useState(
        sessionStorage.getItem('expensesPage_selectedObra') || ''
    );
    const [description, setDescription] = useState('');   // Descrição no formulário
    const [amount, setAmount] = useState('');             // Valor no formulário
    const [editingExpense, setEditingExpense] = useState(null); // Guarda a despesa sendo editada
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // Visibilidade do modal de exclusão
    const [itemToDelete, setItemToDelete] = useState(null);       // ID da despesa a ser excluída
    const [isSaving, setIsSaving] = useState(false);             // Estado de carregamento para salvar/atualizar
    const [category, setCategory] = useState('Outros');         // NOVO: Estado para categoria

    // Ordena obras para o select (mantido)
    const sortedObras = useMemo(() => {
        // Garante que obras é um array antes de ordenar
        return [...(obras || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }, [obras]);

    // *** 3. CORREÇÃO: Salva a obra selecionada no sessionStorage ***
    useEffect(() => {
        // Sempre que 'selectedObra' mudar, salvamos no sessionStorage.
        if (selectedObra) {
            sessionStorage.setItem('expensesPage_selectedObra', selectedObra);
        } else {
            // Se o usuário selecionar "Selecione...", limpamos o storage.
            sessionStorage.removeItem('expensesPage_selectedObra');
        }
    }, [selectedObra]); // Roda sempre que a obra selecionada mudar

    // Handler para Adicionar ou Atualizar Despesa (USA API)
    const handleAddOrUpdateExpense = async (e) => {
        e.preventDefault();
        // Validação básica
        if (!selectedObra || !description || !amount || !category) {
            setAlertMessage('Obra, Descrição, Valor e Categoria são obrigatórios.');
            return;
        }
        setIsSaving(true);

        // Prepara dados para API
        const expenseData = {
            obraId: selectedObra,
            description,
            amount: parseFloat(amount.replace(',', '.')) || 0, // Aceita vírgula
            category: category,
            // createdBy é adicionado pelo backend
            // createdAt é adicionado pelo backend
        };

        try {
            if (editingExpense) {
                // Chama API para ATUALIZAR
                await apiClient.updateExpense(editingExpense.id, expenseData);
                setAlertMessage('Despesa atualizada com sucesso!');
            } else {
                // Chama API para CRIAR
                await apiClient.createExpense(expenseData);
                setAlertMessage('Despesa adicionada com sucesso!');
            }
            // Limpa formulário e recarrega dados
            resetForm();
            reloadData(); // <-- Isso recria o componente, mas o sessionStorage vai salvar a seleção.
        } catch (error) {
            console.error("Erro ao salvar despesa via API:", error);
            setAlertMessage(error.message || 'Falha ao salvar a despesa.');
        } finally {
            setIsSaving(false);
        }
    };

    // Abre modal de exclusão (mantido)
    const openDeleteModal = (id) => {
        setItemToDelete(id); // Guarda apenas o ID
        setIsDeleteModalOpen(true);
    };

    // Handler para Excluir Despesa (USA API)
    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            // Chama API para DELETAR
            await apiClient.deleteExpense(itemToDelete);
            setAlertMessage('Despesa excluída com sucesso.');
            reloadData(); // <-- Isso também recria o componente.
        } catch (error) {
            console.error("Erro ao excluir despesa via API:", error);
            setAlertMessage(error.message || 'Falha ao excluir despesa.');
        } finally {
            setIsDeleteModalOpen(false); // Fecha modal de senha
            setItemToDelete(null);
        }
    };

    // Filtra despesas pela obra selecionada (mantido)
    const obraExpenses = useMemo(() => {
        if (!selectedObra) return [];
        // Garante que expenses é um array antes de filtrar
        return (expenses || []).filter(exp => exp.obraId === selectedObra)
               // Ordena pela data de criação mais recente
               .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [expenses, selectedObra]);

     // Função para limpar o formulário e resetar estado de edição
     const resetForm = () => {
        // Esta função está correta. Ela NÃO mexe mais no 'selectedObra'.
        // setSelectedObra(''); // Não reseta a obra selecionada
        
        setDescription('');
        setAmount('');
        setCategory('Outros'); // Reseta categoria para padrão
        setEditingExpense(null);
    };

    // Exporta CSV (USA new Date())
    const exportExpensesToCSV = () => {
        if (!selectedObra) {
            setAlertMessage("Selecione uma obra para exportar.");
            return;
        }
        const obra = obras?.find(o => o.id === selectedObra);
        if (!obra) {
             setAlertMessage("Obra selecionada não encontrada.");
             return;
        }
        if (obraExpenses.length === 0) {
            setAlertMessage("Nenhuma despesa para exportar nesta obra.");
            return;
        }

        // *** CORREÇÃO DO BUG .toFixed() APLICADA AQUI TAMBÉM ***
        const headers = ['Data', 'Descrição', 'Categoria', 'Valor (R$)', 'Criado Por'];
        const rows = obraExpenses.map(exp => [
            exp.createdAt ? new Date(exp.createdAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A', // Formata data da API
            exp.description || '',
            exp.category || 'N/A',
            parseFloat(exp.amount || 0).toFixed(2), // Converte para número antes de formatar
            exp.createdBy?.userEmail || 'N/A' // Acessa email dentro de createdBy
        ]);

        // Usa PapaParse para gerar CSV corretamente
        const csv = Papa.unparse({ fields: headers, data: rows }, { delimiter: ',' });
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `despesas_${obra.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Renderização Principal
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 font-sans">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className="">Gerenciamento de Despesas Manuais</h1>

            {/* Formulário (Apenas Editor/Admin) */}
            <ProtectedComponent requiredPermission="editor">
                <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md " style={{ border: "1px solid #f0ebe3" }}>
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">{editingExpense ? 'Editar Despesa' : 'Adicionar Nova Despesa Manual'}</h2>
                    <form onSubmit={handleAddOrUpdateExpense} className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 items-end text-sm">
                        {/* Select Obra */}
                        <div className="lg:col-span-1">
                             <label className="block font-medium text-gray-600 mb-1">Obra*</label>
                            <SearchableSelect
                                items={[
                                    { id: 'Administração', nome: 'Administração' },
                                    { id: 'Oficina',       nome: 'Oficina' },
                                    { id: 'Pátio',         nome: 'Pátio' },
                                    { id: 'Diversos',      nome: 'Diversos' },
                                    ...sortedObras.map(o => ({ ...o, nome: `${o.nome}${o.tipo_registro === 'centro_custo' ? ' (CC)' : ''}` })),
                                ]}
                                value={selectedObra}
                                onChange={(item) => setSelectedObra(item?.id || '')}
                                getLabel={(o) => o.nome}
                                placeholder="Selecione..."
                                required
                            />
                        </div>
                         {/* Input Descrição */}
                        <div className="lg:col-span-1">
                             <label className="block font-medium text-gray-600 mb-1">Descrição*</label>
                            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Almoço Equipe" className="w-full p-2 border rounded bg-white" required />
                        </div>
                         {/* Select Categoria */}
                         <div className="lg:col-span-1">
                             <label className="block font-medium text-gray-600 mb-1">Categoria*</label>
                             <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 border rounded bg-white" required>
                                 <option value="Outros">Outros</option>
                                 <option value="Alimentação">Alimentação</option>
                                 <option value="Hospedagem">Hospedagem</option>
                                 <option value="Peças">Peças</option>
                                 <option value="Manutenção Terceiros">Manutenção Terceiros</option>
                                 <option value="Viagem">Viagem</option>
                                 <option value="Pedágio">Pedágio</option>
                             </select>
                         </div>
                         {/* Input Valor */}
                        <div className="lg:col-span-1">
                            <label className="block font-medium text-gray-600 mb-1">Valor (R$)*</label>
                            <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="w-full p-2 border rounded bg-white" required />
                        </div>
                        {/* Botão Salvar/Cancelar */}
                        <div className="lg:col-span-4 flex justify-end gap-2 mt-2">
                             {editingExpense && (
                                <button type="button" onClick={resetForm} className="mak-btn mak-btn-cancel">
                                     Cancelar Edição
                                 </button>
                             )}
                            <button type="submit" disabled={isSaving} className="px-4 py-2 mak-btn mak-btn-primary">
                                {/* *** AQUI ESTAVA O ERRO: ISaving -> isSaving *** */}
                                {isSaving ? <><Loader className="animate-spin" size={16}/> Salvando...</> : (editingExpense ? <><Edit size={16}/> Salvar</> : <><PlusCircle size={16}/> Adicionar</>)}
                            </button>
                        </div>
                    </form>
                </div>
            </ProtectedComponent>

            {/* Tabela/Lista de Despesas */}
            <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md " style={{ border: "1px solid #f0ebe3" }}>
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                     {/* Título com nome da Obra */}
                     <h2 className="text-xl font-semibold text-gray-700">
                         {selectedObra ? `Despesas: ${obras?.find(o => o.id === selectedObra)?.nome || selectedObra}` : "Selecione uma obra"}
                     </h2>
                     {/* Botão Exportar */}
                    <button onClick={exportExpensesToCSV} className="flex items-center gap-2 px-4 py-2 mak-btn mak-btn-dark" disabled={!selectedObra || obraExpenses.length === 0}>
                        <Download size={16} />Exportar CSV
                    </button>
                </div>
                 {/* Lista */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar text-sm">
                    {obraExpenses.length > 0 ? obraExpenses.map(exp => (
                        <div key={exp.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 rounded-lg gap-2" style={{ border: "1px solid #f0ebe3" }}>
                            {/* Detalhes da Despesa */}
                            <div className="flex-1">
                                <p className="font-medium text-gray-800">{exp.description || 'Sem descrição'}</p>
                                <p className="text-xs text-gray-500">
                                     {/* Formata data da API */}
                                     {exp.createdAt ? new Date(exp.createdAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data N/A'}
                                     {' - '}
                                     <span className="font-semibold">{exp.category || 'Outros'}</span>
                                     {' - '}
                                     {/* *** AQUI ESTÁ A CORREÇÃO DO CRASH ***
                                        O 'amount' (e.g., 150.50) vem do banco como STRING "150.50".
                                        Tentar usar .toFixed() em uma string causa o crash.
                                        Usamos parseFloat() para converter de volta para NÚMERO.
                                     */}
                                     <span className="font-bold text-red-600">R$ {parseFloat(exp.amount || 0).toFixed(2)}</span>
                                     {exp.createdBy?.userEmail && ` (por ${exp.createdBy.userEmail.split('@')[0]})`}
                                </p>
                            </div>
                             {/* Botões de Ação */}
                            <div className="flex gap-1 flex-shrink-0 self-start sm:self-center">
                                <ProtectedComponent requiredPermission="editor">
                                    {/* *** CORREÇÃO DO BUG DE EDIÇÃO ***
                                        Ao editar, o 'amount' (número) precisa virar string para o formulário.
                                        A lógica antiga 'exp.amount.toString()' quebra se 'amount' for string.
                                        Convertemos para número primeiro e DEPOIS para string.
                                    */}
                                    <button onClick={() => { setEditingExpense(exp); setDescription(exp.description); setAmount(parseFloat(exp.amount || 0).toString().replace('.', ',')); setCategory(exp.category || 'Outros'); setSelectedObra(exp.obraId); window.scrollTo(0, 0); }} title="Editar" className="p-1.5 text-gray-400 hover:text-[#9E7A42] hover:bg-[#f5f2ed] rounded-full transition"><Edit size={14}/></button>
                                </ProtectedComponent>
                                <ProtectedComponent requiredPermission="admin">
                                    <button onClick={() => openDeleteModal(exp.id)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition"><Trash2 size={14}/></button>
                                </ProtectedComponent>
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-gray-500 py-6 italic">{selectedObra ? 'Nenhuma despesa manual registrada.' : 'Selecione uma obra acima.'}</p>
                    )}
                </div>
            </div>

            {/* Modal de Exclusão (usa PasswordConfirmationModal) */}
            {isDeleteModalOpen && itemToDelete &&
                <PasswordConfirmationModal
                    message="Confirme sua senha para EXCLUIR esta despesa manual."
                    onConfirm={handleDelete}
                    onClose={() => setIsDeleteModalOpen(false)}
                    apiClient={apiClient} // Passa apiClient
                />}
        </div>
    );
};

export default ExpensesPage;



