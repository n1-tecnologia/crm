"use client";

/**
 * Funis, lidos e gravados pela api (D-04).
 *
 * A lista vem de `GET /funis` por `useFunis` (SWR + `chamarCrm` com
 * `Authorization: Bearer`), não mais do store em memória do modelo antigo.
 * Abas Ativos / Arquivados / Lixeira (estado em `?estado=`, D-06), o Funil
 * padrão marcado com a Pílula "Funil padrão" (D-13) e "Mostrar mais" de 50 em
 * 50 contra o servidor. Não há busca: um Espaço tem poucos Funis.
 *
 * "Novo Funil" só existe para quem configura Funis — Administrador e
 * Proprietário (D-14); a api recusa o resto com 403. Na Lixeira cada linha
 * traz Restaurar (a recusa `FUNIL_NOME_EM_USO` aparece) e Excluir
 * permanentemente; nos Arquivados, Restaurar. As recusas passam por
 * `MensagemDeRecusa`.
 *
 * Funis do cadastro anterior (modelo em memória) não aparecem aqui até a
 * unificação (D-15).
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ESTADOS_CRM, LIMITES_CRM, type EstadoCrm } from "@n1/dominio/crm/comum";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { excluirFunilPermanentemente, restaurarFunil, useFunis } from "@/dados/crm/funis";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { AbasDeEstado, AcoesDeCicloDeVida, MensagemDeRecusa, seloDoEstado } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { DialogoNovoFunil } from "@/features/crm/formulario-de-funil";
import { Button, CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader, Pilula, StateSeal, Toast } from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";

const VAZIO_POR_ESTADO: Record<EstadoCrm, { readonly titulo: string; readonly dica: string }> = {
  ativo: { titulo: "Nenhum Funil ainda.", dica: "Crie o primeiro com “Novo Funil”. Sem Funil, não há onde colocar Negócios." },
  arquivado: { titulo: "Nenhum Funil arquivado.", dica: "Funis arquivados não recebem Negócios novos." },
  na_lixeira: {
    titulo: "Nenhum Funil na Lixeira.",
    dica: "Funis excluídos ficam aqui até serem restaurados ou excluídos permanentemente.",
  },
};

function estadoDaUrl(valor: string | null): EstadoCrm {
  return (ESTADOS_CRM as readonly string[]).includes(valor ?? "") ? (valor as EstadoCrm) : "ativo";
}

export default function FunisPage() {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const estado = estadoDaUrl(parametros.get("estado"));
  const semPermissaoParaCriar = usePodeNoCrm("criar", "funil");
  const semPermissaoParaRestaurar = usePodeNoCrm("restaurar", "funil");

  const [criando, setCriando] = useState(false);
  const [limite, setLimite] = useState<number>(LIMITES_CRM.paginaPadrao);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);

  const { data, error, isLoading, isValidating } = useFunis({ estado, limite });

  // `keepPreviousData` mostra a lista anterior enquanto a nova chega; ao trocar de aba ela é de outro estado.
  const dados = data && data.itens.every((item) => item.funil.estado === estado) ? data : undefined;
  const itens = dados?.itens ?? [];
  const total = dados?.total ?? 0;
  const carregando = isLoading || (dados === undefined && !error) || (isValidating && itens.length === 0);

  const trocarEstado = (proximo: EstadoCrm) => {
    const seguinte = new URLSearchParams(parametros.toString());
    if (proximo === "ativo") seguinte.delete("estado");
    else seguinte.set("estado", proximo);
    setLimite(LIMITES_CRM.paginaPadrao);
    setAviso(null);
    setRecusa(null);
    router.replace(seguinte.size > 0 ? `${pathname}?${seguinte}` : pathname, { scroll: false });
  };

  const agir = async (acao: () => Promise<unknown>, sucesso: string) => {
    setRecusa(null);
    setAviso(null);
    try {
      await acao();
      setAviso(sucesso);
    } catch (falha) {
      setRecusa(comoErroDeApi(falha, "Não foi possível concluir a ação. Tente de novo."));
    }
  };

  const colunaDeAcoes =
    estado === "ativo"
      ? []
      : [
          {
            key: "acoes",
            label: "Ações",
            render: (item: (typeof itens)[number]) => {
              const nome = item.funil.nome;
              const restaurar = () => agir(() => restaurarFunil(item.funil.id), `${nome} restaurado.`);
              return estado === "na_lixeira" ? (
                <AcoesDeCicloDeVida
                  compacto
                  estado="na_lixeira"
                  rotulo={nome}
                  motivoSemPermissao={semPermissaoParaRestaurar}
                  onRestaurar={restaurar}
                  onExcluirPermanentemente={() =>
                    agir(() => excluirFunilPermanentemente(item.funil.id), `${nome} excluído permanentemente.`)
                  }
                />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void restaurar()}
                  {...(semPermissaoParaRestaurar ? { disabled: true, disabledReason: semPermissaoParaRestaurar } : {})}
                >
                  Restaurar
                </Button>
              );
            },
          },
        ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Funis"
        meta={`${total} ${total === 1 ? "Funil" : "Funis"}`}
        actions={
          semPermissaoParaCriar === undefined ? (
            <Button variant="primary" onClick={() => setCriando(true)}>
              Novo Funil
            </Button>
          ) : undefined
        }
      />

      <DialogoNovoFunil
        open={criando}
        onClose={() => setCriando(false)}
        onCriado={(detalhado) => {
          setCriando(false);
          router.push(`/crm/funis/${detalhado.funil.id}`);
        }}
      />

      <AbasDeEstado valor={estado} onChange={trocarEstado} />

      <CorpoDeTela semRespiro>
        {aviso ? (
          <Toast tone="success" onDismiss={() => setAviso(null)}>
            {aviso}
          </Toast>
        ) : null}
        <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
        {error && dados === undefined ? (
          <EmptyState
            title="Não foi possível carregar os Funis."
            hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
          />
        ) : carregando ? (
          <EsqueletoDeLinhas quantidade={6} />
        ) : (
          <>
            <RecordList
              items={itens.map((item) => ({ ...item, id: item.funil.id }))}
              hrefOf={(item) => `/crm/funis/${item.funil.id}`}
              emptyTitle={VAZIO_POR_ESTADO[estado].titulo}
              emptyHint={VAZIO_POR_ESTADO[estado].dica}
              columns={[
                {
                  key: "nome",
                  label: "Nome",
                  render: (item) => (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate" title={item.funil.nome}>
                        {item.funil.nome}
                      </span>
                      {item.funil.padrao ? <Pilula tom="info">Funil padrão</Pilula> : null}
                      {item.funil.privado ? <Pilula>Privado</Pilula> : null}
                    </span>
                  ),
                },
                { key: "etapas", label: "Etapas", render: (item) => item.totalEtapas },
                {
                  key: "abertos",
                  label: "Negócios abertos",
                  className: "hidden @6xl:table-cell",
                  render: (item) => item.negociosAbertos,
                },
                { key: "estado", label: "Estado", render: (item) => <StateSeal state={seloDoEstado(item.funil.estado)} /> },
                ...colunaDeAcoes,
              ]}
            />
            {itens.length < total ? (
              <div className="flex justify-center px-1 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setLimite((atual) => atual + LIMITES_CRM.paginaPadrao)}>
                  Mostrar mais
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CorpoDeTela>
    </div>
  );
}
