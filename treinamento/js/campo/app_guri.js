/* ==========================================================================
   AIR 2S - OS APLICATIVOS "DGuri Portatil" E "XGuri Portatil" NO CELULAR DO RC-N1

   Pedido do Eduardo (21/11/2026, feito no Mac): "la no controle do air 2s vc
   coloca os dois apps dguri e xguri ai a pessoa treina mapeamento la quando ela
   criar mapa hd no xguri vai aparecer no controle do xag, quando criar
   orthomosaico e armazenar vai aparecer em todos os controles da dji" e "ter um
   botao pra criar o ponto de calibracao".

   As telas imitam, deitadas (o celular fica deitado no RC-N1), as dos apps de
   verdade dele (capturas em "Programas e apps xguri e dguri/Guri dos drones/
   dguri-portatil e xguri-portatil"): inicio com os cartoes, "Mapear a area"
   (desenhar o poligono), plano de voo (altura e sobreposicao), "Tela do drone"
   (o app voa as linhas sozinho e tira as fotos), "Gerar ortomosaico" e, no fim,
   DGuri = "Armazenar" e XGuri = "Calibrar" + "Gerar Mapa HD".

   Este arquivo roda na pagina de fora (sim.html), como o app_fly.js, e desenha
   por cima da tela dele. O voo usa a automacao do app_fly (manches virtuais):
   o app_fly entrega as funcoes em APP_FLY._guri().

   O que o aluno faz fica guardado no navegador em window.GURI_MAPAS (IndexedDB
   "tpd_mapas_aluno"), por cenario: "orto" (DGuri, para os controles DJI) e "hd"
   (XGuri, para o controle XAG). Os controles leem de la.
   ========================================================================== */
window.GURI_MAPAS = (function () {
  "use strict";
  var NOME = "tpd_mapas_aluno", LOJA = "mapas", CHAVE = "tpd_mapas_aluno";
  function abrir() {
    return new Promise(function (ok, erro) {
      var p = indexedDB.open(NOME, 1);
      p.onupgradeneeded = function () { p.result.createObjectStore(LOJA); };
      p.onsuccess = function () { ok(p.result); };
      p.onerror = function () { erro(p.error); };
    });
  }
  function indice() { try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { return {}; } }
  return {
    /* resumo pequeno (sem a imagem): {"<cenario>|orto": {nome, quando, cx, cz, lm, am, calibrado}, ...} */
    indice: indice,
    tem: function (cenario, tipo) { return indice()[cenario + "|" + tipo] || null; },
    salvar: function (cenario, tipo, mapa) {
      var k = cenario + "|" + tipo;
      return abrir().then(function (db) {
        return new Promise(function (ok, erro) {
          var t = db.transaction(LOJA, "readwrite");
          t.objectStore(LOJA).put(mapa, k);
          t.oncomplete = function () {
            var i = indice(), r = {};
            Object.keys(mapa).forEach(function (c) { if (c !== "imagem") r[c] = mapa[c]; });
            i[k] = r;
            try { localStorage.setItem(CHAVE, JSON.stringify(i)); } catch (e) { /* sem indice */ }
            ok(r);
          };
          t.onerror = function () { erro(t.error); };
        });
      });
    },
    ler: function (cenario, tipo) {
      return abrir().then(function (db) {
        return new Promise(function (ok) {
          var p = db.transaction(LOJA).objectStore(LOJA).get(cenario + "|" + tipo);
          p.onsuccess = function () { ok(p.result || null); };
          p.onerror = function () { ok(null); };
        });
      }).catch(function () { return null; });
    },
    cenario: function () { try { return new URLSearchParams(window.top.location.search).get("cenario") || "plano"; } catch (e) { return "plano"; } },
    /* A foto de cima que um controle usa como mapa (base = {imagem, larguraM, alturaM, centro:{x,z}}) com o mapa do
       aluno colado por cima, no lugar certo e com mais pixels. Devolve a nova imagem (dataURL) ou null se nao ha mapa. */
    compor: function (base, tipo, larguraPx) {
      var eu = this, cen = this.cenario();
      if (!base || !base.imagem || !base.centro || !this.tem(cen, tipo)) return Promise.resolve(null);
      var carregar = function (url) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = url; }); };
      return this.ler(cen, tipo).then(function (m) {
        if (!m || !m.imagem) return null;
        return Promise.all([carregar(base.imagem), carregar(m.imagem)]).then(function (im) {
          if (!im[0] || !im[1]) return null;
          var W = larguraPx || 4096, H = Math.round(W * base.alturaM / base.larguraM), c = document.createElement("canvas");
          c.width = W; c.height = H;
          var g = c.getContext("2d"), k = W / base.larguraM;
          g.imageSmoothingQuality = "high";
          g.drawImage(im[0], 0, 0, W, H);
          var x = (m.cx - m.lm / 2 - (base.centro.x - base.larguraM / 2)) * k, y = (m.cz - m.am / 2 - (base.centro.z - base.alturaM / 2)) * k;
          g.filter = "saturate(1.25) contrast(1.08)";
          g.drawImage(im[1], x, y, m.lm * k, m.am * k);
          void eu;
          return c.toDataURL("image/jpeg", 0.92);
        });
      }).catch(function () { return null; });
    },
    apagar: function (cenario, tipo) {
      var k = cenario + "|" + tipo, i = indice();
      delete i[k];
      try { localStorage.setItem(CHAVE, JSON.stringify(i)); } catch (e) { /* segue */ }
      return abrir().then(function (db) { db.transaction(LOJA, "readwrite").objectStore(LOJA).delete(k); }).catch(function () {});
    },
  };
})();

