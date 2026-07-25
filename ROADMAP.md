# Roadmap — GP da Família

Atualizado em 2026-07-25.

## Objetivo

Evoluir o GP da Família como uma aplicação única de organização e gamificação familiar, com mecânica independente do tema visual. O mesmo progresso deve poder ser apresentado como corrida, aventura com dinossauros, exploração espacial ou outros temas sem duplicar regras ou dados.

## Princípios obrigatórios

- Tema é apresentação, não regra de negócio.
- Trocar ou testar um tema nunca pode apagar, recriar ou alterar tarefas, conclusões, estrelas, saldo, conquistas, compras ou inventário.
- Pontuação histórica e saldo gastável são conceitos distintos.
- Itens comprados permanecem no inventário mesmo quando o tema atual não os exibe.
- Novas fases devem preservar compatibilidade com os dados relacionais existentes.
- Cada fase só termina após testes automatizados, validação manual e atualização da documentação.

## Estado consolidado

### Implementado

- Autenticação Supabase e família associada por `auth.uid()`/`family_access`.
- Persistência relacional de famílias, membros, configurações, tarefas, responsáveis, recorrências, exceções, estados por data, eventos de estrelas e resumos.
- RLS sem autorização baseada em `user_metadata`.
- Tarefas únicas e recorrentes semanalmente.
- Edição de ocorrência, série inteira ou ocorrência atual e futuras.
- Múltiplos responsáveis.
- Bônus, penalidades, metas, conquistas e relatórios diário/semanal.
- Backup lógico do modelo relacional.
- Data concreta nos cards da semana.
- Navegação entre semanas com setas na linha dos dias.
- Animação direcional dos dias e tarefas ao mudar de semana.
- Bloqueio temporário de navegação durante a animação e suporte a `prefers-reduced-motion`.
- Pop-ups fecháveis por `×` e toque fora.
- Botão de penalidade com texto e cor próprios.
- Projeto Supabase separado para desenvolvimento.

### Pendente de validação antes de produção

- Fluxo completo de cadastro, login, recuperação de sessão e logout.
- Isolamento RLS com dois usuários e duas famílias.
- Concorrência entre abas/dispositivos.
- Recorrências e edições nos limites de semana, mês, ano e horário local.
- Exportação/importação no ambiente remoto.
- Testes de regressão das alterações consolidadas do Site.

## Fase 1 — Estabilização da base relacional

Objetivo: transformar a versão atual em uma referência confiável para novas funcionalidades.

Entregas:

1. Automatizar cenários integrados de autenticação, RLS, agenda, recorrência e backup.
2. Validar o Supabase de desenvolvimento com dados fictícios de duas famílias.
3. Eliminar divergências restantes entre branch, Site de testes e documentação.
4. Definir procedimento repetível para aplicar migrations em desenvolvimento e, futuramente, produção.

Critério de conclusão:

- testes estáticos e integrados aprovados;
- nenhuma leitura ou escrita em `family_config`;
- nenhuma regressão na agenda ou nos saldos atuais.

## Fase 2 — Núcleo independente de tema

Objetivo: remover o acoplamento direto entre mecânica e automobilismo.

Entregas:

1. Criar um registro de temas com `theme_id`, vocabulário, ícones, paleta, assets, mensagens e representação de progresso.
2. Substituir textos e emojis de corrida escritos diretamente no HTML/JS por tokens do tema.
3. Aplicar o tema por `data-theme` e variáveis CSS.
4. Manter identificadores internos canônicos e neutros; nomes exibidos podem variar por tema.
5. Criar seletor de tema com pré-visualização.

Regra de persistência:

- a primeira implementação deve tratar `theme_id` como preferência visual;
- a seleção não participa das chaves de tarefas, ocorrências, estrelas, conquistas ou inventário;
- trocar o tema apenas re-renderiza a interface;
- o usuário pode alternar repetidamente entre temas para testes sem conversão ou migração de progresso.

Critério de conclusão:

- alternar entre o tema `racing` e um tema de teste preserva exatamente os mesmos IDs, totais, saldos, tarefas e estados;
- recarregar a aplicação mantém a preferência selecionada;
- tema inválido usa `racing` como fallback sem alterar dados.

## Fase 3 — Economia de estrelas/moedas

