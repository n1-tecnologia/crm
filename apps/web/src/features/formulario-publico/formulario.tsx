"use client";

/**
 * O Client Component do Formulário público (Plan 02-20) — seções, campos
 * condicionais, validação, revisão e envio. Recebe SÓ o DTO sanitizado que
 * `f/[segredo]/page.tsx` já buscou no servidor; fala com o `apps/api`
 * diretamente por `transportePublico`, sem passar por Route Handler/BFF do
 * Next (a arquitetura já decidida) e sem o antigo `PublicoProvider`/
 * `buildProductSeed()` (D-02 — esse caminho deixou de existir aqui).
 *
 * O controle de upload de verdade (arrastar/soltar, progresso por arquivo) e
 * a tela de confirmação completa (copiar número, live region) são o Plan
 * 02-23: este componente reserva o ponto onde cada pergunta de arquivo
 * entra e considera `uploadEmAndamento` para travar o CTA, mas ainda não
 * envia bytes — só monta o envio de `answers`.
 */

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Paperclip } from "lucide-react";
import { transportePublico } from "@/dados/transporte-publico";
import type { FormularioPublicoDto, PerguntaPublica } from "@/dados/transporte-publico";
import { camposInvalidadosPor, camposVisiveis, type RespostasPorRotulo } from "./campos-condicionais";
import { Button, ConfirmDialog, Field, Icone, MultiSelect, Painel, RecordRow, Select, TextArea, TextInput } from "@/features/shell/ui";

const COPY_ERRO_GENERICO = "Não foi possível enviar a solicitação. Seus dados continuam aqui; tente novamente.";
const COPY_AJUDA_NAO_OBRIGATORIO = "Necessário para seguir à aprovação.";
const COPY_AGUARDE_UPLOAD = "Aguarde o envio dos arquivos ou remova os que falharam.";

/** `Integração manual` e `Equipe` não aparecem no Formulário público (UI-SPEC) — mesmo que o DTO um dia os inclua por engano. */
const EXCLUIDOS = new Set(["Integração manual", "Equipe"]);

/** "Ordem e agrupamento" do UI-SPEC — a apresentação canônica da Solicitação de pagamento. */
const SECOES: readonly { readonly titulo: string; readonly rotulos: readonly string[] }[] = [
  { titulo: "Sobre a solicitação", rotulos: ["O que deve ser pago?", "O que é e como será utilizado?"] },
  { titulo: "Solicitante", rotulos: ["Nome do solicitante", "WhatsApp"] },
  { titulo: "Classificação", rotulos: ["Centro de Custo", "BU", "Empresa", "Categoria de pagamento", "Produto"] },
  { titulo: "Fornecedor", rotulos: ["Fornecedor", "CPF", "CNPJ", "Nome do fornecedor"] },
  { titulo: "Documento e datas", rotulos: ["Anexo", "Data de Emissão", "Data Vencimento", "Valor"] },
  {
    titulo: "Pagamento",
    rotulos: ["Forma de pagamento", "Chave pix", "Código de barras", "Pix copia e cola", "Link de pagamento", "Boleto", "QR Code"],
  },
];

/** Os rótulos que `campos-condicionais.ts` decide — os únicos que podem sumir do DOM. */
const ROTULOS_CONDICIONAIS = new Set(["CPF", "CNPJ", "Chave pix", "Código de barras", "Boleto", "Pix copia e cola", "QR Code", "Link de pagamento"]);

/** Documento, anexo e dado de pagamento — quando não obrigatórios, a ajuda do UI-SPEC substitui a do DTO. */
const ROTULOS_DOCUMENTO_E_PAGAMENTO = new Set([...SECOES[4]!.rotulos, ...SECOES[5]!.rotulos]);

type TipoDeMascara = "cpf" | "cnpj" | "telefone";

/** CPF/CNPJ/WhatsApp compartilham `kind` com campos de texto comuns (`text`/`phone`) — só o rótulo os distingue. */
const MASCARA_POR_ROTULO: Readonly<Record<string, TipoDeMascara>> = {
  CPF: "cpf",
  CNPJ: "cnpj",
  WhatsApp: "telefone",
};

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
  const mascara = MASCARA_POR_ROTULO[pergunta.label];
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
  readonly afetados: readonly string[];
}

