"use client";

/**
 * T15 — Empresas, lidas e gravadas pela api (D-04).
 *
 * A lista vem de `GET /empresas` por `useEmpresas` (SWR + `chamarCrm` com
 * `Authorization: Bearer`), não mais do store em memória do modelo antigo.
 * Abas Ativas / Arquivadas / Lixeira (estado em `?estado=`, D-06), busca com
 * espera de 300 ms e "Mostrar mais" de 50 em 50 contra o servidor.
 *
 * A Empresa escolhida abre num popup por `?empresa=<id>` (a lista fica atrás) —
 * a mesma ficha da página cheia (`FichaDeEmpresa modo="popup"`), com "Abrir
 * página cheia" no rodapé. Na Lixeira cada linha traz Restaurar (que pede o
 * Contato admin, D-08) e Excluir permanentemente; nas Arquivadas, Restaurar.
 * As recusas da api (RN-EMP-09/10) aparecem por `MensagemDeRecusa`, com os
 * links do que bloqueia.
 *
 * Saíram desta tela, de propósito:
 *   - o `CreateRecordDialog` antigo: a criação nova é o `DialogoNovaEmpresa`,
 *     que exige o Contato admin no mesmo envio (D-08);
 *   - o popup antigo da Empresa e a coluna "Negócios" do modelo em memória: a
 *     seção de Negócios da Empresa chega com o 07-11.
 *
 * Nota de paginação: o `RecordList` do sistema fatia a tabela em 25 linhas com
 * o próprio "Mostrar mais"; o daqui, abaixo dele, busca as próximas 50 no
 * servidor e só aparece enquanto houver mais Empresas do que as carregadas.
 */

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ESTADOS_CRM, LIMITES_CRM, type EstadoCrm } from "@n1/dominio/crm/comum";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { excluirEmpresaPermanentemente, restaurarEmpresa, useEmpresa, useEmpresas } from "@/dados/crm/empresas";
import { useNomeDoMembro, usePodeNoCrm } from "@/dados/crm/sessao";
import { AbasDeEstado, AcoesDeCicloDeVida, MensagemDeRecusa, seloDoEstado } from "@/features/crm/ciclo-de-vida";
import { useCreateRecordDialog } from "@/features/crm/create-record-dialog";
import { DialogoNovaEmpresa } from "@/features/crm/formulario-de-empresa";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { DialogoDeRestauracao, FichaDeEmpresa } from "@/features/crm/ficha-de-empresa";
import {
  BarraDeFiltros,
  Button,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  EsqueletoDeLinhas,
  Icone,
  PageHeader,
  SidePanel,
  StateSeal,
  Toast,
} from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";

const ESPERA_DA_BUSCA_MS = 300;

/** A Empresa escolhida abre no popup, por `?empresa=<id>` — a lista fica atrás. */
const EMPRESA_PARAM = "empresa";

const VAZIO_POR_ESTADO: Record<EstadoCrm, { readonly titulo: string; readonly dica: string }> = {
  ativo: { titulo: "Nenhuma Empresa ainda.", dica: "Crie a primeira com “Nova Empresa”: ela nasce com um Contato admin." },
  arquivado: {
    titulo: "Nenhuma Empresa arquivada.",
    dica: "Empresas arquivadas saem das listas de trabalho, mas continuam consultáveis aqui.",
  },
  na_lixeira: {
    titulo: "Nenhuma Empresa na Lixeira.",
    dica: "Restaurar uma Empresa da Lixeira pede um Contato admin.",
  },
};

function estadoDaUrl(valor: string | null): EstadoCrm {
  return (ESTADOS_CRM as readonly string[]).includes(valor ?? "") ? (valor as EstadoCrm) : "ativo";
}

/** O popup da Empresa: lê a ficha pela api e a desenha no `SidePanel` com o rodapé "Abrir página cheia". */
function PopupDaEmpresa({ empresaId, onFechar }: { readonly empresaId: string; readonly onFechar: () => void }) {
  const { data, error } = useEmpresa(empresaId);
  if (data) return <FichaDeEmpresa empresaId={empresaId} detalhado={data} modo="popup" onFechar={onFechar} />;
  return (
    <SidePanel title="Empresa" open onClose={onFechar}>
      {error ? (
        <EmptyState
          title={error instanceof ErroDeApi && error.status === 404 ? "Empresa não encontrada." : "Não foi possível abrir a Empresa."}
          hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
        />
      ) : (
        <EsqueletoDeLinhas quantidade={6} />
      )}
    </SidePanel>
  );
}

/** Restaurar pela Lixeira: lê a ficha para pré-preencher o último admin e então pede o Contato admin (D-08). */
function RestauracaoDaLinha({
  empresaId,
  nome,
  onFechar,
  avisar,
}: {
  readonly empresaId: string;
  readonly nome: string;
  readonly onFechar: () => void;
  readonly avisar: (texto: string) => void;
}) {
  const { data, error } = useEmpresa(empresaId);
  if (data) return <DialogoDeRestauracao detalhado={data} onFechar={onFechar} avisar={avisar} />;
  return (
    <ConfirmDialog
      open
      title={`Restaurar ${nome}`}
      description={error ? "Não foi possível abrir a Empresa. Tente de novo." : "Carregando a Empresa…"}
      confirmLabel="Restaurar Empresa"
      confirmDisabledReason={error ? "Não foi possível carregar a Empresa." : "Carregando a Empresa…"}
      onConfirm={() => undefined}
      onCancel={onFechar}
    />
  );
}

