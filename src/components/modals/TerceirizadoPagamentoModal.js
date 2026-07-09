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
const TerceirizadoPagamentoModal = ({ locador, equipamentos = [], pagamento, user, apiClient, setAlertMessage, onClose, onSaved }) => {
    const [form, setForm] = useState({
        vehicleId: pagamento?.vehicleId || '',
        data: pagamento?.data ? String(pagamento.data).split('T')[0] : new Date().toISOString().split('T')[0],
        valor: pagamento?.valor != null ? String(pagamento.valor) : '',
        descricao: pagamento?.descricao || '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const valorNum = parseFloat(form.valor);
        if (!valorNum || valorNum <= 0) {
            setAlertMessage?.('Informe um valor de pagamento válido.');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                locadorId: locador.id,
                vehicleId: form.vehicleId || null,
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
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Locador</label>
                        <div className="p-2 bg-gray-50 border rounded-lg text-sm font-medium text-gray-700">{locador?.razaoSocial}</div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Equipamento (opcional)</label>
                        <select name="vehicleId" value={form.vehicleId} onChange={handleChange}
                            className="w-full p-2 border rounded-lg bg-white text-sm">
                            <option value="">— Geral (todo o locador) —</option>
                            {equipamentos.map((v) => (
                                <option key={v.id} value={v.id}>{v.registroInterno || v.placa} · {v.tipo}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data</label>
                            <input type="date" name="data" value={form.data} onChange={handleChange}
                                className="w-full p-2 border rounded-lg bg-white text-sm" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Valor (R$)</label>
                            <input type="number" min="0" step="any" name="valor" value={form.valor} onChange={handleChange}
                                placeholder="0,00" className="w-full p-2 border rounded-lg bg-white text-sm" required />
                        </div>
                    </div>
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
