import React from 'react';
import { AlertTriangle, Wrench, ClipboardX, Receipt } from 'lucide-react';

const Item = ({ icon: Icon, color, children, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 text-left text-[12px] text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded px-1.5 py-1 transition-colors w-full"
    >
        <Icon size={14} className={color} />
        <span>{children}</span>
    </button>
);

const AlertsCompact = ({ alerts, navigate }) => {
    if (!alerts) return null;

    const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

    return (
        <section className="bg-white rounded-xl border border-stone-200 p-3 px-4">
            <h2 className="text-sm font-semibold text-stone-900 mb-2">Ações pendentes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                <Item icon={AlertTriangle} color="text-amber-500" onClick={() => navigate && navigate('solicitacoes-abastecimento')}>
                    {alerts.solicitacoesPendentes} solicitações de abastecimento aguardando
                </Item>
                <Item icon={Wrench} color="text-amber-500" onClick={() => navigate && navigate('revisions')}>
                    {alerts.revisoesVencidas} revisões vencidas
                </Item>
                <Item icon={ClipboardX} color="text-amber-500" onClick={() => navigate && navigate('obras')}>
                    {alerts.obrasEscopoEstourar} obras com escopo prestes a estourar
                </Item>
                <Item icon={Receipt} color="text-red-500" onClick={() => navigate && navigate('fines')}>
                    {alerts.multasPendentes?.count || 0} multas pendentes · {fmtBRL(alerts.multasPendentes?.valor)}
                </Item>
            </div>
        </section>
    );
};

export default AlertsCompact;
