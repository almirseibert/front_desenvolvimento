// src/utils/vehicleRules.js

export const vehicleGroups = {
    'Veículos Leves': ['Automóvel', 'Camionete', 'Utilitários', 'Moto'],
    'Caminhões': ['Bitruck', 'Caminhão Pipa', 'Caminhão Tanque', 'Caminhão Carroceria', 'Cavalo', 'Caçamba Bitruck', 'Caçamba Toco', 'Caçamba Traçado', 'Caçamba Truckado', 'Caminhão', 'Caçamba'],
    'Caminhões de Trecho': ['Caminhão Prancha', 'Semirreboques'], 
    'Máquinas Pesadas': ['Motoniveladora', 'Pá Carregadeira', 'Retroescavadeira', 'Rolo', 'Trator', 'Escavadeira', 'Escavadeira + Rompedor', 'Fresadora', 'Trator Esteira']
};

// Sub-tipos por tipo principal (select condicional no modal de veículo)
export const vehicleSubTypes = {
    'Caçamba': [
        'Caminhão Caçamba Basculante 7m³', 'Caminhão Caçamba Basculante 10m³',
        'Caminhão Caçamba Basculante 12m³', 'Caminhão Caçamba Basculante 14m³',
        'Caminhão Caçamba Basculante 16m³', 'Caminhão Caçamba Basculante 20m³',
    ],
    'Escavadeira': [
        'Escavadeira Hidráulica 13T', 'Escavadeira Hidráulica 15T',
        'Escavadeira Hidráulica 23T', 'Escavadeira Hidráulica 26T',
        'Escavadeira Hidráulica 35T', 'Escavadeira Hidráulica 36T',
        'Escavadeira Hidráulica + Rompedor', 'Escavadeira Hidráulica Longo Alcance',
    ],
    'Pá Carregadeira': ['Pá Carregadeira 11T', 'Pá Carregadeira 20T'],
    'Trator Esteira':  ['Trator Esteira 21T', 'Trator Esteira 36T'],
};

// =============================================================================
// Unidade de consumo por GRUPO (hidratada do banco em runtime).
// Valores possíveis: 'L/h', 'h/L', 'Km/L', 'L/Km'.
// Seed padrão: derivado da regra histórica (Leves/Trecho = Km/L; resto = L/h).
// =============================================================================
export const groupUnitMap = {};
Object.keys(vehicleGroups).forEach(grupo => {
    groupUnitMap[grupo] = (grupo === 'Veículos Leves' || grupo === 'Caminhões de Trecho') ? 'Km/L' : 'L/h';
});

/**
 * Hidrata a taxonomia em runtime a partir da árvore vinda da API.
 * Muta IN-PLACE vehicleGroups, vehicleSubTypes e groupUnitMap para que os ~38
 * arquivos que importam esses objetos passem a refletir os dados do banco.
 * @param {Array} tree - [{ nome, unidade, tipos: [{ nome, subTipos: [{ nome }] }] }]
 */
export const hydrateVehicleTaxonomy = (tree) => {
    if (!Array.isArray(tree) || tree.length === 0) return;

    // Limpa os objetos preservando a referência
    Object.keys(vehicleGroups).forEach(k => delete vehicleGroups[k]);
    Object.keys(vehicleSubTypes).forEach(k => delete vehicleSubTypes[k]);
    Object.keys(groupUnitMap).forEach(k => delete groupUnitMap[k]);

    tree.forEach(grupo => {
        const tipos = (grupo.tipos || []).map(t => t.nome);
        vehicleGroups[grupo.nome] = tipos;
        groupUnitMap[grupo.nome] = grupo.unidade || 'L/h';
        (grupo.tipos || []).forEach(t => {
            if (t.subTipos && t.subTipos.length > 0) {
                vehicleSubTypes[t.nome] = t.subTipos.map(s => s.nome);
            }
        });
    });
};

/** Retorna o grupo ao qual um tipo pertence (ou null). */
export const getGroupForType = (tipo) =>
    Object.keys(vehicleGroups).find(g => vehicleGroups[g]?.includes(tipo)) || null;

/** Unidade de consumo configurada para o grupo de um tipo. */
export const getGroupUnit = (tipo) => {
    const group = getGroupForType(tipo);
    return (group && groupUnitMap[group]) || 'L/h';
};

/** Qual leitura uma unidade exige: 'odometro' (Km) ou 'horimetro' (Hr). */
export const getReadingSourceForUnit = (unidade) =>
    (unidade === 'Km/L' || unidade === 'L/Km') ? 'odometro' : 'horimetro';

/**
 * Calcula a média de consumo conforme a unidade.
 * @param {string} unidade - 'L/h' | 'h/L' | 'Km/L' | 'L/Km'
 * @param {number} leitura - distância percorrida (Km) ou horas trabalhadas
 * @param {number} litros  - litros abastecidos
 * @returns {number|null}
 */
