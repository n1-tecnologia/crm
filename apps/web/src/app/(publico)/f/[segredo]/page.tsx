/**
 * `/f/<segredo>` — o Formulário público (Plan 02-20, D-02). Server Component:
 * busca o DTO sanitizado no `apps/api` (`transportePublico.obterFormulario`,
 * `GET /v1/public/forms/:secret`) com `await params` e entrega ao Client
 * Component (`FormularioPublico`) SÓ esse DTO — nenhuma entidade completa,
 * segredo interno, configuração da Lista ou credencial atravessa a fronteira.
 * O antigo caminho em memória (seed do produto montado na hora + operação de
 * domínio chamada localmente) não participa mais daqui: quem responde fala
 * direto com o Fastify (D-02).
 *
 * Segredo inexistente e Formulário pausado mostram a MESMA copy — o
 * `apps/api` já responde 404 uniforme para os dois (T-02-03); esta página só
 * troca o rótulo do estado, nunca o motivo.
 */

import type { Metadata } from "next";
import { FilePen, FileX, WifiOff } from "lucide-react";
import { transportePublico } from "@/dados/transporte-publico";
import { FormularioPublico } from "@/features/formulario-publico/formulario";
import { EmptyState, Icone, Painel } from "@/features/shell/ui";

/** Checklist 1.4 — o título da aba é o nome do Formulário (o `fetch` sem cache do mesmo GET da página). */
export async function generateMetadata({ params }: { params: Promise<{ segredo: string }> }): Promise<Metadata> {
  const { segredo } = await params;
  const resultado = await transportePublico.obterFormulario(segredo);
  return { title: resultado.tipo === "ok" ? resultado.formulario.title : "Formulário" };
}

const COPY_INDISPONIVEL = "Este link não está disponível. Peça um novo link ao Financeiro.";

export default async function FormularioPublicoPage({ params }: { params: Promise<{ segredo: string }> }) {
  const { segredo } = await params;
  const resultado = await transportePublico.obterFormulario(segredo);

  if (resultado.tipo === "indisponivel") {
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Painel solido className="p-6">
            <EmptyState icon={<Icone de={FileX} tamanho="lg" />} title="Formulário indisponível" hint={COPY_INDISPONIVEL} />
          </Painel>
        </div>
      </main>
    );
  }

  // Checklist 1.5 — o link existe, mas o Formulário precisa de revisão: dizer já, antes de alguém preencher tudo.
  if (resultado.tipo === "desatualizado") {
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Painel solido className="p-6">
            <EmptyState icon={<Icone de={FilePen} tamanho="lg" />} title="Formulário em revisão" hint={resultado.erro} />
          </Painel>
        </div>
      </main>
    );
  }

  if (resultado.tipo === "falha") {
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Painel solido className="p-6">
            <EmptyState
              icon={<Icone de={WifiOff} tamanho="lg" />}
              title="Não foi possível carregar o Formulário."
              hint="Verifique sua conexão e tente novamente."
              // Âncora simples, sem JS: navegar de novo para a mesma URL refaz o `GET` no servidor.
              action={
                <a href={`/f/${segredo}`} className="btn alvo-toque">
                  Tentar novamente
                </a>
              }
            />
          </Painel>
        </div>
      </main>
    );
  }

  return (
    <main className="grade-pontos flex min-h-screen justify-center p-6 md:p-16">
      <div className="grid w-full content-start gap-4" style={{ maxWidth: "48rem" }}>
        <FormularioPublico secret={segredo} formulario={resultado.formulario} />
      </div>
    </main>
  );
}
