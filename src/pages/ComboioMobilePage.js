import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Droplet, ArrowUpCircle, ArrowDownCircle, RefreshCw,
    LogOut, Lock, Loader, Clock, FileText
} from 'lucide-react';

import ComboioDistribuicaoModal from '../components/modals/ComboioDistribuicaoModal';
import ChangePasswordModal from '../components/ChangePasswordModal';

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
    setAlertMessage,
    socket,
    onVoltar,
    onAbrirDocumentos,
}) => {
    const [comboio, setComboio] = useState(initialComboio);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
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
                        {onAbrirDocumentos && (
                            <button
                                onClick={onAbrirDocumentos}
                                className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition"
                                title="Documentos (PDFs)"
                            >
                                <FileText size={20} />
                            </button>
                        )}
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

            {/* ── Botão de ação ──────────────────────────────────────────── */}
            {/* Operador do comboio só distribui combustível (Abastecer). A entrada
                (carregar o comboio no posto) é feita pelo setor de frotas. */}
            <div className="px-4 -mt-5 relative z-20">
                <button
                    onClick={() => setShowSaida(true)}
                    className="w-full py-5 bg-yellow-400 text-gray-900 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 hover:bg-yellow-300 transition active:scale-95"
                >
                    <ArrowDownCircle size={28} />
                    <span className="text-base tracking-wide">ABASTECER VEÍCULO</span>
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
            {showSaida && (
                <ComboioDistribuicaoModal
                    user={user}
                    comboioVehicle={comboio}
                    vehicles={vehicles}
                    obras={obras}
                    employees={employees}
                    transactions={transactions}
                    onClose={() => setShowSaida(false)}
                    setAlertMessage={setAlertMessage}
                    apiClient={apiClient}
                    reloadData={fetchData}
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
