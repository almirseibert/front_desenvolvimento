import React, { useState } from 'react';
import { Shield, Truck, Fuel, Bell, Satellite } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

import VehicleAdminTab    from '../components/admin/VehicleAdminTab';
import AbastecimentoAdminTab from '../components/admin/AbastecimentoAdminTab';
import AlertasAdminTab    from '../components/admin/AlertasAdminTab';
import GpsAdminTab        from '../components/admin/GpsAdminTab';

const TABS = [
  { id: 'veiculos',      label: 'Veículos',      icon: <Truck     size={15} /> },
  { id: 'abastecimento', label: 'Abastecimento',  icon: <Fuel      size={15} /> },
  { id: 'alertas',       label: 'Alertas',        icon: <Bell      size={15} /> },
  { id: 'gps',           label: 'GPS',            icon: <Satellite size={15} /> },
];

const AdminFrotaPage = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('veiculos');

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
          <Truck size={22} className="text-yellow-500" />
          Administração — Frota
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
        {activeTab === 'veiculos'      && <VehicleAdminTab />}
        {activeTab === 'abastecimento' && <AbastecimentoAdminTab />}
        {activeTab === 'alertas'       && <AlertasAdminTab />}
        {activeTab === 'gps'           && <GpsAdminTab />}
      </div>
    </div>
  );
};

export default AdminFrotaPage;
