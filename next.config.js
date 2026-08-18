/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15+ usa serverExternalPackages (renomeado de experimental.serverComponentsExternalPackages)
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium', '@prisma/client', 'prisma'],


  // O @sparticuz/chromium carrega o navegador a partir de arquivos brotli em
  // bin/ (chromium.br, swiftshader, fontes). Eles nao sao alcancaveis por
  // import, entao o rastreamento de dependencias do Next nao os inclui no
  // bundle — a funcao sobe sem o binario e a geracao de PDF falha com:
  //
  //   The input directory "/var/task/node_modules/@sparticuz/chromium/bin"
  //   does not exist. Please provide the location of the brotli files.
  //
  // Declarado so nas duas rotas que geram PDF, para nao carregar ~66MB em
  // todas as funcoes.
  outputFileTracingIncludes: {
    '/api/pdf/[id]': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/demo': ['node_modules/@sparticuz/chromium/bin/**'],
  },
  // Define o root do Turbopack para evitar aviso de workspace
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
