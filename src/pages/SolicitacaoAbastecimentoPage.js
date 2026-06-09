import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Camera, MapPin, Send, AlertTriangle, CheckCircle, Clock, 
    XCircle, ChevronRight, Fuel, Image as ImageIcon, Loader, 
    WifiOff, RefreshCw, Lock, LogOut, User, FileText, Droplet, 
    CalendarClock, Gauge, Calendar, AlertOctagon, Trash2, X
} from 'lucide-react';

import ChangePasswordModal from '../components/ChangePasswordModal';
import SearchableSelect from '../components/SearchableSelect';

// --- INÍCIO DA LÓGICA DE REGRAS ---
const vehicleGroups = {
    'Veículos Leves': ['Automóvel', 'Camionete', 'Utilitários', 'Moto'],
    'Caminhões': ['Bitruck', 'Caminhão Pipa', 'Caminhão Tanque', 'Caminhão Carroceria', 'Cavalo', 'Caçamba Bitruck', 'Caçamba Toco', 'Caçamba Traçado', 'Caçamba Truckado', 'Caminhão', 'Caçamba'],
    'Caminhões de Trecho': ['Caminhão Prancha', 'Semirreboques'], 
    'Máquinas Pesadas': ['Motoniveladora', 'Pá Carregadeira', 'Retroescavadeira', 'Rolo', 'Trator', 'Escavadeira', 'Fresadora', 'Trator Esteira']
};

const GRUPOS_ARLA = [
    'BITRUCK', 'CAMINHÃO', 'CAMINHÃO CARROCERIA', 'CAMINHÃO PIPA', 
    'CAMINHÃO PRANCHA', 'CAMINHÃO TANQUE', 'CAVALO', 'CAÇAMBA', 
    'CAÇAMBA BITRUCK', 'CAÇAMBA TOCO', 'CAÇAMBA TRUCKADO', 'CAÇAMBA TRAÇADO'
];

const getAllowedReadingTypes = (vehicleType) => {
    const group = Object.keys(vehicleGroups).find(key => vehicleGroups[key].includes(vehicleType));
    if (group === 'Veículos Leves' || group === 'Caminhões de Trecho') {
        return ['odometro'];
    }
    return ['horimetro']; 
};

// Retorna 'odometro' ou 'horimetro' string para uso no formulário
const getFormReadingType = (vehicle) => {
    if (!vehicle || !vehicle.tipo) return 'horimetro';
    const allowed = getAllowedReadingTypes(vehicle.tipo);
    return allowed.includes('odometro') ? 'odometro' : 'horimetro';
};

const needsArla = (vehicle) => {
    if (!vehicle) return false;
    const tipo = (vehicle.tipo || '').toUpperCase();
    const modelo = (vehicle.modelo || '').toUpperCase();
    return GRUPOS_ARLA.some(t => tipo === t || modelo.includes(t) || tipo.includes(t));
};

const checkVehicleRestrictions = (vehicle) => {
    const issues = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!vehicle) return issues;

    // 1. Manutenção por Data
    if (vehicle.proximaRevisaoData) {
        const revDate = new Date(vehicle.proximaRevisaoData);
        const revDateCompare = new Date(revDate.getFullYear(), revDate.getMonth(), revDate.getDate());
        const diffTime = revDateCompare - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (revDateCompare < today) {
            issues.push({ category: 'manutencao', type: 'error', message: `MANUTENÇÃO VENCIDA (Data): ${revDate.toLocaleDateString()}.` });
        } else if (diffDays <= 7) { 
            issues.push({ category: 'manutencao', type: 'warning', message: `Manutenção agendada para ${revDate.toLocaleDateString()} (em ${diffDays} dias).` });
        }
    }

    // 2. Manutenção por Leitura
    const formType = getFormReadingType(vehicle);
    const isKm = formType === 'odometro';
    
    // Pega o valor atual correto baseado no tipo
    const currentReading = isKm 
        ? parseFloat(vehicle.odometro || 0) 
        : parseFloat(vehicle.horimetro || 0);

    // Pega a meta correta
    let proximaLeitura = 0;
    if (isKm) {
        proximaLeitura = parseFloat(vehicle.proximaRevisaoKm || 0);
    } else {
        proximaLeitura = parseFloat(vehicle.proximaRevisaoHoras || 0);
    }

    if (proximaLeitura > 0) {
        const avisoAntecedencia = isKm ? 500 : 20; 

        if (currentReading >= proximaLeitura) {
            const unit = isKm ? 'Km' : 'h';
            issues.push({ category: 'manutencao', type: 'error', message: `MANUTENÇÃO VENCIDA (Leitura): ${currentReading}/${proximaLeitura} ${unit}.` });
        } else if ((proximaLeitura - currentReading) <= avisoAntecedencia) {
            const faltam = (proximaLeitura - currentReading).toFixed(1);
            const unit = isKm ? 'Km' : 'h';
            issues.push({ category: 'manutencao', type: 'warning', message: `Manutenção PRÓXIMA: Faltam ${faltam} ${unit}.` });
        }
    }

    // 3. Documentos
    const isTruck = vehicleGroups['Caminhões']?.includes(vehicle.tipo) || vehicleGroups['Caminhões de Trecho']?.includes(vehicle.tipo);
    
    const docs = [
        { key: 'validadeLicenciamento', label: 'Licenciamento', checkAlways: true },
    ];
    
    if (isTruck) {
        docs.push(
            { key: 'validadeTacografo', label: 'Tacógrafo' },
            { key: 'validadeAET_DAER', label: 'AET DAER' },
            { key: 'validadeAET_DNIT', label: 'AET DNIT' }
        );
    }

    docs.forEach(doc => {
        if (vehicle[doc.key]) {
            const docDate = new Date(vehicle[doc.key]);
            const docDateCompare = new Date(docDate.getFullYear(), docDate.getMonth(), docDate.getDate());
            const diffTime = docDateCompare - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (docDateCompare < today) {
                issues.push({ category: 'documento', type: 'error', message: `${doc.label} VENCIDO em ${docDate.toLocaleDateString()}.` });
            } else if (diffDays <= 15) { 
                issues.push({ category: 'documento', type: 'warning', message: `${doc.label} vence em ${diffDays} dias.` });
            }
        }
    });

    // 4. Status de Bloqueio Manual
    if (vehicle.status === 'MANUTENCAO' || vehicle.status === 'QUEBRADO') {
        issues.push({ category: 'status', type: 'block', message: `Veículo marcado como ${vehicle.status}.` });
    }

    return issues;
};
// --- FIM DA LÓGICA DE REGRAS ---

