/* ==========================================================================
   O EDITOR DE ROTA DO CONTROLE: ANGULO E SEGMENTACAO

   Conferido contra o relatorio dos videos dele (paginas 4, 7 e 8):

     Angulo da rota      abre pelo ponto amarelo do mapa ou por "Angulo da
                         rota > Configuracoes". Otimizacao automatica ligada:
                         o app escolhe a direcao das passadas. Desligada:
                         setas para girar, bussola com os graus. Cancelar(R2)
                         desfaz, Sim(R3) confirma.
     Segmentacao de rota barra com dois marcadores percentuais: o trecho da
                         rota que sera feito. - e + ajustam o marcador
                         tocado por ultimo. Cancelar(R2) / OK(R3).

   O controle desenha as faixas com anguloDaRota() e faixasDeRota(). Aqui as
   duas sao embrulhadas por fora: com a otimizacao desligada o angulo e o do
   aluno, e as faixas saem recortadas pela segmentacao. O redesenhar() do
   proprio controle refaz o mapa. Nada no arquivo do controle e editado.
   ========================================================================== */

window.EDITOR_ROTA = (function () {
  "use strict";

  var ESTILO = [
    /* enquanto uma das telas esta aberta, o painel de configuracoes da rota sai */
    "[data-tela='mapeamento'].xg-editando .painel-rota{display:none!important}",

    /* --- Angulo da rota: painel alto a esquerda ---------------------- */
    ".xg-ang{position:absolute;left:1.2cqw;top:6.2cqw;bottom:1.2cqw;width:23cqw;z-index:30;display:none;",
    "  flex-direction:column;background:#f7f7f6;border-radius:.9cqw;padding:1.2cqw 1.4cqw;",
    "  box-shadow:0 .5cqw 1.8cqw rgba(0,0,0,.3);font-family:Inter,'Segoe UI',sans-serif;color:#2f3336}",
    ".xg-ang.aberto{display:flex}",
    ".xg-ang h4{margin:0 0 .8cqw;text-align:center;font-size:1.7cqw;font-weight:500}",
    ".xg-ang .xg-linha{display:flex;justify-content:space-between;align-items:center;font-size:1.6cqw;line-height:1.25}",
    ".xg-ang-graus{text-align:center;font-size:2.4cqw;font-weight:600;margin-top:1cqw;min-height:3cqw}",
    ".xg-ang svg.bussola-rota{flex:1;width:100%;min-height:0}",
    ".xg-ang.auto .xg-ang-graus{color:#8a8f93;font-weight:400}",
    ".xg-ang.auto svg.bussola-rota{opacity:.3}",
    ".xg-ang-giro{display:flex;justify-content:space-around;margin:.6cqw 0 1cqw}",
    ".xg-ang-giro button{width:4.8cqw;height:4.8cqw;border-radius:50%;border:.2cqw solid #d6dadd;background:#fff;",
    "  color:#2f3336;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}",
    ".xg-ang-giro button svg{width:2.6cqw;height:2.6cqw}",
    ".xg-ang-giro button:disabled{opacity:.35;cursor:default}",
    ".xg-rodape-rota{display:flex;justify-content:space-between;align-items:center}",
    ".xg-rodape-rota button{border:0;background:none;padding:.4cqw 0;font-size:1.6cqw;cursor:pointer;",
    "  font-family:inherit;color:#2f3336}",
    ".xg-rodape-rota button.verde{color:#2f8a4a;font-weight:600}",

    /* --- Segmentacao: faixa branca embaixo da tela inteira ------------ */
    ".xg-seg{position:absolute;left:0;right:0;bottom:0;height:11.5cqw;z-index:30;display:none;",
    "  align-items:center;gap:1.2cqw;padding:0 1.8cqw;background:#f7f7f6;",
    "  box-shadow:0 -.3cqw 1cqw rgba(0,0,0,.2);font-family:Inter,'Segoe UI',sans-serif;color:#2f3336}",
    ".xg-seg.aberto{display:flex}",
    ".xg-seg .mm{border:0;background:none;font-size:3cqw;line-height:1;cursor:pointer;color:#2f3336;padding:0 .6cqw}",
    ".xg-seg-area{flex:1;position:relative;height:100%;touch-action:none;cursor:pointer}",
    ".xg-seg-area .marca{position:absolute;top:1.4cqw;transform:translateX(-50%);font-size:1.4cqw;color:#8a8f93}",
    ".xg-seg-area .trilho{position:absolute;left:0;right:0;top:5.4cqw;height:.45cqw;background:#d6dadd;border-radius:.3cqw}",
    ".xg-seg-area .sel{position:absolute;top:5.2cqw;height:.85cqw;background:#f2e03c;border-radius:.3cqw}",
    ".xg-seg-area .alca{position:absolute;top:4.5cqw;width:2.3cqw;height:2.3cqw;margin-left:-1.15cqw;",
    "  border-radius:.45cqw;background:#3fbf5a;box-shadow:0 .15cqw .4cqw rgba(0,0,0,.3)}",
    ".xg-seg-area .alca.ativa{outline:.25cqw solid #2f8a4a;outline-offset:.2cqw}",
    ".xg-seg-area .valor{position:absolute;top:7.8cqw;transform:translateX(-50%);font-size:1.4cqw;color:#2f3336}",
    ".xg-seg-lado{display:flex;flex-direction:column;align-items:flex-end;gap:1.4cqw;min-width:12cqw}",
    ".xg-seg-lado button{border:0;background:none;font-size:1.6cqw;cursor:pointer;font-family:inherit;color:#2f3336}",
    ".xg-seg-lado button.verde{color:#2f8a4a;font-weight:600}",
  ].join("");

  var SETA_ESQ = '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M3 4v5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SETA_DIR = '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M21 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function Editor(quadroControle) {
    this.quadro = quadroControle;
    this.instalado = false;
  }

  Editor.prototype.jan = function () {
    try { return this.quadro.contentWindow; } catch (e) { return null; }
  };

  Editor.prototype.instalar = function () {
    if (this.instalado) return true;
    var j = this.jan();
    var doc = j && j.document;
    if (!doc || !doc.body) return false;

    var tela = doc.querySelector("[data-tela='mapeamento']");
    if (!tela || typeof j.anguloDaRota !== "function" || typeof j.faixasDeRota !== "function") return false;

    /* o estado do plano: vive no controle, porque e o controle que desenha */
    if (!j.xgRota) j.xgRota = { auto: true, graus: null, ini: 0, fim: 100 };

    /* as duas funcoes de rota do controle, embrulhadas */
    j.eval(
      "(function(){" +
      "  if (window.__xgRotaEmbrulhada) return;" +
      "  window.__xgRotaEmbrulhada = true;" +
      "  var angOriginal = anguloDaRota;" +
      "  window.xgAnguloAuto = angOriginal;" +
      "  anguloDaRota = function (pontos) {" +
      "    var r = window.xgRota;" +
      "    if (r && r.auto === false && typeof r.graus === 'number') return (r.graus - 90) * Math.PI / 180;" +
      "    return angOriginal(pontos);" +
      "  };" +
      "  var faixasOriginal = faixasDeRota;" +
      /* as passadas ficam afastadas do contorno branco por meia faixa +
         margem (palavras dele): sao geradas num contorno encolhido por
         essa distancia. window.xgPorDentro e definido no embrulho do
         redesenhar(), abaixo. */
      "  faixasDeRota = function (limite, obstaculo, passoPx, ang) {" +
      "    var afasta = passoPx / 2 + (estado.margem || 0) / METROS_POR_UNIDADE * ZOOM_TRABALHO;" +
      "    var lim = (window.xgPorDentro && limite.length >= 3) ? window.xgPorDentro(limite, afasta) : limite;" +
      "    var linhas = faixasOriginal.call(this, lim, obstaculo, passoPx, ang), r = window.xgRota;" +
      "    if (!r || (r.ini <= 0 && r.fim >= 100)) return linhas;" +
      "    var n = linhas.length;" +
      "    return linhas.slice(Math.floor(n * r.ini / 100), Math.ceil(n * r.fim / 100));" +
      "  };" +
      "})()"
    );

    /* A area da tarefa com fronteira (fotos dele): "Somente fronteira" nao
       e zero - e a faixa de uma passada em volta do talhao (8,73 ha de
       campo deram 0,66 ha de tarefa); "Rota e fronteira" soma essa faixa. O
       controle zera a primeira e ignora a segunda. */
    j.eval(
      "(function(){" +
      "  if (window.__xgAreasEmbrulhada || typeof calcularAreas !== 'function') return;" +
      "  window.__xgAreasEmbrulhada = true;" +
      "  var original = calcularAreas;" +
      "  calcularAreas = function (limite, obstaculo) {" +
      "    var a = original(limite, obstaculo);" +
      "    if (limite.length < 3) return a;" +
      "    var metro = METROS_POR_UNIDADE / ZOOM_TRABALHO;" +
      "    var faixaHa = perimetro(limite) * metro * estado.espacamento / 10000;" +
      "    if (estado.cobertura === 'Somente fronteira') a.tarefa = Math.min(a.campo, faixaHa);" +
      "    else if (estado.cobertura === 'Rota e fronteira') a.tarefa = Math.min(a.campo, a.tarefa + faixaHa);" +
      "    return a;" +
      "  };" +
      "})()"
    );

    /* A fronteira, como nas fotos dele: uma linha LARANJA, fina, por
       DENTRO do contorno branco (a uma passada da borda). "Somente rota":
       amarelas + contorno branco. "Rota e fronteira": amarelas + laranja.
       "Somente fronteira": so contorno branco + laranja. O controle
       desenhava a fronteira amarela em cima do contorno, e nunca na opcao
       "Somente fronteira" - o redesenhar() dele e embrulhado aqui. */
    j.eval(
      "(function(){" +
      "  if (window.__xgFronteiraEmbrulhada || typeof redesenhar !== 'function') return;" +
      "  window.__xgFronteiraEmbrulhada = true;" +
      "  var original = redesenhar;" +
      "  function porDentro(lim, d) {" +
      "    var n = lim.length, s = 0;" +
      "    for (var i = 0; i < n; i++) { var a = lim[i], b = lim[(i + 1) % n]; s += a.x * b.y - b.x * a.y; }" +
      /* no SVG o y cresce para baixo: area positiva (shoelace) e sentido
         horario na tela, e o "dentro" fica a direita de cada lado */
      "    var lado = s > 0 ? 1 : -1, linhas = [];" +
      "    for (var i = 0; i < n; i++) {" +
      "      var a = lim[i], b = lim[(i + 1) % n], ex = b.x - a.x, ey = b.y - a.y, l = Math.hypot(ex, ey) || 1;" +
      "      var nx = -ey / l * lado, ny = ex / l * lado;" +
      "      linhas.push([{ x: a.x + nx * d, y: a.y + ny * d }, { x: ex, y: ey }]);" +
      "    }" +
      "    var pts = [];" +
      "    for (var i = 0; i < n; i++) {" +
      "      var L1 = linhas[(i + n - 1) % n], L2 = linhas[i];" +
      "      var den = L1[1].x * L2[1].y - L1[1].y * L2[1].x;" +
      "      if (Math.abs(den) < 1e-9) { pts.push(L2[0]); continue; }" +
      "      var t = ((L2[0].x - L1[0].x) * L2[1].y - (L2[0].y - L1[0].y) * L2[1].x) / den;" +
      "      pts.push({ x: L1[0].x + L1[1].x * t, y: L1[0].y + L1[1].y * t });" +
      "    }" +
      "    return pts;" +
      "  }" +
      "  window.xgPorDentro = porDentro;" +
      /* nas pontas de cada passada, um tracinho branco ate o contorno: e
         onde o drone manobra (fotos dele) */
      /* Entre as passadas amarelas, a rota de manobra (fotos dele): uma
         linha branca fina que sai da ponta de uma passada e entra na ponta
         da seguinte, em zigue-zague, ligando-as em sequencia. */
      "  function manobras(lim) {" +
      "    var linhas = camada.querySelectorAll('g[stroke=\"#f2e03c\"] line');" +
      "    if (linhas.length < 2) return;" +
      "    var g = el('g', { stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: .95 });" +
      "    var pontas = [];" +
      "    for (var i = 0; i < linhas.length; i++) {" +
      "      var l = linhas[i];" +
      "      pontas.push([{ x: +l.getAttribute('x1'), y: +l.getAttribute('y1') }, { x: +l.getAttribute('x2'), y: +l.getAttribute('y2') }]);" +
      "    }" +
      /* a primeira passada comeca pela ponta mais perto do ponto inicial
         (o primeiro ponto do contorno); depois alterna: sai pela ponta
         oposta e entra na ponta mais proxima da seguinte */
      "    var ini = lim[0], d0 = Math.hypot(pontas[0][0].x - ini.x, pontas[0][0].y - ini.y), d1 = Math.hypot(pontas[0][1].x - ini.x, pontas[0][1].y - ini.y);" +
      "    var saida = d0 <= d1 ? pontas[0][1] : pontas[0][0];" +
      "    for (var i = 1; i < pontas.length; i++) {" +
      "      var a = pontas[i][0], b = pontas[i][1];" +
      "      var da = Math.hypot(a.x - saida.x, a.y - saida.y), db = Math.hypot(b.x - saida.x, b.y - saida.y);" +
      "      var entrada = da <= db ? a : b;" +
      "      g.appendChild(el('line', { x1: saida.x, y1: saida.y, x2: entrada.x, y2: entrada.y }));" +
      "      saida = entrada === a ? b : a;" +
      "    }" +
      "    camada.appendChild(g);" +
      "  }" +
      /* a distancia entre pontos vizinhos do contorno, numa etiqueta escura
         no meio de cada lado (palavras dele) */
      "  function etiquetas(lim) {" +
      "    var metro = METROS_POR_UNIDADE / ZOOM_TRABALHO;" +
      "    var n = lim.length, fechado = n >= 3;" +
      "    for (var i = 0; i + (fechado ? 0 : 1) < n; i++) {" +
      "      var a = lim[i], b = lim[(i + 1) % n];" +
      "      var d = Math.hypot(b.x - a.x, b.y - a.y) * metro;" +
      "      if (d < 0.5) continue;" +
      "      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, txt = d.toFixed(1) + 'm';" +
      "      var g = el('g', { 'class': 'xg-dist' });" +
      "      g.appendChild(el('rect', { x: mx - 6 - txt.length * 6.5, y: my - 13, width: 12 + txt.length * 13, height: 26, rx: 5, fill: 'rgba(40,44,48,.85)' }));" +
      "      var t = el('text', { x: mx, y: my + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 600, fill: '#fff', 'font-family': 'Inter,sans-serif' });" +
      "      t.textContent = txt; g.appendChild(t); camada.appendChild(g);" +
      "    }" +
      "  }" +
      "  redesenhar = function () {" +
      "    original();" +
      "    var lim = estado.limite;" +
      /* a regua da barra de ferramentas liga e desliga as etiquetas */
      "    if (lim.length >= 2 && window.xgRegua !== false) etiquetas(lim);" +
      "    if (lim.length < 3) return;" +
      /* tira a fronteira amarela que o controle poe em cima do contorno */
      "    var polys = camada.querySelectorAll('polygon');" +
      "    for (var i = 0; i < polys.length; i++) {" +
      "      var p = polys[i];" +
      "      if (p.getAttribute('stroke') === '#f2e03c' && p.getAttribute('fill') === 'none') p.remove();" +
      "    }" +
      "    var passo = Math.max(6, estado.espacamento / METROS_POR_UNIDADE * ZOOM_TRABALHO);" +
      "    if (estado.cobertura !== 'Somente fronteira') manobras(lim);" +
      "    if (estado.cobertura === 'Somente rota') return;" +
      /* a fronteira laranja respeita a mesma conta: meia faixa + margem */
      "    var dentro = porDentro(lim, passo / 2 + (estado.margem || 0) / METROS_POR_UNIDADE * ZOOM_TRABALHO);" +
      "    camada.appendChild(el('polygon', { points: pontosSVG(dentro), fill: 'none', stroke: '#f08a24', 'stroke-width': 4, 'stroke-linejoin': 'round' }));" +
      "  };" +
      "})()"
    );

    var estilo = doc.createElement("style");
    estilo.id = "xg-editor-rota";
    estilo.textContent = ESTILO;
    doc.head.appendChild(estilo);

    tela.insertAdjacentHTML("beforeend", this.moldeAngulo() + this.moldeSegmento());
    this.ligar(doc, tela);
    this.instalado = true;
    return true;
  };

  Editor.prototype.moldeAngulo = function () {
    return '<div class="xg-ang auto" id="xg-angulo">' +
      "<h4>Ângulo da rota</h4>" +
      '<div class="xg-linha"><span>Otimização<br>automática</span>' +
      '<button class="interruptor ligado" id="xg-ang-auto"><i></i></button></div>' +
      '<div class="xg-ang-graus" id="xg-ang-graus">0°</div>' +
      '<svg class="bussola-rota" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">' +
      '<circle cx="50" cy="50" r="38" fill="none" stroke="#d6dadd" stroke-width="1.6"/>' +
      '<text x="50" y="8" text-anchor="middle" font-size="7" font-weight="700" fill="#e8442e">N</text>' +
      '<text x="50" y="97" text-anchor="middle" font-size="7" fill="#8a8f93">S</text>' +
      '<text x="4" y="52.5" text-anchor="middle" font-size="7" fill="#8a8f93">W</text>' +
      '<text x="96" y="52.5" text-anchor="middle" font-size="7" fill="#8a8f93">E</text>' +
      '<g id="xg-ang-agulha">' +
      '<polygon points="50,16 55,50 45,50" fill="#e8442e"/>' +
      '<polygon points="45,50 55,50 50,84" fill="#fff" stroke="#c9cdd1" stroke-width=".8"/>' +
      '<circle cx="50" cy="50" r="2.6" fill="#2f3336"/></g></svg>' +
      '<div class="xg-ang-giro"><button id="xg-ang-menos" aria-label="Girar para a esquerda">' + SETA_ESQ + "</button>" +
      '<button id="xg-ang-mais" aria-label="Girar para a direita">' + SETA_DIR + "</button></div>" +
      '<div class="xg-rodape-rota"><button id="xg-ang-cancelar">Cancelar(R2)</button>' +
      '<button class="verde" id="xg-ang-sim">Sim(R3)</button></div>' +
      "</div>";
  };

  Editor.prototype.moldeSegmento = function () {
    return '<div class="xg-seg" id="xg-segmento">' +
      '<button class="mm" id="xg-seg-menos" aria-label="Diminuir">−</button>' +
      '<div class="xg-seg-area" id="xg-seg-barra">' +
      '<span class="marca" style="left:25%">25%</span><span class="marca" style="left:50%">50%</span>' +
      '<span class="marca" style="left:75%">75%</span>' +
      '<i class="trilho"></i><i class="sel" id="xg-seg-sel"></i>' +
      '<b class="alca" data-alca="ini"></b><b class="alca ativa" data-alca="fim"></b>' +
      '<span class="valor" id="xg-seg-ini">0.0%</span><span class="valor" id="xg-seg-fim">100.0%</span>' +
      "</div>" +
      '<button class="mm" id="xg-seg-mais" aria-label="Aumentar">+</button>' +
      '<div class="xg-seg-lado"><button id="xg-seg-cancelar">Cancelar(R2)</button>' +
      '<button class="verde" id="xg-seg-ok">OK(R3)</button></div>' +
      "</div>";
  };

  /* ------------------------------------------------------------ ligacoes */

  Editor.prototype.ligar = function (doc, tela) {
    var self = this;
    var j = this.jan();
    var $ = function (id) { return doc.getElementById(id); };

    function redesenhar() {
      try { j.redesenhar(); } catch (e) { /* controle recarregando */ }
    }

    /* a direcao das faixas, em graus de rumo (0 = norte, 90 = leste). As
       faixas nao tem sentido: 0 e 180 sao a mesma rota. */
    function grausAtuais() {
      var r = j.xgRota;
      if (r.auto === false && typeof r.graus === "number") return r.graus;
      /* `estado` e const no controle: nao aparece em window, so por eval */
      var lim = [];
      try { lim = j.eval("estado.limite") || []; } catch (e) { lim = []; }
      if (lim.length < 2) return 0;
      var a = j.xgAnguloAuto(lim);                    // angulo no desenho (x direita, y baixo)
      var rumo = Math.atan2(Math.cos(a), -Math.sin(a)) * 180 / Math.PI;
      return ((Math.round(rumo) % 180) + 180) % 180;
    }

    function mostrarAngulo() {
      var r = j.xgRota, g = grausAtuais(), auto = r.auto !== false;
      $("xg-ang-auto").classList.toggle("ligado", auto);
      $("xg-angulo").classList.toggle("auto", auto);
      /* com a otimizacao ligada o app mostra "- °" (foto dele) */
      $("xg-ang-graus").textContent = auto ? "– °" : g + "°";
      $("xg-ang-agulha").setAttribute("transform", "rotate(" + g + " 50 50)");
      $("xg-ang-menos").disabled = $("xg-ang-mais").disabled = auto;
    }

    var antesAngulo = null;
    function abrirAngulo() {
      fechar();
      antesAngulo = { auto: j.xgRota.auto, graus: j.xgRota.graus };
      mostrarAngulo();
      $("xg-angulo").classList.add("aberto");
      tela.classList.add("xg-editando");      // o painel de configuracoes sai
    }

    $("xg-ang-auto").addEventListener("click", function () {
      var r = j.xgRota;
      if (r.auto !== false) { r.graus = grausAtuais(); r.auto = false; }   // passa ao manual no angulo de agora
      else r.auto = true;
      mostrarAngulo(); redesenhar();
    });

    function girar(passo) {
      var r = j.xgRota;
      if (r.auto !== false) return;
      r.graus = (((r.graus || 0) + passo) % 180 + 180) % 180;
      mostrarAngulo(); redesenhar();
    }
    /* toque gira 1 grau; segurado, continua girando */
    [["xg-ang-menos", -1], ["xg-ang-mais", 1]].forEach(function (b) {
      var bot = $(b[0]), repete = null, atraso = null;
      function parar() { clearTimeout(atraso); clearInterval(repete); }
      bot.addEventListener("pointerdown", function () {
        if (bot.disabled) return;
        girar(b[1]);
        atraso = setTimeout(function () { repete = setInterval(function () { girar(b[1]); }, 70); }, 350);
      });
      bot.addEventListener("pointerup", parar);
      bot.addEventListener("pointerleave", parar);
    });

    $("xg-ang-cancelar").addEventListener("click", function () {
      if (antesAngulo) { j.xgRota.auto = antesAngulo.auto; j.xgRota.graus = antesAngulo.graus; }
      $("xg-angulo").classList.remove("aberto"); redesenhar();
    });
    $("xg-ang-sim").addEventListener("click", function () {
      $("xg-angulo").classList.remove("aberto"); redesenhar();
    });

    /* ------------------------------------------------ segmentacao */

    var alcaAtiva = "fim", antesSeg = null;

    function mostrarSeg() {
      var r = j.xgRota;
      $("xg-seg-sel").style.left = r.ini + "%";
      $("xg-seg-sel").style.width = (r.fim - r.ini) + "%";
      var alcas = $("xg-seg-barra").querySelectorAll(".alca");
      for (var i = 0; i < alcas.length; i++) {
        var qual = alcas[i].dataset.alca;
        alcas[i].style.left = r[qual] + "%";
        alcas[i].classList.toggle("ativa", qual === alcaAtiva);
      }
      $("xg-seg-ini").textContent = r.ini.toFixed(1) + "%";
      $("xg-seg-fim").textContent = r.fim.toFixed(1) + "%";
      $("xg-seg-ini").style.left = r.ini + "%";
      $("xg-seg-fim").style.left = r.fim + "%";
    }

    function mover(qual, valor) {
      var r = j.xgRota;
      valor = Math.round(Math.max(0, Math.min(100, valor)));
      if (qual === "ini") r.ini = Math.min(valor, r.fim - 5);
      else r.fim = Math.max(valor, r.ini + 5);
      alcaAtiva = qual;
      mostrarSeg(); redesenhar();
    }

    function abrirSegmento() {
      fechar();
      antesSeg = { ini: j.xgRota.ini, fim: j.xgRota.fim };
      mostrarSeg();
      $("xg-segmento").classList.add("aberto");
      tela.classList.add("xg-editando");
    }

    var barra = $("xg-seg-barra"), arrastando = null;
    function porcento(e) {
      var c = barra.getBoundingClientRect();
      return (e.clientX - c.left) / c.width * 100;
    }
    barra.addEventListener("pointerdown", function (e) {
      var p = porcento(e), r = j.xgRota;
      arrastando = Math.abs(p - r.ini) <= Math.abs(p - r.fim) ? "ini" : "fim";
      try { barra.setPointerCapture(e.pointerId); } catch (erro) { /* sem captura */ }
      mover(arrastando, p);
    });
    barra.addEventListener("pointermove", function (e) { if (arrastando) mover(arrastando, porcento(e)); });
    barra.addEventListener("pointerup", function () { arrastando = null; });
    barra.addEventListener("pointercancel", function () { arrastando = null; });

    $("xg-seg-menos").addEventListener("click", function () { mover(alcaAtiva, j.xgRota[alcaAtiva] - 1); });
    $("xg-seg-mais").addEventListener("click", function () { mover(alcaAtiva, j.xgRota[alcaAtiva] + 1); });

    $("xg-seg-cancelar").addEventListener("click", function () {
      if (antesSeg) { j.xgRota.ini = antesSeg.ini; j.xgRota.fim = antesSeg.fim; }
      $("xg-segmento").classList.remove("aberto"); redesenhar();
    });
    $("xg-seg-ok").addEventListener("click", function () {
      $("xg-segmento").classList.remove("aberto"); redesenhar();
    });

    function fechar() {
      $("xg-angulo").classList.remove("aberto");
      $("xg-segmento").classList.remove("aberto");
      tela.classList.remove("xg-editando");
    }

    /* ------------------------------------------- a direcao da fronteira

       Com fronteira na cobertura, o app mostra "Direcao: Sentido horario /
       Sentido anti-horario" logo abaixo da area de cobertura (fotos dele).
       O controle nao tem; entra aqui, com o feitio dos grupos dele. */
    var listaCob = tela.querySelector("#lista-cobertura");
    if (listaCob && !tela.querySelector("#xg-direcao")) {
      var bloco = doc.createElement("div");
      bloco.id = "xg-direcao";
      bloco.innerHTML =
        '<p class="rotulo-campo">Direção</p>' +
        '<div class="grupo-opcoes"><button class="ativa" data-sentido="horario">Sentido horário</button>' +
        '<button data-sentido="anti">Sentido anti-horário</button></div>';
      listaCob.parentNode.insertBefore(bloco, listaCob.nextSibling);
      j.xgRota.sentido = "horario";

      bloco.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          bloco.querySelectorAll("button").forEach(function (o) { o.classList.toggle("ativa", o === b); });
          j.xgRota.sentido = b.dataset.sentido;
        });
      });

      var mostrarDirecao = function () {
        var cob;
        try { cob = j.eval("estado.cobertura"); } catch (e) { cob = "Somente rota"; }
        bloco.style.display = cob === "Somente rota" ? "none" : "";
      };
      mostrarDirecao();
      listaCob.addEventListener("click", function () { setTimeout(mostrarDirecao, 0); });
    }

    /* a regua (icone da barra de ferramentas) liga e desliga a distancia
       entre pontos (palavras dele); comeca ligada, e o icone fica verde */
    var reguas = doc.querySelectorAll(".ferramentas-mapa .botao-mapa use[href='#ic-regua']");
    if (j.xgRegua === undefined) j.xgRegua = true;
    for (var rg = 0; rg < reguas.length; rg++) {
      (function (botao) {
        if (!botao || botao.dataset.xgRegua) return;
        botao.dataset.xgRegua = "1";
        botao.style.color = j.xgRegua ? "#3ad46a" : "";
        botao.addEventListener("click", function () {
          j.xgRegua = !j.xgRegua;
          doc.querySelectorAll("[data-xg-regua]").forEach(function (b) { b.style.color = j.xgRegua ? "#3ad46a" : ""; });
          try { j.redesenhar(); } catch (e) { /* controle recarregando */ }
        });
      })(reguas[rg].closest("button"));
    }

    /* ------------------------------------------- quem abre as janelas */

    /* "Angulo da rota > Configuracoes" e "Segmentacao de rota > Configuracoes" */
    var linhas = tela.querySelectorAll(".linha-config");
    for (var i = 0; i < linhas.length; i++) {
      var texto = linhas[i].textContent;
      var bot = linhas[i].querySelector("button");
      if (!bot) continue;
      if (/ngulo da rota/i.test(texto)) bot.addEventListener("click", abrirAngulo);
      else if (/segmenta/i.test(texto)) bot.addEventListener("click", abrirSegmento);
    }

    /* o ponto amarelo do mapa abre o angulo. Ele e redesenhado a cada
       mudanca, entao a escuta fica na tela, em captura - para o toque nele
       nao virar tambem um ponto marcado no mapa. */
    tela.addEventListener("click", function (e) {
      var alvo = e.target;
      if (!alvo || alvo.tagName !== "circle") return;
      var amarelo = alvo.getAttribute("fill") === "#f0c419" ||
                    (alvo.getAttribute("r") === "18" && alvo.getAttribute("stroke-dasharray"));
      if (!amarelo) return;
      e.stopPropagation(); e.preventDefault();
      abrirAngulo();
    }, true);

    self.abrirAngulo = abrirAngulo;
    self.abrirSegmento = abrirSegmento;
  };

  return {
    criar: function (quadro) { return new Editor(quadro); },
  };
})();
