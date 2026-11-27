/* ==========================================================================
   RC PLUS DE VERDADE PELO CABO USB (drones de pulverizacao DJI) - 14/10/2026

   Pedido do Eduardo ("ligar o de verdade pelo cabo", escolhido no lugar de
   reativar o app no controle). Ligado no computador, o RC Plus aparece como
   aparelho Android (arquivos + ADB), sem porta serial. Os manches saem do
   joystick interno dele ("DJI embedded joystick") e quem le e o programinha
   ferramentas/ponte_rc_plus_cabo.cjs, no computador do aluno, pelo adb e
   SO LEITURA (nada muda no controle). A ponte manda os eixos por WebSocket em
   ws://127.0.0.1:8823 e este modulo junta tudo ao voo manual (manual.js soma
   com teclado e mouse; a trava "controle pronto" continua valendo).

   Eixos (conferidos no RC Plus dele): ABS_X/ABS_Y = manche esquerdo,
   ABS_RX/ABS_RY = manche direito, de -32768 a 32767; rodas Z/RZ de 0 a 255
   (centro 127). A roda direita gira a camera (window.xgGimbal no campo).
   Botoes (Pausa, RTH, C1-C3) nao saem por este caminho.
   ========================================================================== */
window.XG_RC_PLUS_CABO = (function () {
  "use strict";

  var URL_PONTE = "ws://127.0.0.1:8823";
  var url = (function () { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
  /* 21/10/2026, pedido do Eduardo: "nao e pra ter esse botao em nenhum drone agricola". O botao
     "RC Plus pelo cabo" nao aparece mais em drone nenhum (nem para o administrador, nem em localhost).
     O resto do modulo fica como estava para o caso de ele pedir de volta: basta voltar a condicao
     antiga (marca dji e modelo diferente de air2s). Sem botao a ponte nunca conecta, entao
     manches() devolve null e o manual.js nao soma nada. */
  var ATIVO = false;
  var MAX = 32767, ZONA_MORTA = 0.04;

  var ws = null, dados = null, chegou = 0, botao = null, girar = null, ligouVirtual = false, querendo = false;

  function eixo(v, inverter) {
    var x = (v || 0) / MAX;
    if (inverter) x = -x;
    if (Math.abs(x) < ZONA_MORTA) x = 0;
    return Math.max(-1, Math.min(1, x));
  }
  /* parado, o joystick nao manda nada: vale o estado da ponte (adb lendo), nao o tempo do ultimo movimento */
  function valido() { return !!(dados && dados.conectado && performance.now() - chegou < 1000); }

  /* no formato do manual.js: y para cima, x para a direita (no joystick do Linux, para cima e negativo) */
  function manches() {
    if (!valido()) return null;
    return { esq: { x: eixo(dados.x), y: eixo(dados.y, true) }, dir: { x: eixo(dados.rx), y: eixo(dados.ry, true) } };
  }

  function ligarControleVirtual() {
    if (ligouVirtual) return;
    try {
      var jc = document.getElementById("controle").contentWindow;
      var fase = jc.eval("typeof faseControle !== 'undefined' ? faseControle : ''");
      if (fase === "desligado" || fase === "armado") { jc.eval("ligarControle()"); mostrar("RC Plus conectado: ligando o controle"); }
      ligouVirtual = true;
    } catch (e) { /* controle ainda carregando */ }
  }

  function conectar() {
    if (ws) { querendo = false; ws.close(); return; }
    querendo = true;
    mostrar("Procurando a ponte do RC Plus neste computador...");
    try { ws = new WebSocket(URL_PONTE); } catch (e) { ws = null; mostrar("Não foi possível conectar à ponte do RC Plus", true); return; }
    var abriu = false;
    ws.onopen = function () { abriu = true; atualizarBotao(); };
    ws.onmessage = function (e) {
      try { dados = JSON.parse(e.data); } catch (erro) { return; }
      chegou = performance.now();
      if (valido()) { if (!ligouVirtual) { mostrar("RC Plus conectado"); ligarControleVirtual(); } }
      atualizarBotao();
    };
    ws.onclose = function () {
      ws = null; dados = null; ligouVirtual = false;
      atualizarBotao();
      if (!abriu) mostrar("Abra a ponte do RC Plus no computador (ABRIR_PONTE_RC_PLUS.bat) e conecte de novo", true);
      else if (querendo) mostrar("A ponte do RC Plus foi fechada", true);
    };
    ws.onerror = function () { /* o onclose avisa */ };
  }

  /* a roda direita do RC Plus volta ao centro: quanto mais girada, mais rapido a camera anda */
  function girarCamera() {
    var antes = performance.now();
    girar = setInterval(function () {
      var agora = performance.now(), dt = Math.min(0.2, (agora - antes) / 1000);
      antes = agora;
      if (!valido()) return;
      var r = ((dados.rz == null ? 127 : dados.rz) - 127) / 127;
      if (Math.abs(r) < 0.06) return;
      try {
        var j = document.getElementById("campo").contentWindow;
        if (typeof j.xgGimbal !== "number") j.xgGimbal = -19;
        j.xgGimbal = Math.max(-90, Math.min(0, j.xgGimbal + r * 60 * dt));
      } catch (e) { /* campo recarregando */ }
    }, 50);
  }

  /* --------------------------------------------------------------- botao */
  var recado = null, recadoAte = 0;
  function atualizarBotao() {
    if (!botao) return;
    var ok = valido();
    botao.textContent = ok ? "🎮 RC Plus conectado" : ws ? "🎮 RC Plus: esperando o controle" : "🎮 RC Plus pelo cabo";
    botao.style.borderColor = ok ? "#3ddc84" : "rgba(255,255,255,.25)";
  }
  function mostrar(texto, erro) {
    if (!texto) return;
    if (!recado) {
      recado = document.createElement("div");
      recado.style.cssText = "position:fixed;left:12px;bottom:58px;z-index:9001;max-width:min(440px,80vw);padding:8px 12px;border-radius:10px;" +
        "background:rgba(20,26,32,.92);color:#fff;font:500 13px Asap,system-ui,sans-serif;pointer-events:none";
      document.body.appendChild(recado);
    }
    recado.textContent = texto;
    recado.style.borderLeft = "4px solid " + (erro ? "#ff6b5e" : "#3ddc84");
    recado.style.display = "block";
    recadoAte = Date.now() + (erro ? 8000 : 3000);
    setTimeout(function () { if (Date.now() >= recadoAte && recado) recado.style.display = "none"; }, erro ? 8100 : 3100);
  }

  /* So o administrador (e o teste local) ve o botao: o RC Plus de verdade continua fora para os alunos
     ate a autorizacao da DJI (decisao de 08/10/2026); a conta carrega depois, entao tenta de novo. */
  function podeVer() {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return true;
    try { var c = window.CONTAS && CONTAS.atual && CONTAS.atual(); return !!(c && c.admin === true); } catch (e) { return false; }
  }
  var tentativas = 0;
  function montarBotao() {
    if (!ATIVO || botao) return;
    if (!podeVer()) { if (++tentativas < 60) setTimeout(montarBotao, 2000); return; }
    if (window.DISPOSITIVO_SIM && DISPOSITIVO_SIM.movel) return;
    var ap = document.getElementById("aparelho");
    if (!ap) return;
    botao = document.createElement("button");
    botao.type = "button";
    botao.id = "xg-bt-rcplus-cabo";
    botao.title = "Pilotar com o RC Plus de verdade ligado no computador pelo cabo USB (precisa da ponte aberta)";
    botao.style.cssText = "position:fixed;left:118px;bottom:12px;z-index:9000;display:flex;align-items:center;gap:8px;" +
      "padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(20,26,32,.85);" +
      "color:#fff;font:600 14px Asap,system-ui,sans-serif;cursor:pointer";
    botao.onclick = conectar;
    document.body.appendChild(botao);
    atualizarBotao();
    girarCamera();
    setInterval(function () { botao.style.display = ap.classList.contains("esconder") ? "none" : "flex"; atualizarBotao(); }, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarBotao); else montarBotao();

  return { manches: manches, conectar: conectar, conectado: valido, dados: function () { return dados; } };
})();
