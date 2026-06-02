import React, { useState, useEffect, useMemo } from 'react';
import { Fuel, CheckCircle, Loader, AlertTriangle, RefreshCw, Gauge, Wallet, XCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';

const TIPO_LABEL = {
    BloqueadoLeitura:   { label: 'Leitura Inválida',   cor: 'bg-red-100 text-red-800',    icon: Gauge  },
    BloqueadoOrcamento: { label: 'Orçamento (20%)',     cor: 'bg-orange-100 text-orange-800', icon: Wallet },
};

const AbastecimentoAdminTab = () => {
    const [refuelings, setRefuelings] = useState([]);
    const [obras, setObras]           = useState([]);
    const [vehicles, setVehicles]     = useState([]);
    const [employees, setEmployees]   = useState([]);
    const [partners, setPartners]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [liberando, setLiberando]   = useState(null);
    const [negando, setNegando]       = useState(null);
    const [mensagem, setMensagem]     = useState(null);
    const [filtro, setFiltro]         = useState('Todos');

    const load = async () => {
        setLoading(true);
        try {
            const [r, o, v, e, p] = await Promise.all([
                apiClient.getRefuelings(),
                apiClient.getObras(),
                apiClient.getVehicles(),
                apiClient.getEmployees(),
                apiClient.getPartners(),
            ]);
            setRefuelings(Array.isArray(r) ? r : []);
            setObras(Array.isArray(o) ? o : []);
            setVehicles(Array.isArray(v) ? v : []);
            setEmployees(Array.isArray(e) ? e : []);
            setPartners(Array.isArray(p) ? p : []);
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

    const enviarAoPosto = (ordem) => {
        const partner = partners.find(p => p.id === ordem.partnerId);
        const vehicle = getVehicle(ordem.vehicleId);
        const employee = getEmployee(ordem.employeeId);
        if (!partner) return;

        const authNum = String(ordem.authNumber).padStart(6, '0');
        const qtd = ordem.isFillUp ? 'COMPLETAR TANQUE' : `${ordem.litrosLiberados} Litros`;
        const dataFormatada = formatDate(ordem.data || ordem.date);
        const veiculoInfo = vehicle ? `${vehicle.marca || ''} ${vehicle.modelo || ''} - ${vehicle.placa} / ${vehicle.registroInterno}`.trim() : 'N/A';
        const outrosMsg = ordem.outros ? `\nOutros/Obs: ${ordem.outros}` : '';

        if (partner.email && partner.email.includes('@')) {
            const subject = `Autorização de Abastecimento #${authNum} - ${partner.razaoSocial}`;
            const body =
`Olá,

Segue autorização de abastecimento emitida pelo sistema Frotas MAK.

--- RESUMO ---

Nº Ordem: ${authNum}
Data: ${dataFormatada}
Posto: ${partner.razaoSocial}
Veículo: ${veiculoInfo}
Combustível: ${ordem.fuelType}
Qtd: ${qtd}${outrosMsg}
Motorista: ${employee?.nome || 'N/A'}

Esta ordem foi liberada pelo Administrador do sistema.

Att,
Equipe Frotas MAK`;
            window.location.href = `mailto:${partner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            return;
        }

        const phone = partner.whatsapp || partner.telefone;
        if (phone) {
            const msg =
`*ORDEM DE ABASTECIMENTO - FROTAS MAK*
*(Liberada pelo Administrador)*

*Nº Ordem:* ${authNum}
*Data:* ${dataFormatada}
*Posto:* ${partner.razaoSocial}
*Veículo:* ${veiculoInfo}
*Combustível:* ${ordem.fuelType}
*Qtd:* ${qtd}${outrosMsg ? '\n*Obs:* ' + ordem.outros : ''}
*Motorista:* ${employee?.nome || 'N/A'}`;
            window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    };

    const handleLiberar = async ordem => {
        setLiberando(ordem.id);
        setMensagem(null);
        try {
            await apiClient.liberarOrdemBloqueada(ordem.id);
            await enviarAoPosto(ordem);
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
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
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
