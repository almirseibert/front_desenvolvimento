import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader, Info, Lock, FileText, Edit, Clock, Activity, TrendingUp, Send } from 'lucide-react';

import { getAllowedReadingTypes, getGroupUnit, getReadingSourceForUnit, computeConsumption, getGroupForType } from '../../utils/vehicleRules';
import SearchableObraSelect from '../SearchableObraSelect';
import SearchableSelect from '../SearchableSelect';

const RefuelingOrderModal = ({
    user,
    orderToEdit,
    vehicles = [],
    obras = [],
    partners = [],
    employees = [],
    refuelings = [], 
    expenses = [], 
    onClose,
    setAlertMessage,
    onGeneratePDF,
    extraObraOptions = [],
    ConfirmationModal,
    PasswordConfirmationModal,
    vehicleGroups = {},
    apiClient,
    reloadData,
    solicitacaoData = null 
}) => {
    
    // --- HELPERS DE DATA ---
    const isValidDbDate = (dateString) => {
        if (!dateString) return false;
        const str = String(dateString);
        return str.length > 5 && !str.startsWith('0000') && str !== '1970-01-01T00:00:00.000Z';
    };

    const getSafeDateObj = (dateInput) => {
        if (!isValidDbDate(dateInput)) return new Date(0);
        try {
            let dateStr = String(dateInput);
            if (dateStr.includes(' ') && !dateStr.includes('T')) dateStr = dateStr.replace(' ', 'T');
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? new Date(0) : d;
        } catch { return new Date(0); }
    };

    const formatDateDisplay = (dateInput) => {
        if (!isValidDbDate(dateInput)) return 'N/A';
        try {
            let dateStr = String(dateInput);
            if (dateStr.includes(' ') && !dateStr.includes('T')) dateStr = dateStr.replace(' ', 'T');
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Data Inválida';
            return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).toLocaleDateString('pt-BR');
        } catch { return 'Erro'; }
    };

    const normalizeFuelType = (val) => {
        if (!val) return '';
        const v = val.toString().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        
        const map = {
            'DIESEL S10': 'dieselS10',
            'DIESEL S-10': 'dieselS10',
            'DIESEL S500': 'dieselS500',
            'DIESEL S-500': 'dieselS500',
            'GASOLINA COMUM': 'gasolinaComum',
            'GASOLINA': 'gasolinaComum', 
            'GASOLINA ADITIVADA': 'gasolinaAditivada',
            'ETANOL': 'etanol',
            'ARLA 32': 'arla32',
            'ARLA': 'arla32'
        };

        if (map[v]) return map[v];
        if (v.includes('S10') || v.includes('S-10')) return 'dieselS10';
        if (v.includes('S500') || v.includes('S-500')) return 'dieselS500';
        if (v.includes('ADITIVADA')) return 'gasolinaAditivada';
        if (v.includes('GASOLINA')) return 'gasolinaComum';
        if (v.includes('DIESEL')) return 'dieselS10';
        if (v.includes('ETANOL')) return 'etanol';

        return '';
    };

    // --- ESTADOS ---
    const [formData, setFormData] = useState({
        vehicleId: '',
        partnerId: '',
        obraId: '',
        employeeId: '',
        date: new Date().toISOString().split('T')[0],
        odometro: '',
        horimetro: '',
        isFillUp: false,
        litrosLiberados: '',
        fuelType: '',
        needsArla: false,
        isFillUpArla: false,
        litrosLiberadosArla: '',
        outros: '',
        outrosGeraValor: false,
        outrosValor: '',
    });

    const prevVehicleIdRef = useRef(null);

    useEffect(() => {
        if (orderToEdit && orderToEdit.id && orderToEdit.id !== 'PREVIEW') {
            setFormData({
                vehicleId: orderToEdit.vehicleId || '',
                partnerId: orderToEdit.partnerId || '',
                obraId: orderToEdit.obraId || '',
                employeeId: orderToEdit.employeeId || '',
                date: orderToEdit.date 
                    ? getSafeDateObj(orderToEdit.date).toISOString().split('T')[0] 
                    : new Date().toISOString().split('T')[0],
                odometro: orderToEdit.odometro?.toString() || '',
                horimetro: orderToEdit.horimetro?.toString() || '',
                isFillUp: orderToEdit.isFillUp || false,
                litrosLiberados: orderToEdit.litrosLiberados?.toString() || '',
                fuelType: orderToEdit.fuelType || '',
                needsArla: orderToEdit.needsArla || false,
                isFillUpArla: orderToEdit.isFillUpArla || false,
                litrosLiberadosArla: orderToEdit.litrosLiberadosArla?.toString() || '',
                outros: orderToEdit.outros || '',
                outrosGeraValor: orderToEdit.outrosGeraValor || false,
                outrosValor: orderToEdit.outrosValor?.toString() || '',
            });
        } else if (solicitacaoData) {
            setFormData({
                vehicleId: solicitacaoData.veiculo_id || '',
                partnerId: solicitacaoData.posto_id || '',
                obraId: solicitacaoData.obra_id || '',
                employeeId: solicitacaoData.funcionario_id || '',
                date: new Date().toISOString().split('T')[0],
                odometro: solicitacaoData.odometro_informado?.toString() || '',
                horimetro: solicitacaoData.horimetro_informado?.toString() || '',
                isFillUp: !!solicitacaoData.flag_tanque_cheio,
                litrosLiberados: solicitacaoData.litragem_solicitada?.toString() || '',
                fuelType: normalizeFuelType(solicitacaoData.tipo_combustivel),
                needsArla: solicitacaoData.observacao && solicitacaoData.observacao.toUpperCase().includes('ARLA') ? true : false,
                isFillUpArla: false,
                litrosLiberadosArla: '',
                outros: solicitacaoData.observacao || '',
                outrosGeraValor: false,
                outrosValor: '',
            });
        }
    }, [orderToEdit, solicitacaoData]);

    const [isSaving, setIsSaving] = useState(false);
    const [blockReason, setBlockReason] = useState(null);

    const [warnings, setWarnings] = useState([]); 
    const [lastRefuelData, setLastRefuelData] = useState(null);
    const [lastAverage, setLastAverage] = useState(null); 
    const [obraStatus, setObraStatus] = useState(null);

    const isEditing = !!orderToEdit && !!orderToEdit.id && orderToEdit.id !== 'PREVIEW';
    const isSolicitacao = !!solicitacaoData;

    // Feriados nacionais BR (fixos). Móveis (Carnaval/Páscoa/Corpus Christi)
    // ficam de fora — se precisar incluir, migrar para tabela no backend.
    const FERIADOS_BR_FIXOS = useMemo(() => new Set([
        '01-01', // Confraternização
        '04-21', // Tiradentes
        '05-01', // Trabalho
        '09-07', // Independência
        '10-12', // N. Sra. Aparecida
        '11-02', // Finados
        '11-15', // Proclamação
        '12-25', // Natal
    ]), []);

    const isWeekendOrHoliday = useMemo(() => {
        if (!formData.date) return false;
        const d = new Date(formData.date + 'T12:00:00');
        const dow = d.getDay();
        if (dow === 0 || dow === 6) return true;
        return FERIADOS_BR_FIXOS.has(formData.date.slice(5));
    }, [formData.date, FERIADOS_BR_FIXOS]);

    // Ordem aberta = qualquer status que NÃO seja terminal. Inverter a lista
    // (em vez de listar "abertos") protege contra status novos do backend.
    const openOrderForVehicle = useMemo(() => {
        if (!formData.vehicleId) return null;
        const closedStatuses = ['Concluída', 'Concluida', 'Cancelada', 'Negada', 'Baixada'];
        return refuelings.find(r =>
            r.vehicleId === formData.vehicleId &&
            !closedStatuses.includes(r.status) &&
            (!isEditing || r.id !== orderToEdit.id)
        );
    }, [formData.vehicleId, refuelings, isEditing, orderToEdit]);

    // Veículos fictícios (gerador, lava-jato, ajuda de custo etc.) marcados em
    // Admin > Abastecimento ignoram a regra de duplicidade.
    const vehicleAllowsMultiple = useMemo(() => {
        if (!formData.vehicleId) return false;
        const v = vehicles.find(x => x.id === formData.vehicleId);
        return !!(v && (v.permiteMultiplosAbastecimentos == 1 || v.permiteMultiplosAbastecimentos === true));
    }, [formData.vehicleId, vehicles]);

    const duplicateBlocked = !!openOrderForVehicle && !isWeekendOrHoliday && !vehicleAllowsMultiple;

    useEffect(() => {
        if (formData.obraId && obras.length > 0) { 
            const obra = obras.find(o => o.id === formData.obraId);
            
            if (!obra || (extraObraOptions && extraObraOptions.includes(formData.obraId))) {
                setObraStatus(null);
                return;
            }

            // Gasto com combustível: a base real são os abastecimentos concluídos
            // (litros × preço + ARLA + outros). A tabela de `expenses` não possui
            // categoria 'Combustível', então sozinha o cálculo resultava sempre em
            // R$ 0,00. Usamos o maior valor entre expenses e refuelings — mesma regra
            // do backend (updateMonthlyExpense) e da tela de Solicitações.
            const totalFromExpenses = (expenses || [])
                .filter(e => String(e.obraId) === String(formData.obraId) && (e.category === 'Combustível' || e.fuelType))
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

            const totalFromRefuelings = (refuelings || [])
                .filter(r => String(r.obraId) === String(formData.obraId) && (r.status === 'Concluída' || r.status === 'Confirmada'))
                .reduce((sum, r) => {
                    const litros = parseFloat(r.litrosAbastecidos || 0);
                    const preco = parseFloat(r.pricePerLiter || 0);
                    const litrosArla = parseFloat(r.litrosAbastecidosArla || 0);
                    const precoArla = parseFloat(r.pricePerLiterArla || 0);
                    const outros = parseFloat(r.outrosValor || 0);
                    return sum + (litros * preco) + (litrosArla * precoArla) + outros;
                }, 0);

            const totalFuelExpenses = Math.max(totalFromExpenses, totalFromRefuelings);

            const valorTotalObra = parseFloat(obra.valorTotalContrato || obra.valorContrato || 0);

            if (valorTotalObra > 0) {
                const percentual = (totalFuelExpenses / valorTotalObra) * 100;
                setObraStatus({
                    totalGasto: totalFuelExpenses,
                    valorContrato: valorTotalObra,
                    percentual: percentual
                });
            } else {
                setObraStatus(null);
            }
        } else {
            setObraStatus(null);
        }
    }, [formData.obraId, obras, expenses, refuelings, extraObraOptions]);


    const sortedVehicles = useMemo(() =>
        [...vehicles]
            .filter(v => v.status !== 'Inativo' && v.status !== 'Sucata')
            .sort((a,b) => (a.registroInterno || '').localeCompare(b.registroInterno || ''))
    , [vehicles]);
    const sortedEmployees = useMemo(() => [...employees].sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [employees]);
    // Postos disponíveis para ordens: parceiros de tipo 'posto' E comboios internos
    // ('comboio'). Excluímos qualquer um marcado como bloqueado.
    const sortedPartners = useMemo(() =>
        [...partners]
            .filter(p => (p.tipo_parceiro === 'posto' || p.tipo_parceiro === 'comboio')
                && p.status_operacional !== 'Bloqueado'
                && p.status_operacional !== 'BLOQUEADO')
            .sort((a,b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || ''))
    , [partners]);
    const sortedObras = useMemo(() => [...obras].filter(o => o.status === 'ativa').sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [obras]);

    const selectedVehicle = useMemo(() => vehicles.find(v => v.id === formData.vehicleId), [formData.vehicleId, vehicles]);
    
    useEffect(() => {
        if (!selectedVehicle) {
            prevVehicleIdRef.current = null;
            setLastRefuelData(null);
            setLastAverage(null);
            setWarnings([]);
            return;
        }

        const history = refuelings
            .filter(r => r.vehicleId === selectedVehicle.id && r.status === 'Concluída')
            .sort((a,b) => {
                const dateA = a.data || a.date;
                const dateB = b.data || b.date;
                return getSafeDateObj(dateB).getTime() - getSafeDateObj(dateA).getTime();
            });
        
        const last = history[0];
        setLastRefuelData(last);

        // Preenchimento Automático APENAS quando o veículo mudar de fato, 
        // para não sobrescrever a digitação do usuário se refuelings atualizar em background.
        if (prevVehicleIdRef.current !== selectedVehicle.id) {
            prevVehicleIdRef.current = selectedVehicle.id;

            if (!isEditing && !isSolicitacao) {
                let autoEmployeeId = formData.employeeId;
                let autoObraId = formData.obraId;

                if (selectedVehicle.obraAtualId) {
                    const obra = obras.find(o => o.id === selectedVehicle.obraAtualId);
                    if (obra && obra.status === 'ativa') {
                        autoObraId = selectedVehicle.obraAtualId;
                        const alocacao = obra?.historicoVeiculos?.find(h => h.veiculoId === selectedVehicle.id && !h.dataSaida);
                        if (alocacao?.employeeId) autoEmployeeId = alocacao.employeeId;
                    }
                }
                
                let autoPartnerId = formData.partnerId;
                let autoFuelType = formData.fuelType;
                let autoLitros = formData.litrosLiberados;

                if (last) {
                    autoPartnerId = last.partnerId || '';
                    autoFuelType = last.fuelType || '';
                    autoLitros = last.litrosAbastecidos ? last.litrosAbastecidos.toString() : '';
                }

                setFormData(prev => ({
                    ...prev,
                    employeeId: autoEmployeeId || prev.employeeId,
                    obraId: autoObraId || prev.obraId,
                    partnerId: autoPartnerId || prev.partnerId,
                    fuelType: autoFuelType || prev.fuelType,
                    litrosLiberados: autoLitros || prev.litrosLiberados,
                    odometro: selectedVehicle.odometro?.toString() || '',
                    horimetro: selectedVehicle.horimetro?.toString() || ''
                }));
            }
        }

        const newWarnings = [];
        if (selectedVehicle.naoPodeCircular) newWarnings.push("⚠️ 'NÃO PODE CIRCULAR'");
        if (selectedVehicle.status === 'manutencao') newWarnings.push("🔧 Em manutenção.");
        setWarnings(newWarnings);

        if (last && history[1]) {
            const prevRefuel = history[1];
            const litros = parseFloat(last.litrosAbastecidos || 0);
            let diff = 0;

            const unit = getGroupUnit(selectedVehicle.tipo);
            if (getReadingSourceForUnit(unit) === 'horimetro') {
                const lastHr = parseFloat(last.horimetro || 0);
                const prevHr = parseFloat(prevRefuel.horimetro || 0);
                diff = lastHr - prevHr;
            } else {
                const lastKm = parseFloat(last.odometro || 0);
                const prevKm = parseFloat(prevRefuel.odometro || 0);
                diff = lastKm - prevKm;
            }

            const avg = computeConsumption(unit, diff, litros);
            if (avg != null) {
                setLastAverage(`${avg.toFixed(2)} ${unit}`);
            } else {
                setLastAverage('Incalculável');
            }
        } else {
            setLastAverage(null);
        }
    }, [selectedVehicle, obras, refuelings, isEditing, isSolicitacao, formData.employeeId, formData.obraId, formData.partnerId, formData.fuelType, formData.litrosLiberados]);

    useEffect(() => {
        setBlockReason(null);
        if (!selectedVehicle) return;

        const allowed = getAllowedReadingTypes(selectedVehicle.tipo);
        const isKm = allowed.includes('odometro');
        const isHr = allowed.includes('horimetro');

        let reason = null;

        if (isKm && formData.odometro) {
            const current = parseFloat(formData.odometro);
            const last = parseFloat(selectedVehicle.odometro || 0);

            if (!isNaN(current) && last > 0) {
                 const limiteKm = getGroupForType(selectedVehicle.tipo) === 'Caminhões de Trecho' ? 2000 : 1000;
                 if (current < last) reason = `Odômetro (${current}) menor que o atual (${last}).`;
                 else if (current - last > limiteKm) reason = `Salto excessivo de Km (> ${limiteKm}).`;
            }
        }

        if (isHr && formData.horimetro) {
            const current = parseFloat(formData.horimetro);
            let last = parseFloat(selectedVehicle.horimetro || 0);

            if (!isNaN(current) && last > 0) {
                if (current < last) reason = `Horímetro (${current}) menor que o atual (${last}).`;
                else if (current - last > 50) reason = `Salto excessivo (> 50h).`;
            }
        }

        if (reason) setBlockReason(reason);
    }, [formData.odometro, formData.horimetro, selectedVehicle]);

    // A trava orçamentária de 20% é aplicada no backend (createRefuelingOrder →
    // status 'BloqueadoOrcamento'), e as ordens bloqueadas são liberadas em
    // Administração > Frota > Abastecimento. Mantemos uma única trava (a do
    // servidor) para evitar divergência de cálculo entre frontend e backend.

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (name === 'isFillUp' && checked) setFormData(prev => ({ ...prev, litrosLiberados: '' }));
    };

    const handleSaveClick = (e) => {
        if(e) e.preventDefault();

        if (!formData.vehicleId || !formData.employeeId || !formData.partnerId || !formData.fuelType) {
            setAlertMessage("Preencha os campos obrigatórios.");
            return;
        }

        if (duplicateBlocked) {
            setAlertMessage(`Existe uma ordem em aberto (Nº ${openOrderForVehicle.authNumber || openOrderForVehicle.id}) para este veículo. Conclua ou cancele antes de emitir outra.`);
            return;
        }

        executeSave();
    };

    const executeSave = async () => {
        setIsSaving(true);

        const safeFloat = (val) => {
            if (val === null || val === undefined || val === '') return null;
            const num = parseFloat(val);
            return isNaN(num) ? null : num;
        };

        // Geração Segura: Removemos proativamente leituras indesejadas que possam estar sujas no formulário
        const allowed = selectedVehicle ? getAllowedReadingTypes(selectedVehicle.tipo) : [];
        const finalOdometro = allowed.includes('odometro') ? safeFloat(formData.odometro) : null;
        const finalHorimetro = allowed.includes('horimetro') ? safeFloat(formData.horimetro) : null;

        // Timestamp de emissão = data escolhida + horário REAL atual em BRT (GMT-3).
        // Antes usávamos 'T12:00:00Z' (meio-dia UTC), que ao converter para BRT
        // virava 09:00:00 — todas as ordens ficavam com o mesmo horário.
        const pad = n => String(n).padStart(2, '0');
        const nowBrt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const timeBrt = `${pad(nowBrt.getHours())}:${pad(nowBrt.getMinutes())}:${pad(nowBrt.getSeconds())}`;

        const payload = {
            ...formData,
            odometro: finalOdometro,
            horimetro: finalHorimetro,
            litrosLiberados: safeFloat(formData.litrosLiberados) || 0,
            litrosLiberadosArla: safeFloat(formData.litrosLiberadosArla) || 0,
            outrosValor: safeFloat(formData.outrosValor) || 0,
            date: `${formData.date}T${timeBrt}-03:00`,
            createdBy: user,
            solicitacaoId: solicitacaoData ? solicitacaoData.id : null
        };

        const currentStatus = orderToEdit?.status ? orderToEdit.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        
        if (isEditing && (currentStatus === 'concluida' || currentStatus === 'confirmada')) {
             payload.litrosAbastecidos = payload.litrosLiberados;
             payload.litrosAbastecidosArla = payload.litrosLiberadosArla;
        }

        const partner = partners.find(p => p.id === formData.partnerId);
        if (partner) payload.partnerName = partner.razaoSocial;

        try {
            let res;
            if (isEditing && orderToEdit.id) {
                res = await apiClient.updateRefuelingOrder(orderToEdit.id, payload);
                setAlertMessage(`Ordem atualizada!`);
            } else {
                res = await apiClient.createRefuelingOrder(payload);
                setAlertMessage(`Ordem Nº ${res.authNumber} emitida!`);
            }
            reloadData();
            
            if (res?.bloqueadoLeitura || res?.bloqueadoOrcamento) {
                setAlertMessage(res.message || `Ordem Nº ${res.authNumber} salva com bloqueio. Aguarde liberação do Administrador.`);
                reloadData();
                onClose();
                return;
            }
            // Defesa: frontend detectou violação mas backend não bloqueou (ex.: veículo sem leitura prévia)
            if (blockReason) {
                setAlertMessage(`Ordem salva com restrição. Aguarde avaliação do Administrador.`);
                reloadData();
                onClose();
                return;
            }
            onClose();
        } catch (error) {
            console.error(">>> [DEBUG] Erro ao salvar ordem:", error);
            setAlertMessage("Erro ao salvar: " + (error.response?.data?.error || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    const renderReadingInputs = () => {
        if (!selectedVehicle) return null;
        const allowed = getAllowedReadingTypes(selectedVehicle.tipo);

        if (allowed.includes('odometro')) {
            return (
                <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-700">Odômetro (Km) *</label>
                    <input type="number" name="odometro" value={formData.odometro} onChange={handleChange} className="w-full p-1 border rounded" required placeholder={`Atual: ${selectedVehicle.odometro}`}/>
                </div>
            );
        } else {
            return (
                <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-700">Horímetro (Hr) *</label>
                    <input type="number" name="horimetro" value={formData.horimetro} onChange={handleChange} className="w-full p-1 border rounded" required placeholder={`Atual: ${selectedVehicle.horimetro || 0}`}/>
                </div>
            );
        }
    };

    return (
        <div className="mak-modal-backdrop p-2 backdrop-blur-sm">
            <div className="mak-modal max-w-4xl">
                <div className="p-3 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        {isEditing ? <Edit size={16}/> : <FileText size={16}/>}
                        {isEditing ? 'Editar' : 'Emitir'} Ordem
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition"><X size={18}/></button>
                </div>

                <div className="px-4 pt-1 space-y-1 shrink-0">
                    {warnings.map((w, i) => (
                        <div key={i} className="flex items-center gap-2 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 text-[10px] font-medium"><Info size={12}/> {w}</div>
                    ))}
                    
                    {blockReason && (
                        <div className="flex items-center gap-2 p-1.5 bg-red-100 text-red-800 rounded border border-red-200 text-[10px] font-bold animate-pulse">
                            <Lock size={12}/> BLOQUEIO: {blockReason}
                        </div>
                    )}

                    {duplicateBlocked && (
                        <div className="neon-red-pulse flex items-start gap-2 p-2 rounded-md border-2 border-red-500 bg-red-50 text-red-800 text-[11px] font-bold leading-snug">
                            <Lock size={14} className="mt-0.5 flex-shrink-0 text-red-700"/>
                            <span>
                                🚫 ORDEM DUPLICADA: Já existe ordem em aberto Nº <u>{openOrderForVehicle.authNumber || openOrderForVehicle.id}</u> ({openOrderForVehicle.status}) para este veículo, emitida em {formatDateDisplay(openOrderForVehicle.date || openOrderForVehicle.data)}. Conclua ou cancele a ordem anterior antes de emitir outra.
                            </span>
                        </div>
                    )}

                    {openOrderForVehicle && isWeekendOrHoliday && !vehicleAllowsMultiple && (
                        <div className="flex items-start gap-2 p-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded text-[10px] font-bold leading-snug">
                            <Info size={12} className="mt-0.5 flex-shrink-0"/>
                            <span>
                                Exceção aplicada: já existe ordem aberta Nº {openOrderForVehicle.authNumber || openOrderForVehicle.id}, mas a nova é para <u>fim de semana/feriado</u> ({formatDateDisplay(formData.date)}) — antecipação permitida.
                            </span>
                        </div>
                    )}

                    {openOrderForVehicle && vehicleAllowsMultiple && (
                        <div className="flex items-start gap-2 p-1.5 bg-blue-50 border border-blue-300 text-blue-900 rounded text-[10px] font-bold leading-snug">
                            <Info size={12} className="mt-0.5 flex-shrink-0"/>
                            <span>
                                Veículo fictício liberado para múltiplos abastecimentos abertos (já existe ordem Nº {openOrderForVehicle.authNumber || openOrderForVehicle.id}). Regra de duplicidade não se aplica.
                            </span>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSaveClick} className="p-3 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                        <div>
                            <label className="block font-bold text-gray-700 mb-0.5">Veículo *</label>
                            <SearchableSelect
                                items={sortedVehicles}
                                value={formData.vehicleId}
                                onChange={(v) => setFormData(p => ({...p, vehicleId: v?.id || ''}))}
                                getLabel={(v) => `${v.registroInterno} - ${v.placa}`}
                                getSubLabel={(v) => v.tipo || ''}
                                getBadge={(v) => v.naoPodeCircular ? { text: 'Não circula', color: 'bg-red-100 text-red-700' } : v.status === 'manutencao' ? { text: 'Manutenção', color: 'bg-yellow-100 text-yellow-700' } : null}
                                placeholder="Buscar veículo..."
                                required
                            />
                        </div>
                        
                        {lastRefuelData && (
                            <div className="bg-gray-100 p-1.5 rounded border border-gray-200 text-[10px] text-gray-600 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-gray-700 mb-0.5 flex items-center gap-1"><Clock size={10}/> Último: {formatDateDisplay(lastRefuelData.data || lastRefuelData.date)}</div>
                                    <p>Posto: {lastRefuelData.partnerName || 'N/A'}</p>
                                    <p>Litros: <strong>{lastRefuelData.litrosAbastecidos} L</strong> ({lastRefuelData.fuelType})</p>
                                    
                                    <div className="mt-0.5 pt-0.5 border-t border-gray-300 flex gap-2">
                                        <p>Leitura: <strong>{lastRefuelData.horimetro || lastRefuelData.odometro || 'N/A'}</strong></p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-gray-700 mb-0.5 flex items-center justify-end gap-1"><Activity size={10}/> Média</div>
                                    <p className="text-xs font-bold text-blue-600">{lastAverage || '--'}</p>
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-50 p-2 rounded border border-gray-200">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-1">Leituras Atuais</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {renderReadingInputs()}
                            </div>
                        </div>

                        <div>
                            <label className="block font-bold text-gray-700 mb-0.5">Motorista *</label>
                            <SearchableSelect
                                items={sortedEmployees}
                                value={formData.employeeId}
                                onChange={(emp) => setFormData(prev => ({...prev, employeeId: emp?.id || ''}))}
                                getLabel={(emp) => emp.nome}
                                getSubLabel={(emp) => emp.funcao || ''}
                                placeholder="Buscar motorista..."
                                required
                            />
                        </div>

                         <div>
                            <label className="block font-bold text-gray-700 mb-0.5">Obra / Alocação *</label>
                            <SearchableObraSelect
                                obras={sortedObras}
                                value={formData.obraId}
                                onChange={(obra) => setFormData(prev => ({...prev, obraId: obra?.id || ''}))}
                                placeholder="Selecione..."
                                includeInactive={true}
                            />
                        </div>

                        {obraStatus && (
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[10px]">
                                <h4 className="font-bold text-blue-800 flex items-center gap-1 mb-1">
                                    <TrendingUp size={12}/> Progresso Financeiro
                                </h4>
                                <div className="flex justify-between text-blue-700">
                                    <span>Gasto Combustível:</span>
                                    <span>{obraStatus.totalGasto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                                </div>
                                <div className="flex justify-between text-blue-700">
                                    <span>Contrato Total:</span>
                                    <span>{obraStatus.valorContrato.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                                </div>
                                <div className="mt-1 w-full bg-blue-200 rounded-full h-1.5">
                                    <div 
                                        className={`h-1.5 rounded-full ${obraStatus.percentual > 80 ? 'bg-red-500' : 'bg-blue-600'}`} 
                                        style={{width: `${Math.min(obraStatus.percentual, 100)}%`}}
                                    ></div>
                                </div>
                                <div className="text-right mt-0.5 text-blue-600 font-bold">
                                    {obraStatus.percentual.toFixed(1)}% utilizado
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                        <div>
                            <label className="block font-bold text-gray-700 mb-0.5">Posto *</label>
                            <SearchableSelect
                                items={sortedPartners}
                                value={formData.partnerId}
                                onChange={(p) => setFormData(prev => ({...prev, partnerId: p?.id || ''}))}
                                getLabel={(p) => p.razaoSocial || p.nome || ''}
                                getSubLabel={(p) => [p.cidade, p.estado].filter(Boolean).join(' - ')}
                                placeholder="Buscar posto..."
                                required
                            />
                        </div>

                        <div className="bg-blue-50 p-2 rounded border border-blue-100">
                            <label className="block text-[10px] font-bold text-blue-900 mb-1">Combustível *</label>
                            <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full p-1 border border-blue-200 rounded mb-1 bg-white text-xs" required>
                                <option value="">Selecione...</option>
                                <option value="gasolinaComum">Gasolina Comum</option>
                                <option value="gasolinaAditivada">Gasolina Aditivada</option>
                                <option value="dieselS500">Diesel S500</option>
                                <option value="dieselS10">Diesel S10</option>
                                <option value="etanol">Etanol</option>
                            </select>
                            
                            <div className="flex items-center gap-1 mb-1">
                                <input type="checkbox" id="fill" name="isFillUp" checked={formData.isFillUp} onChange={handleChange} className="w-3 h-3 text-blue-600 rounded"/>
                                <label htmlFor="fill" className="text-[10px] font-medium text-blue-800">Completar Tanque</label>
                            </div>
                            {!formData.isFillUp && (
                                <input type="number" name="litrosLiberados" value={formData.litrosLiberados} onChange={handleChange} className="w-full p-1 border rounded" placeholder="Qtd. Litros"/>
                            )}

                            <div className="mt-1 pt-1 border-t border-blue-200">
                                <div className="flex items-center gap-1 mb-1">
                                    <input type="checkbox" id="arla" name="needsArla" checked={formData.needsArla} onChange={handleChange} className="w-3 h-3 text-blue-600 rounded"/>
                                    <label htmlFor="arla" className="text-[10px] font-bold text-blue-900">Arla 32</label>
                                </div>
                                {formData.needsArla && (
                                    <div className="pl-3 space-y-1">
                                        <div className="flex items-center gap-1">
                                            <input type="checkbox" name="isFillUpArla" checked={formData.isFillUpArla} onChange={handleChange} className="w-3 h-3"/>
                                            <label className="text-[10px]">Completar Arla</label>
                                        </div>
                                        {!formData.isFillUpArla && (
                                             <input type="number" name="litrosLiberadosArla" value={formData.litrosLiberadosArla} onChange={handleChange} className="w-full p-1 border rounded text-xs" placeholder="Litros Arla"/>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                         <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Data</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-1 border rounded"/>
                            </div>
                             <div>
                                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Outros</label>
                                <input type="text" name="outros" value={formData.outros} onChange={handleChange} className="w-full p-1 border rounded" placeholder="Obs..."/>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <input type="checkbox" id="geraValor" name="outrosGeraValor" checked={formData.outrosGeraValor} onChange={handleChange} className="w-3 h-3 text-green-600"/>
                            <label htmlFor="geraValor" className="text-[10px] font-medium text-gray-700">Preenchimento Gera Valor</label>
                        </div>

                        {blockReason && (
                            <div className="neon-red-pulse mt-2 p-2 rounded-md border-2 border-red-500 bg-red-50 text-red-800 text-[11px] font-bold leading-snug flex items-start gap-2">
                                <Lock size={14} className="mt-0.5 flex-shrink-0 text-red-700"/>
                                <span>
                                    ⚠️ ATENÇÃO: Ordem será salva com <u>bloqueio de leitura</u> e <u>NÃO será enviada ao posto</u> até liberação do administrador. Só prossiga se tiver certeza absoluta que deseja enviar esta ordem para análise do supervisor.
                                </span>
                            </div>
                        )}
                    </div>
                </form>

                <div className="p-2 border-t bg-gray-50 flex justify-between items-center rounded-b-xl shrink-0">
                    <div className="flex gap-2 ml-auto">
                        <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded transition">Cancelar</button>
                        <button
                            onClick={handleSaveClick}
                            disabled={isSaving || duplicateBlocked}
                            className={`px-3 py-1.5 font-bold text-xs rounded shadow transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ${duplicateBlocked ? 'bg-red-400 text-white' : blockReason ? 'bg-orange-400 text-white hover:bg-orange-500' : 'bg-yellow-400 text-gray-900 hover:bg-[#fdf8f0]0'}`}
                        >
                            {isSaving ? <Loader className="animate-spin" size={12}/> : duplicateBlocked ? (
                                <><Lock size={12}/> Ordem Duplicada</>
                            ) : (
                                <><Send size={12} /> {blockReason ? 'Salvar Bloqueado' : 'Salvar & Enviar'}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default RefuelingOrderModal;


