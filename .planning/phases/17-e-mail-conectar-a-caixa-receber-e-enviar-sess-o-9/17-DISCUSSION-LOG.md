# Phase 17: E-mail: conectar a caixa, receber e enviar (Sessão 9) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-19
**Phase:** 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
**Areas discussed:** Como o dono quer conectar, Rotas e login OAuth, Credencial e tabelas, Servidor que o usuário digita, Histórico da caixa, Leitor e fila, O que não vira Conversa, Contato e fio, HTML do e-mail, Envio, Pasta de Enviados, Anexos, Queda da conexão

**Modo:** `--auto` (a opção recomendada de cada pergunta, sem perguntar ao dono). O encadeamento automático para planejar e executar, que o `--auto` do GSD faria depois, **não foi disparado**: a execução espera o dono revisar os planos.

---

## Como o dono quer conectar (decidido antes da discussão)

| Option | Description | Selected |
|--------|-------------|----------|
| (A) IMAP/SMTP com senha ou senha de app | Serve para Gmail com senha de app e hospedagens comuns; não serve ao Microsoft 365 | ✓ |
| (B) IMAP/SMTP com login OAuth do Google e da Microsoft | O mesmo protocolo, entrando pela conta, sem senha | ✓ |
| (C) Gmail API e Microsoft Graph | Aviso instantâneo, mas uma integração por serviço e um valor novo em `provedor` | |

**User's choice:** A e B, em 2026-11-19: "o ideal será o user conseguir conectar o email que quer atrelar a uma caixa de entrada pela plataforma. Inicialmente acho que podemos pensar nas duas primeiras opções."
**Notes:** O dono começou a criar o aplicativo de login em paralelo (9.1.3), sem dizer se é o do Google, o da Microsoft ou os dois.

---

## Rotas e login OAuth

| Option | Description | Selected |
|--------|-------------|----------|
| Rotas próprias do provedor; volta do login na WEB, `concluir` com a sessão (molde do Instagram) | Confere Membro e Espaço do `state`; recadastrar a URI nos dois painéis se mudar | ✓ |
| `POST /canais/:id/conectar` único; volta do login direto na API (texto original da 9.2.1 e 9.2.2) | Responde 409 para quem não conecta por QR; sem a conferência da sessão | |

**Choice:** [auto] rotas próprias e volta na web (D-17-03, D-17-04).

## Credencial e tabelas

| Option | Description | Selected |
|--------|-------------|----------|
| Segredo no cofre; servidor, porta e estado em tabela própria (`017`), como `instagram_contas` | Segue a 009 e a 014; migração imutável | ✓ |
| Tudo no cofre | Mistura o que não é segredo com o que é | |

**Choice:** [auto] cofre mais tabela própria (D-17-05). Token de acesso renovado de forma preguiçosa.

## Servidor que o usuário digita

| Option | Description | Selected |
|--------|-------------|----------|
| Portas fixas (993, 143, 465, 587), TLS obrigatório, IP público conferido antes de conectar, erro classificado | Fecha a varredura de rede e o acesso ao que roda na VM | ✓ |
| Aceitar qualquer host e porta e devolver a frase do servidor (como o plano dizia) | Mais simples; abre a API como sonda de rede interna | |

**Choice:** [auto] guarda de rede (D-17-07). Não estava no plano.

## Histórico da caixa

| Option | Description | Selected |
|--------|-------------|----------|
| Só o que chegar depois de conectar (cursor no `UIDNEXT`) | Uma caixa de anos não vira milhares de Conversas | ✓ |
| Importar tudo ao conectar | Histórico completo, volume imprevisível | |

**Choice:** [auto] sem histórico (D-17-08). Não estava no plano.

## Leitor e fila

| Option | Description | Selected |
|--------|-------------|----------|
| Leitor no `apps/api` (`IDLE` e 2 min), liga por `EMAIL_LEITOR_ATIVO`, um por Canal por trava; entrega à fila `webhooks_recebidos` com `chave` = Message-ID | Reaproveita o processador, a idempotência e o tempo real | ✓ |
| Leitor grava Mensagem direto | Duplica a lógica de Contato e Conversa e perde a idempotência da fila | |
| Processo separado do `apps/api` | Mais isolado; mais uma unidade na VM | |

**Choice:** [auto] D-17-09, D-17-10. O `corpo` leva o e-mail interpretado, nunca o MIME cru.

## O que não vira Conversa

| Option | Description | Selected |
|--------|-------------|----------|
| Respostas automáticas, não entrega, listas (`Precedence`) e o próprio Canal, como `ignorado:<motivo>` | Evita laço e ruído; auditável | ✓ |
| Importar tudo | Abre Conversa com o servidor de e-mail | |

**Choice:** [auto] D-17-11. `List-Unsubscribe` ficou para a pesquisa.

## Contato e fio

| Option | Description | Selected |
|--------|-------------|----------|
| Contato = `From` em minúsculas; fio por `In-Reply-To` e `References`; "Re:" sem cabeçalho não junta | Igual ao plano | ✓ |
| Juntar por assunto | Mistura e-mails de assuntos iguais por acaso | |

| Option | Description | Selected |
|--------|-------------|----------|
| Resposta de outra pessoa no fio entra na mesma Conversa e não troca o Contato | Mais simples | ✓ |
| Separar a Conversa por remetente | Uma Conversa por pessoa; fio quebrado | |

**Choice:** [auto] D-17-12 a D-17-15. A última (D-17-15) é a que o dono mais deve confirmar.

## HTML do e-mail

| Option | Description | Selected |
|--------|-------------|----------|
| Guardar o original e limpar só ao mostrar (sem script, sem imagem remota, links seguros) | Não perde o original | ✓ |
| Limpar ao receber e guardar só a versão limpa | Perde o original se a regra de limpeza mudar | |

**Choice:** [auto] D-17-13.

## Envio, pasta de Enviados e anexos

| Option | Description | Selected |
|--------|-------------|----------|
| Saída da Fase 16 (outbox e worker), `Message-ID` próprio gravado antes, ambíguo nunca reenviado | Sem caminho paralelo | ✓ |
| `APPEND` em Enviados só quando o servidor não guarda; Gmail pula; Microsoft 365 conferido na prova real | Evita duplicar em Enviados | ✓ |
| Teto de 20 MB na saída; na entrada, o D-16-08; tipo fora da lista não é servido | Segue a Fase 16 | ✓ |

**Choice:** [auto] D-17-16 a D-17-19. O assunto e as cópias passam a chegar ao servidor (D-17-19).

## Queda da conexão

| Option | Description | Selected |
|--------|-------------|----------|
| Canal `desconectada` com o motivo, leitor para, `pendente` reenfileiradas ao voltar; falha de rede reconecta sem mudar o estado | Sem laço contra o servidor do cliente | ✓ |
| Tentar para sempre | Pode travar a conta do cliente por excesso de falhas de login | |

**Choice:** [auto] D-17-20.

---

## Claude's Discretion

Ordem e corte em planos, dublês de teste de IMAP, SMTP e login, biblioteca de limpeza do HTML, escopo mínimo do Google, rotação do token da Microsoft, tamanho máximo do texto no `corpo`, limite de sessões IMAP por processo, `UIDVALIDITY`, `List-Unsubscribe`, como o contrato acomoda um provedor que busca, textos de erro e de estado da ficha, dono e Fila do Contato criado por e-mail.

## Deferred Ideas

Importar o histórico; ler a pasta de enviados; outras pastas; aviso por push (opção C); mais de uma caixa por Canal e assinatura por Canal; renovação do token por rotina; limite de taxa próprio do endpoint de senha.
