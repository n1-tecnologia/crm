---
phase: 00-prepara-o
reviewed: 2026-09-17T03:48:59Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - apps/api/.env.example
  - apps/api/README.md
  - apps/api/exportacoes/CONTEXT.md
  - apps/api/exportacoes/MANIFESTO.json
  - apps/api/exportacoes/MANIFESTO.md
  - apps/api/package.json
  - apps/api/src/importacao/CONTEXT.md
  - apps/api/src/importacao/clickup/CONTEXT.md
  - apps/api/src/importacao/clickup/cliente.test.ts
  - apps/api/src/importacao/clickup/cliente.ts
  - apps/api/src/importacao/clickup/de-para-usuarios.test.ts
  - apps/api/src/importacao/clickup/de-para-usuarios.ts
  - apps/api/src/importacao/clickup/exportar.cli.ts
  - apps/api/src/importacao/clickup/exportar.integration.test.ts
  - apps/api/src/importacao/clickup/exportar.test.ts
  - apps/api/src/importacao/clickup/exportar.ts
  - apps/api/src/importacao/clickup/manifesto.test.ts
  - apps/api/src/importacao/clickup/manifesto.ts
  - apps/api/src/importacao/clickup/paginacao.test.ts
  - apps/api/src/importacao/clickup/paginacao.ts
  - docs/07-processos/solicitacao-de-pagamento.md
  - docs/08-migracao-financeiro/03-plano-de-migracao.md
findings:
  critical: 1
  warning: 9
  info: 8
  total: 18
status: issues_found
---

# Phase 00-prepara-o: Code Review Report

**Reviewed:** 2026-09-17T03:48:59Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the ClickUp export module (`cliente.ts`, `paginacao.ts`, `exportar.ts`, `exportar.cli.ts`, `manifesto.ts`, `de-para-usuarios.ts`), its tests, the generated `MANIFESTO.*`, the module docs and the two process/plan docs. `tsc --noEmit` is clean and all 47 tests in the module pass (the integration suite ran against the real API because a local token exists).

The explicit security goals of the phase mostly hold: the token never reaches `console.*`, `ErroClickUp` messages or the manifest; `apps/api/exportacoes/clickup/` is confirmed ignored by `git check-ignore`; only `CONTEXT.md` and `MANIFESTO.*` are tracked under `exportacoes/`; the 11,001-entry `MANIFESTO.json` was scanned programmatically and contains no e-mail/CPF/CNPJ/`nome`/`title`, is sorted, has no duplicate paths, and its `hashAgregado` recomputes correctly. `caminhoDoAnexo` validates ids by regex and re-checks the resolved path.

Key concerns:

1. **The manifest mislabels every attachment.** `CAMINHO_DE_ANEXO` truncates at the first `-`, but real ClickUp attachment ids are UUIDs (contain `-`). All 1,595 attachment entries in the committed manifest are labelled with only the first 8 hex characters of the id, not `<attachmentId>` as the contract documents. This breaks unambiguous verification by script and creates a (small) collision window that would silently produce duplicate `caminho` keys.
2. **Robustness of a 2-hour run.** A single failed attachment download aborts the whole export and, because the file never lands on disk, the resume hits the same failure forever. The `time_in_status` smoke test disables the feature on *any* error (network, 429 exhaustion), not only 4xx as documented.
3. **Defense gaps.** `hostPermitido` does not require `https:`; redirects are followed without re-validating the host; the 50 MiB cap is only enforced when the API reports `size`; `taskId`/`listId` are validated for attachment paths but not for `task/`, `comments/`, `time-in-status/` paths nor the URL.
4. **CLI footguns.** Any `--pasta`/`--amostra` run overwrites the versioned `MANIFESTO.*`; `--amostra` is not validated; unknown flags are silently ignored.

## Critical Issues

### CR-01: Manifest truncates every attachment id at the first `-` — contract `<listId>/attachments/<taskId>/<attachmentId>` is violated for all real attachments