export default function EmpresasPage() {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const estado = estadoDaUrl(parametros.get("estado"));
  const aberta = parametros.get(EMPRESA_PARAM);
  const nomeDoMembro = useNomeDoMembro();
  const semPermissao = usePodeNoCrm("criar", "empresa");
  const semPermissaoParaRestaurar = usePodeNoCrm("restaurar", "empresa");
  const { creating, openCreate, closeCreate } = useCreateRecordDialog("empresa");

  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState<number>(LIMITES_CRM.paginaPadrao);
  const [aviso, setAviso] = useState<{ readonly tom: "success" | "error"; readonly texto: string } | null>(null);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [restaurando, setRestaurando] = useState<{ readonly id: string; readonly nome: string } | null>(null);

  // Espera de 300 ms antes de trocar a chave: digitar não dispara uma ida ao servidor por letra.
  useEffect(() => {
    const espera = setTimeout(() => {
      setQ(busca.trim());
      setLimite(LIMITES_CRM.paginaPadrao);
    }, ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [busca]);

  const { data, error, isLoading, isValidating } = useEmpresas({ estado, q, limite });

  // `keepPreviousData` mostra a lista anterior enquanto a nova chega; ao trocar de aba ela é de outro estado.
  const dados = data && data.itens.every((item) => item.estado === estado) ? data : undefined;
  const itens = dados?.itens ?? [];
  const total = dados?.total ?? 0;
  const carregando = isLoading || (dados === undefined && !error) || (isValidating && itens.length === 0);

  const trocarEstado = (proximo: EstadoCrm) => {
    const seguinte = new URLSearchParams(parametros.toString());
    seguinte.delete(EMPRESA_PARAM);
    if (proximo === "ativo") seguinte.delete("estado");
    else seguinte.set("estado", proximo);
    setLimite(LIMITES_CRM.paginaPadrao);
    setAviso(null);
    setRecusa(null);
    router.replace(seguinte.size > 0 ? `${pathname}?${seguinte}` : pathname, { scroll: false });
  };

  const fecharPopup = () => {
    const seguinte = new URLSearchParams(parametros.toString());
    seguinte.delete(EMPRESA_PARAM);
    router.replace(seguinte.size > 0 ? `${pathname}?${seguinte}` : pathname, { scroll: false });
  };

  const hrefDaLinha = (id: string) => {
    const seguinte = new URLSearchParams(parametros.toString());
    seguinte.set(EMPRESA_PARAM, id);
    return `${pathname}?${seguinte}`;
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
      ? { titulo: "Nenhuma Empresa encontrada.", dica: `Nada corresponde a “${q}”. Confira a grafia ou limpe a busca.` }
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
              return estado === "na_lixeira" ? (
                <AcoesDeCicloDeVida
                  compacto
                  estado="na_lixeira"
                  rotulo={nome}
                  motivoSemPermissao={semPermissaoParaRestaurar}
                  // D-08: da Lixeira a Empresa volta com um Contato admin.
                  onRestaurar={() => setRestaurando({ id: item.id, nome })}
                  onExcluirPermanentemente={() => agir(() => excluirEmpresaPermanentemente(item.id), `${nome} excluída permanentemente.`)}
                />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void agir(() => restaurarEmpresa(item.id), `${nome} restaurada.`)}
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
        title="Empresas"
        meta={`${total} ${total === 1 ? "Empresa" : "Empresas"}`}
        actions={semPermissao === undefined ? <Button variant="primary" onClick={openCreate}>Nova Empresa</Button> : undefined}
      />

      <DialogoNovaEmpresa
        open={creating}
        onClose={closeCreate}
        onCriado={(detalhado) => {
          closeCreate();
          setAviso({ tom: "success", texto: "Empresa criada." });
          router.push(`/crm/empresas/${detalhado.empresa.id}`);
        }}
      />

      <AbasDeEstado valor={estado} onChange={trocarEstado} feminino />
      <BarraDeFiltros>
        <span className="relative min-w-56 flex-1">
          <Icone
            de={Search}
            tamanho="xs"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--texto-4)" }}
          />
          <label htmlFor="busca-empresas" className="sr-only">
            Buscar Empresa
          </label>
          <input
            id="busca-empresas"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome, domínio ou documento"
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
            title="Não foi possível carregar as Empresas."
            hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
          />
        ) : carregando ? (
          <EsqueletoDeLinhas quantidade={6} />
        ) : (
          <>
            <RecordList
              items={itens}
              // A ficha no formato da Tarefa, num popup sobre a lista; a página
              // cheia continua a um clique no rodapé dele.
              hrefOf={(item) => hrefDaLinha(item.id)}
              emptyTitle={vazio.titulo}
              emptyHint={vazio.dica}
              columns={[
                { key: "nome", label: "Nome de exibição", render: (item) => <span className="truncate" title={item.nomeDeExibicao}>{item.nomeDeExibicao}</span> },
                { key: "dominio", label: "Domínio", render: (item) => item.dominioPrincipal ?? "—" },
                { key: "documento", label: "Documento", className: "hidden @6xl:table-cell", render: (item) => item.documentoPrincipal ?? "—" },
                { key: "matriz", label: "Empresa matriz", render: (item) => item.matriz?.nome ?? "—" },
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

      {aberta !== null ? <PopupDaEmpresa empresaId={aberta} onFechar={fecharPopup} /> : null}
      {restaurando !== null ? (
        <RestauracaoDaLinha
          empresaId={restaurando.id}
          nome={restaurando.nome}
          onFechar={() => setRestaurando(null)}
          avisar={(texto) => setAviso({ tom: "success", texto })}
        />
      ) : null}
    </div>
  );
}
