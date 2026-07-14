// src/utils/terceirizados.js
// ============================================================================
// Terceirizados — cálculo por CONTRATO (valor fechado)
// ============================================================================
//
// Modelo:
//   1 contrato = 1 terceiro (locador) + 1 obra + valor FECHADO.
//   Horas executadas = acompanhamento físico (progresso), NÃO viram dinheiro.
//   saldo a pagar = valorTotal − diesel abatido − adiantamentos.
//
// As máquinas de um contrato são DERIVADAS (não digitadas): veículos do terceiro
// (isOutsourced + locadorId) que passaram pela obra do contrato
// (obra.historicoVeiculos). O diesel abatido (refuelings + saídas de comboio) e as
// horas são filtrados por obra do contrato e pela vigência do contrato.
//
// Consumidores:
//   1. pages/TerceirizadosPage.js                 (painel terceiro → contrato/obra → máquina)
//   2. components/analise/TerceirizadoObraResumo   (resumo por obra)
// ============================================================================

const COMBOIO_FUEL_KEY = {
    dieselS10: 'Diesel S10',
    dieselComum: 'Diesel S500',
};

const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const toDate = (input) => {
    if (!input) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    let s = String(input);
    if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
};

const recordDate = (rec) => toDate(rec?.date ?? rec?.data);

const inPeriod = (d, inicio, fim) => {
    if (!d) return false;
    if (inicio && d < inicio) return false;
    if (fim && d > fim) return false;
    return true;
};

/** Normaliza { inicio, fim } (strings/Date) para Date com limites de dia. */
export const normalizePeriod = (period = {}) => {
    const { inicio, fim } = period;
    const start = inicio ? toDate(inicio) : null;
    const end = fim ? toDate(fim) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return { inicio: start, fim: end };
};

/** É um veículo terceirizado/locado? */
export const isVehicleTerceirizado = (vehicle) => !!vehicle?.isOutsourced;

/** Valor (R$) de um abastecimento comum, usando preço real e fallback do posto. */
export const getRefuelingFuelValue = (refueling, partners = []) => {
    const litros = num(refueling?.litrosAbastecidos);
    if (litros <= 0) return 0;
    let preco = num(refueling?.pricePerLiter);
    if (preco <= 0) {
        const partner = partners.find((p) => p.id === refueling?.partnerId);
        preco = num(partner?.fuel_prices?.[refueling?.fuelType]);
    }
    return litros * preco;
};

/** Valor (R$) de uma saída de comboio: usa o pricePerLiter da última entrada
 *  do mesmo comboio+combustível anterior à saída; fallback fuel_prices do posto. */
export const getComboioSaidaFuelValue = (saida, comboioTransactions = [], partners = []) => {
    const litros = num(saida?.liters);
    if (litros <= 0) return 0;

    const saidaDate = recordDate(saida);
    const entradas = comboioTransactions
        .filter((t) =>
            t?.type === 'entrada' &&
            t.comboioVehicleId === saida?.comboioVehicleId &&
            t.fuelType === saida?.fuelType)
        .map((t) => ({ t, d: recordDate(t) }))
        .filter((x) => x.d && (!saidaDate || x.d <= saidaDate))
        .sort((a, b) => b.d - a.d);

    const lastEntrada = entradas[0]?.t;
    let preco = num(lastEntrada?.pricePerLiter);
    if (preco <= 0 && lastEntrada) {
        const partner = partners.find((p) => p.id === lastEntrada.partnerId);
        const key = COMBOIO_FUEL_KEY[saida?.fuelType] || saida?.fuelType;
        preco = num(partner?.fuel_prices?.[key]);
    }
    return litros * preco;
};

/** Normaliza o campo `maquinas` do contrato (JSON array de vehicleId). */
export const contratoMaquinaIds = (contrato) => {
    const m = contrato?.maquinas;
    if (Array.isArray(m)) return m.filter(Boolean);
    if (typeof m === 'string') {
        try { const p = JSON.parse(m); return Array.isArray(p) ? p.filter(Boolean) : []; } catch { return []; }
    }
    return [];
};

