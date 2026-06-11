# Prompt de Handoff v2 — MAK Serviços

> **Como usar:** Cole o bloco abaixo no início da sua conversa com o Claude Code.  
> Substitua `[COMPONENTE]` e `[arquivo]` pelo que você quer implementar.

---

## PROMPT BASE — COLE SEMPRE NO INÍCIO

```
Você está implementando a interface do sistema MAK Serviços, um app interno de gestão de frotas e obras em construção civil.

**REGRA MAIS IMPORTANTE:** Os arquivos HTML em `design_handoff/components/` e `design_handoff/prototype/` são referências visuais aprovadas. Replique-os pixel a pixel. Não reinterprete, não "melhore", não adapte — transponha fielmente para React + Tailwind.

---

**STACK:**
- React + Tailwind CSS
- Ícones: lucide-react EXCLUSIVAMENTE (Pencil, Clock, Trash2, Bell, Activity, Truck, Fuel, X, AlertTriangle, etc.)
- Fonte: Roboto (Google Fonts) — pesos 300/400/500/600/700/900
- Fonte mono: Roboto Mono — pesos 400/500/700
- Idioma: 100% Português Brasileiro (zero palavras em inglês na UI)

Se o @import do Roboto não estiver no globals.css, adicione:
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700;900&family=Roboto+Mono:wght@400;500;700&display=swap');

---

**TOKENS OBRIGATÓRIOS — Tema Terroso Mineral:**

App background:       bg-[#f5f3ef]
Surface (cards):      bg-white
Surface subtle:       bg-[#faf9f7]
Surface muted:        bg-[#f5f2ed]

CTA primário:         bg-[#9E7A42] hover:bg-[#8a6a34] text-white font-bold
Danger:               bg-[#b03828] hover:bg-[#9a2e20] text-white
Dark:                 bg-[#1c1a17] text-[#f0ebe3]

Sidebar bg:           bg-[#1c1a17]
Sidebar surface:      bg-[#252018]
Sidebar hover item:   bg-[#2e2820] text-[#f0ebe3]
Sidebar item ativo:   bg-[#9E7A42] text-white font-bold shadow-sm
Sidebar border:       border-[#3d3528]
Sidebar text:         text-[#8a7a68]

Borda padrão:         border-[#e8e0d4]
Borda de card:        border-[#f0ebe3]
Borda forte:          border-[#d4c8b8]

Focus ring:           focus:ring-[3px] focus:ring-[#9E7A42]/20 focus:border-[#9E7A42] focus:bg-white

Texto título:         text-[#1e1a14]  (30px bold para página, 24px para seção)
Texto card:           text-[#3d3528]  (13–14px semibold)
Texto secundário:     text-[#6a5e4e]  (14px regular)
Texto suporte:        text-[#9a8a78]  (12px)
Texto apagado:        text-[#b0a090]  (placeholder, disabled)

Micro labels:         text-[10px] font-bold uppercase tracking-[0.08em] text-[#6a5e4e]
Nav group labels:     text-[9px] font-bold uppercase tracking-[0.12em] text-[#3d3528]
Mono (placa/hodôm.):  font-mono text-[11px] font-medium tracking-[0.04em]

Raios:                rounded-md (8px botões/inputs) · rounded-xl (12px cards/modais) · rounded-full (pills)
Sombras:              shadow-sm (cards) · shadow-md (hover) · [modal: 0_25px_50px_-12px_rgba(0,0,0,0.35)]
Hover em cards:       hover:-translate-y-0.5 hover:shadow-md transition-all duration-200
Transição padrão:     transition-all duration-200
Animate pulse:        animate-pulse  (dot "Aguardando Manut.", sino, badge vermelho)
Alerta em tabela:     border-left: 3px solid [#b03828 crítico | #f97316 atenção | #fbbf24 aviso | transparent]

---

**TAREFA:** Implemente [COMPONENTE] conforme `design_handoff/components/[arquivo].html`.

Processo:
1. Leia o arquivo HTML de referência na íntegra
2. Identifique cada elemento, hierarquia e espaçamento
3. Transponha para React + Tailwind usando os tokens acima
4. Mostre o resultado renderizado
5. Se divergir do HTML, aponte e corrija antes de finalizar
```

---

## PROMPTS POR COMPONENTE

### Sidebar

