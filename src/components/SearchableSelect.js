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

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className={`flex items-center border rounded-md focus-within:ring-2 focus-within:ring-yellow-400 focus-within:border-yellow-500 bg-white ${disabled ? 'bg-gray-100 opacity-60 pointer-events-none' : 'border-gray-300'}`}>
                <Search size={14} className="ml-2 text-gray-400 flex-shrink-0" />
                <input
                    type="text"
                    className="flex-1 px-2 py-1.5 outline-none text-xs bg-transparent min-w-0"
                    placeholder={placeholder}
                    value={open ? search : (selectedItem ? getLabel(selectedItem) : '')}
                    onFocus={() => { if (!disabled) { setSearch(''); setOpen(true); } }}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={disabled}
                    required={required && !value}
                    readOnly={!open}
                />
                {value && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition flex-shrink-0"
                        title="Limpar"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filtered.length === 0 && (
                        <p className="p-3 text-xs text-gray-500 text-center">Nenhum resultado.</p>
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
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-yellow-50 hover:text-yellow-800 transition flex items-center justify-between gap-2 ${isSelected ? 'bg-yellow-50 font-semibold text-yellow-800' : 'text-gray-800'}`}
                            >
                                <span className="flex flex-col min-w-0">
                                    <span className="truncate">{label}</span>
                                    {sub && <span className="text-[10px] text-gray-400 truncate">{sub}</span>}
                                </span>
                                {badge && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
                                        {badge.text}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
