/**
 * O inventário de rotas (Fase 9, 1.8, D-14 camada 1): o teste que cobre sozinho
 * toda rota que nascer.
 *
 * Um hook `onRoute` registrado logo depois de `buildApp` ouve cada rota que os
 * plugins declaram e, para TODA rota que exige JWT, prova SEM BANCO:
 *
 *   1. sem `Authorization`                              -> 401;
 *   2. token que o verificador recusa (adulterado/expirado) -> 401;
 *   3. Membro `suspenso` num método de escrita          -> 403 (1.2.1).
 *
 * As rotas sem JWT são exatamente as de `ROTAS_PUBLICAS` (cada uma com o seu
 * motivo) mais as de `/v1/integrations`, que autenticam por credencial de
 * serviço. Uma rota pública nova faz o teste falhar até entrar na lista com um
 * motivo escrito; uma rota nova com JWT é coberta sem editar este arquivo.
 *
 * Se o inventário achar uma rota com JWT que deixa o suspenso gravar, o conserto
 * é o hook `recusarSuspensoNaEscrita` no plugin dela — nunca afrouxar o teste e
 * nunca pôr a rota em `ESCRITA_PERMITIDA_AO_SUSPENSO` sem um motivo escrito.
 *
 * Roda com `DATABASE_URL` vazia, como o `npm run check` do CI: as recusas vêm
 * dos hooks, antes de qualquer acesso ao banco. Sem `.env`: os stubs de token e
 * de Membro são injetados, como em `webhook-meta.test.ts`.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { Member } from "@n1/dominio";
import type { FastifyInstance, RouteOptions } from "fastify";
import { buildApp } from "../app";
import type { ClienteDeLeituras, RespostaDeLeitura } from "../automacoes/cliente-leituras-financeiro";
import { FRASE_DE_SUSPENSO } from "../plugins/autenticacao";
import type { AcessoAoCrm } from "../servicos/crm/acesso";

interface RotaDeclarada {
  readonly metodo: string;
  readonly url: string;
}

/**
 * As rotas que NÃO exigem JWT, cada uma com o motivo. O que está aqui e não
 * existe mais, ou o que existe sem JWT e não está aqui, faz o teste falhar.
 */
const ROTAS_PUBLICAS: readonly (RotaDeclarada & { readonly motivo: string })[] = [
  { metodo: "GET", url: "/saude", motivo: "sonda de saúde do balanceador e do deploy; não devolve dado, só `ok`" },
  { metodo: "GET", url: "/v1/public/forms/:secret", motivo: "Formulário público: a confiança é o segredo do link, e o limite de taxa vem do nginx e da rota" },
  { metodo: "POST", url: "/v1/public/forms/:secret/uploads", motivo: "envio de Anexo por quem preenche o Formulário público; o segredo do link é a credencial" },
  { metodo: "POST", url: "/v1/public/forms/:secret/submissions", motivo: "resposta ao Formulário público; o segredo do link é a credencial" },
  { metodo: "GET", url: "/v1/public/tasks/:secret", motivo: "leitura da Tarefa por link público; o segredo do link é a credencial" },
  { metodo: "GET", url: "/webhooks/meta/whatsapp", motivo: "verificação do webhook da Meta; a confiança é o token de verificação" },
  { metodo: "POST", url: "/webhooks/meta/whatsapp", motivo: "evento do WhatsApp oficial; a confiança é a assinatura HMAC do corpo" },
  { metodo: "GET", url: "/webhooks/meta/instagram", motivo: "verificação do webhook da Meta; a confiança é o token de verificação" },
  { metodo: "POST", url: "/webhooks/meta/instagram", motivo: "evento do Instagram; a confiança é a assinatura HMAC do corpo" },
];

/** `/saude` nasce síncrona dentro de `buildApp`, antes de qualquer hook externo poder ouvi-la. */
const DECLARADAS_ANTES_DO_GANCHO: readonly string[] = ["GET /saude"];

/** As rotas sob este prefixo autenticam por credencial de serviço (D-15), nunca por JWT. */
const PREFIXO_DE_SERVICO = "/v1/integrations";

