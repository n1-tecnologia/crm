/**
 * O servidor de DEMONSTRAÇÃO do vídeo: faz o papel do `apps/api` e do login
 * do Supabase para o `apps/web` de verdade, rodando local, sem banco e sem
 * rede. As escritas passam pelo registro REAL de operações do domínio
 * (`OPERACOES`), com os mesmos argumentos revividos, e voltam como a mesma
 * `Diferenca` que a persistência devolve — a tela se comporta como em
 * produção. Só o transporte é de mentira: tudo vive na memória deste processo
 * e some quando ele para.
 *
 *   npx vite-node ferramentas/video-do-financeiro/servidor.ts   (da raiz; porta 54330)
 *
 * O web aponta para cá: NEXT_PUBLIC_API_URL, API_URL e NEXT_PUBLIC_SUPABASE_URL
 * = http://127.0.0.1:54330 (ver `CONTEXT.md`). Qualquer e-mail e senha entram
 * como a Mari do seed.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { COLECOES, SINGULARES } from "@n1/dominio/colecoes";
import type { Diferenca, Ordens } from "@n1/dominio/diferenca";
import { formBySecret, formOutdatedReason, submitForm, syncIdSequence } from "@n1/dominio/operations";
import { ehNomeDeOperacao, OPERACOES, reviverArgumentos } from "@n1/dominio/operations/registro";
import { USUARIOS_DO_SEED, emailDoSeed } from "@n1/dominio/usuarios-do-seed";
import type { DataState } from "@n1/dominio/state";
import { paraDtoPublico } from "../../apps/api/src/rotas/formularios-publicos";
import { MARI, estadoDeDemonstracao } from "./estado";

const PORTA = Number(process.env.PORTA_DA_DEMONSTRACAO ?? 54330);
const BASE = `http://127.0.0.1:${PORTA}`;

let { state, segredo } = estadoDeDemonstracao();
let revisao = 1;

/* ─────────────────────────── estado e diferença ─────────────────────────── */

let registro = state as unknown as Record<string, unknown>;
const ehSingular = (colecao: string) => (SINGULARES as readonly string[]).includes(colecao);

function ordensDe(): Ordens {
  const ordens: Ordens = {};
  for (const colecao of COLECOES) {
    const lista = registro[colecao];
    if (!Array.isArray(lista)) continue;
    ordens[colecao] = Object.fromEntries(lista.map((r: { id: string }, i) => [r.id, i]));
  }
  return ordens;
}

type Foto = Map<string, string>;
const chave = (colecao: string, id: string) => `${colecao}\u0000${id}`;

function fotografar(): Foto {
  const foto: Foto = new Map();
  for (const colecao of COLECOES) {
    const valor = registro[colecao];
    if (ehSingular(colecao)) foto.set(chave(colecao, colecao), JSON.stringify(valor));
    else if (Array.isArray(valor)) for (const r of valor as { id: string }[]) foto.set(chave(colecao, r.id), JSON.stringify(r));
  }
  return foto;
}

/** O que mudou desde a foto — a mesma forma que `gravar()` devolve no `apps/api`. */
function diferencaDesde(antes: Foto): Diferenca {
  const gravados: Diferenca["gravados"][number][] = [];
  const vistos = new Set<string>();
  for (const colecao of COLECOES) {
    const valor = registro[colecao];
    if (ehSingular(colecao)) {
      const k = chave(colecao, colecao);
      vistos.add(k);
      if (antes.get(k) !== JSON.stringify(valor)) gravados.push({ colecao, id: colecao, dados: valor, ordem: 0 });
      continue;
    }
    if (!Array.isArray(valor)) continue;
    (valor as { id: string }[]).forEach((r, ordem) => {
      const k = chave(colecao, r.id);
      vistos.add(k);
      if (antes.get(k) !== JSON.stringify(r)) gravados.push({ colecao, id: r.id, dados: r, ordem });
    });
  }
  const removidos = [...antes.keys()]
    .filter((k) => !vistos.has(k))
    .map((k) => {
      const [colecao, id] = k.split("\u0000") as [string, string];
      return { colecao, id };
    });
  return { gravados, removidos };
}

/* ─────────────────────────────── HTTP ─────────────────────────────── */

function cors(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", req.headers.origin ?? "*");
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] ?? "authorization,content-type,apikey,x-client-info");
}

function json(res: ServerResponse, status: number, corpo: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of req) partes.push(parte as Buffer);
  return Buffer.concat(partes);
}

async function lerJson<T>(req: IncomingMessage): Promise<T> {
  const texto = (await lerCorpo(req)).toString("utf8");
  return (texto ? JSON.parse(texto) : {}) as T;
}

/* ─────────────────────── login (o papel do Supabase) ─────────────────────── */

const usuarioId = USUARIOS_DO_SEED[MARI]!;
const usuario = {
  id: usuarioId,
  aud: "authenticated",
  role: "authenticated",
  email: emailDoSeed(MARI),
  email_confirmed_at: "2026-09-01T12:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { member_id: MARI },
  identities: [],
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
};

const base64url = (objeto: unknown) => Buffer.from(JSON.stringify(objeto)).toString("base64url");