window.APP_GURI = (function () {
  "use strict";

  var MARCAS = {
    dguri: { letra: "D", nome: "DGuri Portátil", cor: "#15803D", forte: "#166534", escura: "#14532D", clara: "#F0FDF4", para: "DJI" },
    xguri: { letra: "X", nome: "XGuri Portátil", cor: "#E31B23", forte: "#C21419", escura: "#9E1015", clara: "#FEF2F2", para: "XAG" },
  };
  /* camera do Air 2S: sensor de 1" (13,2 x 8,8 mm), lente de 8,4 mm, 5472 px de largura */
  var CAM = { largura: 13.2 / 8.4, altura: 8.8 / 8.4, px: 5472 };
  var NIVEIS = [
    { id: "baixa", nome: "Baixa", f: 65, l: 55, dica: "Voo mais curto. Pode falhar em lavoura fechada." },
    { id: "media", nome: "Média", f: 75, l: 65, dica: "Equilíbrio entre tempo de voo e montagem." },
    { id: "alta", nome: "Alta", f: 80, l: 70, dica: "Recomendada para o ortomosaico." },
    { id: "muito", nome: "Muito alta", f: 85, l: 80, dica: "Soja fechada, pasto: terreno muito parecido." },
  ];
  var VEL = 8;                       // m/s nas linhas
  var CAL = "#1F6FD0";               // cor do ponto de calibracao (a do app de verdade)

  var api = null, raiz = null, doc = null, relogio = null;
  var app = null;                    // "dguri" | "xguri"
  var tela = "inicio";
  var fundo = null;                  // {img, cx, cz, lm, am}: a foto de cima do campo
  var fundoPedido = false;
  var E = novoEstado();

  function novoEstado() {
    /* 21/11/2026 (Eduardo: "o dguri e o xguri tem uma tela antes que pede se quer area toda ou so borda ... estude eles pra fazer melhor"):
       manual (o aluno pilota e as fotos saem sozinhas sobre a area), modo "toda" | "borda", obstaculos, acompanhar terreno */
    return { pontos: [], fechado: false, marcando: false, cal: null, altura: 80, nivel: "alta", plano: null,
             manual: false, modo: "toda", obst: [], obstAtual: [], camada: "area", pergunta: 0, terreno: true, agora: false,
             missao: null, fotos: [], orto: null, montando: null, calibrado: false, calibrando: false, nomeHd: "", hd: null, recado: "", recadoAte: 0 };
  }
  function cenario() { try { return new URLSearchParams(location.search).get("cenario") || "plano"; } catch (e) { return "plano"; } }
  function M() { return MARCAS[app] || MARCAS.dguri; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n, casas) { return Number(n).toFixed(casas || 0).replace(".", ","); }

  /* ------------------------------------------------------------ estilo */
  var CSS = [
    ".guri{position:absolute;inset:0;z-index:30;background:#F4F6F9;color:#141A21;font:500 3.3cqh/1.3 -apple-system,'Segoe UI',Roboto,system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden;user-select:none;-webkit-user-select:none}",
    ".guri[hidden]{display:none}",
    ".guri *{box-sizing:border-box}",
    ":where(.guri) button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer}",
    ".guri__topo{flex:none;display:flex;align-items:center;gap:2.4cqh;padding:2.4cqh 3.4cqh;color:#fff;background:linear-gradient(180deg,var(--g-cor),var(--g-forte));border-radius:0 0 3cqh 3cqh}",
    ".guri__topo .bola{width:7.4cqh;height:7.4cqh;border-radius:50%;background:#fff;color:var(--g-forte);display:grid;place-items:center;font-weight:800;font-size:3.6cqh;flex:none}",
    ".guri__topo h2{margin:0;font-size:4.4cqh;font-weight:600;line-height:1.1}.guri__topo p{margin:.3cqh 0 0;font-size:2.5cqh;opacity:.9}",
    ".guri__topo .volta{font-size:6cqh;line-height:1;width:7cqh;height:7cqh;color:#fff}",
    ".guri__topo .sair{margin-left:auto;font-size:2.8cqh;padding:1.2cqh 2.6cqh;border-radius:99px;background:#ffffff26;color:#fff}",
    ".guri__corpo{flex:1;min-height:0;position:relative;display:flex;gap:2.4cqh;padding:2.6cqh 3.4cqh}",
    ".guri__col{flex:1;min-width:0;display:flex;flex-direction:column;gap:1.8cqh;overflow:auto}",
    ".guri__cartao{display:flex;align-items:center;gap:2.4cqh;background:#fff;border:1px solid #E2E6EC;border-radius:2.2cqh;padding:2.2cqh 2.6cqh;text-align:left;width:100%}",
    ".guri__cartao i{flex:none;width:8cqh;height:8cqh;border-radius:1.8cqh;background:var(--g-clara);color:var(--g-cor);display:grid;place-items:center;font-style:normal;font-size:4.4cqh}",
    ".guri__cartao b{display:block;font-size:3.4cqh;font-weight:600}.guri__cartao span{display:block;font-size:2.5cqh;color:#68717D}",
    ".guri__cartao em{margin-left:auto;font-style:normal;color:#68717D;font-size:4cqh}",
    ".guri__cartao.feito{border-color:var(--g-cor);background:var(--g-clara)}",
    ".guri__sec{font-size:2.6cqh;color:#68717D;margin:.6cqh 0 -.4cqh}",
    ".guri__texto{background:#fff;border:1px solid #E2E6EC;border-radius:2.2cqh;padding:2.2cqh 2.6cqh;font-size:2.8cqh;color:#3b4350}",
    ".guri__texto b{color:#141A21}",
    ".guri__mapa{flex:1;min-width:0;position:relative;border-radius:2.2cqh;overflow:hidden;background:#263326}",
    ".guri__mapa canvas{position:absolute;inset:0;width:100%;height:100%;display:block}",
    /* 21/11/2026 (Eduardo: "tem q aparecer a camera"): na Tela do drone a camera do Air 2S fica grande e o mapa vai para o canto */
    ".guri__vivo{background:#000}",
    /* 21/11/2026 (Eduardo: "falta so aparecer a camera do drone ali no canto e quando clicar aparece tirando foto"): o mapa grande e a camera
       no canto; tocar no canto troca os dois. A cada foto a camera pisca e mostra a contagem */
    ".guri__cam{position:absolute;inset:0;width:100%;height:100%;display:block}",
    ".guri__mini .guri__cam{border-radius:inherit}",
    ".guri__mini{cursor:pointer}",
    ".guri__flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:2;border-radius:inherit}",
    ".guri__flash.on{animation:guriFlash .35s ease-out}@keyframes guriFlash{0%{opacity:.85}100%{opacity:0}}",
    ".guri__foto{position:absolute;right:1.4cqh;top:1.4cqh;z-index:3;background:#000a;color:#fff;border-radius:99px;padding:.6cqh 1.6cqh;font-size:2.4cqh;pointer-events:none}",
    ".guri__mini .guri__foto{font-size:2cqh;right:.8cqh;top:.8cqh}",
    ".guri__cobre{position:absolute;inset:0;z-index:5;background:#0000004d;display:flex;align-items:flex-end}",
    ".guri__folha{width:100%;background:#F4F6F9;border-radius:3.4cqh 3.4cqh 0 0;padding:3.4cqh 4.4cqh 3cqh;display:flex;flex-direction:column;gap:1.8cqh}",
    ".guri__folha h3{margin:0 0 .6cqh;font-size:4.4cqh;font-weight:600}",
    ".guri__op{display:block;width:100%;text-align:left;background:var(--g-clara);border-radius:2.4cqh;padding:2cqh 2.6cqh}",
    ".guri__op b{display:block;color:var(--g-cor);font-size:3.3cqh;font-weight:600}.guri__op span{display:block;font-size:2.6cqh;color:#3b4350}",
    ".guri__folha .fim{display:flex;justify-content:flex-end;gap:3cqh}.guri__folha .fim button{color:var(--g-cor);font-weight:600;padding:1cqh 1.6cqh}",
    ".guri__passo{display:flex;gap:2.4cqh;align-items:flex-start;margin:1.4cqh 0}.guri__passo i{flex:none;width:5cqh;height:5cqh;border-radius:50%;background:var(--g-cor);color:#fff;display:grid;place-items:center;font-style:normal;font-size:2.6cqh;font-weight:700}",
    ".guri__passo b{display:block;font-size:3cqh}.guri__passo span{display:block;font-size:2.5cqh;color:#68717D}",
    ".guri__bt.tab{background:#E9ECF1;border-color:#E9ECF1!important}.guri__bt.tab.sel{background:var(--g-cor);color:#fff}.guri__bt.tab .q{display:inline-block;width:2.4cqh;height:2.4cqh;border-radius:.5cqh;background:#e5352b;margin-right:1cqh;vertical-align:-.3cqh}",
    ".guri__chave{display:flex;align-items:center;gap:2cqh;background:#fff;border:1px solid #E2E6EC;border-radius:1.8cqh;padding:1.6cqh 2.2cqh;font-size:2.9cqh;text-align:left;width:100%}",
    ".guri__chave small{display:block;color:#68717D;font-size:2.3cqh}.guri__chave em{margin-left:auto;flex:none;width:8cqh;height:4.6cqh;border-radius:99px;background:#CBD2DB;position:relative}",
    ".guri__chave em::after{content:'';position:absolute;top:.5cqh;left:.5cqh;width:3.6cqh;height:3.6cqh;border-radius:50%;background:#fff;transition:left .15s}",
    ".guri__chave.on em{background:var(--g-cor)}.guri__chave.on em::after{left:3.9cqh}",
    ".guri__mini{position:absolute;left:1.6cqh;bottom:1.6cqh;width:36%;height:40%;border-radius:1.6cqh;overflow:hidden;z-index:1;box-shadow:0 0 0 1px #ffffff99,0 .6cqh 1.6cqh #0008}",
    ".guri__mapa .dica{position:absolute;left:2cqh;top:2cqh;right:2cqh;background:#fffffff2;border-radius:1.8cqh;padding:1.6cqh 2.2cqh;font-size:2.7cqh;pointer-events:none}",
    ".guri__lado{flex:none;width:62cqh;display:flex;flex-direction:column;gap:1.6cqh;overflow:auto}",
    ".guri__bt{display:block;width:100%;text-align:center;padding:2cqh 2cqh;border-radius:1.8cqh;background:#fff;border:1px solid #CBD2DB!important;font-weight:600;font-size:3cqh}",
    ".guri__bt.cheio{background:var(--g-cor);color:#fff;border-color:var(--g-cor)!important}",
    ".guri__bt.azul{background:" + CAL + ";color:#fff;border-color:" + CAL + "!important}",
    ".guri__bt.azul.fora{background:#fff;color:" + CAL + "}",
    ".guri__bt[disabled]{opacity:.45;cursor:default}",
    ".guri__par{display:flex;gap:1.6cqh}.guri__par>*{flex:1}",
    ".guri__niveis{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.2cqh}",
    ".guri__niveis button{text-align:left;background:#fff;border:1px solid #E2E6EC!important;border-radius:1.6cqh;padding:1.4cqh 1.8cqh;font-size:2.7cqh}",
    ".guri__niveis button small{display:block;color:#68717D;font-size:2.1cqh;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".guri__niveis button.sel{border:2px solid var(--g-cor)!important;background:var(--g-clara);color:var(--g-forte)}",
    ".guri__altura{background:#fff;border:1px solid #E2E6EC;border-radius:1.8cqh;padding:1.6cqh 2.2cqh;font-size:2.9cqh}",
    ".guri__altura input{width:100%;accent-color:var(--g-cor);margin:1cqh 0 0}",
    ".guri__altura small{float:right;color:#68717D;font-size:2.3cqh}",
    ".guri__barra{height:1.6cqh;border-radius:99px;background:#E2E6EC;overflow:hidden}.guri__barra i{display:block;height:100%;background:var(--g-cor);width:0}",
    ".guri__campo{width:100%;font:inherit;padding:1.8cqh 2.2cqh;border-radius:1.8cqh;border:1px solid #CBD2DB;background:#fff;color:#141A21}",
    ".guri__recado{position:absolute;left:50%;bottom:3cqh;transform:translateX(-50%);background:#141A21ee;color:#fff;border-radius:99px;padding:1.4cqh 3.4cqh;font-size:2.8cqh;z-index:5;max-width:90%;text-align:center}",
  ].join("\n");

  /* ------------------------------------------------------------ montagem */
  function montar() {
    if (raiz && raiz.isConnected) return;
    var pai = api.raiz();
    if (!pai) return;
    doc = pai.ownerDocument;
    if (!doc.getElementById("xg-guri-css")) {
      var s = doc.createElement("style");
      s.id = "xg-guri-css"; s.textContent = CSS; doc.head.appendChild(s);
    }
    raiz = doc.createElement("div");
    raiz.className = "guri"; raiz.id = "xg-guri"; raiz.hidden = true;
    pai.appendChild(raiz);
    raiz.addEventListener("click", aoClicar);
    raiz.addEventListener("input", aoMudar);
    raiz.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
  }

  /* 21/11/2026 (Eduardo: "tem que melhorar significativamente a qualidade da imagem nos controles"): o fundo de 720 m (28 cm por pixel)
     ficava borrado quando o mapa aproxima a area desenhada. Com o mapa aproximado, o app tira uma foto de cima SO do pedaco visivel,
     do tamanho da tela (o chao do jogo tem detalhe de centimetros de perto). Refeita quando a vista muda bastante. */
  var perto = null, pertoPedido = null;
  function pedirPerto(v) {
    var lm = v.w * v.mpp, am = v.h * v.mpp, cx = v.x0 + lm / 2, cz = v.z0 + am / 2;
    if (lm > 500) return;                                    // vista larga: o fundo de 720 m basta
    var ok = function (q) { return q && Math.abs(q.cx - cx) < lm * 0.15 && Math.abs(q.cz - cz) < am * 0.15 && Math.abs(q.lm / lm - 1) < 0.25; };
    if (ok(perto) || ok(pertoPedido)) return;
    pertoPedido = { cx: cx, cz: cz, lm: lm * 1.3, am: am * 1.3 };
    var pedido = pertoPedido;
    setTimeout(function () {
      if (pertoPedido !== pedido) return;
      try {
        var px = Math.min(3072, Math.round(v.w * 1.3 * 1.5));
        var f = api.ponte().fotografarDeCima({ cx: pedido.cx, cz: pedido.cz, larguraM: pedido.lm, alturaM: pedido.am, px: px });
        if (!f || !f.imagem) { pertoPedido = null; return; }
        var img = new Image();
        img.onload = function () { if (pertoPedido === pedido) { perto = { img: img, cx: f.centro.x, cz: f.centro.z, lm: f.larguraM, am: f.alturaM }; pertoPedido = null; desenharMapa(); } };
        img.src = f.imagem;
      } catch (e) { pertoPedido = null; }
    }, 250);
  }
  function pedirFundo() {
    if (fundoPedido) return;
    fundoPedido = true;
    setTimeout(function () {
      try {
        var p = api.ponte();
        var b = p.ler("typeof TALHAO !== 'undefined' ? {x: TALHAO.x0 + TALHAO.larg / 2, z: TALHAO.z0 + TALHAO.prof / 2} : (typeof BASE !== 'undefined' ? {x: BASE.x, z: BASE.z} : null)") || { x: 0, z: 0 };
        var f = p.fotografarDeCima({ cx: b.x, cz: b.z, larguraM: 720, alturaM: 450, px: 2560 });
        if (!f || !f.imagem) { fundoPedido = false; return; }
        var img = new Image();
        img.onload = function () { fundo = { img: img, cx: f.centro.x, cz: f.centro.z, lm: f.larguraM, am: f.alturaM }; desenharMapa(); };
        img.src = f.imagem;
      } catch (e) { fundoPedido = false; }
    }, 60);
  }

  function recado(t, ms) { E.recado = t; E.recadoAte = performance.now() + (ms || 3200); desenharRecado(); }
  function desenharRecado() {
    if (!raiz) return;
    var r = raiz.querySelector(".guri__recado");
    var vivo = E.recado && performance.now() < E.recadoAte;
    if (!vivo) { if (r) r.remove(); return; }
    if (!r) { r = doc.createElement("div"); r.className = "guri__recado"; raiz.appendChild(r); }
    r.textContent = E.recado;
  }

  /* ------------------------------------------------------------ contas do plano */
  function areaHa(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a.x * b.z - b.x * a.z; } return Math.abs(s) / 2 / 10000; }

  function planejar() {
    var p = E.pontos, n = NIVEIS.filter(function (v) { return v.id === E.nivel; })[0] || NIVEIS[2];
    if (p.length < 3) return null;
    var h = E.altura, largura = h * CAM.largura, alto = h * CAM.altura;
    if (E.modo === "borda") return planejarBorda(p, n, h, largura, alto);
    var entre = largura * (1 - n.l / 100), passo = alto * (1 - n.f / 100);
    var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    p.forEach(function (q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); });
    var aoLongoDeX = (x1 - x0) >= (z1 - z0);          // linhas no sentido mais comprido da area
    var a0 = aoLongoDeX ? z0 : x0, a1 = aoLongoDeX ? z1 : x1;
    var linhas = [], qtd = Math.max(1, Math.ceil((a1 - a0) / entre)), folga = ((a1 - a0) - (qtd - 1) * entre) / 2;
    for (var i = 0; i < qtd; i++) {
      var c = a0 + folga + i * entre, cortes = [];
      for (var k = 0; k < p.length; k++) {
        var A = p[k], B = p[(k + 1) % p.length];
        var ca = aoLongoDeX ? A.z : A.x, cb = aoLongoDeX ? B.z : B.x;
        if ((ca <= c && cb > c) || (cb <= c && ca > c)) {
          var t = (c - ca) / (cb - ca);
          cortes.push(aoLongoDeX ? A.x + t * (B.x - A.x) : A.z + t * (B.z - A.z));
        }
      }
      if (cortes.length < 2) continue;
      var ini = Math.min.apply(null, cortes), fim = Math.max.apply(null, cortes);
      var seg = aoLongoDeX ? [{ x: ini, z: c }, { x: fim, z: c }] : [{ x: c, z: ini }, { x: c, z: fim }];
      if (linhas.length % 2) seg.reverse();
      linhas.push(seg);
    }
    var fotos = [], dist = 0, ant = null;
    linhas.forEach(function (s, li) {
      var comp = Math.hypot(s[1].x - s[0].x, s[1].z - s[0].z), q = Math.max(1, Math.round(comp / passo)) + 1;
      for (var j = 0; j < q; j++) { var t = q === 1 ? 0 : j / (q - 1); fotos.push({ x: s[0].x + t * (s[1].x - s[0].x), z: s[0].z + t * (s[1].z - s[0].z), linha: li }); }
      if (ant) dist += Math.hypot(s[0].x - ant.x, s[0].z - ant.z);
      dist += comp; ant = s[1];
    });
    return { linhas: linhas, fotos: fotos, dist: dist, min: Math.max(1, Math.round(dist / VEL / 60 + linhas.length * 0.08 + 1)),
             ha: areaHa(p), gsd: h * CAM.largura / CAM.px * 100, largura: largura, alto: alto, aoLongoDeX: aoLongoDeX, altura: h };
  }

  /* ------------------------------------------------------------ mapa (canvas) */
  var vista = null;                  // {x0, z0, mpp, w, h}
  function prepararVista(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, (doc.defaultView.devicePixelRatio || 1));
    var w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var f = fundo || { cx: 0, cz: 0, lm: 720, am: 450 };
    var cx = f.cx, cz = f.cz, lm = f.lm * 0.86, am = f.am * 0.86;
    if (tela !== "area" && E.pontos.length >= 3) {      // depois de desenhar: aproxima da area
      var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      E.pontos.forEach(function (q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); });
      var d = lerDrone();
      if (d && (tela === "voo")) { x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x); z0 = Math.min(z0, d.z); z1 = Math.max(z1, d.z); }
      cx = (x0 + x1) / 2; cz = (z0 + z1) / 2; lm = (x1 - x0) * 1.5 + 60; am = (z1 - z0) * 1.5 + 60;
    }
    var mpp = Math.max(lm / w, am / h);
    vista = { x0: cx - w * mpp / 2, z0: cz - h * mpp / 2, mpp: mpp, w: w, h: h, dpr: dpr };
    return vista;
  }
  function X(x) { return (x - vista.x0) / vista.mpp; }
  function Z(z) { return (z - vista.z0) / vista.mpp; }
  function lerDrone() { return api && api.ler ? api.ler() : null; }

  function desenharMapa() {
    if (!raiz || raiz.hidden) return;
    var cv = raiz.querySelector("[data-mapa] > canvas");
    if (!cv) return;
    var v = prepararVista(cv), g = cv.getContext("2d"), u = v.dpr, m = M();
    g.fillStyle = "#263326"; g.fillRect(0, 0, v.w, v.h);
    if (fundo) g.drawImage(fundo.img, X(fundo.cx - fundo.lm / 2), Z(fundo.cz - fundo.am / 2), fundo.lm / v.mpp, fundo.am / v.mpp);
    if (fundo) pedirPerto(v);
    if (perto && perto.lm < v.w * v.mpp * 2.2) g.drawImage(perto.img, X(perto.cx - perto.lm / 2), Z(perto.cz - perto.am / 2), perto.lm / v.mpp, perto.am / v.mpp);
    /* ortomosaico montado (ou montando): por cima, so onde ha foto */
    if (E.orto && E.orto.img && (tela === "orto" || tela === "calibrar" || tela === "hd" || tela === "pronto")) {
      var o = E.orto, ate = E.montando ? E.montando.feito : E.fotos.length;
      g.save(); g.beginPath();
      for (var i = 0; i < ate && i < E.fotos.length; i++) { var f = E.fotos[i]; g.rect(X(f.x - o.fw / 2), Z(f.z - o.fh / 2), o.fw / v.mpp, o.fh / v.mpp); }
      g.clip();
      g.filter = "saturate(1.25) contrast(1.08)";
      g.drawImage(o.img, X(o.cx - o.lm / 2), Z(o.cz - o.am / 2), o.lm / v.mpp, o.am / v.mpp);
      g.restore();
      g.strokeStyle = "#ffffffcc"; g.lineWidth = 1.5 * u; g.strokeRect(X(o.cx - o.lm / 2), Z(o.cz - o.am / 2), o.lm / v.mpp, o.am / v.mpp);
    }
    var p = E.pontos;
    if (p.length) {
      g.beginPath();
      p.forEach(function (q, i) { if (i) g.lineTo(X(q.x), Z(q.z)); else g.moveTo(X(q.x), Z(q.z)); });
      if (E.fechado) g.closePath();
      g.fillStyle = m.cor + "30"; if (E.fechado && tela !== "orto" && tela !== "pronto" && tela !== "hd" && tela !== "calibrar") g.fill();
      g.strokeStyle = m.cor; g.lineWidth = 2.5 * u; g.stroke();
      if (tela === "area") p.forEach(function (q) { g.beginPath(); g.arc(X(q.x), Z(q.z), 5 * u, 0, 7); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 2.5 * u; g.strokeStyle = m.cor; g.stroke(); });
    }
    /* obstaculos em vermelho (o que esta sendo marcado, so a linha) */
    E.obst.concat(E.obstAtual.length ? [E.obstAtual] : []).forEach(function (pol, k) {
      var aberto = k === E.obst.length;
      g.beginPath(); pol.forEach(function (q, i) { if (i) g.lineTo(X(q.x), Z(q.z)); else g.moveTo(X(q.x), Z(q.z)); });
      if (!aberto) { g.closePath(); g.fillStyle = "#e5352b40"; g.fill(); }
      g.strokeStyle = "#e5352b"; g.lineWidth = 2.5 * u; g.stroke();
      if (tela === "area") pol.forEach(function (q) { g.beginPath(); g.arc(X(q.x), Z(q.z), 4.5 * u, 0, 7); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = "#e5352b"; g.stroke(); });
    });
    if (E.plano && (tela === "plano" || tela === "voo")) {
      g.strokeStyle = "#f59e0b"; g.lineWidth = 2 * u; g.beginPath();
      E.plano.linhas.forEach(function (s, i) { if (i && !E.plano.borda) g.lineTo(X(s[0].x), Z(s[0].z)); else g.moveTo(X(s[0].x), Z(s[0].z)); g.lineTo(X(s[1].x), Z(s[1].z)); });
      g.stroke();
    }
    if (tela === "voo" || tela === "fotos") E.fotos.forEach(function (f) { g.beginPath(); g.arc(X(f.x), Z(f.z), 4 * u, 0, 7); g.fillStyle = "#f59e0b"; g.fill(); g.lineWidth = 1.5 * u; g.strokeStyle = "#fff"; g.stroke(); });
    if (E.cal) {
      var cx = X(E.cal.x), cz = Z(E.cal.z), t = 7 * u;
      g.lineCap = "round"; g.lineWidth = 5 * u; g.strokeStyle = "#fff";
      g.beginPath(); g.moveTo(cx - t, cz - t); g.lineTo(cx + t, cz + t); g.moveTo(cx - t, cz + t); g.lineTo(cx + t, cz - t); g.stroke();
      g.lineWidth = 2.5 * u; g.strokeStyle = CAL; g.stroke();
      g.lineCap = "butt";
    }
    var d = lerDrone();
    if (d && (tela === "voo" || tela === "area" || tela === "plano")) {
      var dx = X(d.x), dz = Z(d.z);
      g.save(); g.translate(dx, dz); g.rotate(-d.yaw + Math.PI / 2);
      g.beginPath(); g.moveTo(0, -9 * u); g.lineTo(6.5 * u, 7 * u); g.lineTo(0, 3.5 * u); g.lineTo(-6.5 * u, 7 * u); g.closePath();
      g.fillStyle = "#2563eb"; g.fill(); g.lineWidth = 1.6 * u; g.strokeStyle = "#fff"; g.stroke(); g.restore();
    }
  }

  /* ------------------------------------------------------------ telas */
  function topo(titulo, sub, voltar) {
    var m = M();
    return '<div class="guri__topo">' + (voltar ? '<button class="volta" data-g="' + voltar + '" aria-label="Voltar">‹</button>' : '<div class="bola">' + m.letra + '</div>') +
      '<div><h2>' + esc(titulo) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' +
      '<button class="sair" data-g="sair">Fechar o app</button></div>';
  }
  function cartao(acao, icone, titulo, texto, classe) {
    return '<button class="guri__cartao ' + (classe || "") + '" data-g="' + acao + '"><i>' + icone + '</i><div><b>' + titulo + '</b><span>' + texto + '</span></div><em>›</em></button>';
  }
  function mapaHtml(dica) { return '<div class="guri__mapa" data-mapa><canvas></canvas>' + (dica ? '<div class="dica">' + dica + '</div>' : '') + '</div>'; }

  /* "So a borda e os obstaculos" (como no app): passa na linha da area e da uma volta em cada obstaculo marcado */
  function planejarBorda(p, n, h, largura, alto) {
    var passo = alto * (1 - n.f / 100), linhas = [];
    [p].concat(E.obst).forEach(function (pol) { for (var k = 0; k < pol.length; k++) linhas.push([pol[k], pol[(k + 1) % pol.length]]); });
    var fotos = [], dist = 0, ant = null;
    linhas.forEach(function (s, li) {
      var comp = Math.hypot(s[1].x - s[0].x, s[1].z - s[0].z), q = Math.max(1, Math.round(comp / passo));
      for (var j = 0; j < q; j++) { var t = j / q; fotos.push({ x: s[0].x + t * (s[1].x - s[0].x), z: s[0].z + t * (s[1].z - s[0].z), linha: li }); }
      if (ant) dist += Math.hypot(s[0].x - ant.x, s[0].z - ant.z);
      dist += comp; ant = s[1];
    });
    return { linhas: linhas, fotos: fotos, dist: dist, min: Math.max(1, Math.round(dist / VEL / 60 + 1)), ha: areaHa(p), gsd: h * CAM.largura / CAM.px * 100,
             largura: largura, alto: alto, aoLongoDeX: true, altura: h, borda: true };
  }
  function dentro(q, pol) {
    var c = false;
    for (var i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      var a = pol[i], b = pol[j];
      if ((a.z > q.z) !== (b.z > q.z) && q.x < (b.x - a.x) * (q.z - a.z) / (b.z - a.z) + a.x) c = !c;
    }
    return c;
  }
  function folha(titulo, ops, fim) {
    return '<div class="guri__cobre"><div class="guri__folha"><h3>' + titulo + '</h3>' +
      ops.map(function (o) { return '<button class="guri__op" data-g="' + o[0] + '" data-v="' + o[1] + '"><b>' + o[2] + '</b><span>' + o[3] + '</span></button>'; }).join("") +
      '<div class="fim">' + fim + '</div></div></div>';
  }
  function modoTexto() { return (E.manual ? "Manual · " : "Automático · ") + (E.modo === "borda" ? "Borda e obstáculos" : "Área toda"); }

  function desenhar() {
    if (!raiz) return;
    var m = M(), h = "", x = app === "xguri";
    raiz.style.setProperty("--g-cor", m.cor); raiz.style.setProperty("--g-forte", m.forte); raiz.style.setProperty("--g-clara", m.clara);
    var guardado = window.GURI_MAPAS.tem(cenario(), x ? "hd" : "orto");
    if (tela === "inicio") {
      h = topo(m.nome, "Mapeamento e mapa de aplicação no celular") + '<div class="guri__corpo"><div class="guri__col">' +
        (E.fotos.length && !E.missao ? cartao("fotos", "▶", "Continuar o mapa em andamento", E.fotos.length + " foto(s) do último voo.") : "") +
        cartao("intro", "✈", "Tirar as fotos", "Desenhe a área e voe no automático ou no manual guiado.") +
        cartao("fotos", "▤", "Gerar ortomosaico", "Monta o mosaico e o mapa de aplicação para a " + m.para + ".") +
        '</div><div class="guri__col">' +
        (guardado ? '<div class="guri__cartao feito"><i>✓</i><div><b>' + (x ? "Mapa HD pronto: " + esc(guardado.nome || "") : "Ortomosaico armazenado") + '</b><span>' +
          (x ? "Já aparece no controle da XAG deste campo" + (guardado.calibrado ? "." : " (sem calibração).") : "Já aparece no mapa dos controles DJI deste campo.") + '</span></div></div>' : "") +
        '</div></div>';
    } else if (tela === "intro") {
      /* a porta de entrada do app (IntroRotasView): explica o caminho e so entao pergunta quem voa e o que fotografar */
      var passo = function (n, t, d) { return '<div class="guri__passo"><i>' + n + '</i><div><b>' + t + '</b><span>' + d + '</span></div></div>'; };
      h = topo("Mapear a área", "O app prepara o voo para as fotos do ortomosaico", "inicio") + '<div class="guri__corpo"><div class="guri__col"><div class="guri__texto"><b>Como funciona</b>' +
        passo(1, "Automático ou manual", "No automático o drone voa sozinho. No manual você pilota e o app guia e fotografa.") +
        passo(2, "Área toda ou só a borda", "Área toda cobre a lavoura. Só a borda passa na linha da área e fotografa cada obstáculo.") +
        passo(3, "Desenhe a área", "Toque no mapa nos cantos; na borda, marque também obstáculos e rede elétrica.") +
        '</div></div><div class="guri__col"><div class="guri__texto">' +
        passo(4, "Altura e sobreposição", "Escolha a altura (até 120 m) e quanto uma foto cobre a outra.") +
        passo(5, "Tela do drone", "Check list, decolagem e missão, com a área em azul sobre a câmera.") +
        '</div><button class="guri__bt cheio" data-g="perguntar">✎ Desenhar área</button></div></div>' +
        (E.pergunta === 1 ? folha("Como vai mapear?", [["quem", "auto", "Mapear automático", "O app gera a rota e o drone voa sozinho."],
                                                     ["quem", "manual", "Mapear manualmente", "Você pilota. A área aparece em azul na câmera e as fotos saem sozinhas."]],
                                  '<button data-g="semPergunta">Cancelar</button>') :
         E.pergunta === 2 ? folha(E.manual ? "Manual: o que fotografar?" : "Automático: o que fotografar?",
                                  [["oque", "toda", "Área toda", "Cobre a lavoura inteira. Gera o ortomosaico completo."],
                                   ["oque", "borda", "Só a borda e os obstáculos", "Menos fotos e voo mais curto. Suficiente para o mapa de aplicação."]],
                                  '<button data-g="perguntar">Voltar</button>') : "");
    } else if (tela === "area") {
      /* 21/11/2026 (Eduardo: "nao tem ponto de calibracao aqui"): como no AreaMapView do app, sem o ponto de calibracao; embaixo as camadas
         "Area" e "Obstaculo" */
      var ob = E.camada === "obst", qtd = E.pontos.length;
      var dica = ob ? "Marque em volta do obstáculo e feche o polígono." :
        !E.fechado ? (qtd < 3 ? "Toque em volta da área (mínimo 3 pontos). Pontos: " + qtd : "Toque em Fechar polígono.") :
        E.modo === "borda" ? "Marque e feche os obstáculos. Depois toque em Confirmar para gerar as rotas." : "Toque em Confirmar para gerar as rotas.";
      var podeFechar = ob ? E.obstAtual.length >= 3 : qtd >= 3 && !E.fechado;
      h = topo("Desenhar a área", modoTexto(), "intro") + '<div class="guri__corpo">' + mapaHtml(dica) +
        '<div class="guri__lado">' +
        '<button class="guri__bt" data-g="fechar" ' + (podeFechar ? "" : "disabled") + '>Fechar polígono</button>' +
        '<div class="guri__par"><button class="guri__bt" data-g="desfazer" ' + (qtd || E.obst.length || E.obstAtual.length ? "" : "disabled") + '>Desfazer</button><button class="guri__bt" data-g="limpar" ' + (qtd || E.obst.length || E.obstAtual.length ? "" : "disabled") + '>Limpar</button></div>' +
        '<div class="guri__par"><button class="guri__bt tab' + (ob ? "" : " sel") + '" data-g="camada" data-v="area">Área (' + (E.fechado ? 1 : 0) + ')</button>' +
        '<button class="guri__bt tab' + (ob ? " sel" : "") + '" data-g="camada" data-v="obst"><span class="q"></span>Obstáculo' + (E.obst.length ? " (" + E.obst.length + ")" : "") + '</button></div>' +
        '<button class="guri__bt cheio" data-g="confirmar" ' + (E.fechado && !E.obstAtual.length ? "" : "disabled") + '>Confirmar</button>' +
        '</div></div>';
    } else if (tela === "plano") {
      var P = E.plano;
      h = topo("Altura e sobreposição", P ? modoTexto() + " · " + P.fotos.length + " fotos · " + fmt(P.dist / 1000, 1) + " km · " + P.min + " min" : "", "area") + '<div class="guri__corpo">' + mapaHtml("") +
        '<div class="guri__lado">' +
        '<div class="guri__altura">Altura sobre o chão: <b>' + E.altura + ' m</b><small>máx. 120 m (lei)</small><input type="range" min="30" max="120" step="5" value="' + E.altura + '" data-g-altura></div>' +
        '<button class="guri__chave' + (E.terreno ? " on" : "") + '" data-g="terreno"><span>Acompanhar terreno<small>O drone sobe e desce junto para ficar a ' + E.altura + ' m do chão.</small></span><em></em></button>' +
        '<div class="guri__sec">Nível de sobreposição das fotos</div><div class="guri__niveis">' +
        NIVEIS.map(function (n) { return '<button data-g="nivel" data-v="' + n.id + '" class="' + (n.id === E.nivel ? "sel" : "") + '">' + n.nome + ' &nbsp;' + n.f + '% / ' + n.l + '%<small>' + n.dica + '</small></button>'; }).join("") + '</div>' +
        (P ? '<div class="guri__texto">Área: <b>' + fmt(P.ha, 2) + ' ha</b> · Linhas de voo: <b>' + P.linhas.length + '</b><br>GSD estimado: <b>' + fmt(P.gsd, 1) + ' cm/px</b></div>' : "") +
        '<div class="guri__par"><button class="guri__bt" data-g="editar">Editar desenho</button><button class="guri__bt cheio" data-g="continuar">Continuar</button></div>' +
        '</div></div>' +
        (E.agora ? folha("Salvar o plano ou tirar as fotos agora?", [["tirar", "", "Tirar as fotos agora", "Vai para a Tela do drone: check list, decolagem e missão."]],
                         '<button data-g="semAgora">Cancelar</button>') : "");
    } else if (tela === "voo") {
      var ms = E.missao, d = lerDrone(), con = api.conectado(), total = E.plano ? E.plano.fotos.length : 0;
      var estado = !con ? "Conecte o controle e ligue o drone." : E.manual ? (E.avisoManual || "Manual: você pilota. Foto automática ligada sobre a área.") : !ms ? "Missão pronta. Toque em Iniciar para começar o voo." :
        ms.fase === "decolando" ? "Decolando…" : ms.fase === "subindo" ? "Subindo até " + E.altura + " m…" : ms.fase === "indo" ? "Indo para a primeira linha…" :
        ms.fase === "linhas" ? "Fotografando · linha " + (ms.linha + 1) + " de " + E.plano.linhas.length : ms.fase === "pausada" ? "Missão pausada: você mexeu no controle." :
        ms.fase === "fim" ? "Missão concluída! Vá para a exportação das fotos." : "";
      var camera = '<canvas class="guri__cam"></canvas><i class="guri__flash"></i><span class="guri__foto">📷 <b data-g-n2>' + E.fotos.length + '</b></span>';
      h = topo("Tela do drone", estado, "plano") + '<div class="guri__corpo">' + (E.camGrande
        ? '<div class="guri__mapa guri__vivo">' + camera + '<div class="guri__mini" data-mapa data-g="trocarCam"><canvas></canvas></div></div>'
        : '<div class="guri__mapa" data-mapa><canvas></canvas><div class="guri__mini guri__vivo" data-g="trocarCam">' + camera + '</div></div>') +
        '<div class="guri__lado">' +
        '<div class="guri__texto">Fotos: <b data-g-n>' + E.fotos.length + '</b> de <b>' + total + '</b><div class="guri__barra" style="margin-top:1.2cqh"><i data-g-barra style="width:' + (total ? 100 * E.fotos.length / total : 0) + '%"></i></div>' +
        '<div style="margin-top:1.4cqh">Altura: <b data-g-alt>' + (d ? fmt(Math.max(0, d.y - d.solo), 0) : "0") + ' m</b> · Bateria: <b data-g-bat>' + (d ? Math.round(d.bat) : "--") + '%</b></div></div>' +
        (E.manual ? '<button class="guri__bt cheio" data-g="fotos" ' + (E.fotos.length ? "" : "disabled") + '>Ir para as fotos</button>' :
          !ms ? '<button class="guri__bt cheio" data-g="iniciar" ' + (con ? "" : "disabled") + '>Iniciar</button>' :
          ms.fase === "pausada" ? '<button class="guri__bt cheio" data-g="retomar">Continuar a missão</button>' :
          ms.fase === "fim" ? '<button class="guri__bt cheio" data-g="fotos">Ir para as fotos</button>' :
          '<button class="guri__bt" data-g="parar">Parar a missão</button>') +
        (ms && ms.fase === "pausada" ? '<button class="guri__bt" data-g="fotos" ' + (E.fotos.length ? "" : "disabled") + '>Terminar com as fotos que tem</button>' : "") +
        '<div class="guri__texto">' + (E.manual ? "Você pilota pelos manches. Passe por cima da área a " + E.altura + " m com a câmera para baixo (-90°): o app fotografa sozinho e marca no mapa o que já foi coberto."
          : "O app pilota sozinho. Se você mexer nos manches, a missão para e o drone fica com você. O drone não desvia sozinho de árvore, fio ou torre: confira a altura.") + '</div>' +
        '</div></div>';
    } else if (tela === "fotos") {
      h = topo("Gerar ortomosaico", "Onde ficaram as fotos", "inicio") + '<div class="guri__corpo">' + mapaHtml(E.fotos.length ? E.fotos.length + " foto(s) com GPS prontas para uso. Confira se estão só na área do voo." : "Nenhuma foto ainda. Faça o voo em “Tirar as fotos”.") +
        '<div class="guri__lado"><button class="guri__bt cheio" data-g="processar" ' + (E.fotos.length >= 4 ? "" : "disabled") + '>Processar essas fotos</button>' +
        '<button class="guri__bt" data-g="inicio">Voltar</button>' +
        (E.fotos.length && E.fotos.length < 4 ? '<div class="guri__texto">São poucas fotos para montar o mosaico (mínimo 4).</div>' : "") + '</div></div>';
    } else if (tela === "orto") {
      var mo = E.montando, pronto = !mo && E.orto && E.orto.img;
      h = topo(pronto ? "Ortomosaico gerado" : "Montando o ortomosaico…", pronto ? fmt(E.orto.lm * E.orto.am / 10000, 2) + " ha fotografados" : "Deixe o app aberto até terminar.", pronto ? "inicio" : "") + '<div class="guri__corpo">' + mapaHtml("") +
        '<div class="guri__lado">' +
        (pronto ? "" : '<div class="guri__texto">Encaixando fotos vizinhas (<b data-g-n>' + (mo ? mo.feito : 0) + '</b>/' + E.fotos.length + ')<div class="guri__barra" style="margin-top:1.2cqh"><i data-g-barra></i></div></div>') +
        (pronto && !x ? '<button class="guri__bt cheio" data-g="armazenar">Armazenar (para os controles DJI)</button><div class="guri__texto">Armazenado, o ortomosaico aparece no mapa de todos os controles da DJI neste campo.</div>' : "") +
        (pronto && x ? '<button class="guri__bt cheio" data-g="irCalibrar">Continuar: calibrar e gerar o Mapa HD</button>' : "") +
        '</div></div>';
    } else if (tela === "calibrar") {
      h = topo("Calibrar ortomosaico", "Acerta a posição do mapa com o ponto conhecido", "orto") + '<div class="guri__corpo">' +
        mapaHtml(E.calibrando ? "Toque em cima do X que aparece no mosaico." : "") + '<div class="guri__lado">' +
        '<div class="guri__texto"><b>Como funciona</b><br>Você marca o X no mosaico e o app usa a coordenada certa do ponto (a do RTK) para deslocar o mapa. Sem calibrar, o controle pode recusar a rota porque o mapa não bate com o RTK.</div>' +
        (E.calibrado ? '<div class="guri__cartao feito"><i>✓</i><div><b>Calibração concluída</b><span>O mapa foi deslocado para a posição certa.</span></div></div>' : "") +
        (E.calibrado ? "" : '<button class="guri__bt azul' + (E.calibrando ? "" : " fora") + '" data-g="marcarX" ' + (E.cal ? "" : "disabled") + '>Calibrar</button>') +
        (!E.cal ? '<div class="guri__texto">Este voo não tem ponto de calibração. Ele é criado na tela de desenhar a área, antes de voar.</div>' : "") +
        '<button class="guri__bt' + (E.calibrado ? " cheio" : "") + '" data-g="irHd">' + (E.calibrado ? "Continuar" : "Não calibrar") + '</button>' +
        '</div></div>';
    } else if (tela === "hd") {
      var hd = E.hd;
      h = topo("Enviar para o controle", "Mapa HD para o controle da XAG", hd ? "" : "calibrar") + '<div class="guri__corpo">' + mapaHtml("") + '<div class="guri__lado">' +
        (!hd ? '<div class="guri__sec">Nome do mapa</div><input class="guri__campo" data-g-nome maxlength="24" value="' + esc(E.nomeHd) + '">' +
          '<button class="guri__bt cheio" data-g="gerarHd">Gerar Mapa HD</button>' +
          (E.calibrado ? "" : '<div class="guri__texto"><b>Continuar sem calibração?</b> O mapa pode ficar deslocado em relação ao RTK do drone.</div>') :
          hd.pronto ? '<div class="guri__cartao feito"><i>✓</i><div><b>Mapa HD pronto: ' + esc(E.nomeHd) + '</b><span>Já aparece no controle da XAG deste campo.</span></div></div><button class="guri__bt cheio" data-g="inicio">Pronto</button>' :
          '<div class="guri__texto"><b data-g-fase>' + esc(hd.texto) + '</b><div class="guri__barra" style="margin-top:1.2cqh"><i data-g-barra style="width:' + hd.pc + '%"></i></div><div style="margin-top:1.2cqh">Deixe o app aberto até terminar.</div></div>') +
        '</div></div>';
    } else if (tela === "pronto") {
      h = topo("Armazenamento de mapas", "Ortomosaico armazenado", "inicio") + '<div class="guri__corpo">' + mapaHtml("") + '<div class="guri__lado">' +
        '<div class="guri__cartao feito"><i>✓</i><div><b>Ortomosaico armazenado</b><span>Já aparece no mapa dos controles DJI deste campo.</span></div></div>' +
        '<button class="guri__bt cheio" data-g="inicio">Pronto</button></div></div>';
    }
    raiz.innerHTML = h;
    ligarCam();
    desenharMapa();
    desenharRecado();
  }

  /* a camera ao vivo: o mesmo caminho do DJI Fly (app_fly.ligarCamera): o campo copia a imagem da camFpv para cada canvas da lista
     window.xgFpvAlvos. O canvas da tela anterior sai da lista (o desenho e refeito a cada mudanca de tela). */
  var camAtual = null;
  function ligarCam() {
    var j = api && api.janela ? api.janela() : null, novo = raiz ? raiz.querySelector(".guri__cam") : null;
    if (!j) return;
    var alvos = j.xgFpvAlvos;
    if (alvos && camAtual && camAtual !== novo) { var i = alvos.indexOf(camAtual); if (i >= 0) alvos.splice(i, 1); }
    camAtual = novo;
    if (!novo) return;
    if (alvos && alvos.push) { if (alvos.indexOf(novo) < 0) alvos.push(novo); }
    else { var p = api.ponte ? api.ponte() : null; if (p && p.cameraNoControle) p.cameraNoControle([novo]); }
  }

  function mostrar(qual) { tela = qual; if (qual !== "area") E.marcando = false; if (qual !== "calibrar") E.calibrando = false; desenhar(); }

  /* ------------------------------------------------------------ cliques */
  function aoMudar(e) {
    var t = e.target;
    if (t.hasAttribute("data-g-altura")) { E.altura = +t.value; E.plano = planejar(); desenhar(); }
    if (t.hasAttribute("data-g-nome")) E.nomeHd = t.value;
    e.stopPropagation();
  }

  function aoClicar(e) {
    e.stopPropagation();
    var b = e.target.closest("[data-g]");
    if (b) { if (!b.disabled) acao(b.getAttribute("data-g"), b.getAttribute("data-v")); return; }
    var mp = e.target.closest("[data-mapa]");
    if (mp && vista) {
      var r = mp.getBoundingClientRect();
      var x = vista.x0 + (e.clientX - r.left) / r.width * vista.w * vista.mpp, z = vista.z0 + (e.clientY - r.top) / r.height * vista.h * vista.mpp;
      toqueNoMapa(x, z);
    }
  }

  function toqueNoMapa(x, z) {
    if (tela === "area") {
      if (E.camada === "obst") { E.obstAtual.push({ x: x, z: z }); desenhar(); return; }
      if (E.fechado) return;
      E.pontos.push({ x: x, z: z }); desenhar();
    } else if (tela === "calibrar" && E.calibrando && E.cal) {
      var d = Math.hypot(x - E.cal.x, z - E.cal.z);
      if (d <= Math.max(4, vista.mpp * 26)) { E.calibrado = true; E.calibrando = false; desenhar(); }
      else recado("Esse não é o X. Procure o X branco no mosaico e toque em cima dele.");
    }
  }

  /* o X do ponto de calibracao pintado no chao do campo (sai na foto de cima) */
  function pintarX() {
    var c = E.cal;
    try {
      api.ponte().rodar("(function(){ if (typeof THREE === 'undefined' || typeof cena === 'undefined') return;" +
        "var v = cena.getObjectByName('xgPontoCalibracao'); if (v) cena.remove(v);" + (c ?
        "var g = new THREE.Group(); g.name = 'xgPontoCalibracao';" +
        "var m = new THREE.MeshBasicMaterial({ color: 0xffffff });" +
        "[1, -1].forEach(function (s) { var b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 0.5), m); b.rotation.y = s * Math.PI / 4; g.add(b); });" +
        "g.position.set(" + c.x + ", (typeof alt === 'function' ? alt(" + c.x + "," + c.z + ") : 0) + 0.06, " + c.z + "); cena.add(g);" : "") +
        "})()");
    } catch (e) { /* o X fica so no mapa do app */ }
  }

  function acao(a, v) {
    switch (a) {
      case "sair": fechar(); return;
      case "inicio": mostrar("inicio"); return;
      case "mapear": mostrar("area"); return;
      case "intro": E.pergunta = 0; mostrar("intro"); return;
      case "perguntar": E.pergunta = 1; desenhar(); return;
      case "semPergunta": E.pergunta = 0; desenhar(); return;
      case "quem": E.manual = v === "manual"; E.pergunta = 2; desenhar(); return;
      case "oque": E.modo = v === "borda" ? "borda" : "toda"; E.pergunta = 0; E.camada = "area"; E.plano = null; mostrar("area"); return;
      case "camada": E.camada = v === "obst" ? "obst" : "area"; E.obstAtual = []; desenhar(); return;
      case "terreno": E.terreno = !E.terreno; desenhar(); return;
      case "semAgora": E.agora = false; desenhar(); return;
      case "trocarCam": E.camGrande = !E.camGrande; desenhar(); return;
      case "tirar": E.agora = false; E.missao = null; mostrar("voo"); return;
      case "fechar":
        if (E.camada === "obst") { if (E.obstAtual.length >= 3) { E.obst.push(E.obstAtual); E.obstAtual = []; } }
        else E.fechado = true;
        desenhar(); return;
      case "desfazer":
        if (E.camada === "obst") { if (E.obstAtual.length) E.obstAtual.pop(); else E.obst.pop(); }
        else if (E.fechado) E.fechado = false; else E.pontos.pop();
        desenhar(); return;
      case "limpar": E.pontos = []; E.fechado = false; E.obst = []; E.obstAtual = []; E.cal = null; E.marcando = false; pintarX(); desenhar(); return;
      case "cal": E.marcando = !E.marcando; desenhar(); return;
      case "confirmar":
        E.plano = planejar(); if (!E.plano || !E.plano.linhas.length) { recado("A área ficou pequena demais. Desenhe de novo."); return; }
        /* o ponto de calibracao saiu do desenho (o app nao tem): no XGuri o X fica no chao, num canto da area (como um marco ou canto
           de cerca), para depois calibrar o ortomosaico; o DGuri nao calibra */
        if (app === "xguri") {
          var c0 = E.pontos[0], cx = 0, cz = 0;
          E.pontos.forEach(function (q) { cx += q.x / E.pontos.length; cz += q.z / E.pontos.length; });
          var dd = Math.hypot(cx - c0.x, cz - c0.z) || 1;
          E.cal = { x: c0.x + (cx - c0.x) / dd * 6, z: c0.z + (cz - c0.z) / dd * 6 };
        } else E.cal = null;
        pintarX();
        mostrar("plano"); return;
      case "nivel": E.nivel = v; E.plano = planejar(); desenhar(); return;
      case "editar": mostrar("area"); return;
      case "continuar": E.agora = true; desenhar(); return;
      case "iniciar": iniciarMissao(0); return;
      case "retomar": iniciarMissao(E.missao ? E.missao.proxima : 0); return;
      case "parar": if (E.missao) { E.missao.fase = "pausada"; api.cancelarAuto(""); desenhar(); } return;
      case "fotos": if (E.missao && E.missao.fase !== "fim" && E.missao.fase !== "pausada") return; mostrar("fotos"); return;
      case "processar": processar(); return;
      case "armazenar": guardar("orto", { nome: "Ortomosaico " + new Date().toLocaleDateString("pt-BR") }).then(function () { mostrar("pronto"); }); return;
      case "irCalibrar": mostrar("calibrar"); return;
      case "marcarX": E.calibrando = !E.calibrando; desenhar(); return;
      case "irHd": if (!E.nomeHd) E.nomeHd = "mapa " + cenario(); E.hd = null; mostrar("hd"); return;
      case "gerarHd": gerarHd(); return;
    }
  }

  /* ------------------------------------------------------------ a missao (o app pilota) */
  function iniciarMissao(aPartirDe) {
    if (!api.conectado()) { recado("Aeronave desconectada."); return; }
    var P = E.plano;
    if (!P) return;
    if (!aPartirDe) E.fotos = [];
    var d = lerDrone();
    E.missao = { fase: "decolando", proxima: aPartirDe || 0, linha: 0, desde: performance.now(), chao: d ? d.solo : 0 };
    if (d && !api.noAr(d)) api.decolar();
    desenhar();
  }

  /* chamado a cada volta do relogio: liga a automacao quando o drone esta no ar */
  function cuidarDaMissao() {
    var ms = E.missao, d = lerDrone();
    if (!ms || !d || ms.fase === "fim" || ms.fase === "pausada") return;
    if (d.est === "caiu") { ms.fase = "pausada"; recado("O drone caiu. A missão parou."); desenhar(); return; }
    var nome = api.auto();
    if (nome === "guriMissao") return;
    if (ms.fase === "decolando") {
      if (nome === "decolar") return;
      if (!api.noAr(d)) { if (performance.now() - ms.desde > 9000) { ms.fase = "pausada"; recado("O drone não decolou."); desenhar(); } return; }
      ms.fase = "subindo";
      ligarAuto();
      desenhar();
      return;
    }
    /* a automacao caiu sem terminar: o piloto mexeu nos manches */
    ms.fase = "pausada"; recado("Missão pausada. O drone está com você."); desenhar();
  }

  function ligarAuto() {
    var P = E.plano, ms = E.missao, j = api.janela();
    api.iniciarAuto({
      nome: "guriMissao", titulo: "Missão", limites: true,
      passo: function (r) {
        var alvoY = (E.terreno ? r.solo : ms.chao) + P.altura, vy = Math.max(-3, Math.min(4, (alvoY - r.y) * 0.9));
        if (j) j.xgGimbal = -90;
        if (ms.fase === "subindo") {
          api.voarCom(r, 0, vy, 0, null);
          if (r.y - r.solo >= Math.min(P.altura - 2, 25)) { ms.fase = "indo"; desenhar(); }
          return false;
        }
        var f = P.fotos[ms.proxima];
        if (!f) { ms.fase = "fim"; desenhar(); return true; }
        var dx = f.x - r.x, dz = f.z - r.z, dist = Math.hypot(dx, dz);
        var naLinha = ms.fase === "linhas" && ms.proxima > 0 && P.fotos[ms.proxima - 1].linha === f.linha;
        var perto = naLinha ? 2.5 : 3.5, alturaBoa = Math.abs(alvoY - r.y) < 4;
        if (dist < perto && alturaBoa) {
          E.fotos.push({ x: r.x, z: r.z });
          var mudou = ms.fase !== "linhas" || ms.linha !== f.linha;
          ms.linha = f.linha; ms.fase = "linhas"; ms.proxima++;
          if (mudou) desenhar(); else atualizarVoo();
          return false;
        }
        var vel = Math.min(naLinha ? VEL : 11, Math.max(1.2, dist * 0.7));
        if (!alturaBoa && ms.fase !== "linhas") vel = Math.min(vel, 5);
        api.voarCom(r, dx / dist * vel, vy, dz / dist * vel, Math.atan2(-dz, dx));
        return false;
      },
      aoFim: function (ok) {
        if (ok && ms.fase === "fim") { recado("Missão concluída! O drone volta para casa."); try { api.rth(); } catch (e) { /* o piloto pousa */ } }
      },
    });
  }

  function atualizarVoo() {
    if (!raiz || tela !== "voo") return;
    var n = raiz.querySelector("[data-g-n]"), b = raiz.querySelector("[data-g-barra]"), total = E.plano ? E.plano.fotos.length : 0;
    if (n) n.textContent = E.fotos.length;
    var n2 = raiz.querySelector("[data-g-n2]"), fl = raiz.querySelector(".guri__flash");
    if (n2 && n2.textContent !== String(E.fotos.length)) {
      n2.textContent = E.fotos.length;
      if (fl) { fl.classList.remove("on"); void fl.offsetWidth; fl.classList.add("on"); }
    }
    if (b && total) b.style.width = (100 * E.fotos.length / total) + "%";
  }

  /* ------------------------------------------------------------ ortomosaico e Mapa HD */
  function processar() {
    var P = E.plano, fw = P ? P.largura : 120, fh = P ? P.alto : 80;
    var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    E.fotos.forEach(function (f) { x0 = Math.min(x0, f.x - fw / 2); x1 = Math.max(x1, f.x + fw / 2); z0 = Math.min(z0, f.z - fh / 2); z1 = Math.max(z1, f.z + fh / 2); });
    var lm = x1 - x0, am = z1 - z0, px = Math.round(Math.min(4096, Math.max(1024, lm * 14)));
    E.orto = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, lm: lm, am: am, fw: fw, fh: fh, img: null, url: "" };
    E.montando = { feito: 0 }; E.calibrado = false; E.hd = null;
    mostrar("orto");
    setTimeout(function () {
      var f = null;
      try { f = api.ponte().fotografarDeCima({ cx: E.orto.cx, cz: E.orto.cz, larguraM: lm, alturaM: am, px: px }); } catch (e) { f = null; }
      if (!f || !f.imagem) { E.montando = null; recado("Não deu para montar o mosaico. Tente de novo."); mostrar("fotos"); return; }
      var img = new Image();
      img.onload = function () { E.orto.img = img; E.orto.url = f.imagem; E.orto.px = px; };
      img.src = f.imagem;
    }, 80);
  }

  function seguirMontagem() {
    var mo = E.montando;
    if (!mo || tela !== "orto") return;
    if (!E.orto || !E.orto.img) return;
    mo.feito = Math.min(E.fotos.length, mo.feito + Math.max(1, Math.ceil(E.fotos.length / 60)));
    var n = raiz.querySelector("[data-g-n]"), b = raiz.querySelector("[data-g-barra]");
    if (n) n.textContent = mo.feito;
    if (b) b.style.width = (100 * mo.feito / E.fotos.length) + "%";
    desenharMapa();
    if (mo.feito >= E.fotos.length) { E.montando = null; desenhar(); }
  }

  function guardar(tipo, extra) {
    var o = E.orto, m = { imagem: o.url, cx: o.cx, cz: o.cz, lm: o.lm, am: o.am, px: o.px, quando: Date.now(), fotos: E.fotos.length,
                          altura: E.plano ? E.plano.altura : E.altura, poligono: E.pontos.slice(), calibrado: !!E.calibrado, cal: E.cal, cenario: cenario() };
    Object.keys(extra || {}).forEach(function (k) { m[k] = extra[k]; });
    return window.GURI_MAPAS.salvar(cenario(), tipo, m).catch(function () { recado("Não deu para guardar o mapa neste navegador."); });
  }

  var FASES_HD = [[0, "Montando a nuvem de pontos do relevo..."], [34, "Gerando o ortomosaico"], [72, "Gerando o relevo do Mapa HD..."]];
  function gerarHd() {
    if (!E.nomeHd.trim()) { recado("Dê um nome ao mapa."); return; }
    E.hd = { pc: 0, texto: FASES_HD[0][1], pronto: false, desde: performance.now() };
    desenhar();
  }
  function seguirHd() {
    var hd = E.hd;
    if (!hd || hd.pronto || hd.salvando) return;
    hd.pc = Math.min(100, (performance.now() - hd.desde) / 9000 * 100);
    var fase = FASES_HD.filter(function (f) { return hd.pc >= f[0]; }).pop();
    hd.texto = fase[1] + (fase[0] === 34 ? " " + Math.round((hd.pc - 34) / 38 * 100) + "%" : "");
    if (tela === "hd" && raiz) {
      var t = raiz.querySelector("[data-g-fase]"), b = raiz.querySelector("[data-g-barra]");
      if (t) t.textContent = hd.texto;
      if (b) b.style.width = hd.pc + "%";
    }
    if (hd.pc >= 100) {
      hd.salvando = true;
      guardar("hd", { nome: E.nomeHd.trim() }).then(function () { hd.pronto = true; if (tela === "hd") desenhar(); });
    }
  }

  /* ------------------------------------------------------------ relogio */
  var ultimoDesenho = 0;
  /* manual (Eduardo: "no manual voce pilota e o app guia e fotografa"): com a Tela do drone aberta, o app fotografa sozinho quando o drone
     passa por cima da area (ou da borda), perto da altura do plano e com a camera para baixo; nao repete foto no mesmo lugar */
  function fotografarNoManual() {
    var P = E.plano, d = lerDrone();
    if (!E.manual || !P || tela !== "voo" || !d || !api.conectado() || !api.noAr(d)) return;
    var j = api.janela(), g = j && typeof j.xgGimbal === "number" ? j.xgGimbal : 0, h = d.y - d.solo;
    E.avisoManual = g > -80 ? "Câmera fora de -90°: fotos pausadas" : Math.abs(h - P.altura) > 10 ? (h < P.altura ? "Suba o drone" : "Desça o drone") : "";
    if (E.avisoManual) return;
    var q = { x: d.x, z: d.z }, sobre = false;
    if (P.borda) sobre = P.linhas.some(function (s) {
      var ax = s[1].x - s[0].x, az = s[1].z - s[0].z, L = ax * ax + az * az, t = L ? Math.max(0, Math.min(1, ((q.x - s[0].x) * ax + (q.z - s[0].z) * az) / L)) : 0;
      return Math.hypot(q.x - (s[0].x + t * ax), q.z - (s[0].z + t * az)) < P.largura / 3;
    });
    else sobre = dentro(q, E.pontos);
    if (!sobre) return;
    var minimo = P.alto * (1 - ((NIVEIS.filter(function (v) { return v.id === E.nivel; })[0] || NIVEIS[2]).f) / 100) * 0.85;
    if (E.fotos.some(function (f) { return Math.hypot(f.x - q.x, f.z - q.z) < minimo; })) return;
    E.fotos.push(q);
    atualizarVoo();
  }

  function volta() {
    if (!api) return;
    cuidarDaMissao();
    fotografarNoManual();
    seguirHd();
    if (!raiz || raiz.hidden) return;
    if (!api.ligado()) { fechar(); return; }
    seguirMontagem();
    var agora = performance.now();
    if (tela === "voo") {
      desenharMapa();
      var d = lerDrone(), a = raiz.querySelector("[data-g-alt]"), b = raiz.querySelector("[data-g-bat]");
      if (d && a) a.textContent = fmt(Math.max(0, d.y - d.solo), 0) + " m";
      if (d && b) b.textContent = Math.round(d.bat) + "%";
      if (agora - ultimoDesenho > 2500 && !E.missao) { ultimoDesenho = agora; desenhar(); }
    }
    if (E.recado && agora >= E.recadoAte) desenharRecado();
  }

  function fechar() { if (raiz) raiz.hidden = true; }

  return {
    /* chamado pelo app_fly: qual = "dguri" | "xguri" */
    abrir: function (qual, funcoes) {
      api = funcoes;
      qual = MARCAS[qual] ? qual : "dguri";
      /* cada app tem o seu trabalho: trocar de app comeca do zero (menos com uma missao voando) */
      if (app && qual !== app) {
        var m = E.missao;
        if (m && m.fase !== "fim" && m.fase !== "pausada") qual = app;
        else { E = novoEstado(); tela = "inicio"; }
      }
      app = qual;
      montar();
      if (!raiz) return;
      raiz.hidden = false;
      pedirFundo();
      if (!relogio) relogio = setInterval(function () { try { volta(); } catch (e) { /* proxima volta */ } }, 200);
      desenhar();
    },
    fechar: fechar,
    aberto: function () { return !!raiz && !raiz.hidden; },
    estado: function () { return { app: app, tela: tela, pontos: E.pontos.length, fechado: E.fechado, cal: E.cal, plano: E.plano && { linhas: E.plano.linhas.length, fotos: E.plano.fotos.length, min: E.plano.min, ha: E.plano.ha },
                                   missao: E.missao && { fase: E.missao.fase, proxima: E.missao.proxima }, fotos: E.fotos.length, orto: !!(E.orto && E.orto.img), montando: !!E.montando, calibrado: E.calibrado, hd: E.hd }; },
    /* para os testes */
    _acao: function (a, v) { acao(a, v); },
    _toque: function (x, z) { toqueNoMapa(x, z); },
    _E: function () { return E; },
  };
})();
