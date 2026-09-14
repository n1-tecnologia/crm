# ONTOLOGIA DA PLATAFORMA

Versão da ontologia: **1.0** — Última revisão global: **2026-09-10** (Fase 6 concluída)

Esta pasta é a fonte de verdade conceitual da plataforma: o que existe, o que cada coisa é, a quem pertence, com o que se relaciona, que estados assume e que regras precisam permanecer verdadeiras independentemente da implementação. Não contém decisões de banco de dados, APIs, interface ou infraestrutura; serve de base para todas elas.

## Estrutura

```text
ontologia/
├── README.md                      índice, ordem de leitura, status
├── GLOSSARIO.md                   vocabulário canônico (uma definição por termo)
├── MATRIZ-DE-RELACOES.md          síntese de todas as relações, cardinalidades e propriedade
├── DECISOES-E-PENDENCIAS.md       constituição: decisões consolidadas (A), recomendadas (B),
│                                  questões abertas (C), entidades futuras (D), registro de alterações
│
├── 01-espaco-de-trabalho/
│   └── espaco-de-trabalho.md      01
├── 02-estrutura-de-trabalho/
│   ├── espaco.md                  02
│   ├── pasta.md                   03
│   ├── subpasta.md                04
│   ├── lista.md                   05
│   ├── tarefa.md                  06
│   ├── subtarefa.md               07
│   └── checklist.md               08
├── 03-crm/
│   ├── crm-visao-geral.md         09
│   ├── contatos.md                10
│   ├── empresas.md                11
│   ├── negocios.md                12
│   ├── funis.md                   13
│   └── caixa-de-entrada-e-mensageria.md   14
├── 04-ia/
│   ├── ia-visao-geral.md          15
│   ├── chat.md                    16
│   ├── agentes.md                 17
│   ├── habilidades.md             18
│   ├── automacoes.md              19
│   └── conhecimento.md            20
└── 05-paineis/
    └── paineis.md                 21
```

## Contagem dos documentos principais

```text
ESPAÇO DE TRABALHO .............. 1
ESTRUTURA DE TRABALHO ........... 7
CRM .............................. 6
IA ............................... 6
PAINÉIS .......................... 1
TOTAL ........................... 21
```

README, GLOSSARIO, MATRIZ-DE-RELACOES e DECISOES-E-PENDENCIAS são documentos auxiliares de governança e não entram na contagem.

## Ordem de leitura recomendada

1. **DECISOES-E-PENDENCIAS.md**, seções A e B — a constituição. Todo documento principal obedece a ela; ler primeiro evita reinterpretar conceitos.
2. **GLOSSARIO.md** — o vocabulário. Cada termo tem uma única definição; sinônimos listados são proibidos nos documentos.
3. **01 Espaço de Trabalho** — a raiz: tenant, Membro, Papel, Permissão, Ator, auditoria, catálogos globais.
4. **02 a 08 Estrutura de Trabalho**, na ordem — a cadeia de contenção e herança termina na Tarefa (06), que é o documento central do domínio.
5. **09 CRM visão geral** e depois 10 a 14 — Contatos, Empresas, Negócios, Funis, Caixa de Entrada. O documento 14 modela Canal, Conversa, Mensagem, Participante, Fila e Anexo.
6. **15 IA visão geral** e depois 16 a 20 — Chat, Agentes, Habilidades, Automações, Conhecimento. Ferramenta, Contexto, Memória, Modelo e Execução são entidades internas descritas dentro desses documentos.
7. **21 Painéis**.
8. **MATRIZ-DE-RELACOES.md** — para consulta cruzada depois de conhecer as entidades.

Cada documento principal segue o mesmo template de 25 seções (definição, propósito, natureza, fronteira, identidade, atributos, componentes, relações, cardinalidades, hierarquia, estados, ciclo de vida, regras, invariantes, personalização, herança, permissões, eventos, dependências, casos limítrofes, o que não pertence, exemplos, representação gráfica, decisões, questões abertas). Regras são numeradas `RN-XX-nn`, invariantes `INV-XX-nn`, decisões locais `DO-XX-nn`; decisões locais promovidas à constituição aparecem como `DO-XX-nn / Bnn`.

