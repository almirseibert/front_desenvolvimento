import React, { useState } from 'react';
import { Wrench, Calendar, Droplet } from 'lucide-react';

// Importação das Abas Modularizadas
import RevisionsTab from '../components/revisions/RevisionsTab';
import MaintenancesTab from '../components/revisions/MaintenancesTab';
import WashingsTab from '../components/revisions/WashingsTab';

const RevisionsPage = ({
    user, vehicles = [], revisions = [], partners = [], obras = [],
    setAlertMessage, vehicleGroups = {}, apiClient, reloadData,
    PasswordConfirmationModal
}) => {
    const [activeTab, setActiveTab] = useState('revisoes');

    return (
        <div className="container mx-auto p-2 md:p-4 animate-fadeIn">
            <h1 className="text-2xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                {/* Ícone alterado para Chave de Boca (Wrench) */}
                <Wrench className="text-blue-600" /> Revisões & Manutenções
            </h1>
            
            {/* NAVEGAÇÃO EM ABAS */}
            <div className="flex border-b border-gray-200 mb-4 bg-white rounded-t-lg pt-2 px-2 overflow-x-auto shadow-sm">
                <button 
                    onClick={() => setActiveTab('revisoes')} 
                    className={`py-3 px-4 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'revisoes' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Calendar size={16} /> Revisões Preventivas
                </button>
                <button 
                    onClick={() => setActiveTab('manutencoes')} 
                    className={`py-3 px-4 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'manutencoes' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Wrench size={16} /> Manutenções (Prog/Exec)
                </button>
                <button 
                    onClick={() => setActiveTab('lavagens')} 
                    className={`py-3 px-4 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'lavagens' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Droplet size={16} /> Lavagens
                </button>
            </div>

            {/* CONTEÚDO DAS ABAS */}
            {activeTab === 'revisoes' && (
                <RevisionsTab 
                    user={user} 
                    vehicles={vehicles} 
                    revisions={revisions} 
                    apiClient={apiClient} 
                    reloadData={reloadData}
                    setAlertMessage={setAlertMessage}
                    PasswordConfirmationModal={PasswordConfirmationModal}
                />
            )}
            
            {activeTab === 'manutencoes' && (
                <MaintenancesTab 
                    vehicles={vehicles} 
                    obras={obras}
                    setAlertMessage={setAlertMessage}
                    apiClient={apiClient}
                />
            )}

            {activeTab === 'lavagens' && (
                <WashingsTab 
                    vehicles={vehicles} 
                    obras={obras}
                    setAlertMessage={setAlertMessage}
                    apiClient={apiClient}
                />
            )}
        </div>
    );
};

export default RevisionsPage;