/** Preenche o `:parametro` da url: `:nome` precisa ser uma operação do registro; o resto aceita qualquer texto. */
const PARAMETRO_DE_TESTE: Readonly<Record<string, string>> = { nome: "trashContact" };
const PARAMETRO_PADRAO = "x";

/**
 * As rotas de escrita que só aceitam um tipo de conteúdo que não é JSON. Hoje, o
 * upload de Extratos do Financeiro (buffer binário). Uma rota que responder 415
 * sem estar aqui faz o teste falhar com o nome dela.
 */
const CONTEUDO_POR_ROTA: Readonly<Record<string, { readonly tipo: string; readonly corpo: string; readonly cabecalhos?: Record<string, string> }>> = {
  "POST /financeiro/extratos/:origem": { tipo: "application/octet-stream", corpo: "x", cabecalhos: { "x-file-name": "extrato.csv" } },
};

/**
 * As escritas que o Membro suspenso PODE fazer. Vazia de propósito (1.2.1): o
 * suspenso consulta e não grava, em nenhuma família de rota. Entrar aqui exige
 * um `motivo` escrito.
 */
const ESCRITA_PERMITIDA_AO_SUSPENSO: readonly (RotaDeclarada & { readonly motivo: string })[] = [];

const METODOS_DE_LEITURA = new Set(["GET", "HEAD", "OPTIONS"]);

const chave = (rota: RotaDeclarada) => `${rota.metodo} ${rota.url}`;

function clienteFalso(): ClienteDeLeituras {
  const resposta = { ok: true, dados: {} } as unknown as RespostaDeLeitura<never>;
  return {
    async ler() {
      return resposta;
    },
    async enviar() {
      return resposta;
    },
    async enviarArquivo() {
      return resposta;
    },
  };
}

/** O acesso ao CRM nunca é consultado antes do hook; se for, o teste quebra aqui em vez de tocar o banco. */
const acessoProibido: AcessoAoCrm = {
  async papelDe() {
    throw new Error("o inventário não deveria chegar ao acesso do CRM");
  },
  async membroAtivo() {
    throw new Error("o inventário não deveria chegar ao acesso do CRM");
  },
};

const TOKEN_ATIVO = "token-ativo";
const TOKEN_SUSPENSO = "token-suspenso";
const TOKEN_RECUSADO = "token-recusado";

function membroDoSeed(estado: Member["state"], userId: string, ignorar?: string): Member {
  const base = buildSeed().members.find((m) => m.state === "ativo" && m.userId !== undefined && m.id !== ignorar);
  if (!base) throw new Error("o seed precisa de Membros ativos com usuário");
  return { ...base, userId, state: estado };
}

function urlPreenchida(url: string): string {
  return url.replace(/:([A-Za-z0-9_]+)/g, (_todo, nome: string) => PARAMETRO_DE_TESTE[nome] ?? PARAMETRO_PADRAO);
}

function metodosDe(opcoes: RouteOptions): string[] {
  return (Array.isArray(opcoes.method) ? opcoes.method : [opcoes.method]).map((m) => String(m).toUpperCase());
}

/** Uma linha por falha, com método e url — para o nome da rota aparecer no relatório do Vitest. */
function relatorio(titulo: string, falhas: readonly string[]): string {
  return falhas.length === 0 ? "" : `${titulo}:\n  - ${falhas.join("\n  - ")}`;
}

