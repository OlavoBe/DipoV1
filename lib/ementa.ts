/**
 * Geração da ementa — o campo "Assunto" do protocolo.
 *
 * Ao protocolar no SISCAM, o assessor precisa de uma ementa que resuma a
 * indicação em uma frase. Até aqui o Dipo entregava o corpo do documento e
 * deixava a ementa para ele escrever à mão.
 *
 * A Câmara de Guarujá usa uma fórmula rigorosamente uniforme — 14 de 14 ementas
 * amostradas do gabinete, e igual entre todos os vereadores da mesma sessão
 * (ver docs/siscam-camara-guaruja.md):
 *
 *   Solicita do Executivo que determine à Secretaria competente,
 *   providências <visando | para que realize> <OBJETO>, <LOCALIZAÇÃO>.
 *
 * Por ser fórmula fixa, isto roda no modelo barato (o mesmo da extração) e
 * **em paralelo** com a geração do texto, não somando latência ao pipeline.
 * Também é deliberadamente independente do prompt de geração: mexer naquele
 * prompt afetaria o texto que os 4 gabinetes já recebem.
 */
import { callLLM } from './llm';
import type { ExtractedData } from './types';

export const PREFIXO_EMENTA = 'Solicita do Executivo que determine à Secretaria competente, providências';

/** Ementas reais do SISCAM, usadas como few-shot. */
const EXEMPLOS = [
  'Solicita do Executivo que determine à Secretaria competente, providências visando a instalação de 02 (dois) braços de iluminação pública com luminárias, em frente ao nº 925 da rua Ostreiras, Jardim dos Pássaros.',
  'Solicita do Executivo que determine à Secretaria competente, providências visando a realização de poda de árvores, em frente ao nº 122 da Av. Gino Fabris, Vila Santa Rosa.',
  'Solicita do Executivo que determine à Secretaria competente, providências visando a retirada de resíduos e entulhos na rua José Avelino de Oliveira, nº 318, Tombo.',
  'Solicita do Executivo que determine à Secretaria competente, providências visando o serviço de desentupimento e limpeza da rede de drenagem, galerias e bocas de lobo localizadas na Rua poeta Gonçalves Dias, Jardim Brasil II, Morrinhos.',
  'Solicita do Executivo que determine à Secretaria competente, providências para que realize o serviço de manutenção de calcetaria, nivelamento de solo e revisão do sistema de drenagem na Rua Brigadeiro Eduardo Gomes, no trecho entre os números 515 e 711, Jardim Santense, Vicente de Carvalho.',
  'Solicita do Executivo que determine à Secretaria competente, providências visando a instalação de redutor de velocidade, mediante estudo técnico de tráfego, na rua João Silveira, Vila Lígia.',
] as const;

function buildSystemPrompt(): string {
  return `Você redige a EMENTA de indicações legislativas da Câmara Municipal de Guarujá/SP.

A ementa é o campo "Assunto" do protocolo: UMA única frase que resume o pedido.

REGRA ABSOLUTA DE FORMATO — a frase SEMPRE começa exatamente com:
"${PREFIXO_EMENTA}"

Depois do prefixo vem:
  • o conector "visando" (padrão) ou "para que realize" (quando o pedido é um serviço de execução)
  • o OBJETO do pedido, em linguagem administrativa
  • a LOCALIZAÇÃO (rua, número, bairro), quando houver
  • ponto final

EXEMPLOS REAIS (siga este padrão à risca):
${EXEMPLOS.map((e) => `- ${e}`).join('\n')}

REGRAS:
- Responda APENAS com a ementa. Sem aspas, sem markdown, sem explicação.
- UMA frase só. Não use quebras de linha.
- Não invente endereço, número ou bairro que não tenha sido informado.
- Não inclua "À SECRETARIA PARA AS DEVIDAS PROVIDÊNCIAS" — isso a Casa acrescenta depois.
- Não inclua o número da indicação nem a data.
- Para pedidos sem localização (homenagem, estudo, programa), descreva só o objeto.`;
}

function buildUserPrompt(data: ExtractedData): string {
  const partes: string[] = [];

  partes.push(`Categoria: ${data.categoria}`);
  if (data.tema) partes.push(`Tema: ${data.tema}`);
  if (data.tipos_servico?.length) partes.push(`Tipos de serviço: ${data.tipos_servico.join(', ')}`);
  if (data.descricao_problema) partes.push(`Problema relatado: ${data.descricao_problema}`);
  if (data.providencias_sugeridas?.length) {
    partes.push(`Providências solicitadas:\n${data.providencias_sugeridas.map((p) => `- ${p}`).join('\n')}`);
  }

  const local: string[] = [];
  if (data.logradouro) local.push(data.logradouro);
  if (data.numero && data.numero !== 's/n') local.push(`nº ${data.numero}`);
  if (data.bairro) local.push(data.bairro);
  if (data.trecho_localizacao) local.push(data.trecho_localizacao);
  if (local.length) partes.push(`Localização: ${local.join(', ')}`);

  partes.push('\nEscreva a ementa.');
  return partes.join('\n');
}

/** Tira aspas, markdown, quebras de linha e prefixos que o modelo às vezes acrescenta. */
export function limparEmenta(bruto: string): string {
  let s = bruto.trim()
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  s = s.replace(/^(ementa|assunto)\s*:\s*/i, '');
  s = s.replace(/^["'“”«]+/, '').replace(/["'“”»]+$/, '').trim();

  // o despacho da Casa não faz parte da ementa
  s = s.replace(/\s*À SECRETARIA PARA AS DEVIDAS PROVID[ÊE]NCIAS\.?\s*$/i, '').trim();

  if (s && !s.endsWith('.')) s += '.';
  return s;
}

/**
 * Gera a ementa a partir dos dados extraídos.
 *
 * Nunca lança: a ementa é um complemento, e falha nela não pode derrubar a
 * geração da indicação. Em erro devolve string vazia e a UI simplesmente não
 * mostra o campo.
 */
export async function gerarEmenta(data: ExtractedData): Promise<string> {
  try {
    // temperature 0 — é preenchimento de fórmula, não redação criativa
    const bruto = await callLLM(buildSystemPrompt(), buildUserPrompt(data), 0);
    const ementa = limparEmenta(bruto);

    if (!ementa || ementa.length < 40) {
      console.warn('[ementa] resposta curta demais, descartando:', ementa);
      return '';
    }
    return ementa;
  } catch (err) {
    console.error('[ementa] falha ao gerar (ignorada):', err);
    return '';
  }
}
