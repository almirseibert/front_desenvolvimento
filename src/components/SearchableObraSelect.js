import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Seletor de obras com busca por texto.
 *
 * Props:
 *   obras          - array completo de obras (com campo `status` e `tipo_registro`)
 *   value          - id da obra selecionada (string)
 *   onChange       - callback(obra | null) chamado ao selecionar ou limpar
 *   placeholder    - texto do input quando vazio
 *   includeInactive - exibe obras finalizadas/inativas no dropdown (default: false)
 *   storageKey     - se fornecido, persiste as 10 obras mais recentes no localStorage
 *   className      - classe extra no container
 */
const SearchableObraSelect = ({
    obras = [],
    value = '',
    onChange,
    placeholder = 'Buscar obra pelo nome...',
    includeInactive = false,
    storageKey = null,
    className = '',
}) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [recentIds, setRecentIds] = useState(() => {
        if (!storageKey) return [];
        try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
    });

    const containerRef = useRef(null);

    useEffect(() => {
        const handleMouseDown = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, []);

    const normalize = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    const { activeObras, inactiveObras } = useMemo(() => {
        const active = [];
        const inactive = [];
        obras.forEach(o => {
            const isInactive = o.status === 'Finalizada' || o.status === 'Concluída' || o.status === 'Inativa';
            if (isInactive) inactive.push(o);
            else active.push(o);
        });
        active.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        inactive.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        return { activeObras: active, inactiveObras: inactive };
    }, [obras]);

    const filtered = useMemo(() => {
        const q = normalize(search);
        const match = (list) => q ? list.filter(o => normalize(o.nome).includes(q)) : list;
        return { active: match(activeObras), inactive: includeInactive ? match(inactiveObras) : [] };
    }, [search, activeObras, inactiveObras, includeInactive]);

    const recentObras = useMemo(() => {
        return recentIds.map(id => obras.find(o => o.id === id)).filter(Boolean);
    }, [recentIds, obras]);

    const selectedObra = useMemo(() => obras.find(o => o.id === value), [value, obras]);

    const saveRecent = (id) => {
        if (!storageKey) return;
        const updated = [id, ...recentIds.filter(x => x !== id)].slice(0, 10);
        setRecentIds(updated);
        try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
    };

    const handleSelect = (obra) => {
        setOpen(false);
        setSearch('');
        saveRecent(obra.id);
        onChange && onChange(obra);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setSearch('');
        setOpen(false);
        onChange && onChange(null);
    };

    const showEmpty =
        filtered.active.length === 0 &&
        filtered.inactive.length === 0 &&
        (!storageKey || recentObras.length === 0 || search);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="flex items-center border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-yellow-400 focus-within:border-yellow-500 bg-white">
                <Search size={15} className="ml-3 text-gray-400 flex-shrink-0" />
                <input
                    type="text"
                    className="flex-1 px-2 py-2 outline-none text-sm bg-transparent min-w-0"
                    placeholder={placeholder}
                    value={open ? search : (selectedObra?.nome || '')}
                    onFocus={() => { setSearch(''); setOpen(true); }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {value && (
                    <button
                        onClick={handleClear}
                        className="p-2 text-gray-400 hover:text-red-500 transition flex-shrink-0"
                        title="Limpar seleção"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            {open && (
                <div className="absolute z-40 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                    {showEmpty && (
                        <p className="p-4 text-sm text-gray-500 text-center">Nenhuma obra encontrada.</p>
                    )}

                    {/* Recentes — só aparece quando ainda não há busca */}
                    {storageKey && !search && recentObras.length > 0 && (
                        <>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b">
                                Recentes
                            </div>
                            {recentObras.map(obra => {
                                const isInactive = inactiveObras.some(o => o.id === obra.id);
                                return (
                                    <button
                                        key={`recent-${obra.id}`}
                                        onClick={() => handleSelect(obra)}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-yellow-50 hover:text-yellow-800 transition flex items-center gap-2 ${value === obra.id ? 'bg-yellow-50 font-semibold text-yellow-800' : 'text-gray-700'}`}
                                    >
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isInactive ? 'bg-red-400' : 'bg-green-400'}`} />
                                        {obra.nome}
                                        {obra.tipo_registro === 'centro_custo' && <span className="text-[10px] text-gray-400 ml-auto">(CC)</span>}
                                        {isInactive && <span className="text-[10px] text-gray-400 ml-auto opacity-60">(finalizada)</span>}
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {/* Obras Ativas */}
                    {filtered.active.length > 0 && (
                        <>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-t">
                                Obras Ativas
                            </div>
                            {filtered.active.map(obra => (
                                <button
                                    key={obra.id}
                                    onClick={() => handleSelect(obra)}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-yellow-50 hover:text-yellow-800 transition flex items-center gap-2 ${value === obra.id ? 'bg-yellow-50 font-semibold text-yellow-800' : 'text-gray-800'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                                    {obra.nome}
                                    {obra.tipo_registro === 'centro_custo' && <span className="text-[10px] text-gray-400 ml-1">(CC)</span>}
                                </button>
                            ))}
                        </>
                    )}

                    {/* Obras Finalizadas */}
                    {includeInactive && filtered.inactive.length > 0 && (
                        <>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-t mt-1">
                                Obras Finalizadas
                            </div>
                            {filtered.inactive.map(obra => (
                                <button
                                    key={obra.id}
                                    onClick={() => handleSelect(obra)}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-700 transition flex items-center gap-2 ${value === obra.id ? 'bg-red-50 font-semibold text-red-700' : 'text-gray-500'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                                    {obra.nome}
                                    <span className="text-xs opacity-60">(Finalizada)</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableObraSelect;
