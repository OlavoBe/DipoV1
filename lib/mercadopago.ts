import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const PRECOS: Record<string, number> = {
  PRO_ASSESSOR: 97,
  PRO_GABINETE: 197,
};

const NOMES: Record<string, string> = {
  PRO_ASSESSOR: 'Dipo Pro Assessor — mensal',
  PRO_GABINETE: 'Dipo Pro Gabinete — mensal',
};

export async function createPreference(
  plano: string,
  tenantId: string,
  userEmail: string,
): Promise<{ id: string; init_point: string }> {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const preco = PRECOS[plano];
  if (!preco) throw new Error(`Plano inválido: ${plano}`);

  const preference = new Preference(client);
  const result = await preference.create({
    body: {
      items: [
        {
          id: plano,
          title: NOMES[plano] ?? plano,
          unit_price: preco,
          quantity: 1,
          currency_id: 'BRL',
        },
      ],
      payer: { email: userEmail },
      back_urls: {
        success: `${baseUrl}/upgrade/sucesso`,
        failure: `${baseUrl}/upgrade`,
        pending: `${baseUrl}/upgrade/pendente`,
      },
      auto_return: 'approved',
      metadata: { tenantId, plano },
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
    },
  });

  return { id: result.id!, init_point: result.init_point! };
}
