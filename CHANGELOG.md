# Changelog — GP da Família

## Em desenvolvimento (2026-07-30) — colaboração e agenda temporal

### Alterado

- Tarefas compartilhadas voltaram a aceitar seleção múltipla no frontend.
- Edição de série/futuro atualiza todos os participantes.
- Agenda Kanban foi substituída por linha do tempo comum em passos de 5 minutos.
- Cards têm altura proporcional e tarefas simultâneas ficam alinhadas.
- Tarefa compartilhada é renderizada uma única vez sobre as colunas participantes.
- Progresso individual usa percentual de tarefas concluídas.
- Progresso familiar usa a média dos membros que possuem tarefas no dia.
- Pista, carrinho e linha de chegada passaram a ser o indicador principal.
- Conclusão comum não concede estrelas; somente os três bônus existentes concedem.
- Estrelas formam carteira coletiva, sem duplicação por participantes de tarefa compartilhada.
- Encerramento do dia persiste o resumo e avança sem redefinir estados.

### Banco e testes

- Migrations `collective_star_wallet` e `refine_collective_wallet_policies`.
- RLS e grants verificados no Supabase de desenvolvimento.
- 20 contratos estáticos.
- Playwright em Chromium desktop e Pixel 7 para grid, proporção, compartilhamento, progresso e seleção de participantes.

## Em desenvolvimento (2026-07-27) — estabilidade da agenda

### Corrigido

- Bloqueados conflitos de mesma data/horário por responsável na criação e em todas as modalidades de edição.
- Adicionada serialização transacional por família para impedir conflitos concorrentes.
- Alterado “Finalizar dia” para preservar status e avançar somente a data exibida.
- Mantidas ações de ocorrência/série em tarefas compartilhadas após exceção `skip`.
- Restaurado reset remoto transacional, restrito à família autenticada.

### Validação

- Aplicadas migrations `20260727195339` e `20260727195347` somente no projeto de desenvolvimento.
- Executados 16 contratos estáticos, smoke Playwright em desktop/mobile e regressão integrada Playwright em desktop.
- Validada regressão de autenticação, tarefas, recorrências, pontuação, navegação, backup/restauração, reset e isolamento RLS.

## Em desenvolvimento (2026-07-25) — consolidação da versão de testes

### Interface

- Adicionada data `DD/MM` acima da sigla nos cards dos dias.
- Adicionadas setas laterais para navegar entre semanas.
- Mantido o mesmo dia da semana ao deslocar sete dias.
- Adicionada animação direcional de `280 ms` nos dias e tarefas.
- Bloqueados cliques repetidos durante a transição.
- Adicionado suporte a `prefers-reduced-motion`.
- Todos os pop-ups passam a fechar por `×` e toque fora.
- O modo penalidade usa botão vermelho com o texto `APLICAR PENALIDADE`.

### Ambiente

- Criado projeto Supabase separado para desenvolvimento.
- Aplicados schema relacional e políticas RLS nesse ambiente.
- Bloqueado o acesso de navegador à tabela legada `family_config`, removendo suas políticas inseguras e privilégios de `anon`/`authenticated`.
- O projeto Supabase original permaneceu inalterado.
- O modo temporário em `localStorage` usado durante a primeira prévia não foi incorporado ao branch.
- Corrigido o endpoint público para apontar ao projeto Supabase de Desenvolvimento.
- Recriado o schema vazio de Desenvolvimento a partir das migrations versionadas.
- Restringida a execução de funções para impedir RPCs `SECURITY DEFINER` por `anon`.
- Concedido acesso da Data API somente às tabelas relacionais e ao papel `authenticated`.
- Corrigido o cadastro quando o Auth confirma o e-mail, mas não devolve sessão no retorno inicial.
- Validados cadastro/login, RLS entre duas famílias, recorrência, edição, exceções, estrelas, backup/restauração e persistência após nova sessão.

### Documentação

- Atualizados `README.md`, `IA_HANDOFF.md` e `SUPABASE_SETUP.md`.
- Criado `ROADMAP.md`.
- Registrada a separação futura entre mecânica e tema.
- Definido que trocar temas deve preservar todo o progresso.
- Planejada economia com histórico, saldo, loja, inventário e itens cosméticos.
- Aproveitados do Family Journey os conceitos de campanha, capítulos, narrativa e progressão coletiva.

## v3.0 (2026-07-23) — persistência relacional

### Alterado

- Substituído o JSONB monolítico de `family_config` por schema relacional.
- Adicionadas migrations para famílias, acessos, membros, configurações, tarefas, responsáveis, regras, exceções, estados, eventos e resumos.
- Adicionadas tarefas únicas e recorrências semanais sem materializar ocorrências futuras.
- Edições distinguem ocorrência, série e ocorrência atual e futuras.
- Backup atualizado para formato lógico versionado.

### Segurança

- Autorização movida para `family_access` e `auth.uid()`.
- Removido uso de `user_metadata` para autorização.
- Adicionados índices, constraints e integridade entre família e membro.

### Compatibilidade

- A agenda e o histórico JSONB antigos não são migrados.
- `family_config` é retida apenas para rollback.

## v2.1 (2026-07-15) — UI, layout e painel dos pais

- Evolução visual do kanban, responsividade e painel dos pais.
- Inclusão de menu de tarefas e ajustes de conta.

## v2.0 (2026-07-05) — kanban, metas e bônus

- Dashboard por membro, metas personalizadas, bônus manual e integração inicial com Supabase Auth.

## v1.0 — base

- Agenda semanal, bônus, relatórios, conquistas e painel dos pais.