describe("inventário de rotas — toda rota com JWT recusa sessão ausente, token recusado e suspenso na escrita", () => {
  let app: FastifyInstance;
  const declaradas: (RotaDeclarada & { readonly publica: boolean })[] = [];

  beforeAll(async () => {
    const ativo = membroDoSeed("ativo", "usuario-ativo");
    const suspenso = membroDoSeed("suspenso", "usuario-suspenso", ativo.id);
    const usuarios: Record<string, string> = { [TOKEN_ATIVO]: "usuario-ativo", [TOKEN_SUSPENSO]: "usuario-suspenso" };
    const membros: Record<string, Member> = { "usuario-ativo": ativo, "usuario-suspenso": suspenso };

    app = buildApp({
      logger: false,
      workspaceId: "ws_inventario",
      verificarToken: async (token) => (usuarios[token] ? { sub: usuarios[token] } : null),
      resolverMembro: async (_workspaceId, userId) => membros[userId],
      resolverCredencial: async () => undefined,
      financeiro: { cliente: clienteFalso(), clienteDeEscrita: clienteFalso() },
      crm: { acesso: acessoProibido },
    });
    app.addHook("onRoute", (opcoes) => {
      for (const metodo of metodosDe(opcoes)) {
        // OPTIONS é o preflight do CORS, que o `@fastify/cors` gera sozinho; HEAD é o espelho que o Fastify cria de cada GET.
        if (metodo === "OPTIONS") continue;
        declaradas.push({ metodo, url: opcoes.url, publica: opcoes.config?.publica === true });
      }
    });
    await app.ready();
  });

  /** As rotas que exigem JWT: nem públicas, nem de serviço. Sem repetição de método + url. */
  function rotasComJwt(): RotaDeclarada[] {
    const vistas = new Map<string, RotaDeclarada>();
    for (const rota of declaradas) {
      if (rota.publica) continue;
      if (rota.url === PREFIXO_DE_SERVICO || rota.url.startsWith(`${PREFIXO_DE_SERVICO}/`)) continue;
      vistas.set(chave(rota), { metodo: rota.metodo, url: rota.url });
    }
    return [...vistas.values()];
  }

  function rotasDeServico(): RotaDeclarada[] {
    const vistas = new Map<string, RotaDeclarada>();
    for (const rota of declaradas) {
      if (rota.url === PREFIXO_DE_SERVICO || rota.url.startsWith(`${PREFIXO_DE_SERVICO}/`)) vistas.set(chave(rota), { metodo: rota.metodo, url: rota.url });
    }
    return [...vistas.values()];
  }

  const escritas = () => rotasComJwt().filter((r) => !METODOS_DE_LEITURA.has(r.metodo));

  it("enxerga as rotas dos plugins (o hook onRoute pegou o que importa)", () => {
    const conhecidas = new Set(rotasComJwt().map(chave));
    for (const esperada of ["POST /operacoes/:nome", "GET /estado", "POST /contatos", "POST /canais", "POST /tarefas/:taskId/anexos/ticket", "POST /financeiro/workflows/:key/executar"]) {
      expect(conhecidas.has(esperada), `o inventário não viu ${esperada}`).toBe(true);
    }
    expect(rotasComJwt().length).toBeGreaterThan(30);
    expect(rotasDeServico().length).toBeGreaterThan(0);
  });

  it("as rotas sem JWT são exatamente ROTAS_PUBLICAS (e todas têm motivo)", () => {
    // HEAD é o espelho que o Fastify cria de cada GET, com a mesma config: some quando o GET dele está na conta.
    const publicas = declaradas.filter((r) => r.publica);
    const getsPublicos = new Set(publicas.filter((r) => r.metodo === "GET").map((r) => r.url));
    const publicasVistas = new Set([
      ...publicas.filter((r) => !(r.metodo === "HEAD" && getsPublicos.has(r.url))).map(chave),
      ...DECLARADAS_ANTES_DO_GANCHO,
    ]);
    const listadas = new Set(ROTAS_PUBLICAS.map(chave));
    const aMais = [...publicasVistas].filter((r) => !listadas.has(r));
    const aMenos = [...listadas].filter((r) => !publicasVistas.has(r));
    expect(aMais, `rota pública fora de ROTAS_PUBLICAS (dê um motivo a ela):\n${aMais.join("\n")}`).toEqual([]);
    expect(aMenos, `ROTAS_PUBLICAS cita rota que não existe mais:\n${aMenos.join("\n")}`).toEqual([]);
    for (const rota of ROTAS_PUBLICAS) expect(rota.motivo.trim().length, `${chave(rota)} sem motivo`).toBeGreaterThan(10);
  });

  it("/saude responde sem Authorization (a única pública declarada antes do gancho)", async () => {
    const resposta = await app.inject({ method: "GET", url: "/saude" });
    expect(resposta.statusCode).toBe(200);
  });

  it("sem Authorization, toda rota com JWT responde 401", async () => {
    const falhas: string[] = [];
    for (const rota of rotasComJwt()) {
      const resposta = await app.inject({ method: rota.metodo as "GET", url: urlPreenchida(rota.url) });
      if (resposta.statusCode !== 401) falhas.push(`${chave(rota)} -> ${resposta.statusCode}`);
    }
    expect(falhas, relatorio("rotas que atendem sem sessão", falhas)).toEqual([]);
  });

  it("com um token que o verificador recusa (adulterado ou expirado), toda rota com JWT responde 401", async () => {
    const falhas: string[] = [];
    for (const rota of rotasComJwt()) {
      const resposta = await app.inject({
        method: rota.metodo as "GET",
        url: urlPreenchida(rota.url),
        headers: { authorization: `Bearer ${TOKEN_RECUSADO}` },
      });
      if (resposta.statusCode !== 401) falhas.push(`${chave(rota)} -> ${resposta.statusCode}`);
    }
    expect(falhas, relatorio("rotas que aceitam token recusado", falhas)).toEqual([]);
  });

  it("o Membro suspenso recebe 403 em toda rota de escrita com JWT", async () => {
    const liberadas = new Set(ESCRITA_PERMITIDA_AO_SUSPENSO.map(chave));
    for (const rota of ESCRITA_PERMITIDA_AO_SUSPENSO) expect(rota.motivo.trim().length, `${chave(rota)} sem motivo`).toBeGreaterThan(10);

    const falhas: string[] = [];
    const semConteudo: string[] = [];
    const alvo = escritas().filter((r) => !liberadas.has(chave(r)));
    expect(alvo.length).toBeGreaterThan(20);
    for (const rota of alvo) {
      const conteudo = CONTEUDO_POR_ROTA[chave(rota)];
      const ehOperacao = rota.url === "/operacoes/:nome";
      const resposta = await app.inject({
        method: rota.metodo as "POST",
        url: urlPreenchida(rota.url),
        headers: { authorization: `Bearer ${TOKEN_SUSPENSO}`, "content-type": conteudo?.tipo ?? "application/json", ...conteudo?.cabecalhos },
        payload: conteudo ? conteudo.corpo : ehOperacao ? { args: [] } : {},
      });
      if (resposta.statusCode === 415 && !conteudo) {
        semConteudo.push(chave(rota));
        continue;
      }
      if (resposta.statusCode !== 403) {
        falhas.push(`${chave(rota)} -> ${resposta.statusCode}`);
        continue;
      }
      // A recusa é a do suspenso, e não a de outra barreira que por acaso também diz 403.
      if (!resposta.body.includes(FRASE_DE_SUSPENSO)) falhas.push(`${chave(rota)} -> 403 sem a frase do suspenso: ${resposta.body.slice(0, 120)}`);
    }
    expect(semConteudo, relatorio("rotas que só aceitam outro tipo de conteúdo (acrescente a CONTEUDO_POR_ROTA)", semConteudo)).toEqual([]);
    expect(falhas, relatorio("escritas que o suspenso consegue fazer", falhas)).toEqual([]);
  });

  it("rota de /v1/integrations chamada com o JWT de um Membro ativo responde 401 (lá só vale credencial de serviço)", async () => {
    const falhas: string[] = [];
    for (const rota of rotasDeServico()) {
      const resposta = await app.inject({
        method: rota.metodo as "GET",
        url: urlPreenchida(rota.url),
        headers: { authorization: `Bearer ${TOKEN_ATIVO}` },
        ...(METODOS_DE_LEITURA.has(rota.metodo) ? {} : { payload: {} }),
      });
      if (resposta.statusCode !== 401) falhas.push(`${chave(rota)} -> ${resposta.statusCode}`);
    }
    expect(falhas, relatorio("rotas de serviço que aceitam JWT de Membro", falhas)).toEqual([]);
  });
});
