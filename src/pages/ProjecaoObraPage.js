import React from 'react';
import ProjecaoObra from '../components/analise/ProjecaoObra';

// Página "Projeção de Obra" dentro da seção Análise Gerencial.
const ProjecaoObraPage = ({ obras }) => (
    <div className="flex h-full" style={{ background: '#f5f3ef' }}>
        <main className="flex-1 overflow-y-auto">
            <ProjecaoObra obras={obras} />
        </main>
    </div>
);

export default ProjecaoObraPage;
