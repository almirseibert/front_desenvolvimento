import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Check, Trash2, Edit, Key,
  ToggleLeft, ToggleRight, Search, Loader, ChevronDown, ChevronUp,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import UserEditModal from '../modals/UserEditModal';

const ROLE_LABELS = {
  admin:         'Administrador',
  gerencia:      'Gerência',
  editor:        'Editor',
  rh:            'RH',
  faturamento:   'Faturamento',
  abastecimento: 'Abastecimento',
  oficina:       'Oficina',
  operador:      'Operador',
  viewer:        'Visualizador',
};

const ROLE_COLORS = {
  admin:         'bg-red-100 text-red-700',
  gerencia:      'bg-purple-100 text-purple-700',
  editor:        'bg-blue-100 text-blue-700',
  rh:            'bg-pink-100 text-pink-700',
  faturamento:   'bg-indigo-100 text-indigo-700',
  abastecimento: 'bg-cyan-100 text-cyan-700',
  oficina:       'bg-orange-100 text-orange-700',
  operador:      'bg-green-100 text-green-700',
  viewer:        'bg-gray-100 text-gray-600',
};

const Toast = ({ message }) =>
  message ? (
    <div className="fixed top-4 right-4 z-[9999] bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-pulse">
      {message}
    </div>
  ) : null;

const UserManagementTab = ({ groups = [], onUsersChange }) => {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showPending, setShowPending] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadUsers();
    loadRequests();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getUsers();
      setUsers(data || []);
      if (onUsersChange) onUsersChange(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await apiClient.adminGetRegistrationRequests();
      setRequests(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApprove = async (req) => {
    try {
      await apiClient.adminApproveRegistrationRequest({
        userId: req.id,
        role: 'operador',
        canAccessRefueling: false,
      });
      showToast(`Usuário ${req.email} aprovado com função Operador.`);
      loadRequests();
      loadUsers();
    } catch (e) {
      showToast('Erro ao aprovar usuário.');
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Rejeitar e remover esta solicitação?')) return;
    try {
      await apiClient.adminDeleteRegistrationRequest(id);
      loadRequests();
    } catch (e) {
      showToast('Erro ao rejeitar solicitação.');
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await apiClient.adminToggleUserStatus(user.id);
      showToast('Status do usuário atualizado.');
      loadUsers();
    } catch (e) {
      showToast('Disponível em breve (endpoint backend pendente).');
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Redefinir senha de ${user.email}?`)) return;
    try {
      await apiClient.adminResetUserPassword(user.id);
      showToast('Nova senha temporária enviada ao usuário.');
    } catch (e) {
      showToast('Disponível em breve (endpoint backend pendente).');
    }
  };

  const handleSaveUser = async (data, userId) => {
    try {
      if (userId) {
        await apiClient.adminUpdateUser(userId, data);
        showToast('Usuário atualizado com sucesso!');
      } else {
        await apiClient.adminCreateUser(data);
        showToast('Usuário criado com sucesso!');
      }
      setShowUserModal(false);
      loadUsers();
    } catch (e) {
      showToast(e.message || 'Disponível em breve (endpoint backend pendente).');
      setShowUserModal(false);
    }
  };

  const isActive = (u) => u.active !== false && u.status !== 'inativo';

  const filtered = users.filter(u => {
    const matchSearch =
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.user_type === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <Toast message={toast} />

      {/* Solicitações Pendentes */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <button
          onClick={() => setShowPending(v => !v)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-blue-500" />
            <span className="font-bold text-gray-800">Solicitações de Cadastro Pendentes</span>
            {requests.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {requests.length}
              </span>
            )}
          </div>
          {showPending ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showPending && (
          <div className="border-t border-gray-100 p-4">
            {loadingRequests ? (
              <div className="flex justify-center py-4">
                <Loader className="animate-spin text-blue-400" size={24} />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-gray-400 text-sm italic text-center py-3">Nenhuma solicitação pendente.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase text-xs">
                      <th className="p-3 text-left font-semibold">Nome</th>
                      <th className="p-3 text-left font-semibold">E-mail</th>
                      <th className="p-3 text-left font-semibold">Data</th>
                      <th className="p-3 text-center font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(req => (
                      <tr key={req.id} className="border-t hover:bg-blue-50 transition-colors">
                        <td className="p-3 font-medium text-gray-800">{req.name}</td>
                        <td className="p-3 text-gray-600">{req.email}</td>
                        <td className="p-3 text-gray-400 text-xs">
                          {req.created_at ? new Date(req.created_at).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleApprove(req)}
                              className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-bold transition-colors"
                            >
                              <Check size={13} /> Aprovar
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-bold transition-colors"
                            >
                              <Trash2 size={13} /> Rejeitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Todos os Usuários */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-yellow-500" />
            <span className="font-bold text-gray-800">Todos os Usuários</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{users.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nome ou e-mail..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none w-52"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
            >
              <option value="">Todas as funções</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button
              onClick={() => { setEditUser(null); setShowUserModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg text-sm transition-colors"
            >
              <UserPlus size={14} /> Novo Usuário
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader className="animate-spin text-yellow-400" size={28} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <th className="p-3 text-left font-semibold">Nome</th>
                  <th className="p-3 text-left font-semibold">E-mail</th>
                  <th className="p-3 text-center font-semibold">Função</th>
                  <th className="p-3 text-center font-semibold">Grupo</th>
                  <th className="p-3 text-center font-semibold">Abastec.</th>
                  <th className="p-3 text-center font-semibold">Status</th>
                  <th className="p-3 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 py-8 italic text-sm">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => (
                    <tr key={u.id} className="border-t hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-medium text-gray-800">{u.name || '-'}</td>
                      <td className="p-3 text-gray-500 text-xs">{u.email}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[u.user_type] || 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[u.user_type] || u.user_type || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-center text-gray-400 text-xs">{u.group_name || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs font-bold ${u.podeAcessarAbastecimento ? 'text-green-600' : 'text-gray-300'}`}>
                          {u.podeAcessarAbastecimento ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive(u) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {isActive(u) ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => { setEditUser(u); setShowUserModal(true); }}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors"
                            title="Editar usuário"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="p-1.5 rounded hover:bg-orange-50 text-orange-400 transition-colors"
                            title="Redefinir senha"
                          >
                            <Key size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                            title={isActive(u) ? 'Desativar' : 'Ativar'}
                          >
                            {isActive(u)
                              ? <ToggleRight size={16} className="text-green-500" />
                              : <ToggleLeft size={16} className="text-gray-400" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUserModal && (
        <UserEditModal
          user={editUser}
          groups={groups}
          onClose={() => setShowUserModal(false)}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

export default UserManagementTab;

