// src/utils/vehicleRules.js

export const vehicleGroups = {
    'Veículos Leves': ['Automóvel', 'Camionete', 'Utilitários', 'Moto'],
    'Caminhões': ['Bitruck', 'Caminhão Pipa', 'Caminhão Tanque', 'Caminhão Carroceria', 'Cavalo', 'Caçamba Bitruck', 'Caçamba Toco', 'Caçamba Traçado', 'Caçamba Truckado', 'Caminhão', 'Caçamba'],
    'Caminhões de Trecho': ['Caminhão Prancha', 'Semirreboques'], 
    'Máquinas Pesadas': ['Motoniveladora', 'Pá Carregadeira', 'Retroescavadeira', 'Rolo', 'Trator', 'Escavadeira', 'Escavadeira + Rompedor', 'Fresadora', 'Trator Esteira']
};

export const extraObraOptions = ['Administração', 'Oficina', 'Pátio', 'Rampa', 'Diversos'];
export const operationalSubGroups = ['Administrativo', 'Oficina', 'Operacional', 'Supervisor'];

// Removido "Trator de Esteiras" duplicado/incorreto, mantido apenas o que bate com o grupo: "Trator Esteira"
export const equipmentTypesForHours = ['Caminhão', 'Escavadeira', 'Escavadeira + Rompedor', 'Rolo', 'Retroescavadeira', 'Pá Carregadeira', 'Motoniveladora', 'Trator', 'Trator Esteira', 'Bitruck', 'Caçamba', 'Caminhão Pipa', 'Caminhão Tanque'];

/**
 * Regra 1: Define estritamente quais tipos de leitura são permitidos por grupo.
 * Somente Leves e Caminhões de Trecho usam KM. O resto é Hora.
 */
export const getAllowedReadingTypes = (vehicleType) => {
    // Busca o grupo do veículo
    const group = Object.keys(vehicleGroups).find(key => vehicleGroups[key].includes(vehicleType));

    // Regra Global 1:
    // Leves e Trecho -> Odômetro (Km)
    if (group === 'Veículos Leves' || group === 'Caminhões de Trecho') {
        return ['odometro'];
    }
    
    // Caminhões Pesados e Máquinas -> Horímetro (Hr)
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
            // Mapeamento extra caso os nomes no banco sejam diferentes (como no seu exemplo anterior)
            { name: 'Tacógrafo', date: vehicle.validadeTacografo }, 
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
        extraObraOptions,
        operationalSubGroups,
        equipmentTypesForHours,
        getAllowedReadingTypes,
        getVehicleMainReading,
        checkReadingConsistency,
        checkVehicleRestrictions,
    };
}