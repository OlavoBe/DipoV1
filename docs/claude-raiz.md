# Guia da pasta `Dipo Eco`

<!-- Este arquivo e a copia versionada do CLAUDE.md que fica na pasta PAI dos
     repositorios. A pasta pai nao esta em git, entao num computador novo e
     preciso copiar este conteudo para "Dipo Eco/CLAUDE.md" a mao.
     Comentarios HTML como este sao removidos antes de entrar no contexto:
     custam zero token. -->

Esta pasta guarda os três repositórios do Dipo, o sistema do gabinete do
vereador em Guarujá/SP. **Ela não é um repositório** — cada sistema tem o seu.

| Pasta | O que é | Onde roda |
|---|---|---|
| `DipoV1/` | Dipo Indicações — site que gera indicações legislativas | Vercel + Railway |
| `dipoagenda/` | Bot de WhatsApp da agenda do gabinete | Railway + Evolution API |
| `dipo-backups/` | Backups cifrados do banco | — |

**Ao trabalhar em um deles, leia o `CLAUDE.md` daquele repositório antes de
mexer em qualquer coisa.** Cada um tem armadilhas próprias, aprendidas quebrando
produção, que não estão repetidas aqui.

## O que vale nos três

- **`git pull` antes de começar, commit e push antes de encerrar.** O projeto é
  tocado de três computadores (trabalho, casa, notebook) e o git é a única
  memória compartilhada. Sessão que não escreve no repositório não existe para
  as outras máquinas.
- **Ao encerrar, atualize o `docs/estado-do-projeto.md` do repositório afetado**
  e a página de estado: <https://claude.ai/artifact/XoCGgChfsG6hcf1RJVhRoy>.
  Isso vale mesmo quando a sessão não mudou código.
- **Escreva em português**, inclusive commits, comentários e mensagens ao
  usuário. Commits são frases curtas no imperativo, sem prefixo de tipo.
- **Nenhum segredo no repositório.** Credenciais vivem nas variáveis de
  ambiente da Vercel e do Railway. Os `.env.example` só têm marcadores.
- **Não use `git add -A`** — adicione arquivos específicos, para não commitar
  `.env.local` sem querer.
- **Migrations não são aplicadas pelo deploy sozinho** em nenhum dos dois
  sistemas. Confira antes de mandar para produção código que usa coluna nova.
- **Antes de apagar ou sobrescrever dados**, liste o que existe e mostre ao
  usuário primeiro.
