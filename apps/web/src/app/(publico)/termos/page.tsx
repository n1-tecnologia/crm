/**
 * `/termos` — os Termos e Condições de uso. Pública (sem sessão), como
 * `/privacidade`: o endereço que a Meta pede no cadastro do app e que quem vai
 * aceitar os termos precisa abrir antes de ter conta.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { EMPRESA } from "@/features/legal/dados-da-empresa";
import { ComoFalarConosco, DocumentoLegal, Identificacao, Itens, type SecaoLegal } from "@/features/legal/documento-legal";

export const metadata: Metadata = {
  title: "Termos e Condições",
  description: `As regras de uso do ${EMPRESA.produto}, da ${EMPRESA.nome}: conta, uso aceitável, Canais de terceiros, responsabilidades e encerramento.`,
};

const secoes: readonly SecaoLegal[] = [
  {
    id: "aceite",
    titulo: "Aceite e quem pode usar",
    conteudo: (
      <>
        <p>
          Estes Termos regem o uso do {EMPRESA.produto}, plataforma de trabalho, CRM, Caixa de Entrada, Financeiro e automações oferecida pela {EMPRESA.nome}.
          Ao criar uma conta, aceitar um convite ou usar a plataforma, você declara que leu e concorda com eles e com a{" "}
          <Link href="/privacidade" className="hover:underline" style={{ color: "var(--acento)" }}>
            Política de Privacidade
          </Link>
          .
        </p>
        <p>
          Você precisa ter 18 anos ou mais. Se usa a plataforma em nome de uma empresa, declara ter poderes para vinculá-la a estes Termos. Se não concorda
          com algum ponto, não use o serviço.
        </p>
        <Identificacao />
      </>
    ),
  },
  {
    id: "o-servico",
    titulo: "O serviço",
    conteudo: (
      <>
        <p>O {EMPRESA.produto} reúne, num mesmo Espaço de Trabalho:</p>
        <Itens>
          <li>Tarefas, Listas, Formulários e Painéis para organizar o trabalho da equipe;</li>
          <li>CRM com Contatos, Empresas, Funis e Negócios;</li>
          <li>Caixa de Entrada, que reúne as Conversas dos Canais conectados;</li>
          <li>Financeiro, com solicitações, contas a pagar e a receber;</li>
          <li>recursos de IA e Automações, que executam ações a partir de regras que a própria empresa define.</li>
        </Itens>
        <p>
          O produto evolui. Podemos incluir, alterar ou retirar recursos; quando a mudança afetar o que você já usa de forma relevante, avisaremos com
          antecedência razoável.
        </p>
      </>
    ),
  },
  {
    id: "conta",
    titulo: "Conta, Espaço de Trabalho e Papéis",
    conteudo: (
      <>
        <Itens>
          <li>Cada pessoa usa uma conta individual e é responsável por manter a senha em sigilo. Não compartilhe credenciais.</li>
          <li>Avise-nos imediatamente se suspeitar de acesso indevido à sua conta.</li>
          <li>
            Quem administra o Espaço de Trabalho convida e remove Membros, define seus Papéis e responde pelo que eles fazem na conta da empresa. O que cada
            Papel enxerga e altera é decidido por essa administração.
          </li>
          <li>Os dados do cadastro devem ser verdadeiros e estar atualizados.</li>
        </Itens>
      </>
    ),
  },
  {
    id: "uso-aceitavel",
    titulo: "Uso aceitável",
    conteudo: (
      <>
        <p>Você concorda em não usar o {EMPRESA.produto} para:</p>
        <Itens>
          <li>violar lei, direitos de terceiros ou a LGPD, incluindo o envio de mensagens a quem não tem relação com você ou não consentiu quando isso é exigido;</li>
          <li>enviar spam, correntes, golpes, phishing, conteúdo ilícito, discriminatório ou que incite violência;</li>
          <li>tentar acessar dados de outro Espaço de Trabalho, contornar limites, permissões ou medidas de segurança;</li>
          <li>fazer engenharia reversa, copiar ou revender a plataforma, ou construir um serviço concorrente a partir dela;</li>
          <li>sobrecarregar a infraestrutura ou interferir no funcionamento para os demais;</li>
          <li>descumprir as regras dos provedores dos Canais conectados (veja a seção seguinte).</li>
        </Itens>
        <p>Podemos remover conteúdo e suspender o acesso que viole esta seção, conforme a seção “Suspensão e encerramento”.</p>
      </>
    ),
  },
  {
    id: "canais",
    titulo: "Canais de terceiros: WhatsApp, Instagram e E-mail",
    conteudo: (
      <>
        <p>
          A Caixa de Entrada depende de serviços que não controlamos. O {EMPRESA.produto} não é afiliado, patrocinado nem endossado pela Meta, pelo WhatsApp
          ou pelo Instagram.
        </p>
        <Itens>
          <li>
            <strong>Você responde pela conexão.</strong> Só conecte contas que sejam suas ou que a empresa tenha autorização para administrar, e cumpra os
            termos e políticas de cada provedor (por exemplo, os da WhatsApp Business Platform, como as regras de modelos de mensagem, janela de atendimento
            de 24 horas e consentimento do contato).
          </li>
          <li>
            <strong>WhatsApp oficial</strong> usa a API do próprio provedor, com as regras e limites dele.
          </li>
          <li>
            <strong>WhatsApp não oficial</strong> funciona por meio que o provedor não endossa e pode contrariar os termos dele. A conta conectada dessa forma
            pode ser limitada ou banida, e a conexão pode parar sem aviso. Ao escolhê-lo, você assume esse risco e não temos responsabilidade pelas
            consequências.
          </li>
          <li>
            <strong>Mudanças dos provedores</strong> (preços, limites, recursos, revisão de aplicativos) podem alterar ou interromper um Canal. Não garantimos
            que um Canal estará disponível.
          </li>
          <li>
            <strong>Contatos e consentimento.</strong> A empresa cliente decide quem contatar e é responsável por ter base legal para isso.
          </li>
        </Itens>
      </>
    ),
  },
  {
    id: "dados",
    titulo: "Seus dados",
    conteudo: (
      <>
        <p>
          O conteúdo que você registra no {EMPRESA.produto} — Contatos, Conversas, Negócios, arquivos e demais dados — continua sendo seu ou da sua empresa.
          Você nos concede uma licença limitada, só para operar, proteger e melhorar o serviço para você.
        </p>
        <p>
          Em relação a dados pessoais de terceiros que a empresa cliente coloca na plataforma, ela é a controladora e a {EMPRESA.nome} é a operadora. A
          empresa garante que tem base legal para o tratamento e para nos entregar esses dados, e que informou os titulares como a lei exige. Como tratamos
          os dados está na{" "}
          <Link href="/privacidade" className="hover:underline" style={{ color: "var(--acento)" }}>
            Política de Privacidade
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "ia-e-automacoes",
    titulo: "IA e Automações",
    conteudo: (
      <Itens>
        <li>Respostas e sugestões geradas por IA podem conter erros ou omissões. Revise-as antes de enviar a um contato ou de agir com base nelas.</li>
        <li>
          Uma Automação executa o que foi configurado, inclusive enviar mensagens e registrar ou aprovar lançamentos. Quem configura responde pelo resultado,
          e deve testar a regra antes de ativá-la.
        </li>
        <li>Decisões financeiras, jurídicas ou de saúde não devem se apoiar apenas em conteúdo gerado automaticamente.</li>
      </Itens>
    ),
  },
  {
    id: "propriedade-intelectual",
    titulo: "Propriedade intelectual",
    conteudo: (
      <p>
        A plataforma, a marca {EMPRESA.produto}, o código, o design e a documentação pertencem à {EMPRESA.nome} ou a seus licenciadores. Estes Termos dão a
        você apenas o direito pessoal, limitado, revogável e não exclusivo de usar o serviço enquanto a conta estiver ativa, sem transferir qualquer
        propriedade. Sugestões que você nos enviar podem ser usadas por nós sem obrigação de pagamento.
      </p>
    ),
  },
  {
    id: "condicoes-comerciais",
    titulo: "Condições comerciais",
    conteudo: (
      <p>
        Planos, preços, forma de pagamento e prazos são os da proposta ou do contrato firmado com a {EMPRESA.nome}. Onde o contrato for omisso, valem estes
        Termos. Tributos aplicáveis são devidos conforme a lei.
      </p>
    ),
  },
  {
    id: "disponibilidade",
    titulo: "Disponibilidade e suporte",
    conteudo: (
      <p>
        Trabalhamos para manter o serviço no ar e seguro, mas não prometemos funcionamento ininterrupto nem livre de erros. Podem ocorrer manutenções,
        falhas de provedores e eventos fora do nosso controle. Quando possível, avisamos as paradas programadas. O atendimento segue o canal e o horário
        combinados com você.
      </p>
    ),
  },
  {
    id: "responsabilidade",
    titulo: "Garantias e limitação de responsabilidade",
    conteudo: (
      <>
        <p>
          O serviço é oferecido “como está”, na extensão permitida pela lei. Não respondemos por lucros cessantes, perda de negócios ou danos indiretos, nem
          por prejuízos causados por conteúdo e decisões do cliente, por indisponibilidade de provedores de terceiros ou por uso em desacordo com estes
          Termos.
        </p>
        <p>
          Quando houver responsabilidade nossa, ela se limita ao valor pago por você nos 12 meses anteriores ao fato que a originou, salvo se a lei não
          permitir essa limitação (por exemplo, em caso de dolo ou de direitos do consumidor que não podem ser afastados). Você nos isenta de reclamações de
          terceiros decorrentes do seu uso ilícito da plataforma.
        </p>
      </>
    ),
  },
  {
    id: "encerramento",
    titulo: "Suspensão e encerramento",
    conteudo: (
      <>
        <Itens>
          <li>Você pode encerrar a conta a qualquer momento. Cobranças já devidas continuam valendo.</li>
          <li>
            Podemos suspender ou encerrar o acesso, com aviso quando possível, se houver violação destes Termos, risco à segurança, ordem de autoridade ou
            inadimplência.
          </li>
          <li>
            Depois do encerramento, você pode exportar seus dados por até 30 dias. Passado esse prazo, eles são removidos como descrito na Política de
            Privacidade, ressalvados os que a lei nos obriga a manter.
          </li>
        </Itens>
      </>
    ),
  },
  {
    id: "mudancas",
    titulo: "Mudanças nestes Termos",
    conteudo: (
      <p>
        Podemos atualizar estes Termos. A data no topo mostra a versão vigente. Mudanças relevantes serão avisadas por e-mail ou dentro da plataforma antes
        de valer; continuar a usar o serviço depois disso significa que você aceitou a nova versão. Se não aceitar, pode encerrar a conta.
      </p>
    ),
  },
  {
    id: "lei-e-foro",
    titulo: "Lei aplicável e foro",
    conteudo: (
      <p>
        Estes Termos seguem as leis do Brasil. Fica eleito o foro da comarca da sede da {EMPRESA.nome} para resolver controvérsias, ressalvado o direito do
        consumidor de propor ação no foro do seu domicílio.
      </p>
    ),
  },
  {
    id: "contato",
    titulo: "Contato",
    conteudo: (
      <p>
        Dúvidas sobre estes Termos? <ComoFalarConosco />
      </p>
    ),
  },
];

export default function TermosPage() {
  return (
    <DocumentoLegal
      titulo="Termos e Condições"
      resumo={`Estas são as regras para usar o ${EMPRESA.produto}: o que você pode esperar de nós, o que esperamos de você e o que acontece quando algo dá errado.`}
      secoes={secoes}
      outro={{ href: "/privacidade", rotulo: "Política de Privacidade" }}
    />
  );
}
