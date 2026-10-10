"use client";

/**
 * As peças de tela do ciclo de vida do CRM (D-06, D-09), nascidas com Contato
 * e reaproveitadas por Funis, Empresas e Negócios: abas de estado, ações de
 * Arquivar/Restaurar/Excluir com a confirmação certa, o selo e a mensagem de
 * recusa com os links de `bloqueios`.
 *
 * Doutrina da recusa: `ErroDeApi.message` é a frase em pt-BR já escrita pelo
 * domínio ou pela api, e a tela a mostra LITERAL, nunca reescrita. Os links
 * saem só do `id` (rota fixa `/crm/<recurso>/<id>`) e o nome é texto React,
 * escapado — nada vindo da api vira HTML (T-07-21).
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { EstadoCrm } from "@n1/dominio/crm/comum";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { Abas, Button, ConfirmDialog, Toast } from "@/features/shell/ui";

/** O `StateSeal` conhece `naLixeira`; a api fala `na_lixeira`. */
export function seloDoEstado(estado: EstadoCrm): string {
  return estado === "na_lixeira" ? "naLixeira" : estado;
}

const ROTULO_MASCULINO: Record<EstadoCrm, string> = { ativo: "Ativos", arquivado: "Arquivados", na_lixeira: "Lixeira" };
const ROTULO_FEMININO: Record<EstadoCrm, string> = { ativo: "Ativas", arquivado: "Arquivadas", na_lixeira: "Lixeira" };
const ORDEM: readonly EstadoCrm[] = ["ativo", "arquivado", "na_lixeira"];

/** Ativos / Arquivados / Lixeira (Empresas: Ativas / Arquivadas / Lixeira). O estado mora na URL, em quem chama. */
export function AbasDeEstado({
  valor,
  onChange,
  feminino = false,
}: {
  readonly valor: EstadoCrm;
  readonly onChange: (estado: EstadoCrm) => void;
  readonly feminino?: boolean;
}) {
  const rotulos = feminino ? ROTULO_FEMININO : ROTULO_MASCULINO;
  return (
    <Abas
      rotulo="Estado"
      abas={ORDEM.map((estado) => ({ chave: estado, rotulo: rotulos[estado] }))}
      ativa={valor}
      aoTrocar={(chave) => onChange(chave as EstadoCrm)}
    />
  );
}

type Confirmando = "lixeira" | "permanente" | null;

/**
 * As ações do registro por estado (D-06): `ativo` arquiva ou exclui; `arquivado`
 * restaura ou exclui; `na_lixeira` restaura ou exclui de vez. Excluir manda à
 * Lixeira e Arquivar é outro ato — este NÃO pede confirmação, é reversível.
 * Sem permissão os botões ficam desabilitados com o motivo (nunca somem).
 */
export function AcoesDeCicloDeVida({
  estado,
  rotulo,
  motivoSemPermissao,
  onArquivar,
  onRestaurar,
  onEnviarParaLixeira,
  onExcluirPermanentemente,
  compacto = false,
  avisoDaLixeira,
}: {
  readonly estado: EstadoCrm;
  /** O nome do registro, para os diálogos ("Excluir Ana?"). */
  readonly rotulo: string;
  readonly motivoSemPermissao?: string | undefined;
  readonly onArquivar?: () => void | Promise<void>;
  readonly onRestaurar: () => void | Promise<void>;
  /** Sem o gesto, o botão não existe (uma linha da Lixeira só restaura e exclui de vez). */
  readonly onEnviarParaLixeira?: () => void | Promise<void>;
  readonly onExcluirPermanentemente?: () => void | Promise<void>;
  /** Dentro de uma linha de lista: botões pequenos. */
  readonly compacto?: boolean;
  /** Acréscimo à descrição de "Excluir" (ex.: os vínculos da Empresa, D-08). */
  readonly avisoDaLixeira?: string;
}) {
  const [confirmando, setConfirmando] = useState<Confirmando>(null);
  const tamanho = compacto ? "sm" : "md";
  const semPermissao = motivoSemPermissao !== undefined;
  const desligado = semPermissao ? { disabled: true, disabledReason: motivoSemPermissao } : {};

  const confirmar = (acao: () => void | Promise<void>) => {
    setConfirmando(null);
    void acao();
  };

  return (
    <>
      <span className="flex items-center gap-2">
        {estado === "ativo" && onArquivar ? (
          <Button size={tamanho} variant="secondary" onClick={() => void onArquivar()} {...desligado}>
            Arquivar
          </Button>
        ) : null}
        {estado !== "ativo" ? (
          <Button size={tamanho} variant={compacto ? "ghost" : "secondary"} onClick={() => void onRestaurar()} {...desligado}>
            Restaurar
          </Button>
        ) : null}
        {estado === "na_lixeira" && onExcluirPermanentemente ? (
          <Button size={tamanho} variant="danger" onClick={() => setConfirmando("permanente")} {...desligado}>
            Excluir permanentemente
          </Button>
        ) : null}
        {estado !== "na_lixeira" && onEnviarParaLixeira ? (
          <Button size={tamanho} variant="danger" onClick={() => setConfirmando("lixeira")} {...desligado}>
            Excluir
          </Button>
        ) : null}
      </span>

      <ConfirmDialog
        open={confirmando === "lixeira"}
        title={`Excluir ${rotulo}?`}
        description={`${rotulo} vai para a Lixeira. Dá para restaurar depois, e nada que o referencia é apagado.${avisoDaLixeira ? ` ${avisoDaLixeira}` : ""}`}
        confirmLabel="Enviar para a Lixeira"
        destructive
        onConfirm={() => (onEnviarParaLixeira ? confirmar(onEnviarParaLixeira) : setConfirmando(null))}
        onCancel={() => setConfirmando(null)}
      />
      <ConfirmDialog
        open={confirmando === "permanente"}
        title={`Excluir ${rotulo} permanentemente?`}
        description={`Isto não pode ser desfeito. ${rotulo} e seus Identificadores, Endereços e vínculos serão apagados de vez.`}
        confirmLabel="Excluir permanentemente"
        destructive
        onConfirm={() => (onExcluirPermanentemente ? confirmar(onExcluirPermanentemente) : setConfirmando(null))}
        onCancel={() => setConfirmando(null)}
      />
    </>
  );
}

