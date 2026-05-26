import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader, Info, Lock, FileText, Wallet, Edit, Clock, Activity, TrendingUp, Mail, Send } from 'lucide-react';

// Movido para dentro do arquivo para evitar erro de importação (Could not resolve)
const getAllowedReadingTypes = (tipo) => {
    if (!tipo) return [];
    const isLeveOrTrecho = [
        'Automóvel', 'Camionete', 'Utilitários', 'Moto', 
        'Caminhão Prancha', 'Semirreboques'
    ].includes(tipo);
    return isLeveOrTrecho ? ['odometro'] : ['horimetro'];
};

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
    const [budgetWarning, setBudgetWarning] = useState(null);
    const [requiresBudgetOverride, setRequiresBudgetOverride] = useState(false);
    
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordAction, setPasswordAction] = useState(null); 
    
    const [warnings, setWarnings] = useState([]); 
    const [lastRefuelData, setLastRefuelData] = useState(null);
    const [lastAverage, setLastAverage] = useState(null); 
    const [obraStatus, setObraStatus] = useState(null);

    const isEditing = !!orderToEdit && !!orderToEdit.id && orderToEdit.id !== 'PREVIEW';
    const isSolicitacao = !!solicitacaoData;

    useEffect(() => {
        if (formData.obraId && obras.length > 0) { 
            const obra = obras.find(o => o.id === formData.obraId);
            
            if (!obra || (extraObraOptions && extraObraOptions.includes(formData.obraId))) {
                setObraStatus(null);
                return;
            }

            const totalFuelExpenses = expenses
                .filter(e => e.obraId === formData.obraId && (e.category === 'Combustível' || e.fuelType))
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

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
    }, [formData.obraId, obras, expenses, extraObraOptions]);


    const sortedVehicles = useMemo(() => [...vehicles].sort((a,b) => (a.registroInterno || '').localeCompare(b.registroInterno || '')), [vehicles]);
    const sortedEmployees = useMemo(() => [...employees].sort((a,b) => (a.nome || '').localeCompare(b.nome || '')), [employees]);
    const sortedPartners = useMemo(() => [...partners].sort((a,b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || '')), [partners]);
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
            let unit = 'Km/L';

            const allowed = getAllowedReadingTypes(selectedVehicle.tipo);
            if (allowed.includes('horimetro')) {
                const lastHr = parseFloat(last.horimetro || 0); 
                const prevHr = parseFloat(prevRefuel.horimetro || 0);
                diff = lastHr - prevHr;
                unit = 'L/Hr';
            } else {
                const lastKm = parseFloat(last.odometro || 0);
                const prevKm = parseFloat(prevRefuel.odometro || 0);
                diff = lastKm - prevKm;
            }

            if (diff > 0 && litros > 0) {
                const avg = unit === 'Km/L' ? (diff / litros) : (litros / diff);
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
                 if (current < last) reason = `Odômetro (${current}) menor que o atual (${last}).`;
                 else if (current - last > 1000) reason = `Salto excessivo de Km (> 1000).`;
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

    useEffect(() => {
        if (formData.obraId && obras.length > 0) {
            const obra = obras.find(o => o.id === formData.obraId);
            if (!obra || extraObraOptions.includes(formData.obraId)) {
                setBudgetWarning(null);
                setRequiresBudgetOverride(false);
                return;
            }

            if (!obra.valorContrato || obra.valorContrato <= 0) {
                setBudgetWarning(null);
                setRequiresBudgetOverride(false);
                return;
            }

            const totalFuelExpenses = expenses
                .filter(e => e.obraId === formData.obraId && e.category === 'Combustível')
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

            const limit = obra.valorContrato * 0.20; 
            
            if (totalFuelExpenses >= limit) {
                setBudgetWarning(`Combustível atingiu 20% do contrato.`);
                setRequiresBudgetOverride(true);
            } else {
                setBudgetWarning(null);
                setRequiresBudgetOverride(false);
            }
        } else {
            setBudgetWarning(null);
            setRequiresBudgetOverride(false);
        }
    }, [formData.obraId, obras, expenses, extraObraOptions]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (name === 'isFillUp' && checked) setFormData(prev => ({ ...prev, litrosLiberados: '' }));
    };

    const processDistribution = async (orderData) => {
        const vehicle = vehicles.find(v => v.id === formData.vehicleId);
        const partner = partners.find(p => p.id === formData.partnerId);
        const employee = employees.find(e => e.id === formData.employeeId);
        
        const finalData = orderData || {
            ...formData,
            id: orderToEdit?.id || 'PREVIEW',
            authNumber: orderToEdit?.authNumber || 'NOVA',
            partnerName: partner?.razaoSocial,
            vehicleInfo: `${vehicle?.modelo || ''} - ${vehicle?.placa || ''}`
        };

        const partnerEmail = partner?.email;
        const hasEmail = partnerEmail && partnerEmail.includes('@');

        if (!onGeneratePDF) return;

        try {
            const pdfBlob = await onGeneratePDF(finalData, vehicles, partners, employees, vehicleGroups, true);
            
            const emissionDateStr = getSafeDateObj(finalData.date).toLocaleDateString('pt-BR');
            const safeDate = emissionDateStr.replace(/\//g, '-');
            const reCode = vehicle?.registroInterno || 'SN';
            const pdfFileName = `Autorizacao_${finalData.authNumber}_${reCode}_${safeDate}.pdf`;

            const formDataUpload = new FormData();
            formDataUpload.append('file', pdfBlob, pdfFileName);

            const getToken = () => {
                const t = localStorage.getItem('token') || localStorage.getItem('authToken');
                if (t) return t;
                const u = localStorage.getItem('user');
                if (u) try { return JSON.parse(u).token; } catch {}
                return '';
            };
            
            let baseUrl = '';
            if (apiClient.defaults.baseURL) {
                baseUrl = apiClient.defaults.baseURL.replace(/\/$/, '');
            } else if (process.env.REACT_APP_API_URL) {
                baseUrl = process.env.REACT_APP_API_URL;
            }

            const uploadUrl = `${baseUrl}/refuelings/upload-pdf`;
            
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formDataUpload
            });

            if (!response.ok) throw new Error("Falha no upload do PDF");
            
            const uploadResult = await response.json();
            const pdfUrl = uploadResult.url;
            
            let absoluteLink = pdfUrl;
            if (pdfUrl && !pdfUrl.startsWith('http')) {
                let urlDomain = window.location.origin;
                if (baseUrl.startsWith('http')) {
                    urlDomain = baseUrl;
                }
                absoluteLink = `${urlDomain.replace('/api', '')}${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`;
            }

            if (hasEmail) {
                setAlertMessage(`Abrindo E-mail para ${partnerEmail}...`);
                
                const emissionDate = getSafeDateObj(finalData.date).toLocaleDateString('pt-BR');
                const arlaMsg = formData.needsArla ? `\nArla 32: ${formData.isFillUpArla ? 'COMPLETAR' : formData.litrosLiberadosArla + ' Litros'}` : '';
                const outrosMsgEmail = finalData.outros ? `\nOutros/Obs: ${finalData.outros}` : '';

                const subject = `Autorização de Abastecimento #${finalData.authNumber} - ${vehicle?.registroInterno} - ${finalData.partnerName || 'Frotas MAK'}`;
                const body = `Olá,

Segue a autorização de abastecimento emitida pelo sistema Frotas MAK.

--- RESUMO ---

Nº Ordem: ${finalData.authNumber}
Data: ${emissionDate}
Posto: ${partner?.razaoSocial || 'N/A'}
Veículo: ${vehicle?.marca || ''} ${vehicle?.modelo || ''} - ${vehicle?.placa} / ${vehicle?.registroInterno}
Combustível: ${finalData.fuelType}
Qtd: ${formData.isFillUp ? 'COMPLETAR TANQUE' : formData.litrosLiberados + ' Litros'}${arlaMsg}${outrosMsgEmail}
Motorista: ${employee?.nome || 'N/A'}

--- DOWNLOAD DA AUTORIZAÇÃO (PDF) ---
Clique no link abaixo para baixar o documento oficial:
${absoluteLink}

A presente ordem de abastecimento é válida exclusivamente para a placa/RE indicada e para o tipo de combustível previamente autorizado.
Estão autorizados somente os itens discriminados na ordem de abastecimento. Qualquer divergência deve ser comunicada imediatamente à administração de Frotas MAK.

Att,
Equipe Frotas MAK`;

                window.location.href = `mailto:${partnerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                return; 
            } else {
                 setAlertMessage("Posto sem e-mail. Abrindo WhatsApp...");
            }

            triggerWhatsApp(finalData, partner, vehicle, employee, absoluteLink);

        } catch (err) {
            console.error(">>> [DEBUG] Erro na Distribuição:", err);
            setAlertMessage("Erro ao processar envio. PDF gerado localmente.");
            onGeneratePDF(finalData, vehicles, partners, employees, vehicleGroups, false);
        }
    };

    const triggerWhatsApp = (finalData, partner, vehicle, employee, pdfLink) => {
        const phone = partner?.whatsapp || partner?.telefone;
        if (!phone) {
            setAlertMessage("Ordem salva! Posto sem WhatsApp/Email.");
            return;
        }

        const allowedReadings = vehicle ? getAllowedReadingTypes(vehicle.tipo) : [];
        let readingMsg = '';
        const fOdo = parseFloat(finalData.odometro);
        const fHori = parseFloat(finalData.horimetro);
        
        if (allowedReadings.includes('odometro') && fOdo > 0) {
             readingMsg = `*Hodômetro:* ${fOdo} Km`;
        } else if (allowedReadings.includes('horimetro') && fHori > 0) {
             readingMsg = `*Horímetro:* ${fHori} Hr`;
        } else if (fOdo > 0) {
             readingMsg = `*Hodômetro:* ${fOdo} Km`;
        } else if (fHori > 0) {
             readingMsg = `*Horímetro:* ${fHori} Hr`;
        } else {
             readingMsg = `*Leitura:* N/A`;
        }
        
        const emissionDate = getSafeDateObj(finalData.date).toLocaleDateString('pt-BR');
        const arlaMsg = formData.needsArla 
            ? `\n*Arla 32:* ${formData.isFillUpArla ? 'COMPLETAR' : formData.litrosLiberadosArla + ' Litros'}` 
            : '';
        const outrosMsg = finalData.outros ? `\n*Outros/Obs:* ${finalData.outros}` : '';

        let msg = 
`*ORDEM DE ABASTECIMENTO - FROTAS MAK*
${pdfLink ? `Baixe a Autorização (PDF): ${pdfLink}` : '(PDF indisponível)'}

*Resumo:*
*Nº Ordem:* ${finalData.authNumber}
*Data:* ${emissionDate}
*Posto:* ${partner?.razaoSocial || 'N/A'}
*Veículo:* ${vehicle?.marca || ''} ${vehicle?.modelo || ''} - ${vehicle?.placa} / ${vehicle?.registroInterno}
*Combustível:* ${finalData.fuelType}
*Qtd:* ${formData.isFillUp ? 'COMPLETAR TANQUE' : formData.litrosLiberados + ' Litros'}${arlaMsg}${outrosMsg}
*Motorista:* ${employee?.nome || 'N/A'}
${readingMsg}`;

        setTimeout(() => {
            window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        }, 500);
    };

    const handleSaveClick = (e) => {
        if(e) e.preventDefault();

        if (!formData.vehicleId || !formData.employeeId || !formData.partnerId || !formData.fuelType) {
            setAlertMessage("Preencha os campos obrigatórios.");
            return;
        }

        if (blockReason) {
            setPasswordAction('blockOverride');
            setShowPasswordModal(true);
            return;
        }
        if (requiresBudgetOverride) {
            setPasswordAction('budgetOverride');
            setShowPasswordModal(true);
            return;
        }
        executeSave();
    };

    const executeSave = async () => {
        setIsSaving(true);
        setShowPasswordModal(false);

        const safeFloat = (val) => {
            if (val === null || val === undefined || val === '') return null;
            const num = parseFloat(val);
            return isNaN(num) ? null : num;
        };

        // Geração Segura: Removemos proativamente leituras indesejadas que possam estar sujas no formulário
        const allowed = selectedVehicle ? getAllowedReadingTypes(selectedVehicle.tipo) : [];
        const finalOdometro = allowed.includes('odometro') ? safeFloat(formData.odometro) : null;
        const finalHorimetro = allowed.includes('horimetro') ? safeFloat(formData.horimetro) : null;

        const payload = {
            ...formData,
            odometro: finalOdometro,
            horimetro: finalHorimetro,
            litrosLiberados: safeFloat(formData.litrosLiberados) || 0,
            litrosLiberadosArla: safeFloat(formData.litrosLiberadosArla) || 0,
            outrosValor: safeFloat(formData.outrosValor) || 0,
            date: new Date(formData.date + 'T12:00:00Z').toISOString(),
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
            
            if (res) {
                 const fullOrderData = {
                    ...payload,
                    id: res.id || orderToEdit?.id,
                    authNumber: res.authNumber || orderToEdit?.authNumber,
                    createdBy: user 
                 };
                 await processDistribution(fullOrderData);
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[98vh] flex flex-col overflow-hidden">
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

                    {budgetWarning && (
                        <div className="flex items-center gap-2 p-1.5 bg-orange-100 text-orange-900 rounded border border-orange-200 text-[10px] font-bold">
                            <Wallet size={12}/> {budgetWarning} {requiresBudgetOverride && "(Requer Senha)"}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSaveClick} className="p-3 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                        <div>
                            <label className="block font-bold text-gray-700 mb-0.5">Veículo *</label>
                            <select name="vehicleId" value={formData.vehicleId} onChange={e => setFormData(p => ({...p, vehicleId: e.target.value}))} className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-yellow-400 outline-none" required>
                                <option value="">Selecione...</option>
                                {sortedVehicles.map(v => <option key={v.id} value={v.id}>{v.registroInterno} - {v.placa} ({v.tipo})</option>)}
                            </select>
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
                            <select name="employeeId" value={formData.employeeId} onChange={handleChange} className="w-full p-1 border border-gray-300 rounded" required>
                                <option value="">Selecione...</option>
                                {sortedEmployees.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </select>
                        </div>

                         <div>
                            <label className="block font-bold text-gray-700 mb-0.5">Obra / Alocação *</label>
                            <select name="obraId" value={formData.obraId} onChange={handleChange} className="w-full p-1 border border-gray-300 rounded" required>
                                <option value="">Selecione...</option>
                                <option value="Patio">Pátio</option>
                                {sortedObras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                {extraObraOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
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
                            <select name="partnerId" value={formData.partnerId} onChange={handleChange} className="w-full p-1 border border-gray-300 rounded" required>
                                <option value="">Selecione...</option>
                                {sortedPartners.map(p => <option key={p.id} value={p.id}>{p.razaoSocial}</option>)}
                            </select>
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
                    </div>
                </form>

                <div className="p-2 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl shrink-0">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded transition">Cancelar</button>
                    {blockReason || requiresBudgetOverride ? (
                        <button onClick={handleSaveClick} className="px-3 py-1.5 bg-red-500 text-white font-bold text-xs rounded shadow hover:bg-red-600 transition flex items-center gap-1">
                            <Lock size={12}/> Liberar
                        </button>
                    ) : (
                        <button onClick={handleSaveClick} disabled={isSaving} className="px-3 py-1.5 bg-yellow-400 text-gray-900 font-bold text-xs rounded shadow hover:bg-yellow-500 transition disabled:opacity-50 flex items-center gap-1">
                            {isSaving ? <Loader className="animate-spin" size={12}/> : (
                                <><Send size={12} /> Salvar & Enviar</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {showPasswordModal && (
                <PasswordConfirmationModal
                    message={passwordAction === 'blockOverride' ? `BLOQUEIO: ${blockReason}` : `BLOQUEIO FINANCEIRO: Orçamento excedido.`}
                    onConfirm={executeSave}
                    onClose={() => setShowPasswordModal(false)}
                    apiClient={apiClient}
                />
            )}
        </div>
    );
};

export default RefuelingOrderModal;