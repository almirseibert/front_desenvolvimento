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
            <h1 className="flex items-center gap-2 mb-4" style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14' }}>
                <Wrench size={20} style={{ color: '#9E7A42' }}/> Revisões & Manutenções
            </h1>

            {/* NAVEGAÇÃO EM ABAS */}
            <div className="flex mb-4 bg-white rounded-t-xl pt-1 px-2 overflow-x-auto" style={{ borderBottom: '1px solid #f0ebe3', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
                {[
                    { id: 'revisoes',   icon: <Calendar size={14}/>,  label: 'Revisões Preventivas' },
                    { id: 'manutencoes',icon: <Wrench size={14}/>,    label: 'Manutenções (Prog/Exec)' },
                    { id: 'lavagens',   icon: <Droplet size={14}/>,   label: 'Lavagens' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className="py-3 px-4 flex items-center gap-2 whitespace-nowrap transition-colors"
                        style={{
                            fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent',
                            borderBottom: activeTab === tab.id ? '2px solid #9E7A42' : '2px solid transparent',
                            color: activeTab === tab.id ? '#9E7A42' : '#9a8a78',
                            marginBottom: -1,
                        }}
                        onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.color = '#6a5e4e'; }}
                        onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.color = '#9a8a78'; }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
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