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
