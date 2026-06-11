import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Radio, RefreshCw, Loader, Wifi, WifiOff,
    MapPin, Gauge, Zap, ZapOff, AlertTriangle,
    Calendar, Search, ChevronDown, ChevronUp,
    Clock, Navigation, Car, Info, GitCompare,
    TrendingUp, TrendingDown, Minus, X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatObraNome } from '../utils/obraFormat';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícones coloridos simples — usados apenas na aba de rota (início/fim/ponto)
const makeIcon = (color) => new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const ICONS = { green: makeIcon('green'), red: makeIcon('red'), grey: makeIcon('grey') };

// ── Ícones por tipo de veículo (mapa de tempo real) ───────────────────────────
const VEHICLE_TYPE_GROUPS = {
    leve:     ['Automóvel', 'Camionete', 'Utilitários', 'Moto'],
    caminhao: ['Bitruck', 'Caminhão Pipa', 'Caminhão Tanque', 'Caminhão Carroceria', 'Cavalo',
               'Caçamba Bitruck', 'Caçamba Toco', 'Caçamba Traçado', 'Caçamba Truckado', 'Caminhão', 'Caçamba'],
    trecho:   ['Caminhão Prancha', 'Semirreboques'],
    maquina:  ['Motoniveladora', 'Pá Carregadeira', 'Retroescavadeira', 'Rolo', 'Trator',
               'Escavadeira', 'Escavadeira + Rompedor', 'Fresadora', 'Trator Esteira'],
};

const GROUP_CONFIG = {
    leve:         { emoji: '🚗', label: 'Veículo Leve' },
    caminhao:     { emoji: '🚛', label: 'Caminhão' },
    trecho:       { emoji: '🚚', label: 'Caminhão de Trecho' },
    maquina:      { emoji: '🚜', label: 'Máquina Pesada' },
    desconhecido: { emoji: '📍', label: 'Não cadastrado' },
};

const vehicleTypeGroup = (tipo) => {
    if (!tipo) return 'desconhecido';
    for (const [group, types] of Object.entries(VEHICLE_TYPE_GROUPS)) {
        if (types.includes(tipo)) return group;
    }
    return 'desconhecido';
};

const makeVehicleIcon = (tipo, ignicao) => {
    const { emoji } = GROUP_CONFIG[vehicleTypeGroup(tipo)];
    const border = ignicao ? '#22c55e' : '#9ca3af';
    const bg     = ignicao ? '#f0fdf4' : '#f9fafb';
    return L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;border-radius:50%;background:${bg};border:2.5px solid ${border};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 1px 4px rgba(0,0,0,.25)">${emoji}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
    });
};

// --- helpers ---
const fmtDateTime = (str) => {
    if (!str) return '—';
    try { return new Date(str.replace(' ', 'T')).toLocaleString('pt-BR'); } catch { return str; }
};

const FORCE_COOLDOWN_SEC = 60; // cooldown do botão "Atualizar Agora"

const TabBtn = ({ id, active, label, icon: Icon, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`pb-3 pt-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            active ? 'border-[#9E7A42] text-[#9E7A42]' : 'border-transparent text-[#9a8a78] hover:text-[#6a5e4e]'
        }`}
    >
        <Icon size={16} /> {label}
    </button>
);

// ── Cartão de KPI ─────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, bg, value, label }) => (
    <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3" style={{ border: "1px solid #f0ebe3" }}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
            <Icon size={18} className="text-white" />
        </div>
        <div>
            <p className="text-xl font-black text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 font-medium">{label}</p>
        </div>
    </div>
);

// ── Badge de Ignição ──────────────────────────────────────────────
const IgnicaoBadge = ({ on }) => (
    on
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><Zap size={11}/> Ligado</span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500"><ZapOff size={11}/> Desligado</span>
);

