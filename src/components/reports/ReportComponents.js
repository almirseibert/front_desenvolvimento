import React from 'react';
import { Filter } from 'lucide-react';

export const SectionHeader = ({ icon: Icon, title, description }) => (
    <div className="mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Icon className="text-yellow-500" size={24} />
            {title}
        </h2>
        {description && <p className="text-sm text-gray-500 mt-1 ml-8">{description}</p>}
    </div>
);

export const FilterSection = ({ children }) => (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
            <Filter size={14} /> Filtros de Relatório
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {children}
        </div>
    </div>
);