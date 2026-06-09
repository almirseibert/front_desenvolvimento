import React, { useState, useEffect, useMemo } from 'react';
import { Fuel, CheckCircle, Loader, AlertTriangle, RefreshCw, Gauge, Wallet, XCircle, Settings, Plus, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import SearchableSelect from '../SearchableSelect';

const TIPO_LABEL = {
    BloqueadoLeitura:   { label: 'Leitura Inválida',   cor: 'bg-red-100 text-red-800',    icon: Gauge  },
    BloqueadoOrcamento: { label: 'Orçamento (20%)',     cor: 'bg-orange-100 text-orange-800', icon: Wallet },
};

const AbastecimentoAdminTab = () => {
    const [refuelings, setRefuelings] = useState([]);
    const [obras, setObras]           = useState([]);
    const [vehicles, setVehicles]     = useState([]);
    const [employees, setEmployees]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [liberando, setLiberando]   = useState(null);
    const [negando, setNegando]       = useState(null);
    const [mensagem, setMensagem]     = useState(null);
    const [filtro, setFiltro]         = useState('Todos');
    const [vehicleToAdd, setVehicleToAdd] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [r, o, v, e] = await Promise.all([
                apiClient.getRefuelings(),
                apiClient.getObras(),
                apiClient.getVehicles(),
                apiClient.getEmployees(),
            ]);
            setRefuelings(Array.isArray(r) ? r : []);
            setObras(Array.isArray(o) ? o : []);
            setVehicles(Array.isArray(v) ? v : []);
            setEmployees(Array.isArray(e) ? e : []);
        } catch {
            setMensagem({ tipo: 'erro', texto: 'Erro ao carregar dados.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const bloqueadas = useMemo(() => {
        const statusBloqueados = ['BloqueadoLeitura', 'BloqueadoOrcamento'];
        return [...refuelings]
            .filter(r => statusBloqueados.includes(r.status))
            .filter(r => filtro === 'Todos' || r.status === filtro)
            .sort((a, b) => new Date(b.data || b.date || 0) - new Date(a.data || a.date || 0));
    }, [refuelings, filtro]);

    const contagens = useMemo(() => ({
        Todos:              refuelings.filter(r => ['BloqueadoLeitura', 'BloqueadoOrcamento'].includes(r.status)).length,
        BloqueadoLeitura:   refuelings.filter(r => r.status === 'BloqueadoLeitura').length,
        BloqueadoOrcamento: refuelings.filter(r => r.status === 'BloqueadoOrcamento').length,
    }), [refuelings]);

    const getObra     = id => obras.find(o => o.id === id);
    const getVehicle  = id => vehicles.find(v => v.id === id);
    const getEmployee = id => employees.find(e => e.id === id);

    const veiculosFicticios = useMemo(
        () => vehicles
            .filter(v => v.permiteMultiplosAbastecimentos == 1 || v.permiteMultiplosAbastecimentos === true)
            .sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')),
        [vehicles]
    );

    const veiculosDisponiveisParaLiberar = useMemo(
        () => vehicles
            .filter(v =>
                !(v.permiteMultiplosAbastecimentos == 1 || v.permiteMultiplosAbastecimentos === true)
                && v.status !== 'Inativo' && v.status !== 'Sucata'
            )
            .sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')),
        [vehicles]
    );

    const toggleVeiculoFicticio = async (vehicle, liberar) => {
        if (!vehicle) return;
        setTogglingId(vehicle.id);
        setMensagem(null);
        try {
            await apiClient.updateVehicle(vehicle.id, { permiteMultiplosAbastecimentos: liberar ? 1 : 0 });
            setVehicles(prev => prev.map(v => v.id === vehicle.id
                ? { ...v, permiteMultiplosAbastecimentos: liberar ? 1 : 0 }
                : v));
            setMensagem({
                tipo: 'ok',
                texto: liberar
                    ? `${vehicle.registroInterno || vehicle.placa} liberado para múltiplos abastecimentos abertos.`
                    : `Liberação removida de ${vehicle.registroInterno || vehicle.placa}.`,
            });
            if (liberar) setVehicleToAdd(null);
        } catch (e) {
            setMensagem({ tipo: 'erro', texto: `Erro ao atualizar veículo: ${e.message}` });
        } finally {
            setTogglingId(null);
        }
    };

    const formatDate = d => {
        if (!d) return 'N/A';
        try { return new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR'); } catch { return 'N/A'; }
    };

    const getMotivoLeitura = ordem => {
        if (ordem.status !== 'BloqueadoLeitura') return null;
        const eb = ordem.editedBy;
        if (eb && eb.motivoBloqueio) return eb.motivoBloqueio;
        return 'Leitura de Km/Hr inválida ou salto excessivo.';
    };

    const handleLiberar = async ordem => {
        setLiberando(ordem.id);
        setMensagem(null);
        try {
            await apiClient.liberarOrdemBloqueada(ordem.id);
            setMensagem({ tipo: 'ok', texto: `Ordem #${String(ordem.authNumber).padStart(6, '0')} liberada e enviada ao posto.` });
            await load();
        } catch (e) {
            setMensagem({ tipo: 'erro', texto: `Erro ao liberar: ${e.message}` });
        } finally {
            setLiberando(null);
        }
    };

    const handleNegar = async ordem => {
        if (!window.confirm(`Negar e excluir a ordem #${String(ordem.authNumber).padStart(6, '0')}? Esta ação não pode ser desfeita.`)) return;
        setNegando(ordem.id);
        setMensagem(null);
        try {
            await apiClient.negarOrdemBloqueada(ordem.id);
            setMensagem({ tipo: 'ok', texto: `Ordem #${String(ordem.authNumber).padStart(6, '0')} negada e excluída.` });
            await load();
        } catch (e) {
            setMensagem({ tipo: 'erro', texto: `Erro ao negar: ${e.message}` });
        } finally {
            setNegando(null);
        }
    };

    const FiltroBtn = ({ id, label }) => (
        <button
            onClick={() => setFiltro(id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 ${filtro === id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
            {label}
            {contagens[id] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filtro === id ? 'bg-white text-gray-800' : 'bg-gray-200 text-gray-700'}`}>
                    {contagens[id]}
                </span>
            )}
        </button>
    );

    return (
        <div className="space-y-4">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="mak-modal-title">
                        <Fuel size={20} className="text-yellow-500" />
                        Ordens de Abastecimento Bloqueadas
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Ordens pendentes de aprovação por leitura inválida ou orçamento excedido.
                    </p>
                </div>
                <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition shrink-0">
                    <RefreshCw size={14} /> Atualizar
                </button>
            </div>

            {/* Card de Veículos Fictícios — Liberação de Múltiplos Abastecimentos */}
            <div className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        <Settings size={18} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-800">
                            Veículos com liberação de múltiplos abastecimentos abertos
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                            Ignoram a regra que bloqueia nova ordem quando há outra em aberto. Use para veículos fictícios
                            destinados a ajuda de custo, adiantamento de salário em combustível ou abastecimento de
                            equipamentos sem registro interno (bombas, lava-jato, geradores etc.).
                        </p>
                    </div>
                </div>

                {/* Adicionar veículo */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end mb-3">
                    <div className="flex-1">
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Adicionar veículo</label>
                        <SearchableSelect
                            items={veiculosDisponiveisParaLiberar}
                            value={vehicleToAdd?.id || ''}
                            onChange={(v) => setVehicleToAdd(v || null)}
                            getLabel={(v) => `${v.registroInterno || 's/registro'} - ${v.placa || 's/placa'}`}
                            getSubLabel={(v) => [v.tipo, v.modelo].filter(Boolean).join(' • ')}
                            placeholder="Buscar veículo para liberar..."
                        />
                    </div>
                    <button
                        onClick={() => toggleVeiculoFicticio(vehicleToAdd, true)}
                        disabled={!vehicleToAdd || togglingId === vehicleToAdd?.id}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {togglingId === vehicleToAdd?.id
                            ? <Loader size={14} className="animate-spin" />
                            : <Plus size={14} />}
                        Liberar
                    </button>
                </div>

                {/* Lista de veículos atualmente liberados */}
                {veiculosFicticios.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-3 border-t">
                        Nenhum veículo liberado para múltiplos abastecimentos.
                    </p>
                ) : (
                    <div className="border-t pt-3">
                        <p className="text-[11px] text-gray-500 mb-2 font-semibold">
                            {veiculosFicticios.length} veículo{veiculosFicticios.length === 1 ? '' : 's'} liberado{veiculosFicticios.length === 1 ? '' : 's'}:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {veiculosFicticios.map(v => (
                                <div
                                    key={v.id}
                                    className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-2.5 py-1.5 text-xs"
                                >
                                    <div className="flex flex-col leading-tight">
                                        <span className="font-bold">{v.registroInterno || 's/registro'}</span>
                                        <span className="text-[10px] text-blue-700">
                                            {v.placa || 's/placa'}{v.modelo ? ` • ${v.modelo}` : ''}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => toggleVeiculoFicticio(v, false)}
                                        disabled={togglingId === v.id}
                                        title="Remover liberação"
                                        className="ml-1 p-1 rounded-full hover:bg-blue-200 transition disabled:opacity-50"
                                    >
                                        {togglingId === v.id
                                            ? <Loader size={12} className="animate-spin" />
                                            : <X size={12} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
                <FiltroBtn id="Todos"              label="Todas" />
                <FiltroBtn id="BloqueadoLeitura"   label="Leitura Inválida" />
                <FiltroBtn id="BloqueadoOrcamento" label="Orçamento (20%)" />
            </div>

            {/* Feedback */}
            {mensagem && (
                <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${mensagem.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {mensagem.tipo === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {mensagem.texto}
                </div>
            )}

            {/* Legenda */}
            <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"/> Leitura inválida — Km/Hr inferior ao atual ou salto excessivo</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"/> Orçamento — combustível atingiu 20% do valor do contrato</span>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader className="animate-spin text-yellow-500" size={28} />
                </div>
            ) : bloqueadas.length === 0 ? (
                <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
                    <CheckCircle size={36} className="mx-auto mb-3 text-green-300" />
                    <p className="font-medium">Nenhuma ordem bloqueada{filtro !== 'Todos' ? ' nesta categoria' : ''}.</p>
                </div>
            ) : (
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs border-b">
                            <tr>
                                <th className="px-4 py-3">Nº</th>
                                <th className="px-4 py-3">Data</th>
                                <th className="px-4 py-3">Veículo</th>
                                <th className="px-4 py-3">Motorista</th>
                                <th className="px-4 py-3">Obra</th>
                                <th className="px-4 py-3">Combustível / Qtd</th>
                                <th className="px-4 py-3">Tipo de Bloqueio</th>
                                <th className="px-4 py-3">Motivo</th>
                                <th className="px-4 py-3 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {bloqueadas.map(ordem => {
                                const vehicle  = getVehicle(ordem.vehicleId);
                                const obra     = getObra(ordem.obraId);
                                const employee = getEmployee(ordem.employeeId);
                                const meta     = TIPO_LABEL[ordem.status] || {};
                                const Icon     = meta.icon || AlertTriangle;

                                let motivo = '—';
                                if (ordem.status === 'BloqueadoLeitura') {
                                    motivo = getMotivoLeitura(ordem) || 'Km/Hr inválido ou salto excessivo.';
                                } else if (ordem.status === 'BloqueadoOrcamento') {
                                    const contrato = obra?.valorContrato ? parseFloat(obra.valorContrato) : 0;
                                    motivo = contrato > 0
                                        ? `Contrato R$ ${contrato.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} — limite 20% atingido`
                                        : 'Orçamento de combustível atingido (20%).';
                                }

                                return (
                                    <tr key={ordem.id} className={ordem.status === 'BloqueadoLeitura' ? 'bg-red-50/30 hover:bg-red-50/60' : 'bg-orange-50/20 hover:bg-orange-50/50'}>
                                        <td className="px-4 py-3 font-bold text-gray-800">
                                            #{String(ordem.authNumber).padStart(6, '0')}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                            {formatDate(ordem.data || ordem.date)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-800">{vehicle?.registroInterno || 'N/A'}</div>
                                            <div className="text-xs text-gray-400">{vehicle?.placa}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {employee?.nome || (typeof ordem.createdBy === 'object' ? ordem.createdBy?.nome : null) || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate" title={obra?.nome}>
                                            {obra?.nome || ordem.obraId || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                            {ordem.fuelType || 'N/A'}
                                            <div className="text-xs text-gray-400">
                                                {ordem.isFillUp ? 'Tanque cheio' : `${ordem.litrosLiberados || 0} L`}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.cor || 'bg-gray-100 text-gray-700'}`}>
                                                <Icon size={10} /> {meta.label || ordem.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px]">
                                            {motivo}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => handleLiberar(ordem)}
                                                    disabled={liberando === ordem.id || negando === ordem.id}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    {liberando === ordem.id
                                                        ? <Loader size={12} className="animate-spin" />
                                                        : <CheckCircle size={12} />
                                                    }
                                                    Liberar
                                                </button>
                                                <button
                                                    onClick={() => handleNegar(ordem)}
                                                    disabled={liberando === ordem.id || negando === ordem.id}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    {negando === ordem.id
                                                        ? <Loader size={12} className="animate-spin" />
                                                        : <XCircle size={12} />
                                                    }
                                                    Negar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-400">
                        {bloqueadas.length} ordem(ns) aguardando liberação
                    </div>
                </div>
            )}
        </div>
    );
};

export default AbastecimentoAdminTab;