/** Máquinas de um contrato: vínculo EXPLÍCITO (1 máquina : 1 contrato). */
export const getContratoMachines = (contrato, obras = [], vehicles = []) => {
    const ids = new Set(contratoMaquinaIds(contrato));
    if (ids.size === 0) return [];
    return vehicles.filter((v) => ids.has(v.id));
};

/**
 * Calcula os números de UM contrato.
 * @param {object} contrato
 * @param {object} ctx { vehicles, obras, dailyWorkLogs, refuelings, comboioTransactions, partners, pagamentos }
 * @returns números do contrato + equipamentos detalhados
 */
export const computeContrato = (contrato, ctx = {}) => {
    const {
        vehicles = [], obras = [], dailyWorkLogs = [], refuelings = [],
        comboioTransactions = [], partners = [], pagamentos = [],
    } = ctx;

    const obra = obras.find((o) => o.id === contrato?.obraId) || null;
    const { inicio, fim } = normalizePeriod({ inicio: contrato?.vigenciaInicio, fim: contrato?.vigenciaFim });

    const machines = getContratoMachines(contrato, obras, vehicles);
    const machineIds = new Set(machines.map((v) => v.id));

    // Horas executadas — apenas acompanhamento físico.
    // Atribuição pela MÁQUINA vinculada ao contrato (não por obra), evitando
    // dupla contagem quando o terceiro tem vários contratos na mesma obra.
    let horasExecutadas = 0;
    const horasPorMaquina = new Map();
    dailyWorkLogs.forEach((log) => {
        if (!machineIds.has(log?.vehicleId)) return;
        if (log?.justificativaTipo) return;
        if (!inPeriod(recordDate(log), inicio, fim)) return;
        const h = num(log.totalHours);
        horasExecutadas += h;
        horasPorMaquina.set(log.vehicleId, (horasPorMaquina.get(log.vehicleId) || 0) + h);
    });

    // Diesel abatido — por máquina
    const porMaquina = new Map();
    const bump = (id, litros, valor) => {
        const cur = porMaquina.get(id) || { litros: 0, valor: 0 };
        cur.litros += litros; cur.valor += valor;
        porMaquina.set(id, cur);
    };
    let litros = 0;
    let diesel = 0;

    refuelings.forEach((r) => {
        if (!machineIds.has(r?.vehicleId)) return;
        if (r?.status && r.status !== 'Concluída') return;
        if (!inPeriod(recordDate(r), inicio, fim)) return;
        const v = getRefuelingFuelValue(r, partners);
        const l = num(r.litrosAbastecidos);
        litros += l; diesel += v;
        bump(r.vehicleId, l, v);
    });
    comboioTransactions.forEach((t) => {
        if (t?.type !== 'saida') return;
        if (!machineIds.has(t?.receivingVehicleId)) return;
        if (!inPeriod(recordDate(t), inicio, fim)) return;
        const v = getComboioSaidaFuelValue(t, comboioTransactions, partners);
        const l = num(t.liters);
        litros += l; diesel += v;
        bump(t.receivingVehicleId, l, v);
    });

    // Adiantamentos vinculados ao contrato
    const adiantamentos = pagamentos.reduce(
        (acc, p) => (p?.contratoId === contrato?.id ? acc + num(p.valor) : acc), 0);

    const valorTotal = num(contrato?.valorTotal);
    const saldo = valorTotal - diesel - adiantamentos;
    const horasContratadas = num(contrato?.horasContratadas);
    const progresso = horasContratadas > 0 ? horasExecutadas / horasContratadas : 0;

    const equipamentos = machines.map((v) => {
        const m = porMaquina.get(v.id) || { litros: 0, valor: 0 };
        return { vehicle: v, litros: m.litros, diesel: m.valor, horas: horasPorMaquina.get(v.id) || 0 };
    });

    // Plano contratado por subgrupo (itensContratados), normalizado.
    let itens = contrato?.itensContratados;
    if (typeof itens === 'string') { try { itens = JSON.parse(itens); } catch { itens = []; } }
    const itensContratados = Array.isArray(itens)
        ? itens.filter((i) => i && i.type).map((i) => ({ type: i.type, horas: num(i.hours), valorHora: num(i.price), subtotal: num(i.hours) * num(i.price) }))
        : [];

    return {
        contrato, obra, machines, equipamentos, itensContratados,
        numMaquinas: machines.length,
        horasExecutadas, horasContratadas, progresso,
        valorTotal, litros, diesel, adiantamentos, saldo,
    };
};

