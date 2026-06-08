import React, { useState, useEffect } from 'react';
import { Shield, Users, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';

import UserManagementTab from '../components/admin/UserManagementTab';
import AccessGroupsTab from '../components/admin/AccessGroupsTab';

const TABS = [
  { id: 'usuarios', label: 'Usuários',        icon: <Users size={15} /> },
  { id: 'grupos',   label: 'Grupos de Acesso', icon: <Layers size={15} /> },
];

const AdminUsuariosPage = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [users, setUsers]   = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    apiClient.getUsers().then(d => setUsers(d || [])).catch(() => {});
    apiClient.adminGetGroups().then(d => setGroups(d || [])).catch(() => {});
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <Shield size={52} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold text-gray-500">Acesso restrito a administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14' }} className="flex items-center gap-2">
          <Users size={22} className="text-yellow-500" />
          Usuários &amp; Acesso
        </h1>
      </div>

      <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-[#9E7A42] text-[#9E7A42]'
                  : 'border-transparent text-[#9a8a78] hover:text-[#6a5e4e] hover:border-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6">
        {activeTab === 'usuarios' && (
          <UserManagementTab groups={groups} onUsersChange={setUsers} />
        )}
        {activeTab === 'grupos' && (
          <AccessGroupsTab groups={groups} onGroupsChange={setGroups} />
        )}
      </div>
    </div>
  );
};

export default AdminUsuariosPage;
