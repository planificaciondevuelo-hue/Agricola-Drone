/* ==========================================================================
   RC-N1 DE VERDADE PELO CABO USB (Air 2S) - 13/10/2026, pedido do Eduardo

   Ligado no computador, o RC-N1 aparece como duas portas seriais da DJI
   ("DEVICE USB VCOM For Protocol" e "... For Debug"), nao como joystick.
   Pela porta "For Protocol", a 115200, ele responde ao pedido de canais do
   protocolo DUML (cmdset 0x06, cmd 0x01) com os dois manches e a roda da
   camera, cada eixo de 364 a 1684 (centro 1024). So depois do comando de
   "modo simulador" (0x06 0x24, o mesmo dos simuladores de voo) os valores
   deixam de vir parados no centro. Testado neste PC (13/10/2026) com o
   RC-N1 dele: os 4 eixos e a roda mexem.

   O Chrome fala com a porta pela Web Serial (so Chrome/Edge no computador,
   em https ou localhost): o aluno aperta "Conectar RC-N1", escolhe a porta
   "For Protocol" e pronto. Os manches entram no voo manual (manual.js soma
   com teclado e mouse, e a trava "controle pronto" continua valendo); a roda
   gira a camera (window.xgGimbal no campo).

   Botoes (14/10/2026, Eduardo: "todos os botoes devem ser funcionaveis"): o
   pedido 0x06 0x27 (o mesmo do projeto aberto RC-N1 ControllerBridge, MIT)
   responde 58 bytes; os bytes 28-29 trazem a chave e os botoes. Conferido
   com o RC-N1 dele (copias-de-seguranca/rc-n1-cabo-20261013/ler_botoes.ps1):
   disparo 0x0060, foto/video 0x0004, casinha (pausa/RTH) 0x0080, Fn 0x0002;
   chave 0x3000: 0x0000 = S, 0x1000 = N, 0x2000 = C. Vao para o app de voo
   (APP_FLY.botao / APP_FLY.definirModo). O botao de ligar nao vem por aqui.
   ========================================================================== */
