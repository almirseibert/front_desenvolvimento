import React, { useState } from 'react';
import { Search } from 'lucide-react';
import DiscrepanciasOperacionais from '../components/analise/DiscrepanciasOperacionais';

// Container da seção "Análise Gerencial".
// Hoje só existe 1 análise (Discrepâncias Operacionais). Quando uma 2ª for
// adicionada, basta empurrar pra ANALISES e a sub-nav aparece automaticamente.
const ANALISES = [
    {
        id: 'discrepancias',
        label: 'Divergências Operacionais',
        icon: <Search size={14} />,
        render: (props) => <DiscrepanciasOperacionais {...props} />,
    },
];

const AnaliseGerencialPage = (props) => {
    const [active, setActive] = useState(ANALISES[0].id);
    const current = ANALISES.find(a => a.id === active) || ANALISES[0];
    const showSubNav = ANALISES.length > 1;

    return (
        <div className="flex h-full" style={{ background: '#f5f3ef' }}>
            {showSubNav && (
                <aside
                    className="shrink-0 py-4 px-3"
                    style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e0d8' }}
                >
                    <p className="px-2 pb-2 mb-3" style={{
                        fontSize: 10, fontWeight: 700, color: '#9E7A42',
                        textTransform: 'uppercase', letterSpacing: '0.12em',
                        borderBottom: '1px solid #e5e0d8',
                    }}>
                        Análises
                    </p>
                    <ul className="space-y-1">
                        {ANALISES.map(a => (
                            <li key={a.id}>
                                <button
                                    onClick={() => setActive(a.id)}
                                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md transition-colors"
                                    style={a.id === active
                                        ? { background: '#9E7A42', color: '#fff', fontWeight: 700, fontSize: 13 }
                                        : { color: '#5a4e3a', fontSize: 13 }
                                    }
                                >
                                    {a.icon}
                                    <span className="truncate">{a.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
            )}

            <main className="flex-1 overflow-y-auto">
                {current.render(props)}
            </main>
        </div>
    );
};

export default AnaliseGerencialPage;
