# Changelog — GP da Família

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
- Auditoria de segurança executada sem alertas.
- O projeto Supabase original permaneceu inalterado.
- O modo temporário em `localStorage` usado durante a primeira prévia não foi incorporado ao branch.

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