## Status dos documentos

Escala: `RASCUNHO` → `REVISADO` (revisão individual e transversal do domínio) → `APROVADO CONCEITUALMENTE` (revisão global) → `PENDENTE` (aguardando decisão de produto registrada em C).

| Nº | Documento | Domínio | Status | Depende de |
| --- | --- | --- | --- | --- |
| 01 | Espaço de Trabalho | Raiz | APROVADO CONCEITUALMENTE | constituição |
| 02 | Espaço | Estrutura | APROVADO CONCEITUALMENTE | 01 |
| 03 | Pasta | Estrutura | APROVADO CONCEITUALMENTE | 01, 02 |
| 04 | Subpasta | Estrutura | APROVADO CONCEITUALMENTE | 03 |
| 05 | Lista | Estrutura | APROVADO CONCEITUALMENTE | 02, 03, 04 |
| 06 | Tarefa | Estrutura | APROVADO CONCEITUALMENTE | 05 |
| 07 | Subtarefa | Estrutura | APROVADO CONCEITUALMENTE | 06 |
| 08 | Checklist | Estrutura | APROVADO CONCEITUALMENTE | 06, 07 |
| 09 | CRM — visão geral | CRM | APROVADO CONCEITUALMENTE | 10–14 |
| 10 | Contatos | CRM | APROVADO CONCEITUALMENTE | 01 |
| 11 | Empresas | CRM | APROVADO CONCEITUALMENTE | 01, 10 |
| 12 | Negócios | CRM | APROVADO CONCEITUALMENTE | 10, 11, 13 |
| 13 | Funis | CRM | APROVADO CONCEITUALMENTE | 01 |
| 14 | Caixa de Entrada e Mensageria | CRM | APROVADO CONCEITUALMENTE | 10, 11, 12 |
| 15 | IA — visão geral | IA | APROVADO CONCEITUALMENTE | 16–20 |
| 16 | Chat | IA | APROVADO CONCEITUALMENTE | 17, 18, 20 |
| 17 | Agentes | IA | APROVADO CONCEITUALMENTE | 01, 18, 20 |
| 18 | Habilidades | IA | APROVADO CONCEITUALMENTE | 01 |
| 19 | Automações | IA | APROVADO CONCEITUALMENTE | 17, 18 |
| 20 | Conhecimento | IA | APROVADO CONCEITUALMENTE | 01 |
| 21 | Painéis | Painéis | APROVADO CONCEITUALMENTE | todos |

Documentos auxiliares: GLOSSARIO (1.0), MATRIZ-DE-RELACOES (1.0), DECISOES-E-PENDENCIAS (1.0). Nenhum documento está em `PENDENTE`; as questões que dependem de decisão de produto estão na seção C da constituição e referenciadas nas seções 25 dos documentos.

## Processo de produção e revisão

Cada documento passou por: escrita pelo Ontologista (Agente A) obedecendo à constituição; revisão combinada de Crítico ontológico (B), Revisor de consistência (C), Arquiteto de domínio (D) e Red team (E), com achados registrados antes das correções; revisão transversal do domínio (Fases 2, 3, 4, 5); auditoria global (Fase 6) estrutural, CRM, IA/Painéis, terminológica e de relações (que gerou a Matriz). Toda decisão que alterou um documento anterior foi aplicada nele e registrada no Registro de Alterações da constituição.

## Como manter

- Uma mudança de significado nasce na constituição (seção B ou C), depois é aplicada nos documentos afetados, na matriz e no glossário, e registrada no Registro de Alterações.
- Um termo novo entra no glossário antes de ser usado em um documento.
- Uma entidade nova de primeiro nível é registrada primeiro em D (possíveis entidades futuras) e só ganha documento principal por decisão explícita, porque a árvore conceitual aprovada tem exatamente 21 documentos.
