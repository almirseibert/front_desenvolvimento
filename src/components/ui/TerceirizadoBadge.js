import React from 'react';

/**
 * TerceirizadoBadge — selo "3º" reutilizável para sinalizar veículo locado.
 *
 * Padroniza o badge roxo que já era usado inline em VehiclePage.js,
 * ObraDetailModal.js e TiresPage.js (paleta de 'Terceirizado' em StatusBadge.js).
 *
 * Props:
 *  vehicle  object — se informado, só renderiza quando vehicle.isOutsourced
 *  show     bool   — força a exibição independentemente de `vehicle`
 *  label    string — texto do selo (padrão "3º")
 *  title    string — tooltip (padrão "Veículo terceirizado")
 *  style    object — estilos extras
 */
const TerceirizadoBadge = ({
    vehicle,
    show,
    label = '3º',
    title = 'Veículo terceirizado',
    style = {},
    className = '',
}) => {
    const visible = show ?? !!vehicle?.isOutsourced;
    if (!visible) return null;
    return (
        <span
            title={title}
            className={className}
            style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                background: '#f3e8ff',
                color: '#6b21a8',
                border: '1px solid #e9d5ff',
                borderRadius: 9999,
                padding: '1px 6px',
                whiteSpace: 'nowrap',
                ...style,
            }}
        >
            {label}
        </span>
    );
};

/**
 * terceirizadoPdfMark — sufixo textual para rótulos de veículo em PDFs
 * (jspdf-autotable não renderiza componentes React).
 * Ex.: `"F-102" + terceirizadoPdfMark(v)` → "F-102 (3º)".
 *
 * Aceita o veículo diretamente ou um booleano.
 */
export const terceirizadoPdfMark = (vehicleOrFlag, mark = ' (3º)') => {
    const isOut =
        typeof vehicleOrFlag === 'boolean' ? vehicleOrFlag : !!vehicleOrFlag?.isOutsourced;
    return isOut ? mark : '';
};

export default TerceirizadoBadge;
