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
 * Esta versão é a mínima do traçador: os passos, o espaço do QR/token e a Fila e
 * a Origem padrão entram em 08-08. O botão desabilitado diz o motivo (§11), na
 * mesma ordem que a api aplica: Papel → nome → identificador → forma.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FORMA_DO_IDENTIFICADOR, identificadorCanonico } from "@n1/dominio/operations/canais";
import { PROVEDORES } from "@n1/dominio/provedores-de-canal";
import type { ProvedorDeCanal } from "@n1/dominio/types/crm";
import { criarCanal } from "@/dados/crm/canais";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { useRehidratar } from "@/dados/store";
import { Button, CorpoDeTela, Field, PageHeader, Painel, TextInput } from "@/features/shell/ui";

const DESTINO = "/crm/caixa-de-entrada/configuracoes";

export function ConectarProvedor({ provedor }: { readonly provedor: ProvedorDeCanal }) {
  const router = useRouter();
  const rehidratar = useRehidratar();
  const permissao = usePodeNoCrm("criar", "canal");
  const { tipo, rotulo } = PROVEDORES[provedor];
  const forma = FORMA_DO_IDENTIFICADOR[tipo];

  const [nome, setNome] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ readonly texto: string; readonly campo: string | undefined } | null>(null);

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
      await criarCanal({ provedor, nome, identificador });
      await rehidratar();
      router.push(DESTINO);
    } catch (falha) {
      if (falha instanceof ErroDeApi) setErro({ texto: falha.message, campo: falha.campo });
      else setErro({ texto: "Não foi possível criar o Canal.", campo: undefined });
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
        <Painel className="grid max-w-xl gap-4 p-4">
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

          {erro && erro.campo !== "nome" && erro.campo !== "identificador" ? (
            <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
              {erro.texto}
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
      </CorpoDeTela>
    </div>
  );
}
