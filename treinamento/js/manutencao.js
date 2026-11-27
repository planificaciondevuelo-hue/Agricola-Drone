/* TROCA DE TELA RÁPIDA (12/11/2026, Eduardo: "tô achando muito lenta a troca de tela... dá a aparecer que ficou mal feito").
   Fica aqui porque todas as páginas do site carregam este arquivo no <head>, antes de desenhar:
   1. Transição entre páginas (Chrome/Edge 126+, Safari 18.2+): a tela antiga se desfaz na nova, sem piscar em branco.
      Navegador antigo ignora a regra.
   2. Pré-carregar a próxima tela da área do aluno (Chrome/Edge): quando o cursor para num link (ou o dedo encosta, no celular),
      o navegador já monta a página escondida (Firebase, conta, tudo); ao clicar ela aparece na hora. Fica de fora o que não
      pode rodar sem o aluno pedir: simulador, painel do administrador, contabilidade, painel da escola e links com "?" ou
      para outra aba. Navegador sem suporte ignora. */
(function () {
  'use strict';
  try {
    var transicao = document.createElement('style');
    transicao.textContent = '@view-transition{navigation:auto}' +
      '::view-transition-old(root),::view-transition-new(root){animation-duration:.18s}';
    document.head.appendChild(transicao);
    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
      var regras = document.createElement('script');
      regras.type = 'speculationrules';
      regras.textContent = JSON.stringify({ prerender: [{ source: 'document', eagerness: 'moderate', where: { and: [
        { href_matches: '/treinamento/conta/*.html' },
        { not: { selector_matches: 'a[href*="?"],a[href*="admin"],a[href*="contabilidade"],a[href*="empresa"],[target=_blank],[download],[data-sem-precarregar]' } }
      ] } }] });
      document.head.appendChild(regras);
    }
  } catch (e) { /* navegador antigo: troca de página normal */ }
})();
/* PACOTE DE DADOS DO SIMULADOR NO APARELHO (15/11/2026, Eduardo: "pra pessoa baixar um pacote de dados... para não acontecer
   esses erros na internet ruim"). Liga o guarda-arquivos treinamento/sw-pacote.js (as regras estão no topo dele) só para o
   simulador, o campo e o controle; a área do aluno não passa por ele. Registrado daqui porque todas as páginas carregam
   este arquivo: quando o aluno chega ao simulador o guarda-arquivos já está pronto. No localhost fica desligado (arquivo
   editado tem de aparecer na hora); para testar lá: localStorage.xg_pacote_local = "1". */
