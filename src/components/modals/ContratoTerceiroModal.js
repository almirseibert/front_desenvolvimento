import React, { useState, useMemo } from 'react';
import { X, Loader, Save, FileText, Clock, Plus, Trash2, DollarSign } from 'lucide-react';
import { vehicleSubTypes, equipmentTypesForHours } from '../../utils/vehicleRules';

const fmtBRL = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const normalizeMaquinas = (m) => {
    if (Array.isArray(m)) return m.filter(Boolean);
    if (typeof m === 'string') { try { const p = JSON.parse(m); return Array.isArray(p) ? p.filter(Boolean) : []; } catch { return []; } }
    return [];
};
const normalizeItens = (v) => {
    let arr = v;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
    if (!Array.isArray(arr)) return [];
    return arr.filter((i) => i && i.type).map((i) => ({ type: i.type, hours: i.hours != null ? String(i.hours) : '', price: i.price != null ? String(i.price) : '' }));
};

/**
 * ContratoTerceiroModal — cria/edita um contrato de terceirizado, no padrão da Obra.
 * Dois modos: "Por horas" (lista de {subgrupo, horas, valor/hora}) ou "Valor fechado".
 * As máquinas são vinculadas explicitamente (1 máquina : 1 contrato; o diesel dela abate deste contrato).
 */