**File:** `apps/api/src/importacao/clickup/manifesto.ts:257-281`
**Issue:** `CAMINHO_DE_ANEXO = /^(\d+)\/attachments\/([^/]+)\/([^/]+?)-.*$/` uses a lazy group followed by `-`, so it captures everything up to the *first* dash. `exportar.ts` names files `${attachmentId}-${sanitizado}` (line 192) and explicitly documents (lines 126-137) that real attachment ids are UUIDs such as `97df775c-b4ab-4bec-beac-dbcf74311b45.png`. Result: the committed `MANIFESTO.json` labels all 1,595 attachments with an 8-hex-char prefix (verified: every attachment entry's last segment is exactly 8 hex chars; e.g. `901107637383/attachments/868c0rjvb/82f4158a`). Consequences:
- The documented contract (`manifesto.ts:14`, `exportacoes/CONTEXT.md:34`) is false; a verification script cannot map an entry back to a file without a prefix search, and the "prova de paridade" is weaker than claimed.
- 235 tasks have 2+ attachments; two UUIDs sharing the first 8 hex chars in one task would emit two entries with the same `caminho`, and `hashAgregado` would still compute, hiding the collision.
- The tests never exercise an id containing `-`: `manifesto.test.ts:90` uses `att1-...`, and `exportar.test.ts` uses `att-1-nota.pdf` (which the manifest would label `att`). Test (b) in `exportar.test.ts` even asserts the UUID-with-dashes id is accepted, but nothing checks the manifest round-trip.
**Fix:** Use a separator that cannot appear in either the id (`[A-Za-z0-9._-]`) or the sanitized name (`[A-Za-z0-9._-]`), and anchor the manifest regex on it. Then re-run `--so-manifesto` after renaming existing files (or re-export):
```ts
// exportar.ts
export const SEPARADOR_DE_ANEXO = "~"; // fora de [A-Za-z0-9._-]
const alvo = path.resolve(pasta, `${attachmentId}${SEPARADOR_DE_ANEXO}${sanitizarNomeDeArquivo(titulo)}`);

// manifesto.ts
const CAMINHO_DE_ANEXO = /^(\d+)\/attachments\/([^/]+)\/([^/~]+)~[^/]*$/;
```
Add a test with a UUID id (`97df775c-b4ab-4bec-beac-dbcf74311b45.png`) asserting the manifest `caminho` ends with the full id. Alternatively use one directory per attachment (`attachments/<taskId>/<attId>/<nome>`) and take `path.dirname` in the manifest.

## Warnings

### WR-01: A single failed attachment download aborts the whole export and makes resume impossible

**File:** `apps/api/src/importacao/clickup/exportar.ts:652-653`
**Issue:** `baixarContado(anexo.url)` is not wrapped in `try/catch`. Any `ErroClickUp` (404 on an expired/deleted attachment, 403, 429 exhaustion) or a network `TypeError` propagates out of `exportarClickUp`, aborting a multi-hour run. Because no file is written, the resume path (`arquivoExisteComTamanho`) will retry the same URL and fail identically on every subsequent run, so the export can never reach `execucao.json`. Skipped attachments already have a well-defined outcome (`anexosPulados` + `avisos`); a failed download should follow the same path.
**Fix:**
```ts
try {
  const { bytes } = await baixarContado(anexo.url);
  await gravarAtomico(caminhoAnexo, bytes);
  anexosBaixados += 1; anexosBaixadosDaTarefa += 1;
} catch (erro) {
  const status = erro instanceof ErroClickUp ? erro.status : 0;
  anexosPulados += 1;
  avisos.push(`anexo ${anexo.id} da Tarefa ${taskId} pulado: download falhou (status ${status})`);
}
```
Consider rethrowing on 5xx/network errors if the intent is to stop on infrastructure failures, but never on 4xx.

### WR-02: `time_in_status` smoke test disables the feature on ANY error, not only 4xx as documented

**File:** `apps/api/src/importacao/clickup/exportar.ts:611-625`
**Issue:** The doc comment (lines 442-445) and `CONTEXT.md:31-32` say the first *4xx* disables the feature. The code catches every error (`ErroClickUp` 429 after exhausting retries, 5xx, `TypeError` from a dropped connection, even `gravarAtomico` ENOSPC) and, if it is the first attempt, sets `timeInStatusDisponivel = false` for the entire run. That value is persisted to `execucao.json` and surfaces in the manifest as "Indisponível", which would be wrong for a transient failure. Non-first errors are swallowed into a counter without any `avisos`/`log` line, so the operator cannot tell what failed.
**Fix:**
```ts
} catch (erro) {
  const status = erro instanceof ErroClickUp ? erro.status : 0;
  const eh4xx = status >= 400 && status < 500;
  if (primeiraTentativa && eh4xx) {
    timeInStatusDisponivel = false;
    avisos.push(`time_in_status indisponível (smoke test da lista ${listId}, status ${status}) — ...`);
  } else if (eh4xx) {
    timeInStatusIndisponivel += 1;
    log(`tarefa ${taskId} · time_in_status falhou (status ${status})`);
  } else {
    throw erro; // 429 esgotado, 5xx, rede, disco: não é "recurso indisponível"
  }
}
```

### WR-03: `hostPermitido` does not require `https:` — token would be sent in cleartext to an `http://*.clickup.com` URL

**File:** `apps/api/src/importacao/clickup/cliente.ts:67-75`
**Issue:** Only the hostname suffix is checked. `hostPermitido("http://t1.clickup-attachments.com/x")` returns `true`, and `baixar` then sends `Authorization: <token>` over plaintext HTTP. Attachment URLs come from API responses (treated as untrusted elsewhere in this module, T-0-06/T-0-07); an `http:` URL, whether from a misconfiguration or a tampered response, leaks the personal token on the wire.
**Fix:**
```ts
export function hostPermitido(url: string): boolean {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== "https:") return false;
  return HOSTS_PERMITIDOS.some((sufixo) => parsed.hostname.endsWith(sufixo));
}
```
Add a test: `expect(hostPermitido("http://t1.clickup-attachments.com/x")).toBe(false)`.

### WR-04: Redirects are followed without re-validating the host allowlist

**File:** `apps/api/src/importacao/clickup/cliente.ts:118,156`
**Issue:** `buscar(url, { headers })` uses the default `redirect: "follow"`. The allowlist is applied only to the initial URL; a 3xx from `*.clickup-attachments.com` to any other host is followed and its body is saved as the attachment. Node's undici strips `Authorization` on cross-origin redirects, so the token itself is protected by runtime behaviour the code does not control or assert, and the SSRF/content-origin guarantee documented for T-0-07 does not hold for redirected downloads.
**Fix:** Use `redirect: "manual"` (or `"error"`) in `requisitar` for `baixar`, and if a `Location` is returned, re-run `hostPermitido` on it before following:
```ts
const resposta = await buscar(url, { headers, redirect: "manual" });
if (resposta.status >= 300 && resposta.status < 400) {
  const destino = resposta.headers.get("location");
  if (destino === null || !hostPermitido(new URL(destino, url).href)) {
    throw new ErroClickUp(resposta.status, identificador, "redirecionamento para host fora da allowlist");
  }
  return requisitar(new URL(destino, url), identificador, headers);
}
```

### WR-05: 50 MiB attachment cap is only enforced when the API reports `size`; download buffers the whole body in memory

**File:** `apps/api/src/importacao/clickup/exportar.ts:641`, `apps/api/src/importacao/clickup/cliente.ts:161`
**Issue:** The cap check is `anexo.tamanho !== undefined && anexo.tamanho > TAMANHO_MAXIMO_DE_ANEXO`. When `size` is absent (or wrong) the download proceeds unbounded, and `baixar` does `new Uint8Array(await resposta.arrayBuffer())`, so an oversized body is fully loaded into memory before anything can react. T-0-08 is therefore bypassable by the very data source it defends against. Neither `Content-Length` nor the actual byte count is checked.
**Fix:** In `baixar`, accept an optional `maxBytes`, check `Content-Length` before reading, and stream with a running counter:
```ts
const declarado = Number(resposta.headers.get("content-length"));
if (Number.isFinite(declarado) && declarado > maxBytes) throw new ErroClickUp(413, url, "anexo acima do máximo");
const partes: Uint8Array[] = []; let total = 0;
for await (const pedaco of resposta.body as AsyncIterable<Uint8Array>) {
  total += pedaco.length;
  if (total > maxBytes) throw new ErroClickUp(413, url, "anexo acima do máximo");
  partes.push(pedaco);
}
```
In `exportar.ts` pass `TAMANHO_MAXIMO_DE_ANEXO` and treat the 413 as `pulado` (see WR-01).

### WR-06: `taskId` and `listId` are only validated for attachment paths — `task/`, `comments/`, `time-in-status/` paths and URLs accept API/CLI values verbatim; manifest silently drops non-numeric lists

**File:** `apps/api/src/importacao/clickup/exportar.ts:487,538-539,569-570,577,586,604,612`; `apps/api/src/importacao/clickup/manifesto.ts:90,258`
**Issue:** `taskId` comes from API JSON (`bruto.id`) and is inserted unvalidated into `path.join(pastaDaLista, "task", `${taskId}.json`)`, `comments/${taskId}`, `time-in-status/${taskId}.json` and into the request path `/task/${taskId}`. The module already treats the same value as untrusted in `caminhoDoAnexo` (T-0-06), so the defense is inconsistent: a `../` id would write outside `pastaDestino` and a `x/comment?..` id would alter the request path. `listId` from `--lista` is likewise unvalidated. Separately, `manifesto.ts` counts only list folders matching `/^\d+$/` and only de-names attachments under `(\d+)/attachments/...`; a non-numeric `--lista` value (as the unit tests use, `list-fake-1`) would be exported but omitted from `listas` in the manifest while its attachment files, *with original titles*, would be hashed under their full path — the PII-stripping regex would not apply.
**Fix:** Validate once at the boundary and fail loudly:
```ts
// exportar.ts
const ID_DE_LISTA_VALIDO = /^\d+$/;
for (const listId of listasAlvo) {
  if (!ID_DE_LISTA_VALIDO.test(listId)) throw new Error(`listId fora do formato esperado: ${listId}`);
  ...
}
// ao coletar ids de Tarefa
if (id !== undefined && ID_DE_CAMINHO_VALIDO.test(id)) idsAbertas.push(id);
else if (id !== undefined) avisos.push(`tarefa com id fora do formato esperado ignorada na lista ${listId}`);
```
And in `manifesto.ts`, match attachments with `([^/]+)` for the list segment (or reuse the same `ID_DE_LISTA_VALIDO`) so the de-naming cannot be skipped.

### WR-07: Any `--pasta`/`--amostra` run overwrites the versioned `MANIFESTO.json`/`MANIFESTO.md`

**File:** `apps/api/src/importacao/clickup/exportar.cli.ts:87-88,126-131`
**Issue:** `pastaDeSaidaDoManifesto` is hard-wired to `apps/api/exportacoes/` regardless of `--pasta`, `--amostra`, `--lista` or `--so-manifesto`. Running `npm run exportar:clickup -- --amostra=3` (the documented dry-run) replaces the committed parity proof with an `amostra: true` manifest of a partial export. Git makes it recoverable, but the tool's own documentation says the manifest "substitui o anterior no próximo commit" — an accidental `git add -A` commits the sample.
**Fix:** Write the manifest next to the export folder by default (`path.join(pastaDestino, "..")` only when `pastaDestino` is the default), or add `--manifesto-em=<dir>` and refuse to write to the default location when `--pasta`, `--amostra` or `--lista` were given:
```ts
const usaDefault = valorDe("pasta") === undefined && amostra === undefined && listas.length === 0;
const pastaDeSaidaDoManifesto = valorDe("manifesto-em") ?? (usaDefault ? PASTA_MANIFESTO_PADRAO : pastaDestino);
```

### WR-08: `--amostra` is not validated; unknown flags are silently ignored

**File:** `apps/api/src/importacao/clickup/exportar.cli.ts:111,121,50-63`
**Issue:** `Number(amostra)` accepts `--amostra=abc` (NaN), `--amostra=` (0) and `--amostra=-1`. `NaN`/`0` make `amostra: true` and `todosOsIds.slice(0, NaN|0)` detail zero tasks, so the run "succeeds" with empty per-task output; negative values slice from the end. Unknown or misspelled flags (`--sem-anexo`, `--amostra 3` with a space) are never reported, so a typo starts a 2-hour full export with attachments.
**Fix:**
```ts
const FLAGS_CONHECIDAS = new Set(["lista", "amostra", "sem-anexos", "sem-time-in-status", "pasta", "so-manifesto"]);
for (const arg of argv) {
  const nome = arg.replace(/^--/, "").split("=")[0]!;
  if (!arg.startsWith("--") || !FLAGS_CONHECIDAS.has(nome)) { console.error(`flag desconhecida: ${arg}`); process.exit(2); }
}
const limite = amostra === undefined ? undefined : Number.parseInt(amostra, 10);
if (limite !== undefined && (!Number.isInteger(limite) || limite <= 0)) { console.error("--amostra exige inteiro > 0"); process.exit(2); }
```

### WR-09: `paginasDeTarefas` has two different meanings in `exportar.ts` and `manifesto.ts`

**File:** `apps/api/src/importacao/clickup/exportar.ts:665`; `apps/api/src/importacao/clickup/manifesto.ts:236`
**Issue:** `exportarClickUp` reports `paginasDeTarefas = abertas + arquivadas` (unit test (a) asserts `2` for 1+1), while `contarRecursos` reports only `tasks/` (would report `1` for the same fixture) and ignores `tasks-arquivadas/`. The same typed field (`ContagensDaLista.paginasDeTarefas`) therefore disagrees between `execucao.json` and `MANIFESTO.json` for any list with archived tasks (list `901107637383` in the real run: 29 vs 30). Anyone cross-checking the two files will see a mismatch that looks like a tampered or incomplete export.
**Fix:** Pick one definition and apply it in both places — simplest is to count both folders in `contarRecursos`:
```ts
paginasDeTarefas: nomesDeTarefas.length + nomesDeArquivadas.length,
```
and document the field in `ContagensDaLista` as "páginas de Tarefas abertas + arquivadas".

## Info

### IN-01: `paginarPorCursor` cannot detect a cursor that does not advance

**File:** `apps/api/src/importacao/clickup/paginacao.ts:95-105`
**Issue:** If the API ignores `start`/`start_id` and returns the same full page, every item is deduplicated but the loop continues until `TETO_DE_PAGINAS` (1,000 requests, ~10 minutes at the rate limit, 1,000 `page-NNN.json` files written) and then throws, aborting the export; on resume the same 1,000 files are read and it throws again. Break early when `itens.length === 0` on a full page or when `proximoCursor` equals the previous cursor.
**Fix:** `if (itens.length === 0 || (cursor && cursor.start_id === proximoCursor.start_id)) { yield {...cursor: undefined}; return; }`

### IN-02: Inverted guard in `caminhoDoAnexo` lets `alvo === pasta` pass

**File:** `apps/api/src/importacao/clickup/exportar.ts:193`
**Issue:** `if (alvo !== pasta && !alvo.startsWith(pasta + path.sep)) throw` — when `alvo === pasta` (resolved to the directory itself) the condition is false and the directory path is returned as a file path. Unreachable with the current regex guards, but the intent is the opposite of what is written.
**Fix:** `if (!alvo.startsWith(pasta + path.sep)) throw ...` (a file must be strictly inside the folder).

### IN-03: `NaN` from a malformed `X-RateLimit-Reset` produces a zero-delay retry loop

**File:** `apps/api/src/importacao/clickup/cliente.ts:108-112`
**Issue:** `Number("garbage")` is `NaN`; `Math.max(1000, NaN)` is `NaN`; `setTimeout(resolve, NaN)` fires immediately, so 5 retries hammer the API back-to-back.
**Fix:** `const resetEm = Number.isFinite(Number(reset)) ? Number(reset) * 1000 : agora() + 60_000;`

### IN-04: Vacuous token-leak assertion and dead fixture in `exportar.test.ts`

**File:** `apps/api/src/importacao/clickup/exportar.test.ts:220-232,251,547-563,576`
**Issue:** Test (g) asserts `log`/`avisos` do not contain `TOKEN_DO_CLIENTE_FALSO`, but the fake client never uses that constant (`void TOKEN_DO_CLIENTE_FALSO`), so the assertion cannot fail regardless of `exportar.ts` behaviour. `detalheComAnexo` (line 547) is built and then discarded with `void`. Both are dead code that gives false confidence.
**Fix:** Have the fake client embed the token in an `ErroClickUp` message or in a header echoed through a failing path, or delete the assertion and the unused fixture.

### IN-05: Stale comments and docs contradict the actual export

**File:** `apps/api/src/importacao/clickup/exportar.cli.ts:19-22`; `apps/api/exportacoes/CONTEXT.md:14`; `apps/api/src/importacao/clickup/CONTEXT.md:67,75`; `apps/api/package.json:5`; `apps/api/src/importacao/clickup/de-para-usuarios.ts:11`
**Issue:** The CLI header says the Solicitação list has "~1.110 Tarefas" and drives the budget; the real manifest shows 19 tasks there and 2,859 in Contas a pagar. `exportacoes/CONTEXT.md` says the manifests "chegam no Plan 00-04" and `clickup/CONTEXT.md` says `de-para-usuarios.ts`/`usuarios.cli.ts` "chega no Plan 00-02" — all already exist. `package.json` still describes the API as "Esqueleto... camada HTTP ainda não foi escolhida" while Fastify is a dependency in use. `de-para-usuarios.ts` cites `bootstrap-gestao.ts linhas 113-116`, a line reference that will rot.
**Fix:** Update the CLI budget comment to the measured numbers (README already has them), drop the "chega no Plan" qualifiers, refresh the `package.json` description, and cite the symbol (`buildGestaoBootstrap` roles) instead of line numbers.

### IN-06: `.env.example` recommends reusing the production `automation/` token

**File:** `apps/api/.env.example` (CLICKUP_API_TOKEN comment block)
**Issue:** "É o mesmo token que o automation/ do financeiro-tria já usa na VPS" invites copying a production credential into a developer `.env`. T-0-11 already notes a personal token inherits every permission of its owner; sharing it between systems widens the blast radius and prevents independent rotation.
**Fix:** Recommend generating a dedicated token for the export and revoking it after PREP-02 closes; keep the format hint (`pk_...`) only.

### IN-07: `ErroClickUp` for `baixar` embeds the full attachment URL, including any signed query string

**File:** `apps/api/src/importacao/clickup/cliente.ts:153,159`
**Issue:** `caminho` for `baixar` is the full URL. Attachment URLs can carry pre-signed query parameters; if the error escapes to the CLI (see WR-01) the stack trace prints it. Not the API token, but still a bearer-like secret in logs.
**Fix:** Pass `new URL(url).pathname` (or just the attachment id) as `identificador`.

### IN-08: Dead `string` branch in `hashDoArquivo`

**File:** `apps/api/src/importacao/clickup/manifesto.ts:72-73`
**Issue:** `createReadStream(caminho)` without an encoding always emits `Buffer`; the `typeof pedaco === "string"` branch is unreachable.
**Fix:** Type the handler as `(pedaco: Buffer)` and drop the branch.

---

_Reviewed: 2026-09-17T03:48:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
