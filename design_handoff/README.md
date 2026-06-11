# MAK Serviços — Design Handoff v2

> **Para o Claude Code:** Os arquivos HTML nesta pasta são **referências visuais aprovadas** — protótipos de alta fidelidade. Sua tarefa é replicar o visual pixel a pixel no codebase React + Tailwind existente. Não reinterprete, não "melhore", não adapte ao seu estilo — apenas transponha fielmente para o código React.

---

## Stack do Projeto

| Item | Tecnologia |
|---|---|
| Framework | React (Vite ou CRA) |
| Estilo | Tailwind CSS |
| Ícones | Lucide React (`lucide-react`) |
| Fonte | Roboto (Google Fonts) — 300, 400, 500, 600, 700, 900 |
| Fonte mono | Roboto Mono (Google Fonts) — 400, 500, 700 |
| Idioma | 100% Português Brasileiro |
| Repositório de referência | `almirseibert/front_desenvolvimento` |

---

## Como Usar Este Handoff

1. **Abra o arquivo HTML** de referência no navegador
2. **Inspecione o elemento** que deseja implementar (DevTools → Elements)
3. **Transponha para React + Tailwind** usando os tokens abaixo
4. **Compare lado a lado** o componente implementado com o HTML de referência
5. **Peça correção específica** se algo diferir: "o padding do botão está 4px menor que o esperado"

---

## Arquivos de Referência

```
design_handoff/
├── README.md                    ← este arquivo (v2)
├── PROMPT_EXEMPLO.md            ← prompts prontos para o Claude Code
├── tokens/
│   └── colors_and_type.css      ← todos os tokens CSS (cole no globals.css)
├── components/
│   ├── buttons.html             ← todos os estados de botão
│   ├── badges.html              ← status pills, micro badges, notificação, progresso
│   ├── inputs.html              ← inputs, selects, textarea, toggles
│   ├── cards.html               ← KPI cards, list cards, accent-bar cards
│   ├── tables.html              ← tabela de frota com indicadores de alerta
│   ├── sidebar.html             ← navegação lateral expandida
│   └── modals.html              ← modal de formulário + modal destrutivo
└── prototype/
    └── index.html               ← protótipo completo interativo (referência master)
```

---

## Design Tokens — Resumo Executivo

### Tema: Terroso Mineral

Paleta aquecida com tons terrosos e âmbar. Evita o azul/cinza frio do Tailwind padrão.

### Cores Brand & Shell

```css
/* Brand */
--brand-amber:        #9E7A42   (CTA primário bg)
--brand-amber-hover:  #8a6a34   (CTA hover)
--brand-gold:         #facc15   (destaque dourado)
--brand-gold-hover:   #eab308   (destaque hover)

/* Sidebar — ton terroso escuro */
--sidebar-bg:         #1c1a17
--sidebar-surface:    #252018
--sidebar-hover:      #2e2820
--sidebar-border:     #3d3528
--sidebar-text:       #8a7a68
--sidebar-text-dim:   #5a4e3a
--sidebar-text-hi:    #f0ebe3
--sidebar-active-bg:  #9E7A42
--sidebar-active-text:#ffffff

/* App shell */
--app-bg:             #f5f3ef   (off-white terroso)
--surface:            #ffffff
--surface-subtle:     #faf9f7
--surface-muted:      #f5f2ed

/* Texto */
--fg1:  #1e1a14   (títulos de página)
--fg2:  #3d3528   (títulos de card, body padrão)
--fg3:  #6a5e4e   (texto secundário)
--fg4:  #9a8a78   (texto de suporte)
--fg5:  #b0a090   (placeholder, disabled)

/* Bordas */
--border:         #e8e0d4
--border-subtle:  #f0ebe3
--border-strong:  #d4c8b8

/* Semântico */
--color-success:  #3d5a44   bg: #f3f8f4   border: #b8d4bc
--color-warning:  #a06828   bg: #fdf8ec   border: #e8d8bc
--color-danger:   #b03828   bg: #fdf0ec   border: #e8c8bc
--color-info:     #2d5a8a   bg: #eff5fc   border: #c0d4e8
```

### Status de Veículos

