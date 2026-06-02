import React from 'react';

/**
 * Variantes: primary | primary-sm | primary-xs | secondary | secondary-sm |
 *            danger | danger-sm | dark | ghost | icon | icon-danger
 */
const STYLES = {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: "'Roboto', sans-serif",
        transition: 'all 0.15s',
        cursor: 'pointer',
        border: 'none',
        outline: 'none',
        whiteSpace: 'nowrap',
    },
    primary: {
        background: '#9E7A42', color: '#ffffff',
        fontSize: 14, fontWeight: 700,
        padding: '8px 16px', borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    },
    'primary-sm': {
        background: '#9E7A42', color: '#ffffff',
        fontSize: 12, fontWeight: 700,
        padding: '5px 10px', borderRadius: 6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    },
    'primary-xs': {
        background: '#9E7A42', color: '#ffffff',
        fontSize: 11, fontWeight: 700,
        padding: '3px 8px', borderRadius: 5,
    },
    secondary: {
        background: '#ffffff', color: '#6a5e4e',
        fontSize: 14, fontWeight: 500,
        padding: '8px 16px', borderRadius: 8,
        border: '1px solid #e8e0d4',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    },
    'secondary-sm': {
        background: '#ffffff', color: '#6a5e4e',
        fontSize: 12, fontWeight: 500,
        padding: '5px 10px', borderRadius: 6,
        border: '1px solid #e8e0d4',
    },
    danger: {
        background: '#b03828', color: '#ffffff',
        fontSize: 14, fontWeight: 600,
        padding: '8px 16px', borderRadius: 8,
    },
    'danger-sm': {
        background: '#b03828', color: '#ffffff',
        fontSize: 12, fontWeight: 600,
        padding: '5px 10px', borderRadius: 6,
    },
    dark: {
        background: '#1c1a17', color: '#f0ebe3',
        fontSize: 14, fontWeight: 600,
        padding: '8px 16px', borderRadius: 8,
    },
    ghost: {
        background: 'transparent', color: '#9a8a78',
        fontSize: 14, fontWeight: 500,
        padding: '8px 16px', borderRadius: 8,
    },
    icon: {
        background: 'transparent', color: '#b0a090',
        padding: 6, borderRadius: 6,
        fontSize: 13,
    },
    'icon-danger': {
        background: 'transparent', color: '#b0a090',
        padding: 6, borderRadius: 6,
        fontSize: 13,
    },
};

const HOVER = {
    primary:      { background: '#8a6a34' },
    'primary-sm': { background: '#8a6a34' },
    'primary-xs': { background: '#8a6a34' },
    secondary:    { background: '#faf9f7' },
    'secondary-sm':{ background: '#faf9f7' },
    danger:       { background: '#9a2e20' },
    'danger-sm':  { background: '#9a2e20' },
    dark:         { background: '#2e2820' },
    ghost:        { background: '#f5f2ed', color: '#1e1a14' },
    icon:         { background: '#f5f2ed', color: '#3d3528' },
    'icon-danger':{ background: '#fdf0ec', color: '#b03828' },
};

const Button = React.forwardRef(({
    variant = 'secondary',
    disabled = false,
    children,
    className = '',
    style: extraStyle = {},
    onClick,
    type = 'button',
    title,
    ...rest
}, ref) => {
    const variantStyle = STYLES[variant] || STYLES.secondary;
    const hoverStyle = HOVER[variant] || {};

    const [hovered, setHovered] = React.useState(false);

    const computedStyle = {
        ...STYLES.base,
        ...variantStyle,
        ...(hovered && !disabled ? hoverStyle : {}),
        ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}),
        ...extraStyle,
    };

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled}
            title={title}
            style={computedStyle}
            className={className}
            onClick={disabled ? undefined : onClick}
            onMouseEnter={() => !disabled && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            {...rest}
        >
            {children}
        </button>
    );
});

Button.displayName = 'Button';
export default Button;