const ContratoTerceiroModal = ({ contrato, terceiros = [], obras = [], vehicles = [], contratos = [], initialLocadorId = '', user, apiClient, setAlertMessage, onClose, onSaved }) => {
    const [form, setForm] = useState({
        locadorId: contrato?.locadorId || initialLocadorId || '',
        obraId: contrato?.obraId || '',
        tipoMaquina: contrato?.tipoMaquina || '',
        contractType: contrato?.contractType === 'fechado' ? 'fechado' : 'horas',
        horasContratadas: contrato?.horasContratadas != null ? String(contrato.horasContratadas) : '',
        valorTotalFechado: contrato?.contractType === 'fechado' && contrato?.valorTotal != null ? String(contrato.valorTotal) : '',
        vigenciaInicio: contrato?.vigenciaInicio ? String(contrato.vigenciaInicio).split('T')[0] : '',
        vigenciaFim: contrato?.vigenciaFim ? String(contrato.vigenciaFim).split('T')[0] : '',
        status: contrato?.status || 'ativo',
        observacoes: contrato?.observacoes || '',
    });
    const [itens, setItens] = useState(() => normalizeItens(contrato?.itensContratados));
    const [maquinas, setMaquinas] = useState(() => normalizeMaquinas(contrato?.maquinas));
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    // Opções de subgrupo (mesma regra do ObraModal: expande grupos cobráveis em subgrupos).
    const equipmentOptions = useMemo(() => {
        const opts = [];
        equipmentTypesForHours.forEach((tipo) => {
            const subs = vehicleSubTypes[tipo];
            if (Array.isArray(subs) && subs.length > 0) opts.push(...subs);
            else opts.push(tipo);
        });
        return [...new Set(opts)].sort();
    }, []);

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

    const toggleMaquina = (id) => setMaquinas((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

    const addItem = () => setItens((c) => [...c, { type: '', hours: '', price: '' }]);
    const removeItem = (i) => setItens((c) => c.filter((_, idx) => idx !== i));
    const updateItem = (i, field, value) => setItens((c) => c.map((it, idx) => idx === i ? { ...it, [field]: value } : it));

    const valorTotal = useMemo(() => {
        if (form.contractType === 'fechado') return parseFloat(form.valorTotalFechado) || 0;
        return itens.reduce((a, i) => a + (parseFloat(i.hours) || 0) * (parseFloat(i.price) || 0), 0);
    }, [form.contractType, form.valorTotalFechado, itens]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.locadorId) { setAlertMessage?.('Selecione o terceiro.'); return; }
        if (!form.obraId) { setAlertMessage?.('Selecione a obra.'); return; }
        if (form.contractType === 'horas' && itens.filter((i) => i.type).length === 0) {
            setAlertMessage?.('Adicione ao menos um equipamento ao plano, ou use "Valor fechado".'); return;
        }
        if (form.contractType === 'fechado' && !(parseFloat(form.valorTotalFechado) > 0)) {
            setAlertMessage?.('Informe o valor fechado do contrato.'); return;
        }
        setIsSaving(true);
        try {
            const itensLimpos = itens.filter((i) => i.type).map((i) => ({ type: i.type, hours: parseFloat(i.hours) || 0, price: parseFloat(i.price) || 0 }));
            // tipoMaquina: usa o digitado ou deriva dos subgrupos do plano.
            const tipoMaquina = form.tipoMaquina || (itensLimpos.length > 0 ? [...new Set(itensLimpos.map((i) => i.type))].join(', ') : null);
            const payload = {
                locadorId: form.locadorId,
                obraId: form.obraId,
                tipoMaquina,
                contractType: form.contractType,
                itensContratados: form.contractType === 'horas' ? itensLimpos : [],
                horasContratadas: form.contractType === 'fechado' ? (parseFloat(form.horasContratadas) || 0) : undefined,
                valorTotal: form.contractType === 'fechado' ? (parseFloat(form.valorTotalFechado) || 0) : undefined,
                vigenciaInicio: form.vigenciaInicio || null,
                vigenciaFim: form.vigenciaFim || null,
                status: form.status,
                observacoes: form.observacoes || null,
                maquinas: maquinas.filter((id) => maquinasDoTerceiro.some((v) => v.id === id)),
                createdBy: { userEmail: user?.email || user?.userEmail || '' },
            };
            if (contrato?.id) await apiClient.updateTerceiroContrato(contrato.id, payload);
            else await apiClient.createTerceiroContrato(payload);
            setAlertMessage?.('Contrato salvo com sucesso!');
            onSaved?.();
            onClose?.();
        } catch (err) {
            setAlertMessage?.(err.message || 'Erro ao salvar contrato.');
        } finally {
            setIsSaving(false);
        }
    };

    const btnToggle = (active) => `flex-1 py-2 rounded-lg border-2 font-bold transition text-sm ${active ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FileText size={18} className="text-purple-500" />
                        {contrato ? `Contrato ${contrato.numero || ''}` : 'Novo Contrato'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" disabled={isSaving}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {!contrato && <p className="text-[11px] text-gray-400">O número do contrato é gerado automaticamente (CT-ANO-NNN).</p>}

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

                    {/* Tipo de contrato */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Tipo de contrato</label>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setForm((f) => ({ ...f, contractType: 'horas' }))} className={btnToggle(form.contractType === 'horas')}>
                                Por horas (equipamentos)
                            </button>
                            <button type="button" onClick={() => setForm((f) => ({ ...f, contractType: 'fechado' }))} className={btnToggle(form.contractType === 'fechado')}>
                                Valor fechado
                            </button>
                        </div>
                    </div>

                    {/* A. POR HORAS */}
                    {form.contractType === 'horas' && (
                        <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2"><Clock size={16} /> Equipamentos contratados</h3>
                                <button type="button" onClick={addItem} className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold bg-white px-2 py-1 rounded border border-purple-200 shadow-sm">
                                    <Plus size={14} /> Adicionar item
                                </button>
                            </div>
                            {itens.length === 0 && <p className="text-sm text-gray-400 italic text-center py-4 bg-white rounded border border-dashed">Nenhum equipamento adicionado.</p>}
                            <div className="space-y-2">
                                {itens.map((item, index) => (
                                    <div key={index} className="flex flex-col sm:flex-row gap-2 items-end bg-white p-3 rounded border shadow-sm">
                                        <div className="w-full sm:flex-1">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Equipamento (subgrupo)</label>
                                            <select value={item.type} onChange={(e) => updateItem(index, 'type', e.target.value)} className="w-full p-2 border rounded text-sm">
                                                <option value="">Selecione...</option>
                                                {equipmentOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-1/2 sm:w-24">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Horas</label>
                                            <input type="number" min="0" step="any" value={item.hours} onChange={(e) => updateItem(index, 'hours', e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="0" />
                                        </div>
                                        <div className="w-1/2 sm:w-32">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Valor/hora (R$)</label>
                                            <input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="0,00" />
                                        </div>
                                        <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-400 hover:bg-red-50 rounded mb-0.5"><Trash2 size={18} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* B. VALOR FECHADO */}
                    {form.contractType === 'fechado' && (
                        <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100 grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Valor fechado (R$)</label>
                                <input type="number" min="0" step="0.01" name="valorTotalFechado" value={form.valorTotalFechado} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white text-sm" placeholder="0,00" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Horas p/ progresso (opcional)</label>
                                <input type="number" min="0" step="any" name="horasContratadas" value={form.horasContratadas} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white text-sm" placeholder="0" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de máquina (descrição)</label>
                                <input name="tipoMaquina" value={form.tipoMaquina} onChange={handleChange} placeholder="Ex: Retroescavadeira" className="w-full p-2 border rounded-lg bg-white text-sm" />
                            </div>
                        </div>
                    )}

                    {/* Totalizador */}
                    <div className="bg-gray-900 text-white p-3 rounded-lg flex justify-between items-center">
                        <span className="font-medium flex items-center gap-2 text-sm"><DollarSign size={18} className="text-green-400" /> Valor total do contrato</span>
                        <span className="text-xl font-bold text-green-400">{fmtBRL(valorTotal)}</span>
                    </div>

                    {/* Máquinas vinculadas */}
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
                                    <label key={v.id} className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${bloqueada && !checked ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-200 cursor-pointer hover:bg-purple-50'}`}>
                                        <input type="checkbox" checked={checked} disabled={bloqueada && !checked} onChange={() => toggleMaquina(v.id)} className="h-4 w-4 text-purple-600 rounded" />
                                        <span className="font-medium">{v.registroInterno || v.placa}</span>
                                        <span className="text-gray-400 text-xs">· {v.tipo}{v.modelo ? ` ${v.modelo}` : ''}</span>
                                        {bloqueada && !checked && <span className="ml-auto text-[10px] text-gray-400">já em outro contrato</span>}
                                    </label>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Uma máquina só pode estar em um contrato — o diesel dela abate deste contrato.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Vigência início</label>
                            <input type="date" name="vigenciaInicio" value={form.vigenciaInicio} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Vigência fim</label>
                            <input type="date" name="vigenciaFim" value={form.vigenciaFim} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white text-sm" />
                        </div>
                    </div>

                    {contrato && (
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status</label>
                            <select name="status" value={form.status} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white text-sm">
                                <option value="ativo">Ativo</option>
                                <option value="concluido">Concluído</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Observações</label>
                        <textarea name="observacoes" value={form.observacoes} onChange={handleChange} rows={2} placeholder="Cláusulas adicionais que entram no PDF do contrato" className="w-full p-2 border rounded-lg bg-white text-sm" />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 flex items-center gap-2 disabled:opacity-60">
                            {isSaving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />} Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContratoTerceiroModal;
