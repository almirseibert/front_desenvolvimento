import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    Wifi, WifiOff, RefreshCw, Loader, Smartphone,
    Send, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import apiClient from '../services/apiClient';

const STATUS_CFG = {
    PRONTO:          { label: 'Conectado',        cor: 'green',  Icon: Wifi       },
    AUTENTICANDO:    { label: 'Carregando Dados…',cor: 'yellow', Icon: Loader     },
    AUTENTICADO:     { label: 'Autenticando…',    cor: 'yellow', Icon: Loader     },
    QR_PRONTO:       { label: 'Aguardando QR',    cor: 'yellow', Icon: Smartphone },
    DESCONECTADO:    { label: 'Desconectado',     cor: 'red',    Icon: WifiOff    },
    NAO_CONFIGURADO: { label: 'Não configurado',  cor: 'red',    Icon: WifiOff    },
};

const COR = { green: 'bg-green-100 text-green-800', yellow: 'bg-yellow-100 text-yellow-800', red: 'bg-red-100 text-red-800' };

const Badge = ({ status }) => {
    // Fallback mapeia qualquer status não conhecido para DESCONECTADO visualmente
    const cfg = STATUS_CFG[status] || STATUS_CFG.DESCONECTADO;
    const { label, cor, Icon } = cfg;
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${COR[cor]}`}>
            <Icon size={16} className={cor === 'yellow' ? 'animate-spin' : ''} />
            {label}
        </span>
    );
};

const WhatsAppStatusPanel = () => {
    const [statusData, setStatusData] = useState({ status: 'DESCONECTADO', qr: null });
    const [loading, setLoading] = useState(true);
    const [restarting, setRestarting] = useState(false);

    const [testNumber, setTestNumber] = useState('');
    const [testMessage, setTestMessage] = useState('Teste de conexão Frotas MAK');
    const [sendingTest, setSendingTest] = useState(false);
    
    const [logs, setLogs] = useState([]);
    const [showLogs, setShowLogs] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await apiClient.get('/whatsapp/status');
            const payload = res?.status ? res : (res?.data || { status: 'DESCONECTADO', qr: null });
            
            // Atualiza o estado
            setStatusData(payload);
        } catch (error) {
            console.error('Erro ao consultar status WA:', error);
            setStatusData(prev => ({ ...prev, status: 'DESCONECTADO' }));
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        setLoadingLogs(true);
        try {
            const res = await apiClient.get('/whatsapp/logs');
            setLogs(Array.isArray(res) ? res : (res?.data || []));
        } catch (err) {
            console.error('Erro ao buscar logs WA:', err);
        } finally {
            setLoadingLogs(false);
        }
    }, []);

    // Polling Agressivo: Se estiver aguardando QR, consulta a cada 2 segundos.
    // Isso evita que o celular escaneie um QR Code que já expirou no backend.
    useEffect(() => {
        fetchStatus(); // Busca inicial
        
        const intervalId = setInterval(() => {
            setStatusData(current => {
                if (current.status !== 'PRONTO') {
                    fetchStatus();
                }
                return current;
            });
        }, 2000); // Reduzido de 3s para 2s para garantir QR Fresco

        return () => clearInterval(intervalId);
    }, [fetchStatus]);

    useEffect(() => {
        if (showLogs) fetchLogs();
    }, [showLogs, fetchLogs]);

    const handleRestart = async () => {
        setRestarting(true);
        try {
            await apiClient.post('/whatsapp/reiniciar');
            setStatusData({ status: 'DESCONECTADO', qr: null });
        } catch (err) {
            alert('Falha ao reiniciar: ' + err.message);
        } finally {
            setTimeout(() => {
                setRestarting(false);
                fetchStatus();
            }, 3000);
        }
    };

    const handleSendTest = async (e) => {
        e.preventDefault();
        setSendingTest(true);
        try {
            await apiClient.post('/whatsapp/enviar-teste', {
                numero: testNumber,
                mensagem: testMessage
            });
            alert('Mensagem enviada com sucesso!');
            setTestNumber('');
            if (showLogs) fetchLogs();
        } catch (err) {
            alert('Falha ao enviar: ' + (err.response?.data?.error || err.message));
        } finally {
            setSendingTest(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            {/* Header / Status Geral */}
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Smartphone className="text-green-600" />
                        Serviço WhatsApp
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Status da API e conexão com a Evolution/Puppeteer</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <Badge status={statusData.status} />
                    <button
                        onClick={fetchStatus}
                        className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors border border-gray-200"
                        title="Atualizar status"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={handleRestart}
                        disabled={restarting}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200 text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                        {restarting ? 'Limpando...' : 'Limpar e Reiniciar'}
                    </button>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* LADO ESQUERDO: Renderização do QR Code */}
                <div className="flex flex-col items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6 min-h-[300px]">
                    {loading ? (
                         <div className="flex flex-col items-center text-gray-400">
                             <Loader size={32} className="animate-spin mb-3" />
                             <p>Consultando conexão...</p>
                         </div>
                    ) : statusData.status === 'QR_PRONTO' ? (
                         statusData.qr ? (
                             <div className="flex flex-col items-center animate-fade-in">
                                 <p className="text-sm font-medium text-gray-600 mb-4 text-center">
                                     Abra o WhatsApp no celular,<br/>vá em "Aparelhos Conectados" e escaneie:
                                 </p>
                                 <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                                     <QRCodeSVG value={statusData.qr} size={200} level="L" />
                                 </div>
                             </div>
                         ) : (
                             <div className="flex flex-col items-center text-yellow-600">
                                 <Loader size={32} className="animate-spin mb-3" />
                                 <p>Gerando QR Code...</p>
                             </div>
                         )
                    ) : (statusData.status === 'AUTENTICANDO' || statusData.status === 'AUTENTICADO') ? (
                         <div className="flex flex-col items-center text-yellow-600 animate-fade-in">
                             <Loader size={48} className="mb-4 animate-spin opacity-80" />
                             <p className="text-lg font-bold text-center">Sincronizando Mensagens...</p>
                             <p className="text-sm text-yellow-700/70 mt-1 text-center max-w-xs">
                                 Isso pode levar alguns minutos se houver muitas conversas no aparelho. Mantenha a tela do celular ligada.
                             </p>
                         </div>
                    ) : statusData.status === 'PRONTO' ? (
                         <div className="flex flex-col items-center text-green-600 animate-fade-in">
                             <CheckCircle size={64} className="mb-4 opacity-90" />
                             <p className="text-lg font-bold">Autenticado e Ativo</p>
                             <p className="text-sm text-green-700/70 mt-1">O sistema está pronto para disparos automáticos.</p>
                         </div>
                    ) : (
                         <div className="flex flex-col items-center text-gray-400">
                             <WifiOff size={48} className="mb-4 opacity-50" />
                             <p className="font-medium text-gray-500">Aguardando Microsserviço...</p>
                             <p className="text-xs text-center mt-2 max-w-xs">
                                 Se estiver demorando, clique em "Limpar e Reiniciar".
                             </p>
                         </div>
                    )}
                </div>

                {/* LADO DIREITO: Form de Teste */}
                <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2">
                        Envio de Teste
                    </h3>
                    <form onSubmit={handleSendTest} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Número (com DDD)
                            </label>
                            <input
                                type="text"
                                value={testNumber}
                                onChange={e => setTestNumber(e.target.value)}
                                placeholder="Ex: 51999999999"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Mensagem
                            </label>
                            <textarea
                                value={testMessage}
                                onChange={e => setTestMessage(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={sendingTest || statusData.status !== 'PRONTO'}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {sendingTest ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                            {sendingTest ? 'Enviando...' : 'Disparar Mensagem'}
                        </button>
                    </form>
                </div>
            </div>

            {/* SEÇÃO INFERIOR: Histórico de Logs */}
            <div className="border-t border-gray-200">
                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                        <Clock size={18} className="text-gray-400" />
                        Histórico de Disparos (whatsapp_logs)
                    </div>
                    {showLogs ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </button>

                {showLogs && (
                    <div className="p-4 bg-white">
                        {loadingLogs ? (
                            <div className="flex justify-center py-4"><Loader className="animate-spin text-gray-400" /></div>
                        ) : logs.length === 0 ? (
                            <p className="text-center text-sm text-gray-500 py-4">Nenhum log recente encontrado.</p>
                        ) : (
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-3 font-semibold border-b">Destinatário</th>
                                            <th className="px-4 py-3 font-semibold border-b">Número</th>
                                            <th className="px-4 py-3 font-semibold border-b">Motivo</th>
                                            <th className="px-4 py-3 font-semibold border-b">Status</th>
                                            <th className="px-4 py-3 font-semibold border-b">Data</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {logs.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-2.5 text-gray-700 font-medium text-sm">{log.destinatario_nome}</td>
                                                <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{log.destinatario_numero}</td>
                                                <td className="px-4 py-2.5 text-gray-500 text-xs">{log.motivo_envio}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${log.status === 'ENVIADO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {log.status === 'ENVIADO' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                                                    {log.data_envio ? new Date(log.data_envio).toLocaleString('pt-BR') : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppStatusPanel;