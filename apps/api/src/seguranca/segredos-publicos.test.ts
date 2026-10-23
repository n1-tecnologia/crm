/**
 * Segredo de link sob enumeração e força bruta (Fase 9, D-14 camada 1; T-09-79 e
 * T-09-80): `GET /v1/public/forms/:secret` e `GET /v1/public/tasks/:secret`.
 *
 * Nas duas rotas o segredo na URL é a ÚNICA credencial. Duas defesas, provadas aqui
 * contra o app em processo (`inject`), sem banco, sem rede e sem `.env`:
 *
 *  1. Não enumerar: um segredo que não existe, um malformado e o de um link
 *     desativado/revogado respondem 404 com o MESMO corpo, byte a byte. Quem
 *     adivinha não aprende nada com a diferença entre "nunca existiu" e "foi
 *     desativado".
 *  2. Não forçar: o mesmo IP, passando do limite em memória (a segunda camada, atrás
 *     do nginx), recebe 429 com `Retry-After`.
 *
 * Só `inject` contra o app deste processo: nenhuma requisição sai da máquina.
 */

import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { memberReachesContainer } from "@n1/dominio/derive";
import { effectiveLifecycleOfList } from "@n1/dominio/derive";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState, Form } from "@n1/dominio";
import { buildApp } from "../app";
import { criarLimiteDeTaxa } from "../servicos/limite-de-taxa";

/** Um segredo aleatório que passa na validação de formato das rotas (hex, 32 caracteres): chega até a consulta. */
const segredoAleatorio = (): string => randomBytes(16).toString("hex");

interface Cenario {
  readonly estado: DataState;
  readonly formularioAtivo: string;
  readonly formularioDesativado: string;
  readonly tarefaAtiva: string;
  readonly tarefaRevogada: string;
}

/**
 * Parte de `buildSeed()`: acrescenta dois Formulários (um ativo, um desativado) a uma Lista que o Proprietário alcança,
 * e usa dois links públicos de Tarefa (o `demo-tarefa` do seed, ativo, e um revogado na mesma Lista).
 */
function montarCenario(): Cenario {
  const estado = buildSeed();
  const donoId = estado.workspace.ownerMemberId;
  const lista = estado.lists.find((l) => effectiveLifecycleOfList(estado, l.id) === "ativo" && memberReachesContainer(estado, donoId, "list", l.id));
  if (!lista) throw new Error("o seed precisa de uma Lista ativa que o Proprietário alcance");

  const formularioAtivo = `SEGREDO-ATIVO-${segredoAleatorio()}`;
  const formularioDesativado = `SEGREDO-DESATIVADO-${segredoAleatorio()}`;
  const agora = new Date().toISOString();
  const formulario = (id: string, secret: string, enabled: boolean): Form => ({
    id,
    workspaceId: estado.workspace.id,
    createdBy: { kind: "member", id: donoId },
    createdAt: agora,
    lifecycle: "ativo",
    listId: lista.id,
    name: `Formulário ${id}`,
    ownerMemberId: donoId,
    questions: [{ id: `fqs_${id}`, label: "Assunto", required: true, target: { kind: "title" } }],
    enabled,
    secret,
    submissions: 0,
  });
  estado.forms.push(formulario("frm_seg_ativo", formularioAtivo, true), formulario("frm_seg_desativado", formularioDesativado, false));

  const demo = estado.tasks.find((t) => t.publicShare?.secret === "demo-tarefa");
  if (!demo) throw new Error("o seed precisa do link público de demonstração (demo-tarefa)");
  const tarefaRevogada = `REVOGADO-${segredoAleatorio()}`;
  const outra = estado.tasks.find((t) => t.listId === demo.listId && t.id !== demo.id && t.lifecycle === "ativo");
  if (!outra) throw new Error("o seed precisa de uma segunda Tarefa ativa na Lista do link de demonstração");
  outra.publicShare = { secret: tarefaRevogada, active: false, createdBy: donoId, createdAt: agora, showsComments: false, showsAttachments: false };

  return { estado, formularioAtivo, formularioDesativado, tarefaAtiva: "demo-tarefa", tarefaRevogada };
}

