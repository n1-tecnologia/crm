# Phase 14: Unificação do CRM: o modelo novo ganha o que falta e a Tarefa conversacional - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-04
**Phase:** 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
**Areas discussed:** Corte e ensaio, O que o modelo novo ganha (e Grupo/Flow), Meus negócios, Tarefa conversacional

---

## Corte e ensaio

| Option | Description | Selected |
|--------|-------------|----------|
| De uma vez (Recomendado) | Prepara tudo, roda o script e troca todas as telas no mesmo deploy (Fase 15); sem ponte nova | ✓ |
| Tela por tela | As duas bases convivem; cerca de +2 dias de pontes jogadas fora | |

**User's choice:** De uma vez.

| Option | Description | Selected |
|--------|-------------|----------|
| Só teste e demonstração | Nada real no antigo; migração simples | |
| Tem dado real | A equipe registra no modelo antigo e isso não pode se perder | ✓ |
| Não sei, contar antes | Script só de leitura (--seco) conta antes | |

**User's choice:** Tem dado real.
**Notes:** A contagem direta em produção por script do agente foi negada pelo classificador de permissões (usaria a senha do `.env`); não foi contornada. O dono não informou quantos registros são.

| Option | Description | Selected |
|--------|-------------|----------|
| Cópia local com os dados reais (Recomendado) | Dono tira cópia das coleções do CRM antigo; ensaio em Postgres local; em produção backup manual, --seco e cópia de segurança | ✓ |
| Montar a homologação antes | Segundo projeto Supabase; mais fiel, mais dias | |
| Só dados de teste do seed | Mais rápido, não prova o dado real | |

**User's choice:** Cópia local com os dados reais.

---

## O que o modelo novo ganha (3.1.2 e 3.1.3)

| Option | Description | Selected |
|--------|-------------|----------|
| Só o essencial (Recomendado) | Notas, consentimento, mesclar, transferir Identificador, mover Conversa, atribuir, estrela, leitura, lixeira (+2 dias) | ✓ |
| Tudo antes do corte | Inclui Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos, Anexos (+4 dias) | |
| Nada do antigo | Telas perdem recursos; Contatos duplicados | |

**User's choice:** Só o essencial.

| Option | Description | Selected |
|--------|-------------|----------|
| Ficam até as Sessões 6 e 7 (Recomendado) | Grupo e Flow no antigo; Ferramentas trocam só Contatos e Canais | ✓ |
| Migram agora | Colunas de Grupo e Flow nas tabelas novas (+1,5 dia) | |

**User's choice:** Ficam até as Sessões 6 e 7.

---

## Meus negócios (3.1.4)

| Option | Description | Selected |
|--------|-------------|----------|
| Aposentar e usar o quadro do Funil | "Meus negócios" = quadro do Funil com filtro "meus"; Reuniões seguem como Tarefas ligadas ao Negócio novo (+0,5 dia) | ✓ |
| Manter as Listas espelho | Lista ganha `funilId` (+1 dia); duas telas para o mesmo Negócio | |

**User's choice:** Aposentar e usar o quadro do Funil.

---

## Tarefa conversacional (3.3.1)

| Option | Description | Selected |
|--------|-------------|----------|
| Pedir a 1ª Mensagem (Recomendado) | Campo no diálogo quando não há Conversa aberta; havendo, reaproveita | ✓ |
| Permitir Conversa vazia | Exceção à INV-CXE-05; Conversas mudas na Caixa | |

**User's choice:** Pedir a 1ª Mensagem.

---

## Claude's Discretion

- Ordem interna e corte em planos; nomes das colunas da migração nova; forma dos diálogos de mesclagem, consentimento e gestos da Caixa; tratamento da cópia local dos dados reais.

## Deferred Ideas

- Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos de Etapa e Anexos (sessão própria); Grupo e Flow nas tabelas novas (Sessões 6 e 7); homologação; backup diário.
