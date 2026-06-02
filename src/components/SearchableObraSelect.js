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
            <div
                className="flex items-center rounded-lg transition-all"
                style={{ border: '1px solid #e8e0d4', background: '#faf9f7' }}
                onFocusCapture={e => { e.currentTarget.style.borderColor = '#9E7A42'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(158,122,66,0.18)'; e.currentTarget.style.background = '#fff'; }}
                onBlurCapture={e => { e.currentTarget.style.borderColor = '#e8e0d4'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.background = '#faf9f7'; }}
            >
                <Search size={15} className="ml-3 flex-shrink-0" style={{ color: '#b0a090' }} />
                <input
                    type="text"
                    className="mak-bare-input flex-1 outline-none bg-transparent min-w-0"
                    style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '7px 8px', fontSize: 13, color: '#3d3528', width: '100%' }}
                    placeholder={placeholder}
                    value={open ? search : (selectedObra?.nome || '')}
                    onFocus={() => { setSearch(''); setOpen(true); }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {value && (
                    <button
                        onClick={handleClear}
                        className="mak-bare-input p-2 flex-shrink-0 transition"
                        style={{ border: 'none', background: 'transparent', color: '#b0a090', cursor: 'pointer', lineHeight: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#b03828'}
                        onMouseLeave={e => e.currentTarget.style.color = '#b0a090'}
                        title="Limpar seleção"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            {open && (
                <div className="absolute z-40 w-full mt-1 bg-white rounded-lg shadow-xl max-h-72 overflow-y-auto mak-scrollbar" style={{ border: '1px solid #e8e0d4' }}>
                    {showEmpty && (
                        <p className="p-4 text-sm text-center" style={{ color: '#9a8a78' }}>Nenhuma obra encontrada.</p>
                    )}

                    {/* Recentes */}
                    {storageKey && !search && recentObras.length > 0 && (
                        <>
                            <div className="px-3 py-1.5 uppercase tracking-wider border-b" style={{ fontSize: 10, fontWeight: 700, color: '#b0a090', background: '#faf9f7' }}>
                                Recentes
                            </div>
                            {recentObras.map(obra => {
                                const isInactive = inactiveObras.some(o => o.id === obra.id);
                                const isSel = value === obra.id;
                                return (
                                    <button
                                        key={`recent-${obra.id}`}
                                        onClick={() => handleSelect(obra)}
                                        className="mak-bare-input w-full text-left px-4 py-2 transition flex items-center gap-2"
                                        style={{ fontSize: 13, border: 'none', background: isSel ? '#fdf8f0' : 'transparent', color: isSel ? '#9E7A42' : '#3d3528', fontWeight: isSel ? 600 : 400, cursor: 'pointer' }}
                                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#faf9f7'; }}
                                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isInactive ? 'bg-red-400' : 'bg-green-400'}`} />
                                        {obra.nome}
                                        {obra.tipo_registro === 'centro_custo' && <span className="ml-auto" style={{ fontSize: 10, color: '#b0a090' }}>(CC)</span>}
                                        {isInactive && <span className="ml-auto opacity-60" style={{ fontSize: 10, color: '#b0a090' }}>(finalizada)</span>}
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {/* Obras Ativas */}
                    {filtered.active.length > 0 && (
                        <>
                            <div className="px-3 py-1.5 uppercase tracking-wider border-b border-t" style={{ fontSize: 10, fontWeight: 700, color: '#b0a090', background: '#faf9f7' }}>
                                Obras Ativas
                            </div>
                            {filtered.active.map(obra => {
                                const isSel = value === obra.id;
                                return (
                                    <button
                                        key={obra.id}
                                        onClick={() => handleSelect(obra)}
                                        className="mak-bare-input w-full text-left px-4 py-2.5 transition flex items-center gap-2"
                                        style={{ fontSize: 13, border: 'none', background: isSel ? '#fdf8f0' : 'transparent', color: isSel ? '#9E7A42' : '#3d3528', fontWeight: isSel ? 600 : 400, cursor: 'pointer' }}
                                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#faf9f7'; }}
                                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                                        {obra.nome}
                                        {obra.tipo_registro === 'centro_custo' && <span className="ml-1" style={{ fontSize: 10, color: '#b0a090' }}>(CC)</span>}
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {/* Obras Finalizadas */}
                    {includeInactive && filtered.inactive.length > 0 && (
                        <>
                            <div className="px-3 py-1.5 uppercase tracking-wider border-b border-t mt-1" style={{ fontSize: 10, fontWeight: 700, color: '#b0a090', background: '#faf9f7' }}>
                                Obras Finalizadas
                            </div>
                            {filtered.inactive.map(obra => {
                                const isSel = value === obra.id;
                                return (
                                    <button
                                        key={obra.id}
                                        onClick={() => handleSelect(obra)}
                                        className="mak-bare-input w-full text-left px-4 py-2.5 transition flex items-center gap-2"
                                        style={{ fontSize: 13, border: 'none', background: isSel ? '#fdf0ec' : 'transparent', color: isSel ? '#b03828' : '#9a8a78', fontWeight: isSel ? 600 : 400, cursor: 'pointer' }}
                                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#faf9f7'; }}
                                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                                        {obra.nome}
                                        <span className="opacity-60" style={{ fontSize: 11 }}>(Finalizada)</span>
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableObraSelect;