window.XG_RC_N1 = (function () {
  "use strict";

  var ATIVO = (function () { try { return /^(air2s)$/.test(new URLSearchParams(location.search).get("modelo") || ""); } catch (e) { return false; } })();
  /* pacotes DUML (CRC8 0x8C/0x77 no cabecalho, CRC16 0x8408/0x3692 no fim), conferidos contra um pacote conhecido */
  var PEDIR = new Uint8Array([0x55, 0x0d, 0x04, 0x33, 0x0a, 0x06, 0xeb, 0x34, 0x40, 0x06, 0x01, 0x74, 0x24]);
  var BOTOES = new Uint8Array([0x55, 0x0d, 0x04, 0x33, 0x0a, 0x06, 0xeb, 0x34, 0x40, 0x06, 0x27, 0x40, 0x60]);
  var SIMULADOR = new Uint8Array([0x55, 0x0e, 0x04, 0x66, 0x0a, 0x06, 0xeb, 0x34, 0x40, 0x06, 0x24, 0x01, 0xd9, 0xec]);
  var CENTRO = 1024, CURSO = 660, ZONA_MORTA = 0.04;

  var porta = null, leitor = null, escritor = null, pedindo = null, roda = null;
  var valores = null, ultimo = 0, sobra = new Uint8Array(0), botao = null, ligando = false;

  function eixo(v) {
    var x = (v - CENTRO) / CURSO;
    if (Math.abs(x) < ZONA_MORTA) x = 0;
    return Math.max(-1, Math.min(1, x));
  }

  /* os manches no formato do manual.js (y para cima, x para a direita), ou null sem o controle */
  function manches() {
    if (!valores || performance.now() - ultimo > 600) return null;
    return { esq: { x: eixo(valores.esqH), y: eixo(valores.esqV) }, dir: { x: eixo(valores.dirH), y: eixo(valores.dirV) } };
  }

  /* junta os pedacos que chegam e tira os pacotes 0x55 de resposta dos canais (38 bytes) */
  function receber(pedaco) {
    var b = new Uint8Array(sobra.length + pedaco.length);
    b.set(sobra); b.set(pedaco, sobra.length);
    var i = 0;
    while (i < b.length) {
      if (b[i] !== 0x55) { i++; continue; }
      if (b.length - i < 3) break;
      var tam = b[i + 1] | ((b[i + 2] & 0x03) << 8);
      if (tam < 13 || tam > 1400) { i++; continue; }
      if (b.length - i < tam) break;
      if (tam === 0x26 && b[i + 9] === 0x06 && b[i + 10] === 0x01) {
        var u = function (k) { return b[i + k] | (b[i + k + 1] << 8); };
        valores = { dirH: u(13), dirV: u(16), esqV: u(19), esqH: u(22), roda: u(25) };
        ultimo = performance.now();
      } else if (tam === 58 && b[i + 9] === 0x06 && b[i + 10] === 0x27) {
        botoes((b[i + 28] << 8) | b[i + 29]);
      }
      i += tam;
    }
    sobra = b.slice(i);
  }

  /* --------------------------------------------------------------- botoes */

  var BT = { disparo: 0x0060, fotoVideo: 0x0004, rth: 0x0080, fn: 0x0002 };
  var MODO_CHAVE = { 0x0000: "S", 0x1000: "N", 0x2000: "C" };
  var bitsAntes = null, rthDesde = 0, rthFeito = false, chaveAntes = null;

  function app() { return window.APP_FLY && window.APP_FLY.botao ? window.APP_FLY : null; }

  /* cada botao age quando e apertado (borda de subida); a casinha: toque = pausa, segurar 1 s = RTH */
  function botoes(bits) {
    var a = app(), antes = bitsAntes === null ? bits : bitsAntes;
    bitsAntes = bits;
    var desceu = function (m) { return (bits & m) && !(antes & m); };
    if (a) {
      if (desceu(BT.disparo)) a.botao("disparo", 0);
      if (desceu(BT.fotoVideo)) a.botao("fotoVideo", 0);
      if (desceu(BT.fn)) a.botao("fn", 0);
      if (desceu(BT.rth)) { rthDesde = performance.now(); rthFeito = false; }
      if ((bits & BT.rth) && rthDesde && !rthFeito && performance.now() - rthDesde >= 1000) { rthFeito = true; a.botao("pausaRth", 1000); }
      if (!(bits & BT.rth) && (antes & BT.rth) && !rthFeito) a.botao("pausaRth", performance.now() - rthDesde);
      if (!(bits & BT.rth)) rthDesde = 0;
    }
    /* a chave C/N/S: o app segue a posicao dela (na primeira leitura tambem) */
    var chave = MODO_CHAVE[bits & 0x3000];
    if (chave && chave !== chaveAntes && a && a.definirModo) { chaveAntes = chave; a.definirModo(chave); }
  }

  async function lerSempre() {
    try {
      while (leitor) {
        var r = await leitor.read();
        if (r.done) break;
        if (r.value) receber(r.value);
      }
    } catch (e) { /* cabo puxado ou porta fechada */ }
  }

  /* a roda da camera do RC-N1 volta ao centro sozinha: quanto mais girada, mais rapido a camera
     sobe ou desce (ate ~60 graus/s), de 0 a -90 graus, como a roda do Agras no teclado */
  function girarCamera() {
    var antes = performance.now();
    roda = setInterval(function () {
      var agora = performance.now(), dt = Math.min(0.2, (agora - antes) / 1000);
      antes = agora;
      if (!valores || agora - ultimo > 600) return;
      var r = eixo(valores.roda);
      if (!r) return;
      try {
        var j = document.getElementById("campo").contentWindow;
        if (typeof j.xgGimbal !== "number") j.xgGimbal = 0;
        j.xgGimbal = Math.max(-90, Math.min(typeof j.xgGimbalMax === "number" ? j.xgGimbalMax : 0, j.xgGimbal + r * 60 * dt));
      } catch (e) { /* campo recarregando */ }
    }, 50);
  }

  async function conectar() {
    if (ligando) return;
    if (porta) { desconectar("RC-N1 desconectado"); return; }
    if (!navigator.serial) { mostrar("Abra no Chrome do computador para usar o RC-N1 pelo cabo", true); return; }
    ligando = true;
    try {
      porta = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x2CA3 }] });
    } catch (e) { porta = null; ligando = false; return; }        // o aluno fechou a janela
    try {
      await porta.open({ baudRate: 115200 });
      escritor = porta.writable.getWriter();
      leitor = porta.readable.getReader();
      valores = null; sobra = new Uint8Array(0);
      lerSempre();
      await escritor.write(SIMULADOR);
      bitsAntes = null; chaveAntes = null; rthDesde = 0;
      pedindo = setInterval(function () {
        if (!escritor) return;
        escritor.write(PEDIR).catch(function () {});
        escritor.write(BOTOES).catch(function () {});
      }, 50);
      girarCamera();
      mostrar("Conectando ao RC-N1...");
      setTimeout(function () {
        ligando = false;
        if (!porta) return;
        if (!valores) desconectar("Essa porta não respondeu. Conecte de novo e escolha a porta \"For Protocol\" do RC-N1", true);
        else { mostrar("RC-N1 conectado"); ligarControleVirtual(); }
      }, 1500);
    } catch (e) {
      ligando = false;
      desconectar("Não foi possível abrir a porta do RC-N1 (feche outro programa que esteja usando o controle)", true);
    }
  }

  /* O RC-N1 de verdade so responde ligado: o controle do simulador liga junto (o botao de ligar
     fisico dele ainda nao chega aqui). Desligado ou so com as luzes acesas, passa direto para ligar. */
  function ligarControleVirtual() {
    try {
      var jc = document.getElementById("controle").contentWindow;
      var fase = jc.eval("typeof faseControle !== 'undefined' ? faseControle : ''");
      if (fase === "desligado" || fase === "armado") {
        jc.eval("ligarControle()");
        mostrar("RC-N1 conectado: ligando o controle");
      }
    } catch (e) { /* controle ainda carregando */ }
  }

  function desconectar(texto, erro) {
    clearInterval(pedindo); pedindo = null;
    clearInterval(roda); roda = null;
    var p = porta, l = leitor, w = escritor;
    porta = null; leitor = null; escritor = null; valores = null;
    try { if (l) l.cancel().catch(function () {}).then(function () { try { l.releaseLock(); } catch (e) {} }); } catch (e) {}
    try { if (w) w.releaseLock(); } catch (e) {}
    setTimeout(function () { try { if (p) p.close().catch(function () {}); } catch (e) {} }, 100);
    mostrar(texto || "", erro);
  }

  /* --------------------------------------------------------------- botao */
  var recado = null, recadoAte = 0;
  function mostrar(texto, erro) {
    if (!botao) return;
    botao.textContent = porta ? "🎮 RC-N1 conectado" : "🎮 Conectar RC-N1";
    botao.style.borderColor = porta ? "#3ddc84" : "rgba(255,255,255,.25)";
    if (!texto) return;
    if (!recado) {
      recado = document.createElement("div");
      recado.style.cssText = "position:fixed;left:12px;bottom:58px;z-index:9001;max-width:min(420px,80vw);padding:8px 12px;border-radius:10px;" +
        "background:rgba(20,26,32,.92);color:#fff;font:500 13px Asap,system-ui,sans-serif;pointer-events:none";
      document.body.appendChild(recado);
    }
    recado.textContent = texto;
    recado.style.borderLeft = "4px solid " + (erro ? "#ff6b5e" : "#3ddc84");
    recado.style.display = "block";
    recadoAte = Date.now() + (erro ? 7000 : 3000);
    setTimeout(function () { if (Date.now() >= recadoAte && recado) recado.style.display = "none"; }, erro ? 7100 : 3100);
  }

  function montarBotao() {
    if (!ATIVO || botao || !navigator.serial) return;
    if (window.DISPOSITIVO_SIM && DISPOSITIVO_SIM.movel) return;
    var ap = document.getElementById("aparelho");
    if (!ap) return;
    botao = document.createElement("button");
    botao.type = "button";
    botao.id = "xg-bt-rcn1";
    botao.title = "Pilotar com o RC-N1 de verdade ligado no computador pelo cabo USB";
    botao.style.cssText = "position:fixed;left:118px;bottom:12px;z-index:9000;display:flex;align-items:center;gap:8px;" +
      "padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(20,26,32,.85);" +
      "color:#fff;font:600 14px Asap,system-ui,sans-serif;cursor:pointer";
    botao.onclick = conectar;
    document.body.appendChild(botao);
    mostrar("");
    setInterval(function () { botao.style.display = ap.classList.contains("esconder") ? "none" : "flex"; }, 400);
    navigator.serial.addEventListener("disconnect", function (e) { if (porta && e.target === porta) desconectar("O cabo do RC-N1 foi desconectado", true); });
    window.addEventListener("pagehide", function () { if (porta) desconectar(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarBotao); else montarBotao();

  return { manches: manches, conectar: conectar, conectado: function () { return !!porta && !!valores; }, valores: function () { return valores; },
    _receber: function (b) { receber(b); ultimo = performance.now(); } };   // _receber: teste sem o cabo
})();
