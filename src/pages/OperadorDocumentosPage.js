import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Loader, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';

/**
 * Página do operador: lista os PDFs (Documentos) dos veículos que estão
 * atualmente na(s) obra(s) do operador logado. Somente leitura / download.
 *
 * Backend: GET /api/vehicles/meus-documentos (escopo resolvido pelo employeeId
 * do usuário via alocação ativa em obras_historico_veiculos).
 */
const OperadorDocumentosPage = ({ apiClient, user, setAlertMessage, onVoltar }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState(null);

    const baseURL = useMemo(() => {
        const b = apiClient?.defaults?.baseURL || '';
        return b.replace(/\/api\/?$/, '');
    }, [apiClient]);

    const carregar = useCallback(async () => {
        setLoading(true);
        setErro(null);
        try {
            const data = await apiClient.getMeusDocumentos();
            setDocs(Array.isArray(data) ? data : []);
        } catch (e) {
            setErro(e.message || 'Falha ao carregar documentos.');
            if (setAlertMessage) setAlertMessage('Falha ao carregar documentos: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [apiClient, setAlertMessage]);

    useEffect(() => { carregar(); }, [carregar]);

    // Agrupa por veículo
    const grupos = useMemo(() => {
        const map = new Map();
        for (const d of docs) {
            const key = d.vehicle_id;
            if (!map.has(key)) {
                map.set(key, {
                    vehicleId: key,
                    placa: d.placa,
                    modelo: d.modelo,
                    registroInterno: d.registroInterno,
                    obraNome: d.obra_nome,
                    itens: []
                });
            }
            map.get(key).itens.push(d);
        }
        return Array.from(map.values());
    }, [docs]);

    const abrirPdf = (url) => {
        const full = url?.startsWith('http') ? url : `${baseURL}${url}`;
        window.open(full, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="min-h-screen" style={{ background: '#f5f3ef' }}>
            {/* Header */}
            <div className="bg-gray-900 text-white px-4 pt-6 pb-8 rounded-b-[2rem] shadow-xl">
                <div className="flex justify-between items-start">
                    <div>
                        {onVoltar && (
                            <button onClick={onVoltar} className="flex items-center gap-1 text-gray-400 hover:text-white text-xs mb-2 transition">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                                Voltar
                            </button>
                        )}
                        <h1 className="text-xl font-bold flex items-center gap-2"><FileText size={22} /> Documentos</h1>
                        <p className="text-gray-400 text-sm">PDFs dos veículos da sua obra</p>
                    </div>
                    <button onClick={carregar} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition" title="Atualizar">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Conteúdo */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <Loader className="animate-spin mb-2" size={28} />
                        <p className="text-sm">Carregando documentos...</p>
                    </div>
                ) : erro ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
                        <AlertTriangle size={18} /> {erro}
                    </div>
                ) : grupos.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                        <FileText size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhum documento PDF disponível para os veículos da sua obra.</p>
                    </div>
                ) : (
                    grupos.map(g => (
                        <div key={g.vehicleId} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b">
                                <p className="font-bold text-gray-800 text-sm">
                                    {g.registroInterno ? `${g.registroInterno} · ` : ''}{g.modelo || 'Veículo'}
                                    {g.placa ? <span className="text-gray-500 font-mono ml-1">({g.placa})</span> : null}
                                </p>
                                {g.obraNome && <p className="text-[11px] text-gray-400">Obra: {g.obraNome}</p>}
                            </div>
                            <div className="divide-y">
                                {g.itens.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => abrirPdf(d.url)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                                    >
                                        <div className="p-2 bg-red-50 text-red-500 rounded-lg shrink-0">
                                            <FileText size={18} />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm font-medium text-gray-800 truncate">{d.nome}</p>
                                            <p className="text-[11px] text-gray-400">{d.tipo || 'Documento'}</p>
                                        </div>
                                        <ExternalLink size={16} className="text-gray-400 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default OperadorDocumentosPage;