/**
 * Lista os abastecimentos (registros individuais) que abatem de UM contrato:
 * refuelings comuns + saídas de comboio das máquinas do contrato, dentro da vigência.
 * Retorna [{ date, vehicle, litros, valor, fonte }] ordenado do mais recente.
 */
export const getContratoAbastecimentos = (contrato, ctx = {}) => {
    const {
        vehicles = [], refuelings = [], comboioTransactions = [], partners = [],
    } = ctx;
    const { inicio, fim } = normalizePeriod({ inicio: contrato?.vigenciaInicio, fim: contrato?.vigenciaFim });
    const machineIds = new Set(contratoMaquinaIds(contrato));
    if (machineIds.size === 0) return [];
    const vById = new Map(vehicles.map((v) => [v.id, v]));
    const out = [];

    refuelings.forEach((r) => {
        if (!machineIds.has(r?.vehicleId)) return;
        if (r?.status && r.status !== 'Concluída') return;
        const d = recordDate(r);
        if (!inPeriod(d, inicio, fim)) return;
        out.push({
            date: d, vehicle: vById.get(r.vehicleId) || null,
            litros: num(r.litrosAbastecidos), valor: getRefuelingFuelValue(r, partners), fonte: 'posto',
        });
    });
    comboioTransactions.forEach((t) => {
        if (t?.type !== 'saida') return;
        if (!machineIds.has(t?.receivingVehicleId)) return;
        const d = recordDate(t);
        if (!inPeriod(d, inicio, fim)) return;
        out.push({
            date: d, vehicle: vById.get(t.receivingVehicleId) || null,
            litros: num(t.liters), valor: getComboioSaidaFuelValue(t, comboioTransactions, partners), fonte: 'comboio',
        });
    });

    return out.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
};

/** Agrega todos os contratos de um terceiro (locador). */
export const computeContratosPorTerceiro = (locadorId, contratos = [], ctx = {}) => {
    const list = contratos
        .filter((c) => c.locadorId === locadorId)
        .map((c) => computeContrato(c, ctx));

    const obraIds = new Set(list.map((r) => r.contrato.obraId));
    const machineIds = new Set();
    list.forEach((r) => r.machines.forEach((m) => machineIds.add(m.id)));

    const totais = list.reduce((a, r) => ({
        valorTotal: a.valorTotal + r.valorTotal,
        diesel: a.diesel + r.diesel,
        adiantamentos: a.adiantamentos + r.adiantamentos,
        saldo: a.saldo + r.saldo,
        litros: a.litros + r.litros,
    }), { valorTotal: 0, diesel: 0, adiantamentos: 0, saldo: 0, litros: 0 });

    return { contratos: list, numObras: obraIds.size, numMaquinas: machineIds.size, ...totais };
};

/**
 * Resumo por OBRA (usado em TerceirizadoObraResumo). Soma os contratos daquela
 * obra. Mantém shape compatível: { equipamentos, devido, combustivelAbatido, saldo }.
 * ctx precisa conter `contratos` (além de vehicles/obras/…).
 */
export const computeTerceirizadoPorObra = (obraId, obras = [], vehicles = [], ctx = {}) => {
    const { contratos = [] } = ctx;
    const doObra = contratos.filter((c) => c.obraId === obraId);
    if (doObra.length === 0) return { equipamentos: [], devido: 0, combustivelAbatido: 0, saldo: 0 };

    const fullCtx = { ...ctx, vehicles, obras };
    const results = doObra.map((c) => computeContrato(c, fullCtx));

    const equipMap = new Map();
    results.forEach((r) => r.equipamentos.forEach((e) => equipMap.set(e.vehicle.id, e)));

    return {
        equipamentos: [...equipMap.values()],
        devido: results.reduce((a, r) => a + r.valorTotal, 0),
        combustivelAbatido: results.reduce((a, r) => a + r.diesel, 0),
        saldo: results.reduce((a, r) => a + r.saldo, 0),
    };
};
