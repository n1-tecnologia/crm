# Phase 9: Segurança dos dados e base de produção - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-22
**Phase:** 09-seguran-a-dos-dados-e-base-de-produ-o
**Areas discussed:** O que o GET /estado esconde (1.1.4), Banco: só fechado ou com RLS (1.3.2), Homologação/backup/o que só o dono faz (1.7), Teste de invasão (1.8)

**Contexto carregado antes das perguntas:** ROADMAP (Phase 9), STATE, PROJECT, `08-CONTEXT.md`, `docs/09-planejamento/TAREFAS-POR-SESSAO.md` (Sessão 1) e `PLANO-DE-IMPLEMENTACAO.md`, `09-NOTAS-DA-CONFERENCIA.md`, `.planning/WINDOWS.md`. Sem SPEC, sem plano, sem checkpoint anterior, nenhum todo casou. Conferência no código: `derive-visibilidade.ts`, `estado.ts`, `conexao.ts`, `app-shell.tsx` (103 usos de `pool()` em cerca de 40 arquivos). O conector do Supabase da sessão estava na organização "n1-tecnologia", não na "N1" (projeto `epomplsskqpluxuujpxl`), então plano e backups do banco não foram lidos.

---

## O que o GET /estado esconde (1.1.4)

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Convidado sem coleções de IA (Recomendado) | agents, automations, documents, collections e skills saem do estado do Convidado; demais Papéis como hoje; ~meio dia | ✓ |
| (B) Regra por registro agora | Dono, Equipe ou compartilhamento por Documento e Agente; ~2 dias; risco de retrabalho (CollectionGrant é dado a Agente) | |
| (C) Deixar como está até a IA | Custo zero; Convidado continua lendo Documentos de Conhecimento | |

**User's choice:** (A) Convidado sem coleções de IA.
**Notes:** Regra fina vai para a Sessão 17.

### Tela de IA para o Convidado

| Option | Description | Selected |
|--------|-------------|----------|
| Esconder o assunto IA do Convidado (Recomendado) | Some do trilho como o Financeiro; `/ia/*` mostra "Sem acesso" | ✓ |
| Manter só o Chat, esconder o resto | Chat continua; mais código de tela; Chat consome modelo na Sessão 13 | |
| Deixar tudo visível e vazio | Nenhuma mudança de tela; parece defeito | |

**User's choice:** Esconder o assunto IA do Convidado.
**Notes:** Sessão 12 pode reabrir. Fim da área: "Próxima área" (nada mais a perguntar sobre 1.1).

---

## Banco: só fechado ou com RLS (1.3.2)

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Só fechado + n1_api (Recomendado) | 009 com revoke, papel `n1_api`, migrações no dono; ~1 dia | ✓ |
| (B) Também RLS por workspace_id | +~2 dias no plano; medido maior: 103 usos de `pool()`, caminhos que consultam antes de saber o Espaço | |
| (A) agora e RLS na Sessão 12 | Igual a (A) com o gatilho registrado | |

**User's choice:** (A) Só fechado + n1_api.
**Notes:** RLS registrada como adiada pela decisão 12.1.

### O que entra na 009 além do pedido

| Option | Description | Selected |
|--------|-------------|----------|
| search_path nas 3 funções crm_* | Advisors; risco baixo | ✓ |
| revoke execute em public.rls_auto_enable() | Função do Supabase; só depois de testar na homologação | ✓ |

**User's choice:** Os dois.

### Onde fica a credencial do dono do banco

| Option | Description | Selected |
|--------|-------------|----------|
| No api.env, como o plano diz (Recomendado) | Simples; backup usa a mesma; risco residual: quem lê o arquivo volta a ter o banco | ✓ |
| Só no deploy, fora do disco da VPS | Segredo do GitHub por SSH + papel `n1_backup`; mexe em workflow e scripts | |

**User's choice:** No api.env.
**Notes:** O endurecimento ficou como ideia adiada.

---

## Homologação, backup e o que só o dono faz (1.7)

### Banco de homologação (1.7.1)

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Segundo projeto Supabase (Recomendado) | Banco, Auth e Storage separados; mensalidade a mais | ✓ |
| (B) Mesmo projeto, outro WORKSPACE_ID | Sem custo; migração errada já é em produção; 009 não testável antes | |

