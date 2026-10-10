# Phase 7: CRM: Contatos, Empresas, Funis e Negócios (backend e frontend) - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Contatos, Empresas, Funis (com Etapas) e Negócios podem ser criados, lidos, editados e excluídos direto pelo frontend. Três camadas, começando pelo domínio: tipos e regras em `@n1/dominio` (fonte: `ontologia/03-crm`); repositórios e rotas em `apps/api` sobre `apps/api/migracoes/007-crm.sql`; telas em `apps/web` (que fala com a api só por HTTP, nunca importa dela).

Fora do escopo: Caixa de Entrada/Conversas/Mensagens e catálogos (Tag, Origem, Motivo de Perda, Qualificação — `origem`, `qualificacao` e `motivo_perda` são texto livre na 007).

</domain>

<decisions>
## Implementation Decisions

### Modelo de domínio × 007
- **D-01:** Criar tipos novos em português (Contato, Empresa, Funil, Etapa, Negócio, Identificadores, vínculo Contato-Empresa) num módulo novo de `@n1/dominio`, espelhando a 007, com regras puras. Os tipos em inglês (`Contact`, `Company`, `Deal`, `Pipeline`…) e o seed continuam vivos ao lado, porque Caixa de Entrada/Conversas ainda dependem deles; serão aposentados em fase futura. — **Reversibility:** costly — dois modelos coexistem; a unificação depois toca a web, o seed e as ~40 operações de CRM.
- **D-02:** O que o modelo antigo tem e a 007 não (tags, consentimentos, comentários, anexos, mesclagem/estado `mesclado`, temperatura, histórico de etapas) fica fora do CRUD desta fase. As telas ocultam ou desabilitam esses blocos; voltam em fase própria, com migração própria.

### Contrato HTTP
- **D-03:** Rotas REST por recurso em `apps/api` (`/contatos`, `/empresas`, `/funis`, `/negocios`: GET/POST/PATCH/DELETE), com esquemas validados e regras importadas de `@n1/dominio`. Não passa por `POST /operacoes/:nome` nem pelo estado hidratado de `GET /estado`.

### Telas
- **D-04:** Religar as telas existentes (`apps/web/src/app/(shell)/crm/{contatos,empresas,negocios,funis}` e `features/crm/*`) à api, trocando a fonte de dados do store em memória por HTTP, e completar o que falta (editar, excluir, restaurar, formulários). Mesmas rotas e layout.
- **D-05:** O quadro de Negócios (kanban) entra: mover de Etapa, ganhar, perder e reabrir são rotas da api, aplicando `exige_motivo_perda` / `exige_valor_ganho` do Funil.

### Excluir, arquivar e integridade
- **D-06:** "Excluir" na interface manda para `na_lixeira`, com ações de restaurar e de excluir permanentemente; arquivar é ação separada (estados `ativo`/`arquivado`/`na_lixeira` da 007).
- **D-07:** Excluir Funil ou Etapa que ainda tem Negócios é recusado (409 com a contagem de Negócios que bloqueiam). `migrate-funnel-dialog` e `remove-stage-dialog` são o caminho para o usuário resolver antes.
- **D-08:** Criar Empresa exige o Contato admin no mesmo formulário/transação (a 007 tem constraint trigger deferido). Excluir Empresa encerra os vínculos vigentes (`fim` preenchido) e preserva os Contatos. Trocar o último admin exige indicar o novo.
- **D-09:** Excluir Contato que é o último admin de uma Empresa ou vínculo de um Negócio é recusado (409 listando Empresas/Negócios afetados); o usuário nomeia outro admin ou troca o Contato do Negócio e tenta de novo.

### Acesso e Proprietário
- **D-10:** Backend aplica isolamento por Espaço de Trabalho (Membro resolvido pelo JWT) mais permissão do Papel sobre o recurso CRM para criar/editar/excluir, reaproveitando o mecanismo de permissão do domínio. Escopo `próprios` (vendedor vê só seus Negócios) e visibilidade de Funil privado ficam para fase futura; `privado` é só gravado.
- **D-11:** Proprietário de Contato/Empresa/Negócio padrão = Membro que cria (também `criado_por`), editável no formulário para outro Membro ativo.