Objetivo: permitir uso das recompensas sem destruir o histórico de progresso.

Modelo:

- `lifetime_earned`: total histórico conquistado; nunca diminui por compras;
- `available_balance`: saldo disponível para gastar;
- `currency_transactions`: razão contábil de ganhos, penalidades, compras, estornos e ajustes;
- o nome e o ícone exibidos podem variar por tema, mas a unidade interna permanece única.

Entregas:

1. Criar migration para o razão de transações.
2. Migrar os eventos existentes para uma origem compatível, sem duplicar saldo.
3. Calcular saldo de forma transacional no servidor.
4. Impedir saldo negativo e compra duplicada.
5. Exibir separadamente total histórico e saldo disponível.
6. Definir se penalidades reduzem apenas o ganho da ocorrência ou também o saldo disponível antes de liberar a economia.

Critério de conclusão:

- comprar um item reduz somente `available_balance`;
- metas e conquistas baseadas no histórico continuam usando `lifetime_earned`;
- toda alteração de saldo possui origem auditável e pode ser estornada.

## Fase 4 — Loja, inventário e personalização

Objetivo: trocar saldo por itens cosméticos, aproveitando a ideia de campanha e personalização do Family Journey.

Entregas:

1. Catálogo de itens com preço, tema, categoria, slot, disponibilidade e estado ativo.
2. Compra transacional: debitar saldo e adicionar item ao inventário na mesma operação.
3. Inventário por membro.
4. Equipar/desequipar itens em slots compatíveis.
5. Personalização do avatar/veículo/personagem sem alterar atributos de tarefas ou pontuação.
6. Área dos pais para disponibilizar itens e definir preços.
7. Histórico de compras e estorno controlado.

Primeiro recorte recomendado:

- itens apenas cosméticos;
- catálogo administrado pela aplicação;
- sem itens consumíveis, trocas entre membros ou dinheiro real;
- no tema de corrida: acessórios para personalizar o carrinho.

Regra entre temas:

- itens podem ser globais ou vinculados a um tema;
- itens de outro tema continuam pertencendo ao membro e reaparecem ao retornar ao tema compatível;
- trocar de tema não vende, converte, desequipa permanentemente ou remove itens.

Critério de conclusão:

- compra atômica e idempotente;
- inventário preservado em troca de tema;
- dois membros não compartilham inventário por acidente;
- RLS impede compra ou equipamento em nome de outra família.

## Fase 5 — Campanha e progressão temática

Objetivo: incorporar a estrutura de campanhas, capítulos e narrativa prevista no Family Journey.

Entregas:

1. Campanha opcional por tema.
2. Capítulos e marcos desbloqueados por progresso coletivo.
3. Associação entre conclusões da rotina e avanço narrativo.
4. Tela de campanha separada da agenda.
5. Recompensas cosméticas por marcos, registradas no mesmo inventário.

Restrições:

- campanha não substitui a agenda;
- progresso narrativo referencia eventos canônicos;
- trocar o tema pode trocar a campanha visível, mas não altera o histórico da família.

## Fase 6 — Novos temas

Ordem inicial:

1. `racing`: tema atual consolidado.
2. `space`: nave, planetas, energia e exploração.
3. `dinosaurs`: explorador, territórios, fósseis e dinossauros.
4. `enchanted`: reino encantado, personagem, cristais e acessórios.

Cada tema deve fornecer:

- manifesto completo;
- paleta e tipografia;
- vocabulário;
- ícones e assets;
- componente de progresso;
- mensagens de conclusão;
- catálogo cosmético inicial;
- testes do contrato de tema.

Critério de conclusão:

- nenhum tema contém regras próprias de agenda, saldo ou compra;
- todos passam o mesmo conjunto de testes funcionais.

## Fase 7 — Operação e produção

Entregas:

1. Revisão de segurança e desempenho.
2. Observabilidade mínima de erros.
3. Backup e restauração testados.
4. Aplicação das mesmas migrations no ambiente escolhido para produção.
5. Checklist de promoção e rollback.

## Fora do escopo atual

- dinheiro real;
- marketplace entre famílias;
- venda ou transferência de itens;
- atributos competitivos ou vantagens funcionais compráveis;
- criação remota de temas por terceiros.

