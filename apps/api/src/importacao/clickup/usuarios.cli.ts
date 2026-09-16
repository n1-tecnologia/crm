/**
 * `npm run clickup:usuarios -w @n1/api -- <id> [<id>...]` — resolve ClickUp
 * user id → username + e-mail direto na API real. Os 6 e-mails de identidade
 * que `de-para-usuarios.ts` (Plan 00-02 Task 2) precisa não estão em nenhum
 * arquivo legível deste repositório nem do `financeiro-tria` (RESEARCH.md
 * Open Question 1) — só a própria API do ClickUp sabe (D-09/D-11).
 *
 * Sem argumentos, resolve os 6 ids conhecidos de CON-11. Para cada id,
 * tenta nesta ordem, parando assim que TODOS estiverem resolvidos:
 *
 *   1. GET /team                 → teams[].members[].user (Workspace inteiro)
 *   2. GET /list/{listId}/member → members[] das 3 Listas do Financeiro
 *   3. GET /list/{listId}/task   → creator/assignees[]/watchers[] da 1ª
 *                                   página de Tarefas da Solicitação
 *
 * Nunca imprime o token nem o corpo de nenhuma resposta — só
 * `<id>  <username>  <email>  (<fonte>)` ou `<id>  não encontrado`.
 */

import { carregarEnv } from "../../persistencia/conexao";
import { criarClienteClickUp, type ClienteClickUp } from "./cliente";

const IDS_PADRAO = ["81591229", "81581798", "81581826", "81582295", "81581816", "81581802"] as const;

/** Solicitação, Contas a pagar, Contas a receber — as 3 Listas do Financeiro. */
const LISTAS = ["901109104938", "901107637383", "901107648977"] as const;
const LISTA_SOLICITACAO = "901109104938";

type Fonte = "team" | "list-member" | "task";

interface UsuarioResolvido {
  readonly username: string;
  readonly email: string;
  readonly fonte: Fonte;
}

interface UsuarioClickUp {
  readonly id?: number | string;
  readonly username?: string;
  readonly email?: string;
}

interface UsuarioNormalizado {
  readonly id: string;
  readonly username: string;
  readonly email?: string;
}

function normalizar(usuario: UsuarioClickUp | undefined): UsuarioNormalizado | undefined {
  if (!usuario || usuario.id === undefined) return undefined;
  return {
    id: String(usuario.id),
    username: usuario.username ?? "(sem username)",
    email: usuario.email ? usuario.email.toLowerCase() : undefined,
  };
}

function registrar(
  resolvidos: Map<string, UsuarioResolvido>,
  pendentes: Set<string>,
  usuario: UsuarioNormalizado | undefined,
  fonte: Fonte,
): void {
  if (!usuario || !usuario.email) return;
  if (!pendentes.has(usuario.id)) return;
  resolvidos.set(usuario.id, { username: usuario.username, email: usuario.email, fonte });
  pendentes.delete(usuario.id);
}

async function resolverPorTeam(
  cliente: ClienteClickUp,
  resolvidos: Map<string, UsuarioResolvido>,
  pendentes: Set<string>,
): Promise<void> {
  const { json } = await cliente.get("/team");
  const teams = (json as { readonly teams?: readonly { readonly members?: readonly { readonly user?: UsuarioClickUp }[] }[] }).teams ?? [];
  for (const time of teams) {
    for (const membro of time.members ?? []) {
      registrar(resolvidos, pendentes, normalizar(membro.user), "team");
    }
  }
}

async function resolverPorListMember(
  cliente: ClienteClickUp,
  resolvidos: Map<string, UsuarioResolvido>,
  pendentes: Set<string>,
): Promise<void> {
  for (const listaId of LISTAS) {
    if (pendentes.size === 0) return;
    const { json } = await cliente.get(`/list/${listaId}/member`);
    const membros = (json as { readonly members?: readonly UsuarioClickUp[] }).members ?? [];
    for (const membro of membros) {
      registrar(resolvidos, pendentes, normalizar(membro), "list-member");
    }
  }
}

async function resolverPorTarefas(
  cliente: ClienteClickUp,
  resolvidos: Map<string, UsuarioResolvido>,
  pendentes: Set<string>,
): Promise<void> {
  if (pendentes.size === 0) return;
  const { json } = await cliente.get(`/list/${LISTA_SOLICITACAO}/task`, { page: "0", include_closed: "true" });
  const tarefas =
    (
      json as {
        readonly tasks?: readonly {
          readonly creator?: UsuarioClickUp;
          readonly assignees?: readonly UsuarioClickUp[];
          readonly watchers?: readonly UsuarioClickUp[];
        }[];
      }
    ).tasks ?? [];
  for (const tarefa of tarefas) {
    registrar(resolvidos, pendentes, normalizar(tarefa.creator), "task");
    for (const assignee of tarefa.assignees ?? []) registrar(resolvidos, pendentes, normalizar(assignee), "task");
    for (const watcher of tarefa.watchers ?? []) registrar(resolvidos, pendentes, normalizar(watcher), "task");
  }
}

async function resolverUsuarios(cliente: ClienteClickUp, ids: readonly string[]): Promise<Map<string, UsuarioResolvido>> {
  const resolvidos = new Map<string, UsuarioResolvido>();
  const pendentes = new Set(ids);

  await resolverPorTeam(cliente, resolvidos, pendentes);
  if (pendentes.size > 0) await resolverPorListMember(cliente, resolvidos, pendentes);
  if (pendentes.size > 0) await resolverPorTarefas(cliente, resolvidos, pendentes);

  return resolvidos;
}

carregarEnv();
const token = process.env.CLICKUP_API_TOKEN;
if (!token) {
  console.error("CLICKUP_API_TOKEN ausente em apps/api/.env — ver apps/api/.env.example");
  process.exit(1);
}

const argIds = process.argv.slice(2);
const ids = argIds.length > 0 ? argIds : [...IDS_PADRAO];

const cliente = criarClienteClickUp({ token });
const resolvidos = await resolverUsuarios(cliente, ids);

let porTeam = 0;
let porListMember = 0;
let porTask = 0;
for (const id of ids) {
  const achado = resolvidos.get(id);
  if (!achado) {
    console.log(`${id}  não encontrado`);
    continue;
  }
  if (achado.fonte === "team") porTeam += 1;
  else if (achado.fonte === "list-member") porListMember += 1;
  else porTask += 1;
  console.log(`${id}  ${achado.username}  ${achado.email}  (${achado.fonte})`);
}
console.log(`\n${resolvidos.size}/${ids.length} resolvidos: ${porTeam} por team, ${porListMember} por list-member, ${porTask} por task`);
