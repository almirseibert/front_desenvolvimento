// src/utils/terceirizados.js
//
// ============================================================================
// Terceirizados — cálculos puros para gestão de equipamentos locados
// ============================================================================
//
// Fonte ÚNICA de cálculo usada por três consumidores:
//   1. pages/TerceirizadosPage.js       (conta corrente por locador/equipamento)
//   2. análises de obra (Projeção, Aproveitamento, Gestão de Obra)
//   3. relatórios
//
// NÃO recalcula horas nem litros — apenas AGREGA dados que o app já carrega
// no DataContext: vehicles, dailyWorkLogs, refuelings, comboioTransactions,
// partners e terceirizadoPagamentos.
//
// Fórmula por equipamento terceirizado no período [inicio, fim]:
//   tarifaHora        = locacaoValorTotal / locacaoHorasContratadas
//   horas             = Σ dailyWorkLogs.totalHours (sem justificativa)
//   devido            = horas × tarifaHora
//   combustivelAbatido= Σ valor de abastecimento (refuelings + saídas de comboio)
//   pagamentos        = Σ terceirizadoPagamentos
//   saldoAPagar       = devido − combustivelAbatido − pagamentos
//
// Valoração do combustível (NÃO usa preço fixo global — reusa o padrão do
// RefuelingReportModal em PartnersPage.js): litros × (pricePerLiter real do
// abastecimento) e, na falta, litros × fuel_prices[fuelType] do posto parceiro.
// ============================================================================

/** Mapeia o fuelType do comboio (dieselS10/dieselComum) para as chaves de
 *  partner.fuel_prices. Refuelings já usam as chaves "Diesel S10" etc. */
const COMBOIO_FUEL_KEY = {
    dieselS10: 'Diesel S10',
    dieselComum: 'Diesel S500',
};

const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

/** Converte entrada (Date | ISO string | 'YYYY-MM-DD ...') em Date, tolerante. */
const toDate = (input) => {
    if (!input) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    let s = String(input);
    if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
};

/** Extrai a data de um registro que pode usar `date` ou `data`. */
const recordDate = (rec) => toDate(rec?.date ?? rec?.data);

/** Verdadeiro se `d` está dentro de [inicio, fim] (limites inclusivos, opcionais). */
const inPeriod = (d, inicio, fim) => {
    if (!d) return false;
    if (inicio && d < inicio) return false;
    if (fim && d > fim) return false;
    return true;
};

/** Normaliza um período { inicio, fim } (strings ou Date) para Date com limites
 *  de dia. Campos ausentes viram null (sem limite). */
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

/** Tarifa/hora derivada do contrato de locação do equipamento (valor total / horas). */
export const getEquipmentTarifaHora = (vehicle) => {
    const total = num(vehicle?.locacaoValorTotal);
    const horas = num(vehicle?.locacaoHorasContratadas);
    if (horas <= 0) return 0;
    return total / horas;
};

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

/** Valor (R$) de uma saída de comboio (que não tem preço próprio): usa o
 *  pricePerLiter da última ENTRADA do mesmo comboio+combustível anterior à
 *  saída; fallback para o fuel_prices do posto daquela entrada. */
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

/**
 * Calcula os números de terceirizado para UM equipamento no período.
 *
 * @param {object} vehicle  - veículo terceirizado (com contrato de locação)
 * @param {object} ctx      - { dailyWorkLogs, refuelings, comboioTransactions, partners, pagamentos }
 * @param {object} opts     - { inicio, fim, obraId }  (todos opcionais)
 * @returns {object} { horas, tarifaHora, devido, litros, combustivelAbatido, pagamentos, saldo }
 */
