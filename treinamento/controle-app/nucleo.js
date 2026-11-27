/* ==========================================================================
   Núcleo do app: palco, telas, conversa com o PC (ponte), utilidades.
   ========================================================================== */
"use strict";

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function el(tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function ic(nome, vb) { return '<svg viewBox="' + (vb || "0 0 48 48") + '"><use href="#' + nome + '"/></svg>'; }
function num(v, c) { return (Number(v) || 0).toFixed(c == null ? 1 : c); }
function virg(v, c) { return num(v, c).replace(".", ","); }

/* ------------------------------------------------------------- palco */
var PALCO = $("#palco");
function escalar() {
  var s = Math.min(innerWidth / 1920, innerHeight / 1200);
  PALCO.style.transform = "scale(" + s + ")";
  PALCO.style.left = ((innerWidth - 1920 * s) / 2) + "px";
  PALCO.style.top = ((innerHeight - 1200 * s) / 2) + "px";
  APP.escala = s;
}
var APP = { escala: 1, tela: "inicial", conectado: false, E: null, rota: null, ouvintes: [] };
addEventListener("resize", escalar);
escalar();

/* ícones (os dois arquivos .svgfrag viram o sprite da página) */
["icones_novos.svgfrag", "icones_antigos.svgfrag"].forEach(function (a) {
  fetch(a).then(function (r) { return r.text(); }).then(function (t) {
    var tmp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    tmp.innerHTML = t;
    var defs = $("#sprite-defs");
    while (tmp.firstChild) defs.appendChild(tmp.firstChild);
  }).catch(function () {});
});

/* ------------------------------------------------------------- telas */
function mostrar(nome) {
  $$(".tela").forEach(function (t) { t.classList.toggle("ativa", t.id === "t-" + nome); });
  APP.tela = nome;
  avisar("tela", nome);
}
function avisar(evento, dado) {
  APP.ouvintes.forEach(function (o) { if (o[0] === evento) { try { o[1](dado); } catch (e) { console.error(e); } } });
}
function ouvir(evento, fn) { APP.ouvintes.push([evento, fn]); }

/* ------------------------------------------------------ conversa com o PC */
function cadastroLiberado() {
  return !window.RCPLUS || !window.RCPLUS.cadastroLiberado || window.RCPLUS.cadastroLiberado();
}
function cmd(c, extra) {
  if (!cadastroLiberado()) return Promise.resolve();
  var o = { c: c };
  for (var k in extra || {}) o[k] = extra[k];
  /* direto pelo WebRTC quando aberto (rtc.js); senão pela ponte */
  if (window.RTC && window.RTC.cmd(o)) return Promise.resolve();
  return fetch("/cmd?j=" + encodeURIComponent(JSON.stringify(o)), { cache: "no-store" }).catch(function () {});
}
/* O estado vem da memoria do app Android (a ponte o empurra pela conexao que
   ja esta aberta): o pedido nao sai do controle. "rv" diz qual rota a pagina
   ja tem; enquanto for a mesma, ela volta como "igual". */
function puxarEstado() {
  fetch("/estado?rv=" + (APP.rv || 0), { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (m) {
      var e = m && m.e;
      if (m) APP.ponteEm = Date.now();
      if (e) {
        if (e.rota === "igual") e.rota = APP.rota; else { APP.rota = e.rota; if (m.rv != null) APP.rv = m.rv; }
        /* velocidade do drone entre dois estados, pelo relógio do PC: serve para
           o desenho andar liso entre um estado e outro (poseAgora) */
        var a = APP.E;
        if (a && a.d && e.d && e.t > a.t && e.t - a.t < 500) {
          var s = (e.t - a.t) / 1000;
          APP.vel = { x: (e.d.x - a.d.x) / s, z: (e.d.z - a.d.z) / s };
        } else if (!e.d) APP.vel = null;
        /* o estado pelo WebRTC (rtc.js) chega antes: o da reserva só entra se
           for mais novo */
        if (APP.E && e.t <= APP.E.t) e = null;
      }
      if (e) {
        APP.E = e;
        if (window.TPD_IDIOMAS) TPD_IDIOMAS.receber(e);
        APP.recebido = Date.now();
        /* hora em que o app Android recebeu este estado da ponte (mesmo
           relógio da página): a câmera 3D interpola sem o atraso da leitura */
        APP.rx = typeof m.rx === "number" ? m.rx : APP.recebido;
      }
    })
    .catch(function () {})
    .then(function () {
      /* vivo = o estado do PC está mudando (o relógio do controle não bate com o do PC) */
      var novo = APP.E && APP.E.t !== APP.ultimoT;
      if (novo) { APP.ultimoT = APP.E.t; APP.mudou = Date.now(); }
      var vivo = !!(APP.E && !APP.E.desligada && Date.now() - APP.recebido < 3000 && Date.now() - (APP.mudou || 0) < 4000);   // desligada: sem bateria (12/10/2026)
      if (vivo !== APP.conectado) { APP.conectado = vivo; avisar("conexao", vivo); }
      /* o estado chega até 30x/s; as telas pesadas (rota, trilha, barra) redesenham
         no máximo 10x/s. O drone no mapa anda a cada quadro (evento "quadro"). */
      if (APP.E && Date.now() - (APP.avisadoEm || 0) >= 95) {
        APP.avisadoEm = Date.now();
        avisar("estado", APP.E);
      }
      setTimeout(puxarEstado, 30);
    });
}
puxarEstado();

/* posição do drone AGORA: a última do PC mais o que ele andou desde então
   (no máximo 0,15 s, para não "adivinhar" demais se o estado atrasar) */
function poseAgora(d) {
  if (!d || !APP.vel || !APP.recebido) return d;
  var dt = Math.min(0.15, (Date.now() - APP.recebido) / 1000);
  return { x: d.x + APP.vel.x * dt, y: d.y, z: d.z + APP.vel.z * dt, rumo: d.rumo };
}
(function quadro() {
  if (APP.E && APP.E.d) avisar("quadro", APP.E);
  requestAnimationFrame(quadro);
})();

/* ---------------------------------------------- mapa: pixels <-> metros
   O mapa do app é 1920x1200 px = a foto do campo; 0,2327 m por px, com o
   centro da foto em (x 0, z -90) do jogo. */
var ESCALA_M = 0.2327, CX = 0, CZ = -90;
function paraM(px, py) { return [CX + (px - 960) * ESCALA_M, CZ + (py - 600) * ESCALA_M]; }
function paraPx(x, z) { return [960 + (x - CX) / ESCALA_M, 600 + (z - CZ) / ESCALA_M]; }

/* Mapa do nível: GUARDADO NO CONTROLE. O estado diz qual é o nível (mk); o
   app Android entrega a foto que veio dentro do APK ou que já foi baixada.
   Só um nível nunca visto é buscado no PC, uma vez. Nada de mapa viajando
   pela conexão a cada voo. */
var chaveMapa = null, chaveTentando = null;
// virtual.js carrega antes deste modulo; define a origem antes do primeiro estado.
var SITE_MAPAS = window.__xgVirtual ? "../mapas_controle/" : "https://guridosdrones-treinamento.web.app/treinamento/mapas_controle/";
function encaixarMapa(url, aoFalhar, aoCarregar) {
  var nivelPedido = APP.E && APP.E.mk;
  /* a foto pode cobrir só o campo (1920x1200 do mapa) ou o dobro da área
     (3072 px de largura): encaixa conforme o tamanho */
  var teste = new Image();
  teste.onload = function () {
    if (nivelPedido && APP.E && APP.E.mk !== nivelPedido) return;
    var dobro = teste.naturalWidth >= 3000, f = $("#foto-mapa");
    f.setAttribute("x", dobro ? -960 : 0); f.setAttribute("y", dobro ? -600 : 0);
    f.setAttribute("width", dobro ? 3840 : 1920); f.setAttribute("height", dobro ? 2400 : 1200);
    f.setAttribute("href", url);
    APP.urlMapa = url;
    avisar("mapa", url);
    if (aoCarregar) aoCarregar();
  };
  teste.onerror = aoFalhar || null;
  teste.src = url;
}
function mapaDoNivel(k) {
  if (!k || k === chaveMapa || k === chaveTentando) return;
  chaveTentando = k;
  var achou = function () { if (chaveTentando === k) { chaveMapa = k; chaveTentando = null; } };
  encaixarMapa("/mapa-local.jpg?k=" + encodeURIComponent(k),
    /* não está no controle: pela internet (sem a ponte) a foto vem do site;
       senão, o PC ainda não fotografou este nível e o próximo estado tenta de novo em 3 s */
    function () {
      encaixarMapa(SITE_MAPAS + encodeURIComponent(k) + ".jpg",
        function () { setTimeout(function () { if (chaveTentando === k) chaveTentando = null; }, 3000); }, achou);
    }, achou);
}
ouvir("estado", function (e) { if (e && e.mk) mapaDoNivel(e.mk); });

/* o app Android sincroniza os mapas salvos no site; se a foto do mapa aberto
   foi atualizada (mapa refeito no PC), troca pela nova. Pergunta só à memória
   do app, sem sair do controle. */
var mapasMudaram = null;
setInterval(function () {
  fetch("/mapas-mudaram", { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (m) {
    if (mapasMudaram !== null && m !== mapasMudaram && chaveMapa) {
      encaixarMapa("/mapa-local.jpg?k=" + encodeURIComponent(chaveMapa) + "&m=" + m);
    }
    mapasMudaram = m;
  }).catch(function () {});
}, 5000);

/* PC antigo, que não diz o nível: a foto vem da ponte, como antes */
var versaoMapa = "0";
function conferirMapa() {
  if (APP.E && APP.E.mk) return setTimeout(conferirMapa, 2500);
  fetch("/mapa.txt", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : versaoMapa; })
    .then(function (v) {
      v = String(v).trim().split(" ")[0];
      if (!v || v === "0" || v === versaoMapa) return;
      /* a ponte reiniciada recomeça a contar: a cada mudança, foto nova sem cache */
      /* o pedido saiu antes do 1o estado: se o nível já é conhecido, o mapa
         guardado no controle manda, e esta foto não passa por cima dele */
      if (chaveMapa || chaveTentando || (APP.E && APP.E.mk)) return;
      versaoMapa = v;
      encaixarMapa("/mapa.jpg?v=" + v + "&t=" + Date.now(), null, function () {
        if (chaveMapa) encaixarMapa("/mapa-local.jpg?k=" + encodeURIComponent(chaveMapa));
      });
    }).catch(function () {})
    .then(function () { setTimeout(conferirMapa, 2500); });
}
conferirMapa();

/* câmera do drone: busca a próxima imagem enquanto desenha a atual, e
   decodifica fora da linha principal (createImageBitmap) num canvas */
var quadroFpv = 0, telaFpv = null, ctxFpv = null;
/* A câmera 3D desenhada no controle (fpv3d.js) assumiu: o vídeo do PC para
   (fecha o MJPEG; menos Wi-Fi ocupado e o PC para de codificar). Se o 3D
   cair, ligarVideo abre o fluxo de novo - nunca dois ao mesmo tempo. */
var videoLigado = true, leitorFluxo = null, geracaoFluxo = 0;
function pararVideo() {
  videoLigado = false; fluxoOk = false; geracaoFluxo++;
  if (leitorFluxo) { try { leitorFluxo.cancel(); } catch (e) { /* já fechou */ } leitorFluxo = null; }
}
function ligarVideo() {
  if (videoLigado) return;
  videoLigado = true;
  abrirFluxo();
}
function apagarFpv() {
  if (!telaFpv) { telaFpv = $("#fpv-tela"); ctxFpv = telaFpv.getContext("2d"); }
  ctxFpv.fillStyle = "#000";
  ctxFpv.fillRect(0, 0, telaFpv.width, telaFpv.height);
}
/* aeronave desconectada: a câmera fica preta, como no aparelho */
ouvir("conexao", function (vivo) { document.body.classList.toggle("sem-aeronave", !vivo); if (!vivo) apagarFpv(); });
setTimeout(function () { document.body.classList.toggle("sem-aeronave", !APP.conectado); if (!APP.conectado) apagarFpv(); }, 0);
function desenharFpv(b, fim) {
  fim = fim || function () {};
  if (!APP.conectado) { apagarFpv(); return fim(); }
  if (!telaFpv) { telaFpv = $("#fpv-tela"); ctxFpv = telaFpv.getContext("2d"); }
  var pronto = function (img) {
    if (telaFpv.width !== img.width) { telaFpv.width = img.width; telaFpv.height = img.height; }
    ctxFpv.drawImage(img, 0, 0);
    if (img.close) img.close();
    fim();
  };
  if (window.createImageBitmap) createImageBitmap(b).then(pronto).catch(fim);
  else { var i = new Image(), u = URL.createObjectURL(b); i.onload = function () { pronto(i); URL.revokeObjectURL(u); }; i.onerror = fim; i.src = u; }
}
function puxarFpv() {
  if (fluxoOk || !videoLigado) return setTimeout(puxarFpv, 1000);
  fetch("/fpv.jpg?depois=" + quadroFpv, { cache: "no-store" })
    .then(function (r) {
      if (r.status !== 200) throw 0;
      quadroFpv = Number(r.headers.get("X-Quadro")) || quadroFpv;
      return r.blob();
    })
    .then(function (b) { setTimeout(puxarFpv, 0); desenharFpv(b); })
    .catch(function () { setTimeout(puxarFpv, 300); });
}
/* 1o o fluxo contínuo (MJPEG pelo app Android); se não abrir, um quadro por vez.
   O fluxo é LIDO aqui e cada imagem vai para o canvas da câmera: o <img> com
   MJPEG não aparece no WebView do RC Plus (Chrome 95) quando a resposta vem
   do app Android, e a câmera ficava preta. Imagem que chega com a anterior
   ainda sendo desenhada é pulada: vale sempre a mais nova. */
var fluxoOk = false;
var ASCII = function (u8, n) { var s = ""; for (var i = 0; i < Math.min(n, u8.length); i++) s += String.fromCharCode(u8[i]); return s; };
function abrirFluxo() {
  var g = ++geracaoFluxo;
  fetch("/fpv.mjpg?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
    if (!r.ok || !r.body) throw new Error("sem fluxo");
    var rd = r.body.getReader(), buf = new Uint8Array(0), ocupado = false, ultimo = null;
    if (!videoLigado || g !== geracaoFluxo) { try { rd.cancel(); } catch (e) { /* já */ } throw new Error("parado"); }
    leitorFluxo = rd;
    function proximo() {
      return rd.read().then(function (x) {
        if (x.done) throw new Error("fim");
        var junto = new Uint8Array(buf.length + x.value.length);
        junto.set(buf); junto.set(x.value, buf.length); buf = junto;
        for (;;) {
          /* cabeçalho da parte: ...Content-Length: N, linha em branco, <jpeg> */
          var cab = ASCII(buf, 300), i = cab.indexOf("Content-Length:"), f = cab.indexOf("\r\n\r\n", i);
          if (i < 0 || f < 0) { if (buf.length > 4e6) buf = new Uint8Array(0); break; }
          var tam = parseInt(cab.slice(i + 15, f), 10), ini = f + 4;
          if (!(tam > 0) || buf.length < ini + tam) break;
          ultimo = new Blob([buf.subarray(ini, ini + tam)], { type: "image/jpeg" });
          buf = buf.slice(ini + tam);
          fluxoOk = true;
        }
        if (ultimo && !ocupado) {
          var b = ultimo; ultimo = null; ocupado = true;
          desenharFpv(b, function () { ocupado = false; });
        }
        return proximo();
      });
    }
    return proximo();
  }).catch(function () {}).then(function () {
    if (g !== geracaoFluxo) return;            // parado pela câmera 3D, ou um fluxo mais novo já abriu
    fluxoOk = false; leitorFluxo = null;
    if (videoLigado) setTimeout(function () { if (g === geracaoFluxo && videoLigado) abrirFluxo(); }, 1500);
  });
}
/* (o <img> direto da ponte não abre no WebView do RC Plus: fica o caminho
   pelo app Android + canvas, que a câmera 3D desliga quando assume) */
abrirFluxo();
puxarFpv();

/* ------------------------------------------------------------ diálogos
   dialogo({icone:'alerta'|'pergunta'|null, titulo, texto, itens:[{t, verm}], botoes:[{t, cls, fn}],
            lista:[{t, cls, fn}], largura}) */
var dialogoAberto = null;
function dialogo(o) {
  fecharDialogo();
  var c = el("div", "camada-dlg");
  var d = el("div", "dlg");
  if (o.largura) d.style.width = o.largura + "px";
  var h = '<div class="conteudo">';
  if (o.icone) h += '<div class="marca">' + ic("i-" + o.icone) + "</div>";
  if (o.html) h += o.html;
  if (o.titulo) h += "<h3>" + o.titulo + "</h3>";
  if (o.texto) h += "<p>" + o.texto + "</p>";
  if (o.itens) h += "<ul>" + o.itens.map(function (i) { return '<li class="' + (i.verm ? "verm" : "") + '">•&nbsp; ' + i.t + "</li>"; }).join("") + "</ul>";
  h += "</div>";
  if (o.lista) {
    h += '<div class="lista-v">' + o.lista.map(function (b, i) { return '<button data-i="' + i + '" class="' + (b.cls || "") + '">' + b.t + "</button>"; }).join("") + "</div>";
  } else {
    h += '<div class="botoes">' + (o.botoes || [{ t: "OK(R3)", cls: "verde" }]).map(function (b, i) {
      return '<button data-i="' + i + '" class="' + (b.cls || "") + '">' + b.t + "</button>";
    }).join("") + "</div>";
  }
  d.innerHTML = h;
  c.appendChild(d);
  PALCO.appendChild(c);
  var bots = o.lista || o.botoes || [{}];
  $$("[data-i]", d).forEach(function (b) {
    b.addEventListener("click", function () {
      var a = bots[Number(b.dataset.i)];
      if (!a || a.fechar !== false) fecharDialogo();
      if (a && a.fn) a.fn(d);
    });
  });
  dialogoAberto = { camada: c, o: o };
  if (o.depois) o.depois(d);
  return d;
}
function fecharDialogo() {
  if (dialogoAberto) { dialogoAberto.camada.remove(); dialogoAberto = null; }
}
/* botões físicos R2 (cancelar) e R3 (confirmar) */
function teclaFisica(k) {
  if (!dialogoAberto) return false;
  var bots = $$(".botoes button", dialogoAberto.camada);
  if (!bots.length) return false;
  (k === "R2" ? bots[0] : bots[bots.length - 1]).click();
  return true;
}
window.rcplusTecla = teclaFisica;

var toastTimer = null;
function toast(txt, icone) {
  var t = $(".toast");
  if (t) t.remove();
  t = el("div", "toast", (icone ? ic("i-" + icone) : "") + "<span>" + txt + "</span>");
  PALCO.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.remove(); }, 2600);
}

