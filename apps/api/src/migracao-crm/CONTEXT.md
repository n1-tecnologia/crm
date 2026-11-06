# migracao-crm — o script `migrar:crm-antigo`

Ler primeiro: [`../../../../CONTEXT.md`](../../../../CONTEXT.md), [`../../CONTEXT.md`](../../CONTEXT.md) e
[`../persistencia/CONTEXT.md`](../persistencia/CONTEXT.md)

## O que é

O script de dados do corte da Fase 15 (UCR-09): tira o CRM em inglês (Contato, Empresa, Negócio, Funil,
Canal, Conversa e os Vínculos) de `plataforma.registros`, guardando uma cópia em
`plataforma.registros_crm_antigo`, e leva o que o `ws_n1` precisa para o CRM novo. É **temporário**: a
pasta sai do repositório num plano de limpeza depois do corte aceito.

Mora aqui, e não em `importacao/`, porque `importacao/` não tem SQL (o `CONTEXT.md` de lá proíbe). Roda
fora do processo da API, na mão do dono, e **nunca** é chamado por rota nem por agendador.

## Regras que não mudam

- **Nunca loga dado pessoal.** Relatório, mensagem de erro e log têm só ids, contagens e nomes de
  configuração (Funil, Etapa, Lista, Pasta). Nome de pessoa, telefone, e-mail e texto de Mensagem nunca.
- **Não importa tipos do modelo antigo de `@n1/dominio`.** `formatos-antigos.ts` descreve só os campos que o
  script lê, para ele continuar compilando depois que a 3.5.4 apagar `Contact`, `Deal` etc. A guarda
  `sem-crm-antigo.test.ts` da api também barra o código que leia o CRM antigo pelo `state`.
- **Toda leitura das coleções antigas é por SQL** em `plataforma.registros`. A `operacao` passada a
  `executar()` não toca nas nove coleções; as linhas saem de `registros` só pelo SQL do `aoConfirmar`.
- **Um Espaço por execução.** `--espaco` é obrigatório, validado contra `^ws_[a-z0-9_]+$` e contra
  `plataforma.workspaces`; não existe "todos os Espaços". Toda consulta leva `workspace_id = $1`.
- **Nada sai de `registros` antes de estar copiado e contado** (F14-D-03). A cópia é conferida (chave e
  conteúdo idêntico) na mesma transação, antes do `delete`; uma contagem diferente lança e a transação
  inteira volta. Não existe script de desfazer (D-15-02): a rede é o backup manual do corte mais a cópia.
- **Valores só por `$n`**; nome de tabela e de coluna só de constantes (T-15-66).
- **Nunca rode contra um banco que não seja o seu.** Os testes usam só Postgres de Docker
  (`describeComBanco`, host local). Em produção quem roda é o dono, no corte (15-34/15-35).

## Os arquivos

| Arquivo | O que faz |
|---|---|
| `colecoes.ts` | As nove coleções, `ehConversaDeGrupo`, o critério de Grupo em SQL, `ErroDeUso`, `validarEspaco`. |
| `formatos-antigos.ts` | Interfaces estruturais mínimas do que o script lê (sem import do domínio). |
| `guardar.ts` | `copiarParaRegistrosCrmAntigo` (`on conflict do nothing`), `conferirCopia`, `contarDoAlvo`, `apagarDoRegistros`. |
| `migrar-crm-antigo.ts` | `guardarCrmAntigo(espaco)`: uma `executar()` do Espaço (sem escolher regime): `lerDoCrm` copia e confere, `aoConfirmar` apaga. |
| `fixtures/registros-antigos-minimos.json` | CRM antigo SINTÉTICO congelado (nove coleções, uma Conversa de Grupo) para os testes. |

## Conversa de Grupo

Grupo e Flow ficam no modelo antigo até as Sessões 6 e 7 (F14-D-05). As Conversas com
`groupIdentifier` são **copiadas** para `registros_crm_antigo` mas **continuam** em `registros`; o
relatório diz quantas ficaram. As outras oito coleções e as Conversas sem Grupo saem inteiras.

## Repetir não muda nada

Rodar `--guardar` de novo no mesmo Espaço não copia (`on conflict do nothing`), não apaga e não sobe a
revisão do Espaço: o resultado diz "nada a fazer".
