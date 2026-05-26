import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { X, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícones coloridos para os status da obra
const getColoredIcon = (colorName) => {
    return new L.Icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${colorName}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
};

const icons = {
    blue: getColoredIcon('blue'),       // Sem plano
    green: getColoredIcon('green'),     // 0-29%
    yellow: getColoredIcon('gold'),     // 30-70% (Gold/Yellow)
    violet: getColoredIcon('violet'),   // >70%
    red: getColoredIcon('red')          // >=100%
};

const AllocationMap = ({ obras = [], vehicles = [], vehicleGroups = {}, isExpanded = false }) => {
    const validObras = useMemo(() => {
        return obras.filter(o => 
            o.status === 'ativa' && 
            o.latitude && o.longitude && 
            !isNaN(parseFloat(o.latitude)) && !isNaN(parseFloat(o.longitude))
        );
    }, [obras]);

    // Função para calcular o progresso da obra (Baseado em FATURAMENTO vs CONTRATADO)
    const getObraProgress = (obra) => {
        // 1. Contratado
        let contratado = 0;
        const type = obra.contractType || 'horas';

        if (type === 'horas') {
            let horasObj = obra.horasContratadasPorTipo;
            if (typeof horasObj === 'string') {
                try { horasObj = JSON.parse(horasObj); } catch (e) { horasObj = {}; }
            } else if (!horasObj) { horasObj = {}; }
            contratado = Object.values(horasObj).reduce((a, b) => a + (parseFloat(b)||0), 0);
        } else if (type === 'prancha') {
            contratado = parseFloat(obra.kmContratadoPrancha || 0);
        } else {
             const sectorsList = typeof obra.sectors === 'string' ? JSON.parse(obra.sectors || '[]') : (obra.sectors || []);
             contratado = sectorsList.reduce((acc, sec) => acc + (parseFloat(sec.totalArea) || 0), 0);
        }

        if (contratado === 0) return { pct: 0, hasPlan: false, real: 0, meta: 0 };

        // 2. Real / Faturado
        // MUDANÇA: Usar 'totalHorasRealizadas' (Faturado) em vez de soma de horímetros dos veículos
        let totalExecutado = 0;
        
        if (type === 'prancha') {
             // Para prancha, geralmente o input manual é o 'kmConcluidoPrancha'
             totalExecutado = parseFloat(obra.kmConcluidoPrancha) || 0;
        } else {
             // Para horas, usamos o valor oficial faturado/apontado na gestão da obra
             totalExecutado = parseFloat(obra.totalHorasRealizadas) || 0;
        }

        const pct = (totalExecutado / contratado) * 100;
        return { pct, hasPlan: true, real: totalExecutado, meta: contratado };
    };

    const getPinIcon = (obra) => {
        const { pct, hasPlan } = getObraProgress(obra);

        if (!hasPlan) return icons.blue;
        if (pct < 30) return icons.green;
        if (pct >= 30 && pct < 70) return icons.yellow;
        if (pct >= 70 && pct < 100) return icons.violet;
        return icons.red; // >= 100%
    };

    const getActiveVehiclesList = (obraId) => {
        if (!Array.isArray(obras)) return [];
        const obra = obras.find(o => o.id === obraId);
        if (!obra || !Array.isArray(obra.historicoVeiculos)) return [];
        return obra.historicoVeiculos
            .filter(h => !h.dataSaida)
            .map(h => {
                const vehicle = vehicles.find(v => v.id === h.veiculoId);
                return vehicle ? `${vehicle.tipo} - ${vehicle.registroInterno}` : 'Veículo Desconhecido';
            });
    };

    const mapCenter = [-29.6914, -53.8008]; // RS Center

    return (
        <MapContainer center={mapCenter} zoom={isExpanded ? 7 : 6} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {validObras.map(obra => {
                const activeVehiclesList = getActiveVehiclesList(obra.id);
                const icon = getPinIcon(obra);
                const progress = getObraProgress(obra);

                return (
                    <Marker key={obra.id} position={[parseFloat(obra.latitude), parseFloat(obra.longitude)]} icon={icon}>
                        <Popup>
                            <div className="min-w-[200px]">
                                <strong className="block text-sm text-gray-900 uppercase mb-1">{obra.nome}</strong>
                                <span className="text-xs text-gray-500 block mb-2">{obra.cliente || 'Cliente N/A'}</span>
                                
                                {progress.hasPlan ? (
                                    <div className="mb-2 bg-gray-50 p-1 rounded border">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span>Faturado vs Contrato:</span>
                                            <span className={progress.pct >= 100 ? 'text-red-600' : 'text-blue-600'}>
                                                {progress.pct.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 h-1.5 mt-1 rounded-full">
                                            <div 
                                                className={`h-1.5 rounded-full ${progress.pct >= 100 ? 'bg-red-500' : progress.pct >= 70 ? 'bg-purple-500' : progress.pct >= 30 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                style={{ width: `${Math.min(progress.pct, 100)}%`}}
                                            ></div>
                                        </div>
                                        <div className="text-[9px] text-gray-400 mt-1 flex justify-between">
                                            <span>Fat: {progress.real.toFixed(0)}</span>
                                            <span>Meta: {progress.meta.toFixed(0)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-gray-400 block mb-2 italic">Sem plano contratual definido</span>
                                )}

                                <div className="text-xs">
                                    <div className="font-semibold mb-1 text-blue-700">{activeVehiclesList.length} Veículo(s) Alocado(s):</div>
                                    <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                                        {activeVehiclesList.length > 0 ? activeVehiclesList.map((v, i) => <li key={i}>{v}</li>) : <li className="italic text-gray-400">Vazio</li>}
                                    </ul>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </MapContainer>
    );
};

export const ExpandedMapModal = ({ obras, vehicles, vehicleGroups, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[40] p-4">
            {/* Adicionado 'isolate' aqui também para garantir */}
            <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col isolate">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <MapPin className="text-blue-600" /> Mapa de Alocação Expandido
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X size={24} /></button>
                </div>
                
                {/* Adicionado 'isolate' e 'overflow-hidden' para trancar o mapa */}
                <div className="flex-1 relative bg-gray-100 isolate z-0 overflow-hidden">
                    <AllocationMap obras={obras} vehicles={vehicles} vehicleGroups={vehicleGroups} isExpanded={true} />
                </div>
            </div>
        </div>
    );
};

export default AllocationMap;