| Status | Bg | Texto | Dot | Border |
|---|---|---|---|---|
| Disponível | `#d1fae5` | `#065f46` | `#10b981` | `#a7f3d0` |
| Em Obra | `#e0f2fe` | `#0c4a6e` | `#0ea5e9` | `#bae6fd` |
| Em Operação | `#ede9fe` | `#3730a3` | `#8b5cf6` | `#ddd6fe` |
| Em Manutenção | `#ffedd5` | `#9a3412` | `#f97316` | `#fed7aa` |
| Aguardando Manutenção | `#fef3c7` | `#78350f` | `#fbbf24` animate-pulse | `#fde68a` |
| Sucata | `#f4f4f5` | `#3f3f46` | `#71717a` | `#d4d4d8` |
| Inativo | `#f3f4f6` | `#6b7280` | `#9ca3af` | `#e5e7eb` |
| Terceirizado | `#f3e8ff` | `#6b21a8` | `#a855f7` | `#e9d5ff` |

### Micro Badges de Papel (Role)

| Role | Bg | Texto | Border |
|---|---|---|---|
| Visualizador | `#f1f5f9` | `#475569` | `#cbd5e1` |
| Editor | `#fef9c3` | `#854d0e` | `#fef08a` |
| Admin | `#dbeafe` | `#1e40af` | `#bfdbfe` |
| Vencido | `#fdf0ec` | `#b03828` | `#e8c8bc` |
| Aguardando | `#fef3c7` | `#78350f` | `#fde68a` |

---

## Componentes — Especificações Exatas

### Botões

```jsx
// Primary CTA — âmbar terroso
<button className="bg-[#9E7A42] hover:bg-[#8a6a34] text-white font-bold text-sm px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors">
  <PlusCircle size={15} />
  Nova Obra
</button>

// Primary sm
<button className="bg-[#9E7A42] hover:bg-[#8a6a34] text-white font-bold text-xs px-2.5 py-[5px] rounded-md shadow-sm flex items-center gap-1.5 transition-colors">
  Novo Veículo
</button>

// Secondary
<button className="bg-white border border-[#e8e0d4] text-[#6a5e4e] hover:bg-[#faf9f7] text-sm font-medium px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors">
  <Download size={15} />
  Exportar
</button>

// Danger
<button className="bg-[#b03828] hover:bg-[#9a2e20] text-white font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
  <Trash2 size={15} />
  Excluir Veículo
</button>

// Dark
<button className="bg-[#1c1a17] text-[#f0ebe3] font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
  <MapPin size={15} />
  Ver no Mapa
</button>

// Ghost
<button className="text-[#9a8a78] hover:bg-[#f5f2ed] hover:text-[#1e1a14] text-sm font-medium px-4 py-2 rounded-lg transition-colors">
  Cancelar
</button>

// Icon button (ação em tabela/card)
<button className="p-1 rounded-md text-[#b0a090] hover:text-[#b03828] hover:bg-[#fdf0ec] transition-colors">
  <Trash2 size={13} />
</button>

// Disabled (qualquer variante)
<button className="... opacity-45 cursor-not-allowed" disabled>
```

### Inputs

```jsx
// Label padrão
<label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6a5e4e] block mb-1">
  Nome do Veículo
</label>

// Input padrão
<input
  className="w-full px-2.5 py-2 border border-[#e8e0d4] rounded-lg bg-[#faf9f7] text-[13px] text-[#3d3528]
             placeholder:text-[#b0a090]
             focus:ring-[3px] focus:ring-[#9E7A42]/20 focus:border-[#9E7A42] focus:bg-white outline-none transition"
/>

// Search input
<div className="relative">
  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b0a090]" size={14} />
  <input
    className="pl-[30px] pr-3 py-2 border border-[#e8e0d4] rounded-lg bg-[#faf9f7] text-[13px]
               placeholder:text-[#b0a090]
               focus:ring-[3px] focus:ring-[#9E7A42]/20 focus:border-[#9E7A42] focus:bg-white outline-none"
    placeholder="Buscar por nome ou placa…"
  />
</div>

// Input com erro
<input className="... border-[#b03828]" />
<span className="text-[11px] text-[#b03828] mt-1">Campo obrigatório.</span>

// Placa / hodômetro — sempre monospace
<input className="... font-mono tracking-[0.05em]" placeholder="AAA-0A00" />

// Toggle
<label className="relative w-9 h-5 cursor-pointer block">
  <input type="checkbox" className="sr-only peer" />
  <div className="w-full h-full rounded-full bg-[#d4c8b8] peer-checked:bg-[#9E7A42] transition-colors" />
  <div className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
</label>
```

