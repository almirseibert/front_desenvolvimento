import React, { useState, useEffect, useMemo } from 'react';
import { 
    Disc, Truck, Plus, ArrowRight, ArrowLeft, Printer, Search, 
    Activity, AlertCircle, X, History, Briefcase, AlertTriangle,
    Settings, FileText, Trash2, RotateCcw, Edit, FileCheck, CornerDownRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import { formatObraNome } from '../utils/obraFormat';

// Importamos checkVehicleRestrictions para verificar se existem alertas de revisão/doc
import { checkVehicleRestrictions } from '../utils/vehicleRules';

// --- CONFIGURAÇÃO DE POSIÇÕES DE PNEUS (Layout Visual) ---
const TIRE_LAYOUTS = {
    'Automóvel': ['Dianteiro Esq', 'Dianteiro Dir', 'Traseiro Esq', 'Traseiro Dir', 'Estepe'],
    'Bitruck': ['Direcional Esq', 'Direcional Dir', '2º Direcional Esq', '2º Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Truck Esq Int', 'Truck Dir Int', 'Truck Esq Ext', 'Truck Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Caminhão Pipa': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Truck Esq Int', 'Truck Dir Int', 'Truck Esq Ext', 'Truck Dir Int', 'Truck Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Caminhão Prancha': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Truck Esq Int', 'Truck Dir Int', 'Truck Esq Ext', 'Truck Dir Ext', 'Carreta 1º E Esq Int', 'Carreta 1º E Dir Int', 'Carreta 1º E Esq Ext', 'Carreta 1º E Dir Ext', 'Carreta 2º E Esq Int', 'Carreta 2º E Dir Int', 'Carreta 2º E Esq Ext', 'Carreta 2º E Dir Ext', 'Carreta 3º E Esq Int', 'Carreta 3º E Dir Int', 'Carreta 3º E Esq Ext', 'Carreta 3º E Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Caminhão Tanque': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Truck Esq Int', 'Truck Dir Int', 'Truck Esq Ext', 'Truck Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Caminhão Carroceria': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Estepe'],
    'Camionete': ['Dianteiro Esq', 'Dianteiro Dir', 'Traseiro Esq', 'Traseiro Dir', 'Estepe'],
    'Cavalo': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Truck Esq Int', 'Truck Dir Int', 'Truck Esq Ext', 'Truck Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Caçamba Bitruck': ['Direcional Esq', 'Direcional Dir', '2º Direcional Esq', '2º Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Truck Esq Int', 'Truck Dir Int', 'Truck Esq Ext', 'Truck Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Caçamba Toco': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Estepe 1', 'Estepe 2'],
    'Caçamba Traçado': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Truck Esq Int', 'Truck Dir Int', 'Truck Esq Ext', 'Truck Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Caçamba Truckado': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Ext', 'Tração Dir Ext', 'Tração Esq Int', 'Tração Dir Int', 'Truck Esq Int', 'Truck Dir Int', 'Truck Esq Ext', 'Truck Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Escavadeira': [], 
    'Fresadora': [], 
    'Moto': ['Dianteiro', 'Traseiro'],
    'Motoniveladora': ['Direcional Esq', 'Direcional Dir', 'Tração 1 Esq', 'Tração 1 Dir', 'Tração 2 Esq', 'Tração 2 Dir'],
    'Pá Carregadeira': ['Direcional Esq', 'Direcional Dir', 'Tração Esq', 'Tração Dir'],
    'Retroescavadeira': ['Direcional Esq', 'Direcional Dir', 'Tração Esq', 'Tração Dir'],
    'Rolo': ['Tração Esq', 'Tração Dir'],
    'Semirreboques': ['Carreta 1º E Esq Int', 'Carreta 1º E Dir Int', 'Carreta 1º E Esq Ext', 'Carreta 1º E Dir Ext', 'Carreta 2º E Esq Int', 'Carreta 2º E Dir Int', 'Carreta 2º E Esq Ext', 'Carreta 2º E Dir Ext', 'Carreta 3º E Esq Int', 'Carreta 3º E Dir Int', 'Carreta 3º E Esq Ext', 'Carreta 3º E Dir Ext', 'Estepe 1', 'Estepe 2'],
    'Trator': ['Direcional Esq', 'Direcional Dir', 'Tração Esq', 'Tração Dir'],
    'Trator Esteira': [], 
    'Utilitários': ['Direcional Esq', 'Direcional Dir', 'Tração Esq Int', 'Tração Dir Int', 'Tração Esq Ext', 'Tração Dir Ext', 'Estepe'],
    'Padrão': ['Dianteiro Esq', 'Dianteiro Dir', 'Traseiro Esq', 'Traseiro Dir'] 
};

const getTireLayout = (vehicleType) => {
    return TIRE_LAYOUTS[vehicleType] || TIRE_LAYOUTS['Padrão'];
};

