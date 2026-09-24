"use client";

/**
 * UI-SPEC §"5 · Extratos do Marcos" (D4-13) — o único formulário das oito
 * telas: uma Origem, um arquivo por vez, barra de progresso via
 * `XMLHttpRequest.upload.onprogress` (o único lugar da fase em que o acento
 * pinta área). Sobe por `POST /financeiro/extratos/:origem` no `apps/api`,
 * nunca pelo `automation/` direto (D4-01) — a URL usa `NEXT_PUBLIC_API_URL`,
 * o único backend que `apps/web` conhece; o Bearer sai da sessão do
 * navegador (`clienteDoNavegador`), nunca de uma credencial de serviço.
 *
 * Desvio consciente do UI-SPEC (registrado no SUMMARY): o documento sugere
 * "PDF, imagem ou planilha" no texto de ajuda, mas `parseRecebimento`
 * (`financeiro-tria/automation/src/tenants/marcos-paulo/extras/recebimento-webhook.ts`)
 * só despacha CSV/XLSX/XLS/OFX/PDF — imagem cai no ramo "tipo de arquivo nao
 * suportado" e devolve zero registros. O texto de ajuda abaixo lista os
 * formatos reais, para não prometer um que o parser descarta em silêncio.
 */

import { type ChangeEvent, useRef, useState } from "react";
import { CheckCircle2, Paperclip } from "lucide-react";
import { clienteDoNavegador } from "@/autenticacao/cliente-navegador";
import { Button, Field, Icone, Select } from "@/features/shell/ui";

const ORIGENS = [
  { value: "nubank", label: "Nubank" },
  { value: "itau_unibanco", label: "Itaú Unibanco" },
  { value: "btg_pactual", label: "BTG Pactual" },
  { value: "btg_cartao", label: "BTG Cartão" },
  { value: "nubank_violeta", label: "Nubank Violeta" },
  { value: "personallite_black", label: "PersonalLite Black" },
  { value: "azul_infinity", label: "Azul Infinity" },
] as const;

const COPY_AJUDA_FORMATO = "PDF, CSV, XLSX/XLS ou OFX do extrato. Escolha a Origem antes de anexar.";
const COPY_DESABILITADO = "Escolha a Origem antes de anexar o extrato.";

type EstadoDeEnvio = "aguardando" | "enviando" | "enviado" | "falhou";

/**
 * Sobe os bytes DIRETO ao `apps/api` — não a um Storage externo (ao
 * contrário de `UploadDeArquivos`, o upload público). `XMLHttpRequest`, não
 * `fetch`, porque só o primeiro expõe `upload.onprogress`.
 */
function enviarExtrato(
  origem: string,
  arquivo: File,
  token: string,
  aoProgredir: (percentual: number) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiUrl}/financeiro/extratos/${origem}`, true);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("content-type", arquivo.type || "application/octet-stream");
    xhr.setRequestHeader("x-file-name", arquivo.name);
    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) aoProgredir(Math.round((evento.loaded / evento.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(arquivo);
  });
}

export function FormularioDeExtrato() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [origem, setOrigem] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<EstadoDeEnvio>("aguardando");
  const [progresso, setProgresso] = useState(0);

  function limparParaProximoExtrato(): void {
    setOrigem("");
    setArquivo(null);
    setEstado("aguardando");
    setProgresso(0);
  }

  async function enviar(arquivoParaEnviar: File): Promise<void> {
    setEstado("enviando");
    setProgresso(0);

    const supabase = clienteDoNavegador();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setEstado("falhou");
      return;
    }

    const sucesso = await enviarExtrato(origem, arquivoParaEnviar, token, setProgresso);
    if (sucesso) {
      setEstado("enviado");
      // Depois de um envio bem-sucedido o formulário limpa para o próximo extrato.
      setTimeout(limparParaProximoExtrato, 1500);
    } else {
      setEstado("falhou");
    }
  }

  function aoEscolherArquivo(event: ChangeEvent<HTMLInputElement>): void {
    const escolhido = event.target.files?.[0];
    event.target.value = "";
    if (!escolhido) return;
    setArquivo(escolhido);
    void enviar(escolhido);
  }

  return (
    <div className="grid max-w-xl gap-4">
      <Field label="Origem">
        {(id) => <Select id={id} value={origem} onChange={setOrigem} options={ORIGENS} placeholder="Escolher a Origem" />}
      </Field>

      <div
        className="flex flex-wrap items-center gap-3 rounded-[var(--r-controle)] p-3"
        style={{ border: "1px dashed var(--linha)" }}
      >
        <Icone de={Paperclip} tamanho="md" style={{ color: "var(--texto-3)" }} />
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,.xlsx,.xls,.ofx"
          disabled={!origem}
          title={!origem ? COPY_DESABILITADO : undefined}
          className="sr-only"
          onChange={aoEscolherArquivo}
        />
        <Button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={!origem}
          disabledReason={COPY_DESABILITADO}
        >
          Adicionar arquivo
        </Button>
        <p className="app-meta" style={{ color: "var(--texto-3)" }}>
          {COPY_AJUDA_FORMATO}
        </p>
      </div>

      {arquivo ? (
        <div className="grid gap-1 rounded-[var(--r-controle)] p-2" style={{ border: "1px solid var(--linha)" }}>
          <span className="app-base min-w-0 truncate" title={arquivo.name}>
            {arquivo.name}
          </span>

          {estado === "enviando" ? (
            <div className="grid gap-1">
              <div
                role="progressbar"
                aria-valuenow={progresso}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progresso de envio de ${arquivo.name}`}
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ background: "var(--superficie-2)" }}
              >
                <div style={{ width: `${progresso}%`, height: "100%", background: "var(--acento)" }} />
              </div>
              <span className="app-meta app-numero">{`Enviando ${progresso}%`}</span>
            </div>
          ) : null}

          {estado === "enviado" ? (
            <span className="app-meta flex items-center gap-1" style={{ color: "var(--sucesso)" }}>
              <Icone de={CheckCircle2} tamanho="xs" />
              Extrato enviado.
            </span>
          ) : null}

          {estado === "falhou" ? (
            <div className="flex items-center gap-2">
              <span role="alert" className="app-meta" style={{ color: "var(--erro)" }}>
                Não foi possível enviar este extrato.
              </span>
              <Button variant="secondary" size="sm" onClick={() => void enviar(arquivo)}>
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
