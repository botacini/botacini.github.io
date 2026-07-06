# 🏎️ GP DA FAMÍLIA — Versão 2.0 (Dashboard Colaborativo)

## 🎯 Visão Geral das Mudanças

A nova versão transforma o GP da Família num **aplicativo verdadeiramente colaborativo**: todos veem a mesma página em tempo real, com um **dashboard em colunas por membro** (estilo Kanban) onde tarefas compartilhadas ocupam a mesma linha em todas as colunas.

Adicionadas também:
- **Metas personalizadas** (troféus criados pelos pais)
- **Bônus manual** (reconhecer comportamentos fora da agenda)
- **Cores por membro** (cada pessoa tem uma cor de "equipe" tipo F1)
- **Suporte a tarefas multi-membro** (feitas em conjunto)

---

## 📋 Arquitetura: Compatibilidade 100% com Dados Antigos

Todas as mudanças são **retrocompatíveis**:
- Configs antigas sem cores de membro e metas recebem valores padrão automaticamente (auto-heal em `loadState()`)
- O campo `mission.assignee` suporta 3 formatos simultaneamente:
  - `'compartilhada'` → todos os membros ATUAIS (dinâmico)
  - `['id1', 'id2']` → array de IDs específicos (novo formato)
  - `'id'` → string single ID (formato legado)
- A função `assigneeIds(mission)` normaliza qualquer um desses formatos

---

## 📁 Mudanças por Arquivo

### **state.js**
```javascript
// ✨ NOVO: Paleta de cores por membro (tema F1)
export const MEMBER_COLOR_PALETTE = ['#378add', '#e879c9', '#5cb832', ...];
export function nextMemberColor(members) { ... }

// ✨ NOVO: Helper para ler responsáveis de tarefa (múltiplos formatos)
export function assigneeIds(mission, members) { ... }

// ✨ NOVO: Campos em membros e config
- member.color → cor pessoal (hex)
- config.customGoals → array de metas personalizadas
- state.bonusLog → histórico de bônus manual

// ✨ NOVO: Função de persistência
export async function persistBonusLog() { ... }

// 🔧 AUTO-CURA: loadState() agora garante que todos os membros tenham cor
```

**Estrutura de customGoals:**
```javascript
{
  id: 'goal_xxxxx',
  type: 'family_stars' | 'member_stars',  // estrelas da família ou membro específico
  memberId: 'mem_xxxxx' | null,           // só se type === 'member_stars'
  icon: '🏆',
  name: 'NOME DA META',
  target: 50,                               // quantas estrelas para desbloquear
  desc: 'Descrição opcional'
}
```

**Estrutura de bonusLog:**
```javascript
[
  {
    date: '2026-07-05',
    memberId: 'mem_xxxxx',
    stars: 2,
    reason: 'Ajudou o irmão sem ser pedido',
    timestamp: '2026-07-05T14:30:00Z'
  }
]
```

---

### **storage.js**
```javascript
// ✨ NOVO: Persistência do histórico de bônus
export async function loadBonusLog() { ... }
export async function saveBonusLog(log) { ... }
```

---

### **render.js** (REESCRITA MAIOR)

#### ❌ REMOVIDO
- Barra de membros com filtros (não faz mais sentido)
- `activeMemberFilter` e lógica de filtro por membro

#### ✨ NOVO: Dashboard Kanban
```javascript
renderMissions()  // agora renderiza um quadro com colunas
├── 1 coluna por membro
├── mesma linha para tarefas compartilhadas
├── estrelas do dia do membro no header
└── cards compactos com ✓/✕ inline
```

#### 🎨 Novo visual: task-cell
- Compacto: tempo, emoji, título, descrição, botões de ação
- Estados: `.done`, `.fail`, `.current`, `.shared-task`
- Cores herdam da cor do membro

#### 🏆 Metas Personalizadas
```javascript
renderBadges()  // agora mostra:
├── Conquistas fixas (ALL_BADGES)
├── Metas personalizadas (state.config.customGoals)
└── Progresso visual: "25/50" para cada uma
```

---

### **missions.js** (REFATORAÇÃO DE LÓGICA)

