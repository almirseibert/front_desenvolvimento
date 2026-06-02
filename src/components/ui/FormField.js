import React from 'react';
import { Search } from 'lucide-react';

/**
 * FormField — label + input/select/textarea + mensagem de erro
 *
 * Props:
 *  label        string   — texto do label (uppercase automático via CSS)
 *  error        string   — mensagem de erro (opcional)
 *  mono         bool     — aplica font-mono (placas, hodômetro)
 *  search       bool     — adiciona ícone de busca à esquerda
 *  children     node     — o elemento <input>, <select> ou <textarea>
 *  className    string   — classes extras no wrapper
 */
const FormField = ({ label, error, mono, search, children, className = '' }) => {
    const child = React.Children.only(children);
    const inputClass = [
        'mak-input',
        mono ? 'mak-input-mono' : '',
        search ? 'mak-input-search' : '',
        error ? 'mak-input-error' : '',
        child.props.className || '',
    ].filter(Boolean).join(' ');

    const cloned = React.cloneElement(child, { className: inputClass });

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && (
                <label className="mak-label">{label}</label>
            )}
            {search ? (
                <div className="mak-input-wrap">
                    <Search size={14} className="mak-input-icon" />
                    {cloned}
                </div>
            ) : (
                cloned
            )}
            {error && (
                <span className="mak-error">{error}</span>
            )}
        </div>
    );
};

export default FormField;
