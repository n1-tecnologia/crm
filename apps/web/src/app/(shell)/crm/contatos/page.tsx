"use client";

/**
 * T13 — Contatos, lidos e gravados pela api (D-04).
 *
 * A lista vem de `GET /contatos` por `useContatos` (SWR + `chamarCrm` com
 * `Authorization: Bearer`), não mais do store em memória do modelo antigo.
 * Abas Ativos / Arquivados / Lixeira (estado em `?estado=`, D-06), busca com
 * espera de 300 ms e "Mostrar mais" de 50 em 50 contra o servidor.
 *
 * Na Lixeira cada linha traz Restaurar e Excluir permanentemente; nos
 * Arquivados, Restaurar. As recusas da api (D-09 etc.) aparecem por
 * `MensagemDeRecusa`, com os links do que bloqueia.
 *
 * Saíram desta tela, de propósito:
 *   - o painel de Suspeitas de Duplicidade e a mesclagem (D-02): derivam do
 *     modelo antigo e voltam quando a mesclagem for reescrita sobre a 007;
 *   - o botão "Importar Contatos" (D-15): grava no modelo antigo;
 *   - o `CreateRecordDialog` antigo: a criação nova é o `DialogoNovoContato`.
 *
 * Nota de paginação: o `RecordList` do sistema fatia a tabela em 25 linhas com
 * o próprio "Mostrar mais"; o daqui, abaixo dele, busca as próximas 50 no
 * servidor e só aparece enquanto houver mais Contatos do que os carregados.
 */

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ESTADOS_CRM, LIMITES_CRM, type EstadoCrm } from "@n1/dominio/crm/comum";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { excluirContatoPermanentemente, restaurarContato, useContatos } from "@/dados/crm/contatos";
import { useNomeDoMembro, usePodeNoCrm } from "@/dados/crm/sessao";
import { AbasDeEstado, AcoesDeCicloDeVida, MensagemDeRecusa, seloDoEstado } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi, DialogoNovoContato } from "@/features/crm/formulario-de-contato";
import { useCreateRecordDialog } from "@/features/crm/create-record-dialog";
import {
  BarraDeFiltros,
  Button,
  CorpoDeTela,
  EmptyState,
  EsqueletoDeLinhas,
  Icone,
  PageHeader,
  StateSeal,
  Toast,
} from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";

const ESPERA_DA_BUSCA_MS = 300;

const VAZIO_POR_ESTADO: Record<EstadoCrm, { readonly titulo: string; readonly dica: string }> = {
  ativo: { titulo: "Nenhum Contato ainda.", dica: "Crie o primeiro com “Novo Contato”." },
  arquivado: {
    titulo: "Nenhum Contato arquivado.",
    dica: "Contatos arquivados saem das listas de trabalho, mas continuam consultáveis aqui.",
  },
  na_lixeira: {
    titulo: "Nenhum Contato na Lixeira.",
    dica: "Contatos excluídos ficam aqui até serem restaurados ou excluídos permanentemente.",
  },
};

function estadoDaUrl(valor: string | null): EstadoCrm {
  return (ESTADOS_CRM as readonly string[]).includes(valor ?? "") ? (valor as EstadoCrm) : "ativo";
}