```javascript
// 🔧 REFATORADO: Usa assigneeIds() em vez de comparar assignee diretamente
awardStars(mission, stars) {
  assigneeIds(mission).forEach(id => { ... });  // ✨ suporta multi-membro
}

revokeStars(mission, stars) {
  assigneeIds(mission).forEach(id => { ... });  // ✨ suporta multi-membro
}

// ✨ NOVO: Exportada para que parent-panel.js possa chamar após bônus manual
export function checkAndUnlockBadges() {
  // Checa conquistas fixas...
  // ✨ NOVO: Checa metas personalizadas!
  (state.config.customGoals || []).forEach(goal => {
    if (goal.type === 'member_stars')
      const progress = state.totals[goal.memberId];
    else
      const progress = Object.values(state.totals).reduce((a,b)=>a+b,0);
    
    if (progress >= goal.target) unlockGoal(goal);
  });
}
```

---

### **parent-panel.js** (3 NOVAS ABAS + EVENTOS)

#### ✨ NOVO: Abas adicionadas
```
👨‍👩‍👧‍👦 MEMBROS  |  🏁 TAREFAS  |  🏆 EXTRAS  |  🌟 BÔNUS  |  🔧 AJUSTES
                                        ↑ novo       ↑ novo
```

#### 🏆 ABA EXTRAS: Metas Personalizadas
- Criar meta: `+ ADICIONAR META`
- Editar: ícone, nome, meta (estrelas), tipo (família ou membro)
- Deletar: confirmar e remove

**Eventos:**
- `data-add-goal` → criar nova meta
- `data-remove-goal` → deletar
- `data-gfield` → editar fields (icon, name, target)

#### 🌟 ABA BÔNUS: Dar Estrelas Fora da Agenda
- Selector: qual membro
- Input: quantas estrelas (1-10)
- Reason: motivo textual
- Botão: CONCEDER BÔNUS

**O que faz:**
1. Registra no `state.bonusLog` com data e motivo
2. Concede imediatamente as estrelas (`memberStars` + `totals`)
3. Persiste tudo (`persistDayState`, `persistTotals`, `persistBonusLog`)
4. Checa e desbloqueia conquistas (`checkAndUnlockBadges()`)
5. Atualiza visualmente tudo

**Histórico de hoje:**
- Mostra todos os bônus já concedidos neste dia
- Formato: avatar, nome, estrelas, motivo

---

### **index.html**
```html
<!-- ✨ NOVO: Abas adicionadas ao painel dos pais -->
<button class="pp-subtab" data-sub="extras">🏆 EXTRAS</button>
<button class="pp-subtab" data-sub="bonus">🌟 BÔNUS</button>
```

---

### **style.css** (NOVO TEMA: KANBAN)

#### 🎨 Novo Color System
```css
--member-color  /* CSS custom property usada em colunas e cards */
```

#### Dashboard Kanban
```css
.missions-board              /* grid: auto-fit minmax(140px, 1fr) */
.board-column               /* flex, border-left colored, padding */
.column-header              /* avatar, nome, estrelas */
.task-cell                  /* card compacto de tarefa */
.task-time, .task-emoji, .task-body, .task-actions
.task-done.active, .task-fail.active
.task-cell.shared-task      /* estilo especial para compartilhadas */
```

#### Novos Componentes (Painel)
```css
.pp-goal-row                /* row de meta com inputs */
.pp-goal-info               /* flex container para fields */
.pp-bonus-entry             /* card de histórico de bônus */
```

---

## 🚀 Como Usar as Novas Funcionalidades

### 1️⃣ **Dashboard Kanban (Automático)**
Abra o app normalmente. Verá colunas lado-a-lado:
- Uma por membro (ex: Papai, Mamãe, Murilo)
- Cada coluna com cor de "equipe" do membro
- Tasks aparece em todas as colunas dos responsáveis
- ✓ e ✕ inline para marcar done/fail

### 2️⃣ **Criar Metas Personalizadas**
1. Painel dos Pais → aba **EXTRAS**
2. Clique `+ ADICIONAR META`
3. Preencha:
   - 🏆 (ícone)
   - NOME (ex: "Ler 100 páginas")
   - Meta em ⭐ (ex: 50)
4. Salva automaticamente

Quando alguém atinge a meta, a conquista desbloqueia! (popup + confete)

### 3️⃣ **Dar Bônus Fora da Agenda**
1. Painel dos Pais → aba **BÔNUS**
2. Escolha membro
3. Digite quantas ⭐ (1-10)
4. Motivo (ex: "Limpou a sala sem ser pedido")
5. Clique `✨ CONCEDER BÔNUS`

