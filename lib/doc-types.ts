/**
 * Estrutura semântica de uma indicação legislativa.
 *
 * Hoje a LLM devolve texto plano e o gerador de PDF envolve tudo em `<p>`
 * genérico — o que impede estilizar vocativo, título, providências e fecho de
 * forma diferente, que é exatamente o que distingue o documento de cada
 * gabinete.
 *
 * `IndicacaoDoc` separa o conteúdo da apresentação: aqui é só dado, sem nenhuma
 * decisão de layout. Quem decide se o vocativo é negrito ou caixa alta é o
 * layout, não o conteúdo.
 *
 * A assinatura não vem do texto gerado — vem do template do gabinete.
 */
import { z } from 'zod';

export interface IndicacaoDoc {
  /** Linhas do vocativo ("Sr. Presidente," / "Sras. Vereadoras e" / ...). */
  vocativo: string[];
  /** Parágrafos entre o vocativo e o título. Vazio em gabinetes que vão direto ao título. */
  preambulo: string[];
  /** Número da indicação; `null` quando fica em branco para o protocolo preencher. */
  tituloNumero: string | null;
  tituloAno: number;
  /** Parágrafos após o título e antes das providências. */
  corpo: string[];
  /** Itens numerados. Vazio quando o gabinete escreve tudo em parágrafo corrido. */
  providencias: string[];
  /** Parágrafos finais, entre as providências e o local/data. */
  fecho: string[];
  /** Local da sessão, como aparece no documento (preserva a caixa do original). */
  local: string;
  data: Date | null;
  assinaturaNome: string;
  assinaturaCargo: string;
}

export const IndicacaoDocSchema = z.object({
  vocativo: z.array(z.string()).default([]),
  preambulo: z.array(z.string()).default([]),
  tituloNumero: z.string().nullable().default(null),
  tituloAno: z.number().int().default(() => new Date().getFullYear()),
  corpo: z.array(z.string()).default([]),
  providencias: z.array(z.string()).default([]),
  fecho: z.array(z.string()).default([]),
  local: z.string().default(''),
  data: z.date().nullable().default(null),
  assinaturaNome: z.string().default(''),
  assinaturaCargo: z.string().default('Vereador'),
});

export const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

/** Formata uma data como "13 de abril de 2026". */
export function formatarDataExtenso(data: Date): string {
  return `${data.getDate()} de ${MESES_PT[data.getMonth()]} de ${data.getFullYear()}`;
}