### Badges de Status

```jsx
// Estrutura base — 3 camadas obrigatórias: fundo + borda + texto
<span className="inline-flex items-center gap-[5px] px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap"
      style={{ background: BG, borderColor: BORDER, color: TEXT }}>
  <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: DOT }} />
  {label}
</span>

// Micro badge (sem dot)
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border"
      style={{ background: BG, borderColor: BORDER, color: TEXT }}>
  {label}
</span>

// Aguardando Manutenção — dot pulsante
<span className="w-[7px] h-[7px] rounded-full flex-shrink-0 animate-pulse" style={{ background: '#fbbf24' }} />

// Notificação badge
<span className="bg-[#b03828] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-[5px]
                 inline-flex items-center justify-content-center animate-pulse">
  3
</span>
```

### Progress Bars

```jsx
// Âmbar — progresso de obra / implementação
<div className="w-full h-1.5 rounded-full bg-[#e8e0d4] overflow-hidden">
  <div className="h-full rounded-full bg-[#9E7A42] transition-[width] duration-400" style={{ width: '68%' }} />
</div>

// Azul — nível de combustível / capacidade
<div className="w-full h-1.5 rounded-full bg-[#e8e0d4] overflow-hidden">
  <div className="h-full rounded-full bg-[#0ea5e9]" style={{ width: '42%' }} />
</div>

// Label de progresso (acima da barra)
<div className="flex justify-between mb-1">
  <span className="text-[11px] text-[#9a8a78]">Progresso da Obra</span>
  <span className="text-[11px] font-bold text-[#6a5e4e]">68%</span>
</div>
```

### Cards

```jsx
// Card padrão
<div className="bg-white rounded-xl border border-[#f0ebe3] shadow-sm overflow-hidden">
  ...
</div>

// Card clicável (com elevação no hover)
<div className="bg-white rounded-xl border border-[#f0ebe3] shadow-sm
                hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
  ...
</div>

// Card com accent-bar de alerta
// Severidade: vermelho #b03828 | laranja #f97316 | âmbar #9E7A42 | verde #3d5a44
<div className="bg-white rounded-xl border border-[#f0ebe3] shadow-sm border-l-4 border-l-[#b03828]">
  <div className="p-3 pb-3">
    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#b03828] mb-1">Alerta Crítico</div>
    <div className="text-[13px] font-semibold text-[#3d3528]">RC-003 — Revisão Vencida</div>
    <div className="text-[11px] text-[#9a8a78] mt-0.5">Vencida há 12 dias · Última: 16/05/2026</div>
  </div>
</div>

// Card de header com título + ações
<div className="card-header px-4 py-3 border-b border-[#f0ebe3] flex items-center justify-between">
  <span className="text-[14px] font-bold text-[#1e1a14]">Frota Própria</span>
  <button className="text-[#b0a090]"><MoreHorizontal size={16} /></button>
</div>

// KPI card (grid 2 ou 4 colunas no dashboard)
<div className="bg-white rounded-xl border border-[#f0ebe3] shadow-sm p-3.5 flex items-center gap-3">
  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
       style={{ background: '#fdf8ec' }}>
    <Truck size={16} style={{ color: '#9E7A42' }} />
  </div>
  <div>
    <div className="text-2xl font-bold text-[#1e1a14] leading-none">12</div>
    <div className="text-[11px] text-[#9a8a78] mt-0.5">Veículos Ativos</div>
    <div className="text-[10px] font-semibold text-[#3d5a44] mt-0.5">+2 este mês</div>
  </div>
</div>
```

### Tabelas

