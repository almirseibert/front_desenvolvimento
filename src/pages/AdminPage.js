import React, { useState, useEffect } from 'react';
import { Shield, Users, Layers, MessageSquare, Settings, Server, Truck, Fuel, AlertTriangle, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';

import UserManagementTab from '../components/admin/UserManagementTab';
import AccessGroupsTab from '../components/admin/AccessGroupsTab';
import CommunicationTab from '../components/admin/CommunicationTab';
import ConfiguracoesTab from '../components/admin/ConfiguracoesTab';
import SystemTab from '../components/admin/SystemTab';
import VehicleAdminTab from '../components/admin/VehicleAdminTab';
import AbastecimentoAdminTab from '../components/admin/AbastecimentoAdminTab';
import SolicitacaoErrosTab from '../components/admin/SolicitacaoErrosTab';
import NotificacoesAdminTab from '../components/admin/NotificacoesAdminTab';
import ContatosInternosTab from '../components/admin/ContatosInternosTab';

const TABS = [
  { id: 'usuarios',      label: 'Usuários',         icon: <Users size={15} /> },
  { id: 'grupos',        label: 'Grupos de Acesso',  icon: <Layers size={15} /> },
  { id: 'veiculos',      label: 'Veículos',          icon: <Truck size={15} /> },
  { id: 'abastecimento', label: 'Abastecimento',     icon: <Fuel size={15} /> },
  { id: 'erros_app',     label: 'Erros App',         icon: <AlertTriangle size={15} /> },
  { id: 'comunicacao',   label: 'Comunicação',       icon: <MessageSquare size={15} /> },
  { id: 'notificacoes',  label: 'Notificações',      icon: <Bell size={15} /> },
  { id: 'contatos',      label: 'Contatos Internos', icon: <Users size={15} /> },
  { id: 'configuracoes', label: 'Configurações',     icon: <Settings size={15} /> },
  { id: 'sistema',       label: 'Sistema',           icon: <Server size={15} /> },
];

const AdminPage = ({ socket, initialTab }) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab || 'usuarios');
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadUsers();
    loadGroups();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await apiClient.getUsers();
      setUsers(data || []);
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await apiClient.adminGetGroups();
      setGroups(data || []);
    } catch (e) {
      console.error('Erro ao carregar grupos:', e);
    }
  };

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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" flex items-center gap-2">
          <Shield size={22} className="text-yellow-500" />
          Administração do Sistema
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0">
        <div className="flex overflow-x-auto">
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

      {/* Tab Content */}
      <div className="flex-1 p-6">
        {activeTab === 'usuarios' && (
          <UserManagementTab
            groups={groups}
            onUsersChange={setUsers}
          />
        )}
        {activeTab === 'grupos' && (
          <AccessGroupsTab
            groups={groups}
            onGroupsChange={setGroups}
          />
        )}
        {activeTab === 'veiculos' && (
          <VehicleAdminTab />
        )}
        {activeTab === 'abastecimento' && (
          <AbastecimentoAdminTab />
        )}
        {activeTab === 'erros_app' && (
          <SolicitacaoErrosTab />
        )}
        {activeTab === 'comunicacao' && (
          <CommunicationTab
            socket={socket}
            users={users}
          />
        )}
        {activeTab === 'notificacoes' && (
          <NotificacoesAdminTab />
        )}
        {activeTab === 'contatos' && (
          <ContatosInternosTab />
        )}
        {activeTab === 'configuracoes' && (
          <ConfiguracoesTab />
        )}
        {activeTab === 'sistema' && (
          <SystemTab />
        )}
      </div>
    </div>
  );
};

export default AdminPage;

