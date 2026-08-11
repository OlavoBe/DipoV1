# SISCAM — sistema de proposituras da Câmara de Guarujá

Levantamento em `guaruja.siscam.com.br`, o sistema onde as indicações são
protocoladas e publicadas. Interessa ao Dipo por três motivos: é o destino final
do documento que geramos, expõe um corpus grande de indicações reais, e revela o
padrão de redação que a Casa espera.

## Como navegar

| O quê | URL |
|---|---|
| Lista de vereadores | `/vereadores` |
| Proposituras detalhadas | `/Vereadores/Proposituras/{id}` |
| Documento individual | `/Documentos/Documento/{id}` |
| Arquivo anexo | `/arquivo?Id={id}` |
| Resumo de sessão | `/Sessoes/Documento/{id}` |

IDs dos gabinetes do beta:

| Vereador | ID | Partido | E-mail institucional |
|---|---:|---|---|
| Márcio Nabor Tardelli | 13878 | PTB | marciopetshop@camaraguaruja.sp.gov.br |
| Ariani da Silva Paz | 13902 | PT | arianipaz@camaraguaruja.sp.gov.br |
| Edmar Lima dos Santos (Juninho Eroso) | 13291 | PP | juninhoeroso@camaraguaruja.sp.gov.br |
| Valdemir Batista Santana | 200 | — | — |

> O e-mail institucional do Márcio no SISCAM (`marciopetshop@`) **difere** do que
> aparece no cabeçalho do documento do gabinete (`Marcio@`). O cabeçalho é o que
> o gabinete escolheu usar — não "corrigir" o template pelo SISCAM sem perguntar.

## Volume disponível

O Márcio tem **1312 indicações** publicadas (2021–2026). Os quatro gabinetes do
beta estão todos no sistema. É um corpus muito maior que os 2 exemplos por
gabinete que hoje alimentam o few-shot.

Extração dos IDs (o HTML usa entidades, então ancore pelo atributo `title`):

```bash
curl -s "https://guaruja.siscam.com.br/Vereadores/Proposituras/13878" \
  | grep -o 'href="/Documentos/Documento/[0-9]*"[^>]*title="Indica[^"]*"' \
  | sed -E 's|href="/Documentos/Documento/([0-9]*)".*title="([^"]*)"|\1\t\2|'
```

## Os PDFs anexos são digitalizações

Numa amostra de 51 indicações espalhadas por todos os anos, **46 tinham arquivo
anexo**. Mas os arquivos são scans, não o documento digital:

- `/Filter /CCITTFaxDecode` — compressão de fax, monocromática
- 1656 × 2339 px em A4 ≈ 200 DPI
- **Nenhuma fonte embarcada e nenhuma camada de texto**

Ou seja, o fluxo real é: o gabinete produz o DOCX → imprime → assina → digitaliza
→ protocola. O PDF público é o retrato do papel assinado.

**Consequência para a Etapa 6 (diff visual):** o PDF do SISCAM **não serve** como
referência de fidelidade tipográfica — não dá para comparar métricas de fonte com
uma imagem de fax de 200 DPI. A referência tem que ser o PDF/DOCX que o próprio
gabinete gera, que é o que está em `docs/especificacao-gabinete-marcio.md`.

Os scans servem, no máximo, para conferir o enquadramento geral do layout.

## O padrão de redação da ementa

Este é o achado mais acionável. A ementa (campo "Assunto" no protocolo) segue uma
fórmula **rigorosamente uniforme** — 14 de 14 ementas amostradas do Márcio, e o
mesmo padrão em todos os outros vereadores da mesma sessão:

```
Solicita do Executivo que determine à Secretaria competente,
providências <visando | para que realize> <OBJETO>, <LOCALIZAÇÃO>.
```

Exemplos reais:

- *Solicita do Executivo que determine à Secretaria competente, providências visando a instalação de 02 (dois) braços de iluminação pública com luminárias, em frente ao nº 925 da rua Ostreiras, Jardim dos Pássaros.*
- *Solicita do Executivo que determine à Secretaria competente, providências visando a realização de poda de árvores, em frente ao nº 122 da Av. Gino Fabris, 122, Vila Santa Rosa.*
- *Solicita do Executivo que determine à Secretaria competente, providências para que realize o serviço de reparo na caixa de esgoto resolver a infiltração proveniente da SABESP, na altura do nº 585 da Av. Humberto Prieto Peres, Jardim Guaiuba.*

A única variação relevante é o conector depois de "providências" (`visando` ou
`para que realize`). O despacho `À SECRETARIA PARA AS DEVIDAS PROVIDÊNCIAS.` que
aparece nos resumos de sessão **não** faz parte da ementa — é acrescentado pela
Casa depois.

### O Dipo não gera a ementa

Verificado: não há nada em `lib/` que produza esse campo. O sistema gera o corpo
da indicação, mas o assessor ainda precisa escrever a ementa à mão na hora de
protocolar — e ela segue uma fórmula fixa, o que a torna trivial de gerar.

É uma lacuna pequena de implementar e de valor direto: fecha mais um pedaço do
trabalho manual que sobra depois da geração. Proposta de encaminhamento:

1. Acrescentar `ementa: string` ao `ExtractedData` (ou ao `IndicacaoDoc`)
2. Pedir a ementa no mesmo passo de geração, com a fórmula acima no prompt e as
   ementas reais como few-shot
3. Exibir na tela de revisão com botão "copiar ementa", ao lado do texto

Não implementado ainda — muda o prompt de geração, que hoje atende 4 gabinetes.

## Onde as ementas ficam disponíveis em texto

Os resumos de sessão trazem todas as matérias lidas, agrupadas por vereador, com
a ementa completa em texto (não em imagem). É a via prática para montar um corpus:

```
/Sessoes/Documento/{id}   →  seção "Indicações" → "Do Vereador <Nome>"
```

## Observações de acesso

- As páginas de documento carregam um **hCaptcha**, e existe uma rota
  `/Documentos/AcessoControlado`. Os arquivos que testamos baixaram sem desafio,
  mas o mecanismo existe — se passar a exigir resolução de captcha, o caminho
  automatizado acaba ali.
- Coleta em lote: use intervalo entre requisições (usamos 0,3s). É um serviço
  público de uma câmara municipal, não uma API.
- Indicações de 2026 mais recentes ainda não têm arquivo anexo — o scan entra
  depois da sessão.
