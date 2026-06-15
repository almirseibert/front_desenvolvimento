import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Seletor genérico com busca por texto.
 *
 * Props:
 *   items       - array de objetos
 *   value       - id do item selecionado (string)
 *   onChange    - callback(item | null) chamado ao selecionar ou limpar
 *   getLabel    - função (item) => string para exibição no input e dropdown
 *   getId       - função (item) => string para chave única (default: item.id)
 *   getSubLabel - função opcional (item) => string para linha secundária (ex: placa, tipo)
 *   getBadge    - função opcional (item) => { text, color } para badge colorido
 *   placeholder - texto quando nenhum item selecionado
 *   className   - classe extra no container
 *   disabled    - desabilita o campo
 *   required    - marca campo como obrigatório
 *   overlay     - quando true, abre a lista como um seletor centralizado em
 *                 tela cheia (útil no celular, quando o campo fica baixo na
 *                 tela e o dropdown padrão seria cortado pelo limite do visor)
 *   overlayTitle - título exibido no topo do seletor em modo overlay
 */
const SearchableSelect = ({
    items = [],
    value = '',
    onChange,
    getLabel = (item) => item?.nome || item?.label || String(item?.id || ''),
    getId = (item) => item?.id,
    getSubLabel = null,
    getBadge = null,
    placeholder = 'Buscar...',
    className = '',
    disabled = false,
    required = false,
    overlay = false,
    overlayTitle = 'Selecione',
}) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
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

    const filtered = useMemo(() => {
        const q = normalize(search);
        if (!q) return items;
        return items.filter(item => normalize(getLabel(item)).includes(q) || (getSubLabel && normalize(getSubLabel(item)).includes(q)));
    }, [search, items, getLabel, getSubLabel]);

    const selectedItem = useMemo(() => items.find(item => String(getId(item)) === String(value)), [value, items, getId]);

    const handleSelect = (item) => {
        setOpen(false);
        setSearch('');
        onChange && onChange(item);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setSearch('');
        setOpen(false);
        onChange && onChange(null);
    };

    // Lista de opções — compartilhada entre o dropdown padrão e o modo overlay.
    const optionList = (
        <>
            {filtered.length === 0 && (
                <p className="p-3 text-xs text-center" style={{ color: '#9a8a78' }}>Nenhum resultado.</p>
            )}
            {filtered.map(item => {
                const id = getId(item);
                const label = getLabel(item);
                const sub = getSubLabel ? getSubLabel(item) : null;
                const badge = getBadge ? getBadge(item) : null;
                const isSelected = String(id) === String(value);
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => handleSelect(item)}
                        className="mak-bare-input w-full text-left px-3 py-2 transition flex items-center justify-between gap-2"
                        style={{
                            fontSize: 12, border: 'none', background: isSelected ? '#fdf8f0' : 'transparent',
                            color: isSelected ? '#9E7A42' : '#3d3528', fontWeight: isSelected ? 600 : 400,
                            cursor: 'pointer',
                        }}
                        onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = '#faf9f7'; } }}
                        onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; } }}
                    >
                        <span className="flex flex-col min-w-0">
                            <span className="truncate">{label}</span>
                            {sub && <span className="truncate" style={{ fontSize: 10, color: '#b0a090' }}>{sub}</span>}
                        </span>
                        {badge && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
                                {badge.text}
                            </span>
                        )}
                    </button>
                );
            })}
        </>
    );

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className={`flex items-center rounded-lg transition-all ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
                style={{
                    border: '1px solid #e8e0d4',
                    background: disabled ? '#f0ebe3' : '#faf9f7',
                }}
                onFocusCapture={e => { e.currentTarget.style.borderColor = '#9E7A42'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(158,122,66,0.18)'; e.currentTarget.style.background = '#fff'; }}
                onBlurCapture={e => { e.currentTarget.style.borderColor = '#e8e0d4'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.background = disabled ? '#f0ebe3' : '#faf9f7'; }}
            >
                <Search size={14} className="ml-2 flex-shrink-0" style={{ color: '#b0a090' }} />
                <input
                    type="text"
                    className="mak-bare-input flex-1 px-2 py-1.5 outline-none text-xs bg-transparent min-w-0"
                    style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '6px 8px', fontSize: 12, color: '#3d3528', width: '100%' }}
                    placeholder={placeholder}
                    value={(open && !overlay) ? search : (selectedItem ? getLabel(selectedItem) : '')}
                    onFocus={() => { if (!disabled) { setSearch(''); setOpen(true); } }}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={disabled}
                    required={required && !value}
                    readOnly={!open || overlay}
                />
                {value && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="mak-bare-input p-1.5 flex-shrink-0 transition"
                        style={{ border: 'none', background: 'transparent', color: '#b0a090', cursor: 'pointer', lineHeight: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#b03828'}
                        onMouseLeave={e => e.currentTarget.style.color = '#b0a090'}
                        title="Limpar"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {open && !overlay && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl max-h-60 overflow-y-auto mak-scrollbar" style={{ border: '1px solid #e8e0d4' }}>
                    {optionList}
                </div>
            )}

            {open && overlay && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fadeIn"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget) { setOpen(false); setSearch(''); } }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden" style={{ maxHeight: '70vh', border: '1px solid #e8e0d4' }}>
                        <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid #e8e0d4' }}>
                            <Search size={16} className="flex-shrink-0" style={{ color: '#b0a090' }} />
                            <input
                                type="text"
                                autoFocus
                                className="mak-bare-input flex-1 outline-none bg-transparent min-w-0"
                                style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '4px 4px', fontSize: 14, color: '#3d3528' }}
                                placeholder={overlayTitle}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => { setOpen(false); setSearch(''); }}
                                className="mak-bare-input p-1.5 flex-shrink-0"
                                style={{ border: 'none', background: 'transparent', color: '#b0a090', cursor: 'pointer', lineHeight: 0 }}
                                title="Fechar"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="overflow-y-auto mak-scrollbar">
                            {optionList}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
