"use client";

/**
 * A seção "Negócios" das fichas de Contato e de Empresa (UI-SPEC §3): os
 * Negócios `ativo` do registro, lidos de `GET /negocios?contatoId=…` ou
 * `?empresaId=…` (até 50), com título (link para a ficha), situação, Etapa e
 * valor. Um Negócio é de uma Empresa OU de um Contato (`negocios_dono_ck`), e
 * esta seção recebe exatamente um dos dois.
 *
 * "Novo Negócio" abre o mesmo `DialogoNovoNegocio` do quadro, já com o dono
 * preenchido (o Contato ou a Empresa da ficha) e o Proprietário vazio = quem
 * cria (D-11). Ao criar, a lista revalida e o Toast oferece abrir a ficha nova
 * — quem cria daqui costuma ficar na ficha do dono. Quem não pode criar
 * (Convidado, D-14) não vê o botão; quem barra de verdade é o backend.
 *
 * O `NegocioResumo` traz o id da Etapa, não o nome: cada linha lê o Funil dela
 * por `useFunil` (a chave `/funis/:id` é uma só por Funil — o SWR busca uma
 * vez por Funil, não por linha).
 *
 * Todo texto vindo da api é renderizado como texto React (escapado); os links
 * saem de rota fixa + id; nada de `dangerouslySetInnerHTML` (T-07-34).
 */

import Link from "next/link";
import { useState } from "react";
import type { SituacaoNegocio } from "@n1/dominio/crm/comum";
import type { NegocioResumo } from "@n1/dominio/crm/negocios";
import { useFunil } from "@/dados/crm/funis";
import { useNegocios, type FiltroDeNegocios } from "@/dados/crm/negocios";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { DialogoNovoNegocio } from "@/features/crm/formulario-de-negocio";
import type { RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { Button, EmptyState, EsqueletoDeLinhas, Painel, Pilula, Section, Toast } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

/** A seção carrega até 50 Negócios do registro; acima disso diz "Mostrando 50 de N". */
export const NEGOCIOS_DO_REGISTRO = 50;

/** A situação do Negócio no vocabulário de cor do sistema: `perdido` não é vermelho. */
const PILULA_DA_SITUACAO: Record<SituacaoNegocio, { readonly rotulo: string; readonly cor: string }> = {
  aberto: { rotulo: "Aberto", cor: "var(--cor-neg-aberto)" },
  ganho: { rotulo: "Ganho", cor: "var(--cor-neg-ganho)" },
  perdido: { rotulo: "Perdido", cor: "var(--cor-neg-perdido)" },
};

/** O nome da Etapa pelo Funil (`GET /funis/:id`, uma vez por Funil); "—" até chegar. */
function NomeDaEtapa({ funilId, etapaId }: { readonly funilId: string; readonly etapaId: string }) {
  const funil = useFunil(funilId);
  const etapa = funil.data?.funil.id === funilId ? funil.data.etapas.find((item) => item.id === etapaId) : undefined;
  return <>{etapa?.nome ?? "—"}</>;
}

function LinhaDeNegocio({ negocio }: { readonly negocio: NegocioResumo }) {
  const fmt = useFormat();
  const pilula = PILULA_DA_SITUACAO[negocio.situacao];
  const valor = negocio.valor === null ? null : fmt.money({ amount: Number(negocio.valor), currency: negocio.moeda });
  return (
    <li className="flex flex-wrap items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
      <Link href={`/crm/negocios/${negocio.id}`} className="app-base min-w-0 flex-1 truncate underline" style={{ color: "var(--texto)" }} title={negocio.titulo}>
        {negocio.titulo}
      </Link>
      <Pilula cor={pilula.cor}>{pilula.rotulo}</Pilula>
      <span className="app-meta">
        {negocio.situacao === "aberto" ? "Etapa: " : "Última Etapa: "}
        <NomeDaEtapa funilId={negocio.funilId} etapaId={negocio.etapaId} />
      </span>
      <span className="app-base app-numero shrink-0" style={valor === null ? { color: "var(--texto-4)" } : undefined}>
        {valor ?? "sem valor declarado"}
      </span>
    </li>
  );
}

export function NegociosDoRegistro({
  empresa,
  contato,
}: {
  /** A Empresa da ficha; exclusivo com `contato`. */
  readonly empresa?: RegistroEscolhido;
  /** O Contato da ficha; exclusivo com `empresa`. */
  readonly contato?: RegistroEscolhido;
}) {
  const dono = empresa ? { tipo: "empresa" as const, registro: empresa } : contato ? { tipo: "contato" as const, registro: contato } : null;
  const filtro: FiltroDeNegocios = {
    estado: "ativo",
    limite: NEGOCIOS_DO_REGISTRO,
    ...(dono?.tipo === "empresa" ? { empresaId: dono.registro.id } : dono?.tipo === "contato" ? { contatoId: dono.registro.id } : {}),
  };
  const lista = useNegocios(filtro, { pausado: dono === null });
  const semCriar = usePodeNoCrm("criar", "negocio");
  const [criando, setCriando] = useState(false);
  const [criado, setCriado] = useState<{ readonly id: string } | null>(null);

  // Sem dono não há o que listar: a ficha passa sempre um dos dois.
  if (dono === null) return null;

  // Defensivo: o SWR guarda o que a api devolveu; só uma lista de verdade entra nas linhas.
  const itens: readonly NegocioResumo[] = Array.isArray(lista.data?.itens) ? lista.data.itens : [];
  const total = typeof lista.data?.total === "number" ? lista.data.total : itens.length;
  const vazio = dono.tipo === "empresa" ? "Nenhum Negócio desta Empresa." : "Nenhum Negócio deste Contato.";

  const corpo = () => {
    if (lista.data === undefined) {
      if (lista.error) {
        return <EmptyState compact title="Não foi possível carregar os Negócios." hint={comoErroDeApi(lista.error, "Tente de novo em instantes.").message} />;
      }
      return <EsqueletoDeLinhas quantidade={3} />;
    }
    if (itens.length === 0) {
      return <EmptyState compact title={vazio} {...(semCriar === undefined ? { hint: "Crie o primeiro com “Novo Negócio”." } : {})} />;
    }
    return (
      <Painel className="px-4">
        <ul>
          {itens.map((negocio) => (
            <LinhaDeNegocio key={negocio.id} negocio={negocio} />
          ))}
        </ul>
        {total > itens.length ? <p className="app-meta py-2">{`Mostrando ${itens.length} de ${total}.`}</p> : null}
      </Painel>
    );
  };

  return (
    <Section
      title="Negócios"
      {...(lista.data !== undefined ? { count: total } : {})}
      action={
        semCriar === undefined ? (
          <Button size="sm" onClick={() => setCriando(true)}>
            Novo Negócio
          </Button>
        ) : undefined
      }
    >
      {criado ? (
        <Toast
          tone="success"
          onDismiss={() => setCriado(null)}
          acao={
            <Link href={`/crm/negocios/${criado.id}`} className="btn btn-contorno btn-sm shrink-0">
              Abrir Negócio
            </Link>
          }
        >
          Negócio criado.
        </Toast>
      ) : null}
      {corpo()}
      <DialogoNovoNegocio
        open={criando}
        onClose={() => setCriando(false)}
        onCriado={(detalhado) => {
          setCriando(false);
          setCriado({ id: detalhado.negocio.id });
          // A mutação já invalida `/negocios`; revalidar a chave desta lista é o cinto além do suspensório.
          void lista.mutate();
        }}
        valorInicial={dono.tipo === "empresa" ? { empresa: dono.registro } : { contato: dono.registro }}
      />
    </Section>
  );
}