**User's choice:** (A) Segundo projeto Supabase.

### Destino do backup (1.7.3)

| Option | Description | Selected |
|--------|-------------|----------|
| Bucket S3-compatível (Recomendado) | R2 ou B2 com rclone; cifra por chave pública (age), privada com o dono | ✓ |
| Pasta no Google Drive da Tria | Conta de serviço; expiração por script | |
| Storage do projeto de homologação | Sem conta nova; mesmo fornecedor de produção | |

**User's choice:** Bucket S3-compatível.

### Quem executa na VPS e nos painéis

| Option | Description | Selected |
|--------|-------------|----------|
| Claude entrega, dono executa (Recomendado) | Arquivos e runbook no repositório; cada passo do dono é `[BLOCKING]` | ✓ |
| Claude executa por SSH na VPS | VPS compartilhada com 8 projetos, firewall desligado | |

**User's choice:** Claude entrega, dono executa.

### Servidor da Evolution API (1.7.5)

| Option | Description | Selected |
|--------|-------------|----------|
| VPS nova só para a Evolution (Recomendado) | Docker, Postgres e Redis próprios, HTTPS, firewall ligado | ✓ |
| Mesma VPS compartilhada, em Docker | Sem custo; disputa memória com a api e os vizinhos | |
| Reusar a Evolution do automation/ | Mistura números de clientes com os avisos do Financeiro | |

**User's choice:** VPS nova só para a Evolution.
**Notes:** Sentry ficou como no plano (SaaS com `beforeSend` que apaga corpo, cabeçalhos e segredo de URL); o dono viu o desenho e não pediu mudança.

---

## Teste de invasão (1.8)

### Entra na fase?

| Option | Description | Selected |
|--------|-------------|----------|
| Entra, as duas camadas (Recomendado) | Suíte adversarial no `npm run check` (~1 dia) + passada exploratória em homologação (~0,5 dia) | ✓ |
| Só a suíte automatizada | Sem exploratória | |
| Fica de fora desta fase | Só o `/gsd-secure-phase 9` | |

**User's choice:** Entra, as duas camadas.
**Notes:** Política de testes do Supabase consultada (https://supabase.com/docs/guides/security/security-testing): testar o próprio projeto é permitido; DoS, inundação e ataque a outros clientes são proibidos; scanner automatizado pede aviso a `security@supabase.com`.

### O que trava o fim da fase

| Option | Description | Selected |
|--------|-------------|----------|
| Crítico e alto travam; resto vira janela (Recomendado) | Médio e baixo entram em `WINDOWS.md` | ✓ |
| Só crítico trava | Resto vira janela | |
| Nada trava, só relatório | Dono decide caso a caso | |

**User's choice:** Crítico e alto travam; resto vira janela.

### Quem faz a passada exploratória

| Option | Description | Selected |
|--------|-------------|----------|
| Claude, sob autorização sua escrita (Recomendado) | Só homologação; autorização no topo de `09-PENTEST.md` | ✓ |
| Profissional externo depois | Olhar independente; custo e agenda de terceiro | |
| As duas, em sequência | Mais seguro, mais caro | |

**User's choice:** Claude, sob autorização escrita do dono.

---

## Claude's Discretion

- Forma exata de `membroVeSessaoDeChat`, `recortarRegistro`, `recortarDiferenca` e como o recorte convive com a projeção de Canais da Fase 8.
- Como `n1_api` recebe grants quando é criado depois da `009` (restrição de ordem: o dono cria o papel antes do merge).
- Como provar `n1_api` no Postgres local dos testes.
- Textos das telas, formato do `09-PENTEST.md`, escolha entre R2 e B2 e detalhes do `age`.

## Deferred Ideas

- RLS por `workspace_id` (decisão 12.1).
- Visibilidade por registro para Documentos e Agentes (Sessão 17).
- Credencial do dono só no deploy, com papel `n1_backup` de leitura.
- Pentester externo antes da Sessão 4.
- Limite de taxa contado no banco (quando houver mais de um processo).
