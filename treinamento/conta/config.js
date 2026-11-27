/* ==========================================================================
   CONFIGURACAO DA AREA DO ALUNO

   modo "demonstracao": tudo fica no navegador, compra sem cobrar.
                        Bom para testar telas. NAO use com alunos reais.
   modo "firebase":     contas no servidor, pagamento pelo Mercado Pago,
                        horas e certificados gravados pelo servidor.

   Os dados de "firebase" sao PUBLICOS (aparecem no site de qualquer jeito):
   copie do console do Firebase > Configuracoes do projeto > Seus apps.
   O token do Mercado Pago NAO entra aqui - ele fica so no servidor.
   Passo a passo: servidor/LEIA-ME.md

   NA INTERNET o site roda sempre em "firebase" (contas e pagamento de verdade).
   NESTE COMPUTADOR (localhost) ele continua em "demonstracao", para testar as
   telas e o simulador sem mexer em conta de aluno nem cobrar ninguem.
   Para testar o modo de verdade aqui no computador, abra o console do
   navegador (F12) e rode:   localStorage.setItem("tpd_modo", "firebase")
   Para voltar:              localStorage.removeItem("tpd_modo")
   ========================================================================== */

var TPD_CONTA_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
var TPD_MODO_FORCADO = (function () {
  try { return TPD_CONTA_LOCAL ? localStorage.getItem("tpd_modo") : null; } catch (e) { return null; }
})();

window.TREINO_CONFIG = {
  protegerArquivos: !TPD_CONTA_LOCAL,
  modo: TPD_CONTA_LOCAL && TPD_MODO_FORCADO !== "firebase" ? "demonstracao" : "firebase",

  /* Projeto guridosdrones-treinamento (dados publicos do app Web "treinamento"). */
  firebase: {
    apiKey: "AIzaSyDELlE6eAF-wqlYaBSh1tmIxyd908wQWGc",
    /* 30/10/2026: o login do Google mora no proprio endereco do site (o Hosting serve /__/auth/handler).
       Com o login em outro endereco, o iPhone (icone da tela de inicio, navegador de outro app) perde o
       login no meio ("missing initial state"). Fora destes dois enderecos (localhost) fica o de sempre. */
    authDomain: /^guridosdrones-treinamento\.(web\.app|firebaseapp\.com)$/.test(location.hostname)
      ? location.hostname : "guridosdrones-treinamento.firebaseapp.com",
    projectId: "guridosdrones-treinamento",
    storageBucket: "guridosdrones-treinamento.firebasestorage.app",
    messagingSenderId: "730599607970",
    appId: "1:730599607970:web:8d1553858090bfa6aa51fb",
  },
  regiao: "southamerica-east1",

  /* Chaves PUBLICAS de pagamento (11/10/2026: pagar sem sair do site). Sao feitas para ficar na pagina;
     as secretas ficam so no servidor. Vazia = o pagamento vai para a pagina do Mercado Pago / Stripe. */
  pagamento: {
    mercadoPagoPublicKey: "APP_USR-f9933ab5-d59e-474b-8f49-f0b4734d375b",   // Public Key de producao, aplicacao "Treinamento Guri dos Drones" (4339960017180496)
    stripePublicKey: "pk_live_51UNnM4KAJTzMom2aPNEfU7cXxXrGpHNRX5UPRwxVNSkQUuNNDfp09V6ql9SZaXwFfhV7KMLFabjH8wUVd1b1pADV00sIUZRxZ9",
  },

  /* Link do APK do aplicativo do controle. Vazio = botao "em breve". */
  apkUrl: "/treinamento/apk/controle-simulador.apk",   // APK do RC Plus (ferramentas/publicar_apk_controle.py)

  /* Link para baixar o Gerador de Mapas Reais (o instalador do programa).
     Aparece em conta/gerar.html. Vazio = botao "em breve". */
  geradorUrl: "https://guridosdrones-treinamento.web.app/treinamento/downloads/GeradorDeMapasReais.zip",

  /* Quem oferece o servico: aparece em conta/termos.html (termos de uso,
     privacidade e devolucao). Preencha antes de divulgar o site. */
  juridico: {
    versao: "6 de outubro de 2026",
    responsavel: "Guri dos Drones Ltda.",   // razao social
    documento: "CNPJ 60.335.388/0001-03",
    endereco: "Coronel Bicaco - RS",
    suporteEmail: "guridosdrones@gmail.com",
    suporteWhatsapp: "5555996898432", // DDI 55 + DDD 55 + numero, so numeros
  },

  /* So para testes locais com "firebase emulators:start". */
  emulador: false,
};
