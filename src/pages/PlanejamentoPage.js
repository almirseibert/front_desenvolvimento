import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    RefreshCw, HardHat, TrendingDown, LayoutGrid,
    AlertTriangle, Clock, MapPin, Loader, X, ArrowRight, Truck, User, Pencil
} from 'lucide-react';
import ObraModal from '../components/modals/ObraModal';

// ============================================================================
// PÁGINA DE PLANEJAMENTO ESTRATÉGICO DE OBRAS
// Duas abas:
//  - Kanban: quadro em tela cheia (colunas com scroll interno, sem scroll
//    duplo da página). Pré-obra é arrastável; colunas de andamento são
//    computadas por daily_work_logs.
//  - Balanço: demanda × oferta por subgrupo. Clicar num card abre o detalhe
//    com os veículos por trás dos números (onde cada um está hoje).
// ============================================================================

const PRE_ACTIVE = ['radar', 'planejada', 'mobilizacao'];

// Ciclo 100% automático: criada → radar; contrato de horas → planejada;
// 1ª alocação de máquina → mobilização; 1º lançamento de horas → em andamento.
const COLUNAS = [
    { id: 'radar',       label: 'Radar',        sub: 'sem contrato de horas',      drag: false, cor: '#94a3b8' },
    { id: 'planejada',   label: 'Planejada',    sub: 'contrato registrado',        drag: false, cor: '#f59e0b' },
    { id: 'mobilizacao', label: 'Mobilização',  sub: 'aguardando 1º apontamento',  drag: false, cor: '#8b5cf6' },
    { id: 'and_0_30',    label: 'Em andamento', sub: '0–30%',                     drag: false, cor: '#10b981' },
    { id: 'and_30_70',   label: 'Em andamento', sub: '30–70%',                    drag: false, cor: '#0ea5e9' },
    { id: 'terminando',  label: 'Terminando',   sub: '≥70% ou ≤15 dias',          drag: false, cor: '#ef4444' },
    { id: 'finalizada',  label: 'Finalizadas',  sub: 'últimos 30 dias',           drag: false, cor: '#9ca3af' },
];

const colunaDaObra = (o) => {
    if (o.status === 'finalizada') return 'finalizada';
    if (PRE_ACTIVE.includes(o.status)) return o.status;
    if (o.terminando) return 'terminando';
    // Ativa: faixa por % consumido; sem plano de horas cai em 0-30 (com badge)
    if (o.faixa === '30-70') return 'and_30_70';
    if (o.faixa === '70-100') return 'terminando'; // 70%+ já é critério de Terminando
    return 'and_0_30';
};

const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

