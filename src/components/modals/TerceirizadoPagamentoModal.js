import React, { useState } from 'react';
import { X, Loader, Save, Wallet } from 'lucide-react';

/**
 * TerceirizadoPagamentoModal — registra um pagamento em dinheiro a um locador
 * (opcionalmente vinculado a um equipamento específico). Abate do saldo devido.
 *
 * Props:
 *  locador       {id, razaoSocial}  — locador destinatário (obrigatório)
 *  equipamentos  [{id, registroInterno, tipo, ...}]  — para vincular a um veículo (opcional)
 *  pagamento     objeto existente (edição) ou null (novo)
 *  apiClient, setAlertMessage, onClose, onSaved
 */
const fmtBRL = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TerceirizadoPagamentoModal = ({ locador, contrato, pagamento, saldo, user, apiClient, setAlertMessage, onClose, onSaved }) => {
    const [form, setForm] = useState({
        data: pagamento?.data ? String(pagamento.data).split('T')[0] : new Date().toISOString().split('T')[0],
        valor: pagamento?.valor != null ? String(pagamento.valor) : '',
        descricao: pagamento?.descricao || '',
    });
    const [isSaving, setIsSaving] = useState(false);

    // Máximo que pode ser pago = saldo restante. Na edição, o saldo já veio com este
    // pagamento abatido, então o teto é saldo + valor atual do próprio pagamento.
    const saldoNum = Number(saldo);
    const temSaldo = Number.isFinite(saldoNum);
    const maxPagavel = temSaldo ? saldoNum + (pagamento?.id ? (Number(pagamento.valor) || 0) : 0) : Infinity;

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const valorNum = parseFloat(form.valor);
        if (!valorNum || valorNum <= 0) {
            setAlertMessage?.('Informe um valor de pagamento válido.');
            return;
        }
        // Tolerância de 1 centavo para arredondamento.
        if (temSaldo && valorNum > maxPagavel + 0.005) {
            setAlertMessage?.(
                maxPagavel <= 0
                    ? 'Não há saldo a pagar neste contrato — o valor já foi quitado.'
                    : `O valor excede o saldo a pagar (${fmtBRL(maxPagavel)}). Não é possível pagar mais do que o restante do contrato.`
            );
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                locadorId: locador.id,
                contratoId: contrato?.id || null,
                data: form.data,
                valor: valorNum,
                descricao: form.descricao || null,
                createdBy: { userEmail: user?.email || user?.userEmail || '' },
            };
            if (pagamento?.id) {
                await apiClient.updateTerceirizadoPagamento(pagamento.id, payload);
            } else {
                await apiClient.createTerceirizadoPagamento(payload);
            }
            setAlertMessage?.('Pagamento registrado com sucesso!');
            onSaved?.();
            onClose?.();
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao registrar pagamento.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Wallet size={18} className="text-purple-500" />
                        {pagamento ? 'Editar Pagamento' : 'Registrar Pagamento'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" disabled={isSaving}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Terceiro</label>
                        <div className="p-2 bg-gray-50 border rounded-lg text-sm font-medium text-gray-700">{locador?.razaoSocial}</div>
                    </div>
                    {contrato && (
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Contrato</label>
                            <div className="p-2 bg-purple-50 border border-purple-100 rounded-lg text-sm font-medium text-purple-700">
                                {contrato.numero}{contrato.tipoMaquina ? ` · ${contrato.tipoMaquina}` : ''}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data</label>
                            <input type="date" name="data" value={form.data} onChange={handleChange}
                                className="w-full p-2 border rounded-lg bg-white text-sm" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Valor (R$)</label>
                            <input type="number" min="0" step="any" max={temSaldo ? Math.max(0, maxPagavel) : undefined}
                                name="valor" value={form.valor} onChange={handleChange}
                                placeholder="0,00" className="w-full p-2 border rounded-lg bg-white text-sm" required />
                        </div>
                    </div>
                    {temSaldo && (
                        <p className={`text-xs ${maxPagavel > 0 ? 'text-gray-500' : 'text-red-600 font-semibold'}`}>
                            {maxPagavel > 0
                                ? <>Saldo a pagar: <span className="font-semibold text-gray-700">{fmtBRL(maxPagavel)}</span></>
                                : 'Sem saldo a pagar — contrato já quitado.'}
                        </p>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Descrição / Referência</label>
                        <input name="descricao" value={form.descricao} onChange={handleChange}
                            placeholder="Ex: Medição de junho, NF 123" className="w-full p-2 border rounded-lg bg-white text-sm" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} disabled={isSaving}
                            className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={isSaving}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 flex items-center gap-2 disabled:opacity-60">
                            {isSaving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />} Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TerceirizadoPagamentoModal;
