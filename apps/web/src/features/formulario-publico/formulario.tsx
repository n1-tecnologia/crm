"use client";

/**
 * O Client Component do Formulário público (Plan 02-20) — seções, campos
 * condicionais, validação, revisão e envio. Recebe SÓ o DTO sanitizado que
 * `f/[segredo]/page.tsx` já buscou no servidor; fala com o `apps/api`
 * diretamente por `transportePublico`, sem passar por Route Handler/BFF do
 * Next (a arquitetura já decidida) e sem o antigo `PublicoProvider`/
 * `buildProductSeed()` (D-02 — esse caminho deixou de existir aqui).
 *
 * O controle de upload (Plan 02-23, `./upload-de-arquivos.tsx`) sobe bytes
 * direto ao bucket privado; este componente só COORDENA a sessão de upload
 * compartilhada entre as perguntas de arquivo (`executarPedidoDeTicket`) e
 * agrega o estado delas para travar o CTA e montar `attachments`. A
 * confirmação (`./confirmacao.tsx`) é o recibo público — só o número.
 */

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { transportePublico } from "@/dados/transporte-publico";
import type { FormularioPublicoDto, PerguntaPublica, ResultadoDeTicket } from "@/dados/transporte-publico";
import { ehGatilho, invalidadasPor, perguntasVisiveis, secoesDoFormulario } from "./campos-condicionais";
import { Confirmacao } from "./confirmacao";
import { COPY_AGUARDE_UPLOAD, UploadDeArquivos, type ArquivoDeUpload } from "./upload-de-arquivos";
import { Button, ConfirmDialog, Field, MultiSelect, Painel, RecordRow, Select, TextArea, TextInput } from "@/features/shell/ui";

const COPY_ERRO_GENERICO = "Não foi possível enviar a solicitação. Seus dados continuam aqui; tente novamente.";

/** A máscara de apresentação — vem do Campo, pelo DTO (`mask`), nunca do rótulo (checklist 1.3). */
type TipoDeMascara = NonNullable<PerguntaPublica["mask"]>;

function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

function mascararCpf(digitos: string): string {
  const d = digitos.slice(0, 11);
  const partes = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  const fim = d.slice(9, 11);
  return partes.join(".") + (fim ? `-${fim}` : "");
}

function mascararCnpj(digitos: string): string {
  const d = digitos.slice(0, 14);
  const partes = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8)].filter(Boolean);
  const barra = d.slice(8, 12);
  const fim = d.slice(12, 14);
  return partes.join(".") + (barra ? `/${barra}` : "") + (fim ? `-${fim}` : "");
}

