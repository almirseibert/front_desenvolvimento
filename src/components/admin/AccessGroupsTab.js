import React, { useState } from 'react';
import { Shield, Plus, Edit, Trash2, Layers, Loader } from 'lucide-react';
import apiClient from '../../services/apiClient';
import AccessGroupModal, { MODULES } from '../modals/AccessGroupModal';

const AccessGroupsTab = ({ groups = [], onGroupsChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleSave = async (data, id) => {
    setSaving(true);
    try {
      if (id) {
        await apiClient.adminUpdateGroup(id, data);
        onGroupsChange(prev => prev.map(g => g.id === id ? { ...g, ...data } : g));
        showToast('Grupo atualizado com sucesso!');
      } else {
        const created = await apiClient.adminCreateGroup(data);
        onGroupsChange(prev => [...prev, { ...data, id: created.id, userCount: 0 }]);
        showToast('Grupo criado com sucesso!');
      }
      setShowModal(false);
    } catch (e) {
      showToast(e.message || 'Erro ao salvar grupo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este grupo de acesso? Os usuários vinculados perderão o grupo.')) return;
    try {
      await apiClient.adminDeleteGroup(id);
      onGroupsChange(prev => prev.filter(g => g.id !== id));
      showToast('Grupo removido.');
    } catch (e) {
      showToast(e.message || 'Erro ao remover grupo.');
    }
  };

  const getModuleLabel = (id) => MODULES.find(m => m.id === id)?.label || id;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-yellow-500" />
            <span className="font-bold text-gray-800">Grupos de Acesso</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{groups.length}</span>
          </div>
          <button
            onClick={() => { setEditGroup(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg text-sm transition-colors"
          >
            <Plus size={14} /> Novo Grupo
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-14 text-gray-300">
            <Shield size={40} className="mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">Nenhum grupo cadastrado.</p>
            <p className="text-xs text-gray-300 mt-1">Crie grupos para controlar quais módulos cada equipe acessa.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <th className="p-3 text-left font-semibold">Nome</th>
                  <th className="p-3 text-left font-semibold">Descrição</th>
                  <th className="p-3 text-left font-semibold">Módulos Permitidos</th>
                  <th className="p-3 text-center font-semibold">Usuários</th>
                  <th className="p-3 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-semibold text-gray-800">{g.name}</td>
                    <td className="p-3 text-gray-400 text-xs">{g.description || '-'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(g.modules || []).length === 0 ? (
                          <span className="text-xs text-gray-300 italic">Nenhum</span>
                        ) : (g.modules || []).length === MODULES.length ? (
                          <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">Todos os módulos</span>
                        ) : (
                          <>
                            {(g.modules || []).slice(0, 4).map(m => (
                              <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                                {getModuleLabel(m)}
                              </span>
                            ))}
                            {(g.modules || []).length > 4 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                                +{g.modules.length - 4} mais
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center text-gray-500">{g.userCount || 0}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => { setEditGroup(g); setShowModal(true); }}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors"
                          title="Editar grupo"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
                          title="Remover grupo"
                        >
                          <Trash2 size={14} />
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

      {showModal && (
        <AccessGroupModal
          group={editGroup}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
};

export default AccessGroupsTab;

