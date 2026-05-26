import React, { useState } from 'react';
import { X, User } from 'lucide-react';

const ROLES = [
  { value: 'viewer', label: 'Visualizador' },
  { value: 'operador', label: 'Operador' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Administrador' },
];

const UserEditModal = ({ user, groups = [], onClose, onSave }) => {
  const isNew = !user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    user_type: user?.user_type || 'viewer',
    group_id: user?.group_id || '',
    podeAcessarAbastecimento: user?.podeAcessarAbastecimento || false,
    active: user?.active !== false && user?.status !== 'inativo',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = { ...form };
      if (!isNew && !data.password) delete data.password;
      await onSave(data, user?.id);
    } catch (err) {
      setError(err.message || 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <User size={18} className="text-yellow-500" />
            {isNew ? 'Novo Usuário' : 'Editar Usuário'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              placeholder="Nome completo"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              required
              placeholder="email@empresa.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isNew ? 'Senha inicial' : 'Nova senha (deixe em branco para manter)'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              required={isNew}
              placeholder={isNew ? 'Senha inicial' : 'Deixe em branco para não alterar'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
              <select
                value={form.user_type}
                onChange={e => set('user_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm bg-white"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grupo de Acesso</label>
              <select
                value={form.group_id}
                onChange={e => set('group_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm bg-white"
              >
                <option value="">Nenhum</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.podeAcessarAbastecimento}
                onChange={e => set('podeAcessarAbastecimento', e.target.checked)}
                className="h-4 w-4 text-yellow-500 rounded border-gray-300 focus:ring-yellow-400"
              />
              <span className="text-sm text-gray-700">Acessa Abastecimento</span>
            </label>
            {!isNew && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => set('active', e.target.checked)}
                  className="h-4 w-4 text-green-500 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Ativo</span>
              </label>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

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
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserEditModal;
