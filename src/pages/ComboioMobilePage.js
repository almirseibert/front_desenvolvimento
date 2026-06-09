import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Droplet, ArrowUpCircle, ArrowDownCircle, RefreshCw,
    LogOut, Lock, Loader, Clock
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import ComboioEntradaModal from '../components/modals/ComboioEntradaModal';
import ComboioSaidaModal from '../components/modals/ComboioSaidaModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { getAllowedReadingTypes } from '../utils/vehicleRules';
import { useEnsureResources } from '../contexts/DataContext';

// ─── PDF (mesma lógica do ComboioPage.js) ─────────────────────────────────────
const generateAuthorizationPDF = (orderData, vehicles = [], partners = [], employees = [], vehicleGroups = {}) => {
    const isValidDbDate = (d) => {
        if (!d) return false;
        const s = String(d);
        return s.length > 5 && !s.startsWith('0000') && s !== '1970-01-01T00:00:00.000Z';
    };
    const formatDateSafe = (dateInput) => {
        if (!isValidDbDate(dateInput)) return 'N/A';
        try {
            let date;
            if (dateInput && typeof dateInput.toDate === 'function') {
                date = dateInput.toDate();
            } else {
                let s = String(dateInput);
                if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
                date = new Date(s);
            }
            if (isNaN(date.getTime())) return 'Data Inválida';
            return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).toLocaleDateString('pt-BR');
        } catch { return 'Erro'; }
    };

    const buildPdf = (logoDataUrl) => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const effectivePageHeight = 148.5;
        const margin = 10;

        let vehicleId, partnerId;
        if (orderData.isEntrada || orderData.type === 'entrada') {
            vehicleId = orderData.comboioVehicleId || orderData.vehicleId;
            partnerId = orderData.partnerId;
        } else {
            vehicleId = orderData.receivingVehicleId || orderData.vehicleId;
            partnerId = null;
        }

        const vehicle = vehicles.find(v => v.id === vehicleId);
        const partner = partners.find(p => p.id === partnerId);
        const employee = employees.find(e => e.id === orderData.employeeId);
        const dateToUse = orderData.data || orderData.date;

        if (logoDataUrl) {
            try { doc.addImage(logoDataUrl, 'PNG', margin, 10, 45, 16.875); } catch (e) { /* ignora */ }
        }

        doc.setFontSize(16);
        doc.text('Autorização de Abastecimento', pageWidth - margin, 15, { align: 'right' });
        doc.setFontSize(12);
        doc.text(`Nº: ${String(orderData.authNumber || '0').padStart(6, '0')}`, pageWidth - margin, 22, { align: 'right' });

        let leituraLabel = 'Leitura';
        let leituraValue = 'N/A';
        if (orderData.odometro && orderData.odometro > 0) {
            leituraLabel = 'Odômetro'; leituraValue = orderData.odometro;
        } else if (orderData.horimetro && orderData.horimetro > 0) {
            leituraLabel = 'Horímetro'; leituraValue = orderData.horimetro;
        } else if (vehicle) {
            const allowed = getAllowedReadingTypes(vehicle.tipo);
            if (allowed.includes('odometro')) {
                leituraLabel = 'Odômetro'; leituraValue = vehicle.odometro || 'N/A';
            } else {
                leituraLabel = 'Horímetro'; leituraValue = vehicle.horimetro || 'N/A';
            }
        }

        const body = [
            ['Data de Emissão', formatDateSafe(dateToUse)],
            ['Funcionário Autorizado', employee?.nome || 'Não especificado'],
            ['Veículo Autorizado', `${vehicle?.registroInterno || 'N/A'} - ${vehicle?.placa || 'N/A'}`],
            ['Modelo', `${vehicle?.marca || ''} ${vehicle?.modelo || ''}`.trim() || 'N/A'],
            [leituraLabel, `${leituraValue}`],
            ['Posto Autorizado', orderData.partnerName || partner?.razaoSocial || (orderData.type === 'saida' ? 'Comboio Interno' : 'N/A')],
            ['Combustível Autorizado', orderData.fuelType === 'dieselS10' ? 'Diesel S10' : (orderData.fuelType === 'dieselComum' ? 'Diesel Comum' : orderData.fuelType) || 'N/A'],
            ['Litros Liberados', `${parseFloat(orderData.litrosAbastecidos || orderData.liters || 0).toFixed(2)} L`],
        ];
        if (orderData.invoiceNumber) body.push(['Nota Fiscal (NF)', orderData.invoiceNumber]);

        let issuer = 'N/A';
        if (orderData.createdBy) {
            issuer = typeof orderData.createdBy === 'string'
                ? orderData.createdBy
                : orderData.createdBy.nome || orderData.createdBy.name || orderData.createdBy.userEmail || 'Usuário do Sistema';
        }
        body.push(['Emitido por', issuer]);

        autoTable(doc, {
            startY: 35, body, theme: 'striped',
            styles: { fontSize: 9, cellPadding: 1.5 },
            headStyles: { fillColor: [24, 49, 83] },
            columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } }
        });

        const finalY = (doc.lastAutoTable?.finalY || 35) + 10;
        const footerStartY = Math.max(finalY, effectivePageHeight - 20);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('*A presente ordem de abastecimento é válida exclusivamente para a placa/RE indicada e para o tipo de combustível previamente autorizado.', margin, footerStartY);
        doc.text('*Estão autorizados somente os itens discriminados acima.', margin, footerStartY + 4);
        doc.setLineDashPattern([1, 1], 0);
        doc.setDrawColor(180, 180, 180);
        doc.line(0, effectivePageHeight, pageWidth, effectivePageHeight);
        doc.save(`Autorizacao_${orderData.authNumber || 'TEMP'}_${vehicle?.registroInterno || 'VEIC'}.pdf`);
    };

    const logo = new Image();
    logo.crossOrigin = 'Anonymous';
    logo.src = 'https://i.postimg.cc/pVnwyfRq/MAK-Servi-os-Logotipo.png';
    logo.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = logo.width; canvas.height = logo.height;
            canvas.getContext('2d').drawImage(logo, 0, 0);
            buildPdf(canvas.toDataURL('image/png'));
        } catch { buildPdf(null); }
    };
    logo.onerror = () => buildPdf(null);
};

