"use client";

/**
 * A coluna do Contato na página da Conversa (Fase 15, 3.4.4 item 3, UCR-06): o
 * cartão do Contato no modelo novo. Lê `useContato` (Identificadores, vínculos com
 * Empresa, Proprietário, qualificação) e nada do Contato antigo (o
 * `contact-card.tsx` antigo saiu na 15-32).
 *
 * - A Empresa é a do vínculo vigente `admin` mais antigo (`empresaDoContato`, a
 *   mesma regra do resumo da Tarefa conversacional, 15-05).
 * - A qualificação é um item do Catálogo e se grava por `PATCH /contatos/:id` com
 *   `{ qualificacao }`; a recusa da api aparece na própria coluna. A api confere o
 *   id (T-15-59): a tela só oferece itens ativos do Catálogo.
 * - Sem temperatura: o Contato novo não a guarda (D-15-06).
 * - As ações por Canal (WhatsApp, E-mail, Instagram) levam o fio à aba do Canal
 *   padrão do tipo (`canalPadraoDoTipoNasTabelas`, D-14/D-15) — iniciar Conversa
 *   por outro Canal é abrir essa aba no fio, que abre a Conversa na primeira
 *   Mensagem (15-20).
 *
 * `somenteLeitura` (a Conversa está na lixeira) e o Papel do Membro desligam a
 * qualificação; quem barra de verdade é a api (`podeNoCrm`, T-15-58).
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AtSign, ExternalLink, FileText, Mail, MessageCircle, Phone, Star, StickyNote, User } from "lucide-react";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { nomeDeExibicaoDoContato, ROTULO_DO_TIPO_DE_IDENTIFICADOR, type IdentificadorDeContato, type TipoIdentificadorContato } from "@n1/dominio/crm/contatos";
import { canalPadraoDoTipoNasTabelas } from "@n1/dominio/crm/canais-de-resposta";
import type { TipoComProvedor } from "@n1/dominio/provedores-de-canal";
import { useCanais } from "@/dados/crm/canais";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { editarContato, useContato } from "@/dados/crm/contatos";
import { useConversas } from "@/dados/crm/conversas";
import { useNomeDoMembro, usePodeNoCrm } from "@/dados/crm/sessao";
import { useData } from "@/dados/store";
import { AvatarDoContato } from "@/features/crm/avatar-do-contato";
import { empresaDoContato } from "@/features/crm/empresa-do-contato";
import { Icone, RecordPanel, Select, cn } from "@/features/shell/ui";
import type { Id } from "@n1/dominio/types";

/** A ordem em que a pessoa procura: primeiro por onde se fala, depois onde ela existe. */
const ORDEM: readonly TipoIdentificadorContato[] = ["telefone", "whatsapp", "email", "instagram"];

const ICONE_DO_TIPO: Record<TipoIdentificadorContato, typeof Phone> = {
  telefone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  instagram: AtSign,
};