```
Implemente o componente Sidebar baseado em `design_handoff/components/sidebar.html`.

Especificações:
- Largura fixa: w-56 (expandido) · w-14 (recolhido — apenas ícones + tooltip)
- Transição: transition-all duration-300
- Logo: caixa bg-[#252018] rounded-lg, texto "MAK" text-[14px] font-black text-[#9E7A42]
- Subtítulo logo: text-[10px] text-[#5a4e3a] uppercase tracking-[0.02em]
- Nav group labels: text-[9px] font-bold uppercase tracking-[0.12em] text-[#3d3528]
- Item ativo: bg-[#9E7A42] text-white font-bold rounded-md shadow-sm
- Item hover: bg-[#2e2820] text-[#f0ebe3] transition-colors rounded-md
- Item inativo: text-[#8a7a68] text-[12px] font-medium
- Badge numérico de notificação: bg-[#b03828] text-white font-bold rounded-full animate-pulse
- Footer: avatar bg-[#9E7A42] rounded-full w-[26px] h-[26px] text-[10px] font-bold text-white
- Nome: text-[11px] font-semibold text-[#f0ebe3] · Role: text-[9px] text-[#5a4e3a]
- Border top do footer: border-[#3d3528]
```

### Tabela de Frota

```
Implemente a tabela de gestão de frota baseada em `design_handoff/components/tables.html`.

Especificações:
- Container: bg-white rounded-xl border border-[#f0ebe3] shadow-sm overflow-hidden
- Thead: bg-[#faf9f7] border-b border-[#f0ebe3]
- Th: text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a8a78] px-3 py-2.5
- Tr hover: hover:bg-[#faf9f7]/80 transition border-b border-[#f0ebe3]
- Indicador de alerta: border-left: 3px solid [cor] — NÃO border-l-4
  - Crítico (revisão vencida): #b03828
  - Atenção (< 7 dias): #f97316
  - Aviso (< 15 dias): #fbbf24
  - Normal: transparent
- Thumbnail: w-11 h-[30px] rounded-md bg-[#f5f3ef] com ícone Lucide text-[#d4c8b8]
- Nome veículo: text-[13px] font-semibold text-[#3d3528]
- Modelo/ano: text-[10px] text-[#b0a090]
- Placa: font-mono text-[11px] font-medium tracking-[0.04em]
- Status badge: inline-flex · dot 6px · rounded-full · 3 camadas (bg + border + text)
- Próx. revisão:
  - "Vencida": text-[#b03828] font-semibold text-[12px]
  - "N dias": text-[#f97316] font-semibold text-[12px]
  - Data normal: text-[#9a8a78] text-[12px]
- Ícones de ação: p-1 rounded-md text-[#b0a090] hover:bg-[#f5f2ed]
  - Excluir: text-[#b03828] hover:bg-[#fdf0ec]
  - Ícones: Pencil, Clock, Trash2 (tamanho 13px)
```

### Modais

```
Implemente os modais baseados em `design_handoff/components/modals.html`.

Especificações:
- Overlay: fixed inset-0 bg-black/50 flex items-center justify-center z-50
- Fechar com ESC e clique no overlay
- Container: bg-white rounded-xl overflow-hidden
  - Formulário: max-w-sm (≈340px)
  - Destrutivo: max-w-[300px]
- Shadow: shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]

Header (OBRIGATÓRIO: título + subtítulo):
- px-[18px] pt-4 pb-3 border-b border-[#f0ebe3]
- Título formulário: text-[15px] font-bold text-[#1e1a14]
- Subtítulo: text-[11px] text-[#9a8a78] mt-0.5
- Título destrutivo: text-[15px] font-bold text-[#b03828]
- Botão X: text-[#b0a090] hover:text-[#6a5e4e] p-1 rounded-md

Body: px-[18px] py-4 · campos com label 10px uppercase
Footer: px-[18px] py-3 border-t border-[#f0ebe3] flex justify-end gap-2
- Cancelar: bg-white border border-[#e8e0d4] text-[#6a5e4e] hover:bg-[#faf9f7]
- Confirmar: bg-[#9E7A42] hover:bg-[#8a6a34] text-white
- Excluir: bg-[#b03828] hover:bg-[#9a2e20] text-white

Modal destrutivo:
- Ícone de aviso: w-11 h-11 rounded-full bg-[#fdf0ec] com AlertTriangle text-[#b03828] size={22}
- Corpo: "Tem certeza que deseja excluir permanentemente o veículo [NOME]?"
- Texto em bold: <strong className="text-[#3d3528]">[NOME]</strong>
- Rodapé: text-[11px] text-[#b0a090] "Esta ação não poderá ser desfeita."
```