// ─── Card de obra (Kanban) ───────────────────────────────────────────────────
const ObraCard = ({ obra, draggable, onDragStart, onOpen }) => {
    const alocadasPorSub = useMemo(() => {
        const m = {};
        (obra.maquinasAlocadas || []).forEach(a => { m[a.subgrupo] = (m[a.subgrupo] || 0) + 1; });
        return m;
    }, [obra.maquinasAlocadas]);

    return (
        <div
            draggable={draggable}
            onDragStart={draggable ? (e) => onDragStart(e, obra) : undefined}
            onClick={() => onOpen(obra)}
            className={`bg-white rounded-lg border p-3 shadow-sm text-sm space-y-2 hover:shadow-md ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            title={draggable ? 'Arraste para mudar a fase · clique para ver o detalhe' : 'Clique para ver o detalhe da obra'}
        >
            <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-gray-800 leading-tight">{obra.nome}</span>
                {obra.pctConsumido != null && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap">
                        {obra.pctConsumido.toFixed(0)}%
                    </span>
                )}
            </div>

            <div className="flex flex-wrap gap-1 text-[10px]">
                {obra.regiao && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex items-center gap-0.5"><MapPin size={9}/>{obra.regiao}</span>}
                {obra.orgao_contratante && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{obra.orgao_contratante}</span>}
                {obra.confiancaInfo && PRE_ACTIVE.includes(obra.status) && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">{obra.confiancaInfo.replace('_', ' ')}</span>
                )}
                {obra.planoNivelGrupo && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-0.5"><AlertTriangle size={9}/>plano por grupo</span>
                )}
                {PRE_ACTIVE.includes(obra.status) && obra.totalContratado === 0 && obra.contractType === 'horas' && (
                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5"><AlertTriangle size={9}/>sem plano de horas</span>
                )}
            </div>

            {/* Datas */}
            <div className="text-[11px] text-gray-500 flex items-center gap-1">
                <Clock size={10}/>
                {PRE_ACTIVE.includes(obra.status)
                    ? `Início previsto: ${fmtData(obra.dataInicioPrevisto)}`
                    : obra.status === 'finalizada'
                        ? `Fim: ${fmtData(obra.dataFim)}`
                        : `Fim previsto: ${fmtData(obra.dataFimPrevisto)}${obra.diasProjetados != null ? ` · proj. ${obra.diasProjetados}d` : ''}`}
            </div>

            {/* Demanda (pré-obra) ou máquinas alocadas (ativa) */}
            {PRE_ACTIVE.includes(obra.status) && obra.perfilDemanda && obra.perfilDemanda.length > 0 && (
                <div className="border-t pt-1.5 space-y-0.5">
                    {obra.perfilDemanda.map(d => (
                        <div key={d.subgrupo} className="flex justify-between text-[11px]">
                            <span className="text-gray-600 truncate pr-1">{d.subgrupo}</span>
                            <span className="font-semibold text-gray-800 whitespace-nowrap">
                                {d.regime === 'escalonado'
                                    ? `${d.maquinasIniciais}→${d.maquinasPico} máq · ${d.diasEstimados}d`
                                    : `${d.maquinasPico} máq · ${d.diasEstimados}d`}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {!PRE_ACTIVE.includes(obra.status) && Object.keys(alocadasPorSub).length > 0 && (
                <div className="border-t pt-1.5 space-y-0.5">
                    {Object.entries(alocadasPorSub).map(([sub, qtd]) => (
                        <div key={sub} className="flex justify-between text-[11px]">
                            <span className="text-gray-600 truncate pr-1">{sub}</span>
                            <span className="font-semibold text-gray-800">{qtd} máq</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Detalhe de veículo (linha do drill-down do balanço) ────────────────────
const VeiculoLinha = ({ v, local }) => (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-gray-50 text-xs">
        <div className="flex items-center gap-2 min-w-0">
            <Truck size={13} className="text-gray-400 flex-shrink-0"/>
            <span className="font-bold text-gray-800 whitespace-nowrap">{v.registroInterno || v.placa || '—'}</span>
            <span className="text-gray-500 truncate">{v.modelo}</span>
        </div>
        <span className={`whitespace-nowrap font-semibold ${local ? 'text-sky-700' : 'text-green-700'}`}>
            {local || 'no pátio / disponível'}
        </span>
    </div>
);

// ─── Modal de detalhe do subgrupo (balanço) ──────────────────────────────────
const SubgrupoDetalheModal = ({ item, onClose }) => (
    <div className="mak-modal-backdrop backdrop-blur-sm" style={{ zIndex: 60 }} onClick={onClose}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
                <div>
                    <h3 className="font-bold text-gray-800">{item.subgrupo}</h3>
                    <p className={`text-xs font-bold ${item.saldo < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {item.saldo < 0 ? `Déficit de ${Math.abs(item.saldo)} máquina(s) → alugar/terceirizar` : `Saldo positivo: +${item.saldo} máquina(s)`}
                    </p>
                </div>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-500"><X size={20}/></button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
                {/* Demanda */}
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Demanda — obras entrando ({item.demanda} máq)</h4>
                    {(item.demandaObras || []).length === 0
                        ? <p className="text-xs text-gray-400 italic">Nenhuma obra planejada exigindo este subgrupo na janela.</p>
                        : (item.demandaObras || []).map((d, i) => (
                            <div key={i} className="flex justify-between text-xs py-1.5 px-2 rounded hover:bg-gray-50">
                                <span className="text-gray-700 font-semibold truncate pr-2">{d.obraNome}</span>
                                <span className="text-gray-500 whitespace-nowrap">{d.maquinas} máq · início {fmtData(d.inicioPrevisto)}</span>
                            </div>
                        ))}
                </div>

                {/* Liberando */}
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Liberando — em obras terminando ({item.liberando})</h4>
                    {(item.liberandoVeiculos || []).length === 0
                        ? <p className="text-xs text-gray-400 italic">Nenhuma máquina deste subgrupo em obra terminando.</p>
                        : (item.liberandoVeiculos || []).map((v, i) => (
                            <VeiculoLinha key={i} v={v} local={`${v.obraNome}${v.regiao ? ` · ${v.regiao}` : ''}`}/>
                        ))}
                </div>

                {/* Disponíveis */}
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Disponíveis agora ({item.disponiveis})</h4>
                    {(item.disponiveisVeiculos || []).length === 0
                        ? <p className="text-xs text-gray-400 italic">Nenhuma máquina disponível deste subgrupo.</p>
                        : (item.disponiveisVeiculos || []).map((v, i) => <VeiculoLinha key={i} v={v}/>)}
                </div>
            </div>
        </div>
    </div>
);

// ─── Modal de detalhe da obra (drill-down do card do Kanban) ─────────────────
const Stat = ({ label, value, alerta }) => (
    <div className={`rounded-lg border p-2 ${alerta ? 'border-red-300 bg-red-50' : 'bg-gray-50'}`}>
        <div className="text-[10px] text-gray-500 uppercase">{label}</div>
        <div className={`text-sm font-bold ${alerta ? 'text-red-600' : 'text-gray-800'}`}>{value}</div>
    </div>
);

const ObraDetalheModal = ({ obra, onClose, onEdit }) => {
    const isPre = PRE_ACTIVE.includes(obra.status);
    const col = COLUNAS.find(c => c.id === colunaDaObra(obra));
    const hoje = new Date();

    const dataProjecao = useMemo(() => {
        if (obra.diasProjetados == null) return null;
        const d = new Date();
        d.setDate(d.getDate() + obra.diasProjetados);
        return d;
    }, [obra.diasProjetados]);
    const projecaoEstoura = !!(dataProjecao && obra.dataFimPrevisto && dataProjecao > new Date(obra.dataFimPrevisto));

    // Execução por subgrupo: união das chaves do plano e do consumido
    const execucao = useMemo(() => {
        const subs = new Set([...Object.keys(obra.plano || {}), ...Object.keys(obra.consumidoPorSubgrupo || {})]);
        return [...subs].map(sub => {
            const contratado = parseFloat(obra.plano?.[sub]) || 0;
            const consumido = obra.consumidoPorSubgrupo?.[sub] || 0;
            return { sub, contratado, consumido, pct: contratado > 0 ? Math.min((consumido / contratado) * 100, 100) : null };
        }).sort((a, b) => b.contratado - a.contratado);
    }, [obra]);

    // Frota: previsto (demanda pré-obra ou necessidade restante) × alocado, por subgrupo.
    // Tolera chave presente só de um lado (plano por grupo × máquina sem sub_tipo).
    const frota = useMemo(() => {
        const previstoPorSub = {};
        if (isPre) {
            (obra.perfilDemanda || []).forEach(d => {
                previstoPorSub[d.subgrupo] = {
                    qtd: d.maquinasPico,
                    texto: d.regime === 'escalonado' ? `${d.maquinasIniciais}→${d.maquinasPico}` : `${d.maquinasPico}`,
                };
            });
        } else {
            (obra.necessidadeAtual || []).forEach(d => {
                previstoPorSub[d.subgrupo] = { qtd: d.maquinasNecessarias, texto: `${d.maquinasNecessarias}` };
            });
        }
        const alocadoPorSub = {};
        (obra.maquinasAlocadas || []).forEach(m => { alocadoPorSub[m.subgrupo] = (alocadoPorSub[m.subgrupo] || 0) + 1; });

        const subs = new Set([...Object.keys(previstoPorSub), ...Object.keys(alocadoPorSub)]);
        return [...subs]
            .map(sub => {
                const previsto = previstoPorSub[sub] || null;
                const alocado = alocadoPorSub[sub] || 0;
                return { sub, previsto, alocado, saldo: alocado - (previsto ? previsto.qtd : 0) };
            })
            .filter(f => f.alocado > 0 || (f.previsto && f.previsto.qtd > 0))
            .sort((a, b) => a.saldo - b.saldo);
    }, [obra, isPre]);

    const badgeCobertura = (f) => {
        if (!f.previsto) return <span className="text-gray-400 font-semibold">fora do plano</span>;
        if (f.saldo < 0) return <span className={`font-bold ${f.alocado === 0 ? 'text-red-600' : 'text-amber-600'}`}>faltam {Math.abs(f.saldo)}</span>;
        if (f.saldo > 0) return <span className="text-sky-600 font-bold">sobra +{f.saldo}</span>;
        return <span className="text-green-700 font-bold">ok</span>;
    };

    // Situação de apontamento por máquina (só faz sentido em obra ativa)
    const statusApontamento = (m) => {
        if (obra.status !== 'ativa') return null;
        if (!m.ultimoApontamento) return { alerta: true, texto: 'sem apontamento' };
        const dias = Math.floor((hoje - new Date(m.ultimoApontamento)) / 86400000);
        if (dias > 3) return { alerta: true, texto: `parada há ${dias}d` };
        return { alerta: false, texto: `últ. apont. ${fmtData(m.ultimoApontamento)}` };
    };

    // Previsão de liberação: data manual da máquina > projeção da obra > fim previsto
    const previsaoLib = (m) => {
        if (m.previsaoLiberacao) return { data: m.previsaoLiberacao, manual: true };
        if (dataProjecao) return { data: dataProjecao, manual: false };
        if (obra.dataFimPrevisto) return { data: obra.dataFimPrevisto, manual: false };
        return null;
    };

    const maquinas = obra.maquinasAlocadas || [];

    return (
        <div className="mak-modal-backdrop backdrop-blur-sm" style={{ zIndex: 60 }} onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Cabeçalho */}
                <div className="flex justify-between items-start p-4 border-b gap-3 flex-shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-800 text-base">{obra.nome}</h3>
                            {col && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ background: col.cor }}>
                                    {col.label} · {col.sub}
                                </span>
                            )}
                            {obra.pctConsumido != null && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{obra.pctConsumido.toFixed(0)}%</span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                            {obra.regiao && <span className="flex items-center gap-0.5"><MapPin size={11}/>{obra.regiao}</span>}
                            {obra.orgao_contratante && <span>{obra.orgao_contratante}</span>}
                            {obra.responsavel && <span className="flex items-center gap-0.5"><User size={11}/>{obra.responsavel}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5 text-[10px]">
                            {obra.confiancaInfo && isPre && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">{obra.confiancaInfo.replace('_', ' ')}</span>
                            )}
                            {obra.planoNivelGrupo && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-0.5"><AlertTriangle size={9}/>plano por grupo</span>
                            )}
                            {obra.terminando && (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">terminando</span>
                            )}
                            {obra.totalContratado === 0 && obra.contractType === 'horas' && obra.status !== 'finalizada' && (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5"><AlertTriangle size={9}/>sem plano de horas</span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-500 flex-shrink-0"><X size={20}/></button>
                </div>

                <div className="p-4 space-y-5 overflow-y-auto">
                    {/* Prazo e ritmo */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Stat
                            label={isPre ? 'Início previsto' : 'Início'}
                            value={fmtData(isPre ? obra.dataInicioPrevisto : (obra.dataInicio || obra.dataInicioPrevisto))}
                        />
                        <Stat
                            label={obra.status === 'finalizada' ? 'Fim' : 'Fim previsto'}
                            value={fmtData(obra.status === 'finalizada' ? obra.dataFim : obra.dataFimPrevisto)}
                        />
                        {obra.status === 'ativa' && (
                            <Stat
                                label="Projeção de término"
                                value={dataProjecao ? `${fmtData(dataProjecao)} (${obra.diasProjetados}d)` : '—'}
                                alerta={projecaoEstoura}
                            />
                        )}
                        {obra.status === 'ativa' && (
                            <Stat label="Ritmo (14d)" value={obra.ritmoDia > 0 ? `${obra.ritmoDia} h/dia` : '—'}/>
                        )}
                    </div>

                    {/* Execução do contrato */}
                    {execucao.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                Execução do contrato — {Math.round(obra.totalConsumido || 0)}h de {Math.round(obra.totalContratado || 0)}h
                            </h4>
                            <div className="space-y-2">
                                {execucao.map(e => (
                                    <div key={e.sub}>
                                        <div className="flex justify-between text-[11px] mb-0.5">
                                            <span className="text-gray-700 font-semibold truncate pr-2">{e.sub}</span>
                                            <span className="text-gray-500 whitespace-nowrap">
                                                {Math.round(e.consumido)}h / {e.contratado > 0 ? `${Math.round(e.contratado)}h` : 'sem contrato'}
                                                {e.pct != null && ` · ${e.pct.toFixed(0)}%`}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${e.pct == null ? 'bg-gray-300' : e.pct >= 70 ? 'bg-red-400' : e.pct >= 30 ? 'bg-sky-400' : 'bg-green-400'}`}
                                                style={{ width: `${e.pct ?? 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Frota: previsto × alocado */}
                    {frota.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">
                                {isPre ? 'Frota — demanda × alocado' : 'Frota — necessário (restante) × alocado'}
                            </h4>
                            {frota.map(f => (
                                <div key={f.sub} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-gray-50">
                                    <span className="text-gray-700 font-semibold truncate pr-2">{f.sub}</span>
                                    <span className="flex items-center gap-3 whitespace-nowrap">
                                        <span className="text-gray-500">{isPre ? 'demanda' : 'necessário'}: <b className="text-gray-800">{f.previsto ? f.previsto.texto : '—'}</b></span>
                                        <span className="text-gray-500">alocado: <b className="text-gray-800">{f.alocado}</b></span>
                                        {badgeCobertura(f)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Máquinas alocadas */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Máquinas alocadas ({maquinas.length})</h4>
                        {maquinas.length === 0
                            ? <p className="text-xs text-gray-400 italic">Nenhuma máquina alocada nesta obra.</p>
                            : maquinas.map(m => {
                                const ap = statusApontamento(m);
                                const lib = obra.terminando ? previsaoLib(m) : null;
                                return (
                                    <div key={m.veiculoId} className="py-1.5 px-2 rounded hover:bg-gray-50 text-xs space-y-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Truck size={13} className="text-gray-400 flex-shrink-0"/>
                                                <span className="font-bold text-gray-800 whitespace-nowrap">{m.registroInterno || m.placa || '—'}</span>
                                                <span className="text-gray-500 truncate">{m.modelo}</span>
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] whitespace-nowrap">{m.subgrupo}</span>
                                            </div>
                                            {ap && (
                                                <span className={`whitespace-nowrap font-semibold ${ap.alerta ? 'text-red-600' : 'text-gray-500'}`}>
                                                    {ap.alerta && <AlertTriangle size={11} className="inline mr-0.5 -mt-0.5"/>}{ap.texto}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pl-[21px] text-[11px] text-gray-500">
                                            <span className="flex items-center gap-2 min-w-0">
                                                {m.employeeName && <span className="flex items-center gap-0.5 truncate"><User size={10}/>{m.employeeName}</span>}
                                                <span className="whitespace-nowrap">entrada {fmtData(m.dataEntrada)}</span>
                                                <span className="whitespace-nowrap">{Math.round(m.horasApontadas || 0)}h apontadas</span>
                                            </span>
                                            {lib && (
                                                <span className="text-red-600 font-semibold whitespace-nowrap">
                                                    libera ~{fmtData(lib.data)}{lib.manual ? ' (manual)' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    {/* Dimensionamento (pré-obra) */}
                    {isPre && (obra.perfilDemanda || []).length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Dimensionamento (perfil de demanda)</h4>
                            {obra.perfilDemanda.map(d => (
                                <div key={d.subgrupo} className="flex justify-between text-xs py-1.5 px-2 rounded hover:bg-gray-50">
                                    <span className="text-gray-700 font-semibold truncate pr-2">
                                        {d.subgrupo} <span className="text-gray-400 font-normal">· {Math.round(d.horasContratadas)}h</span>
                                    </span>
                                    <span className="text-gray-600 whitespace-nowrap">
                                        {d.regime === 'escalonado'
                                            ? `${d.maquinasIniciais} máq até o dia ${d.diaReforco}, depois ${d.maquinasPico} · ~${d.diasEstimados}d`
                                            : `${d.maquinasPico} máq constante · ~${d.diasEstimados}d`}
                                        {d.folga && <span className="ml-1 text-sky-600 font-semibold">(folga)</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Informações de planejamento */}
                    {(obra.origemInfo || obra.obsPlanejamento) && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Informações de planejamento</h4>
                            {obra.origemInfo && <p className="text-xs text-gray-600"><b>Origem da informação:</b> {obra.origemInfo}</p>}
                            {obra.obsPlanejamento && <p className="text-xs text-gray-600 whitespace-pre-wrap mt-1">{obra.obsPlanejamento}</p>}
                        </div>
                    )}
                </div>

                {/* Rodapé */}
                <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50">Fechar</button>
                    <button onClick={onEdit} className="px-4 py-2 text-sm rounded-lg bg-yellow-500 text-white font-bold hover:bg-yellow-600 flex items-center gap-1.5">
                        <Pencil size={14}/> Editar obra
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Página ──────────────────────────────────────────────────────────────────
const PlanejamentoPage = ({ apiClient, setAlertMessage, user, employees, equipmentTypesForHours, obras: obrasCadastro }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [janela, setJanela] = useState(60);
    const [aba, setAba] = useState('kanban'); // 'kanban' | 'balanco'
    const [dragOverCol, setDragOverCol] = useState(null);
    const [confirmMove, setConfirmMove] = useState(null); // { obra, destino }
    const [detalheSub, setDetalheSub] = useState(null);   // item do balanço clicado
    const [detalheObra, setDetalheObra] = useState(null); // card do Kanban clicado
    const [editObra, setEditObra] = useState(null);       // obra completa (do cadastro) sendo editada
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const d = await apiClient.getPlanejamentoObras(janela);
            setData(d);
        } catch (e) {
            console.error('Erro ao carregar planejamento:', e);
            setAlertMessage(e.message || 'Erro ao carregar o planejamento.');
        } finally {
            setLoading(false);
        }
    }, [apiClient, janela, setAlertMessage]);

    useEffect(() => { load(); }, [load]);

    const porColuna = useMemo(() => {
        const m = {};
        COLUNAS.forEach(c => { m[c.id] = []; });
        (data?.obras || []).forEach(o => {
            const col = colunaDaObra(o);
            if (m[col]) m[col].push(o);
        });
        // Pré-obra: ordena por previsão de início; demais por % desc
        ['radar', 'planejada', 'mobilizacao'].forEach(c => {
            m[c].sort((a, b) => (a.dataInicioPrevisto || '9999') > (b.dataInicioPrevisto || '9999') ? 1 : -1);
        });
        return m;
    }, [data]);

    // ─── Drag & drop (somente colunas de decisão) ───
    const handleDragStart = (e, obra) => {
        e.dataTransfer.setData('text/plain', obra.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e, colId) => {
        e.preventDefault();
        setDragOverCol(null);
        const obraId = e.dataTransfer.getData('text/plain');
        const obra = (data?.obras || []).find(o => o.id === obraId);
        if (!obra || !PRE_ACTIVE.includes(obra.status) || obra.status === colId) return;
        setConfirmMove({ obra, destino: colId });
    };

    const executeMove = async () => {
        if (!confirmMove) return;
        setSaving(true);
        try {
            await apiClient.updateObra(confirmMove.obra.id, { status: confirmMove.destino });
            setConfirmMove(null);
            await load();
        } catch (e) {
            setAlertMessage(e.message || 'Erro ao mudar a fase da obra.');
        } finally {
            setSaving(false);
        }
    };

    const labelColuna = (id) => {
        const c = COLUNAS.find(x => x.id === id);
        return c ? `${c.label} (${c.sub})` : id;
    };

    // O objeto do planejamento é uma projeção — a edição usa o cadastro completo
    const openEditObra = () => {
        const full = (obrasCadastro || []).find(o => o.id === detalheObra?.id);
        if (!full) {
            setAlertMessage('Cadastro completo da obra não encontrado. Atualize a página e tente novamente.');
            return;
        }
        setDetalheObra(null);
        setEditObra(full);
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-96 text-gray-400">
                <Loader className="animate-spin mr-2" size={20}/> Carregando planejamento...
            </div>
        );
    }

    const balanco = data?.balanco || [];
    const deficits = balanco.filter(b => b.saldo < 0).length;

    return (
        // O wrapper do App já tem p-4/sm:p-6 e overflow-y-auto; a página dimensiona
        // a própria altura para caber sem gerar o segundo scroll da página.
        <div className="flex flex-col h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] overflow-hidden">
            {/* Cabeçalho compacto: título + abas + controles em uma linha */}
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 mb-3 flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                    <HardHat className="text-yellow-500"/> Planejamento de Obras
                </h1>

                {/* Abas */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                    <button
                        onClick={() => setAba('kanban')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 transition-colors ${aba === 'kanban' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <LayoutGrid size={14}/> Quadro
                    </button>
                    <button
                        onClick={() => setAba('balanco')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 transition-colors ${aba === 'balanco' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <TrendingDown size={14}/> Balanço
                        {deficits > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{deficits}</span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={janela}
                        onChange={(e) => setJanela(parseInt(e.target.value, 10))}
                        className="p-2 border rounded-lg text-sm bg-white"
                    >
                        <option value={30}>Janela: 30 dias</option>
                        <option value={60}>Janela: 60 dias</option>
                        <option value={90}>Janela: 90 dias</option>
                    </select>
                    <button onClick={load} className="p-2 border rounded-lg bg-white hover:bg-gray-50" title="Atualizar">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </div>

            {/* ══ ABA: KANBAN ══ — ocupa todo o espaço restante, cada coluna com scroll próprio */}
            {aba === 'kanban' && (
                <div className="flex gap-3 overflow-x-auto flex-1 min-h-0 pb-2">
                    {COLUNAS.map(col => (
                        <div
                            key={col.id}
                            onDragOver={col.drag ? (e) => { e.preventDefault(); setDragOverCol(col.id); } : undefined}
                            onDragLeave={col.drag ? () => setDragOverCol(null) : undefined}
                            onDrop={col.drag ? (e) => handleDrop(e, col.id) : undefined}
                            className={`flex-shrink-0 w-64 xl:w-auto xl:flex-1 xl:min-w-[220px] rounded-xl p-2 flex flex-col transition-colors ${dragOverCol === col.id ? 'bg-yellow-50 ring-2 ring-yellow-300' : 'bg-gray-100'}`}
                        >
                            <div className="px-2 py-1.5 mb-2 flex-shrink-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: col.cor }}/>
                                        {col.label}
                                    </span>
                                    <span className="text-xs font-bold text-gray-400">{porColuna[col.id].length}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                    {col.sub}
                                    {!col.drag && <span title="Coluna calculada automaticamente — não arrastável">· auto</span>}
                                </div>
                            </div>
                            <div className="space-y-2 flex-1 overflow-y-auto px-0.5 min-h-0">
                                {porColuna[col.id].map(o => (
                                    <ObraCard key={o.id} obra={o} draggable={col.drag} onDragStart={handleDragStart} onOpen={setDetalheObra}/>
                                ))}
                                {porColuna[col.id].length === 0 && (
                                    <div className="text-center text-[11px] text-gray-300 italic py-6 border border-dashed border-gray-200 rounded-lg">
                                        vazio
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ══ ABA: BALANÇO ══ */}
            {aba === 'balanco' && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <p className="text-sm text-gray-500 mb-3">
                        Demanda (obras entrando) × oferta (máquinas liberando + disponíveis) por subgrupo — próximos {janela} dias.
                        Clique em um card para ver os veículos.
                    </p>
                    {balanco.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">
                            Sem demanda planejada nem obras terminando na janela. Cadastre obras futuras (fase Radar/Planejada) para alimentar o balanço.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
                            {balanco.map(b => (
                                <button key={b.subgrupo}
                                    onClick={() => setDetalheSub(b)}
                                    className={`rounded-lg border p-3 text-xs text-left transition-shadow hover:shadow-md ${b.saldo < 0 ? 'border-red-300 bg-red-50' : b.saldo === 0 ? 'border-yellow-300 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
                                    <div className="font-bold text-gray-800 truncate text-sm" title={b.subgrupo}>{b.subgrupo}</div>
                                    <div className="flex justify-between mt-2 text-gray-600">
                                        <span>Demanda: <b>{b.demanda}</b></span>
                                        <span>Liberando: <b>{b.liberando}</b></span>
                                        <span>Disp.: <b>{b.disponiveis}</b></span>
                                    </div>
                                    <div className={`mt-2 font-bold ${b.saldo < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                        {b.saldo < 0 ? `DÉFICIT: ${Math.abs(b.saldo)} máq → alugar/terceirizar` : `Saldo: +${b.saldo} máq`}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de detalhe do subgrupo */}
            {detalheSub && <SubgrupoDetalheModal item={detalheSub} onClose={() => setDetalheSub(null)}/>}

            {/* Modal de detalhe da obra (card do Kanban clicado) */}
            {detalheObra && (
                <ObraDetalheModal obra={detalheObra} onClose={() => setDetalheObra(null)} onEdit={openEditObra}/>
            )}

            {/* Edição da obra sem sair do planejamento */}
            {editObra && (
                <ObraModal
                    user={user}
                    obra={editObra}
                    onClose={() => setEditObra(null)}
                    apiClient={apiClient}
                    reloadData={load}
                    setAlertMessage={setAlertMessage}
                    equipmentTypesForHours={equipmentTypesForHours || []}
                    employees={employees || []}
                />
            )}

            {/* Confirmação de mudança de fase */}
            {confirmMove && (
                <div className="mak-modal-backdrop backdrop-blur-sm" style={{ zIndex: 60 }}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Mudar fase da obra</h3>
                            <button onClick={() => setConfirmMove(null)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500"><X size={20}/></button>
                        </div>
                        <p className="text-sm text-gray-600">
                            <b>{confirmMove.obra.nome}</b>
                        </p>
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-gray-100 font-semibold">{labelColuna(confirmMove.obra.status)}</span>
                            <ArrowRight size={14}/>
                            <span className="px-2 py-0.5 rounded bg-yellow-100 font-semibold">{labelColuna(confirmMove.destino)}</span>
                        </p>
                        {confirmMove.destino === 'planejada' && confirmMove.obra.totalContratado === 0 && confirmMove.obra.contractType === 'horas' && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1">
                                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0"/>
                                Esta obra ainda não tem plano de horas por equipamento. Edite a obra e cadastre o plano oficial para que ela conte no balanço.
                            </p>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setConfirmMove(null)} className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50" disabled={saving}>
                                Cancelar
                            </button>
                            <button onClick={executeMove} className="px-4 py-2 text-sm rounded-lg bg-yellow-500 text-white font-bold hover:bg-yellow-600 flex items-center gap-2" disabled={saving}>
                                {saving && <Loader size={14} className="animate-spin"/>} Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlanejamentoPage;