// ── Alerta de API não configurada ─────────────────────────────────
const NotConfigured = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
            <AlertTriangle size={32} className="text-yellow-500" />
        </div>
        <h3 className="text-base font-bold text-gray-700">Integração não configurada no servidor</h3>
        <p className="text-sm text-gray-500 max-w-md">
            O backend precisa implementar os endpoints <code className="bg-gray-100 px-1 rounded">/sigasul/*</code> que
            fazem proxy para a API SigaSul com o token de autenticação. Verifique a variável de ambiente
            <code className="bg-gray-100 px-1 mx-1 rounded">SIGASUL_TOKEN</code> no servidor.
        </p>
    </div>
);

// ─────────────────────────────────────────────────────────────────
// ABA 1 — Posições em Tempo Real
// ─────────────────────────────────────────────────────────────────
function TabTempoReal({ apiClient }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [forcing, setForcing] = useState(false);
    const [error, setError] = useState(null);
    const [lastFetch, setLastFetch] = useState(null);
    const [forceCooldown, setForceCooldown] = useState(0);
    const [search, setSearch] = useState('');
    const [showMap, setShowMap] = useState(true);
    const [notConfigured, setNotConfigured] = useState(false);

    useEffect(() => {
        if (forceCooldown <= 0) return;
        const t = setInterval(() => setForceCooldown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [forceCooldown]);

    const loadPositions = useCallback(async (force = false) => {
        if (force) setForcing(true);
        else setLoading(true);
        setError(null);
        setNotConfigured(false);
        try {
            const res = await apiClient.sigasulGetPositions(force);
            setData(Array.isArray(res) ? res : []);
            setLastFetch(new Date());
            if (force) setForceCooldown(FORCE_COOLDOWN_SEC);
        } catch (e) {
            if (e.message?.includes('404') || e.message?.includes('não encontrado') || e.message?.includes('not found')) {
                setNotConfigured(true);
            } else {
                setError(e.message || 'Erro ao consultar SigaSul');
            }
        } finally {
            setLoading(false);
            setForcing(false);
        }
    }, [apiClient]);

    // Carrega automaticamente ao abrir o painel (respeita cache de 5 min do backend)
    useEffect(() => {
        loadPositions(false);
    }, [loadPositions]);

    const filtered = useMemo(() => {
        if (!search.trim()) return data;
        const q = search.toLowerCase();
        return data.filter(p =>
            p.pos_placa?.toLowerCase().includes(q) ||
            p.pos_nome_motorista?.toLowerCase().includes(q)
        );
    }, [data, search]);

    const stats = useMemo(() => ({
        total: data.length,
        ligados: data.filter(p => p.pos_ignicao).length,
        desligados: data.filter(p => !p.pos_ignicao).length,
        velMax: data.reduce((m, p) => Math.max(m, p.pos_velocidade || 0), 0),
    }), [data]);

    const mapCenter = useMemo(() => {
        const withCoords = data.filter(p => p.pos_latitude && p.pos_longitude);
        if (!withCoords.length) return [-15.78, -47.93];
        const lat = withCoords.reduce((s, p) => s + p.pos_latitude, 0) / withCoords.length;
        const lng = withCoords.reduce((s, p) => s + p.pos_longitude, 0) / withCoords.length;
        return [lat, lng];
    }, [data]);

    if (notConfigured) return <NotConfigured />;

    return (
        <div className="space-y-4">
            {/* Controles */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={() => loadPositions(true)}
                    disabled={forcing || forceCooldown > 0}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-bold rounded-lg text-sm transition-colors"
                >
                    {forcing ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {forceCooldown > 0 ? `Aguardar ${forceCooldown}s` : 'Atualizar Agora'}
                </button>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    {loading && !forcing && <><Loader size={12} className="animate-spin" /> Carregando...</>}
                    {lastFetch && !loading && (
                        <span className="flex items-center gap-1">
                            <Clock size={12} /> Atualizado às {lastFetch.toLocaleTimeString('pt-BR')}
                        </span>
                    )}
                </div>
                <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                    <Info size={12} /> Cache de 5 min · refresh automático a cada 1h
                </span>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {loading && data.length === 0 && (
                <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-3">
                    <Loader size={28} className="animate-spin text-yellow-400" />
                    Carregando posições...
                </div>
            )}

            {!loading && data.length > 0 && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiCard icon={Car} bg="bg-slate-600" value={stats.total} label="Veículos rastreados" />
                        <KpiCard icon={Zap} bg="bg-green-500" value={stats.ligados} label="Motor ligado" />
                        <KpiCard icon={ZapOff} bg="bg-gray-400" value={stats.desligados} label="Motor desligado" />
                        <KpiCard icon={Gauge} bg="bg-yellow-500" value={`${stats.velMax} km/h`} label="Velocidade máxima" />
                    </div>

                    {/* Mapa */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <MapPin size={15} className="text-gray-400" /> Mapa de Posições
                            </h3>
                            <button
                                onClick={() => setShowMap(m => !m)}
                                className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700"
                            >
                                {showMap ? <><ChevronUp size={14}/> Ocultar</> : <><ChevronDown size={14}/> Mostrar</>}
                            </button>
                        </div>
                        {showMap && (
                            <>
                                <div style={{ height: 340 }}>
                                    <MapContainer center={mapCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; OpenStreetMap contributors'
                                        />
                                        {data.filter(p => p.pos_latitude && p.pos_longitude).map((p, i) => (
                                            <Marker
                                                key={i}
                                                position={[p.pos_latitude, p.pos_longitude]}
                                                icon={makeVehicleIcon(p.veiculo_tipo, p.pos_ignicao)}
                                            >
                                                <Popup>
                                                    <div className="text-xs space-y-1">
                                                        <p className="font-bold text-sm">{p.pos_placa}</p>
                                                        {p.veiculo_tipo && <p className="text-gray-500">{p.veiculo_tipo}</p>}
                                                        {p.pos_nome_motorista && <p>Motorista: {p.pos_nome_motorista}</p>}
                                                        <p>Velocidade: {p.pos_velocidade} km/h</p>
                                                        <p>Ignição: {p.pos_ignicao ? 'Ligado' : 'Desligado'}</p>
                                                        <p className="text-gray-400">{fmtDateTime(p.pos_data_hora_gps)}</p>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        ))}
                                    </MapContainer>
                                </div>
                                {/* Legenda */}
                                <div className="px-4 py-2 bg-gray-50 border-t flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
                                    {Object.entries(GROUP_CONFIG).map(([key, { emoji, label }]) => (
                                        <span key={key} className="flex items-center gap-1">{emoji} {label}</span>
                                    ))}
                                    <span className="ml-auto flex items-center gap-3">
                                        <span className="flex items-center gap-1.5">
                                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                                            Ligado
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#9ca3af' }} />
                                            Desligado
                                        </span>
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Tabela */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                        <div className="flex items-center gap-3 px-4 py-3 border-b">
                            <Search size={15} className="text-gray-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Filtrar por placa ou motorista..."
                                className="flex-1 text-sm outline-none bg-transparent"
                            />
                            {search && <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600">Limpar</button>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                                    <tr>
                                        <th className="px-4 py-2">Placa</th>
                                        <th className="px-4 py-2">Grupo</th>
                                        <th className="px-4 py-2">Motorista</th>
                                        <th className="px-4 py-2 text-center">Ignição</th>
                                        <th className="px-4 py-2 text-right">Velocidade</th>
                                        <th className="px-4 py-2 text-right">Odômetro</th>
                                        <th className="px-4 py-2">Cercas</th>
                                        <th className="px-4 py-2">Última Posição GPS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map((p, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 font-bold text-gray-800">{p.pos_placa}</td>
                                            <td className="px-4 py-2 text-gray-500 text-xs">
                                                {p.veiculo_tipo
                                                    ? <span>{GROUP_CONFIG[vehicleTypeGroup(p.veiculo_tipo)].emoji} {p.veiculo_tipo}</span>
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-2 text-gray-600">{p.pos_nome_motorista || '—'}</td>
                                            <td className="px-4 py-2 text-center"><IgnicaoBadge on={p.pos_ignicao} /></td>
                                            <td className="px-4 py-2 text-right font-mono text-gray-700">{p.pos_velocidade ?? 0} km/h</td>
                                            <td className="px-4 py-2 text-right text-gray-500 font-mono">
                                                {p.pos_telemetria?.tele_odometro
                                                    ? `${p.pos_telemetria.tele_odometro.toLocaleString('pt-BR')} km`
                                                    : p.pos_odometro
                                                    ? `${p.pos_odometro.toLocaleString('pt-BR')} km`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-gray-500">
                                                {(p.pos_cercas || []).map(c => c.pos_cerca_nome).join(', ') || '—'}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-gray-400">{fmtDateTime(p.pos_data_hora_gps)}</td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan="8" className="px-4 py-6 text-center text-gray-400">Nenhum veículo encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {!loading && data.length === 0 && !error && (
                <div className="py-16 text-center text-gray-400 text-sm">
                    Nenhum veículo com posição disponível.
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// ABA 2 — Por Período
// ─────────────────────────────────────────────────────────────────
function TabPorPeriodo({ apiClient }) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const [from, setFrom] = useState(`${todayStr}T00:00`);
    const [to, setTo] = useState(`${todayStr}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notConfigured, setNotConfigured] = useState(false);
    const [search, setSearch] = useState('');

    const toSigaSulFmt = (dtLocal) => dtLocal.replace('T', ' ') + ':00';

    const diffHours = useMemo(() => {
        if (!from || !to) return 0;
        return (new Date(to) - new Date(from)) / 3600000;
    }, [from, to]);

    const fetch = useCallback(async () => {
        if (diffHours > 24) { setError('Período máximo permitido: 24 horas.'); return; }
        setLoading(true);
        setError(null);
        setNotConfigured(false);
        try {
            const res = await apiClient.sigasulGetPositionsByPeriod(toSigaSulFmt(from), toSigaSulFmt(to));
            setData(Array.isArray(res) ? res : []);
        } catch (e) {
            if (e.message?.includes('404') || e.message?.includes('not found')) setNotConfigured(true);
            else setError(e.message || 'Erro ao consultar SigaSul');
        } finally {
            setLoading(false);
        }
    }, [from, to, diffHours, apiClient]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return data.filter(p => !q || p.pos_placa?.toLowerCase().includes(q));
    }, [data, search]);

    if (notConfigured) return <NotConfigured />;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4" style={{ border: "1px solid #f0ebe3" }}>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Início</label>
                    <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Fim</label>
                    <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                    {diffHours > 24 && <p className="text-xs text-red-500">Máximo 24 horas</p>}
                    {diffHours > 0 && diffHours <= 24 && (
                        <p className="text-xs text-gray-400">{diffHours.toFixed(1)}h de intervalo</p>
                    )}
                    <button
                        onClick={fetch}
                        disabled={loading || diffHours <= 0 || diffHours > 24}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-bold rounded-lg text-sm"
                    >
                        {loading ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
                        Consultar
                    </button>
                </div>
                <p className="text-xs text-gray-400 ml-auto self-end flex items-center gap-1">
                    <Info size={12}/> Rate limit: 1 chamada / 2h
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {data.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                    <div className="flex items-center gap-3 px-4 py-3 border-b">
                        <Search size={15} className="text-gray-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Filtrar por placa..." className="flex-1 text-sm outline-none bg-transparent" />
                        <span className="text-xs text-gray-400">{filtered.length} registros</span>
                    </div>
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Placa</th>
                                    <th className="px-4 py-2">Motorista</th>
                                    <th className="px-4 py-2 text-center">Ignição</th>
                                    <th className="px-4 py-2 text-right">Velocidade</th>
                                    <th className="px-4 py-2">Lat / Long</th>
                                    <th className="px-4 py-2">Data/Hora GPS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((p, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-1.5 font-bold text-gray-800">{p.pos_placa}</td>
                                        <td className="px-4 py-1.5 text-gray-600">{p.pos_nome_motorista || '—'}</td>
                                        <td className="px-4 py-1.5 text-center"><IgnicaoBadge on={p.pos_ignicao} /></td>
                                        <td className="px-4 py-1.5 text-right font-mono">{p.pos_velocidade ?? 0} km/h</td>
                                        <td className="px-4 py-1.5 text-xs text-gray-500 font-mono">
                                            {p.pos_latitude?.toFixed(6)}, {p.pos_longitude?.toFixed(6)}
                                        </td>
                                        <td className="px-4 py-1.5 text-xs text-gray-400">{fmtDateTime(p.pos_data_hora_gps)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && data.length === 0 && !error && (
                <div className="py-12 text-center text-gray-400 text-sm">Selecione o período e clique em Consultar.</div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// ABA 3 — Por Veículo
// ─────────────────────────────────────────────────────────────────
function TabPorVeiculo({ apiClient }) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const [plate, setPlate] = useState('');
    const [from, setFrom] = useState(`${todayStr}T00:00`);
    const [to, setTo] = useState(`${todayStr}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notConfigured, setNotConfigured] = useState(false);

    const toFmt = (dtLocal) => dtLocal.replace('T', ' ') + ':00';
    const diffHours = useMemo(() => (!from || !to ? 0 : (new Date(to) - new Date(from)) / 3600000), [from, to]);

    const fetch = useCallback(async () => {
        if (!plate.trim()) { setError('Informe a placa do veículo.'); return; }
        if (diffHours > 24) { setError('Período máximo: 24 horas.'); return; }
        setLoading(true); setError(null); setNotConfigured(false);
        try {
            const res = await apiClient.sigasulGetPositionsByPlate(plate.trim(), toFmt(from), toFmt(to));
            setData(Array.isArray(res) ? res : []);
        } catch (e) {
            if (e.message?.includes('404') || e.message?.includes('not found')) setNotConfigured(true);
            else setError(e.message || 'Erro ao consultar SigaSul');
        } finally { setLoading(false); }
    }, [plate, from, to, diffHours, apiClient]);

    const mapCenter = useMemo(() => {
        const pts = data.filter(p => p.pos_latitude && p.pos_longitude);
        if (!pts.length) return [-15.78, -47.93];
        return [pts[0].pos_latitude, pts[0].pos_longitude];
    }, [data]);

    if (notConfigured) return <NotConfigured />;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4" style={{ border: "1px solid #f0ebe3" }}>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Placa</label>
                    <input
                        value={plate} onChange={e => setPlate(e.target.value.toUpperCase())}
                        placeholder="ABC-1234"
                        className="border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-yellow-400 outline-none w-36"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Início</label>
                    <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Fim</label>
                    <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                    {diffHours > 24 && <p className="text-xs text-red-500">Máximo 24 horas</p>}
                    <button
                        onClick={fetch}
                        disabled={loading || !plate.trim() || diffHours <= 0 || diffHours > 24}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-bold rounded-lg text-sm"
                    >
                        {loading ? <Loader size={14} className="animate-spin" /> : <Navigation size={14} />}
                        Rastrear
                    </button>
                </div>
                <p className="text-xs text-gray-400 ml-auto self-end flex items-center gap-1"><Info size={12}/> Rate limit: 1 chamada / 10min</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16}/> {error}
                </div>
            )}

            {data.length > 0 && (
                <>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                        <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-bold text-gray-700">
                            <MapPin size={15} className="text-gray-400"/> Rota de {plate} — {data.length} posições
                        </div>
                        <div style={{ height: 300 }}>
                            <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                                {data.filter(p => p.pos_latitude && p.pos_longitude).map((p, i) => (
                                    <Marker key={i} position={[p.pos_latitude, p.pos_longitude]}
                                        icon={i === 0 ? ICONS.green : i === data.length - 1 ? ICONS.red : ICONS.grey}>
                                        <Popup>
                                            <div className="text-xs">
                                                <p className="font-bold">{p.pos_placa}</p>
                                                <p>{fmtDateTime(p.pos_data_hora_gps)}</p>
                                                <p>{p.pos_velocidade} km/h | {p.pos_ignicao ? 'Ligado' : 'Desligado'}</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                        <div className="overflow-x-auto max-h-72">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">#</th>
                                        <th className="px-4 py-2 text-center">Ignição</th>
                                        <th className="px-4 py-2 text-right">Velocidade</th>
                                        <th className="px-4 py-2 text-right">Odômetro</th>
                                        <th className="px-4 py-2">Data/Hora GPS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {data.map((p, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-4 py-1.5 text-gray-400 text-xs">{i + 1}</td>
                                            <td className="px-4 py-1.5 text-center"><IgnicaoBadge on={p.pos_ignicao}/></td>
                                            <td className="px-4 py-1.5 text-right font-mono">{p.pos_velocidade ?? 0} km/h</td>
                                            <td className="px-4 py-1.5 text-right text-gray-500 font-mono">
                                                {(p.pos_telemetria?.tele_odometro || p.pos_odometro || 0).toLocaleString('pt-BR')} km
                                            </td>
                                            <td className="px-4 py-1.5 text-xs text-gray-400">{fmtDateTime(p.pos_data_hora_gps)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {!loading && data.length === 0 && !error && (
                <div className="py-12 text-center text-gray-400 text-sm">Informe a placa e o período para rastrear o veículo.</div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// ABA 4 — Jornadas
// ─────────────────────────────────────────────────────────────────
function TabJornadas({ apiClient }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notConfigured, setNotConfigured] = useState(false);
    const [lastFetch, setLastFetch] = useState(null);
    const [cooldown, setCooldown] = useState(0);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    const fetch = useCallback(async () => {
        setLoading(true); setError(null); setNotConfigured(false);
        try {
            const res = await apiClient.sigasulGetJourneys();
            setData(Array.isArray(res) ? res : []);
            setLastFetch(new Date());
            setCooldown(65);
        } catch (e) {
            if (e.message?.includes('404') || e.message?.includes('not found')) setNotConfigured(true);
            else setError(e.message || 'Erro ao consultar SigaSul');
        } finally { setLoading(false); }
    }, [apiClient]);

    if (notConfigured) return <NotConfigured />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={fetch}
                    disabled={loading || cooldown > 0}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-bold rounded-lg text-sm"
                >
                    {loading ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {cooldown > 0 ? `Aguardar ${cooldown}s` : 'Buscar Jornadas'}
                </button>
                {lastFetch && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={12}/> {lastFetch.toLocaleTimeString('pt-BR')}
                    </span>
                )}
                <span className="text-xs text-gray-400 ml-auto flex items-center gap-1"><Info size={12}/> Rate limit: 1 chamada / 1min</span>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16}/> {error}
                </div>
            )}

            {data.length > 0 && (
                <div className="space-y-2">
                    {data.map((j) => (
                        <div key={j.id_jornada} className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                            <button
                                onClick={() => setExpandedId(expandedId === j.id_jornada ? null : j.id_jornada)}
                                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                        {j.id_jornada}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{j.nome_motorista || '—'}</p>
                                        <p className="text-xs text-gray-400">{j.nome_cliente}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-xs text-gray-500">
                                    <div>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Início</span>
                                        {fmtDateTime(j.data_inicial)}
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Fim</span>
                                        {fmtDateTime(j.data_final)}
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Eventos</span>
                                        {(j.eventos || []).length}
                                    </div>
                                    {expandedId === j.id_jornada ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </div>
                            </button>

                            {expandedId === j.id_jornada && (j.eventos || []).length > 0 && (
                                <div className="border-t">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase">
                                            <tr>
                                                <th className="px-4 py-1.5">Evento</th>
                                                <th className="px-4 py-1.5">Tipo</th>
                                                <th className="px-4 py-1.5">Placa</th>
                                                <th className="px-4 py-1.5">Início</th>
                                                <th className="px-4 py-1.5">Fim</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {j.eventos.map(e => (
                                                <tr key={e.id_evento} className="hover:bg-gray-50">
                                                    <td className="px-4 py-1.5 text-gray-400">#{e.id_evento}</td>
                                                    <td className="px-4 py-1.5 font-medium text-gray-700">{e.nome_tipo_evento}</td>
                                                    <td className="px-4 py-1.5 font-mono text-gray-600">{e.placa || '—'}</td>
                                                    <td className="px-4 py-1.5 text-gray-400">{fmtDateTime(e.data_inicio)}</td>
                                                    <td className="px-4 py-1.5 text-gray-400">{fmtDateTime(e.data_fim)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!loading && data.length === 0 && !error && (
                <div className="py-12 text-center text-gray-400 text-sm">Clique em "Buscar Jornadas" para carregar os eventos.</div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// ABA 5 — Confronto GPS × Faturamento
// ─────────────────────────────────────────────────────────────────
const hmsToDecimal = (hms) => {
    if (!hms) return 0;
    const [h, m, s] = hms.split(':').map(Number);
    return h + m / 60 + (s || 0) / 3600;
};

const fmtH = (h) => {
    if (h == null) return '—';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`;
};

const eficienciaStatus = (ef) => {
    if (ef == null) return { color: 'text-gray-400 bg-gray-100', label: 'Sem GPS', icon: Minus };
    if (ef >= 85)   return { color: 'text-green-700 bg-green-100', label: `${ef.toFixed(0)}%`, icon: TrendingUp };
    if (ef >= 60)   return { color: 'text-yellow-700 bg-yellow-100', label: `${ef.toFixed(0)}%`, icon: Minus };
    return { color: 'text-red-700 bg-red-100', label: `${ef.toFixed(0)}%`, icon: TrendingDown };
};

// Modal de seleção de obra com busca
function ObraPickerModal({ obras, onSelect, onClose }) {
    const [busca, setBusca] = useState('');
    const inputRef = React.useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const ativas     = useMemo(() => obras.filter(o => o.status !== 'finalizada'), [obras]);
    const finalizadas = useMemo(() => obras.filter(o => o.status === 'finalizada'), [obras]);

    const filtra = (lista) => {
        const q = busca.toLowerCase().trim();
        if (!q) return [...lista].sort((a, b) => a.nome?.localeCompare(b.nome));
        return lista
            .filter(o => o.nome?.toLowerCase().includes(q))
            .sort((a, b) => a.nome?.localeCompare(b.nome));
    };

    const ativasFiltradas     = filtra(ativas);
    const finalizadasFiltradas = filtra(finalizadas);
    const temResultado = ativasFiltradas.length + finalizadasFiltradas.length > 0;

    const ObraItem = ({ obra }) => (
        <button
            onClick={() => onSelect(obra.id)}
            className="w-full text-left px-4 py-2.5 hover:bg-[#fdf8f0] flex items-center justify-between gap-2 transition-colors"
        >
            <span className="text-sm text-gray-800 font-medium">{formatObraNome(obra)}</span>
            {obra.status === 'finalizada'
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">Finalizada</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">Ativa</span>
            }
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-bold text-gray-800">Selecionar Obra</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <X size={18} />
                    </button>
                </div>

                {/* Busca */}
                <div className="px-3 py-2 border-b">
                    <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-1.5">
                        <Search size={14} className="text-gray-400 flex-shrink-0" />
                        <input
                            ref={inputRef}
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            placeholder="Buscar obra..."
                            className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
                        />
                        {busca && (
                            <button onClick={() => setBusca('')} className="text-gray-400 hover:text-gray-600">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Lista */}
                <div className="overflow-y-auto flex-1">
                    {!temResultado && (
                        <p className="py-8 text-center text-sm text-gray-400">Nenhuma obra encontrada.</p>
                    )}

                    {ativasFiltradas.length > 0 && (
                        <>
                            <div className="px-4 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">
                                Ativas ({ativasFiltradas.length})
                            </div>
                            {ativasFiltradas.map(o => <ObraItem key={o.id} obra={o} />)}
                        </>
                    )}

                    {finalizadasFiltradas.length > 0 && (
                        <>
                            <div className="px-4 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">
                                Finalizadas ({finalizadasFiltradas.length})
                            </div>
                            {finalizadasFiltradas.map(o => <ObraItem key={o.id} obra={o} />)}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function TabConfrontoFaturamento({ apiClient, obras = [], vehicles = [] }) {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    const [obraId, setObraId]       = useState('');
    const [showPicker, setShowPicker] = useState(false);
    const [from, setFrom]           = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
    const [to, setTo]               = useState(isoDate(today));
    const [rows, setRows]           = useState([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);
    const [notConfigured, setNotConfigured] = useState(false);

    // Quando seleciona obra, preenche período com as datas dela
    const handleObraChange = useCallback((id) => {
        setObraId(id);
        setShowPicker(false);
        setRows([]);
        setError(null);
        if (!id) return;
        const obra = obras.find(o => o.id === id);
        if (!obra) return;
        const start = obra.dataInicio ? isoDate(new Date(obra.dataInicio)) : isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
        const end   = obra.status === 'finalizada' && obra.dataFim
            ? isoDate(new Date(obra.dataFim))
            : isoDate(today);
        setFrom(start);
        setTo(end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [obras]);

    const handleConsultar = useCallback(async () => {
        if (!obraId) { setError('Selecione uma obra.'); return; }
        setLoading(true);
        setError(null);
        setNotConfigured(false);

        // Remove traço e espaços, deixa maiúsculo — normaliza "ABC-1234" e "ABC1234" para "ABC1234"
        const normPlaca = (p) => (p || '').replace(/[-\s]/g, '').toUpperCase();

        try {
            const [billing, gps] = await Promise.all([
                apiClient.getDailyLogs(obraId, { startDate: from, endDate: to }),
                apiClient.sigasulGetJourneysAggregate(`${from} 00:00:00`, `${to} 23:59:59`),
            ]);

            // Mapa placa normalizada → horas faturadas
            const billedByPlaca = {};      // chave: placa normalizada
            const vehicleInfoByPlaca = {}; // chave: placa normalizada
            const placaOriginalMap = {};   // normalizada → original do sistema (para exibição)
            for (const log of (billing || [])) {
                const placaRaw = log.placa || vehicles.find(v => v.id === log.vehicleId)?.placa;
                if (!placaRaw) continue;
                const key = normPlaca(placaRaw);
                billedByPlaca[key] = (billedByPlaca[key] || 0) + (parseFloat(log.totalHours) || 0);
                placaOriginalMap[key] = placaRaw;
                if (!vehicleInfoByPlaca[key]) {
                    vehicleInfoByPlaca[key] = {
                        tipo: log.tipo || vehicles.find(v => v.id === log.vehicleId)?.tipo || '—',
                        registroInterno: log.registroInterno || '—',
                    };
                }
            }

            // Mapa placa normalizada → horas GPS
            const gpsByPlaca = {};
            for (const item of (gps || [])) {
                const key = normPlaca(item.placa);
                gpsByPlaca[key] = { horasLigado: item.totalHorasLigado, km: item.totalKm };
            }

            // Usa apenas as placas com horas faturadas na obra (GPS é dado complementar)
            const allPlacas = new Set(Object.keys(billedByPlaca));
            const result = Array.from(allPlacas).map(placa => {
                const billed = billedByPlaca[placa] ?? null;
                const gpsH   = gpsByPlaca[placa]?.horasLigado ?? null;
                const delta  = (billed != null && gpsH != null) ? gpsH - billed : null;
                const ef     = (billed > 0 && gpsH != null) ? (gpsH / billed) * 100 : null;
                return {
                    placa: placaOriginalMap[placa] || placa,
                    tipo: vehicleInfoByPlaca[placa]?.tipo || '—',
                    registroInterno: vehicleInfoByPlaca[placa]?.registroInterno || '—',
                    billed,
                    gpsH,
                    delta,
                    eficiencia: ef,
                    km: gpsByPlaca[placa]?.km ?? null,
                };
            });

            // Ordena: maior discrepância absoluta primeiro
            result.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
            setRows(result);
        } catch (e) {
            if (e.message?.includes('404') || e.message?.includes('not found')) setNotConfigured(true);
            else setError(e.message || 'Erro ao consultar dados.');
        } finally {
            setLoading(false);
        }
    }, [obraId, from, to, apiClient, vehicles]);

    const kpis = useMemo(() => {
        const comGps   = rows.filter(r => r.gpsH != null).length;
        const totalFat = rows.reduce((s, r) => s + (r.billed || 0), 0);
        const totalGps = rows.reduce((s, r) => s + (r.gpsH || 0), 0);
        const delta    = totalGps - totalFat;
        return { comGps, total: rows.length, totalFat, totalGps, delta };
    }, [rows]);

    if (notConfigured) return <NotConfigured />;

    const obraAtual = obras.find(o => o.id === obraId);

    return (
        <div className="space-y-4">
            {showPicker && (
                <ObraPickerModal
                    obras={obras}
                    onSelect={handleObraChange}
                    onClose={() => setShowPicker(false)}
                />
            )}

            {/* Controles */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4" style={{ border: "1px solid #f0ebe3" }}>
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Obra</label>
                    <button
                        onClick={() => setShowPicker(true)}
                        className="w-full border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between gap-2 hover:border-yellow-400 transition-colors bg-white"
                    >
                        {obraAtual ? (
                            <span className="text-gray-800 font-medium truncate">{formatObraNome(obraAtual)}</span>
                        ) : (
                            <span className="text-gray-400">Selecionar obra...</span>
                        )}
                        <Search size={14} className="text-gray-400 flex-shrink-0" />
                    </button>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">De</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Até</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                </div>
                <button
                    onClick={handleConsultar}
                    disabled={loading || !obraId}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-bold rounded-lg text-sm transition-colors"
                >
                    {loading ? <Loader size={14} className="animate-spin" /> : <GitCompare size={14} />}
                    Confrontar
                </button>
                {obraAtual && (
                    <p className="text-xs text-gray-400 self-end">
                        Período da obra: {obraAtual.dataInicio ? new Date(obraAtual.dataInicio).toLocaleDateString('pt-BR') : '?'}
                        {' → '}{obraAtual.dataFim ? new Date(obraAtual.dataFim).toLocaleDateString('pt-BR') : 'em andamento'}
                    </p>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {rows.length > 0 && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiCard icon={Car} bg="bg-slate-600"
                            value={`${kpis.comGps}/${kpis.total}`}
                            label="Veículos com GPS / faturados" />
                        <KpiCard icon={Clock} bg="bg-blue-500"
                            value={fmtH(kpis.totalFat)}
                            label="Total horas faturadas" />
                        <KpiCard icon={Zap} bg="bg-green-500"
                            value={fmtH(kpis.totalGps)}
                            label="Total motor ligado (GPS)" />
                        <KpiCard
                            icon={kpis.delta >= 0 ? TrendingUp : TrendingDown}
                            bg={Math.abs(kpis.delta) < 1 ? 'bg-gray-400' : kpis.delta >= 0 ? 'bg-green-500' : 'bg-red-500'}
                            value={`${kpis.delta >= 0 ? '+' : ''}${fmtH(kpis.delta)}`}
                            label="Δ GPS − Faturado (global)" />
                    </div>

                    {/* Legenda */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 items-center">
                        <span className="font-bold text-gray-600">Eficiência:</span>
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">≥ 85% motor ligado / h faturada</span>
                        <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-bold">60–84%</span>
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">&lt; 60% — verificar</span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">Sem GPS cadastrado</span>
                    </div>

                    {/* Tabela */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #f0ebe3" }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                                    <tr>
                                        <th className="px-4 py-2">Placa</th>
                                        <th className="px-4 py-2">Grupo</th>
                                        <th className="px-4 py-2 text-right">H. Faturadas</th>
                                        <th className="px-4 py-2 text-right">H. Motor Ligado</th>
                                        <th className="px-4 py-2 text-right">Δ Horas</th>
                                        <th className="px-4 py-2 text-right">Km (GPS)</th>
                                        <th className="px-4 py-2 text-center">Eficiência</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {rows.map((r) => {
                                        const st = eficienciaStatus(r.eficiencia);
                                        const Icon = st.icon;
                                        return (
                                            <tr key={r.placa} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 font-bold text-gray-800 font-mono">{r.placa}</td>
                                                <td className="px-4 py-2 text-gray-600">{r.tipo}</td>
                                                <td className="px-4 py-2 text-right text-gray-700 font-mono">
                                                    {r.billed != null ? fmtH(r.billed) : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-700 font-mono">
                                                    {r.gpsH != null ? fmtH(r.gpsH) : <span className="text-gray-300">Sem GPS</span>}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-mono font-bold ${
                                                    r.delta == null ? 'text-gray-300' :
                                                    r.delta >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {r.delta == null ? '—' : `${r.delta >= 0 ? '+' : ''}${fmtH(r.delta)}`}
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-500 font-mono">
                                                    {r.km != null ? `${r.km.toFixed(1)} km` : '—'}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${st.color}`}>
                                                        <Icon size={11} /> {st.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Info size={12} />
                        Δ positivo = motor ficou mais tempo ligado do que as horas faturadas.
                        Δ negativo = possível ociosidade ou superfaturamento — investigar.
                    </p>
                </>
            )}

            {!loading && rows.length === 0 && !error && (
                <div className="py-16 text-center text-gray-400 text-sm">
                    Selecione uma obra e clique em "Confrontar" para cruzar os dados de faturamento com o GPS.
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'realtime',  label: 'Tempo Real',              icon: Radio },
    { id: 'periodo',   label: 'Por Período',              icon: Calendar },
    { id: 'veiculo',   label: 'Por Veículo',              icon: Navigation },
    { id: 'jornadas',  label: 'Jornadas',                 icon: Clock },
    { id: 'confronto', label: 'Confronto Faturamento',    icon: GitCompare },
];

export default function SigaSulPage({ apiClient, obras = [], vehicles = [] }) {
    const [tab, setTab] = useState('realtime');
    const [status, setStatus] = useState('idle'); // 'idle' | 'ok' | 'error'

    const handleTabChange = (id) => {
        setTab(id);
        if (status === 'idle') setStatus('ok');
    };

    return (
        <div className="p-6 space-y-5 h-full overflow-y-auto">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                            <Radio size={20} className="text-yellow-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">SigaSul — Rastreamento</h1>
                            <p className="text-sm text-gray-400">Integração com a API de rastreamento veicular SigaSul</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Status da integração</span>
                        {status === 'ok'
                            ? <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><Wifi size={11}/> Configurada</span>
                            : status === 'error'
                            ? <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><WifiOff size={11}/> Erro</span>
                            : <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Aguardando consulta</span>
                        }
                    </div>
                    <p className="text-[10px] text-gray-400">Base URL: gestao.sigasul.com.br</p>
                </div>
            </div>

            {/* Aviso de arquitetura */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-blue-700">
                <Info size={16} className="flex-shrink-0 mt-0.5" />
                <span>
                    As consultas são feitas via backend (<code className="bg-blue-100 px-1 rounded">/api/sigasul/*</code>), que atua como proxy seguro para a API SigaSul.
                    O token de autenticação é configurado na variável de ambiente <code className="bg-blue-100 px-1 rounded">SIGASUL_TOKEN</code> do servidor.
                </span>
            </div>

            {/* Tabs */}
            <div className="border-b bg-white rounded-t-xl overflow-x-auto">
                <div className="flex px-2">
                    {TABS.map(t => (
                        <TabBtn key={t.id} id={t.id} active={tab === t.id} label={t.label} icon={t.icon} onClick={handleTabChange} />
                    ))}
                </div>
            </div>

            {/* Conteúdo */}
            <div>
                {tab === 'realtime'  && <TabTempoReal apiClient={apiClient} />}
                {tab === 'periodo'   && <TabPorPeriodo apiClient={apiClient} />}
                {tab === 'veiculo'   && <TabPorVeiculo apiClient={apiClient} />}
                {tab === 'jornadas'  && <TabJornadas apiClient={apiClient} />}
                {tab === 'confronto' && <TabConfrontoFaturamento apiClient={apiClient} obras={obras} vehicles={vehicles} />}
            </div>
        </div>
    );
}