### Botões

```
Implemente os botões baseados em `design_handoff/components/buttons.html`.

Especificações:
- Primary:   bg-[#9E7A42] hover:bg-[#8a6a34] text-white font-bold text-sm px-4 py-2 rounded-lg shadow-sm
- Primary sm: text-xs px-2.5 py-[5px] rounded-md
- Secondary: bg-white border border-[#e8e0d4] text-[#6a5e4e] hover:bg-[#faf9f7] font-medium text-sm px-4 py-2 rounded-lg shadow-sm
- Danger:    bg-[#b03828] hover:bg-[#9a2e20] text-white font-semibold text-sm px-4 py-2 rounded-lg
- Dark:      bg-[#1c1a17] text-[#f0ebe3] font-semibold text-sm px-4 py-2 rounded-lg
- Ghost:     text-[#9a8a78] hover:bg-[#f5f2ed] hover:text-[#1e1a14] font-medium text-sm px-4 py-2 rounded-lg
- Icon:      p-1 rounded-md text-[#b0a090] hover:bg-[#f5f2ed] (hover danger: hover:bg-[#fdf0ec] text-[#b03828])
- Disabled:  opacity-45 cursor-not-allowed (em qualquer variante)
- Todos: flex items-center gap-1.5 transition-colors · ícones Lucide size={15}
```

### Inputs & Toggles

```
Implemente inputs e toggles baseados em `design_handoff/components/inputs.html`.

Especificações:
Labels:
- text-[10px] font-bold uppercase tracking-[0.08em] text-[#6a5e4e] block mb-1

Input padrão:
- px-2.5 py-2 border border-[#e8e0d4] rounded-lg bg-[#faf9f7] text-[13px] text-[#3d3528]
- placeholder: text-[#b0a090]
- focus: border-[#9E7A42] ring-[3px] ring-[#9E7A42]/20 bg-white outline-none transition

Search input:
- Ícone Search size={14} text-[#b0a090] absolute left-2.5 top-1/2 -translate-y-1/2
- padding-left: 30px

Placa / hodômetro:
- font-mono tracking-[0.05em]

Erro:
- border-[#b03828]
- Mensagem: text-[11px] text-[#b03828] mt-1

Toggle:
- Track inativo: bg-[#d4c8b8] rounded-full w-9 h-5
- Track ativo: bg-[#9E7A42]
- Thumb: bg-white w-3.5 h-3.5 rounded-full shadow translate-x-[3px] → checked: translate-x-[19px]
- transition-all duration-200
```

### Badges & Status

```
Implemente badges e indicadores de status baseados em `design_handoff/components/badges.html`.

Especificações:
Badge padrão (3 camadas obrigatórias):
- inline-flex items-center gap-[5px] px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap
- Dot: w-[7px] h-[7px] rounded-full flex-shrink-0
- "Aguardando Manutenção": dot com animate-pulse

Micro badge (sem dot):
- inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border

Tabela de cores dos 8 status de veículo:
Disponível:           bg #d1fae5 · border #a7f3d0 · text #065f46 · dot #10b981
Em Obra:              bg #e0f2fe · border #bae6fd · text #0c4a6e · dot #0ea5e9
Em Operação:          bg #ede9fe · border #ddd6fe · text #3730a3 · dot #8b5cf6
Em Manutenção:        bg #ffedd5 · border #fed7aa · text #9a3412 · dot #f97316
Aguardando Manut.:    bg #fef3c7 · border #fde68a · text #78350f · dot #fbbf24 (pulse)
Sucata:               bg #f4f4f5 · border #d4d4d8 · text #3f3f46 · dot #71717a
Inativo:              bg #f3f4f6 · border #e5e7eb · text #6b7280 · dot #9ca3af
Terceirizado:         bg #f3e8ff · border #e9d5ff · text #6b21a8 · dot #a855f7

Micro badges de papel (role):
Visualizador:  bg #f1f5f9 · border #cbd5e1 · text #475569
Editor:        bg #fef9c3 · border #fef08a · text #854d0e
Admin:         bg #dbeafe · border #bfdbfe · text #1e40af
Vencido:       bg #fdf0ec · border #e8c8bc · text #b03828

Badge de notificação:
- bg-[#b03828] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-[5px] animate-pulse

Progress bar âmbar (obra/implementação): bg-[#9E7A42]
Progress bar azul (combustível/capacidade): bg-[#0ea5e9]
Track: bg-[#e8e0d4] h-1.5 rounded-full overflow-hidden
Label: text-[11px] text-[#9a8a78] + valor font-bold text-[#6a5e4e]
```

