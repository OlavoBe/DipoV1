# Piloto de corpus — Márcio do Pet Shop × Adriana Machado

Primeira rodada de investigação sobre o corpus real do SISCAM. O objetivo não é
ainda melhorar o produto: é **descobrir o que os números dizem** sobre a redação
da Casa e sobre a distância entre o que o Dipo assume hoje e o que a Câmara
efetivamente publica.

Dois gabinetes de propósito, escolhidos por serem opostos úteis:

| | `marcio_pet` | `adriana_machado` |
|---|---|---|
| SISCAM | [13878](https://guaruja.siscam.com.br/Vereadores/Proposituras/13878) | [14932](https://guaruja.siscam.com.br/Vereadores/Proposituras/14932) |
| Nome | Márcio Nabor Tardelli | Adriana Soares Araújo Machado |
| No beta hoje | sim | **não** — é o grupo de controle |
| Indicações | 1.312 | 585 |
| Período | 2021–2026 (2 mandatos) | 2025–2026 (1º mandato) |

Márcio já tem perfil em `lib/vereadores.ts` e few-shot próprio; Adriana não tem
nada. Se o corpus da Adriana produzir texto tão bom quanto o do Márcio, isso
responde a pergunta que interessa comercialmente: **dá para embarcar um gabinete
novo sem trabalho manual de curadoria?**

## Como reproduzir

```bash
node scripts/coleta-siscam.mjs --vereador=13878 --slug=marcio_pet --docs --anexos
node scripts/coleta-siscam.mjs --vereador=14932 --slug=adriana_machado --docs --anexos
node scripts/analise-corpus.mjs marcio_pet adriana_machado
```

O corpus fica em `E:\Dipo\corpus-siscam\<slug>\` — fora do repositório, porque
são centenas de MB de PDF e porque é material público que não precisa de
versionamento. Os scripts são retomáveis: rodar de novo só busca o que falta.

---

## Achado 1 — a ementa é praticamente uma fórmula fechada

Ignorando acento e pontuação, a aderência ao prefixo padrão é quase total:

| Gabinete | Ementas no padrão | Exato | Normalizado |
|---|---:|---:|---:|
| `marcio_pet` | 1.312 | 90,8% | **99,5%** |
| `adriana_machado` | 585 | 99,1% | **99,1%** |

A diferença entre "exato" e "normalizado" é só ruído de digitação — vírgula a
mais em `Solicita do Executivo, que determine`, acento faltando. Não é variação
de estilo.

As 11 exceções reais (6 do Márcio, 5 da Adriana, todas de 2025) usam a fórmula
antiga `Indico a Mesa seja oficiado ao Executivo…` — que é a abertura do **corpo**
do documento, não da ementa. Alguém protocolou colando o texto errado no campo.

**O que isso significa:** o `lib/ementa.ts` acertou a fórmula. Com 1.897 ementas
confirmando o padrão, dá para trocar a confiança no LLM por uma validação dura —
ver "O que fazer com isso", item 1.

### O conector é o único ponto de variação

| Gabinete | `visando` | `para que realize` | `no sentido de` | outro |
|---|---:|---:|---:|---:|
| `marcio_pet` | 87,0% | 1,0% | 1,1% | 10,9% |
| `adriana_machado` | 98,3% | — | — | 1,7% |

O `docs/siscam-camara-guaruja.md` levantou `visando | para que realize` como as
duas opções, com base em 14 amostras. Em 1.897, `para que realize` aparece **13
vezes no total** — é resíduo, não alternativa. O prompt do `lib/ementa.ts` hoje
oferece as duas ao modelo com peso parecido; deveria oferecer `visando` como
padrão quase absoluto.

---

## Achado 2 — os dois gabinetes escrevem diferente, e dá para medir

O padrão da Casa achata a *estrutura*, mas não o *conteúdo*. As assinaturas são
nítidas:

| Marcador | `marcio_pet` | `adriana_machado` |
|---|---:|---:|
| "zeladoria" | 2 | **74** |
| "Santa Rosa" (bairro) | **396** | 3 |
| Cita nº do imóvel | 29,0% | 34,4% |
| Tamanho mediano da ementa | 181 car. | 201 car. |

- **Márcio é territorial.** 396 das 1.312 indicações (30%) citam Vila Santa Rosa.
  É um gabinete de base geográfica concentrada, e o vocabulário reflete isso:
  `bairro`, `ruas`, `roçada`, `troca`, `desentupimento`.
- **Adriana é temática.** "Operação de zeladoria" é praticamente uma marca dela —
  74 ocorrências contra 2 do Márcio. Ela também nomeia vias específicas com muito
  mais frequência (`Marechal Deodoro`, `Leomil`, `praia`) e escreve pedidos mais
  longos, com mais de um serviço na mesma ementa.

**O que isso significa:** o perfil de vereador em `lib/vereadores.ts` hoje é
escrito à mão a partir de leitura de 2 exemplos. Esses marcadores podem ser
derivados do corpus automaticamente — é o caminho para embarcar gabinete novo
sem curadoria manual.

---

## Achado 3 — o enum `tipos_servico` cobre menos da metade do que a Casa pede

Classificando as 1.897 ementas por regex contra o enum atual de
`lib/extract.ts`, **32,3%** (Márcio) e **38,6%** (Adriana) não caem em nenhuma
categoria — viram `outro`.

> Parte disso é limitação do classificador de regex usado na análise (ele erra
> "poda **da** árvore" e "podar", por exemplo), então o número real é menor. Mas
> a lista de categorias ausentes abaixo veio de leitura das amostras, não do
> regex, e essa é sólida.

Categorias que aparecem com volume relevante e **não existem** no enum:

| Categoria candidata | Márcio | Adriana | Evidência |
|---|---:|---:|---|
| `praca_area_lazer` | 9,7% | 8,5% | revitalização de praça, playground, quadra |
| `saude_educacao` | 4,8% | 10,1% | UBS, creche, campanha de saúde, dengue |
| `calcada_acessibilidade` | 4,1% | 5,8% | calçada, rampa, guia rebaixada |
| `manutencao_predial` | 1,8% | 4,6% | escada, pintura, muro, telhado |
| `transporte_publico` | 1,8% | 1,0% | ponto/abrigo de ônibus |
| `agua_saneamento` | 0,8% | 1,5% | SABESP, vazamento, abastecimento |
| `animais` | 0,6% | — | castração, zoonoses |

E três tipos de pedido que o modelo mental do Dipo não prevê de jeito nenhum:

1. **Zeladoria como pacote** — "operação de zeladoria com limpeza geral" agrega
   capinação + varrição + entulho + boca de lobo numa só indicação. Hoje o
   extractor devolveria 3–4 `tipos_servico` soltos e perderia o nome do serviço,
   que é como a Prefeitura o executa.
2. **Notificar terceiro** — "notificar a concessionária responsável pelos fios",
   "vistoria e retirada de cercamento irregular". O pedido não é executar um
   serviço, é acionar quem tem a obrigação.
3. **Propositura de política** — "criação do Programa Municipal de Incentivo…",
   "instituição de calendário permanente de campanhas de saúde", "Semana
   Municipal de Conscientização sobre o Vitiligo". Não tem endereço, não tem
   serviço; é matéria legislativa. O extractor hoje classificaria como
   `outros` e o gerador tentaria descrever um problema urbano inexistente.

O item 3 é o mais relevante: são as indicações de maior valor político do
gabinete, e são exatamente as que o produto atende pior.

---

## Achado 4 — o corpo do texto exige OCR

Confirmado o que o levantamento anterior indicava, agora com o arquivo na mão:

```
/Subtype/Image  /Width 1656  /Height 2339  CCITTFaxDecode  (×2 páginas)
```

Nenhuma fonte embarcada, nenhuma camada de texto. O PDF público é o scan do
papel assinado. As ementas — que estão em texto — cobrem **o que** foi pedido;
o corpo, que é o que o Dipo gera, só sai por OCR de imagem de fax a 200 DPI.

Os PDFs estão sendo baixados para `E:\Dipo\corpus-siscam\<slug>\anexos\`. A
decisão de OCR fica para a fase 2 — ver o roadmap.

---

## O que fazer com isso

Em ordem de retorno sobre esforço:

1. **Validar a ementa gerada contra a fórmula, não só confiar no modelo.**
   `lib/ementa.ts` já tem o prefixo como constante. Falta rejeitar/reparar a
   saída que não começa com ele e travar `visando` como conector padrão. Com
   99,5% de aderência medida, isso é uma regra, não uma heurística.
2. **Ampliar o enum `tipos_servico`** com as 7 categorias acima e criar a
   categoria `zeladoria` como serviço agregado.
3. **Tratar "propositura de política" como categoria de primeira classe** no
   extractor — sem endereço, sem serviço, com justificativa mais longa.
4. **Trocar o few-shot manual por amostragem do corpus**: em vez de 2 exemplos
   escritos à mão por gabinete, selecionar do corpus real as N ementas mais
   próximas do pedido do assessor. É o que valida se dá para embarcar gabinete
   novo sem curadoria — que é a pergunta comercial.
5. **Derivar o perfil do vereador do corpus** (bairros recorrentes, vocabulário,
   comprimento típico) em vez de escrever à mão.

Os itens 1–3 mexem em prompt que 4 gabinetes já usam em produção. Precisam de
comparação antes/depois com amostra real antes de subir — ver o roadmap.
