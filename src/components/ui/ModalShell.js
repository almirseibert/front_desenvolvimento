import React from 'react';
import { X } from 'lucide-react';

/**
 * ModalShell — container padrão para todos os modais do sistema.
 *
 * Props:
 *   onClose     — fecha o modal (clique no X ou no backdrop)
 *   title       — título do header (string ou ReactNode)
 *   subtitle    — linha secundária abaixo do título (string, opcional)
 *   footer      — conteúdo do rodapé (ReactNode, opcional)
 *   width       — largura máxima do painel (default: 480px)
 *   danger      — bool — aplica borda/header em vermelho terroso
 *   noBackdropClose — bool — impede fechar ao clicar no backdrop
 *   className   — classes extras no painel interno
 *   children    — corpo do modal
 */
const ModalShell = ({
    onClose,
    title,
    subtitle,
    footer,
    width = 480,
    danger = false,
    noBackdropClose = false,
    className = '',
    children,
}) => {
    const handleBackdrop = (e) => {
        if (!noBackdropClose && e.target === e.currentTarget) onClose?.();
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={handleBackdrop}
        >
            <div
                className={`bg-white flex flex-col max-h-[92vh] w-full ${className}`}
                style={{
                    borderRadius: 12,
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
                    maxWidth: width,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                {(title || onClose) && (
                    <div
                        className="flex items-start justify-between shrink-0"
                        style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${danger ? '#fdf0ec' : '#f0ebe3'}` }}
                    >
                        <div>
                            {title && (
                                <div style={{ fontSize: 15, fontWeight: 700, color: danger ? '#b03828' : '#1e1a14', lineHeight: 1.3 }}>
                                    {title}
                                </div>
                            )}
                            {subtitle && (
                                <div style={{ fontSize: 11, color: '#9a8a78', marginTop: 2 }}>{subtitle}</div>
                            )}
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                style={{ background: 'transparent', border: 'none', color: '#b0a090', cursor: 'pointer', padding: 4, borderRadius: 5, lineHeight: 0, marginLeft: 12, flexShrink: 0 }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f5f2ed'; e.currentTarget.style.color = '#6a5e4e'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b0a090'; }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto mak-scrollbar" style={{ padding: '16px 18px' }}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div
                        className="flex justify-end gap-2 shrink-0"
                        style={{ padding: '12px 18px', borderTop: '1px solid #f0ebe3' }}
                    >
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModalShell;