// ─── Barra de Combustível ─────────────────────────────────────────────────────
const FuelBar = ({ label, liters, capacity, colorClass }) => {
    const pct = capacity > 0 ? Math.min((liters / capacity) * 100, 100) : 0;
    return (
        <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-gray-300">{label}</span>
                <span className="text-white font-mono">
                    {liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                    &nbsp;/&nbsp;
                    {capacity.toLocaleString('pt-BR')} L
                </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-[11px] text-gray-400 mt-0.5">{pct.toFixed(1)}%</div>
        </div>
    );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const ComboioMobilePage = ({
    apiClient,
    user,
    comboio: initialComboio,
    vehicles = [],
    obras = [],
    employees = [],
    partners = [],
    expenses = [],
    setAlertMessage,
    socket,
    PasswordConfirmationModal,
    onVoltar,
}) => {
    useEnsureResources(['expenses']);

    const [comboio, setComboio] = useState(initialComboio);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showEntrada, setShowEntrada] = useState(false);
    const [showSaida, setShowSaida] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [allTxns, allVehicles] = await Promise.all([
                apiClient.getComboioTransactions(),
                apiClient.getVehicles(),
            ]);
            const myTxns = allTxns.filter(t => t.comboioVehicleId === initialComboio.id);
            setTransactions(myTxns.sort((a, b) => new Date(b.date) - new Date(a.date)));
            const fresh = allVehicles.find(v => v.id === initialComboio.id);
            if (fresh) setComboio(fresh);
        } catch (e) {
            console.error('[ComboioMobilePage] fetchData:', e);
        } finally {
            setLoading(false);
        }
    }, [apiClient, initialComboio.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!socket) return;
        socket.on('server:sync', fetchData);
        return () => socket.off('server:sync', fetchData);
    }, [socket, fetchData]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    const fuelLevels = comboio.fuelLevels || {};
    const capacity = comboio.fuelCapacity || 2000;

    const recentTxns = useMemo(() => transactions.slice(0, 30), [transactions]);

    const formatTxDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="bg-gray-900 text-white px-4 pt-6 pb-10 relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
                    <Droplet size={180} />
                </div>

                <div className="flex justify-between items-start mb-5 relative z-10">
                    <div className="overflow-hidden">
                        {onVoltar && (
                            <button
                                onClick={onVoltar}
                                className="flex items-center gap-1 text-gray-400 hover:text-white text-xs mb-2 transition"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                                Voltar
                            </button>
                        )}
                        <h1 className="text-xl font-bold truncate">Olá, {user.name.split(' ')[0]}</h1>
                        <p className="text-gray-400 text-sm">Operador de Comboio</p>
                        <p className="text-yellow-400 text-xs font-mono mt-0.5">
                            {comboio.registroInterno} · {comboio.modelo || ''}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center shrink-0">
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition"
                            title="Alterar Senha"
                        >
                            <Lock size={20} />
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition"
                            title="Atualizar"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 shadow-sm"
                            title="Sair"
                        >
                            <LogOut size={18} />
                            <span className="text-xs font-bold hidden sm:inline">SAIR</span>
                        </button>
                    </div>
                </div>

                {/* Barras de combustível */}
                <div className="relative z-10">
                    <FuelBar
                        label="Diesel S10"
                        liters={fuelLevels.dieselS10 || 0}
                        capacity={capacity}
                        colorClass="bg-blue-500"
                    />
                    <FuelBar
                        label="Diesel Comum"
                        liters={fuelLevels.dieselComum || 0}
                        capacity={capacity}
                        colorClass="bg-green-500"
                    />
                </div>
            </div>

            {/* ── Botões de ação ─────────────────────────────────────────── */}
            <div className="px-4 -mt-5 relative z-20 flex gap-3">
                <button
                    onClick={() => setShowEntrada(true)}
                    className="flex-1 py-5 bg-blue-600 text-white font-bold rounded-2xl shadow-lg flex flex-col items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95"
                >
                    <ArrowUpCircle size={28} />
                    <span className="text-sm tracking-wide">+ ENTRADA</span>
                </button>
                <button
                    onClick={() => setShowSaida(true)}
                    className="flex-1 py-5 bg-yellow-400 text-gray-900 font-bold rounded-2xl shadow-lg flex flex-col items-center justify-center gap-2 hover:bg-yellow-300 transition active:scale-95"
                >
                    <ArrowDownCircle size={28} />
                    <span className="text-sm tracking-wide">− ABASTECER</span>
                </button>
            </div>

            {/* ── Histórico de transações ────────────────────────────────── */}
            <div className="px-4 mt-6 pb-10">
                <h2 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                    <Clock size={13} /> Transações Recentes
                </h2>

                {loading && transactions.length === 0 ? (
                    <div className="flex justify-center py-10">
                        <Loader size={28} className="animate-spin text-yellow-500" />
                    </div>
                ) : recentTxns.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
                        <p className="text-gray-400 text-sm">Nenhuma transação registrada.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {recentTxns.map(t => {
                            const isEntrada = t.type === 'entrada';
                            const partnerName = isEntrada
                                ? (partners.find(p => p.id === t.partnerId)?.razaoSocial || 'Fornecedor')
                                : null;
                            const receivingVehicle = !isEntrada
                                ? vehicles.find(v => v.id === t.receivingVehicleId)
                                : null;

                            return (
                                <div
                                    key={t.id}
                                    className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3"
                                    style={{ border: '1px solid #f0ebe3' }}
                                >
                                    <div className={`p-2 rounded-full shrink-0 ${isEntrada ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {isEntrada ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="font-bold text-sm text-gray-800 truncate">
                                                {isEntrada
                                                    ? partnerName
                                                    : (receivingVehicle
                                                        ? `${receivingVehicle.registroInterno} · ${receivingVehicle.modelo || ''}`
                                                        : 'Saída')
                                                }
                                            </span>
                                            <span className="text-xs font-mono text-gray-700 shrink-0 font-bold">
                                                {parseFloat(t.liters || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${t.fuelType === 'dieselS10' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                {t.fuelType === 'dieselS10' ? 'S10' : 'Comum'}
                                            </span>
                                            <span className="text-[10px] text-gray-400">{formatTxDate(t.date)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Modais ─────────────────────────────────────────────────── */}
            {showEntrada && (
                <ComboioEntradaModal
                    user={user}
                    comboioVehicle={comboio}
                    partners={partners}
                    employees={employees}
                    obras={obras}
                    onClose={() => setShowEntrada(false)}
                    setAlertMessage={setAlertMessage}
                    apiClient={apiClient}
                    generateAuthorizationPDF={generateAuthorizationPDF}
                    reloadData={fetchData}
                    comboioTransactions={transactions}
                />
            )}

            {showSaida && (
                <ComboioSaidaModal
                    user={user}
                    comboioVehicle={comboio}
                    vehicles={vehicles}
                    obras={obras}
                    employees={employees}
                    expenses={expenses}
                    onClose={() => setShowSaida(false)}
                    setAlertMessage={setAlertMessage}
                    apiClient={apiClient}
                    reloadData={fetchData}
                    PasswordConfirmationModal={PasswordConfirmationModal}
                />
            )}

            {showPasswordModal && (
                <ChangePasswordModal
                    isOpen={showPasswordModal}
                    onClose={() => setShowPasswordModal(false)}
                />
            )}
        </div>
    );
};

export default ComboioMobilePage;
