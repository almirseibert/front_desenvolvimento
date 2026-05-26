import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader, MapPin, Clock, Truck, Plus, Trash2, DollarSign, User, ClipboardList } from 'lucide-react';

const ObraModal = ({ 
    user, 
    obra, 
    onClose, 
    apiClient, 
    reloadData, 
    setAlertMessage, 
    equipmentTypesForHours = [] // Recebe a lista filtrada (derivedEquipmentTypes) do Pai (ObrasPage)
}) => {
    // --- ESTADOS DO FORMULÁRIO ---
    const [nome, setNome] = useState('');
    const [responsavel, setResponsavel] = useState('');
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

    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- INICIALIZAÇÃO (Modo Edição) ---
    useEffect(() => {
        if (obra) {
            setNome(obra.nome || '');
            setResponsavel(obra.responsavel || '');
            setFiscal(obra.fiscal || '');
            setContractType(obra.contractType || 'horas');
            setDataInicio(obra.dataInicio ? new Date(obra.dataInicio).toISOString().split('T')[0] : '');
            setDataFim(obra.dataFim ? new Date(obra.dataFim).toISOString().split('T')[0] : '');
            setLatitude(obra.latitude || '');
            setLongitude(obra.longitude || '');
            
            // Restaura Contrato por Horas
            const horasParsed = typeof obra.horasContratadasPorTipo === 'string' 
                ? JSON.parse(obra.horasContratadasPorTipo) 
                : (obra.horasContratadasPorTipo || {});
            
            const valoresParsed = typeof obra.valoresPorTipo === 'string'
                ? JSON.parse(obra.valoresPorTipo)
                : (obra.valoresPorTipo || {});

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

        const payload = {
            nome,
            responsavel,
            fiscal,
            contractType,
            dataInicio,
            dataFim: dataFim || null,
            latitude,
            longitude,
            kmContratadoPrancha: parseFloat(kmContratadoPrancha) || 0,
            valorKmPrancha: parseFloat(valorKmPrancha) || 0,
            valorTotalContrato: totalValue
        };

        if (contractType === 'horas') {
            const horasObj = {};
            const valoresObj = {};
            
            contractedItems.forEach(item => {
                if (item.type) {
                    horasObj[item.type] = parseFloat(item.hours) || 0;
                    valoresObj[item.type] = parseFloat(item.price) || 0;
                }
            });

            payload.horasContratadasPorTipo = horasObj;
            payload.valoresPorTipo = valoresObj; // Novo campo para salvar preços
            payload.sectors = []; 
        } else {
            payload.sectors = sectors.map(s => ({
                ...s,
                kmContratado: parseFloat(s.kmContratado) || 0,
                price: parseFloat(s.price) || 0
            }));
            payload.horasContratadasPorTipo = {}; 
            payload.valoresPorTipo = {};
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-gray-800">{obra ? 'Editar Obra' : 'Nova Obra'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500" disabled={isSubmitting}><X size={24}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 1. Dados Básicos */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Obra *</label>
                            <input 
                                type="text" 
                                value={nome} 
                                onChange={(e) => setNome(e.target.value)} 
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none" 
                                required 
                                placeholder="Ex: Pavimentação Rua A"
                            />
                        </div>

                        {/* Novos Campos: Responsável e Fiscal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                                    <User size={14}/> Responsável da Obra
                                </label>
                                <input 
                                    type="text" 
                                    value={responsavel} 
                                    onChange={(e) => setResponsavel(e.target.value)} 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-400 outline-none" 
                                    placeholder="Nome do Responsável"
                                />
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
                        
                        <div className="grid grid-cols-2 gap-4">
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
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">Tipo de Veículo</label>
                                                <select 
                                                    value={item.type} 
                                                    onChange={(e) => updateContractedItem(index, 'type', e.target.value)} 
                                                    className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {equipmentTypesForHours.map(t => (
                                                        <option key={t} value={t}>{t}</option>
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
                        <button type="submit" className="px-6 py-2 bg-yellow-400 text-gray-900 font-bold rounded hover:bg-yellow-500 transition shadow-lg flex items-center gap-2" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader className="animate-spin" size={18}/> Salvando...</> : 'Salvar Obra'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ObraModal;