export function FormularioPublico({
  secret,
  formulario,
  uploadEmAndamento = false,
}: {
  readonly secret: string;
  readonly formulario: FormularioPublicoDto;
  /** Lido pelo Plan 02-23 — enquanto um anexo sobe, o CTA principal aguarda em vez de enviar cedo demais. */
  readonly uploadEmAndamento?: boolean;
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [trocaPendente, setTrocaPendente] = useState<TrocaPendente | null>(null);
  // A MESMA chave em todo o ciclo de vida deste formulário — um retry depois de erro reusa esta, nunca gera outra.
  const [submissionId] = useState(() => crypto.randomUUID());
  const resumoRef = useRef<HTMLDivElement>(null);
  const idDoResumo = useId();

  // O resumo de erros recebe foco depois de QUALQUER tentativa inválida —
  // tanto a validação local (campo obrigatório vazio) quanto uma recusa do
  // servidor (400/409/rede) passam por `setErroGeral`, então este é o único
  // lugar que precisa mover o foco (UI-SPEC: "recebe foco após tentativa inválida").
  useEffect(() => {
    if (erroGeral) resumoRef.current?.focus();
  }, [erroGeral]);

  const perguntas = useMemo(() => formulario.questions.filter((q) => !EXCLUIDOS.has(q.label.trim())), [formulario.questions]);

  const respostasPorRotulo: RespostasPorRotulo = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const p of perguntas) mapa[p.label] = respostas[p.id] ?? "";
    return mapa;
  }, [perguntas, respostas]);

  const visiveisAgora = useMemo(() => camposVisiveis(respostasPorRotulo), [respostasPorRotulo]);

  const perguntasRenderizadas = useMemo(
    () => perguntas.filter((p) => !ROTULOS_CONDICIONAIS.has(p.label) || visiveisAgora.has(p.label)),
    [perguntas, visiveisAgora],
  );

  const rotulosConhecidos = useMemo(() => new Set(SECOES.flatMap((s) => s.rotulos)), []);
  const outras = useMemo(() => perguntas.filter((p) => !rotulosConhecidos.has(p.label)), [perguntas, rotulosConhecidos]);

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
    const afetados = camposInvalidadosPor(pergunta.label, novoValor, respostasPorRotulo);
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
      for (const rotulo of afetados) {
        const alvo = perguntas.find((p) => p.label === rotulo);
        if (alvo) proximo[alvo.id] = "";
      }
      return proximo;
    });
    setTrocaPendente(null);
  }

  function ajudaDe(pergunta: PerguntaPublica): string | undefined {
    if (!pergunta.required && ROTULOS_DOCUMENTO_E_PAGAMENTO.has(pergunta.label)) return COPY_AJUDA_NAO_OBRIGATORIO;
    return pergunta.help;
  }

  async function aoSubmeter(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (enviando || uploadEmAndamento) return;

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

    const resultado = await transportePublico.enviarSubmissao({ secret, submissionId, answers });
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
    const mascara = MASCARA_POR_ROTULO[pergunta.label];

    if (pergunta.kind === "file") {
      return (
        <div className="grid gap-1">
          <Button icon={<Icone de={Paperclip} tamanho="sm" />} disabled disabledReason="Envio de arquivo chega no próximo plano (02-23).">
            Adicionar arquivos
          </Button>
        </div>
      );
    }
    if (pergunta.kind === "singleSelect" || pergunta.label === "Fornecedor" || pergunta.label === "Forma de pagamento") {
      const opcoes = (pergunta.options ?? []).map((o) => ({ value: o, label: o }));
      const gatilho = pergunta.label === "Fornecedor" || pergunta.label === "Forma de pagamento";
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
          onChange={(novo) => atualizarResposta(pergunta.id, novo)}
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
    return (
      <Painel solido role="status" className="grid gap-2 p-6">
        <Icone de={CheckCircle2} tamanho="lg" style={{ color: "var(--sucesso)" }} />
        <h2 className="ed-subtitulo">Solicitação enviada</h2>
        <p className="app-base" style={{ color: "var(--texto-2)" }}>
          Recebemos sua solicitação. Guarde o número abaixo para falar com o Financeiro.
        </p>
        <p className="app-sm mt-2" style={{ color: "var(--texto-3)" }}>
          Número da solicitação
        </p>
        <p className="identificador app-numero">{enviado}</p>
      </Painel>
    );
  }

  return (
    <>
      <header className="grid gap-1">
        <p className="ed-eyebrow">CRM N1</p>
        <h1 className="ed-titulo">Solicitação de pagamento</h1>
        <p className="app-base" style={{ color: "var(--texto-3)" }}>
          Preencha os dados do pagamento. O Financeiro acompanhará a solicitação por este número.
        </p>
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

          {SECOES.map((secao) => {
            const perguntasDaSecao = perguntas.filter((p) => secao.rotulos.includes(p.label));
            if (perguntasDaSecao.length === 0) return null;
            return (
              <fieldset key={secao.titulo} className="grid gap-3">
                <legend className="rotulo">{secao.titulo}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {perguntasDaSecao.map((pergunta) => {
                    if (ROTULOS_CONDICIONAIS.has(pergunta.label) && !visiveisAgora.has(pergunta.label)) return null;
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

          {outras.length > 0 ? (
            <fieldset className="grid gap-3">
              <legend className="rotulo">Outras perguntas</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {outras.map((pergunta) => (
                  <div id={ancoraDoCampo(pergunta.id)} key={pergunta.id}>
                    <Field label={pergunta.label} required={pergunta.required} hint={ajudaDe(pergunta)} error={erros[pergunta.id]}>
                      {(id) => renderControle(pergunta, id)}
                    </Field>
                  </div>
                ))}
              </div>
            </fieldset>
          ) : null}

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
              disabled={enviando || uploadEmAndamento}
              disabledReason={enviando ? "Enviando…" : COPY_AGUARDE_UPLOAD}
            >
              {enviando ? "Enviando solicitação…" : "Enviar solicitação"}
            </Button>
          </span>
        </form>
      </Painel>

      <ConfirmDialog
        open={trocaPendente !== null}
        title="Trocar forma de pagamento?"
        description={trocaPendente ? `Trocar a forma de pagamento remove os dados preenchidos em ${trocaPendente.afetados.join(", ")}.` : ""}
        confirmLabel="Trocar e limpar dados"
        cancelLabel="Manter forma atual"
        destructive
        onConfirm={confirmarTroca}
        onCancel={() => setTrocaPendente(null)}
      />
    </>
  );
}
