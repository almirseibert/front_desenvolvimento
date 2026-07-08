import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, FileText, ExternalLink, Loader2, FolderOpen } from 'lucide-react';

const BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace('/api', '');

const TIPOS_DOCUMENTO = ['CRLV', 'AET DAER', 'AET DNIT', 'Tacógrafo', 'Nota de Compra', 'Seguro', 'Licença', 'Outros'];

const tipoBadgeStyle = (tipo) => {
    const map = {
        'CRLV':          { bg: '#dbeafe', color: '#1e40af' },
        'AET DAER':      { bg: '#fef3c7', color: '#92400e' },
        'AET DNIT':      { bg: '#fde68a', color: '#78350f' },
        'Tacógrafo':     { bg: '#ede9fe', color: '#4c1d95' },
        'Nota de Compra':{ bg: '#d1fae5', color: '#065f46' },
        'Seguro':        { bg: '#fee2e2', color: '#991b1b' },
        'Licença':       { bg: '#e0f2fe', color: '#0c4a6e' },
    };
    const style = map[tipo] || { bg: '#f3f4f6', color: '#374151' };
    return { background: style.bg, color: style.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 };
};

const VehicleDocumentsModal = ({ vehicle, onClose, apiClient }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [form, setForm] = useState({ tipo: 'CRLV', nome: '' });
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    const loadDocs = async () => {
        try {
            setLoading(true);
            const data = await apiClient.getVehicleDocuments(vehicle.id);
            setDocs(data || []);
        } catch {
            setError('Erro ao carregar documentos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDocs(); }, [vehicle.id]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return setError('Selecione um arquivo.');
        setError('');
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('documentFile', file);
            formData.append('tipo', form.tipo);
            formData.append('nome', form.nome);
            await apiClient.uploadVehicleDocument(vehicle.id, formData);
            setForm({ tipo: 'CRLV', nome: '' });
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
            await loadDocs();
        } catch (err) {
            setError(err.message || 'Erro ao enviar documento.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (doc) => {
        if (!window.confirm(`Excluir o documento "${doc.nome}"?`)) return;
        setDeleting(doc.id);
        try {
            await apiClient.deleteVehicleDocument(vehicle.id, doc.id);
            setDocs(prev => prev.filter(d => d.id !== doc.id));
        } catch {
            setError('Erro ao excluir documento.');
        } finally {
            setDeleting(null);
        }
    };

    const docUrl = (doc) => `${BASE_URL}${doc.url}`;

    const fmtDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ border: '1px solid #f0ebe3' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f0ebe3' }}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: '#fdf8f0' }}>
                            <FolderOpen size={18} style={{ color: '#9E7A42' }} />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-800 text-base">Documentos do Veículo</h2>
                            <p className="text-xs text-gray-400">{vehicle.registroInterno} · {vehicle.marca} {vehicle.modelo}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={18} className="text-gray-500"/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Upload Form */}
                    <form onSubmit={handleUpload} className="p-4 rounded-xl space-y-3" style={{ background: '#faf9f7', border: '1px solid #f0ebe3' }}>
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Upload size={14} style={{ color: '#9E7A42' }}/> Adicionar Documento
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                                <select
                                    value={form.tipo}
                                    onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-yellow-400"
                                    style={{ border: '1px solid #e8e0d4' }}
                                >
                                    {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Nome (opcional)</label>
                                <input
                                    type="text"
                                    value={form.nome}
                                    onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                                    placeholder="Ex: CRLV 2026"
                                    className="w-full px-3 py-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-yellow-400"
                                    style={{ border: '1px solid #e8e0d4' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Arquivo (PDF ou imagem, máx. 20 MB)</label>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".pdf,image/jpeg,image/png,image/webp"
                                onChange={e => setFile(e.target.files[0] || null)}
                                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                            />
                        </div>
                        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={uploading || !file}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                                style={{ background: uploading || !file ? '#d1d5db' : '#9E7A42' }}
                            >
                                {uploading ? <><Loader2 size={14} className="animate-spin"/> Enviando...</> : <><Upload size={14}/> Enviar</>}
                            </button>
                        </div>
                    </form>

                    {/* Lista de documentos */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            Documentos Cadastrados {docs.length > 0 && <span className="text-gray-400 font-normal">({docs.length})</span>}
                        </h3>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={20} className="animate-spin text-gray-400"/>
                            </div>
                        ) : docs.length === 0 ? (
                            <div className="py-8 text-center">
                                <FileText size={28} className="mx-auto mb-2 text-gray-200"/>
                                <p className="text-sm text-gray-400">Nenhum documento cadastrado ainda.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {docs.map(doc => (
                                    <div
                                        key={doc.id}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                                        style={{ border: '1px solid #f0ebe3', background: 'white' }}
                                    >
                                        <FileText size={18} style={{ color: '#9E7A42', flexShrink: 0 }}/>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span style={tipoBadgeStyle(doc.tipo)}>{doc.tipo}</span>
                                                <span className="text-sm font-medium text-gray-700 truncate">{doc.nome}</span>
                                            </div>
                                            <p className="text-xs text-gray-300 mt-0.5">{fmtDate(doc.created_at)}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <a
                                                href={docUrl(doc)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                title="Abrir documento"
                                            >
                                                <ExternalLink size={14} className="text-blue-500"/>
                                            </a>
                                            <button
                                                onClick={() => handleDelete(doc)}
                                                disabled={deleting === doc.id}
                                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                                title="Excluir documento"
                                            >
                                                {deleting === doc.id
                                                    ? <Loader2 size={14} className="animate-spin text-red-400"/>
                                                    : <Trash2 size={14} className="text-red-400"/>
                                                }
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleDocumentsModal;