/* lista suspensa ancorada num botão */
function listaSuspensa(botao, opcoes, atual, fn) {
  var velha = $(".lista-sus");
  if (velha) { velha.remove(); if (velha._botao === botao) return; }
  var r = botao.getBoundingClientRect(), p = PALCO.getBoundingClientRect(), s = APP.escala;
  var l = el("div", "lista-sus");
  l._botao = botao;
  l.style.left = ((r.left - p.left) / s) + "px";
  l.style.top = ((r.bottom - p.top) / s + 6) + "px";
  l.style.width = (r.width / s) + "px";
  l.innerHTML = opcoes.map(function (o) { return '<button class="' + (o === atual ? "ativo" : "") + '">' + o + "</button>"; }).join("");
  PALCO.appendChild(l);
  $$("button", l).forEach(function (b) {
    b.addEventListener("click", function (e) { e.stopPropagation(); l.remove(); fn(b.textContent); });
  });
}
document.addEventListener("click", function (e) {
  var l = $(".lista-sus");
  if (l && !l.contains(e.target) && !(l._botao && l._botao.contains(e.target))) l.remove();
}, true);

/* guarda local (tarefas, ajustes). 11/11/2026 (Eduardo: "cada drone tem seu controle separado"): uma gaveta por drone,
   pelo ?modelo= da pagina do simulador. O T50 fica com a gaveta antiga ("agras_"), entao o que os alunos ja tinham nele
   continua; os outros drones (T25, T100, T10...) comecam vazios e nunca mais misturam com o T50. */
var DRONE_DO_APP = (function () {
  try { var q = new URLSearchParams(window.top.location.search); return String(q.get("modelo") || q.get("drone") || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  catch (e) { return ""; }
})();
var GAVETA = !DRONE_DO_APP || DRONE_DO_APP === "t50" ? "agras_" : "agras_" + DRONE_DO_APP + "_";
function guardar(k, v) { try { localStorage.setItem(GAVETA + k, JSON.stringify(v)); } catch (e) {} }
function lerGuardado(k, padrao) {
  try { var v = localStorage.getItem(GAVETA + k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
}
