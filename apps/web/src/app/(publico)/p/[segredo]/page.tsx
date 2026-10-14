/**
 * `/p/<segredo>` — a Tarefa por link público (PARA-05). Server Component,
 * como `/f/<segredo>`: busca a projeção no `apps/api`
 * (`transportePublico.obterTarefaPublica`, `GET /v1/public/tasks/:secret`)
 * e entrega ao Client Component só esse DTO. O antigo caminho em memória
 * (seed do produto montado na hora) não existe mais: um link gerado numa aba
 * abre em qualquer lugar, e revogar fecha na hora.
 *
 * Segredo inexistente, revogado e Tarefa fora do ativo mostram a MESMA copy:
 * o `apps/api` responde 404 uniforme para os três.
 */

import type { Metadata } from "next";
import { Link2Off, WifiOff } from "lucide-react";
import { transportePublico } from "@/dados/transporte-publico";
import { TarefaPublicaView } from "@/features/tarefa-publica/tarefa-publica";
import { EmptyState, Icone, Painel } from "@/features/shell/ui";

export async function generateMetadata({ params }: { params: Promise<{ segredo: string }> }): Promise<Metadata> {
  const { segredo } = await params;
  const resultado = await transportePublico.obterTarefaPublica(segredo);
  return { title: resultado.tipo === "ok" ? resultado.tarefa.title : "Tarefa" };
}

export default async function TarefaPublicaPage({ params }: { params: Promise<{ segredo: string }> }) {
  const { segredo } = await params;
  const resultado = await transportePublico.obterTarefaPublica(segredo);

  if (resultado.tipo === "indisponivel") {
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Painel solido className="p-6">
            <EmptyState icon={<Icone de={Link2Off} tamanho="lg" />} title="Link indisponível" hint="Este link foi revogado ou não existe. Peça um novo a quem o enviou." />
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
              title="Não foi possível carregar a Tarefa."
              hint="Verifique sua conexão e tente novamente."
              action={
                <a href={`/p/${segredo}`} className="btn alvo-toque">
                  Tentar novamente
                </a>
              }
            />
          </Painel>
        </div>
      </main>
    );
  }

  return <TarefaPublicaView tarefa={resultado.tarefa} />;
}
