"use client";

/**
 * CONECTAR UM PROVEDOR (Fase 8, D-06, D-08) — o formulário de orientação de um
 * provedor: nome e identificador (o número, o e-mail ou o usuário, na forma que
 * o Tipo de Canal pede). Ao confirmar, o Canal nasce DESCONECTADO em
 * `plataforma.canais` (008) por `POST /canais`; a conexão com o provedor
 * acontece depois (08-08/08-09). O web só fala HTTP com a api (`criarCanal`) e
 * depois re-hidrata o estado: o Canal chega em `state.channels` pela projeção de
 * `GET /estado` (D-11).
 *
 * A página é o mockup inteiro de D-07: o passo a passo do provedor, o espaço
 * reservado do QR/token (marcado "disponível quando a integração chegar") e o
 * formulário real, com Fila e Origem padrão. O botão desabilitado diz o motivo
 * (§11), na mesma ordem que a api aplica: Papel → nome → identificador → forma.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogIn, QrCode, Server } from "lucide-react";
import { useState } from "react";
import { FORMA_DO_IDENTIFICADOR, identificadorCanonico } from "@n1/dominio/operations/canais";
import { PROVEDORES } from "@n1/dominio/provedores-de-canal";
import type { ProvedorDeCanal } from "@n1/dominio/types/crm";
import { criarCanal } from "@/dados/crm/canais";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { useData, useRehidratar } from "@/dados/store";
import { ORIENTACAO_DO_PROVEDOR } from "@/features/crm/conectar-canal";
import { Button, CorpoDeTela, Field, PageHeader, Painel, Pilula, Select, TextInput } from "@/features/shell/ui";

const DESTINO = "/crm/caixa-de-entrada/configuracoes";

/** O ícone do espaço reservado: o que aquele provedor vai pedir quando a integração chegar. */
const ICONE_DO_ESPACO_RESERVADO: Readonly<Record<ProvedorDeCanal, (props: { readonly className?: string }) => React.ReactNode>> = {
  "whatsapp-nao-oficial": QrCode,
  "whatsapp-cloud": KeyRound,
  "instagram-graph": LogIn,
  "email-imap-smtp": Server,
};

interface Erro {
  readonly texto: string;
  readonly campo: string | undefined;
  /** O Canal que já ocupa o nome ou a conta (409), para o link "ver o Canal". */
  readonly canalId: string | undefined;
}

