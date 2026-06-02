import React from 'react';
import { ImageOff, X, MapPin } from 'lucide-react';
import { getGroupUnit, getReadingSourceForUnit } from '../utils/vehicleRules';

// --- Modal de Detalhes do Veículo (V2.7 - Rastreador Label) ---
const VehicleDetailModal = ({ vehicle, revision, onClose, vehicleGroups = {} }) => {
    if (!vehicle) return null;

    // --- Helper Robusto (Igual ao VehicleModal) ---
    const resolveValue = (obj, keys) => {
        if (!obj) return '';
        for (const key of keys) {
            if (obj[key] !== undefined && obj[key] !== null) {
                return obj[key].toString();
            }
        }
        return '';
    };

    const groups = vehicleGroups && typeof vehicleGroups === 'object' ? vehicleGroups : {};
    const vehicleGroup = Object.keys(groups).find(group => groups[group]?.includes(vehicle.tipo));

    // Unidade de consumo e leitura derivadas da configuração do grupo
    const consumptionUnit = getGroupUnit(vehicle.tipo);
    const usaHorimetro = getReadingSourceForUnit(consumptionUnit) === 'horimetro';
    const readingLabel = usaHorimetro ? 'Horímetro' : 'Odômetro';
    const readingValue = usaHorimetro
        ? `${vehicle.horimetro || 'N/A'} Hr`
        : `${vehicle.odometro ?? 'N/A'} Km`;

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try { return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); } 
        catch { return 'Inválida'; }
    };

    const apiBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace('/api', '');
    const imageUrl = vehicle.fotoURL 
        ? (vehicle.fotoURL.startsWith('http') ? vehicle.fotoURL : `${apiBaseUrl}${vehicle.fotoURL}`)
        : 'https://placehold.co/600x400/e2e8f0/cbd5e0?text=S/Foto';

    const anoFab = resolveValue(vehicle, ['ano_fabricacao', 'anoFabricacao', 'AnoFabricacao']);
    const anoMod = resolveValue(vehicle, ['ano_modelo', 'anoModelo', 'AnoModelo']);
    const cor = resolveValue(vehicle, ['cor', 'Cor']);
    const chassi = resolveValue(vehicle, ['chassi', 'Chassi']);

    return (
        <div className="mak-modal-backdrop overflow-y-auto">
            <div className="mak-modal max-w-lg">
                {/* Cabeçalho Fixo */}
                <div className="p-4 sm:p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl sm:text-2xl font-bold">{vehicle.marca} {vehicle.modelo}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X size={20}/></button>
                </div>
                 {/* Conteúdo Rolável */}
                <div className="p-4 sm:p-6 overflow-y-auto">
                    {/* Imagem */}
                    <div className="mb-6 aspect-video bg-gray-100 rounded-lg flex items-center justify-center relative">
                        <img
                            src={imageUrl} 
                            alt={`Foto de ${vehicle.marca || ''} ${vehicle.modelo || ''}`}
                            className="w-full h-full object-contain rounded-lg" 
                            onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/600x400/e2e8f0/cbd5e0?text=Erro'; }}
                        />
                         {!vehicle.fotoURL && <ImageOff className="text-gray-400" size={48} />}
                         
                         {/* BADGE RASTREADOR DINÂMICO */}
                         {vehicle.rastreador && vehicle.rastreador !== 'Sem Rastreador' && (
                             <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow flex items-center gap-1 z-10">
                                 <MapPin size={10} /> {vehicle.rastreador}
                             </div>
                         )}
                    </div>

                    {/* Detalhes em Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:text-base">
                        <div className="font-semibold text-gray-600">Registro Interno:</div>
                        <div className="text-gray-800 font-medium">{vehicle.registroInterno || 'N/A'}</div>

                        <div className="font-semibold text-gray-600">Placa:</div>
                        <div className="text-gray-800 font-medium">{vehicle.placa || 'N/A'}</div>

                        <div className="font-semibold text-gray-600">Grupo:</div>
                        <div className="text-gray-800 font-medium">{vehicle.tipo || 'N/A'}</div>

                        {vehicle.sub_tipo && (<>
                            <div className="font-semibold text-gray-600">Subgrupo:</div>
                            <div className="text-gray-800 font-medium">{vehicle.sub_tipo}</div>
                        </>)}

                        <div className="font-semibold text-gray-600">{readingLabel}:</div>
                        <div className="text-gray-800 font-medium">{readingValue}</div>

                         {/* Separador */}
                        <div className="col-span-2 border-t my-2"></div>

                        {/* Detalhes Adicionais */}
                         {(anoFab || anoMod) && (<>
                            <div className="font-semibold text-gray-600">Ano Fab./Modelo:</div>
                            <div className="text-gray-800 font-medium">{anoFab || '-'} / {anoMod || '-'}</div>
                        </>)}

                        {cor && (<>
                            <div className="font-semibold text-gray-600">Cor:</div>
                            <div className="text-gray-800 font-medium">{cor}</div>
                        </>)}

                        {chassi && (<>
                            <div className="font-semibold text-gray-600">Chassi:</div>
                            <div className="text-gray-800 font-medium break-all">{chassi}</div>
                        </>)}

                         {(vehicleGroup === 'Caminhões' || vehicleGroup === 'Máquinas Pesadas' || vehicleGroup === 'Veículos Leves') && (<>
                            <div className="font-semibold text-gray-600">Cálculo de Média:</div>
                            <div className="text-gray-800 font-medium">{consumptionUnit}</div>
                        </>)}

                        {vehicle.capacidade && (
                            <>
                                <div className="font-semibold text-gray-600">Capacidade (m³):</div>
                                <div className="text-gray-800 font-medium">{vehicle.capacidade}</div>
                            </>
                        )}
                         {vehicle.fuelCapacity && (
                            <>
                                <div className="font-semibold text-gray-600">Capacidade Tanque (L):</div>
                                <div className="text-gray-800 font-medium">{vehicle.fuelCapacity}</div>
                            </>
                        )}

                         {/* Validades */}
                         {vehicleGroup === 'Caminhões' && (
                            <>
                                <div className="col-span-2 border-t my-2"></div>
                                <div className="font-semibold text-gray-600">Validade Tacógrafo:</div>
                                <div className={`font-medium ${new Date(vehicle.validadeTacografo) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>{formatDate(vehicle.validadeTacografo)}</div>

                                <div className="font-semibold text-gray-600">Validade AET DAER:</div>
                                 <div className={`font-medium ${new Date(vehicle.validadeAET_DAER) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>{formatDate(vehicle.validadeAET_DAER)}</div>

                                <div className="font-semibold text-gray-600">Validade AET DNIT:</div>
                                <div className={`font-medium ${new Date(vehicle.validadeAET_DNIT) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>{formatDate(vehicle.validadeAET_DNIT)}</div>
                            </>
                         )}

                        {/* Revisão */}
                        <div className="col-span-2 border-t my-2 pt-2">
                             <h3 className="font-semibold text-gray-700 mb-1">Próxima Revisão Agendada</h3>
                        </div>
                        <div className="font-semibold text-gray-600">Data:</div>
                        <div className="text-gray-800 font-medium">{formatDate(revision?.proximaRevisaoData)}</div>

                        <div className="font-semibold text-gray-600">Leitura Meta:</div>
                        <div className="text-gray-800 font-medium">{revision?.proximaRevisaoOdometro || revision?.proximaRevisaoHorimetro || 'N/A'}</div>

                         <div className="font-semibold text-gray-600">Descrição:</div>
                         <div className="text-gray-800 font-medium col-span-2">{revision?.descricao || 'Nenhuma descrição'}</div>
                    </div>
                </div>
                 {/* Rodapé Fixo */}
                <div className="p-4 bg-gray-50 border-t flex justify-end sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-medium">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default VehicleDetailModal;