export const computeConsumption = (unidade, leitura, litros) => {
    const l = parseFloat(leitura);
    const f = parseFloat(litros);
    if (!(l > 0) || !(f > 0)) return null;
    switch (unidade) {
        case 'Km/L': return l / f;   // distância / litros (maior melhor)
        case 'L/Km': return f / l;   // litros / distância (menor melhor)
        case 'h/L':  return l / f;   // horas / litros (maior melhor)
        case 'L/h':
        default:     return f / l;   // litros / horas (menor melhor)
    }
};

/** Para a unidade, valor MAIOR é melhor? (Km/L e h/L). */
export const isHigherBetter = (unidade) => unidade === 'Km/L' || unidade === 'h/L';

export const extraObraOptions = ['Administração', 'Oficina', 'Pátio', 'Rampa', 'Diversos'];
export const operationalSubGroups = ['Administrativo', 'Oficina', 'Operacional', 'Supervisor'];

// Removido "Trator de Esteiras" duplicado/incorreto, mantido apenas o que bate com o grupo: "Trator Esteira"
export const equipmentTypesForHours = ['Caminhão', 'Escavadeira', 'Escavadeira + Rompedor', 'Rolo', 'Retroescavadeira', 'Pá Carregadeira', 'Motoniveladora', 'Trator', 'Trator Esteira', 'Bitruck', 'Caçamba', 'Caminhão Pipa', 'Caminhão Tanque'];

/**
 * Regra 1: Define estritamente quais tipos de leitura são permitidos por grupo.
 * Somente Leves e Caminhões de Trecho usam KM. O resto é Hora.
 */
export const getAllowedReadingTypes = (vehicleType) => {
    const group = Object.keys(vehicleGroups).find(key => vehicleGroups[key].includes(vehicleType));

    // A leitura é derivada da unidade configurada para o grupo:
    //   Km/L | L/Km -> odômetro (Km) · L/h | h/L -> horímetro (Hr)
    if (group && groupUnitMap[group]) {
        return [getReadingSourceForUnit(groupUnitMap[group])];
    }

    // Fallback (taxonomia ainda não hidratada): regra histórica
    if (group === 'Veículos Leves' || group === 'Caminhões de Trecho') {
        return ['odometro'];
    }
    return ['horimetro'];
};

/**
 * Retorna a leitura principal (Valor, Unidade e Label) de forma robusta e unificada.
 */
export const getVehicleMainReading = (vehicle) => {
    if (!vehicle) return { value: 0, unit: '', label: 'N/A', raw: 0 };

    const allowedTypes = getAllowedReadingTypes(vehicle.tipo);
    const usesKm = allowedTypes.includes('odometro');

    if (usesKm) {
        const val = vehicle.odometro || 0;
        return { value: val, unit: 'Km', label: 'Odômetro', raw: parseFloat(val) };
    } else {
        // Regra unificada: Usa apenas a coluna 'horimetro'
        // Tenta pegar horimetro, se não tiver tenta o digital, se não o analógico
        const val = vehicle.horimetro || 0;
        return { value: val, unit: 'Hr', label: 'Horímetro', raw: parseFloat(val) };
    }
};

/**
 * Regras 2 e 3: Validação Rigorosa de Leitura
 * Retorna um objeto { status: 'ok' | 'bloqueio', message: string }
 */
export const checkReadingConsistency = (vehicle, newValueStr, fieldType) => {
    // Se não tiver veículo anterior (criação), não valida consistência de histórico
    if (!vehicle) return { status: 'ok' };

    const newValue = parseFloat(newValueStr);
    if (isNaN(newValue)) return { status: 'ok' }; 

    // Descobre qual é o valor ATUAL salvo no banco
    let currentValue = 0;
    let unit = '';
    let limit = 0;

    // Se o campo editado for odômetro
    if (fieldType === 'odometro') {
        currentValue = parseFloat(vehicle.odometro || 0);
        unit = 'Km';
        limit = 1000; // Regra 2: Trava 1000km de salto
    } 
    // Se o campo editado for horímetro (unificado)
    else if (fieldType === 'horimetro') {
        currentValue = parseFloat(vehicle.horimetro || 0);
        unit = 'Hr';
        limit = 50;   // Regra 3: Trava 50h de salto
    } else {
        // Se o tipo não for passado ou desconhecido, tenta inferir ou ignora
        return { status: 'ok' }; 
    }

    // Regra: Bloquear valor ESTRITAMENTE INFERIOR (Regressão).
    // Tolerância para float (permite valores iguais)
    if (newValue < currentValue - 0.1) {
        return {
            status: 'bloqueio',
            message: `REGRESSÃO DETECTADA: A nova leitura (${newValue} ${unit}) não pode ser menor que a atual (${currentValue} ${unit}).`
        };
    }

    // Regra: Bloquear SALTO excessivo
    const diff = newValue - currentValue;
    if (diff > limit) {
        return {
            status: 'bloqueio',
            message: `SALTO EXCESSIVO: A diferença de ${diff.toFixed(1)} ${unit} excede o limite de segurança (${limit} ${unit}).`
        };
    }

    return { status: 'ok' };
};