### Decididas no plan-phase (2026-10-09, a partir das Open Questions do RESEARCH.md)
- **D-12:** A 007 ainda não foi aplicada em nenhum banco: a correção do trigger de admin × lixeira (RESEARCH.md Pitfall 2) entra direto em `apps/api/migracoes/007-crm.sql`, que é então commitada. O plano ainda confere `plataforma.migracoes` antes do primeiro `migrar`.
- **D-13:** O primeiro Funil criado num Espaço sem padrão vira `padrao=true` automaticamente; `POST /funis/:id/padrao` troca o padrão (só Administrador/Proprietário).
- **D-14:** Matriz de permissão: `membro` cria/edita/exclui Contato, Empresa e Negócio; só `administrador`/`proprietario` cria/exclui Funil, edita Etapas e reabre Negócio `ganho`; `convidado` só lê.
- **D-15:** Busca global, Lixeira (`/configuracoes/lixeira`), Notificações, `/crm/meus-negocios` e Caixa de Entrada continuam no modelo antigo e não mostram os registros da nova api; limitação aceita, registrada para a fase de unificação.

### Claude's Discretion
- Estrutura interna dos repositórios, nomes de módulo e de esquemas, paginação/filtros das listagens, formato exato dos erros 409, normalização de Identificadores (e-mail, telefone, domínio, documento) conforme os comentários da 007.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Camadas e regras de dependência
- `CONTEXT.md` — mapa das camadas; web e api nunca dependem uma da outra
- `AGENTS.md` — Next.js desta versão tem breaking changes; ler `node_modules/next/dist/docs/` antes de codar
- `apps/api/src/repositorios/CONTEXT.md`, `apps/api/src/rotas/CONTEXT.md`, `apps/api/src/plugins/CONTEXT.md` — convenções da api

### Modelo do CRM
- `apps/api/migracoes/007-crm.sql` — modelo relacional alvo (decisões do produto que sobrepõem a ontologia estão no cabeçalho: Empresa com admin, Negócio de Empresa OU Contato, `campos_adicionais`)
- `ontologia/03-crm/contatos.md`, `empresas.md`, `funis.md`, `negocios.md`, `crm-visao-geral.md` — fonte das regras
- `ontologia/DECISOES-E-PENDENCIAS.md` — A4.1 (estados de ciclo de vida), B8, B9, B13, B14, DO-NEG-05
- `ontologia/GLOSSARIO.md`, `ontologia/MATRIZ-DE-RELACOES.md`

### Código existente do CRM
- `packages/dominio/src/types/crm.ts`, `packages/dominio/src/operations/{contacts,deals}.ts` — modelo antigo (convive, não é alterado nesta fase)
- `.planning/ROADMAP.md` (Phase 7), `.planning/STATE.md`, `.planning/REQUIREMENTS.md` (Requirements da fase: TBD)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/features/crm/*`: `create-record-dialog`, `contact-card`, `deal-card`, `deal-screen`, `migrate-funnel-dialog`, `remove-stage-dialog`, `empresa-popup` — religar à api.
- `apps/web/src/features/estrutura/quadro-negocios.tsx` — kanban de Negócios.
- `apps/api/src/plugins/autenticacao*.ts`, `autenticacao/resolver-usuario.ts` — JWT e Membro por Espaço de Trabalho.
- `apps/api/src/rotas/esquemas/` — padrão de esquemas por rota.

### Established Patterns
- Rotas Fastify validam com esquemas e delegam regras ao `@n1/dominio`; testes ao lado (`*.test.ts`).
- `apps/api/src/repositorios/` nasce vazia: esta fase inaugura o padrão (uma interface por agregado, implementação atrás).
- Web hoje hidrata de `apps/web/src/dados/store.ts` (seed em memória); o CRM novo passa a ler/gravar por HTTP.

### Integration Points
- Tabelas `plataforma.contatos`, `contato_identificadores`, `empresas`, `empresa_identificadores`, `contato_empresa`, `funis`, `etapas`, `negocios` (e vínculos) da 007; `npm run migrar` aplica.
- Rotas existentes em `apps/web/src/app/(shell)/crm/**`.

</code_context>

<specifics>
## Specific Ideas

Sem referências visuais novas: reaproveitar o layout das telas existentes.

</specifics>

<deferred>
## Deferred Ideas

- Escopo de acesso `próprios` e visibilidade de Funil privado
- Tags, comentários, anexos, consentimentos, mesclagem de Contatos/Empresas, temperatura e histórico de etapas (exigem migração própria)
- Catálogos do Espaço de Trabalho (Origem, Qualificação, Motivo de Perda)
- Aposentar o modelo antigo em inglês (`Contact`/`Deal`/…) e o seed de CRM
- Mostrar os registros da nova api na busca global, Lixeira, Notificações e Meus-negócios (D-15)
- Registro de Atividade das ações de CRM (RN-CON-22, RN-NEG-15): a 007 não tem tabela de atividade
- Caixa de Entrada, Conversas e Mensagens

</deferred>

---

*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Context gathered: 2026-10-09*