function mascararTelefone(digitos: string): string {
  const d = digitos.slice(0, 11);
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (!ddd) return "";
  if (!resto) return `(${ddd}`;
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const primeiraParte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, primeiraParte)}-${resto.slice(primeiraParte)}`;
}

function mascararData(digitos: string): string {
  const d = digitos.slice(0, 8);
  const dd = d.slice(0, 2);
  const mm = d.slice(2, 4);
  const aaaa = d.slice(4, 8);
  return dd + (mm ? `/${mm}` : "") + (aaaa ? `/${aaaa}` : "");
}

function dataParaIso(digitos: string): string | undefined {
  if (digitos.length !== 8) return undefined;
  return `${digitos.slice(4, 8)}-${digitos.slice(2, 4)}-${digitos.slice(0, 2)}`;
}

/** `centavos/100`, sempre formatado — nunca o float cru na tela (UI-SPEC, "Obrigatoriedade e validação"). */
function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * O valor CANÔNICO que vai no corpo de `enviarSubmissao` — nunca o texto
 * mascarado. `setTaskFieldValue` (`@n1/dominio/operations/tasks.ts`) lê um
 * Campo `currency` como reais decimais (`Number(texto.replace(",","."))`),
 * não como centavos inteiros: mandar `"123456"` gravaria R$123.456,00 no
 * lugar de R$1.234,56. Por isso a máscara de moeda guarda centavos POR
 * DENTRO (para digitar sem erro de ponto flutuante) mas converte para reais
 * decimais só na hora de montar o envio.
 */
function valorCanonico(pergunta: PerguntaPublica, bruto: string): string {
  if (pergunta.kind === "currency") return (Number(bruto || "0") / 100).toFixed(2);
  if (pergunta.kind === "date") return dataParaIso(bruto) ?? bruto;
  return bruto;
}

function valorExibido(pergunta: PerguntaPublica, bruto: string): string {
  const mascara: TipoDeMascara | undefined = pergunta.mask;
  if (mascara === "cpf") return mascararCpf(bruto);
  if (mascara === "cnpj") return mascararCnpj(bruto);
  if (mascara === "telefone") return mascararTelefone(bruto);
  if (pergunta.kind === "date") return mascararData(bruto);
  if (pergunta.kind === "currency") return bruto === "" ? "" : formatarMoeda(Number(bruto || "0"));
  return bruto;
}

function ancoraDoCampo(id: string): string {
  return `campo-${id}`;
}

interface TrocaPendente {
  readonly pergunta: PerguntaPublica;
  readonly novoValor: string;
  readonly afetados: readonly PerguntaPublica[];
}

export function FormularioPublico({
  secret,
  formulario,
}: {
  readonly secret: string;
  readonly formulario: FormularioPublicoDto;
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [trocaPendente, setTrocaPendente] = useState<TrocaPendente | null>(null);
  const [uploadsPorPergunta, setUploadsPorPergunta] = useState<Record<string, readonly ArquivoDeUpload[]>>({});
  // A MESMA chave local em todo o ciclo de vida deste formulário — um retry depois de erro reusa esta,
  // nunca gera outra. Só é o valor FINAL de `submissionId` se nenhuma pergunta de arquivo jamais pediu
  // ticket; assim que a primeira sessão de upload nasce no servidor, `submissionIdDoServidorRef` assume.
  const [submissionIdLocal, setSubmissionIdLocal] = useState(() => crypto.randomUUID());
  const submissionIdDoServidorRef = useRef<string | undefined>(undefined);
  // Serializa os pedidos de ticket entre perguntas de arquivo diferentes (`Anexo` + `Boleto`/`QR Code`
  // podem estar visíveis ao mesmo tempo): sem isso, duas escolhas de arquivo quase simultâneas
  // poderiam cada uma pedir um ticket SEM `submissionId` e abrir DUAS sessões para o mesmo envio.
  const filaDeTicketsRef = useRef<Promise<unknown>>(Promise.resolve());
  const resumoRef = useRef<HTMLDivElement>(null);
  const idDoResumo = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Marcado por `reiniciar()` — o foco só vai para o heading do formulário depois de um "Enviar
  // outra solicitação", nunca na primeira renderização (quando `enviado` também começa `null`).
  const reiniciarPendenteRef = useRef(false);

  // O resumo de erros recebe foco depois de QUALQUER tentativa inválida —
  // tanto a validação local (campo obrigatório vazio) quanto uma recusa do
  // servidor (400/409/rede) passam por `setErroGeral`, então este é o único
  // lugar que precisa mover o foco (UI-SPEC: "recebe foco após tentativa inválida").
  useEffect(() => {
    if (erroGeral) resumoRef.current?.focus();
  }, [erroGeral]);

  // "Enviar outra solicitação" devolve o foco ao heading do FORMULÁRIO (não ao da confirmação) —
  // só depois que `enviado` volta a `null` o heading volta a existir na árvore.
  useEffect(() => {
    if (!enviado && reiniciarPendenteRef.current) {
      reiniciarPendenteRef.current = false;
      headingRef.current?.focus();
    }
  }, [enviado]);

  // Checklist 1.2/1.3 — a ordem, as seções e as condições são do Formulário (o DTO), não desta página.
  const perguntas = formulario.questions;
  const secoes = useMemo(() => secoesDoFormulario(perguntas), [perguntas]);
  const visiveisAgora = useMemo(() => perguntasVisiveis(perguntas, respostas), [perguntas, respostas]);
  const perguntasRenderizadas = useMemo(() => perguntas.filter((p) => visiveisAgora.has(p.id)), [perguntas, visiveisAgora]);

  // Só contam os arquivos das perguntas à mostra: o de uma pergunta escondida não vai no envio.
  const uploadsVisiveis = useMemo(
    () => Object.entries(uploadsPorPergunta).filter(([perguntaId]) => visiveisAgora.has(perguntaId)),
    [uploadsPorPergunta, visiveisAgora],
  );
  const totalDeArquivosNoEnvio = useMemo(() => uploadsVisiveis.reduce((soma, [, lista]) => soma + lista.length, 0), [uploadsVisiveis]);
  // Bloqueia o CTA enquanto QUALQUER arquivo não estiver "enviado" — inclusive "aguardando" (na
  // fila) e "falhou" (precisa ser removido ou reenviado com sucesso primeiro).
  const algumUploadPendente = useMemo(() => uploadsVisiveis.some(([, lista]) => lista.some((a) => a.status !== "enviado")), [uploadsVisiveis]);
  const attachmentsDoEnvio = useMemo(
    () =>
      uploadsVisiveis.flatMap(([perguntaId, lista]) =>
        lista.filter((a) => a.status === "enviado" && a.objectId).map((a) => ({ questionId: perguntaId, objectId: a.objectId! })),
      ),
    [uploadsVisiveis],
  );

  function executarPedidoDeTicket(
    tarefa: (submissionIdAtual: string | undefined) => Promise<ResultadoDeTicket>,
  ): Promise<ResultadoDeTicket> {
    const execucao = filaDeTicketsRef.current.then(() => tarefa(submissionIdDoServidorRef.current));
    filaDeTicketsRef.current = execucao.then(
      (resultado) => {
        if (resultado.tipo === "ok") submissionIdDoServidorRef.current = resultado.submissionId;
      },
      () => undefined,
    );
    return execucao;
  }

  function adicionarArquivosDaPergunta(perguntaId: string, novos: readonly ArquivoDeUpload[]): void {
    setUploadsPorPergunta((atual) => ({ ...atual, [perguntaId]: [...(atual[perguntaId] ?? []), ...novos] }));
  }

  function atualizarArquivoDaPergunta(perguntaId: string, clientId: string, parcial: Partial<ArquivoDeUpload>): void {
    setUploadsPorPergunta((atual) => {
      const lista = atual[perguntaId] ?? [];
      if (!lista.some((a) => a.clientId === clientId)) return atual;
      return { ...atual, [perguntaId]: lista.map((a) => (a.clientId === clientId ? { ...a, ...parcial } : a)) };
    });
  }

  function removerArquivoDaPergunta(perguntaId: string, clientId: string): void {
    setUploadsPorPergunta((atual) => ({ ...atual, [perguntaId]: (atual[perguntaId] ?? []).filter((a) => a.clientId !== clientId) }));
  }

  /** `Enviar outra solicitação` (UI-SPEC): nova sessão de submissão, respostas limpas, foco no heading. */
  function reiniciar(): void {
    reiniciarPendenteRef.current = true;
    setRespostas({});
    setErros({});
    setErroGeral(null);
    setUploadsPorPergunta({});
    submissionIdDoServidorRef.current = undefined;
    setSubmissionIdLocal(crypto.randomUUID());
    setEnviado(null);
  }

  function atualizarResposta(id: string, valor: string): void {
    setRespostas((atual) => ({ ...atual, [id]: valor }));
    setErros((atual) => {
      if (!(id in atual)) return atual;
      const proximo = { ...atual };
      delete proximo[id];
      return proximo;
    });
  }

  function aoTrocarGatilho(pergunta: PerguntaPublica, novoValor: string): void {
    const comArquivos = new Set(Object.entries(uploadsPorPergunta).filter(([, lista]) => lista.length > 0).map(([id]) => id));
    const afetados = invalidadasPor(perguntas, pergunta.id, novoValor, respostas, comArquivos);
    if (afetados.length > 0) {
      setTrocaPendente({ pergunta, novoValor, afetados });
      return;
    }
    atualizarResposta(pergunta.id, novoValor);
  }

  function confirmarTroca(): void {
    if (!trocaPendente) return;
    const { pergunta, novoValor, afetados } = trocaPendente;
    setRespostas((atual) => {
      const proximo = { ...atual, [pergunta.id]: novoValor };
      for (const alvo of afetados) proximo[alvo.id] = "";
      return proximo;
    });
    // "Trocar e limpar dados" limpa também os arquivos das perguntas que somem.
    setUploadsPorPergunta((atual) => {
      const proximo = { ...atual };
      for (const alvo of afetados) delete proximo[alvo.id];
      return proximo;
    });
    setTrocaPendente(null);
  }

  function ajudaDe(pergunta: PerguntaPublica): string | undefined {
    // O upload desenha sua própria ajuda de formato (`UploadDeArquivos`) — não duplicar aqui.
    if (pergunta.kind === "file") return undefined;
    // A ajuda é dado do Formulário (a da pergunta, ou a descrição do Campo) — checklist 1.2.
    return pergunta.help;
  }

  async function aoSubmeter(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (enviando || algumUploadPendente) return;

    const invalidos = perguntasRenderizadas.filter((p) => p.required && p.kind !== "file" && !(respostas[p.id] ?? "").trim());
    if (invalidos.length > 0) {
      const novosErros: Record<string, string> = {};
      for (const p of invalidos) novosErros[p.id] = `Responda “${p.label}”.`;
      setErros(novosErros);
      setErroGeral(invalidos.length === 1 ? "Responda o campo obrigatório antes de enviar." : `Responda os ${invalidos.length} campos obrigatórios antes de enviar.`);
      return;
    }

    setErros({});
    setErroGeral(null);
    setEnviando(true);

    const answers: Record<string, string> = {};
    for (const p of perguntasRenderizadas) {
      if (p.kind === "file") continue;
      const bruto = respostas[p.id];
      if (bruto === undefined || bruto.trim() === "") continue;
      answers[p.id] = valorCanonico(p, bruto);
    }

    const submissionId = submissionIdDoServidorRef.current ?? submissionIdLocal;
    const resultado = await transportePublico.enviarSubmissao({
      secret,
      submissionId,
      answers,
      ...(attachmentsDoEnvio.length > 0 ? { attachments: attachmentsDoEnvio } : {}),
    });
    setEnviando(false);

    if (resultado.tipo === "ok") {
      setEnviado(resultado.readableId);
      return;
    }
    if (resultado.tipo === "recusado") {
      if (resultado.field) setErros({ [resultado.field]: resultado.erro });
      setErroGeral(resultado.erro);
    } else if (resultado.tipo === "conflito") {
      setErroGeral(resultado.erro);
    } else {
      setErroGeral(COPY_ERRO_GENERICO);
    }
  }

  function renderControle(pergunta: PerguntaPublica, id: string): ReactNode {
    const bruto = respostas[pergunta.id] ?? "";
    const mascara = pergunta.mask;
    const gatilho = ehGatilho(perguntas, pergunta.id);

    if (pergunta.kind === "file") {
      return (
        <UploadDeArquivos
          id={id}
          papel={pergunta.label}
          accept={pergunta.accept}
          secret={secret}
          arquivos={uploadsPorPergunta[pergunta.id] ?? []}
          totalArquivosNoEnvio={totalDeArquivosNoEnvio}
          executarPedidoDeTicket={executarPedidoDeTicket}
          aoAdicionarArquivos={(novos) => adicionarArquivosDaPergunta(pergunta.id, novos)}
          aoAtualizarArquivo={(clientId, parcial) => atualizarArquivoDaPergunta(pergunta.id, clientId, parcial)}
          aoRemoverArquivo={(clientId) => removerArquivoDaPergunta(pergunta.id, clientId)}
        />
      );
    }
    if (pergunta.kind === "singleSelect") {
      const opcoes = (pergunta.options ?? []).map((o) => ({ value: o, label: o }));
      return (
        <Select
          id={id}
          required={pergunta.required}
          value={bruto}
          options={opcoes}
          onChange={(novo) => (gatilho ? aoTrocarGatilho(pergunta, novo) : atualizarResposta(pergunta.id, novo))}
        />
      );
    }
    if (pergunta.kind === "multiSelect") {
      const valores = bruto ? bruto.split(",").map((s) => s.trim()).filter(Boolean) : [];
      return (
        <MultiSelect
          id={id}
          required={pergunta.required}
          values={valores}
          options={(pergunta.options ?? []).map((o) => ({ value: o, label: o }))}
          onChange={(vals) => atualizarResposta(pergunta.id, vals.join(","))}
        />
      );
    }
    if (pergunta.kind === "checkbox") {
      return (
        <Select
          id={id}
          required={pergunta.required}
          value={bruto}
          options={[
            { value: "sim", label: "Sim" },
            { value: "não", label: "Não" },
          ]}
          onChange={(novo) => (gatilho ? aoTrocarGatilho(pergunta, novo) : atualizarResposta(pergunta.id, novo))}
        />
      );
    }
    if (pergunta.kind === "longText") {
      return <TextArea id={id} required={pergunta.required} value={bruto} onChange={(v) => atualizarResposta(pergunta.id, v)} rows={4} />;
    }
    if (mascara === "cpf") {
      return <TextInput id={id} required={pergunta.required} value={mascararCpf(bruto)} onChange={(v) => atualizarResposta(pergunta.id, apenasDigitos(v))} />;
    }
    if (mascara === "cnpj") {
      return <TextInput id={id} required={pergunta.required} value={mascararCnpj(bruto)} onChange={(v) => atualizarResposta(pergunta.id, apenasDigitos(v))} />;
    }
    if (mascara === "telefone") {
      return <TextInput id={id} required={pergunta.required} value={mascararTelefone(bruto)} onChange={(v) => atualizarResposta(pergunta.id, apenasDigitos(v))} />;
    }
    if (pergunta.kind === "date") {
      return (
        <TextInput id={id} required={pergunta.required} value={mascararData(bruto)} placeholder="dd/mm/aaaa" onChange={(v) => atualizarResposta(pergunta.id, apenasDigitos(v))} />
      );
    }
    if (pergunta.kind === "currency") {
      return (
        <TextInput
          id={id}
          required={pergunta.required}
          value={bruto === "" ? "" : formatarMoeda(Number(bruto || "0"))}
          placeholder="R$ 0,00"
          onChange={(v) => atualizarResposta(pergunta.id, apenasDigitos(v))}
        />
      );
    }
    if (pergunta.kind === "email") {
      return <TextInput id={id} required={pergunta.required} type="email" value={bruto} onChange={(v) => atualizarResposta(pergunta.id, v)} />;
    }
    return <TextInput id={id} required={pergunta.required} value={bruto} onChange={(v) => atualizarResposta(pergunta.id, v)} />;
  }

  if (enviado) {
    return <Confirmacao numero={enviado} aoEnviarOutra={reiniciar} />;
  }

  return (
    <>
      <header className="grid gap-1">
        <p className="ed-eyebrow">CRM N1</p>
        {/* Checklist 1.4 — o título e a introdução são o nome e a descrição do Formulário. */}
        <h1 ref={headingRef} tabIndex={-1} className="ed-titulo">
          {formulario.title}
        </h1>
        {formulario.intro ? (
          <p className="app-base" style={{ color: "var(--texto-3)" }}>
            {formulario.intro}
          </p>
        ) : null}
      </header>
      <Painel solido className="p-6">
        <form className="grid gap-6" onSubmit={(event) => void aoSubmeter(event)} noValidate>
          {erroGeral ? (
            <div
              ref={resumoRef}
              id={idDoResumo}
              role="alert"
              aria-label="Resumo de erros"
              tabIndex={-1}
              className="app-base rounded-[var(--r-controle)] px-3 py-2"
              style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}
            >
              <p>{erroGeral}</p>
              {Object.keys(erros).length > 0 ? (
                <ul className="mt-2 grid gap-1">
                  {Object.entries(erros).map(([id, mensagem]) => {
                    const pergunta = perguntas.find((p) => p.id === id);
                    return (
                      <li key={id}>
                        <a href={`#${ancoraDoCampo(id)}`} className="underline">
                          {pergunta?.label ?? mensagem}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}

          {secoes.map((secao, indice) => {
            const aMostra = secao.perguntas.filter((p) => visiveisAgora.has(p.id));
            if (aMostra.length === 0) return null;
            return (
              <fieldset key={`${secao.titulo ?? "sem-secao"}-${indice}`} className="grid gap-3">
                {secao.titulo ? <legend className="rotulo">{secao.titulo}</legend> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {aMostra.map((pergunta) => {
                    const larga = pergunta.kind === "longText" || pergunta.kind === "file";
                    return (
                      <div id={ancoraDoCampo(pergunta.id)} key={pergunta.id} className={larga ? "sm:col-span-2" : undefined}>
                        <Field label={pergunta.label} required={pergunta.required} hint={ajudaDe(pergunta)} error={erros[pergunta.id]}>
                          {(id) => renderControle(pergunta, id)}
                        </Field>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <fieldset className="grid gap-2 rounded-[var(--r-controle)] p-3" style={{ border: "1px solid var(--linha)" }}>
            <legend className="rotulo px-1">Revisão</legend>
            <dl className="grid gap-1">
              {perguntasRenderizadas
                .filter((p) => p.kind !== "file" && (respostas[p.id] ?? "").trim() !== "")
                .map((p) => (
                  <RecordRow key={p.id} label={p.label}>
                    {valorExibido(p, respostas[p.id] ?? "")}
                  </RecordRow>
                ))}
            </dl>
          </fieldset>

          <span className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={enviando || algumUploadPendente}
              disabledReason={enviando ? "Enviando…" : COPY_AGUARDE_UPLOAD}
            >
              {enviando ? "Enviando solicitação…" : "Enviar solicitação"}
            </Button>
          </span>
        </form>
      </Painel>

      <ConfirmDialog
        open={trocaPendente !== null}
        title={trocaPendente ? `Trocar ${trocaPendente.pergunta.label.toLocaleLowerCase("pt-BR")}?` : ""}
        description={
          trocaPendente
            ? `Trocar ${trocaPendente.pergunta.label.toLocaleLowerCase("pt-BR")} remove os dados preenchidos em ${trocaPendente.afetados.map((p) => p.label).join(", ")}.`
            : ""
        }
        confirmLabel="Trocar e limpar dados"
        cancelLabel="Manter a escolha atual"
        destructive
        onConfirm={confirmarTroca}
        onCancel={() => setTrocaPendente(null)}
      />
    </>
  );
}
