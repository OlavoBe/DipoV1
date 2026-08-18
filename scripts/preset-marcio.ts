/**
 * Preset do Gabinete Márcio do Pet Shop.
 *
 * Medidas e textos extraídos do .docx/.pdf reais do gabinete
 * (tests/fixtures/referencia/) — ver docs/especificacao-gabinete-marcio.md.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_SETTINGS, type TemplateSettings } from '../lib/template';

const RAIZ = join(__dirname, '..');

function dataUri(caminho: string, mime: string): string {
  return `data:${mime};base64,${readFileSync(join(RAIZ, caminho)).toString('base64')}`;
}

export const TEMPLATE_MARCIO: TemplateSettings = {
  ...DEFAULT_SETTINGS,
  layoutId: 'brasao_esquerda',
  institution: {
    name: 'Câmara Municipal de Guarujá',
    title: 'ESTADO DE SÃO PAULO',
    subtitle: 'Márcio Nabor Tardelli',
    gabinete: 'Gabinete do Vereador MÁRCIO DO PET SHOP',
    email: 'Marcio@camaraguaruja.sp.gov.br',
  },
  vereador: {
    nome: 'MÁRCIO NABOR TARDELLI',
    cargo: 'Vereador',
    salaLocal: 'Sala Alberto Santos Dumont',
    nomePrefeito: 'Farid Said Madi',
  },
  logos: {
    ...DEFAULT_SETTINGS.logos,
    left: dataUri('assets/gabinetes/marcio_pet/brasao.png', 'image/png'),
    partido: dataUri('assets/gabinetes/marcio_pet/partido.jpg', 'image/jpeg'),
  },
  typography: {
    ...DEFAULT_SETTINGS.typography,
    fontFamily: "'Bookman Old Style', serif",
    fontFamilyCabecalho: "'Times New Roman', Times, serif",
    fontSize: 12,
    lineHeight: 1.15,
    paragraphSpacing: 6,
  },
  layout: { marginLateral: 31.7, marginTopBottom: 25.4 },
};

/** Texto do documento de referência, para comparação lado a lado. */
export const TEXTO_REFERENCIA = [
  'SENHOR PRESIDENTE,\nSENHORAS VEREADORAS,\nSENHORES VEREADORES.',
  'Fomos procurados por moradores que denunciaram o cercamento irregular de uma área pública localizada na Avenida Manoel Albino, com fundos para a Avenida Helena Maria, nos lotes 04, 05 e 06. Tal cercamento, realizado por particulares, está impedindo o uso livre do espaço pela população, além de prejudicar o ordenamento urbano da região.',
  'A área em questão pertence ao patrimônio municipal, e a ocupação é considerada indevida, sendo necessário que o Município exerça seu poder de polícia administrativa para garantir o uso adequado do espaço público.',
  'Diante disso, apresento a esta Casa de Leis a seguinte:',
  'INDICAÇÃO Nº _____ /2026',
  'Indico à Mesa, nos termos regimentais, que seja oficiado ao Excelentíssimo Senhor Prefeito Municipal de Guarujá, Farid Said Madi, para que determine ao setor competente:',
  '1. Fiscalização de Posturas;\n2. Regularização Fundiária;\n3. Vistoria no local;\n4. Retirada do cercamento;\n5. Restabelecimento da área para uso público.',
  'Sala Alberto Santos Dumont, 11 de agosto de 2026.',
].join('\n\n');
