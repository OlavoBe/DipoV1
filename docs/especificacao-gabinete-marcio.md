# Especificação tipográfica — Gabinete Márcio do Pet Shop

Valores **extraídos do XML** do documento de referência
(`Rua do Adubo para governo estadual.docx`, fevereiro/2026), não estimados.

Use como fonte de verdade ao calibrar o layout. Onde o guia de implementação
trazia estimativas, elas divergem — a tabela de divergências está no final.

---

## Página (`w:sectPr/w:pgMar`)

| Medida | Twips | Milímetros |
|---|---:|---:|
| Superior | 3228 | **56,9mm** |
| Inferior | 1440 | **25,4mm** |
| Esquerda | 1797 | **31,7mm** |
| Direita | 1797 | **31,7mm** |
| Distância do cabeçalho ao topo | 737 | 13,0mm |
| Distância do rodapé à base | 303 | 5,3mm |

Tamanho: A4 (210 × 297mm).

> A margem superior de 56,9mm é grande porque reserva o espaço do cabeçalho,
> que fica a 13mm do topo. O corpo começa abaixo dele.

## Fontes

| Região | Fonte | Como está declarada |
|---|---|---|
| Corpo | **Bookman Old Style** | `w:rFonts w:ascii` explícito, 50 ocorrências |
| Cabeçalho | **Times New Roman** | herda de `docDefaults` — o estilo `Cabealho` não declara fonte |

Isso confirma a necessidade das duas famílias. As substitutas livres embarcadas
são `Dipo Bookman` (TeX Gyre Bonum) e `Dipo Times` (Tinos) — ver `docs/fontes.md`.

## Cabeçalho (`header1.xml`)

Todo centralizado. Brasão **flutuante** (`wp:anchor`), 25,7 × 28mm.

| Linha | Tamanho | Estilo |
|---|---:|---|
| `Câmara Municipal de Guarujá` | 26pt | bold + italic |
| `ESTADO DE SÃO PAULO` | 12pt | italic |
| `Márcio Nabor Tardelli` | 20pt | bold + italic |
| `Gabinete do Vereador MÁRCIO DO PET SHOP` | 12pt | bold + italic |
| `Marcio@camaraguaruja.sp.gov.br` | 12pt | italic |

## Corpo

| Bloco | Tamanho | Alinhamento | Recuo | Estilo |
|---|---:|---|---|---|
| Vocativo (3 linhas) | 13pt | esquerda | 1ª linha 0 | bold, caixa alta no texto |
| Parágrafos do preâmbulo | herda | **justificado** | 1ª linha 12,7mm | — |
| Título `INDICAÇÃO Nº _____ /2026` | 16pt | centro | — | bold, 6pt depois |
| `Indico à Mesa...` | herda | **esquerda** | 1ª linha 12,7mm | — |
| Providências numeradas | herda | esquerda | bloco 12,7mm | numeração literal no texto (`1.`, `2.`…) |
| `Sala Alberto Santos Dumont, <data>.` | 14pt | centro | — | — |
| Linha de assinatura | 16pt | centro | — | underscores literais `___…` |
| `MÁRCIO NABOR TARDELLI` | 14pt | centro | — | bold |
| `Vereador` | 14pt | centro | — | bold |

Logo do partido: no **corpo** (não no rodapé), centralizado, 42 × 15mm.
Rodapé (`footer1.xml`) está vazio.

O recuo de 12,7mm é exatamente 0,5 polegada (720 twips) — o padrão do Word.

---

## Divergências em relação ao guia de implementação

O guia trazia "valores iniciais para calibrar". Medidos, ficaram assim:

| Item | Guia | Real | Δ |
|---|---:|---:|---|
| Margens laterais | 25mm | 31,7mm | +27% |
| Margem superior | 20mm | 56,9mm | +185% |
| Margem inferior | 20mm | 25,4mm | +27% |
| Vocativo | 12pt | 13pt | +1pt |
| Título | 14pt | 16pt | +2pt |
| Local/data | 12pt | 14pt | +2pt |
| Assinatura (nome) | 12pt | 14pt | +2pt |
| Cabeçalho — Câmara | 20pt | 26pt | +6pt |
| Cabeçalho — vereador | 15pt | 20pt | +5pt |
| Cabeçalho — gabinete | 9pt | 12pt | +3pt |
| Cabeçalho — e-mail | 8,5pt | 12pt | +3,5pt |
| Recuo de 1ª linha | 12,5mm | 12,7mm | ~igual |
| Posição do brasão | à esquerda | centralizado (flutuante) | difere |
| Logo do partido | rodapé | corpo | difere |

O guia subestimou praticamente todos os tamanhos, e a estrutura do cabeçalho é
centralizada — não com brasão à esquerda. **Adotar os valores desta página**, não
os do guia, ao implementar o layout.

## Pontos que ainda dependem de decisão

- **Alinhamento inconsistente no original:** o preâmbulo é justificado, mas o
  parágrafo `Indico à Mesa...` está alinhado à esquerda. Pode ser intencional ou
  descuido de quem editou. Confirmar com o assessor antes de reproduzir.
- **Tamanho do corpo:** os parágrafos comuns não declaram `w:sz`, então herdam o
  padrão do documento. Confirmar visualmente contra o PDF na calibração.
- **Linha de assinatura:** no original são underscores literais. Em HTML,
  `border-top` dá um resultado mais limpo e previsível — decidir qual seguir.

## Como reproduzir esta extração

```bash
# o .docx é um zip
unzip -o "modelo.docx" -d /tmp/docx
# word/document.xml   corpo e formatação inline
# word/header1.xml    cabeçalho
# word/styles.xml     docDefaults e estilos
# word/media/         brasão e logos
```

Conversões: `w:sz` é meio-ponto (26 = 13pt) · twips → mm = `t / 1440 * 25.4` ·
EMU → mm = `e / 36000`.