export function ColunaDoContato({
  contatoId,
  somenteLeitura = false,
  abaixo,
  onCanal,
}: {
  readonly contatoId: string;
  /** A Conversa está na lixeira: a coluna só mostra. */
  readonly somenteLeitura?: boolean;
  /** Controle da tela que vem logo abaixo da qualificação (o Atribuído e a Situação da Conversa). */
  readonly abaixo?: ReactNode;
  /** Leva o fio à aba do Canal escolhido. */
  readonly onCanal?: (canalId: Id) => void;
}) {
  const lido = useContato(contatoId);
  const catalogo = useData((data) => data.catalog);
  const nomeDoMembro = useNomeDoMembro();
  const semEditar = usePodeNoCrm("editar", "contato");
  const [erro, setErro] = useState<ErroDeApi | Error | null>(null);

  if (!lido.data) {
    return (
      <RecordPanel title="Contato" icon={<Icone de={User} tamanho="sm" />}>
        <p className="app-base" style={{ color: "var(--texto-3)" }}>
          {lido.error ? "Contato não encontrado." : "Carregando o Contato…"}
        </p>
        {abaixo ? <div className="mt-2">{abaixo}</div> : null}
      </RecordPanel>
    );
  }

  const { contato, identificadores, vinculos } = lido.data;
  const empresa = empresaDoContato(vinculos);
  const nome = nomeDeExibicaoDoContato(contato);
  const qualificacoes = catalogo.filter((item) => item.kind === "qualificacao" && item.lifecycle === "ativo");
  const desligada = somenteLeitura || semEditar !== undefined;

  const definirQualificacao = async (valor: string) => {
    if (valor === "") return;
    setErro(null);
    try {
      await editarContato(contato.id, { qualificacao: valor });
    } catch (falha) {
      setErro(falha instanceof Error ? falha : new Error("Não foi possível salvar a qualificação."));
    }
  };

  return (
    <>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <AvatarDoContato nome={contato.nome} sobrenome={contato.sobrenome} tamanho="grande" />
          <span className="min-w-0 flex-1">
            <span className="ed-subtitulo block min-w-0 truncate">{nome}</span>
            {empresa?.cargo ? (
              <span className="app-base block truncate" style={{ color: "var(--texto-3)" }}>
                {empresa.cargo}
              </span>
            ) : null}
            {empresa ? (
              <Link href={`/crm/empresas/${empresa.empresaId}`} className="app-base block truncate hover:underline" style={{ color: "var(--texto-3)" }}>
                {empresa.empresaNome}
              </Link>
            ) : null}
          </span>
        </div>

        <div className="mt-3">
          <label className="sr-only" htmlFor={`qualificacao-${contato.id}`}>
            Qualificação
          </label>
          <Select
            id={`qualificacao-${contato.id}`}
            value={contato.qualificacao ?? ""}
            onChange={(valor) => void definirQualificacao(valor)}
            disabled={desligada}
            {...(desligada ? { disabledReason: somenteLeitura ? "Esta Conversa está na lixeira." : semEditar } : {})}
            placeholder="Sem Qualificação"
            options={qualificacoes.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>

        {abaixo ? <div className="mt-2">{abaixo}</div> : null}

        {erro ? (
          <p role="alert" className="app-sm mt-2" style={{ color: "var(--erro)" }}>
            {erro.message}
          </p>
        ) : null}
      </div>

      <AcoesRapidas contatoId={contato.id} identificadores={identificadores} onCanal={onCanal} />

      <RecordPanel title="Dados de contato" icon={<Icone de={Star} tamanho="sm" />}>
        <ul className="grid gap-2">
          {[...identificadores]
            .sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo))
            .map((identificador) => {
              const IconeDoTipo = ICONE_DO_TIPO[identificador.tipo];
              const rotulo = ROTULO_DO_TIPO_DE_IDENTIFICADOR[identificador.tipo];
              const exibido = identificador.valorExibido ?? identificador.valor;
              const externo = identificador.tipo === "instagram" ? `https://instagram.com/${identificador.valor.replace(/^@/, "")}` : undefined;
              return (
                <li key={identificador.id} className="flex min-w-0 items-center gap-2.5">
                  <IconeDoTipo className="h-[var(--icone-sm)] w-[var(--icone-sm)] shrink-0 text-[var(--acento)]" aria-hidden="true" />
                  <span className="sr-only">{rotulo}:</span>
                  {externo ? (
                    <a href={externo} target="_blank" rel="noreferrer" className="identificador min-w-0 flex-1 truncate hover:underline" style={{ color: "var(--acento)" }}>
                      {exibido}
                    </a>
                  ) : (
                    <span className="identificador min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                      {exibido}
                    </span>
                  )}
                </li>
              );
            })}
          <li className="flex min-w-0 items-center gap-2.5">
            <Icone de={User} tamanho="sm" style={{ color: "var(--acento)" }} />
            <span className="sr-only">Proprietário:</span>
            <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
              {nomeDoMembro(contato.proprietarioId)}
            </span>
          </li>
        </ul>
      </RecordPanel>

      <RecordPanel title="Resumo do contato" icon={<Icone de={FileText} tamanho="sm" />}>
        <p className="app-base" style={{ color: "var(--texto-3)" }}>
          {contato.descricao && contato.descricao.trim() !== "" ? contato.descricao : "Sem descrição."}
        </p>
      </RecordPanel>
    </>
  );
}

/* ---------------------------------------------------------- ações rápidas */