const SolicitacaoAbastecimentoPage = ({
    apiClient,
    vehicles = [],
    obras = [],
    partners = [],
    employees = [],
    setAlertMessage,
    user,
    onLogout,
    socket,
    onVoltar,
}) => {
    
    // --- ESTADOS DE CONTROLE ---
    const [view, setView] = useState('list'); 
    const [loading, setLoading] = useState(false);
    const [userStatus, setUserStatus] = useState({ blocked: false, attempts: 0 });
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [gpsError, setGpsError] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    
    const [errorPopup, setErrorPopup] = useState({ open: false, title: '', messages: [] });
    const [internalEmployees, setInternalEmployees] = useState([]);
    // Campo que falhou na última tentativa de envio — destaca visualmente o input ofensor
    const [errorField, setErrorField] = useState(null);
    
    // --- DADOS ---
    const [myRequests, setMyRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [syncTrigger, setSyncTrigger] = useState(0); 
    
    // --- FORMULÁRIO ---
    const [formData, setFormData] = useState({
        veiculoId: '',
        obraId: '',
        postoId: '',
        funcionarioId: '', 
        tipoCombustivel: '',
        litragem: '',
        flagTanqueCheio: false,
        flagOutros: false,
        descricaoOutros: '', 
        observacao: '', 
        
        needsArla: false,
        litragemArla: '',
        flagTanqueCheioArla: false,

        horimetro: '',
        odometro: '',
        latitude: null,
        longitude: null,
        dataAbastecimento: ''
    });
    
    const [previewImage, setPreviewImage] = useState(null);
    const [rawImageFile, setRawImageFile] = useState(null);
    const [cupomFile, setCupomFile] = useState(null);
    const [cupomPreview, setCupomPreview] = useState(null);

    // Refs
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const cameraCupomRef = useRef(null);
    const galleryCupomRef = useRef(null);

    const effectiveEmployees = employees.length > 0 ? employees : internalEmployees;

    const normalizeStr = (str) => {
        if (!str) return '';
        return str.toString()
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
            .replace(/\s+/g, ' ') 
            .trim();
    };

    // --- CARREGAMENTO DE DADOS (COM CACHE BUSTING AGRESSIVO) ---
    const fetchMyRequests = async () => {
        try {
            // ?_t= forca o navegador a nao usar cache da requisição (Problema comum em mobile)
            const res = await apiClient.get(`/solicitacoes?_t=${new Date().getTime()}`);
            setMyRequests(Array.isArray(res) ? res : []);
        } catch (error) {
            console.error("Erro ao buscar solicitações", error);
        }
    };

    // --- ESTRATÉGIA TRIPLA DE ATUALIZAÇÃO: SOCKET + POLLING + VISIBILITY ---
    useEffect(() => {
        if (!user) return;

        // 1. Busca Inicial
        checkUserStatus();
        fetchMyRequests();

        // 2. Polling Silencioso de Backup (A cada 15s)
        // Isso resolve quando o celular bloqueia a tela e derruba o Socket.io
        const intervalId = setInterval(() => {
            fetchMyRequests();
        }, 15000);

        // 3. Listener de Foco da Página (Visibility API)
        // Assim que o motorista voltar pro app, recarrega a lista
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log("⚡ [Motorista App] App voltou ao foco. Atualizando dados...");
                fetchMyRequests();
                checkUserStatus();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, syncTrigger]); 

    // --- LÓGICA DE SOCKET.IO ---
    useEffect(() => {
        if (!socket) return;

        const handleSync = (data) => {
            console.log("⚡ [Motorista App] Sinal Socket recebido!", data);
            setTimeout(() => setSyncTrigger(prev => prev + 1), 500);
        };

        socket.on('server:sync', handleSync);
        socket.on('admin:notificacao', handleSync); 

        return () => {
            socket.off('server:sync', handleSync);
            socket.off('admin:notificacao', handleSync);
        };
    }, [socket]);

    // --- ATUALIZAÇÃO AUTOMÁTICA DO MODAL ABERTO ---
    useEffect(() => {
        if (selectedRequest && myRequests.length > 0) {
            const updatedReq = myRequests.find(r => r.id === selectedRequest.id);
            // Deep check stringify garante que QUALQUER alteração no item forçará a tela a re-renderizar
            if (updatedReq && JSON.stringify(updatedReq) !== JSON.stringify(selectedRequest)) {
                setSelectedRequest(updatedReq);
            }
        }
    }, [myRequests, selectedRequest]);

    // --- LÓGICA DE IDENTIFICAÇÃO DO FUNCIONÁRIO ---
    const myEmployeeId = useMemo(() => {
        if (!user) return null;
        if (user.employeeId) return user.employeeId;
        if (user.employee_id) return user.employee_id;

        const normalizedUserName = normalizeStr(user.name);
        const normalizedUserEmail = normalizeStr(user.email);

        if (effectiveEmployees.length > 0) {
            if (normalizedUserEmail) {
                const found = effectiveEmployees.find(e => normalizeStr(e.email) === normalizedUserEmail);
                if (found) return found.id;
            }
            if (normalizedUserName) {
                const found = effectiveEmployees.find(e => normalizeStr(e.nome) === normalizedUserName);
                if (found) return found.id;
            }
        }

        if (obras.length > 0 && normalizedUserName) {
            for (const obra of obras) {
                if (obra.historicoVeiculos && Array.isArray(obra.historicoVeiculos)) {
                    const match = obra.historicoVeiculos.find(h => 
                        !h.dataSaida && 
                        (normalizeStr(h.employeeName || h.nome_funcionario) === normalizedUserName)
                    );
                    if (match && match.employeeId) return match.employeeId;
                }
            }
        }
        return null;
    }, [user, effectiveEmployees, obras]);

    // --- LÓGICA DE FILTRAGEM ---
    const allowedObras = useMemo(() => {
        if (!myEmployeeId || !obras.length) return [];
        return obras.filter(obra => {
            if (!obra.historicoVeiculos || !Array.isArray(obra.historicoVeiculos)) return false;
            return obra.historicoVeiculos.some(h => 
                String(h.employeeId) === String(myEmployeeId) && !h.dataSaida
            );
        });
    }, [myEmployeeId, obras]);

    // --- FILTRO VISUALIZAÇÃO: OBRAS + 12 HORAS ---
    const visibleRequests = useMemo(() => {
        if (!myRequests.length) return [];
        if (!allowedObras.length) return [];

        const myObraIds = new Set(allowedObras.map(o => String(o.id)));
        const now = new Date().getTime();
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;

        return myRequests.filter(req => {
            if (!myObraIds.has(String(req.obra_id))) return false;

            const statusUpper = (req.status || '').toUpperCase();
            const statusesToTimeFilter = ['CONCLUIDA', 'BAIXADA', 'NEGADO', 'CONCLUIDO', 'CANCELADA'];

            if (statusesToTimeFilter.includes(statusUpper)) {
                const dataRefStr = req.updated_at || req.data_baixa || req.data_aprovacao || req.data_solicitacao;
                const dataRef = new Date(dataRefStr).getTime();
                
                if (!isNaN(dataRef)) {
                    if ((now - dataRef) > TWELVE_HOURS) {
                        return false; 
                    }
                }
            }

            return true;
        });
    }, [myRequests, allowedObras]);

    const { filteredVehicles, filteredEmployees } = useMemo(() => {
        if (!formData.obraId) return { filteredVehicles: [], filteredEmployees: [] };

        const selectedObra = obras.find(o => String(o.id) === String(formData.obraId));
        if (!selectedObra || !selectedObra.historicoVeiculos) return { filteredVehicles: [], filteredEmployees: [] };

        const activeVehiclesIds = new Set();
        const activeEmployeesIds = new Set();

        selectedObra.historicoVeiculos.forEach(h => {
            if (!h.dataSaida) { 
                if (h.veiculoId) activeVehiclesIds.add(String(h.veiculoId));
                if (h.employeeId) activeEmployeesIds.add(String(h.employeeId));
            }
        });

        const veiculosDaObra = vehicles
            .filter(v => activeVehiclesIds.has(String(v.id)))
            .sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || ''));

        let funcionariosDaObra = [];
        if (effectiveEmployees.length > 0) {
            funcionariosDaObra = effectiveEmployees
                .filter(e => activeEmployeesIds.has(String(e.id)))
                .map(e => ({ id: e.id, nome: e.nome }));
        }

        if (funcionariosDaObra.length < activeEmployeesIds.size) {
            const existingIds = new Set(funcionariosDaObra.map(f => String(f.id)));
            selectedObra.historicoVeiculos.forEach(h => {
                const empId = String(h.employeeId);
                const empName = h.employeeName || h.nome_funcionario;
                if (!h.dataSaida && empId && !existingIds.has(empId) && empId !== 'null' && empId !== 'undefined') {
                    funcionariosDaObra.push({ id: empId, nome: empName || 'Funcionário (Sem Nome)' });
                    existingIds.add(empId);
                }
            });
        }
        funcionariosDaObra.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        return { filteredVehicles: veiculosDaObra, filteredEmployees: funcionariosDaObra };
    }, [formData.obraId, obras, vehicles, effectiveEmployees]);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        getLocation();
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (allowedObras.length === 1 && !formData.obraId) {
            setFormData(prev => ({ ...prev, obraId: allowedObras[0].id }));
        }
    }, [allowedObras]);

    useEffect(() => {
        if (myEmployeeId && formData.obraId && !formData.funcionarioId) {
            const myself = filteredEmployees.some(e => String(e.id) === String(myEmployeeId));
            if (myself || filteredEmployees.length === 0) {
                setFormData(prev => ({ ...prev, funcionarioId: myEmployeeId }));
            }
        }
    }, [myEmployeeId, filteredEmployees, formData.obraId]);

    const veiculoSelecionado = useMemo(() => {
        return vehicles.find(v => String(v.id) === String(formData.veiculoId));
    }, [formData.veiculoId, vehicles]);

    // --- SISTEMA DE REGRAS E ALERTAS ---
    const vehicleAlerts = useMemo(() => {
        if (!veiculoSelecionado) return [];
        const alerts = checkVehicleRestrictions(veiculoSelecionado);
        
        if (veiculoSelecionado.ultimaDataAbastecimento) {
            const diffHours = (new Date() - new Date(veiculoSelecionado.ultimaDataAbastecimento)) / (1000 * 60 * 60);
            if (diffHours < 24) {
                alerts.push({ category: 'consumo', type: 'warning', message: `ALERTA: Abastecido há menos de 24h (${Math.round(diffHours)}h atrás).` });
            }
        }

        const openRequest = myRequests.find(r => 
            String(r.veiculo_id) === String(veiculoSelecionado.id) && 
            (r.status === 'PENDENTE' || r.status === 'LIBERADO' || r.status === 'AGUARDANDO_BAIXA')
        );

        if (openRequest) {
            alerts.push({ category: 'duplicidade', type: 'block', message: `BLOQUEADO: Existe uma solicitação pendente (#${openRequest.id}).` });
        }
        return alerts;
    }, [veiculoSelecionado, myRequests]);

    const hasBlockingAlert = useMemo(() => {
        return vehicleAlerts.some(a => a.type === 'block' || a.category === 'status');
    }, [vehicleAlerts]);

    const initializedVehicleRef = useRef(null);

    // CORREÇÃO CRÍTICA: Removido `myRequests` da lista de dependências!
    // Isso garante que se houver atualização em segundo plano pelo Socket,
    // o formulário NÃO vai reprocessar e apagar a quilometragem que o motorista estava digitando.
    useEffect(() => {
        if (veiculoSelecionado) {
            // Só reseta os campos se for um veículo diferente do que já estávamos editando
            if (initializedVehicleRef.current !== veiculoSelecionado.id) {
                initializedVehicleRef.current = veiculoSelecionado.id;

                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                const defaultDate = now.toISOString().slice(0, 10);

                setFormData(prev => ({ 
                    ...prev, 
                    odometro: '', 
                    horimetro: '',
                    dataAbastecimento: defaultDate 
                }));
                
                let lastPartnerId = null;
                const lastReq = myRequests.find(r => 
                    String(r.veiculo_id) === String(veiculoSelecionado.id) && 
                    (r.status === 'CONCLUIDO' || r.status === 'LIBERADO')
                );
                if (lastReq && lastReq.posto_id) {
                    lastPartnerId = lastReq.posto_id;
                } else {
                    lastPartnerId = veiculoSelecionado.lastPartnerId;
                }
                if (lastPartnerId) {
                    setFormData(prev => ({ ...prev, postoId: lastPartnerId }));
                }
            }
        } else {
            initializedVehicleRef.current = null;
        }
    }, [veiculoSelecionado]); // <-- myRequests Removido daqui

    const readingType = useMemo(() => getFormReadingType(veiculoSelecionado), [veiculoSelecionado]);
    const showArlaSection = useMemo(() => needsArla(veiculoSelecionado), [veiculoSelecionado]);
    
    // --- API & HELPERS ---

    const checkUserStatus = async () => {
        try {
            const res = await apiClient.get(`/solicitacoes/meus-status?_t=${Date.now()}`); 
            setUserStatus({
                blocked: res.bloqueado_abastecimento === 1,
                attempts: res.tentativas_falhas_abastecimento
            });
        } catch (error) {
            if (user?.bloqueado_abastecimento) {
                setUserStatus({ blocked: true, attempts: user.tentativas_falhas_abastecimento || 0 });
            }
        }
    };

    const getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGpsError(false);
                    setFormData(prev => ({
                        ...prev,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    }));
                },
                (error) => {
                    console.log("GPS erro:", error.message);
                    setGpsError(true);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        } else {
            setGpsError(true);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        if (onLogout) {
            onLogout();
        } else {
            window.location.href = '/'; 
        }
    };

    const handleImageCompress = (file, callback) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1280;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    callback(compressedFile, URL.createObjectURL(compressedFile));
                }, 'image/jpeg', 0.7);
            };
        };
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        handleImageCompress(file, (compressedFile, previewUrl) => {
            if (type === 'painel') {
                setRawImageFile(compressedFile);
                setPreviewImage(previewUrl);
            } else if (type === 'cupom') {
                setCupomFile(compressedFile);
                setCupomPreview(previewUrl);
            }
            setLoading(false);
        });
    };

    const showError = (title, messages) => {
        setErrorPopup({
            open: true,
            title: title,
            messages: Array.isArray(messages) ? messages : [messages]
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (hasBlockingAlert) {
            showError("VEÍCULO BLOQUEADO", "Existem pendências bloqueantes neste veículo (veja os alertas).");
            return;
        }

        const errors = [];

        // Validação de Campos Obrigatórios
        if (!formData.veiculoId) errors.push("Selecione um Veículo.");
        if (!formData.obraId) errors.push("Selecione a Obra.");
        if (!formData.postoId) errors.push("Selecione o Posto.");
        if (!formData.tipoCombustivel) errors.push("Selecione o Tipo de Combustível.");
        if (!formData.funcionarioId) errors.push("Selecione o Condutor/Responsável.");
        if (!formData.dataAbastecimento) errors.push("Informe a Data do Abastecimento.");
        if (!rawImageFile) errors.push("A foto do painel/evidência é obrigatória.");

        // Validação da Leitura
        if (readingType === 'odometro') {
            if (!formData.odometro) errors.push("É obrigatório informar o HODÔMETRO (Km).");
            if (veiculoSelecionado && veiculoSelecionado.odometro) {
                const currentKm = parseFloat(veiculoSelecionado.odometro);
                const inputKm = parseFloat(formData.odometro);
                if (inputKm <= currentKm) {
                    errors.push(`Odômetro inválido: O valor informado (${inputKm} Km) deve ser maior que o atual (${currentKm} Km).`);
                }
            }
        } 
        if (readingType === 'horimetro') {
            if (!formData.horimetro) errors.push("É obrigatório informar o HORÍMETRO (Hr).");
            if (veiculoSelecionado) {
                const currentHr = parseFloat(veiculoSelecionado.horimetro || 0);
                const inputHr = parseFloat(formData.horimetro);
                if (inputHr <= currentHr) {
                    errors.push(`Horímetro inválido: O valor informado (${inputHr} h) deve ser maior que o atual (${currentHr} h).`);
                }
            }
        }

        if (!formData.flagTanqueCheio && (!formData.litragem || parseFloat(formData.litragem.toString().replace(',', '.')) <= 0)) {
            errors.push("Informe a litragem ou marque 'Tanque Cheio'.");
        }

        if (errors.length > 0) {
            showError("Dados Incorretos", errors);
            return;
        }

        setLoading(true);

        const payload = new FormData();
        payload.append('veiculo_id', formData.veiculoId);
        payload.append('obra_id', formData.obraId);
        payload.append('posto_id', formData.postoId);
        payload.append('funcionario_id', formData.funcionarioId);
        payload.append('tipo_combustivel', formData.tipoCombustivel);
        payload.append('data_abastecimento', formData.dataAbastecimento);
        payload.append('flag_tanque_cheio', formData.flagTanqueCheio ? '1' : '0');
        payload.append('flag_outros', formData.flagOutros ? '1' : '0');
        payload.append('descricao_outros', formData.descricaoOutros || '');

        if (formData.flagTanqueCheio) {
            payload.append('litragem', '0');
        } else {
            const litragemSanitized = formData.litragem ? formData.litragem.toString().replace(',', '.') : '0';
            payload.append('litragem', litragemSanitized);
        }

        let odometroVal = '0';
        let horimetroVal = '0';

        if (readingType === 'odometro') {
            odometroVal = formData.odometro ? formData.odometro.toString().replace(',', '.') : '0';
        } else if (readingType === 'horimetro') {
            horimetroVal = formData.horimetro ? formData.horimetro.toString().replace(',', '.') : '0';
        }
        
        payload.append('odometro', odometroVal); 
        payload.append('horimetro', horimetroVal);
        payload.append('latitude', formData.latitude ? formData.latitude.toString() : '0');
        payload.append('longitude', formData.longitude ? formData.longitude.toString() : '0');
        payload.append('foto_painel', rawImageFile);
        
        let obsFinal = formData.observacao || '';
        if (formData.needsArla) {
            obsFinal += ` [ARLA 32: ${formData.flagTanqueCheioArla ? 'Tanque Cheio' : (formData.litragemArla || '0') + ' L'}]`;
        }
        payload.append('observacao', obsFinal);

        try {
            await apiClient.post('/solicitacoes', payload, {
                headers: { 'Content-Type': undefined }
            });
            
            setAlertMessage("Solicitação enviada com sucesso!");
            
            setView('list');
            fetchMyRequests();
            setFormData(prev => ({
                ...prev,
                veiculoId: '', 
                tipoCombustivel: '',
                litragem: '', flagTanqueCheio: false, 
                flagOutros: false, descricaoOutros: '',
                needsArla: false, litragemArla: '', flagTanqueCheioArla: false,
                horimetro: '', odometro: '',
                observacao: '',
                dataAbastecimento: ''
            }));
            setPreviewImage(null);
            setRawImageFile(null);
            checkUserStatus();

        } catch (error) {
            console.error("Erro no envio:", error);
            // O backend agora retorna { error, campo, tipo, valor_informado, valor_anterior }
            // quando a falha é em um campo específico — destacamos esse campo na UI.
            const data = error.response?.data || error.data || {};
            const msg = data.error || error.message || "Erro ao enviar.";
            const campo = data.campo || null;

            if (campo) {
                setErrorField(campo);
                const fieldLabel = {
                    odometro:  'HODÔMETRO (Km)',
                    horimetro: 'HORÍMETRO (Hr)',
                    obraId:    'Obra',
                    veiculoId: 'Veículo',
                }[campo] || campo.toUpperCase();
                showError(
                    "CORRIJA ANTES DE REENVIAR",
                    [`Campo: ${fieldLabel}`, msg]
                );
                // Rola até o input destacado
                setTimeout(() => {
                    const el = document.querySelector(`[data-field="${campo}"]`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            } else {
                showError("Erro no Envio", msg);
            }
            // Atualiza contador de tentativas (informativo, não bloqueia mais)
            checkUserStatus();
        } finally {
            setLoading(false);
        }
    };

    const handleSendCupom = async (solicitacaoId) => {
        if (!cupomFile) {
            showError("Atenção", "Selecione a foto do cupom.");
            return;
        }
        setLoading(true);
        const payload = new FormData();
        payload.append('foto_cupom', cupomFile);

        try {
            await apiClient.put(`/solicitacoes/${solicitacaoId}/comprovante`, payload, {
                headers: { 'Content-Type': undefined }
            });
            setAlertMessage("Comprovante enviado!");
            setCupomFile(null);
            setCupomPreview(null);
            setSelectedRequest(null);
            fetchMyRequests();
        } catch (error) {
            showError("Erro", "Erro ao enviar comprovante: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <div className="flex justify-center items-center h-screen"><Loader className="animate-spin"/></div>;

    return (
        <div className="w-full bg-gray-100 pb-24 relative">
            <ChangePasswordModal 
                isOpen={isPasswordModalOpen} 
                onClose={() => setIsPasswordModalOpen(false)} 
            />

            {errorPopup.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
                        <div className="bg-red-600 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                                <AlertOctagon size={24} className="animate-pulse" />
                                <span>{errorPopup.title}</span>
                            </div>
                            <button onClick={() => setErrorPopup({...errorPopup, open: false})} className="text-white hover:bg-red-700 p-1 rounded-full">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {errorPopup.messages.map((msg, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-2 bg-red-50 rounded-lg border border-red-100">
                                        <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-gray-800 font-medium">{msg}</p>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => setErrorPopup({...errorPopup, open: false})}
                                className="w-full mt-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800"
                            >
                                ENTENDI, VOU CORRIGIR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'form' ? (
                <div className="min-h-screen bg-gray-50 pb-32 animate-slide-up">
                    <div className="bg-yellow-400 p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
                        <button onClick={() => setView('list')} className="p-2 bg-yellow-500 rounded-full text-white hover:bg-yellow-600 transition">
                            <ChevronRight className="rotate-180" size={24} />
                        </button>
                        <h1 className="text-lg font-bold text-gray-900">Solicitar Abastecimento</h1>
                        <div className="w-8"></div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto">
                        
                        {isOffline && (
                            <div className="bg-orange-100 text-orange-900 p-3 rounded-lg flex items-center gap-2 text-sm border border-orange-200">
                                <WifiOff size={16} /> <strong>Offline:</strong> Salvo localmente.
                            </div>
                        )}
                        
                        {gpsError && (
                            <div className="bg-gray-100 text-gray-600 p-2 rounded-lg flex items-center gap-2 text-xs " style={{ border: "1px solid #f0ebe3" }}>
                                <MapPin size={14} className="text-gray-400" /> 
                                <span>Localização indisponível (Verifique permissões).</span>
                            </div>
                        )}

                        {userStatus.attempts > 0 && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg flex items-center gap-2 text-xs">
                                <AlertOctagon size={14} className="shrink-0" />
                                <span>
                                    Você possui <strong>{userStatus.attempts}</strong> tentativa(s) com erro registradas.
                                    Confira odômetro/horímetro com atenção antes de enviar.
                                </span>
                            </div>
                        )}

                        {allowedObras.length === 0 && (
                            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
                                <p className="font-bold flex items-center gap-2"><AlertTriangle size={18}/> Sem Obra Alocada</p>
                                <p className="text-sm mt-1">
                                    Não encontramos obras vinculadas ao seu usuário neste momento.
                                </p>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Sua Obra</label>
                            <SearchableSelect
                                items={allowedObras.map(o => ({ ...o, _displayNome: `${o.nome}${o.tipo_registro === 'centro_custo' ? ' (CC)' : ''}` }))}
                                value={formData.obraId}
                                onChange={(item) => setFormData({...formData, obraId: item?.id || '', veiculoId: '', funcionarioId: ''})}
                                getLabel={(o) => o._displayNome || o.nome}
                                placeholder="Selecione a Obra..."
                                disabled={allowedObras.length === 0}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Veículo (na Obra)</label>
                            <SearchableSelect
                                items={filteredVehicles}
                                value={formData.veiculoId}
                                onChange={(item) => setFormData({...formData, veiculoId: item?.id || ''})}
                                getLabel={(v) => `${v.registroInterno} - ${v.placa}`}
                                getSubLabel={(v) => v.modelo || ''}
                                placeholder="Selecione o Veículo..."
                                disabled={!formData.obraId}
                            />
                            
                            {veiculoSelecionado && (
                                <div className="space-y-2 mt-2 px-1">
                                    {vehicleAlerts.map((alert, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`p-3 rounded-lg text-xs font-bold flex flex-col gap-1 border animate-fadeIn
                                                ${alert.type === 'block' || alert.type === 'error' 
                                                    ? 'bg-red-500 border-red-700 text-white animate-pulse' 
                                                    : 'bg-orange-100 border-orange-300 text-orange-900'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {alert.type === 'block' ? <XCircle size={18} className="shrink-0"/> : <AlertOctagon size={18} className="shrink-0"/>}
                                                <span className="uppercase text-sm">{alert.type === 'block' ? 'BLOQUEIO' : 'ATENÇÃO'}</span>
                                            </div>
                                            <p className="ml-6">{alert.message}</p>
                                            {(alert.category === 'manutencao' || alert.type === 'block') && (
                                                <div className="ml-6 mt-1 bg-black/20 p-1 rounded text-[10px] text-center">
                                                    CONTATE O SETOR DE FROTAS IMEDIATAMENTE
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                             <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-1">
                                <Calendar size={14}/> Data do Abastecimento
                            </label>
                            <input 
                                type="date" 
                                className="w-full p-3 bg-white border border-gray-300 rounded-xl shadow-sm text-lg"
                                value={formData.dataAbastecimento}
                                onChange={e => setFormData({...formData, dataAbastecimento: e.target.value})}
                            />
                             <p className="text-[10px] text-gray-500 px-1">Se for em outro dia altere aqui, se for hoje não altere.</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Condutor/Responsável</label>
                            <SearchableSelect
                                items={
                                    (formData.funcionarioId && filteredEmployees.length === 0)
                                        ? [{ id: formData.funcionarioId, nome: `${user.name} (Auto-selecionado)` }]
                                        : filteredEmployees
                                }
                                value={formData.funcionarioId}
                                onChange={(item) => setFormData({...formData, funcionarioId: item?.id || ''})}
                                getLabel={(e) => e.nome}
                                placeholder="Selecione quem está trabalhando com o Veículo/Máquina..."
                                disabled={!formData.obraId}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {readingType === 'odometro' && (
                                <div className="animate-fadeIn" data-field="odometro">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-1">
                                        <Gauge size={14}/> Hodômetro (Km)
                                    </label>
                                    <input
                                        type="number"
                                        className={`w-full p-3 bg-white border rounded-xl shadow-sm text-lg font-bold ${
                                            errorField === 'odometro'
                                                ? 'border-red-500 ring-2 ring-red-300 bg-red-50'
                                                : 'border-gray-300'
                                        }`}
                                        placeholder="Ex: 15000"
                                        value={formData.odometro}
                                        onChange={e => { setFormData({...formData, odometro: e.target.value, horimetro: ''}); if (errorField === 'odometro') setErrorField(null); }}
                                        disabled={!veiculoSelecionado}
                                    />
                                    {veiculoSelecionado && (
                                        <p className="text-[10px] text-gray-500 mt-1 text-right">
                                            Atual: {veiculoSelecionado.odometro || 0} Km
                                        </p>
                                    )}
                                </div>
                            )}
                            
                            {readingType === 'horimetro' && (
                                <div className="animate-fadeIn p-3 bg-red-50 border border-red-200 rounded-xl" data-field="horimetro">
                                    <label className="text-xs font-bold text-red-700 uppercase ml-1 flex justify-between items-center mb-1">
                                        <span className="flex items-center gap-1"><CalendarClock size={14}/> Horímetro (Hr)</span>
                                        <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                                            ATENÇÃO: NÃO USAR KM!
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        className={`w-full p-3 bg-white border rounded-xl shadow-sm text-lg font-bold ${
                                            errorField === 'horimetro'
                                                ? 'border-red-500 ring-2 ring-red-300 bg-red-50'
                                                : 'border-gray-300'
                                        }`}
                                        placeholder="Ex: 1500.5"
                                        value={formData.horimetro}
                                        onChange={e => { setFormData({...formData, horimetro: e.target.value, odometro: ''}); if (errorField === 'horimetro') setErrorField(null); }}
                                        disabled={!veiculoSelecionado}
                                    />
                                    <p className="text-[10px] text-red-600 mt-1 font-semibold">
                                        Informe as horas de uso da máquina. Não informe a quilometragem.
                                    </p>
                                    {/* CORREÇÃO CRÍTICA: Protegido contra crash caso veiculoSelecionado fique undefined */}
                                    {veiculoSelecionado && (
                                        <p className="text-xs text-gray-400 text-right mt-1">
                                            Último: {veiculoSelecionado.odometro > 0 ? `${veiculoSelecionado.odometro} Km` : `${veiculoSelecionado.horimetro || 0} h`}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex justify-between items-center">
                                <span>Foto do Painel</span>
                                <span className="text-red-600 text-[10px] font-bold bg-red-50 px-2 py-1 rounded">Foto ilegível anula o pedido</span>
                            </label>
                            
                            <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all h-48 relative overflow-hidden ${previewImage ? 'border-green-500 bg-green-50' : 'border-gray-400 bg-gray-50'}`}>
                                {previewImage ? (
                                    <div onClick={() => setPreviewImage(null)} className="w-full h-full relative cursor-pointer">
                                        <img src={previewImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                                        <div className="absolute bottom-2 left-0 right-0 text-center flex justify-center">
                                             <span className="bg-white px-3 py-1 rounded-full shadow text-xs font-bold text-green-700 inline-flex items-center gap-1">
                                                <CheckCircle size={12}/> Foto Carregada <span className="text-gray-400 font-normal">|</span> <Trash2 size={10} className="text-red-500"/> Alterar
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-row gap-4 w-full h-full items-center justify-center">
                                         <div onClick={() => cameraInputRef.current.click()} className="flex-1 h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg cursor-pointer hover:bg-[#fdf8f0] active:bg-yellow-100 transition shadow-sm" style={{ border: "1px solid #f0ebe3" }}>
                                            <Camera size={32} className="text-gray-700 mb-2" />
                                            <span className="text-sm font-bold text-gray-800">Câmera</span>
                                         </div>
                                         <div onClick={() => galleryInputRef.current.click()} className="flex-1 h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition shadow-sm" style={{ border: "1px solid #f0ebe3" }}>
                                            <ImageIcon size={32} className="text-gray-700 mb-2" />
                                            <span className="text-sm font-bold text-gray-800">Galeria</span>
                                         </div>
                                    </div>
                                )}
                                <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'painel')} />
                                <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'painel')} />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex justify-between">
                                Posto
                                {formData.postoId && <span className="text-blue-600 text-[10px] font-bold bg-blue-50 px-1 rounded">Sugestão Automática</span>}
                            </label>
                            <SearchableSelect
                                items={partners.filter(p => p.status_operacional !== 'BLOQUEADO' && (!p.tipo_parceiro || p.tipo_parceiro === 'posto'))}
                                value={formData.postoId}
                                onChange={(item) => setFormData({...formData, postoId: item?.id || ''})}
                                getLabel={(p) => p.razaoSocial || ''}
                                getSubLabel={(p) => p.cidade || ''}
                                placeholder="Selecione o Posto..."
                            />
                        </div>

                        <div className="bg-yellow-50 p-4 rounded-xl shadow-inner border border-yellow-200 space-y-3">
                            <label className="text-sm font-bold text-yellow-900 flex items-center gap-2">
                                <Fuel size={18}/> Detalhes do Combustível
                            </label>
                            
                            <select 
                                className="w-full p-3 border border-yellow-300 rounded-lg bg-white"
                                value={formData.tipoCombustivel}
                                onChange={e => setFormData({...formData, tipoCombustivel: e.target.value})}
                            >
                                <option value="">Selecione...</option>
                                <option value="DIESEL S10">Diesel S10</option>
                                <option value="DIESEL S500">Diesel S500</option>
                                <option value="GASOLINA COMUM">Gasolina Comum</option>
                            </select>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 relative">
                                    <input 
                                        type="number" 
                                        placeholder="Litros" 
                                        className="w-full p-3 border border-yellow-300 rounded-lg disabled:bg-gray-100"
                                        disabled={formData.flagTanqueCheio}
                                        value={formData.litragem}
                                        onChange={e => setFormData({...formData, litragem: e.target.value})}
                                    />
                                    <span className="absolute right-3 top-3.5 text-gray-400 text-sm font-bold">L</span>
                                </div>
                                <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${formData.flagTanqueCheio ? 'bg-yellow-400 border-yellow-500 text-black' : 'bg-white border-yellow-300 text-gray-600'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={formData.flagTanqueCheio}
                                        onChange={e => setFormData({...formData, flagTanqueCheio: e.target.checked})}
                                        className="w-5 h-5 accent-black"
                                    />
                                    <span className="text-sm font-bold">Cheio</span>
                                </label>
                            </div>
                        </div>

                        {showArlaSection && (
                            <div className="bg-blue-50 p-4 rounded-xl shadow-inner border border-blue-200 space-y-3 animate-fadeIn">
                                <label className="text-sm font-bold text-blue-900 flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.needsArla}
                                        onChange={e => setFormData({...formData, needsArla: e.target.checked})}
                                        className="w-5 h-5 accent-blue-600"
                                    />
                                    <Droplet size={18}/> Adicionar Arla 32
                                </label>

                                {formData.needsArla && (
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 relative">
                                            <input 
                                                type="number" 
                                                placeholder="Lts Arla" 
                                                className="w-full p-3 border border-blue-300 rounded-lg disabled:bg-gray-100"
                                                disabled={formData.flagTanqueCheioArla}
                                                value={formData.litragemArla}
                                                onChange={e => setFormData({...formData, litragemArla: e.target.value})}
                                            />
                                            <span className="absolute right-3 top-3.5 text-gray-400 text-sm font-bold">L</span>
                                        </div>
                                        <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${formData.flagTanqueCheioArla ? 'bg-blue-400 border-blue-500 text-white' : 'bg-white border-blue-300 text-gray-600'}`}>
                                            <input 
                                                type="checkbox" 
                                                checked={formData.flagTanqueCheioArla}
                                                onChange={e => setFormData({...formData, flagTanqueCheioArla: e.target.checked})}
                                                className="w-5 h-5 accent-white"
                                            />
                                            <span className="text-sm font-bold">Cheio</span>
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="bg-white p-3 border rounded-xl space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.flagOutros}
                                        onChange={e => setFormData({...formData, flagOutros: e.target.checked})}
                                        className="w-4 h-4 text-gray-500 rounded accent-gray-600"
                                    />
                                    <span className="text-sm text-gray-700 font-medium">Incluir Outros (Óleo, Filtro...)</span>
                                </label>
                                {formData.flagOutros && (
                                    <input 
                                        type="text"
                                        placeholder="Descreva os itens..."
                                        className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                        value={formData.descricaoOutros}
                                        onChange={e => setFormData({...formData, descricaoOutros: e.target.value})}
                                    />
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-1">
                                    <FileText size={12}/> Observações
                                </label>
                                <textarea 
                                    className="w-full p-3 bg-white border border-gray-300 rounded-xl shadow-sm text-sm"
                                    rows="2"
                                    placeholder="Informações adicionais..."
                                    value={formData.observacao}
                                    onChange={e => setFormData({...formData, observacao: e.target.value})}
                                ></textarea>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading || hasBlockingAlert}
                            className={`w-full py-4 font-bold rounded-xl shadow-xl hover:bg-gray-800 active:scale-95 transition-transform flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed
                            ${hasBlockingAlert ? 'bg-red-300 text-red-900' : 'bg-gray-900 text-white'}`}
                        >
                            {loading ? <Loader className="animate-spin" /> : 
                                hasBlockingAlert ? <><Lock size={20}/> BLOQUEADO POR PENDÊNCIA</> : <><Send size={20} /> ENVIAR SOLICITAÇÃO</>
                            }
                        </button>
                    </form>
                </div>
            ) : (
                <>
                    <div className="bg-gray-900 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                        <div className="absolute top-[-20px] right-[-20px] p-4 opacity-10 rotate-12">
                            <Fuel size={150} />
                        </div>
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="flex-1 mr-2 overflow-hidden">
                                {onVoltar && (
                                    <button
                                        onClick={onVoltar}
                                        className="flex items-center gap-1 text-gray-400 hover:text-white text-xs mb-2 transition"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                                        Voltar
                                    </button>
                                )}
                                <h1 className="text-xl md:text-2xl font-bold truncate">Olá, {user.name.split(' ')[0]}</h1>
                                <p className="text-gray-400 text-sm">Painel do Operador</p>
                            </div>
                            <div className="flex gap-2 items-center shrink-0">
                                <button onClick={() => setIsPasswordModalOpen(true)} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition" title="Alterar Senha">
                                    <Lock size={20} />
                                </button>
                                <button onClick={fetchMyRequests} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition active:rotate-180" title="Atualizar">
                                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                                </button>
                                <button onClick={handleLogout} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 shadow-sm" title="Sair">
                                    <LogOut size={18} />
                                    <span className="text-xs font-bold hidden sm:inline">SAIR</span>
                                </button>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => { getLocation(); setView('form'); }}
                            className="w-full py-4 bg-yellow-400 text-gray-900 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 hover:bg-yellow-300 transition active:scale-98 relative z-10"
                        >
                            <Fuel size={24} /> 
                            <span className="text-lg">NOVO ABASTECIMENTO</span>
                        </button>
                    </div>

                    <div className="px-4 mt-2">
                        <h2 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <Clock size={14} /> Minhas Solicitações Recentes
                        </h2>
                        
                        {visibleRequests.length === 0 ? (
                            <div className="text-center py-10 bg-white rounded-2xl border border-dashed">
                                <p className="text-gray-400 text-sm">Nenhuma solicitação encontrada para sua obra atual.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {visibleRequests.map(req => {
                                    const isMine = String(req.usuario_id) === String(user.id);
                                    
                                    return (
                                        <div key={req.id} onClick={() => setSelectedRequest(req)} className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${req.status === 'LIBERADO' ? 'bg-green-500' : req.status === 'NEGADO' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                                            <div className="pl-2">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] px-2 py-1 rounded-md border font-bold ${req.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'}`}>
                                                        {req.status}
                                                    </span>
                                                    <div className="text-right">
                                                        <span className="text-xs text-gray-400 block">{new Date(req.data_solicitacao).toLocaleDateString('pt-BR')}</span>
                                                        {!isMine && (
                                                            <span className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded">
                                                                Por: {req.solicitante_nome?.split(' ')[0] || 'Outro'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-bold text-gray-800">{req.placa}</p>
                                                        <p className="text-xs text-gray-500 uppercase">{req.veiculo_nome}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-gray-800">{req.litragem_solicitada ? `${req.litragem_solicitada} L` : 'Cheio'}</p>
                                                        <p className="text-[10px] text-gray-500">{req.tipo_combustivel}</p>
                                                    </div>
                                                </div>
                                                {req.status === 'LIBERADO' && isMine && (
                                                    <div className="mt-2 bg-green-50 text-green-700 text-xs p-2 rounded flex items-center gap-1 font-bold animate-pulse">
                                                        <Camera size={12}/> Enviar Cupom Agora
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {selectedRequest && (
                        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
                            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
                                <div className="flex justify-between items-center mb-6 border-b pb-4">
                                    <h3 className="font-bold text-xl text-gray-900">Solicitação #{selectedRequest.id}</h3>
                                    <button onClick={() => setSelectedRequest(null)} className="p-2 bg-gray-100 rounded-full"><XCircle size={24}/></button>
                                </div>
                                
                                {selectedRequest.status === 'LIBERADO' ? (
                                    <div className="text-center space-y-4">
                                        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                                            <CheckCircle size={32} className="text-green-600" />
                                        </div>
                                        <h4 className="font-bold text-green-800 text-lg">Aprovado! Envie o Cupom.</h4>
                                        
                                        {String(selectedRequest.usuario_id) === String(user.id) ? (
                                            <>
                                                <div className="border-2 border-dashed border-green-300 rounded-xl p-4 bg-green-50 relative h-40 flex flex-col items-center justify-center">
                                                    {cupomPreview ? (
                                                        <div onClick={() => setCupomPreview(null)} className="w-full h-full relative cursor-pointer">
                                                            <img src={cupomPreview} className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                                                            <div className="absolute bottom-2 left-0 right-0 text-center flex justify-center">
                                                                 <span className="bg-white px-3 py-1 rounded-full shadow text-xs font-bold text-green-700 inline-flex items-center gap-1">
                                                                    <Trash2 size={10} className="text-red-500"/> Trocar Foto
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-row gap-3 w-full h-full items-center justify-center">
                                                             <div onClick={() => cameraCupomRef.current.click()} className="flex-1 h-full flex flex-col items-center justify-center bg-white rounded-lg cursor-pointer hover:bg-green-100 active:bg-green-200 transition border border-green-200 shadow-sm">
                                                                <Camera size={24} className="text-green-600 mb-1" />
                                                                <span className="text-xs font-bold text-green-700">Câmera</span>
                                                             </div>
                                                             <div onClick={() => galleryCupomRef.current.click()} className="flex-1 h-full flex flex-col items-center justify-center bg-white rounded-lg cursor-pointer hover:bg-green-100 active:bg-green-200 transition border border-green-200 shadow-sm">
                                                                <ImageIcon size={24} className="text-green-600 mb-1" />
                                                                <span className="text-xs font-bold text-green-700">Galeria</span>
                                                             </div>
                                                        </div>
                                                    )}
                                                    <input type="file" ref={cameraCupomRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'cupom')}/>
                                                    <input type="file" ref={galleryCupomRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'cupom')}/>
                                                </div>

                                                <button onClick={() => handleSendCupom(selectedRequest.id)} disabled={!cupomFile || loading} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg">
                                                    {loading ? <Loader className="animate-spin inline"/> : "ENVIAR COMPROVANTE"}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                                                Apenas o solicitante ({selectedRequest.solicitante_nome}) pode enviar o comprovante.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3 text-sm">
                                        <div className="bg-gray-50 p-3 rounded-xl border">
                                            <p className="font-bold text-gray-500 text-xs uppercase">Status</p>
                                            <p className="font-bold text-gray-900">{selectedRequest.status}</p>
                                            {selectedRequest.motivo_negativa && <p className="text-red-600 mt-1 text-xs">{selectedRequest.motivo_negativa}</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SolicitacaoAbastecimentoPage;



