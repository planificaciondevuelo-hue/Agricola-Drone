/* Condicoes simuladas, compartilhadas por todos os modelos. Nao e previsao do tempo. */
window.METEOROLOGIA = (function () {
  'use strict';
  // Autossuficiente para injecao no campo. Estado inteiro salvo em xgPulv.vento.
  function avancar(w, dt) {
    /* 24/10/2026: opcao "Vento" da tela inicial (vento_opcao.js): desligado, o vento nao existe (nao leva produto nem aeronave) */
    if (w.desligado) { w.vel = 0; w.rajada = 0; if (Array.isArray(w.picos)) w.picos.length = 0; return; }
    if (!(dt > 0) || w.dinamico === false) return;
    if (!Number.isFinite(w.base)) w.base = Math.max(0, Number(w.vel) || 0);
    if (!Number.isFinite(w.direcaoBase)) w.direcaoBase = Number(w.dir) || 0;
    if (!Number.isFinite(w.extra)) w.extra = 2;
    w.tempo = (Number(w.tempo) || 0) + dt;
    var t = w.tempo;
    /* 26/10/2026 (pedido do Eduardo): "Personalizar" (vento_opcao.js): ate 5 VARIACOES, cada uma com direcao, vento constante e rajadas, e o
       tempo (de operacao) em que ela comeca. w.programa = [{ t: segundos, dir: rad (a mesma convencao de w.dir), vel: m/s, raj: m/s }], a 1a com t = 0.
       Cada mudanca e GRADUAL: do valor da variacao anterior ao da nova ao longo de ate 2 minutos (w.transicao), nunca mais que o intervalo ate a proxima
       (assim uma mudanca termina antes da seguinte comecar) e com partida e chegada suaves; a direcao gira pelo caminho mais curto.
       Vento = vento constante + rajadas (o pulso de rajada de antes, a cada ~37 s); a direcao e exata, sem a oscilacao de +-8 graus. */
    if (Array.isArray(w.programa) && w.programa.length) {
      var Pg = w.programa, ia = 0;
      for (var ik = 1; ik < Pg.length; ik++) if (t >= Pg[ik].t) ia = ik;
      var cur = Pg[ia], ant = ia > 0 ? Pg[ia - 1] : cur, f = 1;
      if (ia > 0) {
        var durMax = Number(w.transicao) > 0 ? Number(w.transicao) : 120;
        var folga = ia + 1 < Pg.length ? Pg[ia + 1].t - cur.t : durMax;
        var dur = Math.max(1, Math.min(durMax, folga));
        f = Math.min(1, Math.max(0, (t - cur.t) / dur)); f = f * f * (3 - 2 * f);
      }
      var giro = cur.dir - ant.dir; giro = ((giro + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      var pulsoP = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 / 37 - .8)), 6);
      w.dir = ant.dir + giro * f;
      w.direcaoBase = w.dir;
      w.vel = Math.max(0, (ant.vel + (cur.vel - ant.vel) * f) + Math.max(0, ant.raj + (cur.raj - ant.raj) * f) * pulsoP);
      if (!Array.isArray(w.picos)) w.picos = [];
      if (!w.picos.length || t - w.picos[w.picos.length - 1][0] >= .25) w.picos.push([t, w.vel]);
      while (w.picos.length && w.picos[0][0] < t - 30) w.picos.shift();
      w.rajada = w.picos.reduce(function (m, p) { return Math.max(m, p[1]); }, w.vel);
      return;
    }
    /* 26/10/2026 (pedido do Eduardo): "Direção: muda durante a operação" (vento_opcao.js, w.muda). De tempos em tempos o vento VIRA de 25 a 75 graus,
       para um lado ou para o outro, devagar (3 graus por segundo): a primeira virada vem entre 50 e 120 s de operacao e as outras a cada 90 a 240 s.
       A funcao e enviada ao campo como texto: nada de fora dela. */
    if (w.muda) {
      if (!Number.isFinite(w.proxVirada)) w.proxVirada = t + 50 + Math.random() * 70;
      if (!Number.isFinite(w.dirInicial)) w.dirInicial = w.direcaoBase;
      if (t >= w.proxVirada) {
        /* sorteia o lado; passando de ~57 graus da direcao inicial a virada volta para ela, e nunca passa de ~69 graus (uma hora de vento real nao gira 300 graus) */
        var atual = (Number.isFinite(w.alvoDir) ? w.alvoDir : w.direcaoBase), desvio = atual - w.dirInicial;
        var sinal = desvio > 1 ? -1 : desvio < -1 ? 1 : (Math.random() < .5 ? -1 : 1);
        w.alvoDir = Math.max(w.dirInicial - 1.2, Math.min(w.dirInicial + 1.2, atual + sinal * (25 + Math.random() * 50) * Math.PI / 180));
        w.proxVirada = t + 90 + Math.random() * 150;
      }
      if (Number.isFinite(w.alvoDir)) {
        var falta = w.alvoDir - w.direcaoBase, passo = 3 * Math.PI / 180 * dt;
        w.direcaoBase += Math.abs(falta) <= passo ? falta : (falta > 0 ? passo : -passo);
      }
    }
    // Lenta reducao do vento entre pulsos suaves de rajada, sem saltos por quadro.
    var pulso = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 / 37 - .8)), 6);
    w.vel = Math.max(0, w.base * (.72 + .28 * Math.cos(t / 13)) + Math.max(0, w.extra) * pulso);
    w.dir = w.direcaoBase + .14 * Math.sin(t / 29);
    if (!Array.isArray(w.picos)) w.picos = [];
    if (!w.picos.length || t - w.picos[w.picos.length - 1][0] >= .25) w.picos.push([t, w.vel]);
    while (w.picos.length && w.picos[0][0] < t - 30) w.picos.shift();
    w.rajada = w.picos.reduce(function (m, p) { return Math.max(m, p[1]); }, w.vel);
  }
  function origem(dir) {
    // No campo, +X=leste e +Z=sul. Exibimos origem, nao destino do vetor.
    var graus = ((dir * 180 / Math.PI + 270) % 360 + 360) % 360;
    return { graus: Math.round(graus) % 360, ponto: ['N','NE','L','SE','S','SO','O','NO'][Math.round(graus / 45) % 8] };
  }
  function anguloSeta(dir, frenteX, frenteZ, cimaX, cimaZ) {
    // Azimute da camera; olhando verticalmente, o topo da tela define a frente.
    if (Math.hypot(frenteX, frenteZ) < .001) { frenteX = cimaX; frenteZ = cimaZ; }
    var n = Math.hypot(frenteX, frenteZ);
    if (!(n > .000001)) return 0;
    frenteX /= n; frenteZ /= n;
    var x = -Math.cos(dir), z = -Math.sin(dir); // origem do vento
    return Math.atan2(x * -frenteZ + z * frenteX, x * frenteX + z * frenteZ);
  }
  function iniciarPainel() {
    if (!location.pathname.endsWith('/sim.html') || document.getElementById('meteorologia')) return;
    var css = document.createElement('style');
    css.textContent = '#meteorologia{position:fixed;z-index:45;top:2px;left:50%;transform:translateX(-50%);width:min(530px,calc(100% - 24px));box-sizing:border-box;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:5px 10px;border:1px solid #61746a;border-radius:9px;background:#14231feb;color:#f2f6f3;font:12px/1.2 system-ui;pointer-events:none}' +
      '#meteorologia .vento-seta{display:block;width:16px;height:16px;color:#a9e879;transform-origin:center}#meteorologia [data-clima="direcao"]{display:block;height:14px}' +
      '#meteorologia[hidden]{display:none}#meteorologia span{display:block;color:#bdcbc3;font-size:10px;margin-bottom:2px}#meteorologia b{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '@media(max-width:600px),(pointer:coarse){#meteorologia{top:58px;width:calc(100% - 16px);max-width:530px;font-size:10px;gap:3px;padding:5px}#meteorologia span{font-size:9px}}';
    document.head.appendChild(css);
    var painel = document.createElement('section'); painel.id = 'meteorologia'; painel.hidden = true;
    painel.setAttribute('aria-label', 'Condições meteorológicas simuladas');
    painel.innerHTML = '<div title="Para onde o vento leva o produto"><span>Vento para</span><b data-clima="direcao" role="img"><svg class="vento-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 12h6v10h6V12h6Z" fill="currentColor"/></svg></b></div>' +
      '<div><span>Vento</span><b data-clima="vento"></b></div>' +
      '<div title="Pico dos últimos 30 segundos simulados"><span>Rajada · 30 s</span><b data-clima="rajada"></b></div>' +
      '<div><span>Temperatura</span><b data-clima="temperatura"></b></div>' +
      '<div><span>Umidade</span><b data-clima="umidade"></b></div>';
    document.body.appendChild(painel);
    function atualizar() {
      var f = document.getElementById('campo'), x;
      try { x = f && f.contentWindow.xgPulv; } catch (_) { return; }
      var carga = document.getElementById('carregando');
      painel.hidden = !x || !!(carga && !carga.classList.contains('esconder')) || !!(x.vento && x.vento.desligado);   /* vento desligado: sem painel de clima */
      if (!x) return;
      var w = x.vento, d = origem(w.dir);
      painel.querySelector('[data-clima="direcao"]').setAttribute('aria-label', 'Vento vindo de ' + d.ponto + ' ' + d.graus + ' graus; a seta mostra para onde ele leva o produto, em relação à câmera');
      var numero = function (n) { return Number(n).toFixed(1).replace('.', ','); };
      var valores = { vento: numero(w.vel * 3.6) + ' km/h',
        rajada: numero(Math.max(w.vel, w.rajada || 0) * 3.6) + ' km/h',
        temperatura: numero(w.temperatura) + ' °C', umidade: Math.round(w.umidade) + '%' };
      Object.keys(valores).forEach(function (k) { painel.querySelector('[data-clima="' + k + '"]').textContent = valores[k]; });
      // O selo de tempo muda de posicao no celular e em tela cheia.
      painel.style.top = '2px';
      var medidor = document.getElementById('medidor');
      if (medidor) {
        var a = painel.getBoundingClientRect(), b = medidor.getBoundingClientRect();
        if (a.left < b.right && a.right > b.left && a.bottom > b.top && a.top < b.bottom)
          painel.style.top = (b.bottom + 6) + 'px';
      }
    }
    function atualizarSeta() {
      if (painel.hidden) return;
      try {
        var j = document.getElementById('campo').contentWindow;
        var e = j.eval("(function(){var c=typeof vista!=='undefined'&&vista==='controle'&&!(typeof modoMapa!=='undefined'&&modoMapa)&&typeof camFpv!=='undefined'?camFpv:cam;var e=c.matrixWorld.elements;return [-e[8],-e[10],e[4],e[6]];})()");
        var a = anguloSeta(j.xgPulv.vento.dir, e[0], e[1], e[2], e[3]);
        var alvo = painel.querySelector('[data-clima="direcao"]');
        /* a conta da origem continua (anguloSeta); a seta mostra o contrario dela:
           o lado para onde a deriva leva as gotas, que e o que o aluno ve caindo */
        alvo.title = 'A seta aponta para onde o vento leva o produto, em relação à câmera';
        alvo.querySelector('svg').style.transform = 'rotate(' + (a * 180 / Math.PI + 180) + 'deg)';
      } catch (_) { /* camera ainda carregando */ }
    }
    atualizar(); atualizarSeta(); setInterval(atualizar, 250); setInterval(atualizarSeta, 50);
  }
  if (typeof document !== 'undefined') iniciarPainel();
  return { avancar: avancar, origem: origem, anguloSeta: anguloSeta };
})();
