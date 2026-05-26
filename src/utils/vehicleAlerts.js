// src/utils/vehicleAlerts.js
//
// ============================================================================
// vehicleAlerts — Processamento de alertas de veículos OTIMIZADO
// ============================================================================
//
// Versão antiga estava no App.js como `processVehiclesWithAlerts`, era O(V × R × F):
// para cada veículo (V), fazia .find em revisions (R) e .some em fines (F).
// Com 100 veículos × 50 revisões × 200 multas isso eram ~1M operações por
// re-render.
//
// Esta versão é O(V + R + F):
//   - pré-indexa revisions e fines em Maps
//   - depois um único passe nos vehicles fazendo lookup O(1)
//
// ============================================================================

import { vehicleGroups, getVehicleMainReading } from './vehicleRules';

const TRUCKS_GROUP = vehicleGroups['Caminhões'] || [];
const TRECHO_GROUP = vehicleGroups['Caminhões de Trecho'] || [];

const isTruck = (tipo) =>
    TRUCKS_GROUP.includes(tipo) || TRECHO_GROUP.includes(tipo);

/**
 * Pré-indexa as revisões por vehicleId.
 */
const indexRevisionsByVehicle = (revisions) => {
    const map = new Map();
    for (const r of revisions) {
        if (r?.vehicleId) map.set(r.vehicleId, r);
    }
    return map;
};

/**
 * Pré-indexa o set de vehicleIds com multas pendentes.
 */
const indexVehiclesWithPendingFines = (fines) => {
    const set = new Set();
    for (const f of fines) {
        if (f?.vehicleId && f?.paymentStatus === 'Pendente') {
            set.add(f.vehicleId);
        }
    }
    return set;
};

/**
 * Processa um único veículo e retorna { possuiAviso, avisoTexto }.
 */
const processVehicleAlert = (vehicle, revision, hasPendingFine, now, thirtyDaysFromNow) => {
    // 1. Bloqueio Manual
    if (
        vehicle.canCirculate === false ||
        vehicle.canCirculate === 0 ||
        vehicle.canCirculate === '0'
    ) {
        return { possuiAviso: true, avisoTexto: 'BLOQUEIO: O veículo não pode rodar (Doc/Manutenção).' };
    }

    // 2. Revisões
    if (revision) {
        const proximaData = revision.proximaRevisaoData
            ? new Date(revision.proximaRevisaoData)
            : null;
        const proximoOdometro = parseFloat(revision.proximaRevisaoOdometro || 0);
        const proximoHorimetro = parseFloat(revision.proximaRevisaoHorimetro || 0);

        const readingData = getVehicleMainReading(vehicle);
        const currentReading = readingData.raw;
        const unit = readingData.unit;

        const avisoAntecedencia = parseFloat(revision.avisoAntecedenciaKmHr || 0);
        const avisoDias = parseInt(revision.avisoAntecedenciaDias || 0, 10);

        let metaLeitura = unit === 'Hr' ? proximoHorimetro : proximoOdometro;
        if (!metaLeitura && unit === 'Hr' && proximoOdometro) metaLeitura = proximoOdometro;

        // Vencimento por data
        if (proximaData && now >= proximaData) {
            return { possuiAviso: true, avisoTexto: 'Atenção: Revisão Vencida (Data)!' };
        }
        if (proximaData && avisoDias > 0) {
            const warningDate = new Date(proximaData);
            warningDate.setDate(warningDate.getDate() - avisoDias);
            if (now >= warningDate) {
                return { possuiAviso: true, avisoTexto: 'Atenção: Revisão Próxima (Data)!' };
            }
        }

        // Vencimento por leitura
        if (metaLeitura > 0) {
            if (currentReading >= metaLeitura) {
                return { possuiAviso: true, avisoTexto: `Atenção: Revisão Vencida (${unit})!` };
            }
            if (avisoAntecedencia > 0 && currentReading >= metaLeitura - avisoAntecedencia) {
                return { possuiAviso: true, avisoTexto: `Atenção: Revisão Próxima (${unit})!` };
            }
        }
    }

    // 3. Documentos (apenas caminhões)
    if (isTruck(vehicle.tipo)) {
        const docs = [
            { type: 'Tacógrafo', date: vehicle.validadeTacografo },
            { type: 'AET DAER', date: vehicle.validadeAET_DAER },
            { type: 'AET DNIT', date: vehicle.validadeAET_DNIT },
        ];

        for (const doc of docs) {
            if (!doc.date) continue;
            const d = new Date(doc.date);
            const compareDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

            if (now > compareDate) {
                return { possuiAviso: true, avisoTexto: `Atenção: ${doc.type} Vencido!` };
            }
            if (compareDate <= thirtyDaysFromNow) {
                return { possuiAviso: true, avisoTexto: `Atenção: ${doc.type} Vence em breve!` };
            }
        }
    }

    // 4. Multas Pendentes (lookup O(1) no Set)
    if (hasPendingFine) {
        return { possuiAviso: true, avisoTexto: 'Atenção: Há multas pendentes para este veículo.' };
    }

    return { possuiAviso: false, avisoTexto: '' };
};

/**
 * Função principal: anexa { possuiAviso, avisoTexto } a cada veículo.
 *
 * Complexidade: O(V + R + F) — um passe em cada coleção.
 *
 * @param {Array} vehicles
 * @param {Array} revisions
 * @param {Array} fines
 * @returns {Array} cópia dos veículos com campos extras
 */
export const processVehiclesWithAlerts = (vehicles, revisions = [], fines = []) => {
    if (!Array.isArray(vehicles) || vehicles.length === 0) return [];

    // Pré-indexa
    const revByVehicle = indexRevisionsByVehicle(revisions);
    const finesByVehicle = indexVehiclesWithPendingFines(fines);

    // Data atual normalizada (uma vez para todos)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Único passe nos veículos
    return vehicles.map((vehicle) => {
        const revision = revByVehicle.get(vehicle.id) || null;
        const hasPendingFine = finesByVehicle.has(vehicle.id);
        const alert = processVehicleAlert(vehicle, revision, hasPendingFine, now, thirtyDaysFromNow);
        return { ...vehicle, ...alert };
    });
};