```jsx
<div className="bg-white rounded-xl border border-[#f0ebe3] shadow-sm overflow-hidden">
  <table className="w-full border-collapse">
    <thead>
      <tr className="bg-[#faf9f7] border-b border-[#f0ebe3]">
        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a8a78] whitespace-nowrap">
          Veículo
        </th>
      </tr>
    </thead>
    <tbody>
      {/* Linha com alerta — 3px de borda esquerda colorida */}
      {/* Severidades: #b03828 (crítico) | #f97316 (atenção) | #fbbf24 (aviso) | transparent (normal) */}
      <tr className="hover:bg-[#faf9f7]/80 transition border-b border-[#f0ebe3]"
          style={{ borderLeft: '3px solid #b03828' }}>

        {/* Thumbnail do veículo */}
        <td className="px-3 py-2.5">
          <div className="w-11 h-[30px] rounded-md bg-[#f5f3ef] flex items-center justify-center">
            <Truck size={15} className="text-[#d4c8b8]" />
          </div>
        </td>

        {/* Nome + modelo */}
        <td className="px-3 py-2.5">
          <span className="text-[13px] font-semibold text-[#3d3528]">Retroescavadeira RE-001</span>
          <div className="text-[10px] text-[#b0a090]">JCB 3CX · 2019</div>
        </td>

        {/* Placa — sempre monospace */}
        <td className="px-3 py-2.5">
          <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[#6a5e4e]">
            ABC-1D23
          </span>
        </td>

        {/* Próx. Revisão — cores por urgência */}
        {/* Vencida: text-[#b03828] font-semibold | Próxima: text-[#f97316] | Normal: text-[#9a8a78] */}
        <td className="px-3 py-2.5 text-[12px] font-semibold text-[#b03828]">Vencida</td>

        {/* Ações */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1">
            <button className="p-1 rounded-md text-[#b0a090] hover:bg-[#f5f2ed] transition-colors">
              <Pencil size={13} />
            </button>
            <button className="p-1 rounded-md text-[#b0a090] hover:bg-[#f5f2ed] transition-colors">
              <Clock size={13} />
            </button>
            <button className="p-1 rounded-md text-[#b03828] hover:bg-[#fdf0ec] transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Modais

```jsx
// Overlay
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

  {/* Modal de formulário */}
  <div className="bg-white rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] w-full max-w-sm overflow-hidden">

    {/* Header com título + subtítulo */}
    <div className="px-[18px] pt-4 pb-3 border-b border-[#f0ebe3] flex items-start justify-between">
      <div>
        <h2 className="text-[15px] font-bold text-[#1e1a14]">Novo Abastecimento</h2>
        <p className="text-[11px] text-[#9a8a78] mt-0.5">Registrar abastecimento de frota</p>
      </div>
      <button className="text-[#b0a090] hover:text-[#6a5e4e] p-1 rounded-md transition-colors">
        <X size={16} />
      </button>
    </div>

    {/* Body */}
    <div className="px-[18px] py-4 space-y-3">
      {/* campos do formulário */}
    </div>

    {/* Footer */}
    <div className="px-[18px] py-3 border-t border-[#f0ebe3] flex justify-end gap-2">
      <button className="px-4 py-2 text-[13px] font-semibold text-[#6a5e4e] bg-white border border-[#e8e0d4] hover:bg-[#faf9f7] rounded-lg transition-colors">
        Cancelar
      </button>
      <button className="px-4 py-2 text-[13px] font-semibold bg-[#9E7A42] hover:bg-[#8a6a34] text-white rounded-lg transition-colors">
        Registrar
      </button>
    </div>
  </div>

  {/* Modal destrutivo */}
  <div className="bg-white rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] w-full max-w-[300px] overflow-hidden">
    <div className="px-[18px] pt-4 pb-3 border-b border-[#fdf0ec] flex items-center justify-between">
      <h2 className="text-[15px] font-bold text-[#b03828]">Excluir Veículo</h2>
      <button className="text-[#b0a090] p-1 rounded-md"><X size={16} /></button>
    </div>
    <div className="px-[18px] py-4">
      {/* Ícone de aviso */}
      <div className="w-11 h-11 rounded-full bg-[#fdf0ec] flex items-center justify-center mb-3">
        <AlertTriangle size={22} className="text-[#b03828]" />
      </div>
      <p className="text-[13px] text-[#6a5e4e] leading-relaxed">
        Tem certeza que deseja excluir permanentemente o veículo{' '}
        <strong className="text-[#3d3528]">RE-001 — ABC-1D23</strong>?
      </p>
      <p className="text-[11px] text-[#b0a090] mt-2">Esta ação não poderá ser desfeita.</p>
    </div>
    <div className="px-[18px] py-3 border-t border-[#f0ebe3] flex justify-end gap-2">
      <button className="px-4 py-2 text-[13px] font-semibold bg-white border border-[#e8e0d4] text-[#6a5e4e] rounded-lg">
        Cancelar
      </button>
      <button className="px-4 py-2 text-[13px] font-semibold bg-[#b03828] hover:bg-[#9a2e20] text-white rounded-lg">
        Excluir
      </button>
    </div>
  </div>

