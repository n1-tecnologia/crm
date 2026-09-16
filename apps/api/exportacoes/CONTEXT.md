# exportacoes

O contrato desta pasta: dado exportado do ClickUp fica fora do git; a prova
de que a exportação aconteceu (contagens, hashes) fica dentro.

## `clickup/` — fora do git

`apps/api/exportacoes/clickup/` está no `.gitignore` (D-02, LGPD): dados
pessoais (nomes, e-mails em comentários) e financeiros (valores, CPF/CNPJ,
dados bancários, notas fiscais em anexo) que aparecem no JSON bruto das
Tarefas, Comentários e anexos das 3 Listas exportadas. Backup dessa pasta é
responsabilidade do dono do projeto, não do git.

## `MANIFESTO.md` / `MANIFESTO.json` — versionados (chegam no Plan 00-04)

Ficam neste nível, **fora** do padrão ignorado — a prova de paridade
(CON-09) sem expor o conteúdo: data da exportação, contagens por Lista e por
recurso (Tarefas, Comentários, entradas de `time_in_status`, anexos), hash
sha256 por arquivo, e a lista de user ids do ClickUp vistos (com contagem,
sem nome).

## Layout previsto dentro de `clickup/` (por Lista)

```
<listId>/
  list.json
  fields.json
  members.json
  tasks/page-NNN.json
  tasks-arquivadas/page-NNN.json
  task/<taskId>.json
  comments/<taskId>/page-NNN.json
  time-in-status/<taskId>.json
  attachments/<taskId>/<attId>-<nome original>
```

Na raiz de `clickup/`: `usuarios-vistos.json` (todo user id encontrado, com
contagem — insumo do de-para, PREP-04) e `exportacao.log` (progresso e
avisos da execução, sem token).