export const computeTerceirizadoPorVeiculo = (vehicle, ctx = {}, opts = {}) => {
    const {
        dailyWorkLogs = [],
        refuelings = [],
        comboioTransactions = [],
        partners = [],
        pagamentos = [],
    } = ctx;
    const { obraId } = opts;
    const { inicio, fim } = normalizePeriod(opts);

    const vehicleId = vehicle?.id;
    const tarifaHora = getEquipmentTarifaHora(vehicle);

    // Horas (fonte: relatório de horas do Faturamento)
    const horas = dailyWorkLogs.reduce((acc, log) => {
        if (log?.vehicleId !== vehicleId) return acc;
        if (log?.justificativaTipo) return acc;
        if (obraId && log?.obraId !== obraId) return acc;
        if (!inPeriod(recordDate(log), inicio, fim)) return acc;
        return acc + num(log.totalHours);
    }, 0);

    const devido = horas * tarifaHora;

    // Combustível abatido — abastecimentos comuns
    let litros = 0;
    let combustivelAbatido = 0;
    refuelings.forEach((r) => {
        if (r?.vehicleId !== vehicleId) return;
        if (r?.status && r.status !== 'Concluída') return;
        if (obraId && r?.obraId !== obraId) return;
        if (!inPeriod(recordDate(r), inicio, fim)) return;
        litros += num(r.litrosAbastecidos);
        combustivelAbatido += getRefuelingFuelValue(r, partners);
    });

    // Combustível abatido — saídas de comboio para este equipamento
    comboioTransactions.forEach((t) => {
        if (t?.type !== 'saida') return;
        if (t?.receivingVehicleId !== vehicleId) return;
        if (obraId && t?.obraId !== obraId) return;
        if (!inPeriod(recordDate(t), inicio, fim)) return;
        litros += num(t.liters);
        combustivelAbatido += getComboioSaidaFuelValue(t, comboioTransactions, partners);
    });

    // Pagamentos em dinheiro
    const pagamentosTotal = pagamentos.reduce((acc, p) => {
        if (p?.vehicleId && p.vehicleId !== vehicleId) return acc;
        if (!p?.vehicleId && vehicle?.locadorId && p?.locadorId !== vehicle.locadorId) return acc;
        if (!inPeriod(recordDate(p), inicio, fim)) return acc;
        return acc + num(p.valor);
    }, 0);

    const saldo = devido - combustivelAbatido - pagamentosTotal;

    return {
        vehicleId,
        horas,
        tarifaHora,
        devido,
        litros,
        combustivelAbatido,
        pagamentos: pagamentosTotal,
        saldo,
    };
};

/** Soma dois resultados de terceirizado (usado nas agregações). */
const somaResultado = (a, b) => ({
    horas: a.horas + b.horas,
    devido: a.devido + b.devido,
    litros: a.litros + b.litros,
    combustivelAbatido: a.combustivelAbatido + b.combustivelAbatido,
    pagamentos: a.pagamentos + b.pagamentos,
    saldo: a.saldo + b.saldo,
});

const ZERO = { horas: 0, devido: 0, litros: 0, combustivelAbatido: 0, pagamentos: 0, saldo: 0 };

/**
 * Agrega os números de terceirizado de TODOS os equipamentos locados de um
 * locador, no período.
 * @returns { ...totais, equipamentos: [{ vehicle, ...resultado }] }
 */
export const computeTerceirizadoPorLocador = (locadorId, vehicles = [], ctx = {}, opts = {}) => {
    const equipamentos = vehicles
        .filter((v) => isVehicleTerceirizado(v) && v.locadorId === locadorId)
        .map((vehicle) => ({ vehicle, ...computeTerceirizadoPorVeiculo(vehicle, ctx, opts) }));

    const totais = equipamentos.reduce((acc, e) => somaResultado(acc, e), { ...ZERO });
    return { ...totais, equipamentos };
};

/**
 * Agrega os números de terceirizado dos equipamentos locados alocados a uma
 * obra (via obra.historicoVeiculos), filtrando também por obraId nas horas e
 * no combustível. Usado nas telas de análise de obra.
 * @returns { ...totais, equipamentos: [{ vehicle, ...resultado }] }
 */
export const computeTerceirizadoPorObra = (obraId, obras = [], vehicles = [], ctx = {}, opts = {}) => {
    const obra = obras.find((o) => o.id === obraId);
    if (!obra) return { ...ZERO, equipamentos: [] };

    // IDs de veículos que passaram pela obra
    const vehicleIds = new Set((obra.historicoVeiculos || []).map((h) => h.veiculoId));

    const equipamentos = vehicles
        .filter((v) => isVehicleTerceirizado(v) && vehicleIds.has(v.id))
        .map((vehicle) => ({
            vehicle,
            ...computeTerceirizadoPorVeiculo(vehicle, ctx, { ...opts, obraId }),
        }));

    const totais = equipamentos.reduce((acc, e) => somaResultado(acc, e), { ...ZERO });
    return { ...totais, equipamentos };
};