</div>
```

### Sidebar

```jsx
<aside className="w-56 bg-[#1c1a17] flex flex-col h-screen flex-shrink-0">

  {/* Logo */}
  <div className="p-3.5 pb-2.5 border-b border-[#3d3528] flex items-center gap-2">
    <div className="bg-[#252018] rounded-lg px-2 py-[5px] text-[14px] font-black text-[#9E7A42] tracking-[-0.02em]">
      MAK
    </div>
    <span className="text-[10px] text-[#5a4e3a] font-medium uppercase tracking-[0.02em]">Serviços</span>
  </div>

  {/* Nav */}
  <nav className="flex-1 p-1.5 overflow-y-auto space-y-0">

    {/* Grupo */}
    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#3d3528] px-2 pt-2.5 pb-1">
      Principal
    </div>

    {/* Item ativo */}
    <a className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-bold
                  bg-[#9E7A42] text-white shadow-sm cursor-pointer">
      <Activity size={13} />
      Painel Geral
    </a>

    {/* Item inativo */}
    <a className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium
                  text-[#8a7a68] hover:bg-[#2e2820] hover:text-[#f0ebe3] transition-colors cursor-pointer">
      <Truck size={13} />
      Frota
    </a>

    {/* Item com badge de notificação */}
    <a className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium
                  text-[#8a7a68] hover:bg-[#2e2820] hover:text-[#f0ebe3] transition-colors cursor-pointer">
      <Fuel size={13} />
      <span className="flex-1">Abastecimento</span>
      <span className="bg-[#b03828] text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-[3px]
                       flex items-center justify-center">2</span>
    </a>
  </nav>

  {/* Footer — usuário */}
  <div className="p-1.5 border-t border-[#3d3528]">
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
      <div className="w-[26px] h-[26px] rounded-full bg-[#9E7A42] text-white text-[10px] font-bold
                      flex items-center justify-center flex-shrink-0">AS</div>
      <div>
        <div className="text-[11px] font-semibold text-[#f0ebe3]">Almir Seibert</div>
        <div className="text-[9px] text-[#5a4e3a]">Administrador</div>
      </div>
    </div>
  </div>
</aside>
```

### Top Bar

```jsx
<header className="h-[50px] bg-white border-b border-[#e8e0d4] flex items-center justify-between
                   px-5 flex-shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
  {/* Breadcrumb */}
  <div className="flex items-center gap-2">
    <span className="text-[11px] text-[#b0a090]">MAK Serviços</span>
    <span className="text-[#d8d0c4] text-[12px]">/</span>
    <span className="text-[12px] font-medium text-[#6a5e4e]">Painel Geral</span>
  </div>

  <div className="flex items-center gap-3">
    {/* Sino com dot pulsante */}
    <button className="relative text-[#b0a090] p-1 rounded-md">
      <Bell size={15} />
      <span className="absolute top-0 right-0 w-[7px] h-[7px] rounded-full bg-[#b03828] animate-pulse" />
    </button>

    {/* Avatar */}
    <div className="w-[30px] h-[30px] rounded-full bg-[#9E7A42] text-white text-[11px] font-semibold
                    flex items-center justify-center cursor-pointer">
      AS
    </div>
  </div>
</header>
```

---

## Tipografia

```css
/* Importação obrigatória no globals.css */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700;900&family=Roboto+Mono:wght@400;500;700&display=swap');

body {
  font-family: 'Roboto', system-ui, sans-serif;
  font-size: 14px;
  color: #3d3528;
  background: #f5f3ef;
  -webkit-font-smoothing: antialiased;
}
```

| Nível | Tamanho | Peso | Cor | Tracking |
|---|---|---|---|---|
| Título de página | 30px | 700 | `#1e1a14` | `-0.025em` |
| Título de seção | 24px | 700 | `#1e1a14` | `-0.025em` |
| Título de card | 14px | 700 | `#1e1a14` | — |
| Número KPI | 24px | 700 | `#1e1a14` | — |
| Sub-heading | 14px | 600 | `#6a5e4e` | — |
| Corpo | 14px | 400 | `#6a5e4e` | — |
| Corpo em card | 13px | 400/600 | `#6a5e4e` | — |
| Texto de suporte | 12px | 400 | `#9a8a78` | — |
| Micro label | 10px | 700 | `#6a5e4e` | `0.08em` |
| Nav group | 9px | 700 | `#3d3528` | `0.12em` |
| Mono (placa/hodôm.) | 11–12px | 500 | `#3d3528` | `0.04–0.05em` |

---

## Raios e Sombras

```
rounded-sm   → 6px   → badges inline
rounded-md   → 8px   → botões, inputs
rounded-lg  → 10px   → (use rounded-[10px] para avatar/ícone KPI)
rounded-xl   → 12px  → cards, modais, containers
rounded-full → 9999px → pills, avatares, notif dots

shadow-xs    → 0 1px 2px rgba(0,0,0,0.05)
shadow-sm    → cards padrão
shadow-md    → cards hover, sidebar
shadow-xl    → modais: 0 25px 50px -12px rgba(0,0,0,0.35)
```

---

## Animações e Transições

```css
/* Hover interativo padrão */
transition-all duration-200 ease-in-out        → todos os elementos

/* Cards clicáveis */
hover:shadow-md hover:-translate-y-0.5         → elevação leve

/* Sidebar collapse */
transition-all duration-300

/* Dot de alerta / notificação */
animate-pulse                                  → Aguardando Manutenção, sino, badge vermelho

/* Barras de progresso */
transition-[width] duration-400
```

---

## Regras de Conteúdo

- ✅ **100% Português Brasileiro** — sem inglês na interface
- ✅ **Sem emoji** — apenas ícones Lucide React
- ✅ **Botões em imperativo Title Case**: "Nova Obra", "Registrar", "Confirmar"
- ✅ **Labels em ALL CAPS + tracking**: `text-[10px] font-bold uppercase tracking-[0.08em]`
- ✅ **Datas**: `dd/mm/aaaa`
- ✅ **Moeda**: `R$ 1.234,56`
- ✅ **Confirmações destrutivas**: sempre mostram o nome do item. Ex.: `"Excluir permanentemente RE-001 — ABC-1D23?"`
- ❌ Sem gradientes no conteúdo principal
- ❌ Sem imagens decorativas
- ❌ Sem sombras internas (inset)
- ❌ Sem Inter, Poppins ou system-ui isolado — Roboto é obrigatório

---

## Checklist de Fidelidade Visual

Antes de considerar um componente pronto:

- [ ] Fonte é Roboto (não Inter, não system-ui sem fallback)
- [ ] CTA primário é `#9E7A42` âmbar (não amarelo, não laranja)
- [ ] Sidebar fundo `#1c1a17` (não slate-950)
- [ ] Item ativo sidebar: bg `#9E7A42`, texto branco, font-bold
- [ ] Labels de campo: `text-[10px] uppercase tracking-[0.08em]`
- [ ] Badges têm **3 camadas**: fundo + borda + texto coloridos
- [ ] Dot dentro do badge (não apenas texto)
- [ ] "Aguardando Manutenção" tem dot com `animate-pulse`
- [ ] App background `#f5f3ef` (não branco, não slate-100)
- [ ] Focus ring: `ring-[#9E7A42]/20` borda `#9E7A42` — não azul padrão
- [ ] Focus no input muda bg para `#ffffff`
- [ ] Hover em cards clicáveis: `-translate-y-0.5 + shadow-md`
- [ ] Ícones são Lucide React exclusivamente
- [ ] Bordas usam `#e8e0d4` (não gray-200)
- [ ] Texto secundário usa `#6a5e4e` (não gray-700)
- [ ] Placa/hodômetro em `font-mono`
- [ ] Indicador de alerta em tabela: `border-left: 3px solid [cor]`
- [ ] Modal destrutivo cita o **nome do item** explicitamente
- [ ] Modal de formulário tem **subtítulo** (texto cinza `#9a8a78` abaixo do título)
- [ ] Todos os textos em Português Brasileiro