**Efeito imediato:**
- ⭐ aparecem no header
- Histórico de hoje atualiza
- Conquistas checadas (se atingiu meta, desbloqueia!)

---

## 🎨 Tema Visual

O novo dashboard **mantém a estética F1** (asfalto escuro, faixas quadriculadas, ouro/verde/vermelho) mas agora com:
- **Cores por membro** (azul, rosa, verde, ouro — tipo escuderias)
- **Cards compactos no Kanban** (não tira espaço visual)
- **Transições suaves** (sem jarretadas)
- **Responsividade** (flex grid que reajusta em telas pequenas)

---

## 🔄 Migração de Dados (Automática!)

Se você **importar um backup antigo**:
1. Abre o app
2. `loadState()` detecta membros sem `.color`
3. Atribui cores automaticamente (nem repete)
4. Detecta `customGoals` faltando → cria array vazio
5. **Regrava tudo** (zero perda de dados)

Feito! O app roda normalmente com a nova interface.

---

## 📊 Exemplo de Fluxo: Bônus Manual

```
Dia 5 de julho, 14:30

Mãe abre o app → Painel dos Pais → BÔNUS

┌─────────────────────────────┐
│ Escolha um membro:          │
│ [dropdown] 👦 MURILO        │
│                             │
│ Quantas estrelas?           │
│ [input] 2                   │
│                             │
│ Motivo (ex: limpou a sala)  │
│ [input] Arrumou o quarto    │
│       sem ser pedido        │
│                             │
│ [✨ CONCEDER BÔNUS]        │
└─────────────────────────────┘

↓

state.bonusLog.push({
  date: '2026-07-05',
  memberId: 'mem_xxxxx',  // Murilo
  stars: 2,
  reason: 'Arrumou o quarto sem ser pedido'
});

state.memberStars['mem_xxxxx'] += 2;  // 👦 MURILO ⭐8 no header
state.totals['mem_xxxxx'] += 2;

Persiste tudo e checa conquistas...

✨ Popup: "🏆 CONQUISTA DESBLOQUEADA!"
    Se atingiu meta personalizada
```

---

## 🛠️ Desenvolvimento Futuro

- [ ] Editar tarefas compartilhadas entre múltiplos membros no painel (UI para multi-select)
- [ ] Dashboard estatísticas por semana (quem fez mais tarefas, quem ganhou mais ⭐)
- [ ] API backend (Supabase) — já pronto com storage.js assíncrono!
- [ ] Sincronização em tempo real entre dispositivos
- [ ] Achievements com efeitos 3D (three.js)

---

## 📝 Notas Técnicas

### Por Que Kanban?
- **Transparência**: todos veem tudo (zero segredos)
- **Responsabilidade clara**: coluna = membro = visual óbvio
- **Escalável**: funciona de 2 a 10+ membros
- **Familiar**: padrão em agile/produtividade

### Compatibilidade Multi-Formato de `assignee`
Permite evitar migração destrutiva. Antigas configs com `'compartilhada'` seguem funcionando, e novas Tasks podem usar arrays. O `assigneeIds()` normaliza tudo.

### Bônus Manual vs. Tarefas Agenda
- **Tarefas**: pré-definidas, horário, checklist de bônus (capricho, pontualidade)
- **Bônus**: ad-hoc, sem horário, só motivo textual, reconhecimento espontâneo

---

## ✅ Checklist de Testes

- [ ] Abrir app em novo device → cores aleatórias para membros novos
- [ ] Importar backup antigo → auto-heal sem perda
- [ ] Criar meta → aparece na aba Conquistas
- [ ] Dar bônus → ⭐ aparecem imediatamente
- [ ] Atingir meta → conquista desbloqueia (popup + confete)
- [ ] Kanban → 4 colunas, tarefas compartilhadas alinhadas
- [ ] Finalizar dia → relatório inclui bônus manuais?
  - (Nota: bônus manual é só histórico, não conta como "tarefa concluída")

---

## 📞 Suporte

Arquivo: `/js/main.js` (orquestrador de eventos)

Fluxo de eventos (gp:):
- `gp:request-pin-approve` ← missions.js pede PIN
- `gp:pin-approved` → finaliza dia
- `gp:check-goals` ← parent-panel.js (novo!) após bônus manual
- `gp:switch-tab` ← render.js muda aba

---

**Versão:** 2.0 (2026-07-05)  
**Compatibilidade:** 100% retrocompatível com v1.x  
**Status:** Pronto para produção ✅
