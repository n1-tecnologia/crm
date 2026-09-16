# Phase 0: Preparação - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 00-prepara-o
**Areas discussed:** Exportação do ClickUp, Spec da Solicitação, De-para de usuários, Rotação Omie (prova)

---

## Exportação do ClickUp

### Onde o script de exportação vive?

| Option | Description | Selected |
|--------|-------------|----------|
| No monorepo, em apps/api | `apps/api/src/importacao/clickup/`; ao lado do importador das Fases 2/3; token só no `.env` do api; entra no `npm run check`; `automation/` não muda | ✓ |
| No financeiro-tria (automation/) | Já tem `adapters/clickup.ts` e o token na VPS, mas D-DEC-11 congela o `automation/` e o insumo é da plataforma | |
| Script avulso, fora do git | Rápido, sem rastreabilidade; a prova de paridade depende de re-rodar | |

**User's choice:** No monorepo, em apps/api (Recommended)

### Onde os dados exportados ficam?

| Option | Description | Selected |
|--------|-------------|----------|
| Fora do git + manifesto commitado | Pasta ignorada com os JSONs; no repo só manifesto (data, contagens, hashes) | ✓ |
| Supabase Storage privado | Bucket no projeto próprio; exige configurar Storage agora | |
| Commitado no repo | Reproduzível, mas grava dados pessoais/financeiros no git | |

**User's choice:** Fora do git + manifesto commitado (Recommended)
**Notes:** LGPD — comentários e anexos carregam CPF/CNPJ, dados bancários e NFs.

### Formato: bruto ou normalizado?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON bruto da API, sem transformar | Um arquivo por recurso e página; mapper nasce na importação | ✓ |
| Bruto + índice normalizado por Lista | Mantém o bruto e gera CSV/JSON achatado para a spec | |
| Só normalizado | Menor, perde fidelidade | |

**User's choice:** JSON bruto da API, sem transformar (Recommended)

### Anexos: baixar agora ou só metadados + URL?

| Option | Description | Selected |
|--------|-------------|----------|
| Baixar os arquivos agora | Mesma pasta fora do git, nomeados por task id + attachment id, hash no manifesto | ✓ |
| Só metadados + URL | Mais leve; risco de link morto na importação | |
| Você decide | Claude escolhe pelo volume real | |

**User's choice:** Baixar os arquivos agora (Recommended)

---

## Spec da Solicitação

### Fonte da verdade para a spec?

| Option | Description | Selected |
|--------|-------------|----------|
| Exportação + código + você valida | Claude lê a exportação real + `automation/`, rascunha no padrão de `contas-a-pagar.md`, marca lacunas; o dono/Financeiro responde só as marcadas | ✓ |
| Entrevista com o Financeiro primeiro | Colher com a Maryane como o processo funciona de fato; mais fiel, mais lento | |
| Só o código do automation/ | O que já foi feito no inventário — não fecha PREP-03 | |

**User's choice:** Exportação + código + você valida (Recommended)
**Notes:** Implica PREP-02 antes de PREP-03.

### D6 — Lista própria ou Status iniciais na Lista de Contas?

| Option | Description | Selected |
|--------|-------------|----------|
| Lista própria, decidir agora | Aprovador e prazo próprios; nem toda Conta nasce de Solicitação; Vínculo Solicitação → Conta | ✓ |
| Status iniciais na Lista de Contas | Um fluxo só; mistura aprovador do pedido com o Financeiro; muda `seed-financeiro.ts` | |
| Deixar aberto na spec | Documentar as duas; decidir na Fase 2 | |

**User's choice:** Lista própria, decidir agora (Recommended)

### D8 — aprovação por clique e/ou classificador?

| Option | Description | Selected |
|--------|-------------|----------|
| As duas: clique + classificador por 90 dias | Clique oficial; classificador como fallback medido, com data de revisão | ✓ |
| Só por clique | Determinístico; exige mudança de hábito dos 4 aprovadores no dia 1 | |
| Deixar aberto na spec | Descrever atual e alvo; decidir na Fase 2 com dados | |

**User's choice:** As duas: clique + classificador por 90 dias (Recommended)

### OQ-CMP-01/02/04 — absorver e decidir ou só documentar?

| Option | Description | Selected |
|--------|-------------|----------|
| Absorver e decidir pelo que a exportação mostra | Cartão/Link e `em revisão` entram se a Lista real usa; CPF/CNPJ fica no `automation/`; o resto vai para a §12 | ✓ |
| Só documentar, decidir na Fase 2/3 | Listar como abertas com evidência | |
| Você decide | Claude escolhe caso a caso e marca | |

