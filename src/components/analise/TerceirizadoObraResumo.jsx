import React, { useMemo } from 'react';
import { Truck, DollarSign, Droplet } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { computeTerceirizadoPorObra } from '../../utils/terceirizados';

const fmtBRL = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * TerceirizadoObraResumo — resumo financeiro dos equipamentos terceirizados de
 * uma obra: valor devido ao locador, combustível fornecido (abatido) e saldo a
 * pagar. Calculado no cliente pela util compartilhada (computeTerceirizadoPorObra),
 * a partir dos dados já carregados no DataContext.
 *
 * Props:
 *  obraId   string        — obra a resumir
 *  period   {inicio,fim}? — período opcional (padrão: todo o histórico)
 *  variant  'card'|'inline' — layout (padrão 'card')
 *  hideWhenEmpty bool     — se true (padrão), não renderiza nada quando a obra
 *                           não tem equipamento terceirizado com movimentação
 */
const TerceirizadoObraResumo = ({ obraId, period, variant = 'card', hideWhenEmpty = true }) => {
    const {
        obras = [], vehicles = [], partners = [],
        dailyWorkLogs = [], refuelings = [], comboioTransactions = [],
        terceirizadoPagamentos = [],
    } = useData();

    const resumo = useMemo(() => {
        if (!obraId) return null;
        const ctx = { dailyWorkLogs, refuelings, comboioTransactions, partners, pagamentos: terceirizadoPagamentos };
        return computeTerceirizadoPorObra(obraId, obras, vehicles, ctx, period || {});
    }, [obraId, obras, vehicles, partners, dailyWorkLogs, refuelings, comboioTransactions, terceirizadoPagamentos, period]);

    const isEmpty = !resumo || resumo.equipamentos.length === 0;
    if (isEmpty && hideWhenEmpty) return null;

    if (variant === 'inline') {
        return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-purple-700">
                    <Truck size={13} /> Terceirizados ({resumo?.equipamentos.length || 0})
                </span>
                <span className="text-gray-600">Devido: <b className="text-purple-700">{fmtBRL(resumo?.devido)}</b></span>
                <span className="text-gray-600">Combustível: <b className="text-blue-700">{fmtBRL(resumo?.combustivelAbatido)}</b></span>
                <span className="text-gray-600">Saldo: <b className={resumo?.saldo > 0 ? 'text-red-600' : 'text-green-600'}>{fmtBRL(resumo?.saldo)}</b></span>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3">
            <div className="flex items-center gap-2 mb-2">
                <Truck size={15} className="text-purple-500" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-purple-800">
                    Custos com Terceirizados
                </span>
                <span className="text-[11px] text-gray-400">({resumo?.equipamentos.length || 0} equip.)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1"><DollarSign size={11} /> Devido</div>
                    <div className="text-sm font-extrabold text-purple-700">{fmtBRL(resumo?.devido)}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1"><Droplet size={11} /> Combustível</div>
                    <div className="text-sm font-extrabold text-blue-700">{fmtBRL(resumo?.combustivelAbatido)}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1"><DollarSign size={11} /> Saldo a pagar</div>
                    <div className={`text-sm font-extrabold ${resumo?.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtBRL(resumo?.saldo)}</div>
                </div>
            </div>
        </div>
    );
};

export default TerceirizadoObraResumo;