function appDoCenario(cenario: Cenario, maximoPorIp: number) {
  const limitePorIp = criarLimiteDeTaxa({ janelaMs: 60_000, maximo: maximoPorIp });
  const lerEstado = async () => cenario.estado;
  return buildApp({
    logger: false,
    workspaceId: "ws_segredos_publicos",
    trustProxy: "",
    verificarToken: async () => null,
    resolverMembro: async () => undefined,
    formulariosPublicos: { lerEstado, limitePorIp },
    tarefasPublicas: { lerEstado, limitePorIp },
  });
}

const ROTAS = [
  { nome: "Formulário", base: "/v1/public/forms", ativo: (c: Cenario) => c.formularioAtivo, desativado: (c: Cenario) => c.formularioDesativado },
  { nome: "Tarefa", base: "/v1/public/tasks", ativo: (c: Cenario) => c.tarefaAtiva, desativado: (c: Cenario) => c.tarefaRevogada },
] as const;

describe.each(ROTAS)("segredo público de $nome — enumeração e força bruta", (rota) => {
  let cenario: Cenario;

  beforeAll(() => {
    cenario = montarCenario();
  });

  it("controle positivo: o segredo ativo responde 200 (sem isto, 'tudo é 404' passaria com a rota quebrada)", async () => {
    const app = appDoCenario(cenario, 25);
    const resposta = await app.inject({ method: "GET", url: `${rota.base}/${rota.ativo(cenario)}` });
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    await app.close();
  });

  it("20 segredos aleatórios dão 404 com corpo idêntico, igual ao do link desativado e ao de um segredo malformado", async () => {
    const app = appDoCenario(cenario, 25);
    const corpos = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const resposta = await app.inject({ method: "GET", url: `${rota.base}/${segredoAleatorio()}` });
      expect(resposta.statusCode, `aleatório #${i}`).toBe(404);
      corpos.add(resposta.body);
    }
    expect(corpos.size, "os 20 aleatórios devolveram corpos diferentes entre si").toBe(1);
    const [corpoDoInexistente] = [...corpos];

    // O limite é de 25 por IP: 20 + 2 cabem, e a comparação abaixo roda sem esbarrar nele.
    const desativado = await app.inject({ method: "GET", url: `${rota.base}/${rota.desativado(cenario)}` });
    expect(desativado.statusCode).toBe(404);
    expect(desativado.body, "o link desativado se distingue do inexistente").toBe(corpoDoInexistente);

    const malformado = await app.inject({ method: "GET", url: `${rota.base}/x` });
    expect(malformado.statusCode).toBe(404);
    expect(malformado.body, "o segredo malformado se distingue do inexistente").toBe(corpoDoInexistente);

    // O 404 uniforme não carrega o segredo pedido nem o nome de nada.
    expect(corpoDoInexistente).not.toContain(rota.desativado(cenario));
    await app.close();
  });

  it("o mesmo IP passa do limite em memória e recebe 429 com Retry-After (força bruta)", async () => {
    const app = appDoCenario(cenario, 5);
    const statuses: number[] = [];
    let sexta: Awaited<ReturnType<typeof app.inject>> | undefined;
    for (let i = 0; i < 6; i += 1) {
      const resposta = await app.inject({ method: "GET", url: `${rota.base}/${segredoAleatorio()}` });
      statuses.push(resposta.statusCode);
      sexta = resposta;
    }
    expect(statuses.slice(0, 5), "as cinco primeiras cabem no limite").toEqual([404, 404, 404, 404, 404]);
    expect(statuses[5], "a sexta do mesmo IP").toBe(429);
    const retryAfter = Number(sexta?.headers["retry-after"]);
    expect(Number.isInteger(retryAfter) && retryAfter >= 1, `Retry-After: ${String(sexta?.headers["retry-after"])}`).toBe(true);
    await app.close();
  });

  it("estourado o limite, nem o segredo certo passa: o 429 vem antes de qualquer consulta ao segredo", async () => {
    const app = appDoCenario(cenario, 2);
    await app.inject({ method: "GET", url: `${rota.base}/${segredoAleatorio()}` });
    await app.inject({ method: "GET", url: `${rota.base}/${segredoAleatorio()}` });
    const certo = await app.inject({ method: "GET", url: `${rota.base}/${rota.ativo(cenario)}` });
    expect(certo.statusCode).toBe(429);
    await app.close();
  });
});
