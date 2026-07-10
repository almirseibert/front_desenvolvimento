import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader, MapPin, Clock, Truck, Plus, Trash2, DollarSign, User, ClipboardList } from 'lucide-react';
import { vehicleSubTypes } from '../../utils/vehicleRules';

// Ciclo de vida de planejamento — transições automáticas:
// radar (criada) → planejada (contrato de horas) → mobilização (1ª alocação) → ativa (1º lançamento de horas)
const OBRA_FASES = [
    { value: 'radar',       label: 'No radar (cadastrada, sem contrato)' },
    { value: 'planejada',   label: 'Plano definido (plano de trabalho registrado)' },
    { value: 'mobilizacao', label: 'Em mobilização (equipamento alocado)' },
    { value: 'ativa',       label: 'Em operação (apontando horas)' },
];
const PRE_ACTIVE_STATUSES = ['radar', 'planejada', 'mobilizacao'];

const ObraModal = ({
    user,
    obra,
    onClose,
    apiClient,
    reloadData,
    setAlertMessage,
    equipmentTypesForHours = [], // Recebe a lista filtrada (derivedEquipmentTypes) do Pai (ObrasPage)
    initialTipoRegistro = 'obra',
    employees = [],
}) => {
    // --- ESTADOS DO FORMULÁRIO ---
    const [tipoRegistro, setTipoRegistro] = useState(initialTipoRegistro); // 'obra' | 'centro_custo'
    const [nome, setNome] = useState('');
    const [responsavel, setResponsavel] = useState('');
    const [responsavelEmail, setResponsavelEmail] = useState('');
    const [responsavelWhatsapp, setResponsavelWhatsapp] = useState('');
    const [internalContacts, setInternalContacts] = useState([]);
    const [fiscal, setFiscal] = useState('');
    const [contractType, setContractType] = useState('horas'); // 'horas' | 'metrosQuadrados'
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    
    // --- ESTADOS DE CONTRATO POR HORAS (Dinâmico) ---
    // Estrutura: [{ type: 'Escavadeira', hours: 100, price: 150.00 }]
    const [contractedItems, setContractedItems] = useState([]);
    
    // Deslocamento Prancha
    const [kmContratadoPrancha, setKmContratadoPrancha] = useState('');
    const [valorKmPrancha, setValorKmPrancha] = useState('');

    // --- ESTADOS DE CONTRATO POR M² (Setores) ---
    const [sectors, setSectors] = useState([]);

    const [orgaoContratante, setOrgaoContratante] = useState('');
    const [regiao, setRegiao] = useState('');

    // --- ESTADOS DE PLANEJAMENTO (pré-obra) ---
    // Na criação a obra sempre nasce 'radar' e sobe de fase por gatilho; o seletor
    // de fase só aparece na edição (regressão manual do admin).
    const [statusObra, setStatusObra] = useState('radar');
    const [dataInicioPrevisto, setDataInicioPrevisto] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Contatos internos (para vincular WhatsApp do responsável da obra)
    useEffect(() => {
        apiClient.getInternalContacts()
            .then(data => setInternalContacts(Array.isArray(data) ? data : []))
            .catch(() => setInternalContacts([]));
    }, []);

    // --- INICIALIZAÇÃO (Modo Edição) ---
    useEffect(() => {
        if (obra) {
            setTipoRegistro(obra.tipo_registro || 'obra');
            setNome(obra.nome || '');
            setResponsavel(obra.responsavel || '');
            setResponsavelEmail(obra.responsavel_email || '');
            setResponsavelWhatsapp(obra.responsavel_whatsapp || '');
            setFiscal(obra.fiscal || '');
            setContractType(obra.contractType || 'horas');
            setDataInicio(obra.dataInicio ? new Date(obra.dataInicio).toISOString().split('T')[0] : '');
            // Previsão de fim agora vive em dataFimPrevisto; dataFim antigo serve de fallback
            const fimPrev = obra.dataFimPrevisto || (obra.status !== 'finalizada' ? obra.dataFim : null);
            setDataFim(fimPrev ? new Date(fimPrev).toISOString().split('T')[0] : '');
            setLatitude(obra.latitude || '');
            setLongitude(obra.longitude || '');
            setOrgaoContratante(obra.orgao_contratante || '');
            setRegiao(obra.regiao || '');

            setStatusObra(obra.status && obra.status !== 'finalizada' ? obra.status : 'ativa');
            setDataInicioPrevisto(obra.dataInicioPrevisto ? new Date(obra.dataInicioPrevisto).toISOString().split('T')[0] : '');

            // Restaura Contrato por Horas — prefere o plano por SUBGRUPO; legado por grupo como fallback
            const parseMaybe = (v) => (typeof v === 'string' ? JSON.parse(v) : (v || {}));
            const horasSubParsed = parseMaybe(obra.horasContratadasPorSubTipo);
            const usaSubTipo = Object.keys(horasSubParsed).length > 0;

            const horasParsed = usaSubTipo ? horasSubParsed : parseMaybe(obra.horasContratadasPorTipo);
            const valoresParsed = usaSubTipo ? parseMaybe(obra.valoresPorSubTipo) : parseMaybe(obra.valoresPorTipo);

            const items = Object.keys(horasParsed).map(type => ({
                type,
                hours: horasParsed[type],
                price: valoresParsed[type] || ''
            }));
            setContractedItems(items);

            setKmContratadoPrancha(obra.kmContratadoPrancha || '');
            setValorKmPrancha(obra.valorKmPrancha || '');

            // Restaura Contrato por M²
            const sectorsParsed = Array.isArray(obra.sectors) ? obra.sectors : [];
            setSectors(sectorsParsed);
        } else {
            // Se for nova obra, inicia limpo
            setContractedItems([]);
        }
    }, [obra]);

    // Opções de equipamento: expande cada grupo cobrável nos seus subgrupos;
    // grupo sem subgrupos entra como opção direta (mesma regra do backend).
    const equipmentOptions = useMemo(() => {
        const opts = [];
        equipmentTypesForHours.forEach(tipo => {
            const subs = vehicleSubTypes[tipo];
            if (Array.isArray(subs) && subs.length > 0) opts.push(...subs);
            else opts.push(tipo);
        });
        return [...new Set(opts)].sort();
    }, [equipmentTypesForHours]);

    // --- CÁLCULO DO VALOR TOTAL ---
    const totalValue = useMemo(() => {
        let total = 0;
        if (contractType === 'horas') {
            contractedItems.forEach(item => {
                total += (parseFloat(item.hours) || 0) * (parseFloat(item.price) || 0);
            });
            total += (parseFloat(kmContratadoPrancha) || 0) * (parseFloat(valorKmPrancha) || 0);
        } else {
            sectors.forEach(sector => {
                total += (parseFloat(sector.kmContratado) || 0) * (parseFloat(sector.price) || 0);
            });
        }
        return total;
    }, [contractType, contractedItems, kmContratadoPrancha, valorKmPrancha, sectors]);

    // --- HANDLERS HORAS ---
    const addContractedItem = () => {
        setContractedItems([...contractedItems, { type: '', hours: '', price: '' }]);
    };

    const removeContractedItem = (index) => {
        setContractedItems(contractedItems.filter((_, i) => i !== index));
    };

    const updateContractedItem = (index, field, value) => {
        const newItems = [...contractedItems];
        newItems[index][field] = value;
        setContractedItems(newItems);
    };

    // --- HANDLERS SETORES ---
    const addSector = () => {
        setSectors([...sectors, { name: '', kmContratado: '', kmConcluido: 0, price: '' }]);
    };

    const removeSector = (index) => {
        setSectors(sectors.filter((_, i) => i !== index));
    };

    const updateSector = (index, field, value) => {
        const newSectors = [...sectors];
        newSectors[index][field] = value;
        setSectors(newSectors);
    };

    // --- SUBMIT ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const isPreActive = PRE_ACTIVE_STATUSES.includes(statusObra);

        const payload = {
            tipo_registro: tipoRegistro,
            nome,
            responsavel,
            responsavel_email: responsavelEmail || null,
            responsavel_whatsapp: responsavelWhatsapp || null,
            fiscal,
            contractType,
            // Pré-obra não tem início real — é preenchido na 1ª alocação de equipamento
            dataInicio: isPreActive ? null : dataInicio,
            dataFimPrevisto: dataFim || null,
            dataInicioPrevisto: dataInicioPrevisto || null,
            status: tipoRegistro === 'centro_custo' ? 'ativa' : statusObra,
            latitude,
            longitude,
            kmContratadoPrancha: parseFloat(kmContratadoPrancha) || 0,
            valorKmPrancha: parseFloat(valorKmPrancha) || 0,
            valorTotalContrato: totalValue,
            orgao_contratante: orgaoContratante || null,
            regiao: regiao || null
        };

        if (contractType === 'horas') {
            // Plano detalhado por SUBGRUPO (fonte de verdade do planejamento)
            const horasSubObj = {};
            const valoresSubObj = {};
            // Agregado por GRUPO (compatibilidade com faturamento/relatórios legados)
            const subToTipo = {};
            Object.entries(vehicleSubTypes).forEach(([tipo, subs]) => {
                (subs || []).forEach(s => { subToTipo[s] = tipo; });
            });
            const horasObj = {};
            const valorPonderado = {};

            contractedItems.forEach(item => {
                if (item.type) {
                    const h = parseFloat(item.hours) || 0;
                    const v = parseFloat(item.price) || 0;
                    horasSubObj[item.type] = h;
                    valoresSubObj[item.type] = v;

                    const tipoPai = subToTipo[item.type] || item.type;
                    horasObj[tipoPai] = (horasObj[tipoPai] || 0) + h;
                    valorPonderado[tipoPai] = (valorPonderado[tipoPai] || 0) + h * v;
                }
            });

            const valoresObj = {};
            Object.keys(horasObj).forEach(tipoPai => {
                valoresObj[tipoPai] = horasObj[tipoPai] > 0
                    ? Math.round((valorPonderado[tipoPai] / horasObj[tipoPai]) * 100) / 100
                    : 0;
            });

            payload.horasContratadasPorSubTipo = horasSubObj;
            payload.valoresPorSubTipo = valoresSubObj;
            payload.horasContratadasPorTipo = horasObj;
            payload.valoresPorTipo = valoresObj;
            payload.sectors = [];
        } else {
            payload.sectors = sectors.map(s => ({
                ...s,
                kmContratado: parseFloat(s.kmContratado) || 0,
                price: parseFloat(s.price) || 0
            }));
            payload.horasContratadasPorTipo = {};
            payload.valoresPorTipo = {};
            payload.horasContratadasPorSubTipo = {};
            payload.valoresPorSubTipo = {};
        }

        try {
            if (obra) {
                await apiClient.updateObra(obra.id, payload);
                setAlertMessage("Obra atualizada com sucesso!");
            } else {
                await apiClient.createObra(payload);
                setAlertMessage("Obra criada com sucesso!");
            }
            reloadData();
            onClose();
        } catch (error) {
            console.error("Erro ao salvar obra:", error);
            setAlertMessage(error.message || "Erro ao salvar obra.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mak-modal-backdrop backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="mak-modal-header">
                    <h2 className="mak-modal-title">
                        {obra
                            ? (tipoRegistro === 'centro_custo' ? 'Editar Centro de Custo' : 'Editar Obra')
                            : (tipoRegistro === 'centro_custo' ? 'Novo Centro de Custo' : 'Nova Obra')}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500" disabled={isSubmitting}><X size={24}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 1. Dados Básicos */}
                    <div className="space-y-4">
                        {/* Tipo de Registro */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Registro</label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTipoRegistro('obra')}
                                    className={`flex-1 py-2 rounded-lg border-2 font-bold transition text-sm ${tipoRegistro === 'obra' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    Obra
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTipoRegistro('centro_custo')}
                                    className={`flex-1 py-2 rounded-lg border-2 font-bold transition text-sm ${tipoRegistro === 'centro_custo' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    Centro de Custo
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                {tipoRegistro === 'centro_custo' ? 'Nome do Centro de Custo *' : 'Nome da Obra *'}
                            </label>
                            <input
                                type="text"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none"
                                required
                                placeholder={tipoRegistro === 'centro_custo' ? 'Ex: Manutenção Interna' : 'Ex: Pavimentação Rua A'}
                            />
                        </div>

                        {/* Novos Campos: Responsável e Fiscal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                                    <User size={14}/> Líder de Obra
                                </label>
                                {employees.length > 0 ? (
                                    <select
                                        value={responsavelEmail}
                                        onChange={(e) => {
                                            const email = e.target.value;
                                            setResponsavelEmail(email);
                                            const emp = employees.find(x => x.email === email);
                                            setResponsavel(emp ? emp.nome : '');
                                        }}
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
                                    >
                                        <option value="">— Nenhum —</option>
                                        {employees.filter(emp => emp.email).map(emp => (
                                            <option key={emp.id} value={emp.email}>
                                                {emp.nome} ({emp.email})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={responsavel}
                                        onChange={(e) => setResponsavel(e.target.value)}
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none"
                                        placeholder="Nome do Responsável"
                                    />
                                )}
                                <p className="text-xs text-gray-400 mt-0.5">Recebe alertas da obra</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                                    <User size={14}/> WhatsApp do Responsável
                                </label>
                                <select
                                    value={responsavelWhatsapp}
                                    onChange={(e) => setResponsavelWhatsapp(e.target.value)}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
                                >
                                    <option value="">— Nenhum —</option>
                                    {internalContacts.filter(c => c.whatsapp).map(c => (
                                        <option key={c.id} value={c.whatsapp}>
                                            {c.nome}{c.cargo ? ` — ${c.cargo}` : ''}{c.setor ? ` (${c.setor})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {internalContacts.length === 0 && (
                                    <p className="text-xs text-red-500 mt-0.5">Nenhum contato interno com WhatsApp. Cadastre em Administração → Contatos Internos.</p>
                                )}
                                <p className="text-xs text-gray-400 mt-0.5">Recebe alertas da obra</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                                    <ClipboardList size={14}/> Fiscal da Obra
                                </label>
                                <input
                                    type="text"
                                    value={fiscal}
                                    onChange={(e) => setFiscal(e.target.value)}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none"
                                    placeholder="Nome do Fiscal"
                                />
                            </div>
                        </div>

                        {/* Fase (ciclo de vida de planejamento) — não se aplica a centro de custo */}
                        {tipoRegistro !== 'centro_custo' && (
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-3">
                                {obra ? (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Fase da Obra</label>
                                        <select
                                            value={statusObra}
                                            onChange={(e) => setStatusObra(e.target.value)}
                                            className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
                                        >
                                            {OBRA_FASES.map(f => (
                                                <option key={f.value} value={f.value}>{f.label}</option>
                                            ))}
                                        </select>
                                        {PRE_ACTIVE_STATUSES.includes(statusObra) && (
                                            <p className="text-xs text-amber-700 mt-1">
                                                Obra em fase de planejamento: fica fora dos fluxos operacionais e é ativada
                                                automaticamente ao receber o primeiro equipamento.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-amber-700">
                                        A obra será criada <strong>no radar</strong> e avança de fase
                                        automaticamente conforme os dados chegam: plano de trabalho registrado,
                                        equipamento alocado e horas apontadas.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {PRE_ACTIVE_STATUSES.includes(statusObra) && tipoRegistro !== 'centro_custo' ? (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Previsão Início</label>
                                    <input
                                        type="date"
                                        value={dataInicioPrevisto}
                                        onChange={(e) => setDataInicioPrevisto(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Data Início *</label>
                                    <input
                                        type="date"
                                        value={dataInicio}
                                        onChange={(e) => setDataInicio(e.target.value)}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Previsão Fim</label>
                                <input
                                    type="date"
                                    value={dataFim}
                                    onChange={(e) => setDataFim(e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                        </div>

                        {/* Órgão Contratante e Região */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Órgão Contratante</label>
                                <select
                                    value={orgaoContratante}
                                    onChange={(e) => setOrgaoContratante(e.target.value)}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    {['ALUGUEL','DOAÇÃO','INCRA','MUNICÍPIO','PARTICULAR','SEAPI','SEDUR'].map(o => (
                                        <option key={o} value={o}>{o}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Região</label>
                                <select
                                    value={regiao}
                                    onChange={(e) => setRegiao(e.target.value)}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Lajeado">Lajeado</option>
                                    <option value="Santa Maria">Santa Maria</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><MapPin size={14}/> Latitude</label>
                                <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full p-2 border rounded" placeholder="-29.1234"/>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><MapPin size={14}/> Longitude</label>
                                <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full p-2 border rounded" placeholder="-51.5678"/>
                            </div>
                        </div>
                    </div>

                    {/* 2. Configuração do Contrato */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3">Tipo de Contrato</label>
                        <div className="flex gap-4 mb-4">
                            <button 
                                type="button" 
                                onClick={() => setContractType('horas')}
                                className={`flex-1 py-2 rounded-lg border-2 font-bold transition ${contractType === 'horas' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                            >
                                Por Horas (Equipamentos)
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setContractType('metrosQuadrados')}
                                className={`flex-1 py-2 rounded-lg border-2 font-bold transition ${contractType === 'metrosQuadrados' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                            >
                                Por Produção (m² / Km)
                            </button>
                        </div>

                        {/* A. POR HORAS (LISTA DINÂMICA) */}
                        {contractType === 'horas' && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 animate-fadeIn">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                        <Clock size={16}/> Equipamentos Contratados
                                    </h3>
                                    <button type="button" onClick={addContractedItem} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold bg-white px-2 py-1 rounded border border-blue-200 shadow-sm">
                                        <Plus size={14}/> Adicionar Item
                                    </button>
                                </div>

                                {contractedItems.length === 0 && (
                                    <p className="text-sm text-gray-400 italic text-center py-4 bg-white rounded border border-dashed">
                                        Nenhum equipamento adicionado ao contrato.
                                    </p>
                                )}

                                <div className="space-y-3">
                                    {contractedItems.map((item, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row gap-3 items-end bg-white p-3 rounded border shadow-sm">
                                            <div className="w-full sm:flex-1">
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">Equipamento (Subgrupo)</label>
                                                <select
                                                    value={item.type}
                                                    onChange={(e) => updateContractedItem(index, 'type', e.target.value)}
                                                    className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {equipmentOptions.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-1/2 sm:w-24">
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">Horas</label>
                                                <input 
                                                    type="number" 
                                                    value={item.hours} 
                                                    onChange={(e) => updateContractedItem(index, 'hours', e.target.value)} 
                                                    className="w-full p-2 border rounded text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="w-1/2 sm:w-32">
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">Valor Unit. (R$)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={item.price} 
                                                    onChange={(e) => updateContractedItem(index, 'price', e.target.value)} 
                                                    className="w-full p-2 border rounded text-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <button type="button" onClick={() => removeContractedItem(index)} className="p-2 text-red-400 hover:bg-red-50 rounded mb-0.5">
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Deslocamento Prancha */}
                                <div className="mt-4 pt-4 border-t border-blue-200">
                                    <h4 className="text-xs font-bold text-blue-800 mb-2 uppercase">Deslocamento (Caminhão Prancha)</h4>
                                    <div className="flex gap-4 bg-white p-3 rounded border">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Km Total</label>
                                            <input 
                                                type="number" 
                                                value={kmContratadoPrancha} 
                                                onChange={(e) => setKmContratadoPrancha(e.target.value)} 
                                                className="w-full p-2 border rounded text-sm" 
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Valor Km (R$)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={valorKmPrancha} 
                                                onChange={(e) => setValorKmPrancha(e.target.value)} 
                                                className="w-full p-2 border rounded text-sm" 
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* B. POR M2 (SETORES) */}
                        {contractType === 'metrosQuadrados' && (
                            <div className="bg-green-50 p-4 rounded-lg border border-green-100 animate-fadeIn">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold text-green-800 flex items-center justify-between">
                                        Setores / Trechos
                                    </h3>
                                    <button type="button" onClick={addSector} className="text-xs flex items-center gap-1 text-green-600 hover:text-green-800 font-bold bg-white px-2 py-1 rounded border border-green-200 shadow-sm">
                                        <Plus size={14}/> Adicionar Setor
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {sectors.map((sector, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end bg-white p-3 rounded border shadow-sm">
                                            <div className="w-full sm:flex-1">
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">Nome do Setor</label>
                                                <input 
                                                    type="text" 
                                                    value={sector.name} 
                                                    onChange={(e) => updateSector(idx, 'name', e.target.value)} 
                                                    className="w-full p-2 border rounded text-sm" 
                                                    placeholder="Ex: Trecho 1"
                                                />
                                            </div>
                                            <div className="w-1/2 sm:w-24">
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">Qtd (m²/Km)</label>
                                                <input 
                                                    type="number" 
                                                    value={sector.kmContratado} 
                                                    onChange={(e) => updateSector(idx, 'kmContratado', e.target.value)} 
                                                    className="w-full p-2 border rounded text-sm" 
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="w-1/2 sm:w-32">
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">Preço Unit. (R$)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={sector.price} 
                                                    onChange={(e) => updateSector(idx, 'price', e.target.value)} 
                                                    className="w-full p-2 border rounded text-sm" 
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <button type="button" onClick={() => removeSector(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded mb-0.5">
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {sectors.length === 0 && <p className="text-center text-gray-400 text-sm italic py-4">Nenhum setor adicionado.</p>}
                                
                                {/* Deslocamento Prancha (Opcional no M2) */}
                                <div className="mt-4 pt-4 border-t border-green-200">
                                    <h4 className="text-xs font-bold text-green-800 mb-2 uppercase">Deslocamento (Caminhão Prancha)</h4>
                                    <div className="flex gap-4 bg-white p-3 rounded border">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Km Total</label>
                                            <input 
                                                type="number" 
                                                value={kmContratadoPrancha} 
                                                onChange={(e) => setKmContratadoPrancha(e.target.value)} 
                                                className="w-full p-2 border rounded text-sm" 
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Valor Km (R$)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={valorKmPrancha} 
                                                onChange={(e) => setValorKmPrancha(e.target.value)} 
                                                className="w-full p-2 border rounded text-sm" 
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Totalizador */}
                    <div className="bg-gray-900 text-white p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center shadow-lg">
                        <span className="font-medium flex items-center gap-2"><DollarSign size={20} className="text-green-400"/> Valor Total Estimado do Contrato:</span>
                        <span className="text-2xl font-bold text-green-400">
                            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded hover:bg-gray-200 transition" disabled={isSubmitting}>Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-yellow-400 text-gray-900 font-bold rounded hover:bg-[#fdf8f0]0 transition shadow-lg flex items-center gap-2" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader className="animate-spin" size={18}/> Salvando...</> : (tipoRegistro === 'centro_custo' ? 'Salvar Centro de Custo' : 'Salvar Obra')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ObraModal;