export function ConectarProvedor({ provedor }: { readonly provedor: ProvedorDeCanal }) {
  const router = useRouter();
  const rehidratar = useRehidratar();
  const permissao = usePodeNoCrm("criar", "canal");
  const { tipo, rotulo } = PROVEDORES[provedor];
  const forma = FORMA_DO_IDENTIFICADOR[tipo];
  const orientacao = ORIENTACAO_DO_PROVEDOR[provedor];
  const IconeReservado = ICONE_DO_ESPACO_RESERVADO[provedor];
  const filas = useData((data) => data.queues).filter((fila) => fila.lifecycle === "ativo");
  const origens = useData((data) => data.catalog).filter((item) => item.kind === "origem" && item.lifecycle === "ativo");

  const [nome, setNome] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [filaId, setFilaId] = useState("");
  const [origemId, setOrigemId] = useState("");
  const [erro, setErro] = useState<Erro | null>(null);

  const formaInvalida = identificador.trim() !== "" && identificadorCanonico(tipo, identificador) === undefined;
  // O mesmo encadeamento que o domínio faz, dito antes do clique.
  const motivo = permissao
    ? permissao
    : !nome.trim()
      ? "Dê um nome ao Canal."
      : !identificador.trim()
        ? `Informe ${forma.rotulo.toLocaleLowerCase("pt-BR")}.`
        : formaInvalida
          ? forma.dica
          : undefined;

  const confirmar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const canal = await criarCanal({
        provedor,
        nome,
        identificador,
        ...(filaId ? { filaPadraoId: filaId } : {}),
        ...(origemId ? { origemPadraoId: origemId } : {}),
      });
      await rehidratar();
      router.push(`${DESTINO}/canais/${canal.id}`);
    } catch (falha) {
      if (falha instanceof ErroDeApi) setErro({ texto: falha.message, campo: falha.campo, canalId: falha.bloqueios?.canais?.[0]?.id });
      else setErro({ texto: "Não foi possível criar o Canal.", campo: undefined, canalId: undefined });
      setEnviando(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            <Link href="/crm/caixa-de-entrada" className="hover:underline">
              Caixa de Entrada
            </Link>
            {" › "}
            <Link href={DESTINO} className="hover:underline">
              Configurações
            </Link>
          </>
        }
        title={`Conectar ${rotulo}`}
      />

      <CorpoDeTela>
        <p className="app-base mb-4" style={{ color: "var(--texto-2)" }}>
          O Canal nasce desconectado: a conexão com o provedor acontece depois.
        </p>

        <div className="grid max-w-xl gap-4">
          <Painel className="p-4">
            <h2 className="app-md" style={{ color: "var(--texto)" }}>
              Como conectar
            </h2>
            <ol className="app-base mt-2 list-decimal space-y-1 pl-5" style={{ color: "var(--texto-2)" }}>
              {orientacao.passos.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
          </Painel>

          <div
            className="flex items-start gap-3 rounded-[var(--raio-superficie)] p-4"
            style={{ border: "1px dashed var(--linha)", background: "var(--superficie-2)" }}
            data-espaco-reservado="true"
          >
            <IconeReservado className="mt-0.5 size-[var(--icone-md)] shrink-0" />
            <div className="grid gap-1">
              <p className="app-md flex flex-wrap items-center gap-2" style={{ color: "var(--texto)" }}>
                {orientacao.espacoReservado.titulo}
                <Pilula tom="neutro">disponível quando a integração chegar</Pilula>
              </p>
              <p className="app-meta">{orientacao.espacoReservado.texto}</p>
            </div>
          </div>

          <Painel className="grid gap-4 p-4">
            <Field
              label="Nome"
              required
              hint="Como a conta aparece na Caixa de Entrada — “Comercial SP”, “Suporte”."
              {...(erro?.campo === "nome" ? { error: erro.texto } : {})}
            >
              {(id) => (
                <TextInput id={id} value={nome} onChange={setNome} placeholder={`Por exemplo: ${rotulo} do Comercial`} invalid={erro?.campo === "nome"} />
              )}
            </Field>
            <Field
              label={forma.rotulo}
              required
              hint={forma.dica}
              {...(erro?.campo === "identificador" ? { error: erro.texto } : {})}
            >
              {(id) => (
                <TextInput
                  id={id}
                  value={identificador}
                  onChange={setIdentificador}
                  placeholder={forma.exemplo}
                  invalid={formaInvalida || erro?.campo === "identificador"}
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Setor (Fila padrão)"
                hint="A Fila em que as Conversas desta conta entram — quem atende por ela."
                {...(erro?.campo === "filaPadraoId" ? { error: erro.texto } : {})}
              >
                {(id) => (
                  <Select
                    id={id}
                    value={filaId}
                    onChange={setFilaId}
                    placeholder="Nenhum"
                    options={[{ value: "", label: "Nenhum — a Conversa nasce sem Fila" }, ...filas.map((f) => ({ value: f.id, label: f.name }))]}
                  />
                )}
              </Field>
              <Field
                label="Origem padrão"
                hint="De onde vêm os Contatos que nascem por esta conta (catálogo do Espaço de Trabalho)."
                {...(erro?.campo === "origemPadraoId" ? { error: erro.texto } : {})}
              >
                {(id) => (
                  <Select
                    id={id}
                    value={origemId}
                    onChange={setOrigemId}
                    placeholder="Nenhuma"
                    options={[{ value: "", label: "Nenhuma" }, ...origens.map((o) => ({ value: o.id, label: o.name }))]}
                  />
                )}
              </Field>
            </div>

            {erro && !["nome", "identificador", "filaPadraoId", "origemPadraoId"].includes(erro.campo ?? "") ? (
              <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
                {erro.texto}
              </p>
            ) : null}
            {erro?.canalId ? (
              <p className="app-base">
                <Link href={`${DESTINO}/canais/${erro.canalId}`} className="hover:underline" style={{ color: "var(--acento)" }}>
                  ver o Canal
                </Link>
              </p>
            ) : null}

            <div>
              <Button
                variant="primary"
                onClick={() => void confirmar()}
                disabled={motivo !== undefined || enviando}
                {...(motivo !== undefined ? { disabledReason: motivo } : enviando ? { disabledReason: "Conectando…" } : {})}
              >
                Conectar
              </Button>
            </div>
          </Painel>
        </div>
      </CorpoDeTela>
    </div>
  );
}