export default function ContatosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const estado = estadoDaUrl(parametros.get("estado"));
  const nomeDoMembro = useNomeDoMembro();
  const semPermissao = usePodeNoCrm("criar", "contato");
  const semPermissaoParaRestaurar = usePodeNoCrm("restaurar", "contato");
  const { creating, openCreate, closeCreate } = useCreateRecordDialog("contato");

  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState<number>(LIMITES_CRM.paginaPadrao);
  const [aviso, setAviso] = useState<{ readonly tom: "success" | "error"; readonly texto: string } | null>(null);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);

  // Espera de 300 ms antes de trocar a chave: digitar não dispara uma ida ao servidor por letra.
  useEffect(() => {
    const espera = setTimeout(() => {
      setQ(busca.trim());
      setLimite(LIMITES_CRM.paginaPadrao);
    }, ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [busca]);

  const { data, error, isLoading, isValidating } = useContatos({ estado, q, limite });

  // `keepPreviousData` mostra a lista anterior enquanto a nova chega; ao trocar de aba ela é de outro estado.
  const dados = data && data.itens.every((item) => item.estado === estado) ? data : undefined;
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
      setAviso({ tom: "success", texto: sucesso });
    } catch (falha) {
      setRecusa(comoErroDeApi(falha, "Não foi possível concluir a ação. Tente de novo."));
    }
  };

  const vazio =
    q !== ""
      ? { titulo: "Nenhum Contato encontrado.", dica: `Nada corresponde a “${q}”. Confira a grafia ou limpe a busca.` }
      : VAZIO_POR_ESTADO[estado];

  const colunaDeAcoes =
    estado === "ativo"
      ? []
      : [
          {
            key: "acoes",
            label: "Ações",
            render: (item: (typeof itens)[number]) => {
              const nome = item.nomeDeExibicao;
              const restaurar = () => agir(() => restaurarContato(item.id), `${nome} restaurado.`);
              return estado === "na_lixeira" ? (
                <AcoesDeCicloDeVida
                  compacto
                  estado="na_lixeira"
                  rotulo={nome}
                  motivoSemPermissao={semPermissaoParaRestaurar}
                  onRestaurar={restaurar}
                  onExcluirPermanentemente={() =>
                    agir(() => excluirContatoPermanentemente(item.id), `${nome} excluído permanentemente.`)
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
        title="Contatos"
        meta={`${total} ${total === 1 ? "Contato" : "Contatos"}`}
        actions={semPermissao === undefined ? <Button variant="primary" onClick={openCreate}>Novo Contato</Button> : undefined}
      />

      <DialogoNovoContato
        open={creating}
        onClose={closeCreate}
        onCriado={(detalhado) => {
          const nome = nomeDeExibicaoDoContato(detalhado.contato);
          closeCreate();
          setAviso({ tom: "success", texto: `${nome} criado.` });
          router.push(`/crm/contatos/${detalhado.contato.id}`);
        }}
      />

      <AbasDeEstado valor={estado} onChange={trocarEstado} />
      <BarraDeFiltros>
        <span className="relative min-w-56 flex-1">
          <Icone
            de={Search}
            tamanho="xs"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--texto-4)" }}
          />
          <label htmlFor="busca-contatos" className="sr-only">
            Buscar Contato
          </label>
          <input
            id="busca-contatos"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            className="campo pl-9"
            style={{ height: "var(--controle-h-sm)" }}
          />
        </span>
      </BarraDeFiltros>

      <CorpoDeTela semRespiro>
        {aviso ? (
          <Toast tone={aviso.tom} onDismiss={() => setAviso(null)}>
            {aviso.texto}
          </Toast>
        ) : null}
        <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
        {error && dados === undefined ? (
          <EmptyState
            title="Não foi possível carregar os Contatos."
            hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
          />
        ) : carregando ? (
          <EsqueletoDeLinhas quantidade={6} />
        ) : (
          <>
            <RecordList
              items={itens}
              hrefOf={(item) => `/crm/contatos/${item.id}`}
              emptyTitle={vazio.titulo}
              emptyHint={vazio.dica}
              columns={[
                { key: "nome", label: "Nome de exibição", render: (item) => <span className="truncate" title={item.nomeDeExibicao}>{item.nomeDeExibicao}</span> },
                { key: "email", label: "E-mail principal", render: (item) => item.emailPrincipal ?? "—" },
                {
                  key: "telefone",
                  label: "Telefone principal",
                  className: "hidden @6xl:table-cell",
                  render: (item) => item.telefonePrincipal ?? "—",
                },
                { key: "proprietario", label: "Proprietário", render: (item) => nomeDoMembro(item.proprietarioId) },
                { key: "estado", label: "Estado", render: (item) => <StateSeal state={seloDoEstado(item.estado)} /> },
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
