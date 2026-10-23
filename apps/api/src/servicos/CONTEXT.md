# servicos

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

Os casos de uso. Compõem operações de `@n1/dominio` e falam com os repositórios. A transação começa e termina aqui.

Um serviço existe quando a operação precisa de I/O ANTES de entrar na Unidade de Trabalho — a rota compõe (`rotas/operacoes.ts` → `servicos/*.ts` → `persistencia/unidade-de-trabalho.ts`). Se a operação não precisa de I/O prévio, a rota chama `executar()` direto: a Unidade de Trabalho já cobre esse caso sozinha, sem passar por aqui.

## `convidar-membro.ts`

`convidarMembro(pedido, deps?)` — o exemplo do contrato. Antes de `executar()`: resolve o e-mail do convite contra o Supabase Auth (`resolverUsuarioPorEmail`, `apps/api/src/autenticacao/resolver-usuario.ts`). Dentro de `executar()`: `inviteMember` (domínio puro) recebe o `userId` já resolvido e reativa o mesmo Membro `removido` se houver um (RN-ET-11, PERS-09). `deps.resolverUsuario` existe só para teste — produção usa o resolvedor real.

## Anexos (`storage-uploads.ts`)

Nota fiscal, boleto e comprovantes vivem em bucket privado do Supabase da
plataforma (D-04): a documentação da Supabase é explícita — download de um
bucket privado exige JWT com RLS ou URL assinada temporária, nunca uma URL
pública permanente. É por isso que o envio é em duas fases (`abrirSessaoDeUpload`
→ `emitirTicket` → upload direto do navegador → `confirmarObjeto`), e por
que `urlDeDownload` gera uma URL nova a cada leitura em vez de guardar uma —
uma URL assinada guardada seria, na prática, um segredo de longa duração
escapando do controle do servidor.

O caminho do objeto (`objectKey`) é aleatório — um uuid — e nunca o nome de
arquivo que o usuário escolheu. Nome de arquivo de nota fiscal costuma
carregar razão social e valor (T-02-14); um caminho previsível a partir do
nome do arquivo vazaria isso pela própria estrutura do bucket, mesmo que o
conteúdo estivesse protegido.

MIME declarado pelo cliente nunca basta (T-02-06/Tampering): o navegador
pode mentir sobre o `Content-Type` sem esforço. `confirmarObjeto` baixa o
conteúdo depois do upload e confere a **assinatura de arquivo** nos
primeiros bytes contra o tipo declarado (`%PDF-` para PDF, os três bytes
iniciais de JPEG, a assinatura de PNG, `RIFF`/`WEBP` para WebP; XML exige
que o primeiro caractere não-espaço seja `<`) — é essa checagem, não o
`Content-Type` do upload, que decide se o arquivo vira anexo.

A service role de Storage vive só em `storage-uploads.ts` (via o client
admin que `autenticacao/verificar-token.ts` já constrói) e nunca é devolvida
por nenhuma rota: o navegador só recebe o ticket de upload assinado
(`createSignedUploadUrl`, escopo de um único objeto, `upsert: false`) ou a
URL de download assinada — nunca a credencial que os gera.

## CRM (`crm/`, Fase 7)

Um serviço por recurso — `contatos.ts`, `empresas.ts`, `funis.ts`,
`negocios.ts` — com a mesma forma: `criarServicoDe…({ pool, acesso })`
devolve a interface que a rota chama, cada método devolve `ResultadoCrm<T>`
(`resultado.ts`: `sucesso(valor)` ou `recusa(status, frase, { codigo,
campo?, bloqueios? })`), nunca lança para a rota. As regras puras vêm de
`@n1/dominio/crm/*`; o serviço as aplica sobre o que leu do banco.

**`comTransacao` (`transacao.ts`).** `begin` → `fn(cliente)` → `commit` no
sucesso, `rollback` na recusa. O `commit` fica **dentro do `try`** que tem o
`catch` de tradução, de propósito: o constraint trigger deferido da 007
("toda Empresa tem ao menos um Contato admin", D-08) só dispara no
`commit`, e é ali que um 23514 precisa virar 409 e não 500. Os repositórios
recebem o `PoolClient` e nunca abrem transação.