/**
 * Regra 4: Verificações de Documentos e Avisos (Separados por Categoria)
 */
export const checkVehicleRestrictions = (vehicle, revisions = []) => {
    const issues = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0); 
    
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // 1. Bloqueio Manual
    if (vehicle.canCirculate === false || vehicle.canCirculate === 0 || vehicle.canCirculate === '0') {
        issues.push({ category: 'bloqueio', type: 'error', message: "BLOQUEIO MANUAL: Veículo marcado como 'NÃO PODE CIRCULAR'." });
    }

    // 2. Revisões (Mecânica)
    const revision = revisions.find(r => r.vehicleId === vehicle.id);
    if (revision) {
        // Por Data
        if (revision.proximaRevisaoData) {
            const revDate = new Date(revision.proximaRevisaoData);
            revDate.setHours(0, 0, 0, 0);
            
            if (now >= revDate) {
                issues.push({ category: 'manutencao', type: 'error', message: `REVISÃO VENCIDA (Data): ${revDate.toLocaleDateString('pt-BR')}.` });
            } else if (revision.avisoAntecedenciaDias > 0) {
                const dataAviso = new Date(revDate);
                dataAviso.setDate(dataAviso.getDate() - revision.avisoAntecedenciaDias);
                if (now >= dataAviso) {
                    issues.push({ category: 'manutencao', type: 'warning', message: `Revisão PRÓXIMA (Data): Vence em ${revDate.toLocaleDateString('pt-BR')}.` });
                }
            }
        }

        // Por Leitura
        const readingInfo = getVehicleMainReading(vehicle);
        const unit = readingInfo.unit; 
        const currentReading = readingInfo.raw;
        
        // Determina meta (unificado horimetro)
        let proximaLeitura = 0;
        if (unit === 'Hr') {
            proximaLeitura = parseFloat(revision.proximaRevisaoHorimetro || 0);
            if (proximaLeitura === 0 && revision.proximaRevisaoOdometro > 0) proximaLeitura = parseFloat(revision.proximaRevisaoOdometro);
        } else {
            proximaLeitura = parseFloat(revision.proximaRevisaoOdometro || 0);
        }

        const avisoAntecedencia = parseFloat(revision.avisoAntecedenciaKmHr || 0);
        
        if (proximaLeitura > 0) {
            if (currentReading >= proximaLeitura) {
                issues.push({ category: 'manutencao', type: 'error', message: `REVISÃO VENCIDA (Leitura): ${currentReading}/${proximaLeitura} ${unit}.` });
            } else if (avisoAntecedencia > 0 && currentReading >= (proximaLeitura - avisoAntecedencia)) {
                const faltam = (proximaLeitura - currentReading).toFixed(1);
                issues.push({ category: 'manutencao', type: 'warning', message: `Revisão PRÓXIMA (Leitura): Faltam ${faltam} ${unit}.` });
            }
        }
    }

    // 3. Documentos (Legal)
    const isTruck = vehicleGroups['Caminhões']?.includes(vehicle.tipo) || vehicleGroups['Caminhões de Trecho']?.includes(vehicle.tipo);

    if (isTruck) {
        const docs = [
            { name: 'Tacógrafo', date: vehicle.validadeTacografo },
            { name: 'AET DAER', date: vehicle.validadeAET_DAER },
            { name: 'AET DNIT', date: vehicle.validadeAET_DNIT },
            { name: 'Licenciamento', date: vehicle.validadeLicenciamento }
        ];

        docs.forEach(doc => {
            if (doc.date) {
                const d = new Date(doc.date);
                const dCompare = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                
                if (now > dCompare) {
                    issues.push({ category: 'documento', type: 'error', message: `${doc.name} VENCIDO.` });
                } else if (dCompare <= thirtyDaysFromNow) {
                    issues.push({ category: 'documento', type: 'warning', message: `${doc.name} vence em breve.` });
                }
            }
        });
    }

    return issues;
};

// =============================================================================
// COMPATIBILIDADE CommonJS (Node.js / Backend)
// Permite que o cronService.js e outros módulos backend façam:
//   const { vehicleGroups } = require('../utils/vehicleRules');
// sem quebrar os imports ES Module do frontend React.
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        vehicleGroups,
        vehicleSubTypes,
        groupUnitMap,
        extraObraOptions,
        operationalSubGroups,
        equipmentTypesForHours,
        getAllowedReadingTypes,
        getVehicleMainReading,
        checkReadingConsistency,
        checkVehicleRestrictions,
        hydrateVehicleTaxonomy,
        getGroupForType,
        getGroupUnit,
        getReadingSourceForUnit,
        computeConsumption,
        isHigherBetter,
    };
}