### Cards

```
Implemente cards baseados em `design_handoff/components/cards.html`.

Especificações:
Card base:      bg-white rounded-xl border border-[#f0ebe3] shadow-sm overflow-hidden
Card clicável:  + hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer

KPI card:
- Padding: p-3.5
- Layout: flex items-center gap-3
- Ícone: w-10 h-10 rounded-[10px] flex items-center justify-center (bg suave do status)
- Valor: text-2xl font-bold text-[#1e1a14] leading-none
- Label: text-[11px] text-[#9a8a78] mt-0.5
- Sub-info positiva: text-[10px] font-semibold text-[#3d5a44] mt-0.5

Grid de KPIs: grid grid-cols-2 gap-2 (ou grid-cols-4 para dashboard completo)

Card com header:
- Header: px-4 py-3 border-b border-[#f0ebe3] flex items-center justify-between
- Título: text-[14px] font-bold text-[#1e1a14]
- Ação: MoreHorizontal size={16} text-[#b0a090]

Accent-bar card (alertas):
- border-l-4 border-l-[cor]
  - Crítico:  border-l-[#b03828]
  - Atenção:  border-l-[#f97316]
  - Aviso:    border-l-[#9E7A42]
  - Concluído:border-l-[#3d5a44]
- Label tipo: text-[10px] font-bold uppercase tracking-[0.08em] text-[cor] mb-1
- Título: text-[13px] font-semibold text-[#3d3528]
- Detalhe: text-[11px] text-[#9a8a78] mt-0.5

Linha de veículo em list-card:
- vehicle-thumb: w-12 h-8 rounded-md bg-[#f5f3ef] flex items-center justify-center
- Nome: text-[13px] font-semibold text-[#3d3528]
- Placa: font-mono text-[11px] text-[#9a8a78]
- Divider: border-b border-[#f0ebe3] (exceto last-child)
```

### Dashboard (Painel Geral)

```
Implemente o Painel Geral baseado em `design_handoff/prototype/index.html`.

Especificações:
- Layout: sidebar fixa w-56 + main flex-1 overflow-hidden
- Main: flex flex-col height 100vh
- Top bar: h-[50px] bg-white border-b border-[#e8e0d4] shadow-[0_1px_2px_rgba(0,0,0,0.04)]
- Content: flex-1 overflow-y-auto p-5 (ou p-6)
- App background: bg-[#f5f3ef]

Estrutura da página:
1. Cabeçalho da página: título 30px bold #1e1a14 + data text-sm #9a8a78 (texto alinhado direita)
2. Grid de KPIs: grid-cols-4 gap-3
3. Seção de alertas: tabela de alertas críticos
4. Seção de frota: resumo da frota com status cards

Scrollbar customizada no main:
::-webkit-scrollbar { width: 5px }
::-webkit-scrollbar-track { background: transparent }
::-webkit-scrollbar-thumb { background: #c8b8a8; border-radius: 10px }
```

---

## DICAS DE CORREÇÃO

**Se o Claude Code usar cores erradas:**
> "Use os tokens do README.md v2. O CTA primário é sempre #9E7A42. O fundo do app é #f5f3ef. Bordas de card são #f0ebe3, não gray-200."

**Se ele usar border-l-4 na tabela:**
> "A borda de alerta na tabela é `border-left: 3px solid [cor]` (3px, não 4px). Use inline style ou crie uma classe custom."

**Se o modal não tiver subtítulo:**
> "Todo modal de formulário deve ter um subtítulo abaixo do título principal — texto 11px, cor #9a8a78. Ex: 'Registrar abastecimento de frota'."

**Se usar ícones errados:**
> "Use apenas Lucide React. Para editar: Pencil. Para histórico: Clock. Para excluir: Trash2. Para fechar modal: X. Para alerta destrutivo: AlertTriangle."

**Se escrever em inglês:**
> "100% Português Brasileiro. Traduza [texto em inglês] para [tradução correta]."

**Se o focus ring for azul:**
> "O focus ring deve ser `ring-[#9E7A42]/20` com borda `#9E7A42`. Não use o ring azul padrão do Tailwind."

**Para ir componente por componente (recomendado):**
> "Hoje vamos implementar APENAS [componente]. Quando terminar e eu aprovar, passamos para o próximo."