const StatCard = ({ label, value, icon, color }) => (
    <div className={`p-4 rounded-lg shadow-sm flex items-center justify-between ${color}`}>
        <div>
            <p className="text-xs font-bold uppercase opacity-70">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="opacity-50">{icon}</div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---
const TiresPage = ({ 
    user, vehicles = [], employees = [], obras = [], revisions = [], apiClient, setAlertMessage, reloadData, PasswordConfirmationModal 
}) => {
    const { isViewer } = useAuth();

    const [activeTab, setActiveTab] = useState('stock'); 
    const [tires, setTires] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Estados Estoque
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos'); 
    const [showNewTireModal, setShowNewTireModal] = useState(false);
    const [showSpareTireModal, setShowSpareTireModal] = useState(false); 
    const [showStockActionModal, setShowStockActionModal] = useState(false); 
    const [selectedTireForAction, setSelectedTireForAction] = useState(null);
    const [showEditTireModal, setShowEditTireModal] = useState(false);

    // Estados Veículo
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState(''); 
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactionType, setTransactionType] = useState(''); 
    const [selectedPosition, setSelectedPosition] = useState('');
    const [selectedTireForTransaction, setSelectedTireForTransaction] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [tireHistoryId, setTireHistoryId] = useState(null);

    // Estados Relatórios
    const [reportFilters, setReportFilters] = useState({
        estoque: true, emUso: true, step: true, recapagem: true, sucata: true,
        size: ''
    });

    const loadTires = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getTires();
            setTires(data || []);
        } catch (error) {
            console.error(error);
            setAlertMessage('Erro ao carregar pneus.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTires();
    }, []);

    // Disponível para instalação em veículos (Estoque)
    const availableStockTires = useMemo(() => {
        return tires.filter(t => t.status === 'Estoque');
    }, [tires]);

    const filteredTires = useMemo(() => {
        return tires.filter(t => {
            const matchSearch = 
                t.fireNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.size.includes(searchTerm);
            
            const matchStatus = statusFilter === 'todos' || t.status === statusFilter;
            
            return matchSearch && matchStatus;
        });
    }, [tires, searchTerm, statusFilter]);

    const stats = useMemo(() => ({
        total: tires.length,
        estoque: tires.filter(t => t.status === 'Estoque').length,
        emUso: tires.filter(t => t.status === 'Em Uso').length,
        step: tires.filter(t => t.status === 'Step/Reserva').length,
        recapagem: tires.filter(t => t.status === 'Recapagem').length,
        sucata: tires.filter(t => t.status === 'Sucata').length,
    }), [tires]);

    const filteredVehicles = useMemo(() => {
        const matched = vehicles
            .filter(v => {
                if (!vehicleSearchTerm) return true;
                const term = vehicleSearchTerm.toLowerCase();
                return (
                    (v.placa || '').toLowerCase().includes(term) ||
                    (v.registroInterno || '').toLowerCase().includes(term) ||
                    (v.modelo || '').toLowerCase().includes(term) ||
                    (v.tipo || '').toLowerCase().includes(term)
                );
            })
            .sort((a, b) => (a.registroInterno || '').localeCompare(b.registroInterno || ''));

        // Reboques/acessórios atrelados aparecem aninhados sob o principal, para
        // permitir a manutenção de pneus do reboque.
        const matchedIds = new Set(matched.map(v => v.id));
        const childrenByParent = new Map();
        for (const v of vehicles) {
            if (v.linkedParentId) {
                if (!childrenByParent.has(v.linkedParentId)) childrenByParent.set(v.linkedParentId, []);
                childrenByParent.get(v.linkedParentId).push(v);
            }
        }
        const result = [];
        for (const v of matched) {
            if (v.linkedParentId && matchedIds.has(v.linkedParentId)) continue; // renderizado aninhado
            result.push({ ...v, _isChild: !!v.linkedParentId });
            for (const child of (childrenByParent.get(v.id) || [])) {
                result.push({ ...child, _isChild: true });
            }
        }
        return result;
    }, [vehicles, vehicleSearchTerm]);

    const selectedVehicle = useMemo(() => 
        vehicles.find(v => v.id === selectedVehicleId), 
    [vehicles, selectedVehicleId]);

    const vehicleAlerts = useMemo(() => {
        if (!selectedVehicle) return [];
        return checkVehicleRestrictions(selectedVehicle, revisions);
    }, [selectedVehicle, revisions]);

    const vehicleTires = useMemo(() => 
        tires.filter(t => t.currentVehicleId === selectedVehicleId),
    [tires, selectedVehicleId]);

    // Lógica para determinar se o veículo usa Km ou Horas (V2.0)
    const getVehicleReadingType = (vehicle) => {
        const type = vehicle.tipo;
        if (['Veículos Leves', 'Caminhões de Trecho', 'Automóvel', 'Camionete', 'Caminhão Prancha'].includes(type)) {
            return 'Km';
        }
        return 'Hr';
    };

    // --- GERAÇÃO DE RELATÓRIO DE PNEUS ---
    const handleGenerateReport = () => {
        const reportData = tires.filter(t => {
            if (reportFilters.size && !t.size.toLowerCase().includes(reportFilters.size.toLowerCase())) return false;
            if (t.status === 'Estoque' && reportFilters.estoque) return true;
            if (t.status === 'Em Uso' && reportFilters.emUso) return true;
            if (t.status === 'Step/Reserva' && reportFilters.step) return true;
            if (t.status === 'Recapagem' && reportFilters.recapagem) return true;
            if (t.status === 'Sucata' && reportFilters.sucata) return true;
            return false;
        });

        const doc = new jsPDF();
        doc.text("Relatório Geral de Pneus - Frotas MAK", 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()} - Total de Registros: ${reportData.length}`, 14, 22);
        
        const tableBody = reportData.map(t => [
            t.fireNumber,
            `${t.brand} ${t.model || ''}`,
            t.size,
            t.status,
            t.status === 'Em Uso' ? t.vehicleRegistro : (t.location || '-'),
            t.tireCondition
        ]);

        autoTable(doc, {
            startY: 28,
            head: [['Fogo', 'Marca/Modelo', 'Medida', 'Status', 'Local/Veículo', 'Condição']],
            body: tableBody,
            theme: 'striped',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save('Relatorio_Pneus.pdf');
    };

    // --- GERAÇÃO DE TERMO DE RESPONSABILIDADE (STEP) ---
    const handleGenerateSpareTermPDF = (data) => {
        try {
            const doc = new jsPDF();
            const today = new Date().toLocaleDateString('pt-BR');
            
            doc.setFontSize(16); doc.setFont("helvetica", "bold");
            doc.text("TERMO DE RESPONSABILIDADE - PNEU RESERVA/STEP", 105, 20, { align: "center" });
            doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text("Frotas MAK - Controle de Patrimônio", 105, 26, { align: "center" });
            doc.line(20, 30, 190, 30);

            doc.setFontSize(11);
            const text = `Eu, ${data.employeeName}, declaro que recebi nesta data (${today}), para uso exclusivo em serviço na obra ${data.obraName}, o pneu abaixo discriminado, assumindo total responsabilidade pela sua guarda, conservação e correta utilização.`;
            doc.text(doc.splitTextToSize(text, 170), 20, 45);

            doc.setFillColor(240, 240, 240);
            doc.rect(20, 65, 170, 35, "F");
            doc.setFont("helvetica", "bold"); doc.text("DADOS DO PNEU", 25, 72);
            doc.setFont("helvetica", "normal");
            doc.text(`Marca de Fogo: ${data.fireNumber || '________________'}`, 25, 80);
            doc.text(`Marca/Modelo: ${data.brand || ''} / ${data.model || ''}`, 25, 87);
            doc.text(`Medida: ${data.size || ''}`, 100, 80);
            doc.text(`Estado: ${data.tireCondition || ''}`, 100, 87);

            doc.setFont("helvetica", "bold"); doc.text("OBSERVAÇÕES:", 20, 115);
            doc.setFont("helvetica", "normal");
            if (data.observation) doc.text(doc.splitTextToSize(data.observation, 170), 20, 122);
            else { doc.text("_________________________________________________________", 20, 125); }

            doc.text("Local e Data: ______________________, _____ de _______________ de _______", 20, 180);
            doc.line(20, 210, 90, 210); doc.line(110, 210, 180, 210);
            doc.text("Assinatura do Responsável", 55, 215, { align: "center" });
            doc.text("Assinatura Almoxarifado/Frotas", 145, 215, { align: "center" });

            doc.save(`Termo_Step_${data.fireNumber}.pdf`);
        } catch (e) { console.error("Erro PDF Termo:", e); }
    };

    // --- GERAÇÃO DE OS (CROQUI) ---
    const handleGenerateOSCroqui = () => {
        if (!selectedVehicle) return;
        try {
            const doc = new jsPDF();
            const positions = getTireLayout(selectedVehicle.tipo);
            const today = new Date().toLocaleDateString('pt-BR');
            const unit = getVehicleReadingType(selectedVehicle);

            doc.setFontSize(16); doc.setFont("helvetica", "bold");
            doc.text("ORDEM DE SERVIÇO - PNEUS", 105, 20, { align: "center" });
            
            doc.setFillColor(240, 240, 240); doc.rect(14, 35, 182, 25, "F"); 
            doc.setFontSize(11); doc.setFont("helvetica", "bold");
            doc.text(`Veículo: ${selectedVehicle.registroInterno} - ${selectedVehicle.placa}`, 20, 45);
            doc.text(`Modelo: ${selectedVehicle.modelo}`, 20, 52);
            doc.text(`Data: ${today}`, 120, 45);
            doc.text(`Leitura Atual (${unit}): ____________________`, 20, 58);

            doc.setFontSize(12); doc.text("Mapa de Substituição (Croqui)", 14, 75);
            
            // Layout dinâmico básico para croqui
            const centerX = 105; let drawY = 90;
            const leftTires = positions.filter(p => p.includes('Esq') || p.includes('Interno'));
            const rightTires = positions.filter(p => p.includes('Dir') || p.includes('Externo'));
            const maxRows = Math.max(leftTires.length, rightTires.length);
            
            doc.setLineWidth(2); doc.setDrawColor(200);
            doc.line(centerX, drawY - 10, centerX, drawY + (maxRows * 30)); // Chassi
            doc.setLineWidth(0.5); doc.setDrawColor(0);

            // Caixas de pneus
            const drawBox = (x, y, label, sub) => {
                doc.rect(x, y, 28, 16);
                doc.setFontSize(6); doc.text(sub, x + 14, y + 3, { align: "center" });
                doc.setFontSize(7); doc.text(label, x + 14, y + 14, { align: "center" });
            };

            for (let i = 0; i < maxRows; i++) {
                doc.line(centerX - 35, drawY + 8, centerX + 35, drawY + 8); // Eixo
                if (leftTires[i]) {
                    drawBox(centerX - 75, drawY, leftTires[i], "NOVO");
                    drawBox(centerX - 45, drawY, leftTires[i], "SAIU");
                }
                if (rightTires[i]) {
                    drawBox(centerX + 17, drawY, rightTires[i], "SAIU");
                    drawBox(centerX + 47, drawY, rightTires[i], "NOVO");
                }
                drawY += 30;
            }

            const pageHeight = doc.internal.pageSize.height;
            doc.line(20, pageHeight - 30, 90, pageHeight - 30); 
            doc.line(120, pageHeight - 30, 190, pageHeight - 30); 
            doc.text("Assinatura Supervisor", 55, pageHeight - 25, { align: "center" });
            doc.text("Assinatura Borracheiro", 155, pageHeight - 25, { align: "center" });

            doc.save(`OS_Croqui_${selectedVehicle.placa}.pdf`);
        } catch (error) { console.error(error); }
    };

    return (
        <div className="container mx-auto p-4 md:p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e1a14" }} className=" flex items-center gap-2">
                    <Disc className="text-gray-600" /> Gestão de Pneus
                </h1>
                <div className="flex gap-2 bg-white p-1 rounded-lg shadow-sm border">
                    <button onClick={() => setActiveTab('stock')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'stock' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Estoque Geral</button>
                    <button onClick={() => setActiveTab('vehicles')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'vehicles' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Gestão por Veículo</button>
                    <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Relatórios</button>
                </div>
            </div>

            {/* --- ABA ESTOQUE --- */}
            {activeTab === 'stock' && (
                <div className="bg-white rounded-lg shadow-md border p-4">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                        <StatCard label="Total" value={stats.total} icon={<Disc />} color="bg-gray-100" />
                        <StatCard label="Estoque" value={stats.estoque} icon={<Activity />} color="bg-blue-50 text-blue-800" />
                        <StatCard label="Em Uso" value={stats.emUso} icon={<Truck />} color="bg-green-50 text-green-800" />
                        <StatCard label="Step/Reserva" value={stats.step} icon={<Briefcase />} color="bg-orange-50 text-orange-800" />
                        <StatCard label="Recapagem" value={stats.recapagem} icon={<RotateCcw />} color="bg-yellow-50 text-yellow-800" />
                        <StatCard label="Sucata" value={stats.sucata} icon={<Trash2 />} color="bg-red-50 text-red-800" />
                    </div>

                    <div className="flex justify-between items-center mb-4 flex-wrap gap-4 bg-gray-50 p-3 rounded-lg">
                        <div className="flex gap-4 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar Pneu..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2">
                                <option value="todos">Todos Status</option>
                                <option value="Estoque">Estoque</option>
                                <option value="Step/Reserva">Step/Reserva</option>
                                <option value="Recapagem">Recapagem</option>
                                <option value="Sucata">Sucata</option>
                            </select>
                        </div>
                        {!isViewer && (
                            <button onClick={() => setShowNewTireModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm">
                                <Plus size={18} /> Cadastrar Pneu
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="bg-gray-100 text-gray-700 uppercase font-medium">
                                <tr>
                                    <th className="px-4 py-3">Fogo</th>
                                    <th className="px-4 py-3">Marca/Modelo</th>
                                    <th className="px-4 py-3">Medida</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Localização</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTires.map(tire => (
                                    <tr key={tire.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 font-bold text-gray-900">{tire.fireNumber}</td>
                                        <td className="px-4 py-3">{tire.brand} {tire.model}</td>
                                        <td className="px-4 py-3">{tire.size}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${tire.status === 'Estoque' ? 'bg-blue-100 text-blue-800' : tire.status === 'Em Uso' ? 'bg-green-100 text-green-800' : tire.status === 'Step/Reserva' ? 'bg-orange-100 text-orange-800' : tire.status === 'Recapagem' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                {tire.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{tire.status === 'Em Uso' ? <span className="flex items-center gap-1"><Truck size={12}/> {tire.vehicleRegistro}</span> : tire.location}</td>
                                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                                            <button onClick={() => { setTireHistoryId(tire.id); }} title="Histórico" className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"><History size={16} /></button>
                                            {!isViewer && (
                                                <>
                                                    <button onClick={() => { setSelectedTireForAction(tire); setShowEditTireModal(true); }} title="Editar" className="p-1.5 text-blue-500 hover:bg-blue-100 rounded"><Edit size={16} /></button>
                                                    {tire.status !== 'Em Uso' && (
                                                        <button onClick={() => { setSelectedTireForAction(tire); setShowStockActionModal(true); }} title="Movimentar" className="p-1.5 text-green-600 hover:bg-green-100 rounded bg-green-50 border border-green-200"><Settings size={16} /></button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- ABA VEÍCULOS --- */}
            {activeTab === 'vehicles' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-4 rounded-lg shadow-md border lg:col-span-1 h-fit">
                        <h3 className="font-bold text-lg mb-2 text-gray-700">Selecione o Veículo</h3>
                        <div className="relative mb-3">
                            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input type="text" placeholder="Pesquisar Veículo..." className="w-full pl-8 pr-2 py-2 border rounded-lg text-sm" value={vehicleSearchTerm} onChange={e => setVehicleSearchTerm(e.target.value)} />
                        </div>
                        <div className="max-h-60 overflow-y-auto border rounded-lg mb-4 bg-gray-50">
                            {filteredVehicles.map(v => (
                                <div key={v.id} onClick={() => setSelectedVehicleId(v.id)} className={`p-2 cursor-pointer text-sm border-b last:border-b-0 hover:bg-blue-50 ${v._isChild ? 'pl-6 bg-violet-50/40' : ''} ${selectedVehicleId === v.id ? 'bg-blue-100 border-l-4 border-blue-500 font-medium' : ''}`}>
                                    <span className="inline-flex items-center gap-1">
                                        {v._isChild && <CornerDownRight size={13} className="text-violet-400 shrink-0"/>}
                                        {v.registroInterno} - {v.tipo} - {v.marca} {v.modelo}
                                        {v.isOutsourced && <span title="Veículo terceirizado" className="text-[9px] font-bold uppercase bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-1.5 py-px">3º</span>}
                                        {v._isChild && <span className="text-[9px] font-bold uppercase text-violet-500">Atrelado</span>}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {selectedVehicle && (
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
                                    <div className="border-b border-blue-200 pb-2 mb-2">
                                        <p className="text-xs text-blue-600 font-bold uppercase">Veículo Selecionado</p>
                                        <p className="font-bold text-lg text-gray-800">{selectedVehicle.registroInterno}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {/* Exibição condicional V2.0 */}
                                        {getVehicleReadingType(selectedVehicle) === 'Km' ? (
                                            <div><p className="text-xs text-gray-500">Odômetro</p><p className="font-mono font-bold text-blue-700">{selectedVehicle.odometro || '0'} Km</p></div>
                                        ) : (
                                            <div><p className="text-xs text-gray-500">Horímetro</p><p className="font-mono font-bold text-orange-700">{selectedVehicle.horimetro || '0'} Hr</p></div>
                                        )}
                                    </div>
                                </div>

                                {vehicleAlerts.length > 0 && (
                                    <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r text-sm space-y-1">
                                        <h4 className="font-bold text-red-700 flex items-center gap-1"><AlertTriangle size={14}/> Restrições</h4>
                                        {vehicleAlerts.map((alert, index) => <p key={index} className="text-red-600">{alert.message}</p>)}
                                    </div>
                                )}
                                
                                <div className="pt-2 space-y-2">
                                    <button onClick={() => setShowHistoryModal(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 shadow-sm text-sm"><History size={16} /> Histórico Veículo</button>
                                    <button onClick={handleGenerateOSCroqui} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 shadow-sm text-sm"><Printer size={16} /> Baixar Ficha Croqui</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-md border lg:col-span-2">
                        {selectedVehicle ? (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-lg text-gray-700">Mapa de Pneus</h3>
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded border">Visualização Esquemática</span>
                                </div>

                                {getTireLayout(selectedVehicle.tipo).length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {getTireLayout(selectedVehicle.tipo).map(pos => {
                                            const installedTire = vehicleTires.find(t => t.position === pos);
                                            return (
                                                <div key={pos} className={`p-3 rounded-lg border flex justify-between items-center ${installedTire ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-dashed'}`}>
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-500 uppercase block">{pos}</span>
                                                        {installedTire ? (
                                                            <div><p className="font-bold text-lg text-gray-800">{installedTire.fireNumber}</p><p className="text-xs text-gray-600">{installedTire.brand} - {installedTire.size}</p></div>
                                                        ) : <span className="text-sm text-gray-400 italic">Vazio</span>}
                                                    </div>
                                                    <div>
                                                        {!isViewer && (
                                                            installedTire ? (
                                                                <button onClick={() => { setTransactionType('remove'); setSelectedPosition(pos); setSelectedTireForTransaction(installedTire); setShowTransactionModal(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Remover Pneu"><ArrowRight size={18} /></button>
                                                            ) : (
                                                                <button onClick={() => { setTransactionType('install'); setSelectedPosition(pos); setShowTransactionModal(true); }} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="Instalar Pneu"><ArrowLeft size={18} /></button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-10 text-center text-gray-500">Este veículo não utiliza pneus (Esteira).</div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20"><Truck size={48} className="mb-2" /><p>Selecione um veículo à esquerda para gerenciar os pneus.</p></div>
                        )}
                    </div>
                </div>
            )}

            {/* --- ABA RELATÓRIOS --- */}
            {activeTab === 'reports' && (
                <div className="bg-white p-6 rounded-lg shadow-md border max-w-3xl mx-auto">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText /> Gerador de Relatório de Pneus</h2>
                    {/* Filtros e botão de gerar... (Mantido igual) */}
                    <div className="flex justify-center mt-4">
                         <button onClick={handleGenerateReport} className="w-full py-3 mak-btn mak-btn-dark">Gerar Relatório PDF</button>
                    </div>
                </div>
            )}

            {/* MODAIS */}
            {showNewTireModal && <NewTireModal onClose={() => setShowNewTireModal(false)} onSave={async (data) => { try { await apiClient.createTire(data); setAlertMessage('Pneu cadastrado!'); loadTires(); setShowNewTireModal(false); } catch (e) { setAlertMessage(e.message || 'Erro ao salvar.'); } }} />}
            
            {showStockActionModal && selectedTireForAction && (
                <StockActionModal 
                    tire={selectedTireForAction}
                    employees={employees} 
                    obras={obras} 
                    onClose={() => { setShowStockActionModal(false); setSelectedTireForAction(null); }} 
                    onSave={async (data) => { 
                        try { 
                            await apiClient.registerTireTransaction(data); 
                            setAlertMessage('Movimentação realizada!');
                            if (data.type === 'transfer') {
                                handleGenerateSpareTermPDF({ ...data, ...selectedTireForAction });
                            }
                            loadTires(); 
                            setShowStockActionModal(false); 
                        } catch (e) { setAlertMessage(e.message); } 
                    }} 
                />
            )}

            {showEditTireModal && selectedTireForAction && (
                <EditTireModal tire={selectedTireForAction} onClose={() => setShowEditTireModal(false)} onSave={async (data) => { try { await apiClient.updateTire(selectedTireForAction.id, data); setAlertMessage('Atualizado!'); loadTires(); setShowEditTireModal(false); } catch (e) { setAlertMessage(e.message); } }} />
            )}

            {showTransactionModal && (
                <TireTransactionModal 
                    type={transactionType} 
                    vehicle={selectedVehicle} 
                    position={selectedPosition} 
                    tire={selectedTireForTransaction} 
                    stockTires={availableStockTires} 
                    vehicleAlerts={vehicleAlerts} 
                    onClose={() => { setShowTransactionModal(false); setSelectedTireForTransaction(null); }} 
                    onSave={async (data) => { 
                        try { 
                            await apiClient.registerTireTransaction(data); 
                            setAlertMessage('Movimentação realizada!'); 
                            loadTires(); 
                            reloadData(); 
                            setShowTransactionModal(false); 
                            setSelectedTireForTransaction(null); 
                        } catch (e) { setAlertMessage(e.message || 'Erro na movimentação.'); } 
                    }} 
                    PasswordConfirmationModal={PasswordConfirmationModal} 
                />
            )}

            {showHistoryModal && selectedVehicle && <VehicleTireHistoryModal vehicle={selectedVehicle} apiClient={apiClient} onClose={() => setShowHistoryModal(false)} />}
            {tireHistoryId && <SingleTireHistoryModal tireId={tireHistoryId} apiClient={apiClient} onClose={() => setTireHistoryId(null)} />}
            
            {showSpareTireModal && <SpareTireModal stockTires={availableStockTires} employees={employees} obras={obras} onClose={() => setShowSpareTireModal(false)} onSave={async (data) => { try { await apiClient.registerTireTransaction({ ...data, type: 'transfer' }); setAlertMessage('Step enviado! Gerando termo...'); const t = availableStockTires.find(x => x.id === data.tireId); if(t) handleGenerateSpareTermPDF({...data, ...t}); loadTires(); setShowSpareTireModal(false); } catch (e) { setAlertMessage(e.message); } }} />}
        </div>
    );
};

// --- MODAL DE TRANSAÇÃO (INSTALAR/REMOVER) - REFATORADO V2.0 ---
const TireTransactionModal = ({ type, vehicle, position, tire, stockTires, onClose, onSave }) => {
    // Lógica estrita de grupos
    const isKmVehicle = ['Veículos Leves', 'Caminhões de Trecho', 'Automóvel', 'Camionete', 'Caminhão Prancha'].includes(vehicle.tipo);
    const readingType = isKmVehicle ? 'odometro' : 'horimetro';

    const [formData, setFormData] = useState({
        tireId: tire ? tire.id : '', 
        vehicleId: vehicle.id, 
        type: type, 
        position: position,
        date: new Date().toISOString().split('T')[0], 
        odometer: isKmVehicle ? (vehicle.odometro || '') : '', 
        horimeter: !isKmVehicle ? (vehicle.horimetro || '') : '', 
        observation: ''
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-2">{type === 'install' ? 'Instalar Pneu' : 'Remover Pneu'}</h3>
                <p className="text-sm text-gray-600 mb-4">{vehicle.placa} - {position}</p>
                <div className="space-y-3">
                    {type === 'install' ? (
                        <div><label className="block text-sm font-bold mb-1">Selecionar Pneu do Estoque</label><SearchableSelect items={stockTires} value={formData.tireId} onChange={item => setFormData({...formData, tireId: item?.id || ''})} getLabel={t => `${t.fireNumber} - ${t.brand}`} getSubLabel={t => t.size || ''} placeholder="-- Selecione --" /></div>
                    ) : <div className="p-3 bg-red-50 font-bold text-red-800 border border-red-200 rounded">Removendo: {tire?.fireNumber}</div>}
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold mb-1">Data</label>
                            <input type="date" className="w-full p-2 border rounded" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                        {/* INPUT CONDICIONAL ÚNICO */}
                        {isKmVehicle ? (
                             <div className="col-span-2">
                                <label className="block text-sm font-bold mb-1 text-blue-800">Odômetro Atual (Km)</label>
                                <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" value={formData.odometer} onChange={e => setFormData({...formData, odometer: e.target.value})} placeholder="Ex: 150000" />
                            </div>
                        ) : (
                             <div className="col-span-2">
                                <label className="block text-sm font-bold mb-1 text-orange-800">Horímetro Atual (Hr)</label>
                                <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-orange-500" value={formData.horimeter} onChange={e => setFormData({...formData, horimeter: e.target.value})} placeholder="Ex: 5000.5" />
                            </div>
                        )}
                    </div>
                    <div><label className="block text-sm font-bold mb-1">Observação</label><textarea className="w-full p-2 border rounded" value={formData.observation} onChange={e => setFormData({...formData, observation: e.target.value})}></textarea></div>
                </div>
                <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button><button onClick={() => onSave(formData)} className={`px-4 py-2 text-white rounded ${type === 'install' ? 'bg-green-600' : 'bg-red-600'}`} disabled={type === 'install' && !formData.tireId}>Confirmar</button></div>
            </div>
        </div>
    );
};

// --- OUTROS MODAIS SIMPLES (NewTire, EditTire, StockAction, History...) ---
const NewTireModal = ({ onClose, onSave }) => {
    const [data, setData] = useState({ fireNumber: '', brand: '', model: '', size: '', tireCondition: 'Novo', purchaseDate: '', price: '' });
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4">Cadastrar Novo Pneu</h3>
                <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
                    <div className="space-y-3">
                        <input required placeholder="Marca de Fogo" className="w-full p-2 border rounded" value={data.fireNumber} onChange={e => setData({...data, fireNumber: e.target.value})} />
                        <input required placeholder="Marca" className="w-full p-2 border rounded" value={data.brand} onChange={e => setData({...data, brand: e.target.value})} />
                        <input placeholder="Modelo" className="w-full p-2 border rounded" value={data.model} onChange={e => setData({...data, model: e.target.value})} />
                        <input required placeholder="Medida" className="w-full p-2 border rounded" value={data.size} onChange={e => setData({...data, size: e.target.value})} />
                        <select className="w-full p-2 border rounded" value={data.tireCondition} onChange={e => setData({...data, tireCondition: e.target.value})}><option value="Novo">Novo</option><option value="Usado">Usado</option><option value="Recapado">Recapado</option></select>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" className="w-full p-2 border rounded" value={data.purchaseDate} onChange={e => setData({...data, purchaseDate: e.target.value})} />
                            <input type="number" placeholder="Preço (R$)" className="w-full p-2 border rounded" value={data.price} onChange={e => setData({...data, price: e.target.value})} />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button></div>
                </form>
            </div>
        </div>
    );
};

const EditTireModal = ({ tire, onClose, onSave }) => {
    const [data, setData] = useState({ brand: tire.brand, model: tire.model, size: tire.size, tireCondition: tire.tireCondition });
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4">Editar Pneu: {tire.fireNumber}</h3>
                <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
                    <div className="space-y-3">
                        <input required placeholder="Marca" className="w-full p-2 border rounded" value={data.brand} onChange={e => setData({...data, brand: e.target.value})} />
                        <input placeholder="Modelo" className="w-full p-2 border rounded" value={data.model} onChange={e => setData({...data, model: e.target.value})} />
                        <input required placeholder="Medida" className="w-full p-2 border rounded" value={data.size} onChange={e => setData({...data, size: e.target.value})} />
                        <select className="w-full p-2 border rounded" value={data.tireCondition} onChange={e => setData({...data, tireCondition: e.target.value})}><option value="Novo">Novo</option><option value="Usado">Usado</option><option value="Recapado">Recapado</option></select>
                    </div>
                    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button></div>
                </form>
            </div>
        </div>
    );
};

const StockActionModal = ({ tire, employees, obras, onClose, onSave }) => {
    const [actionType, setActionType] = useState(tire.status === 'Step/Reserva' ? 'restock' : 'transfer'); 
    const [formData, setFormData] = useState({ employeeId: '', obraId: '', vendorName: '', observation: '' });
    const handleSubmit = (e) => {
        e.preventDefault();
        const employee = employees.find(e => e.id === formData.employeeId);
        const obra = obras.find(o => o.id === formData.obraId);
        onSave({ 
            tireId: tire.id, type: actionType, employeeName: employee?.nome || '', obraName: formatObraNome(obra) || '',
            vendorName: formData.vendorName, observation: formData.observation, date: new Date().toISOString().split('T')[0]
        });
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4">Movimentar Pneu: {tire.fireNumber}</h3>
                <div className="flex gap-2 mb-4 flex-wrap">
                    {tire.status !== 'Step/Reserva' && <button type="button" onClick={() => setActionType('transfer')} className={`px-3 py-1 rounded text-sm ${actionType === 'transfer' ? 'bg-orange-600 text-white' : 'bg-gray-200'}`}>Step/Reserva</button>}
                    <button type="button" onClick={() => setActionType('maintenance')} className={`px-3 py-1 rounded text-sm ${actionType === 'maintenance' ? 'bg-[#9E7A42] text-white' : 'bg-gray-200'}`}>Recapagem</button>
                    <button type="button" onClick={() => setActionType('scrap')} className={`px-3 py-1 rounded text-sm ${actionType === 'scrap' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>Sucata</button>
                    {tire.status !== 'Estoque' && <button type="button" onClick={() => setActionType('restock')} className={`px-3 py-1 rounded text-sm ${actionType === 'restock' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Devolver Estoque</button>}
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-3">
                        {actionType === 'transfer' && (
                            <>
                                <div className="p-2 bg-orange-50 text-orange-800 text-xs rounded">Ao confirmar, será gerado um Termo de Responsabilidade PDF.</div>
                                <div><label className="block text-sm font-bold mb-1">Funcionário</label><SearchableSelect items={employees} value={formData.employeeId} onChange={item => setFormData({...formData, employeeId: item?.id || ''})} getLabel={e => e.nome} getSubLabel={e => e.profissao || ''} placeholder="-- Selecione --" required /></div>
                                <div><label className="block text-sm font-bold mb-1">Obra</label><SearchableSelect items={obras.filter(o => ['ativa', 'mobilizacao'].includes(o.status)).map(o => ({...o, _displayNome: `${formatObraNome(o)}${o.tipo_registro === 'centro_custo' ? ' (CC)' : ''}`}))} value={formData.obraId} onChange={item => setFormData({...formData, obraId: item?.id || ''})} getLabel={o => o._displayNome || o.nome} placeholder="-- Selecione --" required /></div>
                            </>
                        )}
                        {actionType === 'maintenance' && <div><label className="block text-sm font-bold mb-1">Fornecedor</label><input required className="w-full p-2 border rounded" value={formData.vendorName} onChange={e => setFormData({...formData, vendorName: e.target.value})} placeholder="Nome do fornecedor" /></div>}
                        <div><label className="block text-sm font-bold mb-1">Observação</label><textarea className="w-full p-2 border rounded" rows="3" value={formData.observation} onChange={e => setFormData({...formData, observation: e.target.value})}></textarea></div>
                    </div>
                    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Confirmar</button></div>
                </form>
            </div>
        </div>
    );
};

const SpareTireModal = ({ stockTires, employees, obras, onClose, onSave }) => {
    const [formData, setFormData] = useState({ tireId: '', employeeId: '', obraId: '', observation: '' });
    const handleSubmit = (e) => { 
        e.preventDefault(); 
        const employee = employees.find(e => e.id === formData.employeeId);
        const obra = obras.find(o => o.id === formData.obraId);
        onSave({ ...formData, employeeName: employee?.nome || 'N/A', obraName: formatObraNome(obra) || 'N/A', date: new Date().toISOString().split('T')[0] });
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4">Enviar Step/Reserva (Rápido)</h3>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-3">
                        <div><label className="block text-sm font-bold mb-1">Pneu</label><SearchableSelect items={stockTires} value={formData.tireId} onChange={item => setFormData({...formData, tireId: item?.id || ''})} getLabel={t => `${t.fireNumber} - ${t.brand}`} placeholder="-- Selecione --" required /></div>
                        <div><label className="block text-sm font-bold mb-1">Funcionário</label><SearchableSelect items={employees} value={formData.employeeId} onChange={item => setFormData({...formData, employeeId: item?.id || ''})} getLabel={e => e.nome} getSubLabel={e => e.profissao || ''} placeholder="-- Selecione --" required /></div>
                        <div><label className="block text-sm font-bold mb-1">Obra</label><SearchableSelect items={obras.filter(o => ['ativa', 'mobilizacao'].includes(o.status)).map(o => ({...o, _displayNome: `${formatObraNome(o)}${o.tipo_registro === 'centro_custo' ? ' (CC)' : ''}`}))} value={formData.obraId} onChange={item => setFormData({...formData, obraId: item?.id || ''})} getLabel={o => o._displayNome || o.nome} placeholder="-- Selecione --" required /></div>
                        <div><label className="block text-sm font-bold mb-1">Obs</label><textarea className="w-full p-2 border rounded" rows="3" value={formData.observation} onChange={e => setFormData({...formData, observation: e.target.value})}></textarea></div>
                    </div>
                    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button><button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded">Enviar</button></div>
                </form>
            </div>
        </div>
    );
};

const SingleTireHistoryModal = ({ tireId, apiClient, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { apiClient.getTireHistory(tireId).then(data => setHistory(data || [])).finally(() => setLoading(false)); }, [tireId, apiClient]);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between"><h3 className="font-bold">Histórico do Pneu</h3><button onClick={onClose}><X size={18}/></button></div>
                <div className="p-4 flex-1 overflow-y-auto space-y-2">{loading ? "Carregando..." : history.map(h => <div key={h.id} className="p-2 border rounded bg-gray-50 text-sm"><p className="font-bold">{new Date(h.date).toLocaleDateString()} - {h.type}</p><p>{h.observation}</p></div>)}</div>
            </div>
        </div>
    );
};

const VehicleTireHistoryModal = ({ vehicle, apiClient, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { apiClient.getVehicleTireHistory(vehicle.id).then(data => setHistory(data || [])).finally(() => setLoading(false)); }, [vehicle, apiClient]);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between"><h3 className="font-bold">Histórico Veículo: {vehicle.registroInterno}</h3><button onClick={onClose}><X size={18}/></button></div>
                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                    {loading ? <p className="text-center">Carregando...</p> : history.map(h => (
                        <div key={h.id} className="p-3 border rounded bg-gray-50 text-sm">
                            <div className="flex justify-between"><span className={`font-bold ${h.type==='install'?'text-green-700':'text-red-700'}`}>{h.type==='install'?'Entrada':'Saída'}</span><span>{new Date(h.date).toLocaleDateString()}</span></div>
                            <p>Pneu: {h.fireNumber} | Pos: {h.position}</p>
                            {/* Ajustado para exibir leitura genérica se o campo específico não existir, apenas fallback visual */}
                            <p>Leitura: {h.odometer || h.horimeter || '-'} | {h.observation}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TiresPage;



