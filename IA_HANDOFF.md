# IA_HANDOFF — estado técnico

Atualizado em 2026-07-30.

## Situação atual

O branch de desenvolvimento usa o schema relacional versionado em `supabase/migrations`. Um projeto Supabase separado foi criado para desenvolvimento, preservando o banco original. O schema e as políticas foram recriados e aplicados nesse ambiente. A tabela legada `family_config` permanece fora do acesso de navegador.

A versão publicada para testes recebeu alterações posteriores ao primeiro commit da refatoração. Essas alterações estão consolidadas neste branch:

- data `DD/MM` nos cards da semana;
- navegação por semanas com setas;
- animação direcional de `280 ms` nos cards de dias e tarefas;
- bloqueio de cliques durante a transição;
- `prefers-reduced-motion`;
- fechamento de pop-ups por `×` e toque fora;
- botão vermelho `APLICAR PENALIDADE`.
- conflito de data/horário por responsável bloqueado no frontend e nas RPCs;
- encerramento do dia sem alteração de status, avançando uma data;
- ações de série disponíveis após exclusão isolada, inclusive para tarefas compartilhadas;
- reset relacional remoto restaurado e limitado à família autenticada.
- seleção múltipla de participantes com responsável principal preservado;
- linha do tempo de 5 minutos compartilhada entre todos os membros e com faixa dinâmica;
- cards compartilhados independentes por participante, sem atravessar colunas;
- edição sempre visível, inclusive em cards compartilhados;
- seletor de participantes em cards responsivos de duas colunas;
- categorias extensíveis por cor, persistidas no campo textual existente;
- progresso individual e familiar independentes de estrelas;
- pista com carrinho e linha de chegada;
- carteira coletiva e razão `family_star_transactions`;
- Playwright versionado para desktop e Pixel 7.

O modo temporário de teste baseado em `localStorage` não faz parte da consolidação. O branch mantém autenticação e persistência relacionais.

## Fonte de verdade e autorização

- `family_access` associa `auth.uid()` à família.
- RLS não usa metadados editáveis do usuário.
- `bootstrap_current_family` cria a família e o acesso inicial.
- `auth.js` obtém a família pelo fluxo confiável.
- `family_config` é legado de rollback, não é usada pelo frontend novo e não possui acesso direto por `anon` ou `authenticated`.
- Funções `SECURITY DEFINER` não são executáveis por `anon`; apenas RPCs e predicados RLS necessários são concedidos explicitamente a `authenticated`.

## Modelo atual

- Núcleo: `families`, `family_access`, `family_members`.
- Configuração: `family_settings`, `family_custom_goals`, `family_badges`.
- Agenda: `tasks`, `task_assignees`, `task_schedules`, `task_schedule_overrides`, `task_occurrence_status`.
- Histórico: `manual_star_events`, `daily_summaries`, `weekly_summaries`.
- Economia preparada: `family_star_transactions` e RPC `get_family_star_wallet`.

`tasks` guarda a definição; `task_schedules` guarda regras `once` ou `weekly`; `task_schedule_overrides` representa `skip` ou `patch` por data; `task_occurrence_status` é único por agenda e data.

## Direção arquitetural aprovada

Tema deve ser uma camada de apresentação. O núcleo continuará operando com dados canônicos e neutros.

Invariantes:

- `theme_id` não participa das chaves ou cálculos de agenda;
- trocar tema não altera progresso;
- pontuação histórica não diminui ao comprar itens;
- saldo gastável terá razão contábil próprio;
- inventário pertence ao membro e sobrevive à troca de tema;
- itens incompatíveis ficam apenas ocultos até o tema correspondente retornar.

Consulte [ROADMAP.md](ROADMAP.md) antes de implementar temas, loja ou campanhas.

## Decisões arquiteturais do sprint

- cada membro tem potencial de `0%` a `100%`, independentemente da quantidade de tarefas dos demais;
- progresso familiar é a média dos percentuais dos membros com tarefas naquele dia;
- tarefa compartilhada aparece em cada coluna participante, mantendo uma única ocorrência no estado e uma única contribuição na carteira coletiva;
- falha e pendência não contam como conclusão;
- horários podem ocupar qualquer parte do dia, devem ser múltiplos de 5 minutos e definem dinamicamente a faixa exibida;
- a carteira atual é derivada das ocorrências e eventos manuais; o razão novo permanece sem gravações até a loja;
- editar participantes em uma única ocorrência não é permitido, pois responsáveis pertencem à definição da tarefa; usar série ou “esta e as próximas”.

## Próxima fase

Estabilização da base relacional:

Concluídos no projeto de desenvolvimento: cadastro/login/logout, recuperação de sessão, isolamento RLS entre duas famílias, recorrência semanal, edições de série/ocorrência/futuro, exclusões de ocorrência/série, conflitos, estados/estrelas, bônus/penalidades, navegação semanal, encerramento do dia, backup/restauração, reset e persistência após nova sessão.

Validação do sprint: 21 contratos estáticos e 8 cenários Playwright aprovados em Chromium desktop e Pixel 7. O cenário autenticado opcional permanece pendente porque depende de credenciais fornecidas por variáveis de ambiente.

Somente depois iniciar a extração do manifesto de tema.

## Riscos conhecidos

- dados do JSONB antigo não são migrados automaticamente;
- backup antigo não é aceito pelo importador relacional;
- Playwright visual usa estado controlado e não substitui o teste autenticado contra o Supabase;
- a proteção contra senhas vazadas do Supabase Auth permanece desativada e deve ser habilitada antes de beta público;
- termos, emojis, mensagens, CSS e nomes de componentes continuam acoplados ao automobilismo;
- transações futuras ainda não são gravadas nem restauradas pelo backup porque a loja não existe;
- definir o efeito exato das penalidades sobre o futuro saldo é uma decisão pendente.
- categorias usam um marcador reservado no campo `tasks.description`; descrições livres ainda não possuem editor próprio.
