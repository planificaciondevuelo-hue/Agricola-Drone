/* Auxílios visuais da câmera (menu Tipo de mapa > Auxílios visuais), por
   cima da imagem da câmera (#fpv), pequena ou em tela cheia. As escolhas
   ficam em opMapa.aux (mapa.js) e valem na hora. Desenho medido nas
   gravações do voo real (g7 #0181 e #0190; ANALISE_VOOS_REAIS.md item 19):
     Horizonte  - círculo com ponto no centro (960,600), pontilhados à
                  esquerda e à direita que inclinam com o rolamento da
                  aeronave (E.rl, graus, + = direita para baixo) e
                  pontilhados curtos acima e abaixo
     Orientação - linha fina do centro para baixo e, dali, faixa tracejada
                  larga até a borda de baixo (rumo da aeronave)
     Grade      - terços (x 640/1280, y 400/800), linha fina
   Arquivo próprio para não mexer no mapa.js. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var caixa = document.getElementById("fpv");
  if (!caixa) return;

  function no(tag, at, pai) {
    var e = document.createElementNS(NS, tag);
    for (var k in at) e.setAttribute(k, at[k]);
    (pai || svg).appendChild(e);
    return e;
  }
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "fpv-aux");
  svg.setAttribute("viewBox", "0 0 1920 1200");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2;overflow:hidden";

  /* grade de terços */
  var grade = no("g", { stroke: "rgba(255,255,255,.8)", "stroke-width": 1.5 });
  [[640, 0, 640, 1200], [1280, 0, 1280, 1200], [0, 400, 1920, 400], [0, 800, 1920, 800]].forEach(function (c) {
    no("line", { x1: c[0], y1: c[1], x2: c[2], y2: c[3] }, grade);
  });

  /* orientação: fina do centro até 745; depois faixas largas até embaixo */
  var orient = no("g", { fill: "rgba(255,255,255,.92)" });
  no("rect", { x: 957, y: 628, width: 6, height: 117 }, orient);
  [[760, 160], [940, 160], [1120, 80]].forEach(function (f) { no("rect", { x: 952, y: f[0], width: 16, height: f[1] }, orient); });

  /* horizonte: círculo fixo no centro; os pontilhados laterais giram com o rolamento */
  var horiz = no("g", { fill: "#fff" });
  no("circle", { cx: 960, cy: 600, r: 15, fill: "none", stroke: "#fff", "stroke-width": 3.5 }, horiz);
  no("circle", { cx: 960, cy: 600, r: 3.5 }, horiz);
  [510, 528, 546].forEach(function (y) { no("circle", { cx: 960, cy: y, r: 3.5 }, horiz); });
  [652, 670, 688, 706].forEach(function (y) { no("circle", { cx: 960, cy: y, r: 3.5 }, horiz); });
  var asas = no("g", {}, horiz);
  for (var i = 0; i < 10; i++) {
    no("circle", { cx: 725 + i * 20, cy: 600, r: 3.8 }, asas);
    no("circle", { cx: 1015 + i * 20, cy: 600, r: 3.8 }, asas);
  }
  caixa.appendChild(svg);

  function aux() {
    var o = window.opMapa && window.opMapa.aux;
    return o || { Horizonte: true, "Orientação": true, Grade: false };
  }
  var rolSuave = 0;
  function atualizar() {
    var a = aux(), E = window.APP && APP.E;
    grade.style.display = a.Grade ? "" : "none";
    orient.style.display = a["Orientação"] ? "" : "none";
    horiz.style.display = a.Horizonte ? "" : "none";
    /* a tracejada antiga (.linha) ficava fora do centro em tela cheia: a do SVG a substitui */
    var traco = caixa.querySelector(".linha");
    if (traco) traco.style.display = "none";
    var rl = E && typeof E.rl === "number" ? E.rl : 0;
    rolSuave += (rl - rolSuave) * 0.35;
    asas.setAttribute("transform", "rotate(" + rolSuave.toFixed(2) + " 960 600)");
  }
  setInterval(atualizar, 50);
  atualizar();
})();
