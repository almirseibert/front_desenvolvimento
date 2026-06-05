import React, { useState } from 'react';
import { Layers, Truck } from 'lucide-react';
import VehicleTaxonomyTab from './VehicleTaxonomyTab';
import ComboiosAdminTab from './ComboiosAdminTab';

const SUB_TABS = [
    { id: 'taxonomia', label: 'Taxonomia',  icon: <Layers size={14}/> },
    { id: 'comboios',  label: 'Comboios',   icon: <Truck size={14}/> },
];

const VehicleAdminTab = () => {
    const [active, setActive] = useState('taxonomia');

    return (
        <div className="space-y-4">
            <div className="border-b border-gray-200 flex gap-1">
                {SUB_TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActive(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
                            active === t.id
                                ? 'border-yellow-500 text-yellow-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                        }`}
                    >
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {active === 'taxonomia' && <VehicleTaxonomyTab />}
            {active === 'comboios'  && <ComboiosAdminTab />}
        </div>
    );
};

export default VehicleAdminTab;
