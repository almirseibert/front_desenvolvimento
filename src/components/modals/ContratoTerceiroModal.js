import React, { useState, useMemo } from 'react';
import { X, Loader, Save, FileText } from 'lucide-react';

const fmtBRL = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * ContratoTerceiroModal — cria/edita um contrato de terceirizado.
 * 1 contrato = 1 terceiro (locador) + 1 obra + valor fechado.
 * valorTotal = horasContratadas × valorHora (calculado, editável não é preciso).
 *
 * Props:
 *  contrato    objeto existente (edição) ou null (novo)
 *  terceiros   [{id, razaoSocial}]  — locadores disponíveis
 *  obras       [{id, nome}]
 *  user, apiClient, setAlertMessage, onClose, onSaved
 */
const normalizeMaquinas = (m) => {
    if (Array.isArray(m)) return m.filter(Boolean);
    if (typeof m === 'string') { try { const p = JSON.parse(m); return Array.isArray(p) ? p.filter(Boolean) : []; } catch { return []; } }
    return [];
};

const ContratoTerceiroModal = ({ contrato, terceiros = [], obras = [], vehicles = [], contratos = [], user, apiClient, setAlertMessage, onClose, onSaved }) => {
    const [form, setForm] = useState({
        locadorId: contrato?.locadorId || '',
        obraId: contrato?.obraId || '',
        tipoMaquina: contrato?.tipoMaquina || '',
        horasContratadas: contrato?.horasContratadas != null ? String(contrato.horasContratadas) : '',
        valorHora: contrato?.valorHora != null ? String(contrato.valorHora) : '',
        vigenciaInicio: contrato?.vigenciaInicio ? String(contrato.vigenciaInicio).split('T')[0] : '',
        vigenciaFim: contrato?.vigenciaFim ? String(contrato.vigenciaFim).split('T')[0] : '',
        status: contrato?.status || 'ativo',
        observacoes: contrato?.observacoes || '',
    });
    const [maquinas, setMaquinas] = useState(() => normalizeMaquinas(contrato?.maquinas));
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    // Máquinas do terceiro selecionado + quais já estão em OUTRO contrato (bloqueadas).
    const maquinasDoTerceiro = useMemo(
        () => vehicles.filter((v) => v.isOutsourced && v.locadorId === form.locadorId),
        [vehicles, form.locadorId]
    );
    const maquinasBloqueadas = useMemo(() => {
        const set = new Set();
        contratos.forEach((c) => {
            if (c.id === contrato?.id) return;
            normalizeMaquinas(c.maquinas).forEach((id) => set.add(id));
        });
        return set;
    }, [contratos, contrato]);

    const toggleMaquina = (id) => setMaquinas((cur) =>
        cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

    const valorTotal = useMemo(() => {
        const h = parseFloat(form.horasContratadas);
        const v = parseFloat(form.valorHora);
        return (Number.isFinite(h) ? h : 0) * (Number.isFinite(v) ? v : 0);
    }, [form.horasContratadas, form.valorHora]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.locadorId) { setAlertMessage?.('Selecione o terceiro.'); return; }
        if (!form.obraId) { setAlertMessage?.('Selecione a obra.'); return; }
        setIsSaving(true);
        try {
            const payload = {
                locadorId: form.locadorId,
                obraId: form.obraId,
                tipoMaquina: form.tipoMaquina || null,
                horasContratadas: parseFloat(form.horasContratadas) || 0,
                valorHora: parseFloat(form.valorHora) || 0,
                valorTotal,
                vigenciaInicio: form.vigenciaInicio || null,
                vigenciaFim: form.vigenciaFim || null,
                status: form.status,
                observacoes: form.observacoes || null,
                maquinas: maquinas.filter((id) => maquinasDoTerceiro.some((v) => v.id === id)),
                createdBy: { userEmail: user?.email || user?.userEmail || '' },
            };
            if (contrato?.id) {
                await apiClient.updateTerceiroContrato(contrato.id, payload);
            } else {
                await apiClient.createTerceiroContrato(payload);
            }
            setAlertMessage?.('Contrato salvo com sucesso!');
            onSaved?.();
            onClose?.();
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao salvar contrato.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FileText size={18} className="text-purple-500" />
                        {contrato ? `Contrato ${contrato.numero || ''}` : 'Novo Contrato'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" disabled={isSaving}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    {!contrato && (
                        <p className="text-[11px] text-gray-400">O número do contrato é gerado automaticamente (CT-ANO-NNN).</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Terceiro</label>
                            <select name="locadorId" value={form.locadorId}
                                onChange={(e) => { handleChange(e); setMaquinas([]); }}
                                className="w-full p-2 border rounded-lg bg-white text-sm" required>
                                <option value="">— Selecionar —</option>
                                {terceiros.map((t) => <option key={t.id} value={t.id}>{t.razaoSocial}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Obra</label>
                            <select name="obraId" value={form.obraId} onChange={handleChange}
                                className="w-full p-2 border rounded-lg bg-white text-sm" required>
                                <option value="">— Selecionar —</option>
                                {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de máquina</label>
                        <input name="tipoMaquina" value={form.tipoMaquina} onChange={handleChange}
                            placeholder="Ex: Retroescavadeira" className="w-full p-2 border rounded-lg bg-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Máquinas do contrato</label>
                        {!form.locadorId && <p className="text-[11px] text-gray-400">Selecione o terceiro para listar as máquinas.</p>}
                        {form.locadorId && maquinasDoTerceiro.length === 0 && (
                            <p className="text-[11px] text-gray-400">Este terceiro não tem veículos marcados como terceirizados. Marque no cadastro do veículo.</p>
                        )}
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {maquinasDoTerceiro.map((v) => {
                                const bloqueada = maquinasBloqueadas.has(v.id);
                                const checked = maquinas.includes(v.id);
                                return (
                                    <label key={v.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${bloqueada && !checked ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-200 cursor-pointer hover:bg-purple-50'}`}>
                                        <input type="checkbox" checked={checked} disabled={bloqueada && !checked}
                                            onChange={() => toggleMaquina(v.id)} className="h-4 w-4 text-purple-600 rounded" />
                                        <span className="font-medium">{v.registroInterno || v.placa}</span>
                                        <span className="text-gray-400 text-xs">· {v.tipo}{v.modelo ? ` ${v.modelo}` : ''}</span>
                                        {bloqueada && !checked && <span className="ml-auto text-[10px] text-gray-400">já em outro contrato</span>}
                                    </label>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Uma máquina só pode estar em um contrato — o diesel dela abate deste contrato.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Horas contratadas</label>
                            <input type="number" min="0" step="any" name="horasContratadas" value={form.horasContratadas} onChange={handleChange}
                                placeholder="300" className="w-full p-2 border rounded-lg bg-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Valor / hora</label>
                            <input type="number" min="0" step="any" name="valorHora" value={form.valorHora} onChange={handleChange}
                                placeholder="0,00" className="w-full p-2 border rounded-lg bg-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Valor total</label>
                            <div className="p-2 border rounded-lg bg-purple-50 text-sm font-bold text-purple-700">{fmtBRL(valorTotal)}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Vigência início</label>
                            <input type="date" name="vigenciaInicio" value={form.vigenciaInicio} onChange={handleChange}
                                className="w-full p-2 border rounded-lg bg-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Vigência fim</label>
                            <input type="date" name="vigenciaFim" value={form.vigenciaFim} onChange={handleChange}
                                className="w-full p-2 border rounded-lg bg-white text-sm" />
                        </div>
                    </div>
                    {contrato && (
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status</label>
                            <select name="status" value={form.status} onChange={handleChange}
                                className="w-full p-2 border rounded-lg bg-white text-sm">
                                <option value="ativo">Ativo</option>
                                <option value="concluido">Concluído</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Observações</label>
                        <textarea name="observacoes" value={form.observacoes} onChange={handleChange} rows={2}
                            placeholder="Cláusulas adicionais que entram no PDF do contrato" className="w-full p-2 border rounded-lg bg-white text-sm" />
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

export default ContratoTerceiroModal;
