import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';

export const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'obras', label: 'Obras' },
  { id: 'veiculos', label: 'Veículos' },
  { id: 'funcionarios', label: 'Funcionários' },
  { id: 'abastecimento', label: 'Abastecimento' },
  { id: 'manutencoes', label: 'Manutenções' },
  { id: 'pneus', label: 'Pneus' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'ordens', label: 'Ordens C/S' },
  { id: 'multas', label: 'Multas' },
  { id: 'faturamento', label: 'Faturamento' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'comboio', label: 'Comboio' },
  { id: 'despesas', label: 'Despesas' },
  { id: 'diario', label: 'Diário de Bordo' },
];

const AccessGroupModal = ({ group, onClose, onSave, saving = false }) => {
  const isNew = !group;
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    modules: group?.modules || [],
  });

  const toggleModule = (id) => {
    setForm(prev => ({
      ...prev,
      modules: prev.modules.includes(id)
        ? prev.modules.filter(m => m !== id)
        : [...prev.modules, id],
    }));
  };

  const selectAll = () => setForm(prev => ({ ...prev, modules: MODULES.map(m => m.id) }));
  const clearAll = () => setForm(prev => ({ ...prev, modules: [] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(form, group?.id);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Shield size={18} className="text-yellow-500" />
            {isNew ? 'Novo Grupo de Acesso' : 'Editar Grupo'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Grupo</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required
              placeholder="Ex: Equipe de Obras"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Descrição opcional do grupo"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Módulos Permitidos</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:underline">Todos</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={clearAll} className="text-xs text-red-500 hover:underline">Limpar</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
              {MODULES.map(m => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.modules.includes(m.id)}
                    onChange={() => toggleModule(m.id)}
                    className="h-4 w-4 text-yellow-500 rounded border-gray-300 focus:ring-yellow-400"
                  />
                  <span className="text-sm text-gray-700">{m.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{form.modules.length} de {MODULES.length} módulos selecionados</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccessGroupModal;