function AcoesRapidas({
  contatoId,
  identificadores,
  onCanal,
}: {
  readonly contatoId: string;
  readonly identificadores: readonly IdentificadorDeContato[];
  readonly onCanal: ((canalId: Id) => void) | undefined;
}) {
  const canais = useCanais({ estado: "ativo", limite: LIMITES_CRM.paginaMaxima });
  const conversas = useConversas({ contatoId, estado: "ativo", limite: LIMITES_CRM.paginaMaxima });

  const porTipo = (tipo: TipoIdentificadorContato) => identificadores.find((i) => i.tipo === tipo);
  const telefone = porTipo("telefone") ?? porTipo("whatsapp");

  // D-14/D-15: a ação leva à aba do Canal padrão do tipo (a da última recebida entre os
  // Canais conectados que alcançam o Contato), não ao "primeiro do tipo".
  const porCanal = (tipo: TipoComProvedor, nomeDoTipo: string) => {
    if (!porTipo(tipo)) return { indisponivel: `Este Contato não tem ${nomeDoTipo}.` };
    if (!onCanal) return { indisponivel: `Este Contato não tem ${nomeDoTipo}.` };
    const canalId =
      canais.data && conversas.data ? canalPadraoDoTipoNasTabelas(canais.data.itens, identificadores, conversas.data.itens, tipo) : undefined;
    return canalId ? { onClick: () => onCanal(canalId) } : { indisponivel: `Nenhum Canal de ${nomeDoTipo} ativo alcança este Contato.` };
  };

  const acoes: Array<{
    readonly chave: string;
    readonly rotulo: string;
    readonly icone: ReactNode;
    readonly href?: string;
    readonly onClick?: () => void;
    readonly indisponivel?: string;
  }> = [
    {
      chave: "ligar",
      rotulo: "Ligar",
      icone: <Icone de={Phone} tamanho="md" />,
      ...(telefone ? { href: `tel:${telefone.valor}` } : { indisponivel: "Este Contato não tem telefone." }),
    },
    { chave: "whatsapp", rotulo: "WhatsApp", icone: <Icone de={MessageCircle} tamanho="md" />, ...porCanal("whatsapp", "WhatsApp") },
    { chave: "email", rotulo: "E-mail", icone: <Icone de={Mail} tamanho="md" />, ...porCanal("email", "e-mail") },
    { chave: "instagram", rotulo: "Instagram", icone: <Icone de={AtSign} tamanho="md" />, ...porCanal("instagram", "Instagram") },
    // As Notas moram na ficha do Contato (3.2.7).
    { chave: "nota", rotulo: "Nota", icone: <Icone de={StickyNote} tamanho="md" />, href: `/crm/contatos/${contatoId}` },
    { chave: "ficha", rotulo: "Abrir ficha", icone: <Icone de={ExternalLink} tamanho="md" />, href: `/crm/contatos/${contatoId}` },
  ];

  return (
    <ul className="grid grid-cols-6 gap-1">
      {acoes.map((acao) => {
        // O aro é o botão de ícone do sistema. A ação indisponível não sobe no hover: prometeria um clique que não existe.
        const conteudo = (
          <>
            <span
              className={cn("btn-icone alvo-toque", acao.indisponivel && "pointer-events-none opacity-40")}
              style={{ color: acao.indisponivel ? "var(--texto-4)" : "var(--acento)" }}
            >
              {acao.icone}
            </span>
            <span className="app-meta block truncate text-center">{acao.rotulo}</span>
          </>
        );
        return (
          <li key={acao.chave} className="grid justify-items-center gap-1">
            {acao.indisponivel ? (
              <span title={acao.indisponivel} className="grid justify-items-center gap-1">
                {conteudo}
                <span className="sr-only">{acao.indisponivel}</span>
              </span>
            ) : acao.href?.startsWith("/") ? (
              <Link href={acao.href} className="grid justify-items-center gap-1">
                {conteudo}
              </Link>
            ) : acao.href ? (
              <a href={acao.href} className="grid justify-items-center gap-1">
                {conteudo}
              </a>
            ) : (
              <button type="button" onClick={acao.onClick} className="grid justify-items-center gap-1">
                {conteudo}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
