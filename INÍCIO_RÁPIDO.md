# 🏎️ GP da Família v2.0 — Início Rápido

## ✨ 3 Grandes Mudanças

### 1️⃣ **Dashboard em Kanban (Colaborativo)**

**Antes:** Lista única de tarefas, com filtro por membro

**Agora:** Quadro com colunas lado-a-lado
```
┌──────────┬──────────┬──────────┐
│   👨     │   👩     │   🧒     │
│  PAPAI   │  MAMÃE   │ MURILO   │
│  ⭐ 2    │  ⭐ 3    │  ⭐ 1    │
├──────────┼──────────┼──────────┤
│ 07:00    │ 07:00    │ 07:00    │ ← mesma linha = tarefa compartilhada
│ ARRUMAR  │ ARRUMAR  │ ARRUMAR  │
│  CAMA    │  CAMA    │  CAMA    │
│ [✓] [✕]  │ [✓] [✕]  │ [✓] [✕]  │
├──────────┤          ├──────────┤
│ 07:30    │          │ 07:30    │
│ HIGIENE  │          │ HIGIENE  │
│ [✓] [✕]  │          │ [✓] [✕]  │
└──────────┴──────────┴──────────┘
```

**Vantagem:** Todos veem tudo = transparência total, sem segredos.

---

### 2️⃣ **Metas Personalizadas (Troféus)**

**Antes:** Só 4 conquistas fixas

**Agora:** Pais criam metas customizadas
```
PAINEL DOS PAIS → aba EXTRAS

[+ ADICIONAR META]

┌─────────────────────────────┐
│ 🏆 LER 100 PÁGINAS          │
│    50/50 ⭐                 │
│                             │
│ 🎯 TODA A FAMÍLIA           │
│                             │
│ [editar] [remover]          │
└─────────────────────────────┘

Quando atinge 50 ⭐:
→ BOOM! Conquista desbloqueia (confete + som)
```

**Exemplos:**
- 🏋️ "Fazer 30 flexões" → 20 ⭐
- 📚 "Ler um livro inteiro" → 15 ⭐  
- 🎮 "Jogar videogame sem reclamar" → 10 ⭐
- 🧹 "Limpar o quarto 7 dias seguidos" → 25 ⭐

---

### 3️⃣ **Bônus Manual (Reconhecimento Espontâneo)**

**Antes:** Só ganhava ⭐ por tarefas na agenda

**Agora:** Pais podem dar bônus de surpresa
```
PAINEL DOS PAIS → aba BÔNUS

┌──────────────────────────────┐
│ Escolha um membro:           │
│ [▼] 👦 MURILO                │
│                              │
│ Quantas estrelas?            │
│ [input] 3                    │
│                              │
│ Motivo:                      │
│ "Ajudou o irmão              │
│  sem ser pedido"             │
│                              │
│ [✨ CONCEDER BÔNUS]         │
└──────────────────────────────┘

↓ resultado imediato

HEADER: 👦 MURILO ⭐ 9  (era 6 + 3)

HISTÓRICO DE HOJE:
👦 Murilo  +3 ⭐  "Ajudou o irmão sem ser pedido"
```

**Casos de Uso:**
- ✨ Acordou cedo sem ser chamado
- ✨ Ajudou um irmão
- ✨ Disse uma verdade difícil
- ✨ Resistiu a uma tentação
- ✨ Fez algo criativo

---

## 🎯 Como Usar (Passo a Passo)

### **Usar Dashboard Kanban**
1. Abra o app normalmente
2. Verá 4 colunas (Papai, Mamãe, Filho, Filha)
3. Tarefas aparecem em todas as colunas dos responsáveis
4. Clique ✓ para marcar feito, ✕ para falha
5. Pronto! Sem precisar de nada novo

### **Criar uma Meta Personalizada**
1. Engrenagem ⚙️ (canto superior)
2. Digite o PIN
3. Abrir → aba **EXTRAS** (⭐ é a 3ª aba)
4. Clique **+ ADICIONAR META**
5. Preencha:
   - Emoji (ex: 📚)
   - Nome (ex: "Ler um livro inteiro")
   - Meta em ⭐ (ex: 25)
6. Salva automaticamente
7. Fecha o painel
8. Vá em abas → **CONQUISTAS** e veja a meta nova!

### **Dar um Bônus**
1. Engrenagem ⚙️
2. PIN
3. Abrir → aba **BÔNUS** (4ª aba)
4. Selecione o membro no dropdown
5. Digite quantas ⭐ (1-10)
6. Escreva por quê
7. Clique **✨ CONCEDER BÔNUS**
8. Pronto! Vê no histórico e no header
9. Se atingiu uma meta → conquista desbloqueia

---

## 🎨 Cores por Membro

Cada membro tem uma cor (tipo escuderia de F1):

```
👨 PAPAI   → Azul (#378add)
👩 MAMÃE   → Rosa (#e879c9)
🧒 MURILO  → Verde (#5cb832)
👶 FILHA   → Ouro (#e8b800)
```

A cor aparece:
- Na coluna (borda esquerda)
- No header do painel dos pais
- Na barra de membros

---

## ❓ Dúvidas Frequentes

**P: Posso editar uma meta depois?**  
R: Sim! Aba EXTRAS → editar os campos.

**P: O bônus conta como tarefa concluída?**  
R: Não. É só reconhecimento. Tarefas da agenda continuam sendo tarefas.

**P: Se excluir um membro, o que acontece com suas ⭐?**  
R: As estrelas ficam salvas. Pode recriar o membro depois.

**P: Funciona sem internet?**  
R: Sim! 100% offline (localStorage). Sincroniza quando volta a conexão (no futuro).

**P: Posso ter múltiplos responsáveis na mesma tarefa?**  
R: Sim! No painel, você vai conseguir atribuir a mais de um membro.

---

## 🚀 Próximos Passos

1. **Faça download** da nova versão (pasta `gp-da-familia`)
2. **Substitua** os arquivos no seu GitHub Pages
3. **Abra** o app (localStorage automático transfere dados)
4. **Crie uma meta** como teste
5. **Dê um bônus** para testar
6. **Finalize o dia** — tudo funciona!

---

## 📦 Arquivos Mudados

```
✏️ state.js          → cores, assigneeIds(), customGoals, bonusLog
✏️ storage.js        → loadBonusLog(), saveBonusLog()
✏️ render.js         → kanban completo (reescrito)
✏️ missions.js       → refatorado para assigneeIds(), goals customizados
✏️ parent-panel.js   → 2 abas novas (extras, bonus) + eventos
✏️ style.css         → kanban layout + novos componentes
✏️ index.html        → 2 novos botões de aba
✅ main.js           → sem mudanças (arquitetura já suporta tudo)
✅ effects.js        → sem mudanças
```

---

## ✅ Tudo Pronto!

100% compatível com dados antigos. Nenhuma perda. Tudo automático. 🚀

**Versão:** 2.0  
**Data:** julho 2026  
**Status:** Pronto para uso ✨
