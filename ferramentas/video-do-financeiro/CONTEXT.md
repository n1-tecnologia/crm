# Vídeo do Guia do Financeiro

O vídeo que o Guia do Financeiro toca (bucket público `guias` do Storage do
Supabase — fora do repositório e fora do bucket privado de anexos) é a **tela real** do `apps/web` sendo usada como uma pessoa usaria — cursor
andando, cliques, digitação — com zoom no que se explica e legenda em cada
ponto. Esta pasta é a ferramenta que o produz; não é uma camada do produto
(nada daqui é importado pelo app) e fica fora dos workspaces: o CI não
instala Remotion nem navegador por causa dela.

| Arquivo | O que faz |
|---|---|
| `estado.ts` | O estado de demonstração: o seed do domínio (dados fictícios) + a Lista de Solicitações e o Formulário criados pelas mesmas funções da produção + pedidos de exemplo + um Resumo esperando conferência. |
| `servidor.ts` | Faz o papel do `apps/api` e do login do Supabase para o web, em memória. As escritas passam pelo registro real de operações do domínio. `POST /demonstracao/reiniciar` volta ao estado inicial. |
| `gravar.mjs` | O roteiro: Playwright usa a tela (cursor, cliques, digitação) e grava os quadros (screencast do Chromium) e as marcas (título, texto, caixa em foco) em `public/gravacao/`. |
| `video/` | A composição Remotion: a gravação com câmera, cursor, onda do clique e legendas; trechos parados encurtados. |
| `renderizar.mjs` | Gera o MP4 e o pôster em `saida/` (fora do git). |
| `publicar-no-storage.mjs` | Envia `saida/` para o bucket `guias` (cria o bucket público se faltar). Escreve em produção: o dono roda. |

## Regravar (quando a tela mudar)

```bash
cd ferramentas/video-do-financeiro && npm install        # uma vez
# terminal 1 (raiz): o servidor de demonstração, porta 54330
npx vite-node ferramentas/video-do-financeiro/servidor.ts
# terminal 2 (apps/web): o web de verdade apontando para ele, porta 3007
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54330 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=demonstracao \
NEXT_PUBLIC_API_URL=http://127.0.0.1:54330 API_URL=http://127.0.0.1:54330 npx next dev -p 3007
# terminal 3 (raiz): grava (SONDAR=1 também tira uma foto em cada marca)
node ferramentas/video-do-financeiro/gravar.mjs
# monta (nesta pasta)
node renderizar.mjs
# e publica no Storage (o mesmo endereço: o app pega o vídeo novo sem deploy)
SUPABASE_URL=… SUPABASE_SECRET_KEY=… node publicar-no-storage.mjs
```

A gravação leva uns 7 minutos de tela; o vídeo fica com uns 3 min e meio
(trechos parados viram 0,15 s, o resto anda a 1,8×, as marcas a 1,2×).
Não edite `apps/web` enquanto grava: o Next recompila a tela no meio.

**Licença:** o Remotion é gratuito só para empresas de até 3 pessoas; acima
disso exige licença de empresa (remotion.pro/license).

**Nunca grave com dado real:** o vídeo é servido publicamente pela Vercel.