(function () {
  'use strict';
  try {
    if (!('serviceWorker' in navigator) || !window.caches || window.top !== window) return;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && localStorage.getItem('xg_pacote_local') !== '1') return;
    var ligar = function () {
      // Só registra o que falta: registrar de novo a cada página faria o navegador reconferir o arquivo em toda troca de
      // tela. A versão nova do guarda-arquivos o navegador busca sozinho quando o simulador abre.
      ['/treinamento/sim', '/treinamento/campo/', '/treinamento/controle'].forEach(function (escopo) {
        navigator.serviceWorker.getRegistration(escopo).then(function (ja) {
          if (!ja) return navigator.serviceWorker.register('/treinamento/sw-pacote.js', { scope: escopo, updateViaCache: 'none' });
        }).catch(function () {});
      });
    };
    if (document.readyState === 'complete') ligar(); else window.addEventListener('load', ligar);
  } catch (e) { /* sem guarda-arquivos: o simulador baixa tudo do servidor, como antes */ }
})();
(function () {
  'use strict';
  // O modo local não consulta nem altera o site publicado.
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  var pagina = location.pathname;
  var destino = '/treinamento/manutencao.html';
  var admin = pagina === '/treinamento/conta/admin.html';
  var loginAdmin = pagina === '/treinamento/conta/index.html' &&
    new URLSearchParams(location.search).get('volta') === '/treinamento/conta/admin.html';
  if (admin || loginAdmin) return; // As funções e regras verificam a identidade no servidor.
  var espera = document.createElement('style');
  espera.textContent = 'body{visibility:hidden!important}';
  /* 25/10/2026 (troca de página lenta): a página ficava invisível até a função responder, em TODA troca
     de página. Se esta aba já viu o site liberado há menos de 1 minuto, a página aparece na hora e a
     consulta continua por trás: se a manutenção tiver começado, ela leva à tela de manutenção do mesmo
     jeito (a trava de verdade é a das funções e regras, no servidor). A primeira página da aba, e
     qualquer uma depois de 1 minuto, continuam esperando a resposta. */
  var CHAVE_LIBERADO = 'tpd_manutencao_liberado_em', VALIDADE_LIBERADO = 60000;
  function liberadoHaPouco() {
    try {
      var idade = Date.now() - Number(sessionStorage.getItem(CHAVE_LIBERADO));
      return idade >= 0 && idade < VALIDADE_LIBERADO;
    } catch (e) { return false; }
  }
  function lembrarLiberado(liberado) {
    try {
      if (liberado) sessionStorage.setItem(CHAVE_LIBERADO, String(Date.now()));
      else sessionStorage.removeItem(CHAVE_LIBERADO);
    } catch (e) { /* sem sessionStorage: a página só espera a consulta, como antes */ }
  }
  if (pagina !== destino && !liberadoHaPouco()) document.head.appendChild(espera);
  var consultando = false;
  function bloquear(url) {
    try { if (window.PAUSA_SIM) window.PAUSA_SIM.definir(true); } catch (_) {}
    location.replace(url);
  }
  /* 08/10/2026: no celular o site ficava piscando entre a página e a manutenção.
     Quando a página troca de endereço sozinha (início -> login -> área do aluno), o
     navegador cancela esta consulta no meio, e o cancelamento era tratado como
     "não consegui verificar" -> manutenção -> volta -> cancela de novo... Agora uma
     falha é repetida mais 2 vezes, com pausa: se a página estiver saindo, a nova
     tentativa nem acontece. Continua fechado: 3 falhas seguidas bloqueiam.
     AbortSignal.timeout não existe em navegadores de celular mais antigos. */
  function consultar() {
    var url = 'https://southamerica-east1-guridosdrones-treinamento.cloudfunctions.net/estadoManutencao';
    var opcoes = { cache: 'no-store' }, relogio = null;
    if (typeof AbortController === 'function') {
      var controle = new AbortController();
      relogio = setTimeout(function () { controle.abort(); }, 10000);
      opcoes.signal = controle.signal;
    }
    return fetch(url, opcoes).then(function (r) {
      if (!r.ok) throw new Error('consulta');
      return r.json();
    }).then(function (estado) {
      if (typeof estado.ativa !== 'boolean') throw new Error('estado');
      return estado;
    }).finally(function () { if (relogio) clearTimeout(relogio); });
  }
  function pausa(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function conferir() {
    if (consultando) return;
    consultando = true;
    try {
      var estado = null;
      for (var tentativa = 0; tentativa < 3 && !estado; tentativa++) {
        if (tentativa) await pausa(1500 * tentativa);
        try { estado = await consultar(); } catch (e) { estado = null; }
      }
      if (!estado) {
        // Não liberar o sistema sem conseguir verificar o bloqueio.
        lembrarLiberado(false);
        if (pagina !== destino) bloquear(destino + '?conexao=1');
        else {
          var aviso = document.getElementById('situacao');
          if (aviso) aviso.textContent = 'Não foi possível verificar a disponibilidade. Tentaremos novamente em instantes.';
        }
        return;
      }
      lembrarLiberado(!estado.ativa);
      if (estado.ativa && pagina !== destino) { bloquear(destino); return; }
      if (!estado.ativa && pagina === destino) { location.replace('/'); return; }
      espera.remove();
    } finally { consultando = false; }
  }
  conferir();
  setInterval(conferir, 10000);
  /* O pageshow também dispara na carga normal (e repetia a consulta logo depois da primeira);
     só interessa quando a página volta do cache de voltar/avançar. */
  window.addEventListener('pageshow', function (ev) { if (ev.persisted) conferir(); });
  window.addEventListener('online', conferir);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) conferir(); });
})();