**User's choice:** Absorver e decidir pelo que a exportação mostra (Recommended)

---

## De-para de usuários

### ClickUp user ID mapeia para o quê?

| Option | Description | Selected |
|--------|-------------|----------|
| → e-mail (identidade), resolvido na importação | Tabela estável id → e-mail + Papel; vira Membro por `inviteMember` na importação | ✓ |
| → id de Membro (convidar os 6 agora) | Convida como pendente já na Fase 0; exige e-mails reais agora e Membros num Espaço sem processo | |
| Você decide | Claude escolhe no planejamento | |

**User's choice:** → e-mail (identidade), resolvido na importação (Recommended)

### Onde o de-para mora?

| Option | Description | Selected |
|--------|-------------|----------|
| apps/api/src/importacao/clickup/de-para-usuarios.ts | Tipado, ao lado do exportador/importador; no typecheck | ✓ |
| docs/08-migracao-financeiro/ (markdown) | Legível; o importador teria que parsear ou duplicar | |
| Arquivo fora do git | Zero dado pessoal no repo; perde tipagem e rastreabilidade | |

**User's choice:** apps/api/src/importacao/clickup/de-para-usuarios.ts (Recommended)

### E-mails reais no arquivo versionado?

| Option | Description | Selected |
|--------|-------------|----------|
| E-mails no arquivo | 6 e-mails corporativos já presentes no `automation/` e docs | ✓ |
| Só ids + Papel; e-mails no .env | Nada pessoal no git; mais atrito | |

**User's choice:** E-mails no arquivo (Recommended)

### Autores fora dos 6 e as 38 variáveis CLICKUP_*?

| Option | Description | Selected |
|--------|-------------|----------|
| Descobrir na exportação; fora dos 6 → ator sistema com nome original | Exportador lista todos os ids com contagem; sem Membro fantasma; 38 `CLICKUP_*` catalogadas | ✓ |
| Mapear todo mundo para um Membro | Fiel, mas polui o Espaço e contraria D-08 | |
| Você decide | Claude decide com a lista real | |

**User's choice:** Descobrir na exportação; fora dos 6 → ator 'sistema' com nome original (Recommended)

---

## Rotação Omie (prova)

### Quem executa a rotação?

| Option | Description | Selected |
|--------|-------------|----------|
| Você, com um roteiro escrito por Claude | Checklist passo a passo; Claude não acessa Omie nem VPS | ✓ (superada) |
| Marcos Paulo executa | Conta dele no Omie; depende da agenda | |
| Já foi feito / fazer depois | Registrar prova ou deixar como item humano | |

**User's choice:** Você, com um roteiro escrito por Claude (Recommended) — **superada** pela instrução seguinte.

### Como registrar a prova no repositório?

| Option | Description | Selected |
|--------|-------------|----------|
| Nota datada em docs + verificação registrada | Registro em `docs/08-migracao-financeiro/` + erro de auth das antigas | ✓ (superada) |
| Só marcar PREP-05 como feito | Checkbox com data; sem rastro verificável | |
| Você decide | Claude escolhe o formato | |

**User's choice:** Nota datada em docs + verificação registrada (Recommended) — **superada** pela instrução seguinte.

### Instrução final do dono (após o resumo)

**"pode usar as mesmas credenciais do omie."** → **Não rotacionar.** As credenciais atuais continuam em uso; risco (histórico do git do `financeiro-tria`, credencial por linha) aceito pelo dono. Registrado como D-13 no CONTEXT.md; PREP-05 e o critério 4 da Phase 0 a marcar como "risco aceito". As duas respostas anteriores desta área ficam no log como o caminho que seria seguido se a rotação voltar.

---

## Claude's Discretion

- Nome da pasta fora do git e do script (`exportar:clickup`), formato do manifesto e granularidade dos hashes, re-exportação incremental.
- Paginação, rate limit (100 req/min) e retomada de exportação interrompida.
- Como catalogar as 38 `CLICKUP_*`.
- Profundidade da exportação da Lista de Contas a receber (dormente desde out/2025).
- Ordem entre PREP-02 e PREP-04 (independentes); PREP-03 depende de PREP-02.

## Deferred Ideas

- Rotação das credenciais Omie (roteiro + prova) — retirada por D-13; sem fase definida.
- Limpeza do histórico do git do `financeiro-tria` — só junto de uma rotação.
- Índice normalizado por Lista — descartado em D-03; pode voltar se a leitura do bruto for lenta.
- Supabase Storage para a exportação — volta quando a importação precisar dos anexos no banco.