function sessao() {
  const agora = Math.floor(Date.now() / 1000);
  const exp = agora + 8 * 3600;
  const token = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ sub: usuarioId, email: usuario.email, role: "authenticated", aud: "authenticated", iat: agora, exp, session_id: "demonstracao" })}.demonstracao`;
  return { access_token: token, token_type: "bearer", expires_in: exp - agora, expires_at: exp, refresh_token: "demonstracao", user: usuario };
}

/* ───────────────────────── formulário público ───────────────────────── */

const objetos = new Map<string, { submissionId: string; displayName: string; mediaType: string; sizeBytes: number }>();

async function rotear(req: IncomingMessage, res: ServerResponse): Promise<void> {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", BASE);
  const caminho = url.pathname;

  // Login
  if (caminho === "/auth/v1/token" && req.method === "POST") return json(res, 200, sessao());
  if (caminho === "/auth/v1/user") return json(res, 200, usuario);
  if (caminho === "/auth/v1/logout") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Cada gravação começa do mesmo estado: o envio do Formulário e o "Conferido" mudam os dados.
  if (caminho === "/demonstracao/reiniciar" && req.method === "POST") {
    ({ state, segredo } = estadoDeDemonstracao());
    registro = state as unknown as Record<string, unknown>;
    revisao += 1;
    objetos.clear();
    return json(res, 200, { ok: true, segredo, revisao });
  }

  // apps/api
  if (caminho === "/saude") return json(res, 200, { ok: true, servico: "demonstração" });
  if (caminho === "/estado" && req.method === "GET") return json(res, 200, { data: state, revisao, ordens: ordensDe(), sessao: { memberId: MARI } });
  if (caminho === "/estado/revisao") return json(res, 200, { revisao });

  const operacao = /^\/operacoes\/([A-Za-z0-9_]+)$/.exec(caminho);
  if (operacao && req.method === "POST") {
    const nome = operacao[1]!;
    if (!ehNomeDeOperacao(nome)) return json(res, 404, { ok: false, error: `Operação "${nome}" não existe.` });
    const corpo = await lerJson<{ args: unknown[] }>(req);
    const args = reviverArgumentos(corpo.args);
    syncIdSequence(state);
    const antes = fotografar();
    const r = (OPERACOES[nome] as (s: DataState, m: string, ...a: unknown[]) => { ok: boolean; value?: unknown; error?: string; field?: string })(state, MARI, ...args);
    const diferenca = diferencaDesde(antes);
    const revisaoAnterior = revisao;
    if (diferenca.gravados.length > 0 || diferenca.removidos.length > 0) revisao += 1;
    console.log(`operação ${nome} → ${r.ok ? "ok" : `recusada: ${r.error}`} (${diferenca.gravados.length} gravados)`);
    return json(res, 200, r.ok ? { ok: true, value: r.value, diferenca, revisao, revisaoAnterior } : { ok: false, error: r.error, ...(r.field ? { field: r.field } : {}), diferenca, revisao, revisaoAnterior });
  }

  const publico = /^\/v1\/public\/forms\/([^/]+)(\/uploads|\/submissions)?$/.exec(caminho);
  if (publico) {
    const secret = decodeURIComponent(publico[1]!);
    const form = formBySecret(state, secret);
    if (!form || !form.enabled) return json(res, 404, { ok: false, error: "Este link não está disponível." });
    if (!publico[2]) {
      if (formOutdatedReason(state, form)) return json(res, 409, { ok: false, error: "Formulário em revisão." });
      return json(res, 200, paraDtoPublico(state, form));
    }
    if (publico[2] === "/uploads") {
      const pedido = await lerJson<{ submissionId?: string; displayName: string; mediaType: string }>(req);
      const submissionId = pedido.submissionId ?? randomUUID();
      const objectId = randomUUID();
      objetos.set(objectId, { submissionId, displayName: pedido.displayName, mediaType: pedido.mediaType, sizeBytes: 0 });
      return json(res, 200, { submissionId, objectId, uploadUrl: `${BASE}/armazenamento/${objectId}`, token: "demonstracao", expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    }
    const pedido = await lerJson<{ submissionId: string; answers: Record<string, string>; attachments?: { questionId: string; objectId: string }[] }>(req);
    const attachments = (pedido.attachments ?? []).map((anexo) => {
      const objeto = objetos.get(anexo.objectId)!;
      return { questionId: anexo.questionId, objectKey: `demonstracao/${anexo.objectId}`, displayName: objeto.displayName, mediaType: objeto.mediaType, sizeBytes: Math.max(objeto.sizeBytes, 1) };
    });
    syncIdSequence(state);
    const r = submitForm(state, secret, { answers: pedido.answers, attachments });
    if (!r.ok) return json(res, 400, { ok: false, error: r.error, ...(r.field ? { field: r.field } : {}) });
    revisao += 1;
    console.log(`formulário enviado → ${r.value.readableId ?? r.value.id}`);
    return json(res, 201, { readableId: r.value.readableId ?? r.value.id });
  }

  const armazenamento = /^\/armazenamento\/([^/]+)$/.exec(caminho);
  if (armazenamento && (req.method === "PUT" || req.method === "POST")) {
    const bytes = await lerCorpo(req);
    const objeto = objetos.get(armazenamento[1]!);
    if (objeto) objeto.sizeBytes = bytes.length;
    return json(res, 200, { Key: armazenamento[1] });
  }

  console.log(`sem rota: ${req.method} ${caminho}`);
  return json(res, 404, { ok: false, error: "Rota não encontrada." });
}

createServer((req, res) => {
  rotear(req, res).catch((erro: unknown) => {
    console.error(erro);
    if (!res.headersSent) json(res, 500, { ok: false, error: "Erro interno." });
  });
}).listen(PORTA, "127.0.0.1", () => {
  console.log(`demonstração em ${BASE} · Formulário em /f/${segredo}`);
});
