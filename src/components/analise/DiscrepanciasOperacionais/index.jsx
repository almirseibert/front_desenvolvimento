import React, { useState } from 'react';
import ObrasOverview from './ObrasOverview';
import ObraDetalhe from './ObraDetalhe';
import DiscrepanciaDrill from './DiscrepanciaDrill';

const defaultRange = () => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const startDate = lastMonth.toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    const endDate = lastDay.toISOString().slice(0, 10);
    return { startDate, endDate };
};

// Funil de 3 telas. Mantém range e obra selecionada no nível do funil
// pra navegação back/forward preservar contexto.
const DiscrepanciasOperacionais = (props) => {
    const [tela, setTela] = useState('obras');
    const [range, setRange] = useState(defaultRange);
    const [obra, setObra] = useState(null);
    const [discrepanciaId, setDiscrepanciaId] = useState(null);

    if (tela === 'drill' && discrepanciaId) {
        return (
            <DiscrepanciaDrill
                {...props}
                discrepanciaId={discrepanciaId}
                onBack={() => setTela('obra')}
            />
        );
    }

    if (tela === 'obra' && obra) {
        return (
            <ObraDetalhe
                {...props}
                obra={obra}
                range={range}
                onBack={() => { setObra(null); setTela('obras'); }}
                onSelectDiscrepancia={(id) => { setDiscrepanciaId(id); setTela('drill'); }}
            />
        );
    }

    return (
        <ObrasOverview
            {...props}
            range={range}
            setRange={setRange}
            onSelectObra={(o) => { setObra(o); setTela('obra'); }}
        />
    );
};

export default DiscrepanciasOperacionais;
