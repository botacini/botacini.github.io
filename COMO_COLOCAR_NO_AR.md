# 🚀 Como Colocar a v2.0 no Ar

## 📋 Pré-requisitos
- Repositório GitHub Pages já existente (seu site do GP da Família)
- Git instalado (ou usar GitHub Web UI)
- 5 minutos

---

## 🔄 Opção 1: Substituir Direto (Mais Rápido)

Seu repositório provavelmente tem estrutura assim:
```
botacini.github.io/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── main.js
    ├── state.js
    ├── storage.js
    ├── render.js
    ├── missions.js
    ├── parent-panel.js
    └── effects.js
```

**Passo a passo:**

1. **Download da pasta `gp-da-familia`** que você recebeu
2. **Copie os arquivos:**
   ```bash
   # Na sua máquina, dentro do repositório
   cp gp-da-familia/index.html ./
   cp gp-da-familia/css/* ./css/
   cp gp-da-familia/js/* ./js/
   ```
3. **Commit e Push:**
   ```bash
   git add .
   git commit -m "🚀 v2.0: Dashboard kanban + metas + bônus manual"
   git push origin main
   ```
4. **Aguarde 1-2 minutos** (GitHub Pages atualiza automaticamente)
5. **Abra** seu site
6. **Teste** — os dados antigos devem estar lá, com cores novas nos membros!

---

## 🔄 Opção 2: Fazer Pull Request (Se Colaborando)

Se estiver trabalhando em equipe:

1. **Fork** do repositório
2. **Clone** seu fork
3. **Crie branch:**
   ```bash
   git checkout -b feature/v2-kanban-dashboard
   ```
4. **Copie os arquivos:**
   ```bash
   cp -r gp-da-familia/* .
   ```
5. **Commit:**
   ```bash
   git add .
   git commit -m "feat: dashboard kanban + metas + bônus manual"
   git push origin feature/v2-kanban-dashboard
   ```
6. **Abra PR** no GitHub
7. **Review** e merge

---

## 🔄 Opção 3: Manual (GitHub Web UI)

Se você não quer usar Git:

1. **Vá para** github.com/seu-usuario/botacini.github.io
2. **Clique em** `index.html`
3. **Clique no ícone de edição** (lápis)
4. **Delete tudo** e cole o novo conteúdo de `gp-da-familia/index.html`
5. **Commit** (botão verde no final)
6. **Repita** para cada arquivo em `css/` e `js/`

---

## ⚙️ Verificações Pós-Deploy

Após fazer push/update:

- [ ] Abra seu site (ex: botacini.github.io)
- [ ] Vê as colunas lado-a-lado? ✓ Kanban funcionando
- [ ] Vê cores diferentes em cada coluna? ✓ Cores por membro OK
- [ ] Clica em ⚙️ → vai para o painel? ✓ PIN OK
- [ ] Vê abas: MEMBROS, TAREFAS, **EXTRAS**, **BÔNUS**, AJUSTES? ✓ Novas abas OK
- [ ] Tenta criar uma meta em EXTRAS? ✓ Metas OK
- [ ] Tenta dar um bônus em BÔNUS? ✓ Bônus OK
- [ ] Seus dados antigos aparecem? ✓ Auto-heal OK

Se tudo passou, você está good to go! 🎉

---

## 🔧 Se Algo Deu Errado

### "Página em branco ou erro 404"
1. Verifica se o arquivo `index.html` está na raiz do repositório
2. Verifica se `css/` e `js/` existem
3. No GitHub, Settings → Pages → verifica que está apontando para `main` branch
4. Limpa cache do navegador (Ctrl+Shift+Del ou Cmd+Shift+Del)

### "Tarefas sumiram"
- Seus dados estão no localStorage do seu navegador, não foram perdidos
- Se mudou de navegador/dispositivo, faça import do backup (aba AJUSTES)
- Se ainda tiver em dúvida, abra o DevTools (F12) → Application → Local Storage e vê `gpFamilia:config`

### "Cores não aparecem"
- Limpa cache (Ctrl+Shift+R)
- Verifica que `css/style.css` foi copiado corretamente
- Se ainda não funcionar, copia o CSS do arquivo novamente

### "Botões de EXTRAS e BÔNUS não aparecem"
- Verifica que `index.html` foi substituído corretamente
- Procura no arquivo por `data-sub="extras"` — tem que estar lá

### "Erro de JavaScript no console"
- Abre DevTools (F12) → Console
- Copia o erro exato
- Verifica que todos os 7 arquivos `.js` foram copiados corretamente
- Se precisar, refaz o copy/paste de um arquivo por vez

---

## 📁 Estrutura Final (Confirmação)

Após deploy, seu repositório deve ter:

```
botacini.github.io/
├── index.html                 ← SUBSTITUÍDO (v2.0)
│
├── css/
│   └── style.css              ← SUBSTITUÍDO (kanban + novos estilos)
│
├── js/
│   ├── main.js                ← SEM MUDANÇAS
│   ├── state.js               ← ATUALIZADO (cores, customGoals, bonusLog)
│   ├── storage.js             ← ATUALIZADO (loadBonusLog, saveBonusLog)
│   ├── render.js              ← REESCRITO (kanban)
│   ├── missions.js            ← REFATORADO (assigneeIds, checkAndUnlockBadges export)
│   ├── parent-panel.js        ← ATUALIZADO (abas extras, bonus + handlers)
│   └── effects.js             ← SEM MUDANÇAS
│
└── .gitignore (opcional)
```

---

## 🔀 Se Você Customizou o Original

Se fez mudanças próprias no app e quer manter algumas:

**IMPORTANTE:** Use `git diff` para ver exatamente o que mudou:
```bash
git diff HEAD~1 js/render.js  # mostra o que mudou em render.js
```

Se customizou algo crítico (tipo a paleta de cores, fonts, etc):

1. **Faça backup** de seus arquivos customizados
2. **Aplique as mudanças da v2.0** normalmente
3. **Re-aplique suas customizações** encima (cuidado com conflitos!)
4. **Teste** tudo novamente

Exemplo:
```bash
# Backup das suas mudanças
cp js/style.css style.css.backup

# Atualiza para v2.0
git pull origin main

# Re-aplica suas mudanças (se não conflitarem)
# Edita manualmente em style.css se precisar
```

---

## 📞 Rollback (Se Tiver Problemas Graves)

Se a v2.0 quebrou algo e precisa voltar:

```bash
git log --oneline  # vê o histórico
git revert HEAD    # desfaz o último commit (mantém histórico)
# ou
git reset --hard HEAD~1  # volta direto (sem histórico)
git push origin main --force
```

---

## 🎉 Pronto!

Quando tudo funcionar, seus familiares podem abrir o site e:
- Ver um dashboard colaborativo beeem mais intuitivo
- Criar metas personalizadas
- Dar bônus surpresa
- Continuar completando tarefas e ganhando ⭐

Tá feito! 🏎️✨

---

**Dúvidas?** Consulte:
- `MUDANÇAS_VERSÃO_2.md` → Detalhes técnicos
- `INÍCIO_RÁPIDO.md` → Como usar as novas features
- `README.md` (original) → Visão geral do projeto

**Versão:** 2.0  
**Data:** Julho 2026  
**Status:** Pronto para produção ✅