**Pré-checagem para os 409 ricos, SQLSTATE como rede.** D-07 (Funil ou
Etapa com Negócios), D-08 (Empresa sem admin) e D-09 (Contato que é o
único admin de uma Empresa ou dono de Negócio) exigem dizer *quem* bloqueia
— o serviço consulta antes de escrever e devolve `bloqueios` com a lista ou
a contagem. Entre a pré-checagem e a escrita outra requisição pode entrar;
aí é o constraint do banco que segura, e `traduzirErroDePg` transforma
`23505`/`23503`/`23514` em 409 com uma frase em português cadastrada em
`FrasesDeRestricao`, **sem o nome do constraint** (T-07-06). SQLSTATE sem
frase é relançado e vira o 500 genérico.

**Permissão antes de qualquer escrita (D-14, `acesso.ts`).** Todo método
chama `exigir(acesso, membro, acao, recurso)` antes de ler ou escrever: o
Papel é lido de `plataforma.registros` (`members` → `roles`) a cada
requisição, e a decisão é `podeNoCrm` de `@n1/dominio/crm/permissoes` — a
mesma matriz que a tela consulta para esconder botões. `membro` cria, edita
e exclui Contato, Empresa e Negócio; só `administrador`/`proprietario`
configura Funis e Etapas e reabre Negócio `ganho`; `convidado` só lê. A
tela esconde; o backend recusa (403 `PERMISSAO`).

**Proprietário (D-11, `resolverProprietario`).** Sem `proprietarioId` no
corpo, Proprietário e `criado_por` são o Membro da sessão; com ele, tem de
ser Membro `ativo` do MESMO Espaço (id removido, inexistente ou de outro
Espaço cai na mesma recusa 409 `PROPRIETARIO_INVALIDO`, T-07-40).

**Espaço.** `workspace_id` vem de `request.membro`, nunca do corpo; todo
`WHERE` dos repositórios o leva (T-07-01). Um registro de outro Espaço não
existe: 404, não 403.

## Cofre de credenciais (Fase 9)

`cofre.ts` guarda os segredos de provedor (Evolution, Meta, e-mail) em
`plataforma.credenciais` (criada pela `009`). O segredo só existe cifrado:
AES-256-GCM do `node:crypto`, IV de 12 bytes novo a cada gravação, etiqueta de
16 bytes. A chave **não** está no banco: é a `COFRE_CHAVE` (32 bytes em base64)
do `api.env` de cada ambiente, com a versão em `COFRE_CHAVE_VERSAO`. Quem levar
uma cópia do banco ou do backup leva só texto cifrado; perder a chave perde as
credenciais, por isso ela tem cópia fora da VPS, com o dono.

**A API.** `lerChavesDoCofre()` lê as chaves do ambiente e lança com mensagem
clara se a chave não tem 32 bytes ou a versão é inválida. `guardarCredencial(
cliente, chaves, entrada)` revoga a credencial ativa do mesmo (Espaço, dono,
tipo) e insere a nova no `cliente` recebido (a transação é de quem chama),
devolvendo só `{ id }`. `lerCredencial(cliente, chaves, dono)` devolve o texto da
credencial ativa ou `undefined`. `cifrar` e `decifrar` são a cifra pura, sem banco.

**Quem pode chamar `lerCredencial`.** Só os serviços de provedor (Sessões 4, 7, 8
e 9). **Nenhuma rota importa `servicos/cofre`, e nenhuma rota devolve o segredo**,
nem o cifrado nem o decifrado: um teste estrutural (`cofre.test.ts`) falha se um
arquivo de `rotas/` importar o módulo. A resposta de uma rota que grava uma
credencial leva no máximo o `id`.

**O AAD.** Cada texto cifrado fica amarrado à sua linha: o AAD é o JSON de
`[workspaceId, donoTipo, donoId, tipo, versaoDaChave]`. Uma linha copiada para
outro dono, outro Espaço ou outro tipo não decifra. **Mudar essa composição
depois que existirem credenciais obriga a re-cifrar todas.**

**Troca de chave (procedimento).** A leitura é por versão. Para trocar: gere a
chave nova (`openssl rand -base64 32`), ponha-a em `COFRE_CHAVE` com
`COFRE_CHAVE_VERSAO` + 1, e a antiga em `COFRE_CHAVE_ANTERIOR` com
`COFRE_CHAVE_ANTERIOR_VERSAO` (a versão que ela tinha). As credenciais novas
saem com a chave nova e as antigas continuam legíveis. **Re-cifrar as antigas com
a chave nova é tarefa futura**, não desta fase: enquanto não for feita, a chave
anterior precisa continuar configurada. Guarde a cópia da chave nova fora da VPS
antes de aposentar a antiga.
