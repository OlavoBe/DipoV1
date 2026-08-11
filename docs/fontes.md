# Fontes do PDF

## Por que não usamos as fontes originais

Os documentos dos gabinetes usam **Bookman Old Style** e **Times New Roman**, que
pertencem à Monotype/Microsoft e são licenciadas para uso local junto com o
Windows/Office. Embarcar esses arquivos num SaaS que gera documentos para
terceiros é uso não licenciado. Num produto vendido para câmaras municipais, não
vale o risco.

## Substitutas embarcadas

| Original | Substituta | Nome interno | Licença |
|---|---|---|---|
| Bookman Old Style | TeX Gyre Bonum | `Dipo Bookman` | GUST Font License (LPPL) — uso comercial livre |
| Times New Roman | Tinos | `Dipo Times` | Apache 2.0 |

TeX Gyre Bonum descende da URW Bookman L, derivada do desenho de Alexander
Phemister que originou o Bookman Old Style. Tinos é metricamente compatível com
Times New Roman.

Não são clones métricos exatos — por isso a calibração contra o documento real
é necessária (ver `docs/especificacao-gabinete-marcio.md`).

## No PDF embarcamos; no DOCX referenciamos

A distinção é intencional e importante:

- **PDF** — a fonte é embutida no arquivo. Precisa ser livre → usamos as substitutas.
- **DOCX** — o arquivo apenas cita o nome da fonte; quem renderiza é o Word do
  assessor, que tem as originais instaladas. Pode citar `Bookman Old Style`.

Ou seja, o documento impresso a partir do Word sai com a fonte original de verdade.

## Arquitetura

```
assets/fonts/*.woff2          ← versionados no repositório
        ↓  npm run build:fonts
lib/fonts.generated.ts        ← base64, também versionado (~420KB)
        ↓
lib/fonts.ts                  ← buildFontFaceCss()
        ↓
lib/pdf.ts                    ← injeta no <style> do HTML
```

As fontes são injetadas como **data URI** dentro do próprio HTML. Nada de `<link>`
para arquivo externo: uma requisição de rede dentro da função serverless é
exatamente o que reintroduz o fallback silencioso que estamos evitando.

`lib/fonts.generated.ts` é gerado, mas **fica versionado** — assim o build não
depende dos `.woff2` estarem presentes nem de rodar o script.

## Como regerar

Só é necessário ao trocar ou acrescentar uma fonte.

```bash
npm run build:fonts
```

### Se precisar baixar as fontes de novo

**TeX Gyre Bonum** — OTF do CTAN, convertidos para woff2:

```bash
BASE="https://mirrors.ctan.org/fonts/tex-gyre/opentype"
for f in regular bold italic bolditalic; do
  curl -sL -o "texgyrebonum-$f.otf" "$BASE/texgyrebonum-$f.otf"
done
# converter com wawoff2 (npm i --no-save wawoff2), salvar como
# assets/fonts/bonum-{400,700}-{normal,italic}.woff2
```

**Tinos** — já vem em woff2 subsetado:

```bash
npm i --no-save @fontsource/tinos
# copiar node_modules/@fontsource/tinos/files/tinos-latin-{400,700}-{normal,italic}.woff2
# para assets/fonts/tinos-{400,700}-{normal,italic}.woff2
```

Nenhum dos dois pacotes precisa ficar como dependência: os `.woff2` finais são
versionados.

## Como conferir que funcionou

```bash
npm run verify:pdf
```

A linha `fontes no PDF` lista o que foi realmente embarcado. Se aparecer o nome
de uma fonte que você não configurou, houve fallback silencioso.

`tests/unit/fonts.test.ts` trava a presença das 8 variantes, o formato data URI
e a ausência de qualquer URL de rede no CSS.