function ListaDeLinks({ rotulo, itens }: { readonly rotulo: string; readonly itens: ReactNode }) {
  return (
    <span className="mt-2 block">
      <span className="app-meta block">{rotulo}</span>
      <ul className="mt-1">{itens}</ul>
    </span>
  );
}

function ItemDeLink({ href, nome }: { readonly href: string; readonly nome: string }) {
  return (
    <li>
      <Link href={href} className="underline" style={{ color: "var(--texto)" }}>
        {nome}
      </Link>
    </li>
  );
}

/**
 * A recusa da api como `Toast` de erro: a frase literal e, quando a recusa traz
 * `bloqueios`, uma lista de links por tipo — Empresas, Filiais, Negócios (com
 * "e outros N" quando o total passa dos itens) e Contatos. Erro não expira: a
 * pessoa dispensa. `acao` abre espaço para o botão de saída de uma recusa
 * (ex.: "Migrar Negócios").
 */
export function MensagemDeRecusa({
  erro,
  onFechar,
  acao,
}: {
  readonly erro: ErroDeApi | Error | null;
  readonly onFechar: () => void;
  readonly acao?: ReactNode;
}) {
  if (!erro) return null;
  const bloqueios = erro instanceof ErroDeApi ? erro.bloqueios : undefined;
  const empresas = bloqueios?.empresas ?? [];
  const filiais = bloqueios?.filiais ?? [];
  const negocios = bloqueios?.negocios;
  const contatos = bloqueios?.contatos ?? [];
  const outrosNegocios = negocios ? Math.max(0, negocios.total - negocios.itens.length) : 0;

  return (
    <Toast tone="error" onDismiss={onFechar} {...(acao ? { acao } : {})}>
      <span className="block">{erro.message}</span>
      {empresas.length > 0 ? (
        <ListaDeLinks
          rotulo="Empresas afetadas"
          itens={empresas.map((empresa) => (
            <ItemDeLink key={empresa.id} href={`/crm/empresas/${empresa.id}`} nome={empresa.nome} />
          ))}
        />
      ) : null}
      {filiais.length > 0 ? (
        <ListaDeLinks
          rotulo="Filiais"
          itens={filiais.map((filial) => (
            <ItemDeLink key={filial.id} href={`/crm/empresas/${filial.id}`} nome={filial.nome} />
          ))}
        />
      ) : null}
      {negocios && negocios.itens.length > 0 ? (
        <ListaDeLinks
          rotulo="Negócios afetados"
          itens={
            <>
              {negocios.itens.map((negocio) => (
                <ItemDeLink key={negocio.id} href={`/crm/negocios/${negocio.id}`} nome={negocio.titulo} />
              ))}
              {outrosNegocios > 0 ? <li className="app-meta">e outros {outrosNegocios}</li> : null}
            </>
          }
        />
      ) : null}
      {contatos.length > 0 ? (
        <ListaDeLinks
          rotulo="Contato que já usa este Identificador"
          itens={contatos.map((contato) => (
            <ItemDeLink key={contato.id} href={`/crm/contatos/${contato.id}`} nome={contato.nome} />
          ))}
        />
      ) : null}
    </Toast>
  );
}
