/* ==========================================================================
   A tela do mapa (DroneActivity do Agras): lista de tarefas, mapeamento do
   talhão, execução, modo manual e os mapeamentos. O fundo é a foto do campo
   do nível aberto no jogo. Medidas: referencias/medidas.txt.
   ========================================================================== */
"use strict";

var M = {
  modo: lerGuardado("modo", "rota"),   // rota | manual | arvore | maprota | maparvore
  sub: "lista",                         // lista | edicao | execucao
  painel: false,
  aba: "Tarefa",
  tarefas: lerGuardado("tarefas", []),
  andamento: lerGuardado("andamento", []),
  sel: null,
  ed: null,                             // tarefa em edição
  exec: null,                           // tarefa em execução
  vista: { x: 0, y: 0, k: 1 },
  tipo: "Ponto limite",
  metodo: "Retículo",
  abaEd: "Básico",
  abaExec: "Tarefa",
  abaMan: "M",
  regua: null,
  P: lerGuardado("P", { taxa: 30, vel: 18, altura: 3, gota: 90, rthVel: 36, rthAlt: 7, terreno: "planicie",
    desvio: true, estab: true, contornar: true, subidaBaixa: false, fluxoM: 10, velMaxLig: false, sistemas: true, espMmais: 6 }),
  alertasFechados: {},
  /* trilha voada (linha do GPS): [{v: 0 branca | 1 verde, p: [[x,z]...]}]; só a borracha apaga */
  trilha: lerGuardado("trilha", []),
  voo: null,        // a tarefa em execução: magenta, fases, cinza (só na memória)
  mmais: false,     // tarefa M+ ligada (círculo laranja/azul)
  ajuste: null,     // "angulo" | "lados": painel que esconde a alça de direção
  arraste: null,    // vértice sendo arrastado {lista, i}
};
if (M.P.espMmais == null) M.P.espMmais = 6;
if (!Array.isArray(M.trilha)) M.trilha = [];
M.trilha = M.trilha.filter(function (s) { return s && Array.isArray(s.p) && s.p.length; });
function salvarTarefas() { guardar(chaveDoMapa("tarefas"), M.tarefas); guardar(chaveDoMapa("andamento"), M.andamento); }
/* progresso de cada tarefa "Em andamento": o cinza (até onde foi feito) e o
   ponto para retomar ({i: trecho da rota, p: [x, z]}) */
M.prog = lerGuardado("progresso", {});
function salvarProg() { guardar(chaveDoMapa("progresso"), M.prog); }
function salvarP() { guardar("P", M.P); }

/* Cada mapa tem as suas tarefas (06/10/2026, pedido do Eduardo): o mapa de
   aplicação, o "Em andamento", o progresso e a trilha voada ficam guardados
   pelo mapa aberto no simulador (APP.E.mk). Ao trocar de mapa, o app guarda
   os do anterior e carrega só os do novo: nada de um mapa aparece em outro.
   O que foi gravado antes desta separação (sem mapa) passa para o primeiro
   mapa aberto depois dela, menos a trilha, que era a mistura de todos. */
var MAPA_DO_APP = lerGuardado("mapaAtual", null);
function chaveDoMapa(k) { return MAPA_DO_APP ? k + "@" + MAPA_DO_APP : k; }
function carregarDoMapa() {
  M.tarefas = lerGuardado(chaveDoMapa("tarefas"), []);
  M.andamento = lerGuardado(chaveDoMapa("andamento"), []);
  M.prog = lerGuardado(chaveDoMapa("progresso"), {});
  var t = lerGuardado(chaveDoMapa("trilha"), []);
  M.trilha = (Array.isArray(t) ? t : []).filter(function (s) { return s && Array.isArray(s.p) && s.p.length; });
  if (!Array.isArray(M.tarefas)) M.tarefas = [];
  if (!Array.isArray(M.andamento)) M.andamento = [];
  if (!M.prog || typeof M.prog !== "object") M.prog = {};
}
function trocarDeMapa(mk) {
  if (!mk || typeof mk !== "string" || mk === MAPA_DO_APP) return false;
  /* o que ainda não foi gravado fica no mapa de antes */
  if (typeof TRILHA !== "undefined" && TRILHA.sujo) guardarTrilha();
  if (!MAPA_DO_APP) {
    var velhas = { tarefas: lerGuardado("tarefas", null), andamento: lerGuardado("andamento", null), progresso: lerGuardado("progresso", null) };
    MAPA_DO_APP = mk;
    Object.keys(velhas).forEach(function (k) {
      if (velhas[k] != null && lerGuardado(chaveDoMapa(k), null) == null) guardar(chaveDoMapa(k), velhas[k]);
      try { localStorage.removeItem(GAVETA + k); } catch (e) { /* sem armazenamento */ }
    });
    try { localStorage.removeItem(GAVETA + "trilha"); } catch (e) { /* sem armazenamento */ }
  }
  MAPA_DO_APP = mk;
  guardar("mapaAtual", mk);
  carregarDoMapa();
  M.sel = null; M.ed = null; M.exec = null; M.voo = null; M.arraste = null; M.regua = null;
  M.sub = "lista";
  if (typeof TRILHA !== "undefined") {
    var n = 0; M.trilha.forEach(function (s) { n += s.p.length; });
    TRILHA.n = n; TRILHA.solto = true; TRILHA.sujo = false; TRILHA.ver++;
  }
  return true;
}
carregarDoMapa();
/* antes dos outros ouvintes do estado: a trilha do mapa novo já cai na lista dele */
ouvir("estado", function (E) { if (E && trocarDeMapa(E.mk)) montar(); });

/* Aquisição aérea dos dois modos DJI (gravação 7, 01/10/2026).
   O mosaico didático recorta a imagem do cenário nos footprints capturados;
   não é processamento fotogramétrico de imagens de uma câmera física. */
function ehMapeamento(modo) { return modo === "maprota" || modo === "maparvore"; }
function mapeamentoDisponivel() { return !!(APP.conectado && APP.E && APP.E.mapeamentoDisponivel === true); }
function atualizarAcessoMapeamento() {
  var permitido = mapeamentoDisponivel();
  $$("[data-mapeamento-admin]").forEach(function(e) { e.style.display = permitido ? "" : "none"; });
  if (!permitido && ehMapeamento(M.modo)) {
    M.modo = "rota"; M.sub = "lista"; M.ed = null; M.exec = null; M.sel = null; M.voo = null;
    guardar("modo", M.modo); montar();
  }
}
function estimarFotosMapa(t) {
  if (!t || !t.limite || t.limite.length < 3) return 0;
  var r = rotaDeMapeamento(t), metros = 0;
  for (var i = 1; i < r.length; i++) metros += Math.hypot(r[i][0]-r[i-1][0], r[i][1]-r[i-1][1]);
  return Math.ceil(metros / ((t.velMap || 18) / 3.6));
}
function parametrosMapa(t) {
  return { id: t.id, tipo: t.modo, res: t.res || "Médio", altura: Math.max(20, Math.min(60, t.alturaMap || 30)),
    vel: (t.velMap || 18) / 3.6, fotosPrevistas: estimarFotosMapa(t), rotaMap: t.rotaMap || "area" };
}
function missaoMapa() {
  var m = APP.E && APP.E.mapaMissao;
  return m && !m.confirmada ? m : null;
}
function dadosMapaHD() {
  var m = missaoMapa(), t = M.exec;
  if (m && t && m.id === t.id) return Object.assign({}, m, { mk: APP.E.mk, limite: t.limite, nome: t.nome, res: t.res || "Médio" });
  t = M.sub === "lista" ? tarefaPorId(M.sel) : M.exec;
  return t && t.mapaHD && APP.E && t.mapaHD.mk === APP.E.mk ? t.mapaHD : null;
}
/* Mapa HD (07/10/2026): a imagem em alta resolução da área fotografada vem do simulador
   (window.mapaHDDoJogo, controle virtual) e fica guardada no aparelho (IndexedDB) ao
   confirmar o mapa. Sem ela, vale o recorte da foto de fundo, como antes. */
var HD_CACHE = {}, HD_PEDIDO = {}, HD_DESENHADO = null;
function bancoHD() {
  return new Promise(function (ok, erro) {
    if (!window.indexedDB) return erro(new Error("sem IndexedDB"));
    var r = indexedDB.open("agras_mapa_hd", 1);
    r.onupgradeneeded = function () { r.result.createObjectStore("img"); };
    r.onsuccess = function () { ok(r.result); };
    r.onerror = function () { erro(r.error); };
  });
}
function guardarHD(chave, hd) {
  return bancoHD().then(function (b) { return new Promise(function (ok) {
    var tx = b.transaction("img", "readwrite");
    tx.objectStore("img").put({ blob: hd.blob, x0: hd.x0, z0: hd.z0, x1: hd.x1, z1: hd.z1 }, chave);
    tx.oncomplete = function () { ok(true); }; tx.onerror = function () { ok(false); };
  }); }).catch(function () { return false; });
}
function imagemHD(d) {
  if (!d || !d.id) return null;
  var chave = (d.mk || "") + "|" + d.id;
  var vivo = window.mapaHDDoJogo && window.mapaHDDoJogo(d.id);
  if (vivo && (!vivo.mk || !d.mk || vivo.mk === d.mk)) return vivo;
  if (HD_CACHE[chave]) return HD_CACHE[chave];
  if (!HD_PEDIDO[chave]) {
    HD_PEDIDO[chave] = true;
    bancoHD().then(function (b) {
      var r = b.transaction("img").objectStore("img").get(chave);
      r.onsuccess = function () {
        var v = r.result;
        if (!v || !v.blob) return;
        HD_CACHE[chave] = Object.assign({ url: URL.createObjectURL(v.blob) }, v);
        desenharMosaico();
      };
    }).catch(function () {});
  }
  return null;
}
function desenharMosaico() {
  var camada = $("#camada-mapeamento");
  if (!camada) {
    camada = document.createElementNS("http://www.w3.org/2000/svg", "g");
    camada.id = "camada-mapeamento";
    $("#camada-tarefas").before(camada);
  }
  var d = ehMapeamento(M.modo) ? dadosMapaHD() : null, foto = $("#foto-mapa");
  if (!d || !d.capturas || !d.capturas.length || !foto.getAttribute("href")) { pintarCamada("#camada-mapeamento", ""); return; }
  var recortes = d.capturas.map(function (c) {
    var p = paraPx(c.x - c.largura/2, c.z - c.altura/2);
    return '<rect x="' + p[0].toFixed(2) + '" y="' + p[1].toFixed(2) + '" width="' + (c.largura/ESCALA_M).toFixed(2) + '" height="' + (c.altura/ESCALA_M).toFixed(2) + '"/>';
  }).join("");
  var img = foto.cloneNode(false); img.removeAttribute("id");
  var hd = imagemHD(d);
  HD_DESENHADO = hd ? hd.url : null;
  if (hd) {
    /* a imagem HD cobre só a caixa das capturas, no lugar certo do mapa */
    var p0 = paraPx(hd.x0, hd.z0);
    img.setAttribute("href", hd.url);
    img.setAttribute("x", p0[0].toFixed(2)); img.setAttribute("y", p0[1].toFixed(2));
    img.setAttribute("width", ((hd.x1 - hd.x0) / ESCALA_M).toFixed(2)); img.setAttribute("height", ((hd.z1 - hd.z0) / ESCALA_M).toFixed(2));
    img.setAttribute("preserveAspectRatio", "none");
  }
  img.setAttribute("clip-path", "url(#recortes-mapa)");
  pintarCamada("#camada-mapeamento", '<defs><clipPath id="recortes-mapa">' + recortes + '</clipPath></defs>' +
    '<rect x="-4000" y="-4000" width="10000" height="10000" fill="#000" opacity=".28"/>' + img.outerHTML);
}
ouvir("mapa", function () { if (typeof M !== "undefined") desenharMosaico(); });
/* a imagem HD fica pronta no meio do voo de volta: troca sozinha, sem esperar um toque */
ouvir("estado", function () {
  if (typeof M === "undefined" || !ehMapeamento(M.modo)) return;
  var d = dadosMapaHD(), hd = d && imagemHD(d);
  if ((hd ? hd.url : null) !== HD_DESENHADO) desenharMosaico();
});
function montarResultadoMapa(dc, ac) {
  var m = missaoMapa();
  if (!m || !M.exec || m.id !== M.exec.id) return false;
  var estado = m.estado;
  if (["retornando", "reconstruindo", "concluido", "cancelado"].indexOf(estado) < 0) return false;
  if (estado === "concluido") {
    dc.style.top = "570px";
    var hd = botao("bt-claro", "Mapa HD", function () { abrirMapaHD(dadosMapaHD()); });
    hd.dataset.mapAcao = "hd"; dc.appendChild(hd);
    var confirmar = acao("i-check", "Confirmar", confirmarMapa);
    confirmar.dataset.mapAcao = "confirmar"; ac.appendChild(confirmar);
    var descartar = acao("i-x", "Descartar", descartarMapa);
    descartar.dataset.mapAcao = "descartar"; ac.appendChild(descartar);
  } else if (estado === "cancelado" && !noAr(APP.E)) {
    var sair = acao("i-sair", "Sair", function () { limparMissaoMapa(m.id); });
    ac.appendChild(sair);
  } else if (estado === "cancelado" && noAr(APP.E)) {
    ac.appendChild(acao("i-sair", "Retornar à base", function () { cmd("rth"); }));
  } else {
    dc.style.top = "570px";
    dc.appendChild(el("div", "mapa-processando", estado === "retornando" ? (m.completa ? "Tarefa concluída. Retornando à base" : "Tarefa interrompida. Retornando à base") : "Reconstruindo mapa… Permaneça nesta tela"));
  }
  return true;
}
function limparMissaoMapa(id) {
  tarefaConcluida(tarefaPorId(id));
  cmd("mapDescartar", { id: id });
  M.exec = null; M.voo = null; M.sub = "lista"; M.sel = null;
  cmd("p", { v: { xgMapeamento: false, xgGeo: null, xgPulverizar: M.P.sistemas } });
  enviarP(); montar();
}
function confirmarMapa() {
  var m = missaoMapa();
  if (!m || m.estado !== "concluido" || !M.exec || noAr(APP.E)) return;
  var t = tarefaPorId(m.id);
  if (!t) return toast("Tarefa de mapeamento indisponível");
  var anterior = t.mapaHD;
  t.mapaHD = dadosMapaHD();
  var hdVivo = t.mapaHD && imagemHD(t.mapaHD);
  if (hdVivo && hdVivo.blob) guardarHD((t.mapaHD.mk || "") + "|" + t.mapaHD.id, hdVivo);
  try { localStorage.setItem(GAVETA + chaveDoMapa("tarefas"), JSON.stringify(M.tarefas)); }
  catch (e) { t.mapaHD = anterior; return avisoInfo("Não foi possível salvar o mapa. Libere espaço e tente novamente"); }
  cmd("mapConfirmar", { id: m.id });
  M.exec = null; M.voo = null; M.sub = "lista"; M.sel = t.id; M.painel = true;
  cmd("p", { v: { xgMapeamento: false, xgGeo: null, xgPulverizar: M.P.sistemas } });
  enviarP(); montar(); avisoInfo("Mapa HD salvo");
}
function descartarMapa() {
  var m = missaoMapa();
  if (!m || noAr(APP.E)) return;
  dialogo({ icone: "alerta", titulo: "Descartar o mapa reconstruído?", texto: "O resultado deste voo será descartado",
    botoes: [{ t: "Cancelar(R2)" }, { t: "Descartar(R3)", cls: "verm", fn: function () { limparMissaoMapa(m.id); } }] });
}
function abrirMapaHD(d) {
  if (!d || !d.capturas || !d.capturas.length || !APP.E || d.mk !== APP.E.mk) return toast("Mapa HD indisponível neste cenário");
  dialogo({ largura: 1200,
    html: '<h3>Mapa HD — ' + (d.res === "Alta" ? "2K" : "1K") + '</h3><div class="mapa-hd"><canvas data-mapa-hd></canvas><p data-mapa-hd-estado>Carregando mapa…</p><a class="oculto" data-mapa-hd-salvar>Salvar imagem</a></div>',
    botoes: [{ t: "Fechar(R2)" }] });
  var canvas = $("[data-mapa-hd]"), legenda = $("[data-mapa-hd-estado]"), salvar = $("[data-mapa-hd-salvar]");
  var foto = $("#foto-mapa"), img = new Image(), mk = APP.E.mk;
  img.onload = function () {
    if (!canvas.isConnected || !APP.E || APP.E.mk !== mk) return;
    var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    d.capturas.forEach(function (c) { x0 = Math.min(x0,c.x-c.largura/2); x1 = Math.max(x1,c.x+c.largura/2); z0 = Math.min(z0,c.z-c.altura/2); z1 = Math.max(z1,c.z+c.altura/2); });
    var lado = d.res === "Alta" ? 2048 : 1024, escala = lado/Math.max(x1-x0,z1-z0);
    canvas.width = Math.max(1,Math.round((x1-x0)*escala)); canvas.height = Math.max(1,Math.round((z1-z0)*escala));
    var g = canvas.getContext("2d");
    g.save(); g.beginPath();
    d.capturas.forEach(function (c) { g.rect((c.x-c.largura/2-x0)*escala,(c.z-c.altura/2-z0)*escala,c.largura*escala,c.altura*escala); });
    g.clip();
    if (hd) g.drawImage(img, (hd.x0-x0)*escala, (hd.z0-z0)*escala, (hd.x1-hd.x0)*escala, (hd.z1-hd.z0)*escala);
    else {
      var origem = paraM(+foto.getAttribute("x"), +foto.getAttribute("y"));
      g.drawImage(img, (origem[0]-x0)*escala, (origem[1]-z0)*escala, +foto.getAttribute("width")*ESCALA_M*escala, +foto.getAttribute("height")*ESCALA_M*escala);
    }
    g.restore();
    legenda.textContent = d.fotos + " fotos • " + canvas.width + " × " + canvas.height;
    try { salvar.href = canvas.toDataURL("image/png"); salvar.download = "mapeamento-" + d.id + ".png"; salvar.classList.remove("oculto"); }
    catch (e) { legenda.textContent += " • Imagem disponível para visualização"; }
  };
  img.onerror = function () { legenda.textContent = "Não foi possível carregar a imagem do cenário"; };
  var hd = imagemHD(d);
  img.src = hd ? hd.url : (foto.getAttribute("href") || "");
}

/* ------------------------------------------------------------- geometria */
// A gravacao mostra area zerada e aviso quando o limite se cruza.
function poligonoCruzado(p) {
  if (!p || p.length < 4) return false;
  function lado(a, b, c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
  function sobre(a, b, c) { return Math.abs(lado(a,b,c)) < 1e-8 && c[0] >= Math.min(a[0],b[0])-1e-8 && c[0] <= Math.max(a[0],b[0])+1e-8 && c[1] >= Math.min(a[1],b[1])-1e-8 && c[1] <= Math.max(a[1],b[1])+1e-8; }
  for (var i=0; i<p.length; i++) for (var j=i+1; j<p.length; j++) {
    if (j===i+1 || (i===0 && j===p.length-1)) continue;
    var a=p[i], b=p[(i+1)%p.length], c=p[j], d=p[(j+1)%p.length];
    if ((lado(a,b,c)*lado(a,b,d)<0 && lado(c,d,a)*lado(c,d,b)<0) || sobre(a,b,c) || sobre(a,b,d) || sobre(c,d,a) || sobre(c,d,b)) return true;
  }
  return false;
}
function areaHa(pts) {
  if (!pts || pts.length < 3 || poligonoCruzado(pts)) return 0;
  var s = 0;
  for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2 / 10000;
}
function anguloAuto(pts) {
  var melhor = 0, ang = 0;
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > melhor) { melhor = d; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  return ang;
}
/* borda por dentro do talhão, a d metros (d positivo = para dentro). d pode
   ser uma lista por aresta: d[i] = recuo da aresta i -> i+1 */
function bordaDentro(pol, d) {
  var n = pol.length, area = 0;
  for (var i = 0; i < n; i++) { var a = pol[i], b = pol[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  var sinal = area > 0 ? 1 : -1, lin = [];
  for (i = 0; i < n; i++) {
    var p = pol[i], q = pol[(i + 1) % n], ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1;
    var nx = -ez / l * sinal, nz = ex / l * sinal, di = typeof d === "number" ? d : (Number(d[i]) || 0);
    lin.push([[p[0] + nx * di, p[1] + nz * di], [ex, ez]]);
  }
  var out = [];
  for (i = 0; i < n; i++) {
    var L1 = lin[(i + n - 1) % n], L2 = lin[i], den = L1[1][0] * L2[1][1] - L1[1][1] * L2[1][0];
    if (Math.abs(den) < 1e-9) { out.push(L2[0]); continue; }
    var t = ((L2[0][0] - L1[0][0]) * L2[1][1] - (L2[0][1] - L1[0][1]) * L2[1][0]) / den;
    out.push([L1[0][0] + L1[1][0] * t, L1[0][1] + L1[1][1] * t]);
  }
  return out;
}
/* lados com margem própria ("Um lado"): {i: m}. Tarefa antiga, sem t.lados,
   tinha um lado só (ladoIdx) com a margem geral */
function ladosTarefa(t) {
  if (t.lados) return t.lados;
  var o = {};
  if (t.modoMargem === "Um lado" && Number(t.margem)) o[t.ladoIdx || 0] = Number(t.margem);
  return o;
}
/* área da tarefa = talhão com a margem RECUADA PARA DENTRO (ANALISE_LINHAS
   2.7: o limite fica parado e a rota recua). Geral: todos os lados; Um lado:
   só os lados escolhidos, cada um com o seu valor */
function areaTarefa(t) {
  var pol = t.limite;
  if (!pol || pol.length < 3) return pol;
  if (t.modoMargem === "Um lado") {
    var L = ladosTarefa(t), ds = [], tem = false;
    for (var i = 0; i < pol.length; i++) { ds.push(Number(L[i]) || 0); if (ds[i]) tem = true; }
    return tem ? bordaDentro(pol, ds) : pol;
  }
  var m = Number(t.margem) || 0;
  return m ? bordaDentro(pol, m) : pol;
}

/* ===== GERADOR DA ROTA DE PULVERIZAÇÃO (ANALISE_LINHAS, especificação 5) =====
   Uma só lógica no app (a prévia) e no jogo (o que o drone voa). MANTER IGUAL
   à cópia em treinamento/js/campo/app_rcplus.js (rotaDoAppNoJogo): a função é
   autossuficiente, sem nada de fora, para poder ser copiada.
   lim: área da tarefa (já recuada pela margem), em metros [[x,z]...].
   o: {esp, ang (rad, direção das passadas), cob, sentido, seg:[a,b] %,
       obs:[{tipo:"circulo",c,r} | {tipo:"poligono",pts}], folgaObs,
       sem:[[[x,z]...]] (áreas sem aplicação), laco (1,5), folgaLig (0: a
       ponta branca pode ir até o laço)}
   Saída: [[x, z, aplica 0|1, tipo]]; tipo 0 normal, 1 fronteira, 2 trecho
   alto (passa por cima). O aplica de um ponto vale para o trecho que chega nele. */
function gerarRotaPulv(lim, o) {
  var esp = Number(o.esp) || 6, cob = o.cob || "Somente rota";
  var laco0 = o.laco == null ? 1.5 : Number(o.laco), folgaLig = o.folgaLig == null ? 0 : Number(o.folgaLig);
  var folga = o.folgaObs == null ? 3.2 : Number(o.folgaObs);
  var ang = Number(o.ang) || 0, c = Math.cos(-ang), s = Math.sin(-ang);
  var gira = function (p) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
  var desgira = function (p) { return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; };
  var dist = function (a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); };
  function areaS(pol) {
    var t = 0;
    for (var i = 0; i < pol.length; i++) { var a = pol[i], b = pol[(i + 1) % pol.length]; t += a[0] * b[1] - b[0] * a[1]; }
    return t / 2;
  }
  /* recuo para dentro (d número ou lista por aresta), cantos em esquadria */
  function borda(pol, d) {
    var n = pol.length, sinal = areaS(pol) > 0 ? 1 : -1, lin = [], out = [], i;
    for (i = 0; i < n; i++) {
      var p = pol[i], q = pol[(i + 1) % n], ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1;
      var di = typeof d === "number" ? d : (Number(d[i]) || 0);
      lin.push([[p[0] - ez / l * sinal * di, p[1] + ex / l * sinal * di], [ex, ez]]);
    }
    for (i = 0; i < n; i++) {
      var L1 = lin[(i + n - 1) % n], L2 = lin[i], den = L1[1][0] * L2[1][1] - L1[1][1] * L2[1][0];
      if (Math.abs(den) < 1e-9) { out.push(L2[0]); continue; }
      var t = ((L2[0][0] - L1[0][0]) * L2[1][1] - (L2[0][1] - L1[0][1]) * L2[1][0]) / den;
      out.push([L1[0][0] + L1[1][0] * t, L1[0][1] + L1[1][1] * t]);
    }
    return out;
  }
  /* inválido: virou do avesso (sinal da área trocou) ou quase sem área */
  function valido(pol, ref) {
    if (!pol || pol.length < 3) return false;
    var a = areaS(pol);
    return Math.abs(a) >= 1 && (a > 0) === (ref > 0);
  }
  /* onde a reta horizontal y corta o polígono (x em ordem) */
  function cortes(pol, y) {
    var xs = [];
    for (var i = 0; i < pol.length; i++) {
      var a = pol[i], b = pol[(i + 1) % pol.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    return xs.sort(function (p, q) { return p - q; });
  }
  function envolt(pts) {
    var p = pts.map(function (q) { return [q[0], q[1]]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (p.length < 3) return p;
    var cr = function (q, a, b) { return (a[0] - q[0]) * (b[1] - q[1]) - (a[1] - q[1]) * (b[0] - q[0]); }, lo = [], hi = [], i;
    for (i = 0; i < p.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p[i]) <= 0) hi.pop(); hi.push(p[i]); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  /* zona do obstáculo: Redondo = octógono de apótema r + folga (vértices em
     k·45° + 22,5°; só para as ligações: as passadas usam os círculos abaixo);
     polígono = envoltória recuada para fora em "folga", em esquadria, com
     teto de 3 x folga */
  function zona(ob) {
    var z = [], k;
    if (ob.tipo === "circulo" || (ob.c && ob.r)) {
      var R = (Number(ob.r) + folga) / Math.cos(Math.PI / 8);
      for (k = 0; k < 8; k++) { var a = k * Math.PI / 4 + Math.PI / 8; z.push([ob.c[0] + Math.cos(a) * R, ob.c[1] + Math.sin(a) * R]); }
      return z;
    }
    var h = envolt(ob.pts || []), n = h.length;
    if (n < 3) return [];
    var sg = areaS(h) > 0 ? 1 : -1;
    var nor = function (a, b) { var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dz / l * sg, -dx / l * sg]; };
    return h.map(function (v, i) {
      var n1 = nor(h[(i - 1 + n) % n], v), n2 = nor(v, h[(i + 1) % n]);
      var bx = n1[0] + n2[0], bz = n1[1] + n2[1], l = Math.hypot(bx, bz) || 1;
      bx /= l; bz /= l;
      var m = Math.min(3, 1 / Math.max(.2, bx * n1[0] + bz * n1[1])) * folga;
      return [v[0] + bx * m, v[1] + bz * m];
    });
  }
  function dentroP(p, pol) {
    var ok = false;
    for (var i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      var a = pol[i], b = pol[j];
      if (((a[1] > p[1]) !== (b[1] > p[1])) && (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])) ok = !ok;
    }
    return ok;
  }
  function segDentro(a, b, pol) {
    var n = Math.max(2, Math.ceil(dist(a, b)));
    for (var k = 0; k <= n; k++) { var t = k / n; if (!dentroP([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], pol)) return false; }
    return true;
  }
  /* cópia fiel de cruzaZona/contornar do campo (campo/index.html) */
  function cruza(z, a, b) {
    var n = z.length, sg = areaS(z) > 0 ? 1 : -1, dx = b[0] - a[0], dz = b[1] - a[1], t0 = 0, t1 = 1, e0 = -1, e1 = -1;
    for (var i = 0; i < n; i++) {
      var p = z[i], q = z[(i + 1) % n], nx = (q[1] - p[1]) * sg, nz = -(q[0] - p[0]) * sg;
      var num = nx * (a[0] - p[0]) + nz * (a[1] - p[1]), den = nx * dx + nz * dz;
      if (Math.abs(den) < 1e-9) { if (num > -1e-6) return null; continue; }
      var t = -num / den;
      if (den < 0) { if (t > t0 || (e0 < 0 && t >= t0 - 1e-6)) { t0 = Math.max(t, 0); e0 = i; } }
      else if (t < t1 || (e1 < 0 && t <= t1 + 1e-6)) { t1 = Math.min(t, 1); e1 = i; }
      if (t0 > t1) return null;
    }
    if ((t1 - t0) * Math.hypot(dx, dz) < .6 || e0 < 0 || e1 < 0) return null;
    return { t0: t0, t1: t1, e0: e0, e1: e1 };
  }
  function contorna(a, b, zonas, limite, prof) {
    var melhor = null;
    zonas.forEach(function (z) { var q = cruza(z, a, b); if (q && (!melhor || q.t0 < melhor.c.t0)) melhor = { z: z, c: q }; });
    if (!melhor) return [];
    if (prof > 6) return [{ p: b.slice(), alto: true }];
    var z = melhor.z, q = melhor.c, n = z.length, frente = [], tras = [], i, k;
    for (i = (q.e0 + 1) % n, k = 0; k < n; i = (i + 1) % n, k++) { frente.push(z[i]); if (i === q.e1) break; }
    for (i = q.e0, k = 0; k < n; i = (i - 1 + n) % n, k++) { if (i === q.e1) break; tras.push(z[i]); }
    var E = [a[0] + (b[0] - a[0]) * q.t0, a[1] + (b[1] - a[1]) * q.t0], X = [a[0] + (b[0] - a[0]) * q.t1, a[1] + (b[1] - a[1]) * q.t1];
    var comp = function (l) { var t = 0, p = E; l.concat([X]).forEach(function (r) { t += dist(p, r); p = r; }); return t; };
    var cam = frente.length && (comp(frente) <= comp(tras) || !tras.length) ? frente : tras;
    if (!cam.length) return [{ p: b.slice(), alto: true }];
    var xs = limite.map(function (p) { return p[0]; }), zs = limite.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), z0 = Math.min.apply(null, zs), z1 = Math.max.apply(null, zs);
    var fora = cam.some(function (r) { return r[0] < x0 - 12 || r[0] > x1 + 12 || r[1] < z0 - 12 || r[1] > z1 + 12; });
    if (fora || comp(cam) > dist(E, X) * 3 + 40) return [{ p: b.slice(), alto: true }];
    return cam.map(function (r) { return { p: r }; }).concat(contorna(cam[cam.length - 1], b, zonas, limite, prof + 1));
  }

  if (!lim || lim.length < 3) return [];
  var A0 = areaS(lim);
  if (Math.abs(A0) < 1) return [];
  /* passo 1: laço (fronteira), linha das ligações (L) e borda do pulverizado (S).
     Rota e fronteira (g6 #0103): S fica esp/2 por dentro do LAÇO (o amarelo
     termina a esp/2 dele) e a ponta branca tem esp/2 AO LONGO da passada,
     sem passar de L (laço + folgaLig; 0 = pode encostar no laço). A grade das
     passadas continua presa 0,2 m mais para dentro (1ª passada a ~esp + 0,2
     do laço) */
  var dL = cob === "Somente rota" ? laco0 : laco0 + folgaLig;
  var lacoW = borda(lim, laco0), LW = borda(lim, dL), SW = cob === "Somente rota" ? LW : borda(lim, laco0 + esp / 2);
  var okLaco = valido(lacoW, A0), okL = valido(LW, A0), okS = okL && valido(SW, A0);
  var L = LW.map(gira), S = SW.map(gira), lacoR = lacoW.map(gira), limR = lim.map(gira);
  var GW = cob === "Somente rota" ? SW : borda(lim, laco0 + .2 + esp / 2), G = valido(GW, A0) ? GW.map(gira) : S;
  /* a travessia entre passadas não sai da área: conferida 0,3 m por fora de L */
  var chkW = borda(lim, Math.max(0, dL - .3)), chk = valido(chkW, A0) ? chkW.map(gira) : limR;
  var ehCirc = function (ob) { return ob.tipo === "circulo" || !!(ob.c && ob.r); };
  var zonas = (o.obs || []).map(zona).filter(function (z) { return z.length >= 3; }).map(function (z) { return z.map(gira); });
  var zonasCorte = (o.obs || []).filter(function (ob) { return !ehCirc(ob); }).map(zona).filter(function (z) { return z.length >= 3; })
    .map(function (z) { return z.map(gira); });
  /* Redondo (g6 #0110 medido pelo espaçamento, 36 px/m): zona de pulverização
     = círculo de raio r + folga (4,7 m): a passada que só a atravessa (a 4,6 m
     do centro) segue reta, branca dentro dele. Zona de voo = r + segurança
     (folga − 1,7; 3,0 m): a passada que entra nela (a 0,1 e 2,3 m) é cortada
     no círculo e desvia por uma polilinha só dela, a r + folga dos lados e a
     r + folga + 0,3·d no fundo (4,7 m com d = 0; 5,4 m com d = 2,3: passa por
     cima da vizinha; os desvios de passadas vizinhas se cruzam) */
  var circs = (o.obs || []).filter(ehCirc).map(function (ob) {
    var r = Number(ob.r) || 1.5;
    return { c: gira(ob.c), rs: r + folga, rv: r + Math.max(0, folga - 1.7), rd: r + folga };
  });
  var sem = (o.sem || []).filter(function (p) { return p && p.length >= 3; }).map(function (p) { return p.map(gira); });
  var out = [];
  var emite = function (p, a, t) { out.push([p[0], p[1], a, t || 0]); };
  /* desvio de uma passada em volta do Redondo C, do corte de entrada ao de
     saída; false se sair do talhão (aí passa por cima, trecho alto) */
  var desvioRedondo = function (C, y, mais) {
    var dd = y - C.c[1], sn = dd >= 0 ? 1 : -1, ad = Math.abs(dd), tg = Math.tan(Math.PI / 8), h = C.rd + .3 * ad, w = [];
    if (C.rd * tg > ad) w.push([-C.rd, sn * C.rd * tg]);
    w.push([-h * tg, sn * h], [h * tg, sn * h]);
    if (C.rd * tg > ad) w.push([C.rd, sn * C.rd * tg]);
    if (!mais) w.reverse();
    w = w.map(function (p) { return [C.c[0] + p[0], C.c[1] + p[1]]; });
    if (w.some(function (p) { return !dentroP(p, limR); })) return false;
    w.forEach(function (p) { emite(p, 0); });
    return true;
  };
  var ult = function () { var u = out[out.length - 1]; return [u[0], u[1]]; };
  var contornarAte = function (a, q) { contorna(a, q, zonas, L, 0).forEach(function (w) { emite(w.p, 0, w.alto ? 2 : 0); }); };
  /* liga o último ponto a q (desviando das zonas); entre passadas, se a
     travessia sai da área, recua as duas pontas pelas próprias passadas */
  var ligar = function (q, dirAnt, dirProx) {
    if (!out.length) { emite(q, 0); return; }
    var a = ult();
    if (dirAnt && dirProx && !segDentro(a, q, chk)) {
      for (var d = 2; d <= 60; d += 2) {
        var a2 = [a[0] - dirAnt[0] * d, a[1] - dirAnt[1] * d], b2 = [q[0] + dirProx[0] * d, q[1] + dirProx[1] * d];
        if (!segDentro(a2, b2, chk)) continue;
        emite(a2, 0);
        contornarAte(a2, b2);
        if (dist(ult(), b2) > .1) emite(b2, 0);
        a = b2;
        break;
      }
    }
    contornarAte(a, q);
    if (dist(ult(), q) > .1) emite(q, 0);
  };

  /* passo 2: linhas e peças */
  var linhas = [];
  if (cob !== "Somente fronteira" && okS) {
    var minY = Infinity, maxY = -Infinity;
    G.forEach(function (p) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    for (var y = minY + esp / 2; y < maxY; y += esp) {
      var cs = cortes(S, y), cl = cortes(L, y), pecas = [];
      for (var j = 0; j + 1 < cs.length; j += 2) {
        var pa = cs[j], pb = cs[j + 1], ta = pa, tb = pb;
        for (var m = 0; m + 1 < cl.length; m += 2) if (cl[m] <= pa + 1e-6 && cl[m + 1] >= pb - 1e-6) { ta = cl[m]; tb = cl[m + 1]; break; }
        if (cob !== "Somente rota") { ta = Math.max(ta, pa - esp / 2); tb = Math.min(tb, pb + esp / 2); }
        if (pb - pa > 1) pecas.push({ ta: ta, tb: tb, a: pa, b: pb });
      }
      /* corte por zona: sem ponta branca no lado do obstáculo */
      for (var zi = 0; zi < zonasCorte.length && pecas.length; zi++) {
        var cz = cortes(zonasCorte[zi], y);
        if (cz.length < 2) continue;
        var za = cz[0], zb = cz[cz.length - 1], nov = [];
        for (var pi = 0; pi < pecas.length; pi++) {
          var q = pecas[pi];
          if (zb <= q.ta || za >= q.tb) { nov.push(q); continue; }
          var bE = Math.min(q.b, za), aD = Math.max(q.a, zb);
          if (bE - q.a > 1) nov.push({ ta: q.ta, tb: za, a: q.a, b: bE });
          if (q.b - aD > 1) nov.push({ ta: zb, tb: q.tb, a: aD, b: q.b });
        }
        pecas = nov;
      }
      /* Redondo: só corta (e marca o desvio entre as duas peças) se a passada
         entra na zona de voo; o corte fica no círculo de pulverização */
      for (var ci = 0; ci < circs.length && pecas.length; ci++) {
        var C = circs[ci], dc = y - C.c[1];
        if (Math.abs(dc) >= C.rv) continue;
        var wc = Math.sqrt(C.rs * C.rs - dc * dc), ca = C.c[0] - wc, cb = C.c[0] + wc, nv = [];
        for (var pj = 0; pj < pecas.length; pj++) {
          var q2 = pecas[pj], pE = null, pD = null;
          if (cb <= q2.ta || ca >= q2.tb) { nv.push(q2); continue; }
          if (Math.min(q2.b, ca) - q2.a > 1) { pE = { ta: q2.ta, tb: ca, a: q2.a, b: Math.min(q2.b, ca), cE: q2.cE }; nv.push(pE); }
          if (q2.b - Math.max(q2.a, cb) > 1) { pD = { ta: cb, tb: q2.tb, a: Math.max(q2.a, cb), b: q2.b, cD: q2.cD }; nv.push(pD); }
          if (pE && pD) { pE.cD = C; pD.cE = C; }
        }
        pecas = nv;
      }
      if (pecas.length) linhas.push({ y: y, pecas: pecas });
    }
  }
  /* passo 3: segmentação */
  var sg0 = o.seg || [0, 100], nl = linhas.length;
  if (sg0[0] > 0 || sg0[1] < 100) linhas = linhas.slice(Math.floor(nl * sg0[0] / 100), Math.ceil(nl * sg0[1] / 100));
  /* passo 4: serpentina */
  var dirAnt = null;
  linhas.forEach(function (ln, k) {
    var mais = k % 2 === 0, dir = [mais ? 1 : -1, 0], y = ln.y;
    var ps = ln.pecas.slice().sort(function (p, q) { return mais ? p.ta - q.ta : q.ta - p.ta; });
    ps.forEach(function (q, idx) {
      var ini = mais ? q.ta : q.tb, s0 = mais ? q.a : q.b, s1 = mais ? q.b : q.a, fim = mais ? q.tb : q.ta;
      /* entre as duas peças de uma passada cortada pelo Redondo: o desvio dela */
      var cv = idx > 0 ? (mais ? q.cE : q.cD) : null;
      if (cv) { var porCima = !desvioRedondo(cv, y, mais); emite([ini, y], 0, porCima ? 2 : 0); }
      else ligar([ini, y], idx === 0 ? dirAnt : null, idx === 0 ? dir : null);
      if (Math.abs(s0 - ini) > .05) emite([s0, y], 0);
      /* áreas sem aplicação: o trecho dentro delas fica branco */
      var ws = [], lo = Math.min(s0, s1), hi = Math.max(s0, s1);
      sem.forEach(function (pol) {
        var cz = cortes(pol, y);
        for (var j = 0; j + 1 < cz.length; j += 2) {
          var w0 = Math.max(cz[j], lo), w1 = Math.min(cz[j + 1], hi);
          if (w1 - w0 > .05) ws.push([w0, w1]);
        }
      });
      /* Redondo que a passada só atravessa (fora da zona de voo): branco e reto */
      circs.forEach(function (C) {
        var dc = y - C.c[1];
        if (Math.abs(dc) < C.rv || Math.abs(dc) >= C.rs) return;
        var wc = Math.sqrt(C.rs * C.rs - dc * dc), w0 = Math.max(C.c[0] - wc, lo), w1 = Math.min(C.c[0] + wc, hi);
        if (w1 - w0 > .05) ws.push([w0, w1]);
      });
      ws.sort(function (p, q) { return p[0] - q[0]; });
      var junt = [];
      ws.forEach(function (w) { var u = junt[junt.length - 1]; if (u && w[0] <= u[1]) u[1] = Math.max(u[1], w[1]); else junt.push(w.slice()); });
      if (!mais) junt = junt.reverse().map(function (w) { return [w[1], w[0]]; });
      var cur = s0;
      junt.forEach(function (w) {
        if (Math.abs(w[0] - cur) > .05) emite([w[0], y], 1);
        emite([w[1], y], 0);
        cur = w[1];
      });
      if (Math.abs(s1 - cur) > .05 || !junt.length) emite([s1, y], 1);
      if (Math.abs(fim - s1) > .05) emite([fim, y], 0);
    });
    dirAnt = dir;
  });
  /* passo 5: fronteira, voada por último (horário = área com sinal > 0) */
  if (cob !== "Somente rota" && okLaco) {
    var lc = lacoR.slice(), nL = lc.length, hor = areaS(lc) > 0, mm;
    if ((o.sentido === "anti") === hor) lc.reverse();
    if (out.length) {
      var u = ult(), melhor = Infinity, Q = lc[0], jj = 0;
      for (var j2 = 0; j2 < nL; j2++) {
        var e0 = lc[j2], e1 = lc[(j2 + 1) % nL], ex = e1[0] - e0[0], ez = e1[1] - e0[1], l2 = ex * ex + ez * ez;
        var tt = l2 > 1e-12 ? Math.max(0, Math.min(1, ((u[0] - e0[0]) * ex + (u[1] - e0[1]) * ez) / l2)) : 0;
        var pq = [e0[0] + ex * tt, e0[1] + ez * tt], dq = dist(u, pq);
        if (dq < melhor) { melhor = dq; Q = pq; jj = j2; }
      }
      ligar(Q, null, null);
      for (mm = 1; mm <= nL; mm++) emite(lc[(jj + mm) % nL], 1, 1);
      emite(Q, 1, 1);
    } else {
      emite(lc[0], 0);
      for (mm = 1; mm <= nL; mm++) emite(lc[mm % nL], 1, 1);
    }
  }
  return out.map(function (q) {
    var p = desgira(q);
    return [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000, q[2], q[3]];
  });
}

/* entradas do gerador a partir de uma tarefa do app (as mesmas que vão ao
   jogo em enviarTalhao) */
function folgaObsTarefa(t) { return (t.seguranca == null || t.seguranca === "" ? 1.5 : Number(t.seguranca) || 0) + 1.7; }
function obsDaTarefa(t) {
  return (t.obs || []).filter(function (o) { return o.tipo === "circulo" || (!o.sem && o.pts && o.pts.length >= 3); })
    .map(function (o) { return o.tipo === "circulo" ? { tipo: "circulo", c: o.c, r: Number(o.r) || 1.5 } : { tipo: "poligono", pts: o.pts }; });
}
function semDaTarefa(t) {
  return (t.obs || []).filter(function (o) { return o.sem && o.pts && o.pts.length >= 3; }).map(function (o) { return o.pts; });
}
/* a rota planejada da tarefa: [[x, z, aplica, tipo]...], o MESMO formato da
   rota do jogo; guardada pelas entradas (o desenho roda a cada estado) */
var CACHE_ROTA = {}, CACHE_N = 0;
function rotaPlanejada(t, ang, semSeg) {
  if (poligonoCruzado(t.limite)) return [];
  var lim = areaTarefa(t);
  if (!lim || lim.length < 3) return [];
  /* semSeg: a rota inteira, sem tirar as passadas da segmentação (o mapa as desenha em cinza por baixo) */
  var o = { esp: t.esp || 6, ang: ang, cob: t.cob || "Somente rota", sentido: t.sentido || "horario", seg: semSeg ? [0, 100] : (t.seg || [0, 100]),
    obs: obsDaTarefa(t), sem: semDaTarefa(t), folgaObs: folgaObsTarefa(t), laco: 1.5, folgaLig: 0 };
  var chave = JSON.stringify([lim, o]);
  if (CACHE_ROTA[chave]) return CACHE_ROTA[chave];
  if (++CACHE_N > 40) { CACHE_ROTA = {}; CACHE_N = 1; }
  var r;
  try { r = gerarRotaPulv(lim, o); } catch (e) { console.error(e); r = []; }
  CACHE_ROTA[chave] = r;
  return r;
}

/* rota do mapeamento (ANALISE_LINHAS 4): passadas a cada 20 m paralelas à
   aresta mais longa, a 1ª sobre ela; cada passada passa 20 m do talhão de
   cada lado; serpentina a partir da ponta mais perto do 1º ponto; tudo amarelo */
function rotaDeMapeamento(t) {
  if (t.rotaMap === "fronteira") {
    var pts = t.limite || [];
    return pts.length < 3 || poligonoCruzado(pts) ? [] : pts.concat([pts[0]]).map(function(p) { return [p[0],p[1],0,0]; });
  }
  return rotaMapeamento(t.limite, t.angManual);
}
function rotaMapeamento(lim, angM) {
  if (poligonoCruzado(lim)) return [];
  if (!lim || lim.length < 3) return [];
  var n = lim.length, ie = 0, melhor = -1, i, ESP = 20, EXT = 20;
  for (i = 0; i < n; i++) {
    var a = lim[i], b = lim[(i + 1) % n], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > melhor) { melhor = d; ie = i; }
  }
  var A = lim[ie], B = lim[(ie + 1) % n], angA = Math.atan2(B[1] - A[1], B[0] - A[0]);
  /* ângulo manual igual ao da aresta mais longa: mesma regra do automático */
  var auto = angM == null || Math.abs(Math.sin(angM - angA)) < 1e-6;
  var ang = auto ? angA : angM;
  var c = Math.cos(-ang), s = Math.sin(-ang);
  var gira = function (p) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
  var desgira = function (p) { return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; };
  var R = lim.map(gira), minY = Infinity, maxY = -Infinity, cy = 0;
  R.forEach(function (p) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); cy += p[1] / n; });
  var y0, dir, p0 = gira(lim[0]);
  if (auto) { y0 = gira(A)[1]; dir = cy >= y0 ? 1 : -1; }
  else { dir = p0[1] - minY <= maxY - p0[1] ? 1 : -1; y0 = dir > 0 ? minY : maxY; }
  var ext = dir > 0 ? maxY - y0 : y0 - minY, K = Math.max(0, Math.ceil(ext / ESP - 1e-6)), linhas = [];
  for (var k = 0; k <= K; k++) {
    var y = y0 + dir * k * ESP, xa, xb;
    if (k === 0 && auto) { var ga = gira(A), gb = gira(B); xa = Math.min(ga[0], gb[0]); xb = Math.max(ga[0], gb[0]); }
    else {
      var yc = Math.max(minY + .01, Math.min(maxY - .01, y)), xs = [];
      for (i = 0; i < n; i++) {
        var p = R[i], q = R[(i + 1) % n];
        if ((p[1] <= yc && q[1] > yc) || (q[1] <= yc && p[1] > yc)) xs.push(p[0] + (yc - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
      }
      if (xs.length < 2) continue;
      xa = Math.min.apply(null, xs); xb = Math.max.apply(null, xs);
    }
    linhas.push([[xa - EXT, y], [xb + EXT, y]]);
  }
  if (!linhas.length) return [];
  /* começa pela ponta da 1ª passada mais perto do 1º ponto */
  var e0 = desgira(linhas[0][0]), e1 = desgira(linhas[0][1]);
  var mais = Math.hypot(e0[0] - lim[0][0], e0[1] - lim[0][1]) <= Math.hypot(e1[0] - lim[0][0], e1[1] - lim[0][1]);
  var out = [];
  linhas.forEach(function (l) {
    var u = mais ? [l[0], l[1]] : [l[1], l[0]];
    u.forEach(function (p) { var m = desgira(p); out.push([Math.round(m[0] * 1000) / 1000, Math.round(m[1] * 1000) / 1000, 1, 0]); });
    mais = !mais;
  });
  return out;
}

/* ------------------------------------------------ desenho da rota (6) */
var COR_ROTA = { passada: "#F7E523", fronteira: "#EBAC05", branco: "#FFFFFF", feito: "#9B9A9B" };
function primeiroDaRota(r) { for (var i = 0; i < r.length; i++) if (r[i][3] !== 4) return i; return r.length; }
/* direção (graus de tela) do trecho que sai de r[i]; pula trechos sem tamanho */
function direcaoEm(r, i, passo) {
  for (var j = i; j >= 0 && j + passo >= 0 && j + passo < r.length && j < r.length; j += passo) {
    var a = passo > 0 ? r[j] : r[j + passo], b = passo > 0 ? r[j + passo] : r[j];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-3) return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  }
  return 0;
}
function gTela(m, k, rot) {
  var p = paraPx(m[0], m[1]);
  return '<g transform="translate(' + p[0].toFixed(2) + " " + p[1].toFixed(2) + ") scale(" + k + ")" + (rot ? " rotate(" + rot.toFixed(1) + ")" : "") + '">';
}
function marcoInicio(m, graus, k) {
  return gTela(m, k, graus) + '<path d="M15 -4H25V-12L41 0L25 12V4H15Z" fill="#6DD400" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<circle r="12.5" fill="#6DD400" stroke="#FFFFFF" stroke-width="4"/></g>';
}
function marcoFim(m, graus, k) {
  return gTela(m, k, graus) + '<path d="M-42 -4H-30V-12L-15 0L-30 12V4H-42Z" fill="#F0AC00" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<circle r="12.5" fill="#F0AC00" stroke="#FFFFFF" stroke-width="4"/></g>';
}
function projecaoT(p, a, b) {
  var dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  return l2 > 1e-12 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
}
/* r = [[x,z,aplica,tipo]]; op = {cinza:{i,p}, tudoCinza, mapeamento, semInicio,
   inicioEm:{i,p}, semFim}. Devolve {r: linhas (camada-rota), m: marcos} */
function desenharRotaPts(r, k, op) {
  op = op || {};
  var n = r ? r.length : 0, saida = { r: "", m: "" };
  if (n < 2) return saida;
  var i0 = primeiroDaRota(r);
  if (i0 >= n - 1) return saida;
  var pedacos = [];   // {a, b, cor, passe}
  var cinza = op.cinza;
  for (var i = i0 + 1; i < n; i++) {
    var a = r[i - 1], b = r[i], tipo = b[3] || 0, ap = !!b[2];
    if (tipo === 4) continue;
    var cor = op.mapeamento ? COR_ROTA.passada : ap ? (tipo === 1 ? COR_ROTA.fronteira : COR_ROTA.passada) : COR_ROTA.branco;
    var passe = op.mapeamento || ap ? 1 : 2;
    if (op.tudoCinza) cor = COR_ROTA.feito;
    else if (cinza && tipo !== 1 && i <= cinza.i) {
      if (i < cinza.i) cor = COR_ROTA.feito;
      else {
        var t = cinza.p ? projecaoT(cinza.p, a, b) : 0, mm = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (t > 0) pedacos.push({ a: a, b: mm, cor: COR_ROTA.feito, passe: passe });
        if (t < 1) pedacos.push({ a: mm, b: b, cor: cor, passe: passe });
        continue;
      }
    }
    pedacos.push({ a: a, b: b, cor: cor, passe: passe });
  }
  /* trechos seguidos da mesma cor viram uma polyline; o branco por cima */
  var linhas = [[], []], atual = null;
  pedacos.forEach(function (p) {
    if (!atual || atual.cor !== p.cor || atual.passe !== p.passe) {
      atual = { cor: p.cor, passe: p.passe, pts: [p.a] };
      linhas[p.passe - 1].push(atual);
    }
    atual.pts.push(p.b);
  });
  var w = (5 * k).toFixed(3);
  linhas[0].concat(linhas[1]).forEach(function (l) {
    saida.r += '<polyline points="' + l.pts.map(function (m) { var p = paraPx(m[0], m[1]); return p[0].toFixed(2) + "," + p[1].toFixed(2); }).join(" ") +
      '" fill="none" stroke="' + l.cor + '" stroke-width="' + w + '" stroke-linejoin="miter" stroke-linecap="square"/>';
  });
  /* trechos pulados na retomada pelo ponto de retorno 1/2 (piloto nº 38):
     do ponto de interrupção ao ponto escolhido, pela rota, ficam brancos
     (sem pulverizar), por cima do cinza e do amarelo. pulos = [{de:{i,p}, ate:{i,p}}] */
  (op.pulos || []).forEach(function (pu) {
    if (!pu || !pu.de || !pu.ate || !pu.de.p || !pu.ate.p) return;
    var lista = [pu.de.p];
    for (var j = Math.max(1, pu.de.i); j < pu.ate.i && j < n; j++) lista.push(r[j]);
    lista.push(pu.ate.p);
    saida.r += '<polyline points="' + lista.map(function (m) { var p = paraPx(m[0], m[1]); return p[0].toFixed(2) + "," + p[1].toFixed(2); }).join(" ") +
      '" fill="none" stroke="' + COR_ROTA.branco + '" stroke-width="' + w + '" stroke-linejoin="miter" stroke-linecap="square"/>';
  });
  /* início (seta saindo) e fim (seta chegando) */
  if (!op.semInicio) {
    if (op.inicioEm && op.inicioEm.p) {
      var ii = Math.max(i0 + 1, Math.min(n - 1, op.inicioEm.i || 0));
      saida.m += marcoInicio(op.inicioEm.p, direcaoEm(r, ii - 1, 1), k);
    } else saida.m += marcoInicio(r[i0], direcaoEm(r, i0, 1), k);
  }
  if (!op.semFim && !(op.mapeamento && n < 4)) saida.m += marcoFim(r[n - 1], direcaoEm(r, n - 1, -1), k);
  return saida;
}

/* ------------------------------------------------------- vista do mapa */
var SVG = $("#mundo"), VISTA = $("#vista");
function aplicarVista() {
  VISTA.setAttribute("transform", "translate(" + M.vista.x + " " + M.vista.y + ") scale(" + M.vista.k + ")");
  /* escala: 10 m ou 5 m, conforme o zoom */
  var mPor60 = 60 / M.vista.k * ESCALA_M;
  var passo = [1, 2, 5, 10, 20, 50, 100, 200].filter(function (v) { return v >= mPor60 * .6; })[0] || 200;
  var largura = passo / ESCALA_M * M.vista.k;
  var esc = $("#escala-mapa");
  esc.firstChild.textContent = passo + "m";
  esc.querySelector("svg").style.width = Math.max(30, Math.min(90, largura)) + "px";
  desenharTudo();
}
function centrarEm(px, py, k) {
  if (k) M.vista.k = k;
  M.vista.x = 960 - px * M.vista.k;
  M.vista.y = 600 - py * M.vista.k;
  aplicarVista();
}
function telaParaMapa(sx, sy) { return [(sx - M.vista.x) / M.vista.k, (sy - M.vista.y) / M.vista.k]; }
function evParaTela(e) {
  var r = PALCO.getBoundingClientRect();
  return [(e.clientX - r.left) / APP.escala, (e.clientY - r.top) / APP.escala];
}

/* arrastar / pinçar / tocar */
(function () {
  var toques = {}, ini = null, arrastando = null, moveu = false;
  SVG.addEventListener("pointerdown", function (e) {
    SVG.setPointerCapture(e.pointerId);
    toques[e.pointerId] = evParaTela(e);
    var ids = Object.keys(toques);
    moveu = false;
    if (ids.length === 1) {
      ini = { p: toques[e.pointerId], v: { x: M.vista.x, y: M.vista.y, k: M.vista.k } };
      arrastando = M.sub === "edicao" ? pontoPerto(toques[e.pointerId]) : null;
    } else if (ids.length === 2) {
      var a = toques[ids[0]], b = toques[ids[1]];
      ini = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], v: { x: M.vista.x, y: M.vista.y, k: M.vista.k } };
      arrastando = null;
    }
  });
  SVG.addEventListener("pointermove", function (e) {
    if (!toques[e.pointerId] || !ini) return;
    toques[e.pointerId] = evParaTela(e);
    var ids = Object.keys(toques);
    if (ids.length === 1 && ini.p) {
      var p = toques[ids[0]], dx = p[0] - ini.p[0], dy = p[1] - ini.p[1];
      if (Math.abs(dx) + Math.abs(dy) > 8) moveu = true;
      if (!moveu) return;
      if (arrastando) {
        var q = telaParaMapa(p[0], p[1]), m = paraM(q[0], q[1]);
        if (arrastando.circulo) { arrastarCirculo(arrastando, m); desenharTudo(); atualizarInfo(); return; }
        arrastando.lista[arrastando.i] = m;
        M.arraste = arrastando;   // mapeamento: rótulos das arestas e rota parada até soltar
        desenharTudo(); atualizarInfo();
      } else {
        M.vista.x = ini.v.x + dx; M.vista.y = ini.v.y + dy; aplicarVista();
      }
    } else if (ids.length === 2 && ini.d) {
      var a = toques[ids[0]], b = toques[ids[1]];
      var d = Math.hypot(a[0] - b[0], a[1] - b[1]), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      var k = Math.max(Math.min(.4, ini.v.k), Math.min(8, ini.v.k * d / ini.d));
      var w = [(ini.c[0] - ini.v.x) / ini.v.k, (ini.c[1] - ini.v.y) / ini.v.k];
      M.vista.k = k; M.vista.x = c[0] - w[0] * k; M.vista.y = c[1] - w[1] * k;
      moveu = true; aplicarVista();
    }
  });
  function soltar(e) {
    var p = toques[e.pointerId];
    delete toques[e.pointerId];
    if (!Object.keys(toques).length) {
      if (!moveu && p) tocouMapa(p);
      ini = null; arrastando = null;
      if (M.arraste || M.arrasteRaio) { M.arraste = null; M.arrasteRaio = null; desenharTudo(); }
    }
  }
  SVG.addEventListener("pointerup", soltar);
  SVG.addEventListener("pointercancel", soltar);
  SVG.addEventListener("wheel", function (e) {
    var p = evParaTela(e), w = telaParaMapa(p[0], p[1]);
    M.vista.k = Math.max(Math.min(.4, M.vista.k), Math.min(8, M.vista.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));   // abaixo de .4 só depois de enquadrar um Redondo grande
    M.vista.x = p[0] - w[0] * M.vista.k; M.vista.y = p[1] - w[1] * M.vista.k; aplicarVista();
  }, { passive: true });
})();

/* ---- Redondo (25/10/2026): alca na circunferencia (45 graus, embaixo a direita).
   26/10/2026 (fotos do controle real do Eduardo): raio de 1,5 a 1000 m; tocar no ponto central abre o painel "Redondo" (cruzeta com a
   "Distancia ajustada", Raio com - / + / digitar, Redefinir, Excluir); arrastar a alca mostra a distancia do centro ate o dedo ---- */
var RAIO_REDONDO = { min: 1.5, max: 1000 };
function limitarRaio(r) { return Math.max(RAIO_REDONDO.min, Math.min(RAIO_REDONDO.max, Math.round(r * 10) / 10)); }
/* de onde o Redondo partiu (criado, ou tocado pela 1a vez numa tarefa aberta): a "Distancia ajustada" e o Redefinir medem a partir daqui */
function origemRedondo(ob) {
  if (!ob.rOrig) { ob.rOrig = Number(ob.r) || 1.5; ob.cOrig = ob.c.slice(); }
  return ob;
}
function alcaRedondo(ob) {
  var p = paraPx(ob.c[0], ob.c[1]), d = (Number(ob.r) || 1.5) / ESCALA_M * Math.SQRT1_2;
  return [p[0] + d, p[1] + d];
}
function telaDoPx(p) { return [p[0] * M.vista.k + M.vista.x, p[1] * M.vista.k + M.vista.y]; }
/* toque na alca (muda o raio) ou no centro (move o circulo) do Redondo selecionado; o mais perto vence */
function circuloPerto(tela) {
  var ob = M.ed && M.ed.redondoAtivo;
  if (!ob || M.ed.obs.indexOf(ob) < 0) return null;
  origemRedondo(ob);
  var h = telaDoPx(alcaRedondo(ob)), c = telaDoPx(paraPx(ob.c[0], ob.c[1]));
  var dh = Math.hypot(h[0] - tela[0], h[1] - tela[1]), dc = Math.hypot(c[0] - tela[0], c[1] - tela[1]);
  if (dh < 44 && dh <= dc) {
    var w = telaParaMapa(tela[0], tela[1]), m = paraM(w[0], w[1]);
    M.ed.redondoSel = "alca"; atualizarPainelRedondo();
    return { circulo: ob, alvo: "raio", r0: Number(ob.r) || 1.5, d0: Math.hypot(m[0] - ob.c[0], m[1] - ob.c[1]) };
  }
  if (dc < 44) { M.ed.redondoSel = "centro"; atualizarPainelRedondo(); return { circulo: ob, alvo: "centro" }; }
  return null;
}
/* o menor Redondo que contem o toque (toque minimo de 30 px: com o zoom afastado o circulo de 1,5 m e minusculo) */
function circuloTocado(tela) {
  var achou = null, menor = Infinity;
  ((M.ed && M.ed.obs) || []).forEach(function (ob) {
    if (ob.tipo !== "circulo") return;
    var c = telaDoPx(paraPx(ob.c[0], ob.c[1])), rt = Math.max(30, (Number(ob.r) || 1.5) / ESCALA_M * M.vista.k);
    if (Math.hypot(c[0] - tela[0], c[1] - tela[1]) <= rt && rt < menor) { menor = rt; achou = ob; }
  });
  return achou;
}
/* arrastando a alca o raio muda pela diferenca de distancia (sem pulo); arrastando o centro o circulo anda */
function arrastarCirculo(a, m) {
  var ob = a.circulo;
  if (a.alvo === "centro") ob.c = m;
  else {
    var d = Math.hypot(m[0] - ob.c[0], m[1] - ob.c[1]);
    ob.r = limitarRaio(a.r0 + (d - a.d0));
    M.arrasteRaio = { m: m, d: d };   // linha pontilhada e balao com a distancia do centro ate o dedo
  }
  atualizarPainelRedondo();
}
/* o aparelho mostra o circulo grande (a gravacao esta a ~40 px/m); com o mapa afastado ele tem so uns 7 px e a alca fica escondida atras do centro:
   ao marcar um Redondo o mapa se aproxima dele (so aproxima, nunca afasta; no maximo o zoom do app) */
function ampliarSobreRedondo(ob) {
  var rpx = (Number(ob.r) || 1.5) / ESCALA_M;
  if (rpx * M.vista.k >= 40) return;
  var p = paraPx(ob.c[0], ob.c[1]);
  centrarEm(p[0], p[1], Math.min(8, Math.max(M.vista.k, 55 / rpx)));
}

/* depois de mudar o raio pelo painel: o circulo grande volta a caber na tela (ate ~380 px de raio, como o controle real que afasta o mapa),
   o pequeno aproxima. O afastamento passa do zoom minimo de 0,4 do pinçar: o raio maximo (1000 m) pede ~0,09 */
function enquadrarRedondo(ob) {
  var rpx = (Number(ob.r) || 1.5) / ESCALA_M;
  if (rpx * M.vista.k > 380) { var p = paraPx(ob.c[0], ob.c[1]); centrarEm(p[0], p[1], Math.max(.05, 380 / rpx)); }
  else ampliarSobreRedondo(ob);
}
/* botao que repete enquanto o dedo fica nele: passo(n) recebe o numero da repeticao (0, 1, 2...) e devolve false quando nao ha mais o que fazer */
function segurarBotao(b, passo) {
  var t1 = 0, t2 = 0, n = 0;
  var parar = function () { clearTimeout(t1); clearInterval(t2); };
  var rodar = function () {
    if (!b.isConnected || passo(n++) === false) { parar(); return false; }
    return true;
  };
  b.addEventListener("pointerdown", function (e) {
    e.preventDefault(); parar(); n = 0;
    if (rodar()) t1 = setTimeout(function () { t2 = setInterval(rodar, 80); }, 420);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, parar); });
}

/* ---- painel "Redondo" (26/10/2026, fotos do controle real). Abre ao tocar no ponto central; mostra no lugar das configurações de rota.
   Cruzeta: empurra o ponto escolhido 0,1 m por toque (centro: anda o circulo; alca: muda o raio); "Distancia ajustada" = quanto o ponto
   escolhido saiu de onde estava quando o Redondo nasceu. Raio: - / + (segurar acelera) ou tocar no numero e digitar, de 1,5 a 1000 m.
   Redefinir volta centro e raio ao de origem; Excluir apaga o Redondo. Tocar no vazio do mapa fecha o painel. ---- */
function abrirPainelRedondo(ob, sel) {
  var ed = M.ed;
  if (!ed || M.ajuste) return;
  origemRedondo(ob);
  ed.redondoAtivo = ob; ed.painelRedondo = ob; ed.redondoSel = sel || "centro";
  M.painel = true;
  montar();
}
function fecharPainelRedondo() {
  if (!M.ed || !M.ed.painelRedondo) return;
  M.ed.painelRedondo = null; M.pRedondo = null;
  montar();
}
function moverRedondo(ob, dx, dz) {
  var ed = M.ed;
  if (!ed || ed.obs.indexOf(ob) < 0) return false;
  if (ed.redondoSel === "alca") {
    var antes = Number(ob.r) || 1.5;
    ob.r = limitarRaio(antes + (dx + dz) * .1);
    if (ob.r === antes) return false;
  } else ob.c = [Math.round((ob.c[0] + dx * .1) * 1000) / 1000, Math.round((ob.c[1] + dz * .1) * 1000) / 1000];
  atualizarPainelRedondo(); desenharTudo(); atualizarInfo();
}
/* refaz so os textos e os botoes do painel aberto (sem reconstruir: arrastar o mapa chama isto a cada movimento) */
function atualizarPainelRedondo() {
  var P = M.pRedondo, ed = M.ed;
  if (!P || !ed || !ed.painelRedondo || !P.raiz.isConnected) return;
  var ob = ed.painelRedondo, r = Number(ob.r) || 1.5;
  var aj = ed.redondoSel === "alca" ? Math.abs(r - (ob.rOrig || r)) : Math.hypot(ob.c[0] - (ob.cOrig || ob.c)[0], ob.c[1] - (ob.cOrig || ob.c)[1]);
  P.dist.textContent = num(aj, 1);
  if (!P.val.querySelector("input")) P.val.textContent = num(r, 1);
  P.menos.disabled = r <= RAIO_REDONDO.min + 1e-9;
  P.mais.disabled = r >= RAIO_REDONDO.max - 1e-9;
}
function painelRedondo(p) {
  var ed = M.ed, ob = origemRedondo(ed.painelRedondo);
  p.appendChild(el("div", "titulo", "Redondo"));
  var corpo = el("div", "rolagem");
  /* cruzeta: quatro cunhas (cima, direita, baixo, esquerda) em volta de um miolo com a distancia */
  var R = 200, ri = 104, C = 204;
  var cunha = function (ang) {
    var a0 = (ang - 45) * Math.PI / 180, a1 = (ang + 45) * Math.PI / 180;
    var P = function (rr, a) { return (C + rr * Math.cos(a)).toFixed(1) + " " + (C + rr * Math.sin(a)).toFixed(1); };
    return "M" + P(R, a0) + "A" + R + " " + R + " 0 0 1 " + P(R, a1) + "L" + P(ri, a1) + "A" + ri + " " + ri + " 0 0 0 " + P(ri, a0) + "Z";
  };
  var dirs = [["c", -90, 0, -1], ["d", 0, 1, 0], ["b", 90, 0, 1], ["e", 180, -1, 0]];   // id, angulo, dx, dz (no mapa, para cima = z menor)
  var svg = '<svg viewBox="0 0 408 408" style="width:408px;height:408px;display:block;touch-action:none">';
  dirs.forEach(function (d) {
    svg += '<path class="cunha" data-i="' + d[0] + '" d="' + cunha(d[1]) + '" fill="#e3e6e8" stroke="#fff" stroke-width="6"/>' +
      '<path d="M-24 10L0 -12L24 10" transform="translate(204 204) rotate(' + (d[1] + 90) + ') translate(0 -152)" fill="none" stroke="#0ca35c" stroke-width="9" ' +
      'stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>';
  });
  svg += '<circle cx="204" cy="204" r="100" fill="#f4f5f6" pointer-events="none"/>' +
    '<text x="204" y="206" text-anchor="middle" font-size="58" font-weight="700" fill="#1f2224" font-family="Roboto,Noto Sans,sans-serif" pointer-events="none">' +
    '<tspan class="dn">0.0</tspan><tspan font-size="36" font-weight="400" dx="8">m</tspan></text>' +
    '<text x="204" y="252" text-anchor="middle" font-size="31" fill="#4a4f54" font-family="Roboto,Noto Sans,sans-serif" pointer-events="none">Distância</text>' +
    '<text x="204" y="288" text-anchor="middle" font-size="31" fill="#4a4f54" font-family="Roboto,Noto Sans,sans-serif" pointer-events="none">ajustada</text></svg>';
  var pad = el("div", "", svg);
  pad.style.cssText = "width:408px;margin:24px auto 0";
  corpo.appendChild(pad);
  $$(".cunha", pad).forEach(function (w) {
    var d = dirs.filter(function (x) { return x[0] === w.dataset.i; })[0];
    segurarBotao(w, function () { return moverRedondo(ob, d[2], d[3]); });
    w.addEventListener("pointerdown", function () { w.setAttribute("fill", "#cdd2d6"); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { w.addEventListener(ev, function () { w.setAttribute("fill", "#e3e6e8"); }); });
  });
  /* raio */
  var campo = el("div", "campo", '<div class="rot">Raio <i>(m)</i></div><div class="passo"><button class="menos"></button><span class="val"></span><button class="mais"></button></div>');
  var bMenos = $(".menos", campo), bMais = $(".mais", campo), val = $(".val", campo);
  bMenos.innerHTML = '<svg viewBox="0 0 48 48"><path d="M10 24h28" stroke="#2b2e31" stroke-width="4" stroke-linecap="round"/></svg>';
  bMais.innerHTML = ic("i-mais");
  var mexerRaio = function (sinal) {
    return function (n) {
      var antes = Number(ob.r) || 1.5, s = n < 12 ? .1 : n < 30 ? 1 : 10;   // segurar o botao acelera
      ob.r = limitarRaio(antes + sinal * s);
      if (ob.r === antes) return false;
      enquadrarRedondo(ob); atualizarPainelRedondo(); desenharTudo(); atualizarInfo();
    };
  };
  segurarBotao(bMenos, mexerRaio(-1));
  segurarBotao(bMais, mexerRaio(1));
  editavel(val, function () { return ob.r; }, 1, RAIO_REDONDO.min, RAIO_REDONDO.max, function (nv) {
    ob.r = limitarRaio(nv); val.textContent = num(ob.r, 1);
    enquadrarRedondo(ob); atualizarPainelRedondo(); desenharTudo(); atualizarInfo();
  });
  corpo.appendChild(campo);
  p.appendChild(corpo);
  var rod = el("div", "botoes", "");
  rod.style.cssText = "display:flex;height:120px;border-top:1px solid #dcdcdc;flex:none";
  rod.innerHTML = '<button style="flex:1;font-size:36px;color:#1f2224">Redefinir</button>' +
    '<button style="flex:1;font-size:36px;font-weight:700;color:#d2232a;border-left:1px solid #dcdcdc">Excluir</button>';
  rod.children[0].addEventListener("click", function () {
    ob.c = ob.cOrig.slice(); ob.r = ob.rOrig;
    val.textContent = num(ob.r, 1);
    enquadrarRedondo(ob); atualizarPainelRedondo(); desenharTudo(); atualizarInfo();
  });
  rod.children[1].addEventListener("click", function () {
    var i = ed.obs.indexOf(ob);
    if (i >= 0) ed.obs.splice(i, 1);
    ed.redondoAtivo = null; ed.painelRedondo = null; M.pRedondo = null; M.rotaMapCache = null;
    montar(); atualizarInfo();
  });
  p.appendChild(rod);
  M.pRedondo = { raiz: p, dist: $(".dn", pad), val: val, menos: bMenos, mais: bMais };
  atualizarPainelRedondo();
}

function pontoPerto(tela) {
  if (!M.ed) return null;
  var circ = circuloPerto(tela);
  if (circ) return circ;
  var melhor = null, dmin = 44;
  ["limite"].concat(M.ed.obs.map(function (o, i) { return i; })).forEach(function (g) {
    var lista = g === "limite" ? M.ed.limite : M.ed.obs[g].pts;
    if (!lista) return;
    lista.forEach(function (m, i) {
      var px = paraPx(m[0], m[1]), sx = px[0] * M.vista.k + M.vista.x, sy = px[1] * M.vista.k + M.vista.y;
      var d = Math.hypot(sx - tela[0], sy - tela[1]);
      if (d < dmin) { dmin = d; melhor = { lista: lista, i: i }; }
    });
  });
  return melhor;
}

function tocouMapa(tela) {
  var w = telaParaMapa(tela[0], tela[1]);
  /* editando: tocar num Redondo seleciona (aparecem o centro e a alça do raio) (25/10/2026); tocar no ponto central do selecionado
     abre o painel "Redondo" ao lado; tocar no vazio fecha o painel (26/10/2026) */
  if (M.sub === "edicao" && M.ed && !M.regua) {
    var ed0 = M.ed, ativo = ed0.redondoAtivo;
    if (ativo && ed0.obs.indexOf(ativo) >= 0) {
      var hT0 = telaDoPx(alcaRedondo(ativo)), cT0 = telaDoPx(paraPx(ativo.c[0], ativo.c[1]));
      var dhT = Math.hypot(hT0[0] - tela[0], hT0[1] - tela[1]), dcT = Math.hypot(cT0[0] - tela[0], cT0[1] - tela[1]);
      if (dcT < 44 && dcT <= dhT) { abrirPainelRedondo(ativo, "centro"); return; }
      if (dhT < 44) { ed0.redondoSel = "alca"; atualizarPainelRedondo(); desenharTudo(); return; }
    }
    var tocado = circuloTocado(tela);
    if (tocado) {
      ed0.redondoAtivo = tocado; ed0.redondoSel = "centro";
      if (ed0.painelRedondo && ed0.painelRedondo !== tocado) { ed0.painelRedondo = origemRedondo(tocado); montar(); } else desenharTudo();
      return;
    }
    if (ed0.painelRedondo) { fecharPainelRedondo(); return; }
  }
  /* com um talhão aberto a régua só mede o limite dele; sem talhão, régua livre */
  if (M.regua && !limiteRegua()) {
    M.regua.push(paraM(w[0], w[1]));
    desenharTudo();
    return;
  }
  if (M.sub === "lista" && famModo()) {
    /* tocar numa tarefa no mapa seleciona (só as da família do modo) */
    var m = paraM(w[0], w[1]), fam = famModo();
    var achou = M.tarefas.filter(function (t) { return familia(t) === fam && t.limite && t.limite.length >= 3 && dentro(m, t.limite); })[0];
    if (achou) selecionar(achou.id);
  }
}
function dentro(p, pol) {
  var d = false;
  for (var i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    var a = pol[i], b = pol[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) d = !d;
  }
  return d;
}

/* ------------------------------------------------------------ desenho */
function pts(lista) { return lista.map(function (m) { var p = paraPx(m[0], m[1]); return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }
function linhaSvg(seg, cor, w, extra) {
  var a = paraPx(seg[0][0], seg[0][1]), b = paraPx(seg[1][0], seg[1][1]);
  return '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) +
    '" stroke="' + cor + '" stroke-width="' + w + '"' + (extra || "") + "/>";
}
function circulo(m, r, cor, borda, w) {
  var p = paraPx(m[0], m[1]);
  return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r + '" fill="' + cor + '" stroke="' + (borda || "none") + '" stroke-width="' + (w || 0) + '"/>';
}
function rotuloSvg(m, txt, dy) {
  var p = paraPx(m[0], m[1]), k = 1 / M.vista.k;
  return '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + (dy || 0) * k).toFixed(1) + '" text-anchor="middle" font-size="' + (30 * k).toFixed(1) +
    '" fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width="' + (4 * k).toFixed(1) + '" paint-order="stroke" font-family="Roboto,Noto Sans,sans-serif">' + txt + "</text>";
}
function centroide(pol) {
  var x = 0, z = 0;
  pol.forEach(function (p) { x += p[0]; z += p[1]; });
  return [x / pol.length, z / pol.length];
}

function escTxt(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function polySvg(lista, fill, stroke, w) {
  return '<polygon points="' + pts(lista) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + w + '"' : "") + "/>";
}
function poliSvg(lista, cor, w) {
  return '<polyline points="' + pts(lista) + '" fill="none" stroke="' + cor + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"/>';
}
/* obstáculo fechado: contorno #DD2E31 e miolo a 30%; o Redondo é um polígono de 16 lados */
function formaObs(o) {
  if (o.tipo !== "circulo") return o.pts;
  var l = [], r = Number(o.r) || 1.5;
  for (var i = 0; i < 16; i++) { var a = i / 16 * 2 * Math.PI; l.push([o.c[0] + Math.cos(a) * r, o.c[1] + Math.sin(a) * r]); }
  return l;
}
function obsFechado(o, k) { return polySvg(formaObs(o), "rgba(221,46,49,.30)", "#DD2E31", 4.5 * k); }
/* famílias: rota (pulverização) e mapeamento não se misturam nas listas */
function familia(t) { return t && ehMapeamento(t.modo) ? t.modo : "rota"; }
function famModo() { return ehMapeamento(M.modo) ? M.modo : M.modo === "rota" ? "rota" : null; }
function nomeSvg(cp, txt, k) {
  return '<text x="' + cp[0].toFixed(1) + '" y="' + cp[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="' + (30 * k).toFixed(2) +
    '" fill="#FFFFFF" stroke="rgba(0,0,0,.45)" stroke-width="' + (4 * k).toFixed(2) + '" paint-order="stroke" font-family="Roboto,Noto Sans,sans-serif">' + escTxt(txt) + "</text>";
}
/* selo da tarefa selecionada, 65 px abaixo do nome: "1" (rota) ou ✓ (mapeamento) */
function seloSvg(cp, k, map, numero) {
  return '<g transform="translate(' + cp[0].toFixed(1) + " " + (cp[1] + 65 * k).toFixed(1) + ") scale(" + k + ')"><circle r="29.5" fill="#5AAF00" stroke="#000C1A" stroke-width="9"/>' +
    (map ? '<path d="M-8 1L-2.5 6.5L9 -5.5" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<text y="12" text-anchor="middle" font-size="34" font-weight="700" fill="#FFFFFF" font-family="Roboto,Noto Sans,sans-serif">' + numero + "</text>") + "</g>";
}
/* marcações do piloto: linha (#E32C2E) e ponto (gota #1890FF) */
function desenharMarcacoes(t, k, edicao) {
  var h = "";
  (t.linhasM || []).forEach(function (g) {
    var cor = g.cor || "#E32C2E";
    if (!g.pts || !g.pts.length) return;
    if (g.pts.length >= 2) h += poliSvg(g.pts, cor, 3.5 * k);
    g.pts.forEach(function (m) { h += edicao ? circulo(m, 13 * k, cor, "#FFFFFF", 3 * k) : circulo(m, 7 * k, cor, "#FFFFFF", 2 * k); });
  });
  (t.marcas || []).forEach(function (m) {
    h += gTela(m, k) + '<path transform="scale(.62)" d="M0 0C-5 -9 -21 -21 -21 -38A21 21 0 1 1 21 -38C21 -21 5 -9 0 0Z" fill="#1890FF"/>' +
      '<circle cy="-23.6" r="4" fill="#FFFFFF"/></g>';
  });
  return h;
}
/* margem "Um lado": lados com valor e o lado atual em magenta, com etiqueta */
function desenharLados(ed, k) {
  var pol = ed.limite, n = pol.length, h = "", L = ed.lados || {}, area = 0, i;
  if (n < 3) return h;
  for (i = 0; i < n; i++) { var p = pol[i], q = pol[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  var sinal = area > 0 ? 1 : -1, cur = ((ed.mostrarLado % n) + n) % n;
  for (i = 0; i < n; i++) {
    var v = Number(L[i]) || 0;
    if (!v && i !== cur) continue;
    if (i === cur && M.ladoVal != null) v = M.ladoVal;
    var a = pol[i], b = pol[(i + 1) % n];
    h += linhaSvg([a, b], "#DD44DD", 5 * k);
    var ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1, nx = -ez / l * sinal, nz = ex / l * sinal;
    /* g4 #0060: a seta (cursor branco de contorno escuro, ~25 px) fica ENTRE o
       lado e a etiqueta e aponta para dentro; a etiqueta vem depois dela */
    var mid = paraPx((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), rot = Math.atan2(nz, nx) * 180 / Math.PI;
    var dE = 38 + Math.abs(nx) * 48 + Math.abs(nz) * 22, P = [mid[0] + nx * dE * k, mid[1] + nz * dE * k];
    h += '<g transform="translate(' + mid[0].toFixed(1) + " " + mid[1].toFixed(1) + ") scale(" + k + ") rotate(" + rot.toFixed(1) + ')"><path d="M7 -3.5H20V-10L33 0L20 10V3.5H7Z" fill="#FFFFFF" stroke="rgba(20,22,24,.8)" stroke-width="2" stroke-linejoin="round"/></g>';
    h += '<g transform="translate(' + P[0].toFixed(1) + " " + P[1].toFixed(1) + ") scale(" + k + ')"><rect x="-48" y="-22" width="96" height="44" rx="8" fill="rgba(20,22,24,.75)"/>' +
      '<text y="9" text-anchor="middle" font-size="26" fill="#FFFFFF" font-family="Roboto,Noto Sans,sans-serif">' + num(v, 1) + " m</text></g>";
  }
  return h;
}
/* balões brancos com o comprimento das duas arestas do vértice arrastado (mapeamento) */
function rotulosArraste(pol, i, k) {
  var n = pol.length, h = "";
  if (n < 2) return h;
  [[(i - 1 + n) % n, i], [i, (i + 1) % n]].forEach(function (e) {
    if (n < 3 && e[0] > e[1]) return;
    var a = pol[e[0]], b = pol[e[1]];
    h += gTela([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], k) + '<rect x="-65" y="-30" width="130" height="60" rx="10" fill="rgba(255,255,255,.9)"/>' +
      '<text y="11" text-anchor="middle" font-size="32" fill="#1F2224" font-family="Roboto,Noto Sans,sans-serif">' + Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(1) + "m</text></g>";
  });
  return h;
}
function pintarCamada(sel, h) { var e = $(sel); if (e && e._h !== h) { e._h = h; e.innerHTML = h; } }
/* limite que a régua mede: o da edição, o da execução ou o da tarefa selecionada */
function limiteRegua() {
  var t = M.sub === "edicao" ? M.ed : M.sub === "execucao" ? M.exec : M.sub === "lista" && M.sel ? tarefaPorId(M.sel) : null;
  return t && t.limite && t.limite.length >= 2 ? t.limite : null;
}
/* balões da régua: cantos arredondados, largura pela do texto, ponta no meio da aresta */
function baloesRegua(pol, fechado, k) {
  var n = pol.length, h = "";
  for (var i = 0; i < (fechado ? n : n - 1); i++) {
    var a = pol[i], b = pol[(i + 1) % n], txt = Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(1) + "m", w = Math.round(txt.length * 15.5 + 30);
    h += gTela([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], k) + '<rect x="' + (-w / 2) + '" y="-67" width="' + w + '" height="45" rx="8" fill="#464C48"/>' +
      '<path d="M-7 -23L0 -12L7 -23Z" fill="#464C48"/><text y="-35" text-anchor="middle" font-size="28" fill="#FFFFFF" font-family="Roboto,Noto Sans,sans-serif">' + txt + "</text></g>";
  }
  return h;
}

/* a tarefa na tela de execução: rota do jogo (ou a planejada até ela chegar),
   cinza do feito, marcadores conforme a fase, magenta e pontos de conexão */
function desenharExecucao(t, k) {
  var o = { r: "", m: "", mag: "" }, E = APP.E, R = E && E.rota, V = M.voo && M.voo.id === t.id ? M.voo : null;
  var r = R && R.r && R.r.length > 1 ? R.r : ehMapeamento(t.modo) ? rotaDeMapeamento(t) : rotaPlanejada(t, t.ang);
  if (!r || r.length < 2) return o;
  var fase = V ? V.fase : "chao", n = r.length, i0 = primeiroDaRota(r);
  if (i0 >= n) return o;
  /* trechos pulados (jogo novo; jogo antigo não manda): o início volta no
     ponto de retomada quando ele está depois do cinza */
  var pulos = R && R.r && R.r.length > 1 && Array.isArray(R.pulos) ? R.pulos : [];
  var op = { cinza: V ? V.cinza : null, pulos: pulos, mapeamento: ehMapeamento(t.modo) };
  var ultPulo = pulos.length && pulos[pulos.length - 1].ate ? pulos[pulos.length - 1].ate : null;
  var inicio = V && V.cinza ? (ultPulo ? cinzaMaior(V.cinza, ultPulo, r) : V.cinza) : ultPulo;
  if (fase === "concluida") { op.tudoCinza = true; op.semInicio = true; op.semFim = true; }
  else if (fase === "pausa") {
    var est = E && E.v ? E.v.estado : "";
    if (!V || !V.cinza || est === "manual" || est === "voltando" || est === "pousando") op.semInicio = true;
    else op.inicioEm = inicio;
  } else if (inicio) op.inicioEm = inicio;
  var d = desenharRotaPts(r, k, op);
  o.r = d.r; o.m = d.m;
  /* Ponto de interrupção C (vermelho, fixo) e pontos de retorno ❶ ❷ (roxos,
     acompanham o drone; só no manual e com C numa passada). Os caminhos até
     eles não são desenhados (piloto nº 38; video_2_retornar_a) */
  var ret = E && E.ret;
  if (fase === "pausa" && ret && !ret.ida && ret.c) {
    o.m += circulo(ret.c, 13 * k, "#E8312F", "#FFFFFF", 4 * k);
    if (E.v && E.v.estado === "manual" && ret.pas) {
      [ret.e1, ret.e2].forEach(function (e, j) {
        if (!e || !e.p) return;
        o.m += gTela(e.p, k) + '<circle r="15" fill="#C42BD6" stroke="#FFFFFF" stroke-width="3"/>' +
          '<text y="7" text-anchor="middle" font-size="20" font-weight="700" fill="#FFFFFF" font-family="Roboto,Noto Sans,sans-serif">' + (j + 1) + "</text></g>";
      });
    }
  }
  if (V) {
    var con = V.con || [], cam = null, b = E && E.b ? [E.b.x, E.b.z] : null;
    if ((fase === "chao" || fase === "ida") && V.magIda && V.origem) cam = [V.origem].concat(con, [[r[i0][0], r[i0][1]]]);
    else if (fase === "pausa" && V.cinza && b && Date.now() - V.pausaDesde >= 1000) cam = [b].concat(con, [V.cinza.p]);
    else if (fase === "concluida" && b) cam = [[r[n - 1][0], r[n - 1][1]]].concat(con.slice().reverse(), [b]);
    if (cam) o.mag = '<polyline points="' + pts(cam) + '" fill="none" stroke="#DD44DD" stroke-width="' + 5 * k + '" stroke-linejoin="miter"/>';
    /* os pontos somem quando o drone chega ao início (g6 #0195, #0239) e na
       conclusão; rosa os já passados (na ida e no translado da retomada, #0235) */
    if (fase === "chao" || fase === "ida" || fase === "pausa")
      con.forEach(function (c, j) { o.m += circulo(c, 12.75 * k, V.passados[j] ? "#EFA7F5" : "#CC11E4", "#FFFFFF", 4 * k); });
  }
  return o;
}
/* um talhão salvo, conforme o estado (ANALISE_LINHAS 2.1): A não selecionado,
   C selecionado, D execução, F depois de executado (sem obstáculo) */
function desenharTalhao(t, k) {
  var o = { t: "", r: "", m: "" };
  if (!t.limite || t.limite.length < 3) return o;
  var exec = M.sub === "execucao", sel = !exec && t.id === M.sel, map = ehMapeamento(t.modo);
  var c = centroide(t.limite), cp = paraPx(c[0], c[1]), mag = "";
  o.t += polySvg(t.limite, sel ? "rgba(248,165,33,.39)" : "rgba(0,0,0,.30)");
  (t.obs || []).forEach(function (ob) { if (ob.sem && ob.pts && ob.pts.length >= 3) o.t += polySvg(ob.pts, "rgba(255,255,255,.30)"); });
  if (!exec && !sel) o.t += '<circle cx="' + cp[0].toFixed(1) + '" cy="' + (cp[1] + 65 * k).toFixed(1) + '" r="' + 34 * k + '" fill="rgba(0,0,0,.55)"/>';
  o.t += polySvg(t.limite, "none", sel ? "#EBAC05" : "#FFFFFF", (sel ? 5.25 : 5) * k);
  if (sel) t.limite.forEach(function (m) { o.t += circulo(m, 5.5 * k, "#EBAC05"); });
  else if (exec) t.limite.forEach(function (m) { o.t += circulo(m, 6 * k, "#FFFFFF", "rgba(20,22,24,.85)", 1.5 * k); });
  if (exec) { var d = desenharExecucao(t, k); o.r += d.r; o.m += d.m; mag = d.mag; }
  else if (sel || map) {
    var d2 = desenharRotaPts(map ? rotaDeMapeamento(t) : rotaPlanejada(t, t.ang), k, { mapeamento: map });
    o.r += d2.r; o.m += d2.m;
  }
  /* obstáculo fechado por cima da rota; some do talhão já executado (F) */
  if (sel || exec || !t.executada) (t.obs || []).forEach(function (ob) { if (!ob.sem && (ob.tipo === "circulo" || (ob.pts && ob.pts.length >= 3))) o.r += obsFechado(ob, k); });
  o.r += mag;
  if (sel) o.m += desenharMarcacoes(t, k, false);
  if (!exec) { o.m += nomeSvg(cp, t.nome, k); if (sel) o.m += seloSvg(cp, k, map, M.tarefas.indexOf(t) + 1); }
  return o;
}

/* Camadas (ANALISE_LINHAS 1.2): tarefas (preenchimento, áreas, disco, limite,
   vértices) < rota (+ obstáculo fechado + magenta) < trilha < marcos (início,
   fim, conexões, marcações, nome, selo) < edição < aero */
function desenharTudo() {
  var k = 1 / M.vista.k, hT = "", hR = "", hM = "", hE = "", fam = famModo();
  var campos = !(typeof opMapa !== "undefined" && opMapa && opMapa.campos === false);
  /* talhões de fundo (G): contorno branco a 50%, sem mais nada */
  if (campos && (M.modo === "manual" || M.sub === "edicao")) {
    M.tarefas.forEach(function (t) {
      if (!t.limite || t.limite.length < 3 || (M.sub === "edicao" && M.ed && t.id === M.ed.original)) return;
      hT += polySvg(t.limite, "none", "rgba(255,255,255,.5)", 5 * k);
    });
  }
  /* talhões da lista (só a família do modo) e o da execução */
  if ((M.sub === "lista" && fam) || (M.sub === "execucao" && M.exec)) {
    var lista = M.sub === "execucao" ? [M.exec] : M.tarefas.filter(function (t) { return familia(t) === fam; });
    lista.forEach(function (t) { var d = desenharTalhao(t, k); hT += d.t; hR += d.r; hM += d.m; });
  }

  /* edição (B) */
  if (M.sub === "edicao" && M.ed) {
    var ed = M.ed, maprota = ehMapeamento(M.modo);
    if (ed.limite.length >= 3) hT += polySvg(ed.limite, "rgba(0,0,0,.30)");
    /* área sem aplicação fechada e obstáculo/área em desenho: abaixo da rota */
    ed.obs.forEach(function (ob) {
      if (ob.tipo === "circulo") return;
      var emDes = ob === ed.grupo || ob.pts.length < 3;
      if (!emDes) { if (ob.sem) hT += polySvg(ob.pts, "rgba(255,255,255,.30)"); return; }
      var cor = ob.sem ? "rgba(255,255,255,.7)" : "#DB322B";
      if (ob.pts.length >= 3) hT += polySvg(ob.pts, ob.sem ? "none" : "rgba(219,50,43,.15)", cor, 3.5 * k);
      else if (ob.pts.length === 2) hT += linhaSvg(ob.pts, cor, 3.5 * k);
    });
    if (ed.limite.length >= 3) hT += polySvg(ed.limite, "none", "#FFFFFF", 5 * k);
    else if (ed.limite.length === 2) hT += linhaSvg(ed.limite, "#FFFFFF", 5 * k);
    /* vértices: somem enquanto se edita outro elemento (obstáculo, Redondo, marcação) */
    if (!ed.outro) ed.limite.forEach(function (m) { hT += circulo(m, 16 * k, "rgba(0,0,0,.22)") + circulo(m, 12.75 * k, "#CC11E4", "#FFFFFF", 4 * k); });
    if (ed.limite.length >= 3 && (M.modo === "rota" || maprota)) {
      var rr;
      if (maprota) {
        /* não recalcula durante o arraste de um vértice: só ao soltar */
        if (!M.arraste || !M.rotaMapCache) M.rotaMapCache = rotaDeMapeamento(ed);
        rr = M.rotaMapCache;
      } else {
        var angEd = ed.angManual != null ? ed.angManual : anguloAuto(ed.limite);
        rr = rotaPlanejada(ed, angEd);
        /* segmentação (26/10/2026): as passadas de fora das alças saem da aplicação e ficam em cinza, por baixo da rota */
        if (ed.seg && (ed.seg[0] > 0 || ed.seg[1] < 100))
          hR += desenharRotaPts(rotaPlanejada(ed, angEd, true), k, { tudoCinza: true, semInicio: true, semFim: true }).r;
      }
      var dd = desenharRotaPts(rr, k, { mapeamento: maprota });
      hR += dd.r; hM += dd.m;
    }
    ed.obs.forEach(function (ob) {
      if (ob.sem) return;
      if (ob.tipo === "circulo" || (ob !== ed.grupo && ob.pts.length >= 3)) hR += obsFechado(ob, k);
    });
    hM += desenharMarcacoes(ed, k, true);
    /* alfinetes do grupo em edição */
    if (ed.grupo && ed.obs.indexOf(ed.grupo) >= 0) ed.grupo.pts.forEach(function (m) { hE += circulo(m, 13 * k, ed.grupo.sem ? "#9A9A9A" : "rgba(219,50,43,.6)", "#FFFFFF", 3 * k); });
    /* Redondo selecionado (acabou de marcar ou foi tocado): ponto central e alça igual, em cima da circunferência a 45° embaixo à direita (g6 #0110) */
    var ra = ed.redondoAtivo;
    if (ra && ed.obs.indexOf(ra) >= 0) {
      var hp = alcaRedondo(ra), pcR = paraPx(ra.c[0], ra.c[1]), painelAberto = ed.painelRedondo === ra, selAlca = ed.redondoSel === "alca";
      /* com o painel aberto, o ponto escolhido (centro ou alça) ganha um anel branco */
      var anel = function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (20 * k).toFixed(2) + '" fill="none" stroke="#FFFFFF" stroke-width="' + (4 * k).toFixed(2) + '"/>'; };
      hE += circulo(ra.c, 11.5 * k, "#FF1430", "#FFFFFF", 4 * k) +
        '<circle cx="' + hp[0].toFixed(1) + '" cy="' + hp[1].toFixed(1) + '" r="' + (11.5 * k).toFixed(2) + '" fill="#FF1430" stroke="#FFFFFF" stroke-width="' + (4 * k).toFixed(2) + '"/>' +
        (painelAberto ? anel(selAlca ? hp : pcR) : "");
      /* arrastando a alça: linha pontilhada do centro ao dedo e a distância num balão (como no controle real) */
      var ar = M.arrasteRaio;
      if (ar) {
        var pdR = paraPx(ar.m[0], ar.m[1]), txt = num(ar.d, 1) + "m", bw = (txt.length * 18 + 40) * k, bh = 58 * k, bx = pdR[0] - bw - 28 * k, by = pdR[1] - bh - 44 * k;
        hE += '<line x1="' + pcR[0].toFixed(1) + '" y1="' + pcR[1].toFixed(1) + '" x2="' + pdR[0].toFixed(1) + '" y2="' + pdR[1].toFixed(1) +
          '" stroke="#FFFFFF" stroke-width="' + (3.5 * k).toFixed(2) + '" stroke-dasharray="' + (10 * k).toFixed(1) + " " + (9 * k).toFixed(1) + '"/>' +
          '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="' + (10 * k).toFixed(1) + '" fill="rgba(255,255,255,.94)"/>' +
          '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (by + bh / 2).toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="' + (34 * k).toFixed(2) +
          '" fill="#555" font-family="Roboto,Noto Sans,sans-serif">' + txt + "</text>";
      }
    }
    if (ed.mostrarLado != null) hE += desenharLados(ed, k);
    if (M.arraste && maprota && M.arraste.lista === ed.limite) hE += rotulosArraste(ed.limite, M.arraste.i, k);
  }
  /* régua (g1 #0143, g7 #0276): um balão com o comprimento de cada aresta do
     limite do talhão aberto, sem linha nem pontos. Sem talhão aberto, régua
     livre (cada toque é um ponto) */
  if (M.regua) {
    var limR = limiteRegua();
    if (limR) hE += baloesRegua(limR, limR.length >= 3, k);
    else if (M.regua.length) {
      if (M.regua.length >= 2) hE += poliSvg(M.regua, "#FFFFFF", 5 * k);
      M.regua.forEach(function (m) { hE += circulo(m, 10 * k, "#fff", "#2b2e31", 3 * k); });
      hE += baloesRegua(M.regua, false, k);
    }
  }
  desenharMosaico();
  pintarCamada("#camada-tarefas", hT);
  pintarCamada("#camada-rota", hR);
  pintarCamada("#camada-marcos", hM);
  pintarCamada("#camada-edicao", hE);
  desenharTrilha();
  desenharAero();
}

/* ------------------------------------------------ trilha voada (9)
   A linha do GPS do drone: verde pulverizando, branca no resto. Só cresce
   (o verde fica por cima do branco): voltar ou parar não despinta. Só a
   borracha apaga. Gravada a cada estado novo (~8 Hz).
   Desempenho: um traço tem no máximo ~300 pontos (depois abre outro da mesma
   cor a partir do último ponto); os fechados vão em vários <path> de ~2000
   pontos por cor, acrescentados sem reescrever os antigos (o Chrome pula
   pela caixa os que estão fora da área redesenhada). ver muda só quando a
   lista perde traços (borracha, teto de 20 000): aí os <path> são refeitos. */
var TRILHA = { t: 0, solto: true, sujo: false, salvo: 0, ver: 1, verDes: -1, k: 0, n: -1, fech: 0, pd: [[], []], ab: undefined,
  cache: typeof WeakMap === "function" ? new WeakMap() : null };
(function () { var n = 0; M.trilha.forEach(function (s) { n += (s.p || []).length; }); TRILHA.n = n; })();
function guardarTrilha() { TRILHA.sujo = false; TRILHA.salvo = Date.now(); guardar(chaveDoMapa("trilha"), M.trilha); }
function gravarTrilha(E) {
  if (!APP.conectado || !E || !E.d || !E.v || E.t === TRILHA.t) return false;
  TRILHA.t = E.t;
  var v = E.v, noArAgora = E.sens ? !E.sens.chao : (v.alturaSolo || 0) > .3;
  if (!noArAgora) {
    TRILHA.solto = true;
    if (TRILHA.sujo) guardarTrilha();   // pouso: grava
    return false;
  }
  var verde = (v.aplicando === true || (+v.vazao || 0) > .05) && !ehMapeamento(M.modo) ? 1 : 0;
  var p = [Math.round(E.d.x * 100) / 100, Math.round(E.d.z * 100) / 100];
  var tr = M.trilha, ult = tr[tr.length - 1], q = ult && ult.p[ult.p.length - 1], mudou = false;
  if (!q || TRILHA.solto || Math.hypot(p[0] - q[0], p[1] - q[1]) > 15) {
    /* começo, depois do chão ou salto grande: traço novo, sem ligar ao anterior */
    tr.push({ v: verde, p: [p] }); TRILHA.n++; mudou = true;
  } else {
    var d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < .3) return false;          // subida vertical e pairar não marcam
    if (ult.v !== verde) {
      /* troca de cor: traço novo a partir do último ponto */
      tr.push({ v: verde, p: [q, p] }); TRILHA.n += 2;
    } else {
      var l = ult.p, a = l.length >= 2 ? l[l.length - 2] : null, troca = false;
      if (a) {
        var dx = p[0] - a[0], dz = p[1] - a[1], L2 = dx * dx + dz * dz;
        if (L2 > 1e-9) {
          var t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / L2, desvio = Math.abs((q[0] - a[0]) * dz - (q[1] - a[1]) * dx) / Math.sqrt(L2);
          troca = t > 0 && t < 1 && desvio < .05;
        }
      }
      if (troca) l[l.length - 1] = p;
      else if (l.length >= 300) { tr.push({ v: verde, p: [q, p] }); TRILHA.n += 2; }   // fecha este (vai ao cache) e abre outro da mesma cor
      else { l.push(p); TRILHA.n++; }
    }
    mudou = true;
  }
  TRILHA.solto = false;
  /* no máximo 20 000 pontos: os traços mais antigos saem */
  while (TRILHA.n > 20000 && tr.length > 1) { TRILHA.n -= tr.shift().p.length; TRILHA.ver++; }
  TRILHA.sujo = true;
  if (Date.now() - TRILHA.salvo > 3000) guardarTrilha();
  return mudou;
}
/* caminho de um traço, com os cantos de mais de 20° arredondados (r <= 0,8 m) */
function caminhoTrilha(s) {
  var l = s.p, n = l.length;
  if (n < 2) return "";
  var P = l.map(function (m) { return paraPx(m[0], m[1]); }), R0 = .8 / ESCALA_M, f = function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); };
  var d = "M" + f(P[0]);
  for (var i = 1; i < n - 1; i++) {
    var a = P[i - 1], b = P[i], c = P[i + 1];
    var l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (l1 < 1e-6 || l2 < 1e-6) { d += "L" + f(b); continue; }
    var u = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], w = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
    var cosg = u[0] * w[0] + u[1] * w[1];
    if (cosg > Math.cos(20 * Math.PI / 180)) { d += "L" + f(b); continue; }
    var r = Math.min(R0, l1 / 2, l2 / 2);
    d += "L" + f([b[0] - u[0] * r, b[1] - u[1] * r]) + "Q" + f(b) + " " + f([b[0] + w[0] * r, b[1] + w[1] * r]);
  }
  return d + "L" + f(P[n - 1]);
}
function caminhoTrilhaCache(s) {
  if (!TRILHA.cache) return caminhoTrilha(s);
  var c = TRILHA.cache.get(s);
  if (c && c.n === s.p.length) return c.d;
  var d = caminhoTrilha(s);
  TRILHA.cache.set(s, { n: s.p.length, d: d });
  return d;
}
/* camada-trilha: brancos embaixo, verdes por cima. Em cada cor, o 1º <path>
   é o traço aberto (o último); depois vêm os pedaços com os fechados */
function desenharTrilha() {
  var c = $("#camada-trilha");
  if (!c) return;
  if (!c.firstChild) {
    /* cinza (o feito antes, tarefa retomada) por baixo; depois branco e verde */
    c.innerHTML = '<g fill="none" stroke="#9B9A9B" stroke-linecap="round" stroke-linejoin="round"><path/></g>' +
      '<g fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round"><path/></g>' +
      '<g fill="none" stroke="#5BC62B" stroke-linecap="round" stroke-linejoin="round"><path/></g>';
    TRILHA.verDes = -1; TRILHA.k = -1;
  }
  var g = [c.children[1], c.children[2], c.children[0]], k = 1 / M.vista.k, tr = M.trilha, n = tr.length, i;
  if (TRILHA.k !== k) { TRILHA.k = k; g.forEach(function (x) { x.setAttribute("stroke-width", (5 * k).toFixed(3)); }); }
  if (TRILHA.verDes !== TRILHA.ver) {
    /* a lista perdeu traços (borracha, teto) ou mudou de cor: refaz os pedaços a partir do cache */
    TRILHA.verDes = TRILHA.ver; TRILHA.fech = 0; TRILHA.pd = [[], [], []]; TRILHA.ab = undefined;
    g.forEach(function (x) { while (x.childNodes.length > 1) x.removeChild(x.lastChild); });
    TRILHA.n = 0; tr.forEach(function (s) { TRILHA.n += s.p.length; });
  }
  /* fechados novos: no fim do último pedaço da cor (um <path> novo a cada ~2000 pontos) */
  var sujos = [];
  for (i = TRILHA.fech; i < n - 1; i++) {
    var s = tr[i], cor = s.v === 2 ? 2 : s.v ? 1 : 0, l = TRILHA.pd[cor], u = l[l.length - 1];
    if (!u || u.n >= 2000) {
      u = { el: document.createElementNS("http://www.w3.org/2000/svg", "path"), n: 0, d: "" };
      g[cor].appendChild(u.el); l.push(u);
    }
    u.d += caminhoTrilhaCache(s); u.n += s.p.length;
    if (sujos.indexOf(u) < 0) sujos.push(u);
  }
  if (n - 1 > TRILHA.fech) TRILHA.fech = n - 1;
  sujos.forEach(function (x) { x.el.setAttribute("d", x.d); });
  /* traço aberto: refeito só quando cresce, troca o último ponto ou a cor */
  var ab = n ? tr[n - 1] : null, q = ab ? ab.p[ab.p.length - 1] : null;
  if (ab !== TRILHA.ab || (ab && (ab.p.length !== TRILHA.abN || q !== TRILHA.abQ))) {
    TRILHA.ab = ab; TRILHA.abN = ab ? ab.p.length : 0; TRILHA.abQ = q;
    var du = ab ? caminhoTrilha(ab) : "";
    var cab = ab ? (ab.v === 2 ? 2 : ab.v ? 1 : 0) : -1;
    g.forEach(function (x, j) { x.firstChild.setAttribute("d", j === cab ? du : ""); });
  }
}
/* tarefa retomada: o que estava verde vira cinza (o feito antes) */
function trilhaParaCinza() {
  var mudou = false;
  M.trilha.forEach(function (s) { if (s.v === 1) { s.v = 2; mudou = true; } });
  if (!mudou) return;
  TRILHA.ver++; TRILHA.solto = true; guardarTrilha(); desenharTrilha();
}
function apagarTrilha() {
  M.trilha = []; TRILHA.n = 0; TRILHA.ver++; TRILHA.solto = true;
  guardarTrilha();
  desenharTrilha();
}

/* drone no ar (para a trilha, o M+ e as fases da tarefa) */
function noAr(E) {
  if (!E || !E.v) return false;
  if (E.sens) return !E.sens.chao;
  return ["em solo", "concluído"].indexOf(E.v.estado) < 0 && (E.v.alturaSolo || 0) > .3;
}
/* faixas tracejadas e bolinhas do M+ (ANALISE_LINHAS 5): paralelas ao nariz,
   separadas pelo "Espaçamento de rota", a central (a do drone) mais forte */
function desenharMmais(E, k) {
  var d = paraPx(E.d.x, E.d.z), rumo = E.d.rumo || 0, f = [Math.cos(rumo), -Math.sin(rumo)], n = [Math.sin(rumo), Math.cos(rumo)];
  var esp = (Number(M.P.espMmais) || 6) / ESCALA_M, L = 1213.75 * k, h = "", i;
  var linha = function (c, cor, w, op, dash) {
    return '<line x1="' + (c[0] - f[0] * L).toFixed(1) + '" y1="' + (c[1] - f[1] * L).toFixed(1) + '" x2="' + (c[0] + f[0] * L).toFixed(1) + '" y2="' + (c[1] + f[1] * L).toFixed(1) +
      '" stroke="' + cor + '" stroke-width="' + (w * k).toFixed(3) + '"' + (op ? ' stroke-opacity="' + op + '"' : "") + ' stroke-linecap="round" stroke-dasharray="' + dash + '"/>';
  };
  /* 5 faixas: a central e ±1, ±2, as mesmas das bolinhas (g5 #0049, #0062, #0085, #0089) */
  for (i = -2; i <= 2; i++) {
    var c = [d[0] + n[0] * esp * i, d[1] + n[1] * esp * i], w = i === 0 ? 4.5 : 3.25, dash = ((9.5 - w) * k).toFixed(3) + " " + ((10 + w) * k).toFixed(3);
    h += linha(c, "rgba(0,0,0,.35)", w + 2, 0, dash) + linha(c, "#FFFFFF", w, i === 0 ? .8 : .62, dash);
  }
  [-2, -1, 1, 2].forEach(function (j) {
    h += '<circle cx="' + (d[0] + n[0] * esp * j).toFixed(1) + '" cy="' + (d[1] + n[1] * esp * j).toFixed(1) + '" r="' + 6.5 * k + '" fill="#B2B3B5" stroke="rgba(0,0,0,.6)" stroke-width="' + 1.5 * k + '"/>';
  });
  return h;
}
/* Ordem (ANALISE_LINHAS 1.2): faixas do M+, pino H, ponto azul do controle,
   laranja (drone -> ponta do H), círculo da tarefa M+, seta do drone */
function desenharAero() {
  var k = 1 / M.vista.k, h = "", E0 = APP.E, ar = noAr(E0);
  /* o drone desenhado na posição de AGORA (poseAgora, nucleo.js): anda liso a
     cada quadro, sem esperar o próximo estado do PC */
  var E = E0 && E0.d ? Object.assign({}, E0, { d: poseAgora(E0.d) }) : E0;
  if (E && E.d && ar && M.modo === "manual" && M.abaMan === "M+") h += desenharMmais(E, k);
  if (E && E.b) {
    /* pino H: gota em degradê com a PONTA no ponto da base */
    var b = paraPx(E.b.x, E.b.z);
    h += '<linearGradient id="grad-pino-h" gradientUnits="userSpaceOnUse" x1="0" y1="-60" x2="0" y2="0"><stop offset="0" stop-color="#9FD156"/><stop offset="1" stop-color="#5A881B"/></linearGradient>' +
      '<g transform="translate(' + b[0].toFixed(1) + " " + b[1].toFixed(1) + ") scale(" + k + ')"><path d="M0 0C-5 -9 -21 -21 -21 -38A21 21 0 1 1 21 -38C21 -21 5 -9 0 0Z" fill="url(#grad-pino-h)"/>' +
      /* pontinho verde na ponta, onde a laranja termina (g6 #0139) */
      '<circle r="3.5" fill="#6CB33A"/>' +
      '<text y="-27" text-anchor="middle" font-size="31" font-weight="700" fill="#FFFFFF" font-family="Roboto,Noto Sans,sans-serif">H</text></g>';
  }
  if (E && E.o) {
    var o = paraPx(E.o.x, E.o.z);
    h += '<g transform="translate(' + o[0].toFixed(1) + " " + o[1].toFixed(1) + ") scale(" + k + ')"><circle r="18" fill="#0081F9" stroke="#FFFFFF" stroke-width="4"/></g>';
  }
  /* laranja: o caminho que o drone toma se sair sozinho (RTH); sempre que há drone e H */
  if (E && E.d && E.b) h += linhaSvg([[E.d.x, E.d.z], [E.b.x, E.b.z]], "#FBA905", (5 * k).toFixed(3));
  if (E && E.d && ar && M.modo === "manual" && M.abaMan === "M+" && M.mmais) {
    var dm = paraPx(E.d.x, E.d.z), rm = 90 - (E.d.rumo || 0) * 180 / Math.PI;
    h += '<g transform="translate(' + dm[0].toFixed(1) + " " + dm[1].toFixed(1) + ") scale(" + k + ") rotate(" + rm.toFixed(1) + ')">' +
      '<path d="M0 -74A74 74 0 0 0 0 74Z" fill="rgba(235,146,65,.48)"/><path d="M0 -74A74 74 0 0 1 0 74Z" fill="rgba(46,147,248,.49)"/></g>';
  }
  if (E && E.d) {
    var d = paraPx(E.d.x, E.d.z), rot = 90 - (E.d.rumo || 0) * 180 / Math.PI;
    h += '<g transform="translate(' + d[0].toFixed(1) + " " + d[1].toFixed(1) + ") scale(" + k + ") rotate(" + rot.toFixed(1) + ')">' +
      '<path d="M0 -34 26 26 0 12 -26 26z" fill="#e5372e" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></g>';
  }
  $("#camada-aero").innerHTML = h;
}

/* ------------------------------------------------------- barra de estado */
var TXT_ESTADO = {
  "em solo": null, "subindo": "Operação de rota", "indo": "Operação de rota", "descendo": "Operação de rota",
  "aplicando": "Operação de rota", "pairando": "Pausar", "voltando": "Retornando ao ponto de origem",
  "pousando": "Aterrissando", "reabastecendo": "Reabastecimento", "concluído": "Operação concluída",
  "caiu": "Aeronave perdida", "manual": "Manual"
};
function rtkAtivo() { return !!(APP.conectado && APP.E && APP.E.rtk); }
function tanqueVazioParaMapear() { return !!(APP.conectado && APP.E && APP.E.mapaTanqueVazio === true); }
function atualizarBarra() {
  var E = APP.E, ev = $("#estado-voo"), sd = $("#status-drone");
  ev.className = "estado-voo";
  if (controladorEmEdicao() || !APP.conectado || !E || !E.v) {
    ev.textContent = "Aeronave desconectada";
    sd.style.display = "none";
    return;
  }
  sd.style.display = "";
  var v = E.v, t = TXT_ESTADO[v.estado];
  if (E.protecao && E.protecao.bloqueioDecolagem) { ev.classList.add("vermelho"); t = "Incapaz de decolar"; }
  if (!t) {
    var verm = alertasAtuais().some(function (a) { return a.tipo === "vermelho"; });
    t = verm ? "Incapaz de decolar" : "Pronto para decolar (" + (rtkAtivo() ? "RTK" : "GNSS") + ")";
    ev.classList.add(verm ? "vermelho" : "verde");
  } else {
    ev.classList.add((v.estado === "caiu" || E.protecao && E.protecao.bloqueioDecolagem) ? "vermelho" : v.estado === "voltando" || v.estado === "reabastecendo" || v.estado === "pairando" ? "amarelo" : "verde");
    if (v.estado === "manual" && v.temRota) t = "Tarefa pausada. Modo manual";
  }
  if (E.mapeamento && v.estado === "aplicando") t = "Tarefa em andamento. Modo de mapeamento";
  ev.textContent = t;
  var gps = $("#s-gps");
  gps.querySelector(".num").textContent = "23";
  gps.querySelector(".num").className = "num verde-t";
  gps.querySelector(".tipo").textContent = rtkAtivo() ? "RTK" : "GNSS";
  gps.querySelector(".tipo").className = "tipo verde-t";
  var bat = Math.round(v.bateria || 0);
  $("#s-bat b").innerHTML = bat + "<i>%</i>";
  $("#s-bat b").className = bat <= 15 ? "vermelho-t" : bat <= 30 ? "amarelo-t" : "verde-t";
  var cheio = (E.m && E.m.tanque) || 0, resta = v.tanque || 0;
  $("#s-tanque b").innerHTML = '<span class="' + (resta <= .05 ? "vermelho-t" : resta / (cheio || 1) <= .2 ? "amarelo-t" : "verde-t") + '">' +
    num(resta) + "</span>/" + num(cheio) + "<i>l</i>";
  /* osd */
  var d = E.d, b = E.b;
  atualizarAltura(E);
  $("#o-vel").innerHTML = num((v.velocidade || 0) * 3.6) + "<i>km/h</i>";
  $("#o-dist").innerHTML = num(d && b ? Math.hypot(d.x - b.x, d.z - b.z) : 0) + "<i>m</i>";
  $("#o-flu").innerHTML = num(v.vazao) + "<i>L/Min</i>";
}

/* Altura no OSD (análise 3.8): "Relativo à origem" com a rampa no chão e na
   decolagem; "Altitude" (altura sobre o que o radar vê) no ar, com o anel
   sobre arcos ou o olho na faixa da rota. Amarelo saindo do chão, recém-
   pousado com os motores girando e acima de 30 m (aí relativo à decolagem).
   Ícones no viewBox 30x36 (recortes de g5 #0047, g5 #0049 e g6 #0182). */
var IC_ALT = {
  rampa: '<path d="M-1.5 27L4 8L10 18Q13 21 16.5 21.5Q19.5 22 23.5 27Z"/>',
  radar: '<circle cx="12" cy="13.5" r="5.5" stroke-width="2"/><path d="M6.5 21Q12 25 17.5 21" stroke-width="2"/><path d="M4 24Q12 30 20 24" stroke-width="2"/>',
  olho: '<path d="M-1 19Q13 0 27 19Q13 38 -1 19Z"/><circle cx="13" cy="19" r="4.5"/>'
};
function atualizarAltura(E) {
  var f = faseVoo(), tit, icone, val, amarelo;
  if (f.alt) {
    tit = "Altitude";
    /* olho = copiando o terreno: só nas passadas de pulverização da rota.
       Indo/voltando do ponto de pulverização (ligação, RTH) não copia (piloto, 02/10) */
    icone = M.modo === "rota" && E.v.estado === "aplicando" ? "olho" : "radar";
    /* acima do alcance o radar perde o chão: amarelo e relativo à decolagem */
    if (f.alto) { val = f.rel; amarelo = true; } else { val = f.altR; amarelo = false; }
  } else {
    tit = "Relativo à<br>origem"; icone = "rampa"; val = f.rel;
    amarelo = f.mot && f.saiu;
  }
  var chave = icone + tit;
  if (atualizarAltura.ult !== chave) {
    atualizarAltura.ult = chave;
    var ia = $("#o-alt-ic"), ta = $("#o-alt-tit");
    if (ia) ia.innerHTML = '<g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + IC_ALT[icone] + "</g>";
    if (ta) { ta.innerHTML = tit; ta.className = f.alt ? "uma" : ""; }
  }
  /* uma casa com vírgula; nada de "-0,0" (mas "-0,3" no toque aparece) */
  var a = Math.round((Number(val) || 0) * 10) / 10;
  if (!a) a = 0;
  var o = $("#o-alt");
  o.innerHTML = virg(a) + "<i>m</i>";
  o.className = amarelo ? "amarelo" : "";
}

/* bateria do próprio RC Plus */
try {
  if (navigator.getBattery) navigator.getBattery().then(function (b) {
    function f() { $("#rc-bat").textContent = Math.round(b.level * 100); }
    f(); b.addEventListener("levelchange", f);
  });
} catch (e) {}

/* ------------------------------------------ fase do voo (HSI e altura)
   O que o radar e a altura precisam saber do voo (análise 2.3, 3.2, 3.3):
   armou (os motores já giraram desde que conectou), saiu do chão, rótulo
   "Altitude" (1,5 m na subida, volta só no toque) e acima de 30 m.
   y0 = altura da aeronave quando os motores ligaram no chão (o ponto de
   decolagem); antes disso vale o chão da BASE. Jogo antigo, sem E.sens:
   tira do estado do voo. */
/* alcance do radar de altitude (manual: 1 a 50 m). O piloto falou em 30 m, mas no
   voo real o valor seguiu branco a 30,7–33,4 m (g7 #0295–#0303): fica o do manual */
var ALT_RADAR_MAX = 50;   // acima disso: amarelo e relativo à decolagem
var VOO = { armou: false, saiu: false, alt: false, alto: false, y0: null, t: 0, chao: true, mot: false, altR: 0, rel: 0 };
/* religou: motores girando no chão gravam o y0 de novo; no ar vale o antigo */
ouvir("conexao", function (vivo) { if (vivo) { VOO.armou = false; VOO.saiu = false; VOO.alt = false; VOO.mot = false; VOO.hsiDuplo = false; } });
function faseVoo() {
  var E = APP.E;
  if (!E || !E.v || E.t === VOO.t) return VOO;
  var v = E.v, s = E.sens;
  var chao = s ? !!s.chao : ["em solo", "concluído", "reabastecendo"].indexOf(v.estado) >= 0 || (v.alturaSolo || 0) < .05;
  var mot = s ? !!s.motores : !!v.rodando && ["em solo", "concluído", "reabastecendo", "caiu"].indexOf(v.estado) < 0;
  if (mot && !VOO.mot && chao && E.d && typeof E.d.y === "number") VOO.y0 = E.d.y;
  if (mot) VOO.armou = true;
  if (!mot) VOO.saiu = false; else if (!chao) VOO.saiu = true;
  VOO.altR = s && typeof s.altRadar === "number" ? s.altRadar : (v.alturaSolo || 0);
  var y0 = VOO.y0 != null ? VOO.y0 : E.b && typeof E.b.y === "number" ? E.b.y : null;
  VOO.rel = E.d && typeof E.d.y === "number" && y0 != null ? E.d.y - y0 : (v.alturaSolo || 0);
  if (chao || !mot) VOO.alt = false; else if (VOO.rel >= 1.5) VOO.alt = true;
  if (VOO.altR > ALT_RADAR_MAX) VOO.alto = true; else if (VOO.altR < ALT_RADAR_MAX - .5) VOO.alto = false;
  VOO.chao = chao; VOO.mot = mot; VOO.t = E.t;
  return VOO;
}

/* ----------------------------------------------------------- radar (HSI) */
/* fatias vizinhas com eco (0 < d <= 16) formam um grupo, com volta 71 -> 0 */
function gruposRadar(rd) {
  var N = rd ? rd.length : 0, g = [], k;
  if (!N) return g;
  var tem = function (k) { var x = rd[((k % N) + N) % N]; return x > 0 && x <= 16; };
  var todas = true;
  for (k = 0; k < N; k++) if (!tem(k)) { todas = false; break; }
  if (todas) {
    var gc = { ks: [], min: Infinity, kmin: 0, cheio: true };
    for (k = 0; k < N; k++) { gc.ks.push(k); if (rd[k] < gc.min) { gc.min = rd[k]; gc.kmin = k; } }
    gc.min = Math.round(gc.min * 10) / 10;
    return [gc];
  }
  /* começa depois de uma fatia vazia: um grupo que passa pelo nariz não parte */
  var ini = 0, atual = null;
  while (tem(ini)) ini++;
  for (var j = 1; j <= N; j++) {
    k = (ini + j) % N;
    if (!tem(k)) { atual = null; continue; }
    if (!atual) { atual = { ks: [], min: Infinity, kmin: k }; g.push(atual); }
    atual.ks.push(k);
    if (rd[k] < atual.min) { atual.min = rd[k]; atual.kmin = k; }
  }
  g.forEach(function (x) { x.min = Math.round(x.min * 10) / 10; });
  return g;
}

/* Receita 2.12: centro da tela (701,1043) = (203,155) no SVG; disco 143,
   anel externo 131 = 16 m (8,25 px/m), H a 9,8 px/m, vetor 4,4 px por km/h.
   Proa sempre para cima; ângulos no sentido horário a partir do nariz. */
function desenharHsi() {
  $("#hsi").style.visibility = controladorEmEdicao() ? "hidden" : "";
  if (controladorEmEdicao()) return;
  var E = APP.E, f = faseVoo(), PASSO = Math.PI / 36;
  var multi = E && E.p && typeof E.p.desvio === "boolean" ? E.p.desvio : M.P.desvio;
  var pt = function (a, r) { return [203 + Math.sin(a) * r, 155 - Math.cos(a) * r]; };
  var xy = function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); };
  /* setores: só no ar e com o multidirecional ligado ("a janelinha liga e
     desliga os radares") */
  var rd = null;
  if (APP.conectado && E && E.v && !f.chao && multi !== false) {
    if (E.sens) rd = E.rd || null;
    else if (E.radar && E.radar.length) {
      /* jogo antigo: 12 setores de 30 graus */
      rd = [];
      for (var i = 0; i < 72; i++) rd.push(0);
      E.radar.forEach(function (s) { for (var k = s[0] * 6 - 3; k <= s[0] * 6 + 2; k++) rd[(k + 72) % 72] = s[1]; });
    }
  }
  var g = gruposRadar(rd);

  /* disco: translúcido sem setor, escurecido com qualquer setor (2.4); com
     setor o aro (132-145) fica mais claro que o miolo */
  var h = g.length ? '<circle cx="203" cy="155" r="145" fill="rgba(8,12,20,.57)"/><circle cx="203" cy="155" r="132" fill="rgba(8,12,20,.25)"/>' :
    '<circle cx="203" cy="155" r="145" fill="rgba(0,0,0,.27)"/>';

  /* setores: coroa do raio da distância até o anel externo, borda irregular;
     a cor do grupo vem do número (vermelho até 6,0, inclusive na foto 0045). */
  g.forEach(function (s) {
    var n = s.ks.length, a0 = s.ks[0] * PASSO - PASSO / 2, a1 = a0 + n * PASSO, d, j;
    var ri = function (k) { return Math.min(132, 8.25 * rd[k]); };
    if (s.cheio) {
      d = "M" + xy(pt(0, 132)) + "A132 132 0 1 1 " + xy(pt(Math.PI, 132)) + "A132 132 0 1 1 " + xy(pt(0, 132)) + "Z";
      for (j = 0; j < n; j++) d += (j ? "L" : "M") + xy(pt(a0 + (j + .5) * PASSO, ri(s.ks[j])));
      d += "Z";
    } else {
      d = "M" + xy(pt(a0, 132)) + "A132 132 0 " + (a1 - a0 > Math.PI ? 1 : 0) + " 1 " + xy(pt(a1, 132)) +
        "L" + xy(pt(a1, ri(s.ks[n - 1])));
      for (j = n - 1; j >= 0; j--) d += "L" + xy(pt(a0 + (j + .5) * PASSO, ri(s.ks[j])));
      d += "L" + xy(pt(a0, ri(s.ks[0]))) + "Z";
    }
    h += '<path d="' + d + '" fill-rule="evenodd" fill="' + (s.min <= 6 ? "rgba(232,48,54,.62)" : "rgba(255,226,0,.6)") + '"/>';
  });

  /* anel externo e cruz, por cima dos setores; a cruz é mais clara perto do centro */
  h += '<radialGradient id="hsi-cruz" gradientUnits="userSpaceOnUse" cx="203" cy="155" r="132">' +
    '<stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></radialGradient>' +
    '<circle cx="203" cy="155" r="132" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>' +
    '<path d="M71 155H335M203 23V287" stroke="url(#hsi-cruz)" stroke-width="1.2"/>';

  /* anéis internos por estado (2.3): pontilhado até os motores girarem a 1a
     vez; no chão depois disso pontilhado + sólido; no ar (e até os motores
     pararem depois do pouso) sólidos. Antes da subida relativa à decolagem,
     um só aro: fotos 0014–0073; após a subida, dois: 0075 em diante. */
  var sol = function (r) { return '<circle cx="203" cy="155" r="' + r + '" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.5"/>'; };
  var pon = function (r, n, q) {
    return '<circle cx="203" cy="155" r="' + r + '" fill="none" stroke="rgba(210,210,210,.85)" stroke-width="' + q + '" stroke-dasharray="' + q + " " +
      (2 * Math.PI * r / n - q).toFixed(2) + '"/>';
  };
  if (!f.mot) VOO.hsiDuplo = false;
  else if (f.alt) VOO.hsiDuplo = true;
  if (!f.chao || (f.mot && f.saiu)) h += VOO.hsiDuplo ? sol(60) + sol(72) : sol(66);
  else if (f.armou) h += pon(61, 25, 3.25) + sol(72);
  else h += pon(66, 28, 4.5);

  /* Fotos 0046/0108/0164: número junto à borda externa e centralizado
     sobre o eco mais próximo. Um platô não deve mandar o texto para sua
     primeira fatia (especialmente no grupo que cruza 71 -> 0). */
  var postos = [];
  g.slice().sort(function (a, b) { return a.min - b.min; }).forEach(function (s) {
    if (postos.length >= 8) return;
    var centro = (s.ks.length - 1) / 2, melhor = -1, menor = Infinity;
    s.ks.forEach(function (k, j) {
      if (Math.abs(rd[k] - s.min) <= .051 && Math.abs(j - centro) < menor) {
        melhor = j; menor = Math.abs(j - centro);
      }
    });
    var inicio = melhor, fim = melhor;
    while (inicio > 0 && Math.abs(rd[s.ks[inicio - 1]] - s.min) <= .051) inicio--;
    while (fim + 1 < s.ks.length && Math.abs(rd[s.ks[fim + 1]] - s.min) <= .051) fim++;
    var angRotulo = (s.ks[0] + (inicio + fim) / 2) * PASSO;
    var q = pt(angRotulo, 114);
    if (postos.some(function (o) { return Math.hypot(o[0] - q[0], o[1] - q[1]) < 34; })) return;
    postos.push(q);
    h += '<text x="' + q[0].toFixed(1) + '" y="' + q[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="600"' +
      ' fill="#F8F8F0" stroke="rgba(0,0,0,.35)" stroke-width="1.5" paint-order="stroke">' + s.min.toFixed(1) + "</text>";
  });

  /* ícones em volta (2.9): aceso branco, apagado preto; o multidirecional
     desligado fica vermelho */
  var disco = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="30" fill="rgba(22,27,34,.85)"/>'; };
  var c1 = multi !== false ? "#fff" : "#D12428";
  /* x 78: nos prints o disco e o desenho dos ícones 1 e 2 ficam em x 576 */
  h += disco(78, 42) + '<g transform="translate(78 42)" fill="none" stroke="' + c1 + '" stroke-width="4.25" stroke-linecap="round">' +
    '<circle r="9" fill="' + c1 + '" stroke="none"/>' +
    [0, 90, 180, 270].map(function (r) { return '<path transform="rotate(' + r + ')" d="M-9.01 -14.42A17 17 0 0 1 9.01 -14.42"/>'; }).join("") + "</g>";
  /* As fotos mostram ambos brancos também em M: representam as chaves,
     não a disponibilidade do piloto automático naquele modo de voo. */
  var c2 = M.P.estab !== false ? "#fff" : "#141414";
  h += disco(78, 269) + '<g transform="translate(78 269)" fill="none" stroke="' + c2 + '" stroke-width="4" stroke-linecap="round">' +
    '<circle cy="-9" r="9" fill="' + c2 + '" stroke="none"/><path d="M-10.5 6Q0 13 10.5 6"/><path d="M-17.5 12Q0 24 17.5 12"/></g>';
  var aceso3 = M.P.contornar !== false;
  var c3 = aceso3 ? "#fff" : "#141414";
  /* disco só com o fundo escurecido (com setor); sem setor o ícone fica solto */
  if (g.length) h += disco(330, 269);
  /* barra em dois pedaços, com folga em volta da onda; ponta da seta cheia */
  h += '<g transform="translate(330 269)" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M0 -16V-4M0 16V17" stroke="' + c3 + '" stroke-width="8"/>' +
    '<path d="M-21 -2.5C-12 -2.5 -8 6.5 0 6.5S9 -2.5 16 -2.5" stroke="' + c3 + '" stroke-width="4.5"/>' +
    '<path d="M15 -8L22 -2.5L15 3Z" fill="' + c3 + '" stroke="none"/></g>';

  /* referencial da aeronave: (direita, frente) de um vetor do mapa */
  var yaw = E && E.d && typeof E.d.rumo === "number" ? E.d.rumo : Math.PI / 2;
  var fx = Math.cos(yaw), fz = -Math.sin(yaw), rx = Math.sin(yaw), rz = Math.cos(yaw);
  var rel = function (dx, dz) { return [dx * rx + dz * rz, dx * fx + dz * fz]; };

  /* H: rumo da base em relação ao nariz, 9,8 px/m, preso na borda */
  if (E && E.d && E.b) {
    var qb = rel(E.b.x - E.d.x, E.b.z - E.d.z), db = Math.hypot(qb[0], qb[1]), rb = Math.min(9.8 * db, 146);
    var hx = db > 0 ? 203 + qb[0] / db * rb : 203, hy = db > 0 ? 155 - qb[1] / db * rb : 155;
    h += '<g transform="translate(' + hx.toFixed(1) + " " + hy.toFixed(1) + ')"><circle r="12" fill="#5CAC00"/>' +
      '<text text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="500" fill="#fff">H</text></g>';
  }

  /* vetor de velocidade: só o deslocamento horizontal; some abaixo de ~3 km/h */
  if (APP.conectado && E && E.sens) {
    var w = rel(E.sens.vx || 0, E.sens.vz || 0), vh = Math.hypot(w[0], w[1]);
    if (vh >= .8) {
      var L = Math.min(4.4 * vh * 3.6, 130);
      h += '<path d="M203 155L' + (203 + w[0] / vh * L).toFixed(1) + " " + (155 - w[1] / vh * L).toFixed(1) +
        '" stroke="#D4333A" stroke-width="3.5" stroke-linecap="round"/>';
    }
  }

  /* aeronave, sempre para cima */
  h += '<path d="M203 137.5L215 164V168L203 164.5L191 168V164Z" fill="#E02C30"/>';

  /* N: na direção do norte (-z do mapa), gira ao contrário da proa */
  var nq = rel(0, -1), na = Math.atan2(nq[0], nq[1]), np = pt(na, 145);
  h += '<g transform="translate(' + xy(np) + ") rotate(" + (na * 180 / Math.PI).toFixed(1) + ')"><circle r="11" fill="#0E1218"/>' +
    '<text text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="500" fill="#fff">N</text></g>';
  $("#hsi").innerHTML = h;
}

/* ------------------------------------------------------------- alertas */
var avisosInfo = [];
function avisoInfo(txt) {
  avisosInfo.push({ tipo: "info", txt: txt, ate: Date.now() + 8000, id: "i" + Date.now() + Math.random() });
  desenharAlertas();
}
function alertasAtuais() {
  var E = APP.E, l = [];
  if (APP.tela === "mapa" && M.sub === "edicao") l.push({ id: "demarcacao", tipo: "amarelo", txt: textoMetodo() });
  if (!APP.conectado) M.multiDesde = 0;
  if (controladorEmEdicao() || !APP.conectado || !E || !E.v) return l;
  if ((ehMapeamento(M.modo) || E.mapeamento) && !tanqueVazioParaMapear()) l.push({ id: "tanque-mapeamento", tipo: "amarelo", txt: "Esvazie o tanque para iniciar o mapeamento" });
  var v = E.v, p = E.p || {}, chao = v.estado === "em solo" || v.estado === "concluído";
  var perto = Infinity;
  (E.radar || []).forEach(function (s) { perto = Math.min(perto, s[1]); });
  if (E.protecao ? E.protecao.bloqueioDecolagem : chao && perto < 6) l.push({ id: "pedestres", tipo: "vermelho", txt: "Pedestres ou obstáculos detectados perto da aeronave. Não é possível decolar" });
  var pr = E.protecao;
  if (p.desvio !== false && pr && pr.horizontal && !pr.horizontal.painel) l.push({ id: "freio-radar", tipo: "vermelho", txt: "A aeronave freou para evitar um obstáculo. " + (window.orientacaoRadar ? orientacaoRadar(pr.horizontal.direcao) : "Mova a aeronave para trás para evitar obstáculos") });
  if (p.desvio !== false && pr && pr.superior) l.push({ id: "superior-radar", tipo: "amarelo", txt: "Obstáculo detectado acima da aeronave. Pilote com cuidado" });
  /* 24/10/2026 (Eduardo: "essa mensagem de erro não saiu"): o aviso do desvio desligado fica 8 s, como os outros, e só volta
     quando o desvio for desligado de novo ou a aeronave reconectar; o estado continua nos ícones do radar */
  if (p.desvio !== false) M.multiDesde = 0;
  else {
    if (!M.multiDesde) M.multiDesde = Date.now();
    if (Date.now() - M.multiDesde < 8000) l.push({ id: "multi", tipo: "vermelho", txt: "desvio de obstáculos multidirecional desativada. A aeronave não freia automaticamente. Pilote com cuidado" });
  }
  if (!E.mapeamento && !ehMapeamento(M.modo) && (v.tanque || 0) <= .05) l.push({ id: "carga", tipo: "amarelo", txt: "Não há mais carga líquida. Aterrisse e reabasteça" });
  if ((v.bateria || 0) <= 30 && (v.bateria || 0) > 15) l.push({ id: "bat", tipo: "amarelo", txt: "Bateria fraca. Retorne à base" });
  if ((v.bateria || 0) <= 15) l.push({ id: "bat2", tipo: "vermelho", txt: "Bateria muito fraca. A aeronave vai aterrissar" });
  return l;
}
function desenharAlertas() {
  var agora = Date.now();
  avisosInfo = avisosInfo.filter(function (a) { return a.ate > agora; });
  var l = alertasAtuais().filter(function (a) { return !M.alertasFechados[a.id]; }).concat(avisosInfo);
  var h = l.map(function (a) {
    return '<div class="alerta ' + a.tipo + '" data-id="' + a.id + '">' + a.txt + " &gt;&gt;" + (a.tipo === "vermelho" ? "" : "<button>×</button>") + "</div>";
  }).join("");
  var caixa = $("#alertas");
  if (caixa._h !== h) {
    caixa._h = h; caixa.innerHTML = h;
    $$("button", caixa).forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.parentNode.dataset.id;
        M.alertasFechados[id] = true;
        avisosInfo = avisosInfo.filter(function (a) { return a.id !== id; });
        desenharAlertas();
      });
    });
  }
}
/* chaves que mudam no jogo viram aviso cinza */
var antesP = {};
function avisosDeTroca() {
  var p = APP.E && APP.E.p;
  if (!p) return;
  if (antesP.desvio !== undefined && antesP.desvio !== p.desvio && p.desvio) avisoInfo("desvio de obstáculos multidirecional ativada");
  if (antesP.xgContornar !== undefined && antesP.xgContornar !== p.xgContornar) {
    avisoInfo(p.xgContornar ? "Desvio de obstáculos habilitado" : "Desvio de obstáculos desabilitado.");
    if (p.xgContornar && p.altura > 8) avisoInfo("Bypass de obstáculos habilitado. Altura acima das culturas ajustada para 8,0 m");
  }
  antesP = { desvio: p.desvio, xgContornar: p.xgContornar };
}

/* ------------------------------------------------- caixa de informações */
/* "Área da tarefa" = a área útil (margem + 1,5 m para dentro) menos os
   obstáculos: menor que a "Área de campo" (g6 #0103: 0,03 contra 0,04 ha) */
function areaDaTarefaHa(t) {
  if (poligonoCruzado(t.limite)) return 0;
  var lim = areaTarefa(t);
  if (!lim || lim.length < 3) return 0;
  var sinal = function (pol) { var s = 0; for (var i = 0; i < pol.length; i++) { var a = pol[i], b = pol[(i + 1) % pol.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  var A0 = sinal(lim), u = bordaDentro(lim, 1.5), A1 = sinal(u);
  if ((A1 > 0) !== (A0 > 0)) return 0;
  var obs = obsDaTarefa(t).reduce(function (s, o) { return s + (o.tipo === "circulo" ? Math.PI * o.r * o.r / 10000 : areaHa(o.pts)); }, 0);
  return Math.max(0, Math.abs(A1) / 10000 - obs);
}
/* ------------------------------------------- Resumo da tarefa (R1)
   Cartão branco à direita (g6 #0201, #0286): o R1 abre e, de novo, minimiza
   para o painel pequeno "Área coberta / Quantidade pulverizada  <≡". */
var resumoEl = el("div", "resumo-tarefa oculto");
PALCO.appendChild(resumoEl);
resumoEl.addEventListener("click", function (e) { if (e.target.closest(".fechar-resumo")) alternarResumo(); });
$("#info-dir").addEventListener("click", function (e) { if (e.target.closest(".abrir-resumo")) alternarResumo(); });
function alternarResumo() {
  var E = APP.E, voando = E && E.v && ["em solo", "concluído"].indexOf(E.v.estado) < 0;
  if (ehMapeamento(M.modo) || M.sub !== "execucao" || !(voando || M.vooDur)) return false;
  M.resumo = !M.resumo;
  atualizarInfo();
  return true;
}
window.alternarResumo = alternarResumo;
function desenharResumo(E) {
  var t = M.exec || {}, cob = E.cob || {};
  var area = areaDaTarefaHa(t) || 0, campo = t.limite ? areaHa(t.limite) : 0;
  var feito = cob.haCobertos || E.v.aplicadoHa || 0, litros = E.v.calda || 0;
  var resta = Math.max(0, area - feito), taxa = (M.P && M.P.taxa) || 0;
  var obs = (t.obs || []).reduce(function (s, o) { return s + (o.r ? Math.PI * o.r * o.r / 10000 : 0); }, 0);
  var seg = Math.round(M.vooDesde ? (Date.now() - M.vooDesde) / 1000 : (M.vooDur || 0));
  var lin = function (r, v) { return '<div class="lin"><span>' + r + "</span><b>" + v + "</b></div>"; };
  var h = '<div class="cab"><b>Resumo da tarefa</b><span>R1</span><i class="fechar-resumo">≡&gt;</i></div>' +
    '<div class="caixa"><p>Este voo leva ' + seg + " s</p>" +
    '<div class="par"><div><b class="verde">' + num(area, 2) + "<i>Ha</i></b><span>Área da tarefa</span></div>" +
    '<div><b class="verde">' + num(litros) + "<i>l</i></b><span>Volume pulverizado</span></div></div></div>" +
    '<div class="bloco"><p><i class="bol verde"></i>Coberto</p><div class="par2"><b>' + num(feito, 2) + "<i>Ha</i></b><b>" + num(litros) + "<i>l</i></b></div></div>" +
    '<div class="bloco"><p><i class="bol laranja"></i>Restante</p><div class="par2"><b>' + num(resta, 2) + "<i>Ha</i></b><b>" + num(resta * taxa) + "<i>l</i></b></div></div>" +
    '<div class="lista">' + lin("Área de obstáculo", num(obs, 2) + " Ha") + lin("Área de margem", num(Math.max(0, campo - area), 2) + " Ha") +
    lin("Área de campo", num(campo, 2) + " Ha") + "</div>";
  if (resumoEl._h !== h) { resumoEl._h = h; resumoEl.innerHTML = h; }
}

function atualizarInfo() {
  var c = $("#info-dir"), l = [], E = APP.E;
  var voando = E && E.v && ["em solo", "concluído"].indexOf(E.v.estado) < 0;
  /* tempo desta surtida ("Este voo leva N s"): conta do decolar ao pousar */
  if (voando && !M.vooDesde) { M.vooDesde = Date.now(); M.vooDur = 0; }
  if (!voando && M.vooDesde) { M.vooDur = (Date.now() - M.vooDesde) / 1000; M.vooDesde = null; }
  if (ehMapeamento(M.modo) && M.sub === "execucao" && E && E.mapeamento) {
    var mm = E.mapaMissao || {};
    l = [["Progresso total", Math.round(mm.totalPct || 0) + "%"], ["Rota", Math.round(mm.rotaPct || 0) + "%"],
      ["Fotos", (mm.fotos || 0) + "/" + (mm.completa ? mm.fotos : Math.max(mm.fotos || 0, mm.fotosPrevistas || 0))],
      ["Reconstrução", Math.floor(mm.reconstrucao || 0) + "%"]];
    if (mm.estado === "reconstruindo" || mm.estado === "retornando") l.push(["Otimizando reconstrução", ""]);
    if (mm.estado === "concluido") l.push(["Reconstrução bem-sucedida", "✓"]);
    if (mm.estado === "cancelado") l.push(["Mapeamento interrompido", ""]);
  } else if (ehMapeamento(M.modo) && M.sub === "edicao") {
    var ha = M.ed ? areaHa(M.ed.limite) : 0;
    l = [["Mapeamento de área", num(ha) + "<i>Ha</i>"], ["Número de fotos estimada", String(estimarFotosMapa(M.ed))],
      ["Tempo de voo estimado", Math.max(1, Math.ceil(estimarFotosMapa(M.ed) / 60)) + "<i>minuto</i>"]];
  } else if (M.sub === "edicao" && M.ed) {
    var ac = areaHa(M.ed.limite), at = areaDaTarefaHa(M.ed);
    l = [["Área de campo", num(ac, 2) + "<i>Ha</i>"], ["Área da tarefa", num(at, 2) + "<i>Ha</i>"]];
  } else if (M.sub === "execucao" && (voando || M.vooDur)) {
    var cob = E.cob || {};
    if (M.resumo) { desenharResumo(E); l = []; }
    else l = [["Área coberta", num(cob.haCobertos || E.v.aplicadoHa || 0, 2) + '<i>Ha</i><em class="abrir-resumo" title="Resumo da tarefa">&lt;≡</em>'], ["Quantidade pulverizada", num(E.v.calda || 0) + "<i>L</i>"]];
  } else if ((M.sub === "execucao" && M.exec) || (M.sub === "lista" && M.sel)) {
    var t = M.sub === "execucao" ? M.exec : tarefaPorId(M.sel);
    if (t) {
      var at2 = ehMapeamento(t.modo) ? areaHa(t.limite) : areaDaTarefaHa(t);
      l = [["Precisão do campo", rtkAtivo() ? '<span class="etq">Alto(RTK)</span>' : '<span class="etq baixo">Baixo(GNSS)</span>'], ["Área da tarefa", num(at2, 2) + "<i>Ha</i>"],
        [ehMapeamento(t.modo) ? "Tipo de tarefa" : "Volume pulverizado", ehMapeamento(t.modo) ? "Mapeamento aéreo" : num(at2 * M.P.taxa) + "<i>l</i>"]];
    }
  }
  resumoEl.classList.toggle("oculto", ehMapeamento(M.modo) || !(M.resumo && M.sub === "execucao" && (voando || M.vooDur)));
  c.classList.toggle("oculto", !l.length);
  var h = l.map(function (x) { return '<div class="lin"><span>' + x[0] + "</span><b>" + x[1] + "</b></div>"; }).join("");
  if (c._h !== h) { c._h = h; c.innerHTML = h; }
}

/* ------------------------------------------------------------- tarefas */
function tarefaPorId(id) { return M.tarefas.filter(function (t) { return t.id === id; })[0] || null; }
function selecionar(id) {
  M.sel = M.sel === id ? null : id;
  var t = tarefaPorId(M.sel);
  if (t) { var c = paraPx.apply(null, centroide(t.limite)); centrarEm(c[0], c[1]); }
  montar();
}
function dataCurta(ms) {
  var d = new Date(ms), z = function (n) { return (n < 10 ? "0" : "") + n; };
  return z(d.getFullYear() % 100) + "/" + z(d.getMonth() + 1) + "/" + z(d.getDate()) + " " + z(d.getHours()) + ":" + z(d.getMinutes());
}

/* ------------------------------------------------- montar a tela do modo */
// Mantem o metodo ativo no PC tambem quando o controle usa a ponte remota.
// A renovacao permite parar a caminhada se o app fechar ou perder conexao.
var demarcacaoEnviada, demarcacaoEm = 0;
function sincronizarDemarcacao() {
  var metodo = APP.tela === "mapa" && M.sub === "edicao" && APP.conectado ? M.metodo : null;
  var agora = Date.now();
  if (metodo === demarcacaoEnviada && agora - demarcacaoEm < 1000) return;
  demarcacaoEnviada = metodo; demarcacaoEm = agora;
  cmd("demarcacao", { metodo: metodo });
}
ouvir("tela", sincronizarDemarcacao);
ouvir("conexao", sincronizarDemarcacao);
setInterval(sincronizarDemarcacao, 500);

function montar() {
  sincronizarDemarcacao();
  desenharAlertas();
  document.body.classList.toggle("painel-aberto", M.painel);
  $("#painel").classList.toggle("ativo", M.painel);
  $("#puxador-seta").innerHTML = '<use href="#' + (M.painel ? "i-seta-esq" : "i-seta-dir") + '"/>';
  if (M.ajuste === "angulo") M.ajuste = null;   // o painel do ângulo é refeito abaixo
  /* mira: na edição com Retículo e na execução com o drone no chão (em (1200,600),
     com o painel aberto ou fechado: g6 #0133, #0138, #0139) */
  var Em = APP.E, voandoM = Em && Em.v && ["em solo", "concluído"].indexOf(Em.v.estado) < 0;
  $("#reticulo").classList.toggle("oculto", !((M.sub === "edicao" && M.metodo === "Retículo") || (M.sub === "execucao" && !voandoM)));
  $("#reticulo").classList.toggle("exec", M.sub === "execucao");
  atualizarAlca();
  montarPainel();
  montarDireita();
  atualizarInfo();
  desenharTudo();
  atualizarRetornar();
}

/* alça de direção (2.15): só na edição (rota e mapeamento), fora do ajuste de
   ângulo e de "Selecionar os Lados". Segurar o ponto amarelo e arrastar para
   os lados gira as passadas (relato 30 do piloto): 0,5° por px */
function atualizarAlca() {
  var a = $("#alca");
  if (a) a.classList.toggle("oculto", !(M.sub === "edicao" && M.ed && (M.modo === "rota" || ehMapeamento(M.modo)) && !M.ajuste && !M.ed.painelRedondo));
}
(function () {
  var a = $("#alca"), pega = a && $(".pega", a);
  if (!pega) return;
  var ini = null;
  pega.addEventListener("pointerdown", function (e) {
    e.stopPropagation();
    if (!M.ed) return;
    try { pega.setPointerCapture(e.pointerId); } catch (x) {}
    ini = { x: e.clientX, ang: M.ed.angManual != null ? M.ed.angManual : anguloAuto(M.ed.limite) };
  });
  pega.addEventListener("pointermove", function (e) {
    if (!ini || !M.ed) return;
    e.stopPropagation();
    var dx = (e.clientX - ini.x) / (APP.escala || 1);
    if (!dx && !ini.mexeu) return;   // só tocar não grava ângulo manual (a rota não pula)
    ini.mexeu = true;
    M.ed.angManual = ini.ang + dx * .5 * Math.PI / 180;
    M.rotaMapCache = null;
    pega.setAttribute("cx", (40 + Math.max(-30, Math.min(30, dx))).toFixed(1));
    desenharTudo();
  });
  var soltar = function (e) { if (!ini) return; e.stopPropagation(); ini = null; pega.setAttribute("cx", "40"); desenharTudo(); };
  pega.addEventListener("pointerup", soltar);
  pega.addEventListener("pointercancel", soltar);
})();

function botao(cls, html, fn) { var b = el("button", cls, html); if (fn) b.addEventListener("click", fn); return b; }
function acao(icone, txt, fn, desl) {
  return botao("bt-acao" + (desl ? " desl" : ""), ic(icone) + "<span>" + txt + "</span>", desl ? null : fn);
}

/* o lado direito só é refeito quando muda o que ele mostra: refazer a cada
   estado (10 Hz) engolia toques em Retomar */
function chaveDireita() {
  var E = APP.E, v = E && E.v;
  return [APP.conectado, M.modo, M.sub, M.abaMan, M.mmais, v ? v.estado : "", v ? !!v.temRota : "", v ? !!v.rodando : "", M.voo ? M.voo.fase : "", E && E.mapaMissao ? E.mapaMissao.estado : "", tanqueVazioParaMapear()].join("|");
}
function montarDireitaSeMudou() { if (chaveDireita() !== montarDireita._k) montarDireita(); }
/* Sair da execução: o talhão volta ao estado A ou F (sem seleção); a trilha fica */
function sairExecucao() {
  if (ehMapeamento(M.modo) && missaoMapa() && ["concluido", "reconstruindo", "retornando"].indexOf(missaoMapa().estado) >= 0) {
    if (missaoMapa().estado === "concluido") return descartarMapa();
    return toast("Aguarde a reconstrução do mapa");
  }
  if (M.exec && ehMapeamento(M.exec.modo) && !noAr(APP.E)) { M.exec=null; cmd("p",{v:{xgMapeamento:false,xgGeo:null,xgPulverizar:M.P.sistemas}}); }
  M.sub = "lista"; M.sel = null; M.voo = null; M.painel = M.modo === "rota"; montar(); }
function montarDireita() {
  var dc = $("#dir-centro"), ac = $("#acoes"), E = APP.E;
  montarDireita._k = chaveDireita();
  dc.innerHTML = ""; ac.innerHTML = "";
  var voando = E && E.v && ["em solo", "concluído"].indexOf(E.v.estado) < 0;
  if (M.modo === "manual") {
    dc.style.top = "592px";
    dc.appendChild(botao("bt-claro", ic("i-lapis") + "Rota Fixa", function () { toast("A Rota fixa será ativada assim que a tarefa for iniciada"); }));
    if (M.abaMan === "M+") {
      /* M+: no ar sem tarefa, "Iniciar" só liga a tarefa (círculo laranja/azul) */
      if (voando && M.mmais) ac.appendChild(acao("i-encerrar", "Encerrar", function () { M.mmais = false; cmd("pulvManual", { v: false }); cmd("encerrar"); montarDireita(); desenharAero(); }));
      else if (voando) ac.appendChild(acao("i-iniciar", "Iniciar", function () { M.mmais = true; enviarP(); cmd("pulvManual", { v: true, mmais: true }); montarDireita(); desenharAero(); }));
      /* no chão: a tarefa M+ só liga depois da conferência confirmada */
      else ac.appendChild(acao("i-iniciar", "Iniciar", function () { iniciarComConferencia(function () { M.mmais = true; enviarP(); cmd("pulvManual", { v: true, mmais: true }); }); }));
    } else if (voando) {
      ac.appendChild(acao("i-encerrar", "Encerrar", function () { cmd("pulvManual", { v: false }); cmd("encerrar"); }));
    } else {
      ac.appendChild(acao("i-iniciar", "Iniciar", function () { iniciarComConferencia(function () { cmd("pulvManual", { v: true }); }); }));
    }
    return;
  }
  if (M.sub === "lista") {
    if (M.modo === "arvore") {
      dc.style.top = "592px";
      dc.appendChild(botao("bt-claro", ic("i-mais") + "Adicionar", function () { toast("Nenhuma reconstrução disponível para planejar"); }));
      ac.appendChild(acao("i-lapis", "Edição", null, true));
      ac.appendChild(acao("i-check", "Use", null, true));
      return;
    }
    if (M.sel) {
      dc.style.top = "592px";
      dc.appendChild(botao("bt-claro", ic("i-dividir") + "Dividir campo", function () { toast("Dividir campo: toque nos dois pontos de ancoragem na borda"); }));
      ac.appendChild(acao("i-x", "Cancelar", function () { M.sel = null; montar(); }));
      ac.appendChild(acao("i-lapis", "Edição", function () { editar(tarefaPorId(M.sel)); }));
      if (ehMapeamento(M.modo) && tarefaPorId(M.sel).mapaHD) {
        var hdSalvo = botao("bt-claro", "Mapa HD", function () { abrirMapaHD(tarefaPorId(M.sel).mapaHD); });
        hdSalvo.dataset.mapAcao = "hd"; dc.appendChild(hdSalvo);
      }
      /* RTK e tanque vazio são confirmados pela aeronave simulada. */
      if (ehMapeamento(M.modo)) ac.appendChild(acao("i-iniciar", "Iniciar", function () {
        if (!rtkAtivo()) return toast("Ative o Posicionamento RTK para iniciar o mapeamento");
        if (!tanqueVazioParaMapear()) return toast("Esvazie o tanque para iniciar o mapeamento");
        usar(tarefaPorId(M.sel)); iniciarComConferencia();
      }, !rtkAtivo() || !tanqueVazioParaMapear()));
      else ac.appendChild(acao("i-check", "Use", function () { usar(tarefaPorId(M.sel)); }));
    } else {
      dc.style.top = "592px";
      var linha = el("div", "linha-add");
      linha.appendChild(botao("bt-icone", ic("i-selecao"), function () { toast("Toque em uma tarefa no mapa para selecionar"); }));
      linha.appendChild(botao("bt-claro", ic("i-mais") + "Adicionar", function () { editar(null); }));
      linha.lastChild.style.width = "310px";
      dc.appendChild(linha);
      ac.appendChild(acao("i-lapis", "Edição", null, true));
      ac.appendChild(acao("i-check", "Use", null, true));
    }
    return;
  }
  if (M.sub === "edicao") {
    dc.style.top = ehMapeamento(M.modo) ? "548px" : "407px";
    if (ehMapeamento(M.modo)) {
      var t1 = el("div", "tipos");
      t1.innerHTML = '<button class="ativo" style="height:54px;font-size:34px;background:rgba(30,30,30,.72)"><i style="background:#CC11E4;border:3px solid #fff"></i>Ponto limite</button>';
      t1.style.background = "transparent";
      dc.appendChild(t1);
    } else {
      var tipos = el("div", "tipos");
      [["Marcar linha", "#E32C2E"], ["Marcar ponto", "#1890FF"], ["Área sem aplicação", "#8a8a8a"], ["Redondo", "#DD2E31"],
        ["Ponto de obstáculo", "#DD2E31"], ["Ponto limite", "#CC11E4"]].forEach(function (x) {
        var b = botao(M.tipo === x[0] ? "ativo" : "", '<i style="background:' + x[1] + (x[0] === "Redondo" ? ";box-shadow:inset 0 0 0 6px #fff;border:3px solid #DD2E31" : "") + '"></i>' + x[0],
          function () {
            var fechouPainel = false;
            M.tipo = x[0];
            if (M.ed) {
              M.ed.grupo = null; M.ed.grupoM = null;
              if (x[0] !== "Redondo") { M.ed.redondoAtivo = null; if (M.ed.painelRedondo) { M.ed.painelRedondo = null; fechouPainel = true; } }
              /* os vértices do limite voltam ao escolher "Ponto limite" outra vez */
              if (x[0] === "Ponto limite") M.ed.outro = false;
            }
            if (fechouPainel) return montar();   // o painel do Redondo sai e voltam as configurações
            montarDireita(); desenharTudo();
          });
        tipos.appendChild(b);
      });
      tipos.style.maxHeight = "345px"; tipos.style.overflowY = "auto";
      dc.appendChild(tipos);
      setTimeout(function () { tipos.scrollTop = tipos.scrollHeight; }, 0);
    }
    var linha2 = el("div", "linha-add");
    linha2.appendChild(botao("bt-icone", iconeMetodo(M.metodo, true), function () { menuMetodo(this); }));
    var ad = botao("bt-claro", "Adicionar", adicionarPonto);
    ad.style.width = ehMapeamento(M.modo) ? "247px" : "350px";
    linha2.appendChild(ad);
    dc.appendChild(linha2);
    ac.appendChild(acao("i-sair", "Sair", sairEdicao));
    ac.appendChild(acao("i-check", "Salvar", salvarEdicao));
    return;
  }
  if (M.sub === "execucao") {
    if (ehMapeamento(M.modo) && montarResultadoMapa(dc, ac)) return;
    /* tarefa concluída com o drone voltando (g6 #0275) ou aeronave caída: só "Sair" */
    if (voando && ((M.voo && M.voo.fase === "concluida") || E.v.estado === "caiu")) {
      ac.appendChild(acao("i-sair", "Sair", sairExecucao));
      return;
    }
    if (voando) {
      ac.appendChild(acao("i-encerrar", "Encerrar", function () {
        dialogo({ icone: "alerta", titulo: "Encerrar a tarefa?", texto: "A aeronave retornará ao ponto de origem",
          botoes: [{ t: "Cancelar(R2)" }, { t: "Encerrar(R3)", cls: "verm", fn: function () { cmd("encerrar"); } }] });
      }));
      var pausado = E.v.estado === "manual" || !E.v.rodando;
      var reab = E.v.estado === "reabastecendo";
      ac.appendChild(acao(pausado || reab ? "i-iniciar" : "i-pausar", reab ? "Continuar" : pausado ? "Retomar" : "Pausar", function () {
        if ((pausado || reab) && ehMapeamento(M.modo) && !tanqueVazioParaMapear()) return toast("Esvazie o tanque para iniciar o mapeamento");
        if (reab) return iniciarComConferencia();
        /* Retomar com a escolha da janelinha "Retornar à" (jogo antigo ignora o alvo) */
        var Ea = APP.E;
        var retomarAgora = function () {
          if (Ea && Ea.v && Ea.v.estado === "manual" && Ea.v.temRota) cmd("retomar", { alvo: alvoRetorno() });
          else cmd("retomar");
        };
        /* 09/10/2026 (Eduardo): pousada, a tarefa só volta pela verificação com o deslizador "›››",
           a contagem e as hélices girando, como no Agras (g6 #0220). No ar continua direto. */
        var retomarNoChao = pausado && !noAr(Ea) && M.modo !== "manual";
        if (retomarNoChao) return iniciarComConferencia(null, retomarAgora);
        if (pausado) retomarAgora(); else cmd("pausar");
      }, (pausado || reab) && ehMapeamento(M.modo) && !tanqueVazioParaMapear()));
      return;
    }
    dc.style.top = "490px";
    dc.appendChild(botao("bt-claro", "Retificar a compensação", abrirRetificar));
    dc.lastChild.style.width = "527px";
    var cx = el("div", "", '<div style="display:flex;align-items:center;justify-content:center;gap:12px;width:527px;height:48px;margin-top:24px;' +
      'font-size:34px;color:#fff;background:rgba(30,30,30,.72);border-radius:8px 8px 0 0"><i style="width:30px;height:30px;border-radius:50%;background:#CC11E4;border:3px solid #fff"></i>Ponto de conexão</div>');
    dc.appendChild(cx);
    /* ponto de conexão: nasce na mira; a magenta dobra nele e o jogo voa por ele na ida */
    var ad2 = botao("bt-claro", "Adicionar", function () {
      if (!M.exec) return;
      if (!M.voo || M.voo.id !== M.exec.id) M.voo = novoVoo(M.exec);
      /* a mira da execução fica em (1200,600) com o painel aberto ou fechado (g6 #0138, #0139) */
      var w = telaParaMapa(1200, 600);
      M.voo.con.push(paraM(w[0], w[1])); M.voo.conDaRota = false;
      enviarTalhao(M.exec);
      avisoInfo("Ponto de conexão adicionado com sucesso");
      desenharTudo();
    });
    ad2.style.width = "527px";
    dc.appendChild(ad2);
    /* Sair: o talhão volta ao estado A ou F (sem seleção); a trilha fica */
    ac.appendChild(acao("i-sair", "Sair", sairExecucao));
    ac.appendChild(acao("i-lapis", "Edição", function () { editar(M.exec); }));
    ac.appendChild(acao("i-iniciar", "Iniciar", iniciarComConferencia, ehMapeamento(M.modo) && (!rtkAtivo() || !tanqueVazioParaMapear())));
  }
}

function iconeMetodo(m, canto) {
  var desenho = m === "Retículo"
    ? '<path d="M24 5v12M24 31v12M5 24h12M31 24h12" fill="none" stroke="currentColor" stroke-width="3.4"/>'
    : m === "Controlador"
    ? '<path d="M13 15 12 4M35 15 36 4" stroke="currentColor" stroke-width="3"/><rect x="8" y="18" width="32" height="25" rx="5" fill="currentColor"/><circle cx="17" cy="29" r="4" fill="white"/><circle cx="31" cy="29" r="4" fill="white"/>'
    : '<path d="M7 20 41 7 28 41 22 27z" fill="currentColor"/>';
  return '<svg viewBox="0 0 48 48" aria-hidden="true">' + desenho + (canto ? '<path d="M0 48v-8l8 8z" fill="currentColor"/>' : '') + '</svg>';
}
function textoMetodo() {
  if (M.metodo === "Retículo") return "Gravando pontos com retículo. Adicionar ponto dentro da área mapeada para maior precisão";
  return "Gravando pontos com posicionamento GPS " + (M.metodo === "Controlador" ? "do controle remoto" : "da aeronave") +
    ". Baixa precisão. A rota de voo real pode não ser exatamente igual à planejada";
}
function menuMetodo(bt) {
  bt = bt || $(".linha-add .bt-icone");
  var d = dialogo({ titulo: "Adicionar ponto com", lista: ["Retículo", "Controlador", "Aeronave"].map(function (m) {
    return { t: iconeMetodo(m) + '<span>' + m + '</span>', cls: m === M.metodo ? "verde" : "", fn: function () {
      M.metodo = m; delete M.alertasFechados.demarcacao; montar();
    } };
  }) });
  var camada = dialogoAberto.camada;
  camada.classList.add("camada-metodo");
  d.classList.add("menu-metodo");
  if (bt) {
    var r = bt.getBoundingClientRect(), p = PALCO.getBoundingClientRect(), k = APP.escala || 1;
    d.style.left = Math.max(12, (r.left - p.left) / k - 424) + "px";
    d.style.top = Math.max(132, Math.min(796, (r.top + r.height / 2 - p.top) / k - 196)) + "px";
  }
  camada.addEventListener("click", function (e) { if (e.target === camada) fecharDialogo(); });
  // R2/Voltar tambem fecha este menu, sem alterar o metodo escolhido.
  var cancelar = el("div", "botoes"); cancelar.style.display = "none";
  cancelar.appendChild(botao("", "Cancelar(R2)", fecharDialogo)); d.appendChild(cancelar);
}

/* ------------------------------------------------------------- painel */
/* toque no número: vira campo com o teclado numérico do Android, borda verde e o
   valor selecionado (como no Agras, g5 #0036). ✓ ou tocar fora grava; vale min/max */
function editavel(span, ler, casas, min, max, gravar) {
  var c = casas == null ? 1 : casas, f = Math.pow(10, c);
  span.addEventListener("click", function () {
    if (span.querySelector("input")) return;
    var inp = document.createElement("input");
    inp.type = "text";
    inp.setAttribute("inputmode", "decimal");
    inp.value = num(ler(), c);
    span.textContent = "";
    span.appendChild(inp);
    span.classList.add("editando");
    inp.focus();
    inp.select();
    var feito = false;
    function fim(ok) {
      if (feito) return;
      feito = true;
      span.classList.remove("editando");
      var v = parseFloat(String(inp.value).replace(",", "."));
      if (ok && isFinite(v)) gravar(Math.max(min, Math.min(max, Math.round(v * f) / f)));
      else span.textContent = num(ler(), c);
    }
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); fim(true); inp.blur(); }
      else if (e.key === "Escape") { fim(false); }
    });
    inp.addEventListener("blur", function () { fim(true); });
  });
}
function passo(rot, unid, chave, passoV, casas, min, max, aoMudar) {
  M.P[chave] = Math.max(min, Math.min(max, Number(M.P[chave]) || min));
  var v = M.P[chave];
  var d = el("div", "campo",
    '<div class="rot">' + rot + (unid ? " <i>(" + unid + ")</i>" : "") + '</div><div class="passo"><button data-d="-1">' + ic("i-x", "0 0 48 48").replace("i-x", "i-menos") +
    '</button><span class="val">' + num(v, casas) + '</span><button data-d="1">' + ic("i-mais") + "</button></div>");
  $$("[data-d]", d).forEach(function (b) {
    b.innerHTML = b.dataset.d === "-1" ? '<svg viewBox="0 0 48 48"><path d="M10 24h28" stroke="#2b2e31" stroke-width="4" stroke-linecap="round"/></svg>' : ic("i-mais");
    b.addEventListener("click", function () {
      var nv = Math.max(min, Math.min(max, Math.round((Number(M.P[chave]) + Number(b.dataset.d) * passoV) * 100) / 100));
      M.P[chave] = nv; salvarP();
      $(".val", d).textContent = num(nv, casas);
      if (aoMudar) aoMudar(nv, d);
    });
  });
  editavel($(".val", d), function () { return M.P[chave]; }, casas, min, max, function (nv) {
    M.P[chave] = nv; salvarP();
    $(".val", d).textContent = num(nv, casas);
    if (aoMudar) aoMudar(nv, d);
  });
  return d;
}
function passoEd(rot, unid, obj, chave, passoV, casas, min, max, aoMudar) {
  obj[chave] = Math.max(min, Math.min(max, Number(obj[chave]) || min));
  var d = el("div", "campo",
    '<div class="rot">' + rot + (unid ? " <i>(" + unid + ")</i>" : "") + '</div><div class="passo"><button data-d="-1"></button><span class="val">' +
    num(obj[chave], casas) + '</span><button data-d="1"></button></div>');
  $$("[data-d]", d).forEach(function (b) {
    b.innerHTML = b.dataset.d === "-1" ? '<svg viewBox="0 0 48 48"><path d="M10 24h28" stroke="#2b2e31" stroke-width="4" stroke-linecap="round"/></svg>' : ic("i-mais");
    b.addEventListener("click", function () {
      obj[chave] = Math.max(min, Math.min(max, Math.round((Number(obj[chave]) + Number(b.dataset.d) * passoV) * 100) / 100));
      $(".val", d).textContent = num(obj[chave], casas);
      if (aoMudar) aoMudar(obj[chave]);
      desenharTudo(); atualizarInfo();
    });
  });
  editavel($(".val", d), function () { return obj[chave]; }, casas, min, max, function (nv) {
    obj[chave] = nv;
    $(".val", d).textContent = num(nv, casas);
    if (aoMudar) aoMudar(nv);
    desenharTudo(); atualizarInfo();
  });
  return d;
}
function seg(opcoes, ativo, fn, vertical, icones) {
  var s = el("div", vertical ? "seg-v" : "seg");
  opcoes.forEach(function (o, i) {
    var b = botao(o === ativo ? "ativo" : "", (icones ? ic(icones[i]) : "") + "<span>" + o + "</span>", function () {
      $$("button", s).forEach(function (x) { x.classList.toggle("ativo", x === b); });
      fn(o);
    });
    s.appendChild(b);
  });
  return s;
}
function chave(rot, ligada, fn, icone) {
  var l = el("div", "lin-chave", (icone || "") + "<span>" + rot + '</span><button class="chave' + (ligada ? " lig" : "") + '"></button>');
  $(".chave", l).addEventListener("click", function () {
    var b = this, novo = !b.classList.contains("lig");
    var r = fn(novo, function () { b.classList.toggle("lig", novo); });
    if (r !== false) b.classList.toggle("lig", novo);
  });
  return l;
}

function montarPainel() {
  var p = $("#painel");
  p.innerHTML = "";
  if (!M.painel) return;
  if (M.modo === "manual") return painelManual(p);
  if (M.sub === "lista") {
    if (M.modo === "arvore") return painelListaArvores(p);
    return painelLista(p);
  }
  /* Redondo tocado no ponto central: o painel dele no lugar das configurações (26/10/2026) */
  if (M.sub === "edicao" && M.ed && M.ed.painelRedondo && M.ed.obs.indexOf(M.ed.painelRedondo) >= 0 && !ehMapeamento(M.modo)) return painelRedondo(p);
  if (M.sub === "edicao") return ehMapeamento(M.modo) ? painelMapRota(p) : painelEdicao(p);
  if (M.sub === "execucao") return painelExecucao(p);
}

function painelLista(p) {
  var abas = el("div", "abas");
  ["Tarefa", "Em andamento"].forEach(function (a) {
    abas.appendChild(botao(M.aba === a ? "ativa" : "", a === "Em andamento" ? "Em anda<br>mento" : a, function () { M.aba = a; montar(); }));
  });
  p.appendChild(abas);
  p.appendChild(el("div", "busca-lista", '<div class="busca">' + ic("i-lupa") + '</div><button class="ordenar">' + ic("i-ordenar") + "Distância</button>"));
  var l = el("div", "lista");
  var fam = famModo();
  var itens = (M.aba === "Tarefa" ? M.tarefas : M.andamento.map(tarefaPorId).filter(Boolean))
    .filter(function (t) { return !fam || familia(t) === fam; });   // rota e mapeamento em listas separadas
  if (!itens.length) {
    l.innerHTML = '<div class="vazio">' + ic("i-documento") + "Nenhuma tarefa encontrada</div>";
  }
  itens.forEach(function (t, i) {
    var sel = t.id === M.sel;
    var it = el("div", "item-tarefa" + (sel ? " sel" : ""),
      '<div class="corpo"><div class="dt"><span>' + dataCurta(t.data) + "</span><b>" + num(t.area || areaHa(t.limite), 2) + 'Ha</b></div>' +
      '<div class="nome"></div><div class="loc">' + ic("i-pin") + "<span>Campo de treinamento</span></div></div>" +
      (sel ? '<span class="num">' + (M.tarefas.indexOf(t) + 1) + '</span><div class="acoes-item"><button data-a="ren">Renomear</button><button data-a="exc">Excluir</button></div>' : ""));
    $(".nome", it).textContent = String(t.nome || '');
    $(".corpo", it).addEventListener("click", function () { selecionar(t.id); });
    if (sel) {
      $('[data-a="ren"]', it).addEventListener("click", function () { renomear(t); });
      $('[data-a="exc"]', it).addEventListener("click", function () {
        dialogo({ icone: "alerta", titulo: "Excluir tarefa?", botoes: [{ t: "Cancelar(R2)" }, { t: "Excluir", cls: "verm", fn: function () {
          M.tarefas = M.tarefas.filter(function (x) { return x !== t; });
          M.andamento = M.andamento.filter(function (x) { return x !== t.id; });
          M.sel = null; salvarTarefas(); montar();
        } }] });
      });
    }
    l.appendChild(it);
  });
  p.appendChild(l);
}
function painelListaArvores(p) {
  p.appendChild(el("div", "titulo", "Tarefa"));
  p.lastChild.style.height = "73px";
  p.appendChild(el("div", "busca-lista", '<div class="busca">' + ic("i-lupa") + '</div><button class="ordenar">' + ic("i-ordenar") + "Distância</button>"));
  p.appendChild(el("div", "lista", '<div class="vazio">' + ic("i-documento") + "Nenhuma tarefa encontrada</div>"));
}

function renomear(t) {
  dialogo({ titulo: "Renomear", html: '<input id="nome-novo" style="width:100%;height:96px;margin-bottom:24px;border:0;border-radius:8px;background:#f2f2f2;padding:0 24px;font-size:38px;font-family:Roboto" value="' + t.nome.replace(/"/g, "&quot;") + '">',
    botoes: [{ t: "Cancelar(R2)" }, { t: "OK(R3)", cls: "verde", fn: function (d) {
      var v = $("#nome-novo", d).value.trim(); if (v) { t.nome = v; salvarTarefas(); montar(); }
    } }] });
}

/* ------------------------------------------------------------- edição */
function novaEdicao(t) {
  return t ? JSON.parse(JSON.stringify({ id: t.id, nome: t.nome, mapaHD: t.mapaHD, alturaMap: t.alturaMap, velMap: t.velMap, rotaMap: t.rotaMap, res: t.res, limite: t.limite, obs: t.obs || [], marcas: t.marcas || [], esp: t.esp, margem: t.margem || 0,
    modoMargem: t.modoMargem || "Geral", seguranca: t.seguranca == null ? 1.5 : t.seguranca, cob: t.cob || "Somente rota", sentido: t.sentido || "horario",
    umLado: !!t.umLado, angManual: t.angManual == null ? null : t.angManual, seg: t.seg || [0, 100], ladoIdx: t.ladoIdx || 0,
    lados: ladosTarefa(t), linhasM: t.linhasM || [] }))
    : { id: null, nome: "", limite: [], obs: [], marcas: [], esp: 6, margem: 0, modoMargem: "Geral", seguranca: 1.5, cob: "Somente rota",
      sentido: "horario", umLado: false, angManual: null, seg: [0, 100], lados: {}, linhasM: [] };
}
function editar(t) {
  if (ehMapeamento(t ? t.modo : M.modo) && !mapeamentoDisponivel()) return toast("Mapeamento disponível somente para administrador");
  M.ed = novaEdicao(t);
  M.ed.original = t ? t.id : null;
  M.sub = "edicao"; M.painel = true; M.tipo = "Ponto limite";
  delete M.alertasFechados.demarcacao;
  montar();
}
function controladorEmEdicao() {
  return APP.tela === "mapa" && M.sub === "edicao" && M.metodo === "Controlador";
}
function adicionarPonto() {
  if (M.sub !== "edicao" || !M.ed) return;
  var E = APP.E, m;
  /* Retículo marca no centro do retículo mesmo com a aeronave voando, sem
     limite de velocidade: é assim no app da DJI (o Eduardo chama de "bug da
     DJI", 06/10/2026). O aviso de velocidade é só do método Aeronave. */
  var reticuloMapa = M.metodo === "Retículo";
  if (reticuloMapa) {
    /* 24/10/2026 (Eduardo): com a aeronave ligada o drone carrega o retículo. Com a câmera grande o mapinha fica centrado no
       drone e o retículo do mapa some: o ponto é onde o drone está, sem limite de velocidade (como no Retículo de antes). */
    if (APP.conectado && E && E.d && document.body.classList.contains("fpv-cheia")) m = [E.d.x, E.d.z];
    else { var w = telaParaMapa(960, 600); m = paraM(w[0], w[1]); }
  }
  else if (M.metodo === "Aeronave") {
    if (!APP.conectado || !E || !E.d) return toast("Aeronave desconectada");
    // Limite informado pelo piloto para a demarcacao: 3 km/h; estado em m/s.
    if (E.v && Math.abs(E.v.velocidade || 0) * 3.6 > 3) return avisoInfo("Velocidade de voo muito alta. Não é possível adicionar ponto");
    m = [E.d.x, E.d.z];
  }
  else { if (!APP.conectado || !E || !E.o) return toast("Posição do controle indisponível"); m = [E.o.x, E.o.z]; }
  if (!m.every(Number.isFinite)) return toast("Posição indisponível");
  var ed = M.ed, tipo = ehMapeamento(M.modo) ? "Ponto limite" : M.tipo;
  var perto = function (lista) { return lista.some(function (q) { return Math.hypot(q[0] - m[0], q[1] - m[1]) < 1; }); };
  if (tipo === "Ponto limite") {
    if (perto(ed.limite)) return avisoInfo("Falha ao adicionar. Os pontos devem estar pelo menos 1.0m separados");
    /* com 3 pontos ou mais, o novo entra na aresta mais próxima (g1 #0066) */
    var L = ed.limite, pos = L.length;
    if (reticuloMapa && L.length >= 3) {
      var melhor = Infinity, hp = function (a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); };
      for (var i = 0; i < L.length; i++) {
        var a = L[i], b = L[(i + 1) % L.length], custo = hp(a, m) + hp(m, b) - hp(a, b);
        if (custo < melhor) { melhor = custo; pos = i + 1; }
      }
    }
    L.splice(pos, 0, m);
    ed.ultimoLim = m;   // (a borracha do topo não desfaz mais este: só limpa o rastro)
    M.rotaMapCache = null;
  } else if (tipo === "Redondo") {
    /* raio padrão da DJI: 1,5 m (piloto, item 33; g6 #0121) */
    var ob = origemRedondo({ tipo: "circulo", c: m, r: 1.5 });
    ed.obs.push(ob); ed.redondoAtivo = ob; ed.redondoSel = "centro"; ed.outro = true;
    ampliarSobreRedondo(ob);
    if (ed.painelRedondo) { ed.painelRedondo = ob; montar(); }   // painel aberto: passa para o Redondo novo
  } else if (tipo === "Ponto de obstáculo" || tipo === "Área sem aplicação") {
    if (!ed.grupo || ed.grupo.tipoNome !== tipo) { ed.grupo = { tipo: "poligono", pts: [], sem: tipo === "Área sem aplicação", tipoNome: tipo }; ed.obs.push(ed.grupo); }
    ed.grupo.pts.push(m); ed.outro = true;
  } else if (tipo === "Marcar linha") {
    if (!ed.linhasM) ed.linhasM = [];
    if (!ed.grupoM || ed.linhasM.indexOf(ed.grupoM) < 0) { ed.grupoM = { cor: "#E32C2E", pts: [] }; ed.linhasM.push(ed.grupoM); }
    ed.grupoM.pts.push(m); ed.outro = true;
  } else {
    ed.marcas.push(m); ed.outro = true;
  }
  avisoInfo(poligonoCruzado(ed.limite) ? "Planos de campo se cruzaram" : "Ponto de referência adicionado");
  desenharTudo(); atualizarInfo();
}
function sairEdicao() {
  var mexeu = M.ed && (M.ed.limite.length || M.ed.obs.length);
  var sair = function () { M.ed = null; M.sub = "lista"; M.painel = M.modo === "rota"; montar(); };
  if (!mexeu) return sair();
  dialogo({ icone: "alerta", titulo: "Sair do plano atual?", texto: "Sair descartará as alterações no plano atual",
    botoes: [{ t: "Cancelar(R2)" }, { t: "Sim(R3)", cls: "verm", fn: sair }] });
}
function salvarEdicao() {
  var ed = M.ed;
  if (ed.limite.length < 3) return toast("Adicione pelo menos 3 pontos limite");
  if (poligonoCruzado(ed.limite)) return avisoInfo("Planos de campo se cruzaram");
  var gravar = function (nome, sobrescrever) {
    var t = {
      id: sobrescrever ? ed.original : "t" + Date.now(), nome: nome, data: Date.now(), limite: ed.limite,
      obs: ed.obs.filter(function (o) { return o.tipo === "circulo" || o.pts.length >= 3; }).map(function (o) { return o.tipo === "circulo" ? { tipo: "circulo", c: o.c, r: o.r } : { tipo: "poligono", pts: o.pts, sem: o.sem }; }),
      marcas: ed.marcas, esp: ed.esp, margem: ed.margem, modoMargem: ed.modoMargem, ladoIdx: ed.ladoIdx || 0, seguranca: ed.seguranca, cob: ed.cob, sentido: ed.sentido,
      umLado: ed.umLado, angManual: ed.angManual, ang: ed.angManual != null ? ed.angManual : anguloAuto(ed.limite), seg: ed.seg,
      lados: ed.lados || {}, linhasM: (ed.linhasM || []).filter(function (g) { return g.pts && g.pts.length; }),
      modo: M.modo, mapaHD: sobrescrever ? ed.mapaHD : undefined, alturaMap: ed.alturaMap || 30, velMap: ed.velMap || 18, rotaMap: ed.rotaMap || "area", res: ed.res || "Médio"
    };
    t.area = areaHa(t.limite);
    if (sobrescrever) M.tarefas = M.tarefas.map(function (x) { return x.id === t.id ? t : x; });
    else M.tarefas.unshift(t);
    salvarTarefas();
    M.ed = null; M.sub = "lista"; M.painel = true; M.sel = t.id;
    montar();
  };
  var pedirNome = function (sobre) {
    if (sobre) return gravar(tarefaPorId(ed.original).nome, true);
    dialogo({ titulo: "Salvar como tarefa", html: '<p style="text-align:left;margin:0 0 12px">Nome da tarefa</p><input id="nome-tarefa" style="width:100%;height:96px;margin-bottom:24px;border:0;border-radius:8px;background:#f2f2f2;padding:0 24px;font-size:38px;font-family:Roboto" value="' + dataCurta(Date.now()).replace(/\//g, "-") + '">',
      botoes: [{ t: "Cancelar(R2)" }, { t: "Salvar(R3)", cls: "verde", fn: function (d) { gravar($("#nome-tarefa", d).value.trim() || "Tarefa", false); } }] });
  };
  if (ed.original) {
    dialogo({ icone: "pergunta", titulo: "A tarefa original foi reeditada. Salvar?", lista: [
      { t: "Salvar como", cls: "verde", fn: function () { pedirNome(false); } },
      { t: "Salvar", fn: function () { pedirNome(true); } },
      { t: "Cancelar(R2)" }] });
  } else pedirNome(false);
}

function painelEdicao(p) {
  var ed = M.ed;
  p.appendChild(el("div", "titulo", "Configurações de rota de voo"));
  var abas = el("div", "abas");
  ["Básico", "Avançado"].forEach(function (a) {
    abas.appendChild(botao(M.abaEd === a ? "ativa" : "", a, function () { M.abaEd = a; montar(); }));
  });
  p.appendChild(abas);
  var r = el("div", "rolagem");
  if (M.abaEd === "Básico") {
    r.appendChild(passoEd("Espaçamento de rota", "m", ed, "esp", .01, 2, 1.6, 59.03));
    var mg = el("div", "campo", '<div class="rot">Margens de campo ampliadas <i>(m)</i></div>');
    mg.appendChild(seg(["Geral", "Um lado"], ed.modoMargem, function (o) {
      ed.modoMargem = o;
      if (o === "Um lado") abrirLados();
    }));
    r.appendChild(mg);
    var pm = passoEd("", "", ed, "margem", .1, 1, 0, 100);
    pm.querySelector(".rot").remove();
    r.appendChild(pm);
    r.appendChild(passoEd("Distância de segurança do limite de obstáculo", "m", ed, "seguranca", .1, 1, 0, 5));
    var pi = el("div", "rodape-painel", '<span style="font-size:36px">Ponto inicial</span>');
    pi.appendChild(botao("bt-contorno", "Configurações", function () { toast("Toque em um ponto limite para definir o ponto inicial"); }));
    r.appendChild(pi);
  } else {
    var ca = el("div", "campo", '<div class="rot">Área de cobertura</div>');
    ca.appendChild(seg(["Somente rota", "Rota e fronteira", "Somente fronteira"], ed.cob, function (o) { ed.cob = o; desenharTudo(); }, true,
      ["ic-somente-rota", "ic-rota-fronteira", "ic-somente-fronteira"]));
    r.appendChild(ca);
    var di = el("div", "campo", '<div class="rot">Direção</div>');
    di.appendChild(seg(["Sentido horário", "Sentido anti-horário"], ed.sentido === "anti" ? "Sentido anti-horário" : "Sentido horário",
      function (o) { ed.sentido = o === "Sentido anti-horário" ? "anti" : "horario"; }));
    r.appendChild(di);
    r.appendChild(chave("Pulverização apenas um lado", ed.umLado, function (v) { ed.umLado = v; }));
    var an = el("div", "rodape-painel", '<span style="font-size:36px;flex:1">Ângulo da rota</span>');
    an.appendChild(botao("bt-contorno", "Configurações", abrirAngulo));
    r.appendChild(an);
    var sg = el("div", "rodape-painel", '<span style="font-size:36px;flex:1">Segmentação de rota</span>');
    sg.appendChild(botao("bt-contorno", "Configurações", abrirSegmentacao));
    r.appendChild(sg);
  }
  p.appendChild(r);
}

function abrirLados() {
  var ed = M.ed;
  var barra = el("div", "", "");
  barra.style.cssText = "position:absolute;left:12px;top:949px;width:1896px;height:239px;background:#fff;border-radius:16px;z-index:70;display:flex;overflow:hidden";
  barra.innerHTML = '<div style="width:1080px;padding:33px 36px"><div style="font-size:36px">Selecionar os Lados</div>' +
    '<div style="display:flex;align-items:center;gap:96px;margin-top:24px"><button class="bt-icone" style="background:#f2f2f2" data-l="-1"><svg viewBox="0 0 24 48" style="width:30px;height:60px"><path d="M18 12 6 24l12 12z" fill="#2b2e31"/></svg></button>' +
    '<div style="flex:1;height:12px;border-radius:6px;background:#e3e3e3"><div class="lado-pos" style="width:30%;height:12px;border-radius:6px;background:#DD44DD"></div></div>' +
    '<button class="bt-icone" style="background:#f2f2f2" data-l="1"><svg viewBox="0 0 24 48" style="width:30px;height:60px"><path d="M6 12l12 12L6 36z" fill="#2b2e31"/></svg></button></div></div>' +
    '<div style="width:576px;padding:33px 36px;border-left:1px solid #e3e3e3"><div style="font-size:36px">Amplie o Lado <i style="font-style:normal;color:#8a8f94">(m)</i></div></div>' +
    '<div style="flex:1;display:flex;flex-direction:column;border-left:1px solid #e3e3e3"><button class="cancelar" style="flex:1;font-size:30px">' + ic("i-x") + '<br>Cancelar(R2)</button>' +
    '<button class="ok" style="flex:1;font-size:30px;border-top:1px solid #e3e3e3;color:#0ca35c">' + ic("i-check") + "<br>OK(R3)</button></div>";
  /* cada lado tem o seu valor (ed.lados {i: m}); as setas trocam o lado e o
     passo mostra e edita o valor dele (0,9 padrão). O recuo é para dentro e
     aparece ao vivo; Cancelar descarta, OK grava os lados com m > 0 */
  var antes = JSON.stringify(ed.lados || ladosTarefa(ed));
  ed.lados = JSON.parse(antes);
  ed.mostrarLado = ed.ladoIdx || 0;
  var valDe = function (i) { var v = Number(ed.lados[i]); return v > 0 ? v : 0.9; };
  var obj = { lado: valDe(ed.mostrarLado) };
  M.ladoVal = obj.lado; M.ajuste = "lados"; atualizarAlca(); desenharTudo();
  var ps = passoEd("", "", obj, "lado", .1, 1, 0, 100, function (v) { ed.lados[ed.mostrarLado] = v; M.ladoVal = v; });
  ps.querySelector(".rot").remove();
  ps.style.padding = "0";
  barra.children[1].appendChild(ps);
  $$("svg", barra).forEach(function (s) { if (!s.style.width) { s.style.width = "48px"; s.style.height = "48px"; } });
  PALCO.appendChild(barra);
  $$("[data-l]", barra).forEach(function (b) {
    b.addEventListener("click", function () {
      var n = Math.max(1, ed.limite.length);
      ed.mostrarLado = (ed.mostrarLado + Number(b.dataset.l) + n) % n;
      obj.lado = valDe(ed.mostrarLado); M.ladoVal = obj.lado;
      $(".val", ps).textContent = num(obj.lado, 1);
      $(".lado-pos", barra).style.width = ((ed.mostrarLado + 1) / n * 100) + "%";
      desenharTudo();
    });
  });
  var fechar = function () { ed.mostrarLado = null; M.ladoVal = null; M.ajuste = null; barra.remove(); montar(); };
  $(".cancelar", barra).addEventListener("click", function () { ed.lados = JSON.parse(antes); fechar(); });
  $(".ok", barra).addEventListener("click", function () {
    ed.lados[ed.mostrarLado] = obj.lado;
    var limpo = {};
    Object.keys(ed.lados).forEach(function (i) { if (Number(ed.lados[i]) > 0 && Number(i) < ed.limite.length) limpo[i] = Number(ed.lados[i]); });
    ed.lados = limpo; ed.ladoIdx = ed.mostrarLado; ed.modoMargem = "Um lado";
    fechar();
  });
}

/* Segmentação de rota (26/10/2026, fotos do controle real): barra de baixo com uma régua de 0 a 100 % e duas alças (verde = início da
   rota, laranja = fim; a ativa tem contorno verde); - / + ajustam a alça ativa 0,1 %. O que fica fora das alças sai da aplicação: no mapa
   vira linha cinza (desenharTudo) e a rota só voa as passadas de dentro (gerador, passo 3; o jogo corta igual). Cancelar volta ao que era. */
function abrirSegmentacao() {
  var ed = M.ed;
  if (!ed || M.ajuste) return;
  var antes = (ed.seg || [0, 100]).slice(), v = antes.slice(), sel = 0, GAP = .1, X0 = 190, PX = 11;   // 11 px por 1 %
  ed.seg = v;
  M.ajuste = "segmentacao"; M.painel = false;
  montar();
  var barra = el("div", "", "");
  barra.style.cssText = "position:absolute;left:12px;top:949px;width:1896px;height:239px;background:#fff;border-radius:16px;z-index:70;display:flex;overflow:hidden";
  var abs = function (css, html, cls) { return '<div' + (cls ? ' class="' + cls + '"' : "") + ' style="position:absolute;' + css + '">' + (html || "") + "</div>"; };
  var hex = function (cor) {
    return '<svg viewBox="0 0 60 88" style="width:60px;height:88px;display:block;overflow:visible"><path class="cont" d="M15 3H45L57 20V68L45 85H15L3 68V20Z" fill="#fff" stroke="#9aa0a6" stroke-width="3"/>' +
      '<circle cx="30" cy="44" r="13" fill="' + cor + '"/></svg>';
  };
  var h = '<div class="area" style="position:relative;flex:1;height:100%">' +
    '<button class="bt-icone s-menos" style="position:absolute;left:36px;top:96px;width:84px;height:84px;background:#f2f2f2"></button>' +
    abs("left:" + X0 + "px;top:138px;width:" + (100 * PX) + "px;height:12px;border-radius:6px;background:#d6d9dc") +
    abs("top:138px;height:12px;background:#E0A81A", "", "faixa");
  [0, 25, 50, 75, 100].forEach(function (pc) {
    h += abs("left:" + (X0 + pc * PX - 1) + "px;top:112px;width:2px;height:18px;background:#9aa0a6");
    if (pc > 0 && pc < 100) h += abs("left:" + (X0 + pc * PX - 46) + "px;top:48px;width:92px;height:46px;border-radius:23px;background:#e9ebed;font-size:30px;line-height:46px;text-align:center;color:#444", pc + "%");
  });
  h += abs("top:100px;width:60px;height:88px", hex("#6DD400"), "s-alca s-ini") + abs("top:100px;width:60px;height:88px", hex("#F0AC00"), "s-alca s-fim") +
    abs("top:196px;width:160px;font-size:34px;line-height:40px;text-align:center;color:#444", "", "s-val s-val-ini") +
    abs("top:196px;width:160px;font-size:34px;line-height:40px;text-align:center;color:#444", "", "s-val s-val-fim") +
    '<button class="bt-icone s-mais" style="position:absolute;left:' + (X0 + 100 * PX + 54) + 'px;top:96px;width:84px;height:84px;background:#f2f2f2"></button>' +
    abs("left:120px;top:20px;width:" + (100 * PX + 140) + "px;height:200px;touch-action:none", "", "s-toque") +
    "</div>" +
    '<div style="width:420px;display:flex;flex-direction:column;border-left:1px solid #e3e3e3"><button class="cancelar" style="flex:1;font-size:30px">' + ic("i-x") + '<br>Cancelar(R2)</button>' +
    '<button class="ok" style="flex:1;font-size:30px;border-top:1px solid #e3e3e3;color:#0ca35c">' + ic("i-check") + "<br>OK(R3)</button></div>";
  barra.innerHTML = h;
  $$("svg", barra).forEach(function (s) { if (!s.style.width) { s.style.width = "48px"; s.style.height = "48px"; } });
  var bMenos = $(".s-menos", barra), bMais = $(".s-mais", barra), toque = $(".s-toque", barra), faixa = $(".faixa", barra);
  bMenos.innerHTML = '<svg viewBox="0 0 48 48" style="width:48px;height:48px"><path d="M10 24h28" stroke="#2b2e31" stroke-width="4" stroke-linecap="round"/></svg>';
  bMais.innerHTML = ic("i-mais").replace("<svg", '<svg style="width:48px;height:48px"');
  var alcas = [$(".s-ini", barra), $(".s-fim", barra)], vals = [$(".s-val-ini", barra), $(".s-val-fim", barra)];
  var pos = function (i, pct) {
    pct = Math.round(pct * 10) / 10;
    if (i === 0) v[0] = Math.max(0, Math.min(Math.round((v[1] - GAP) * 10) / 10, pct));
    else v[1] = Math.min(100, Math.max(Math.round((v[0] + GAP) * 10) / 10, pct));
  };
  var pintar = function () {
    [0, 1].forEach(function (i) {
      var x = X0 + v[i] * PX;
      alcas[i].style.left = (x - 30) + "px"; vals[i].style.left = (x - 80) + "px";
      vals[i].textContent = num(v[i], 1) + "%";
      var c = $(".cont", alcas[i]);
      c.setAttribute("stroke", sel === i ? "#1c9e5a" : "#9aa0a6"); c.setAttribute("stroke-width", sel === i ? "5" : "3");
      alcas[i].style.zIndex = sel === i ? "2" : "1";
    });
    faixa.style.left = (X0 + v[0] * PX) + "px"; faixa.style.width = ((v[1] - v[0]) * PX) + "px";
    bMenos.disabled = sel === 0 ? v[0] <= 0 : v[1] <= v[0] + GAP + 1e-9;
    bMais.disabled = sel === 0 ? v[0] >= v[1] - GAP - 1e-9 : v[1] >= 100;
    desenharTudo(); atualizarInfo();
  };
  var pct = function (cx) {
    var r = toque.getBoundingClientRect();
    return Math.max(0, Math.min(100, (120 + (cx - r.left) / (APP.escala || 1) - X0) / PX));
  };
  var arrasta = false, desvio = 0;
  toque.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    try { toque.setPointerCapture(e.pointerId); } catch (x) {}
    var q = pct(e.clientX);
    sel = Math.abs(q - v[0]) <= Math.abs(q - v[1]) ? 0 : 1;
    desvio = Math.abs(q - v[sel]) <= 3 ? q - v[sel] : 0;   // pegou na alça: ela não pula para o dedo
    arrasta = true; pos(sel, q - desvio); pintar();
  });
  toque.addEventListener("pointermove", function (e) { if (arrasta) { pos(sel, pct(e.clientX) - desvio); pintar(); } });
  ["pointerup", "pointercancel"].forEach(function (ev) { toque.addEventListener(ev, function () { arrasta = false; }); });
  var passo = function (sinal) {
    return function (n) {
      var antes = v[sel], s = n < 15 ? .1 : n < 40 ? 1 : 5;   // segurar o botão acelera
      pos(sel, antes + sinal * s);
      if (v[sel] === antes) return false;
      pintar();
    };
  };
  segurarBotao(bMenos, passo(-1));
  segurarBotao(bMais, passo(1));
  var fechar = function () { barra.remove(); M.ajuste = null; M.painel = true; montar(); };
  $(".cancelar", barra).addEventListener("click", function () { ed.seg = antes; fechar(); });
  $(".ok", barra).addEventListener("click", function () { ed.seg = [v[0], v[1]]; fechar(); });
  PALCO.appendChild(barra);
  pintar();
}

function abrirAngulo() {
  var ed = M.ed, graus = ed.angManual != null ? Math.round((ed.angManual * 180 / Math.PI + 90 + 360) % 180) : Math.round((anguloAuto(ed.limite) * 180 / Math.PI + 90 + 360) % 180);
  var p = $("#painel");
  M.ajuste = "angulo"; atualizarAlca();   // a alça some no ajuste de ângulo
  p.innerHTML = "";
  p.appendChild(el("div", "titulo", "Ângulo da rota"));
  var corpo = el("div", "rolagem");
  var auto = chave("Otimização automática", ed.angManual == null, function (v) { if (v) { ed.angManual = null; desenharTudo(); } });
  corpo.appendChild(auto);
  var dirTxt = function (g) { var n = ["N", "NbE", "NNE", "NEbN", "NE", "NEbE", "ENE", "EbN", "E", "EbS", "ESE", "SEbE", "SE", "SEbS", "SSE", "SbE", "S"]; return n[Math.round(g / 11.25) % 17]; };
  var comp = el("div", "", "");
  comp.style.cssText = "position:relative;width:408px;height:408px;margin:36px auto 0";
  var desenhar = function () {
    comp.innerHTML = '<svg viewBox="0 0 408 408" style="width:408px;height:408px"><circle cx="204" cy="204" r="190" fill="#f5f5f5"/>' +
      '<g transform="rotate(' + graus + ' 204 204)"><path d="M204 40v328" stroke="#00ad53" stroke-width="8"/><path d="M204 30l-18 30h36z" fill="#00ad53"/></g>' +
      '<text x="204" y="210" text-anchor="middle" font-size="60" font-weight="700" fill="#1f2224" font-family="Roboto,Noto Sans,sans-serif">' + graus + '°</text>' +
      '<text x="204" y="262" text-anchor="middle" font-size="34" fill="#666b70" font-family="Roboto,Noto Sans,sans-serif">' + dirTxt(graus) + "</text></svg>";
  };
  desenhar();
  corpo.appendChild(comp);
  var bots = el("div", "", "");
  bots.style.cssText = "display:flex;justify-content:center;gap:120px;margin-top:36px";
  [["−", -1], ["+", 1]].forEach(function (x) {
    bots.appendChild(botao("bt-icone", '<span style="font-size:60px;line-height:60px">' + (x[1] < 0 ? "↺" : "↻") + "</span>", function () {
      graus = (graus + x[1] + 180) % 180; ed.angManual = (graus - 90) * Math.PI / 180;
      $(".chave", auto).classList.remove("lig"); desenhar(); desenharTudo();
    }));
    bots.lastChild.style.background = "#f2f2f2";
  });
  corpo.appendChild(bots);
  p.appendChild(corpo);
  var rod = el("div", "botoes", "");
  rod.style.cssText = "display:flex;height:120px;border-top:1px solid #dcdcdc;flex:none";
  rod.innerHTML = '<button style="flex:1;font-size:36px">Cancelar(R2)</button><button style="flex:1;font-size:36px;color:#0ca35c;border-left:1px solid #dcdcdc">Sim(R3)</button>';
  rod.children[0].addEventListener("click", function () { M.ajuste = null; montar(); });
  rod.children[1].addEventListener("click", function () { M.ajuste = null; montar(); });
  p.appendChild(rod);
}

function painelMapRota(p) {
  var ed = M.ed;
  if (!ed.alturaMap) ed.alturaMap = 30;
  if (!ed.velMap) ed.velMap = 18;
  p.appendChild(el("div", "titulo", "Configurações da tarefa"));
  p.lastChild.style.height = "72px";
  var r = el("div", "rolagem");
  r.appendChild(el("div", "campo", '<div class="rot">Modo de rota</div>'));
  [["area", "Rota da área", "Mapeia toda a área. O mapeamento desse tipo de rota é demorado e de alta precisão"],
    ["fronteira", "Rota de fronteira", "Mapeia um limite da área com uma largura de 20m. O mapeamento deste tipo de rota é eficiente em termos de tempo e de precisão moderada"]]
    .forEach(function (x) {
      var b = botao("cartao-rota" + ((ed.rotaMap || "area") === x[0] ? " ativo" : ""), '<div class="cab"><i class="bolha"></i><span>' + x[1] + "</span>" +
        ic(x[0] === "area" ? "ic-somente-rota" : "ic-somente-fronteira", "0 0 24 24").replace("<svg", '<svg style="width:36px;height:36px"') + "</div><p>" + x[2] + "</p>",
        function () { ed.rotaMap = x[0]; montar(); });
      r.appendChild(b);
    });
  var res = el("div", "campo", '<div class="rot">Resolução</div>');
  res.appendChild(seg(["Médio", "Alta"], ed.res || "Médio", function (o) { ed.res = o; }));
  r.appendChild(res);
  r.appendChild(el("p", "", "A reconstrução de alta resolução (2K) produz imagens de alta qualidade, mas é mais demorada do que a reconstrução de média resolução (1K)"));
  r.lastChild.style.cssText = "margin:12px 24px;font-size:30px;line-height:45px;color:#666b70";
  r.appendChild(passoEd("Altura do mapeamento", "m", ed, "alturaMap", 1, 0, 20, 60, function () { atualizarInfo(); }));
  r.appendChild(passoEd("Velocidade do voo", "km/h", ed, "velMap", 1, 0, 3.6, 25.2, function () { atualizarInfo(); }));
  p.appendChild(r);
}

/* ------------------------------------------------------------ execução */
function usar(t) {
  if (!t) return;
  if (ehMapeamento(t.modo) && !mapeamentoDisponivel()) return toast("Mapeamento disponível somente para administrador");
  /* pela aba "Em andamento": continua de onde parou (o feito fica cinza e o
     Iniciar vai direto ao último ponto). Pela aba "Tarefa": começa do zero,
     mapa limpo como na primeira vez */
  var pr = !ehMapeamento(t.modo) && M.aba === "Em andamento" ? M.prog[t.id] : null;
  if (!pr) { delete M.prog[t.id]; salvarProg(); apagarTrilha(); }
  M.exec = t; M.sub = "execucao"; M.painel = true; M.abaExec = "Tarefa";
  if (M.andamento.indexOf(t.id) < 0) { M.andamento.unshift(t.id); salvarTarefas(); }
  /* a magenta nasce no "Use", saindo do drone parado no chão (g6 #0139) */
  M.voo = novoVoo(t);
  enviarTalhao(t);
  if (pr) {
    M.voo.cinzaIni = pr.cinza || null;       // entra quando a rota nova chegar (atualizarVoo)
    trilhaParaCinza();
    if (pr.ret && pr.ret.p) cmd("retomarDe", { i: pr.ret.i, p: pr.ret.p });
  }
  enviarP();
  montar();
}
/* guarda o progresso da tarefa em execução (chamado a cada estado) */
var progGuardadoEm = 0;
function guardarProgresso(E) {
  var t = M.exec, V = M.voo;
  if (!t || !V || V.id !== t.id || !E || !E.v) return;
  var v = E.v, R = E.rota, pr = M.prog[t.id] || {};
  if (E.ret && E.ret.c) pr.ret = { i: E.ret.ci, p: E.ret.c };
  else if (v.retomar && v.retomar.p) pr.ret = { i: v.retomar.i, p: v.retomar.p };
  else if (v.estado === "aplicando" && E.d && R && typeof R.feitos === "number") pr.ret = { i: R.feitos, p: [E.d.x, E.d.z] };
  if (V.cinza) pr.cinza = V.cinza;
  if (!pr.ret && !pr.cinza) return;
  /* o cinza mudou (pausa, RTH, Encerrar): guarda na hora; o ponto, a cada 2 s */
  var cz = JSON.stringify(pr.cinza || null), novoCinza = cz !== pr.cz;
  pr.cz = cz;
  M.prog[t.id] = pr;
  if (novoCinza || Date.now() - progGuardadoEm > 2000) { progGuardadoEm = Date.now(); salvarProg(); }
}
/* tarefa concluída: sai de "Em andamento" e esquece o progresso */
function tarefaConcluida(t) {
  if (!t) return;
  delete M.prog[t.id]; salvarProg();
  M.andamento = M.andamento.filter(function (x) { return x !== t.id; }); salvarTarefas();
}
/* estado da tarefa em execução (ANALISE_LINHAS 7), só na memória */
function novoVoo(t) {
  var E = APP.E, chao = !noAr(E);
  return { id: t.id, chave: "", origem: E && E.d && chao ? [E.d.x, E.d.z] : E && E.b ? [E.b.x, E.b.z] : null, con: [], passados: {},
    magIda: true, fase: "chao", pausaDesde: 0, cinza: null, trabalhou: false, concluiu: false, conDaRota: false, t: 0 };
}
/* o talhão vai ao jogo, em metros. lim = área já recuada pela margem; obs e
   circ crus (a folga vai em geo); geo leva o resto do gerador novo: com ele o
   jogo gera a MESMA rota da prévia (rotaDoAppNoJogo). Jogo antigo ignora geo */
function enviarTalhao(t) {
  var lim = ehMapeamento(t.modo) ? t.limite : areaTarefa(t);
  if (!lim || lim.length < 3) return;
  var obs = obsDaTarefa(t);
  cmd("talhao", { lim: lim, obs: obs.filter(function (o) { return o.tipo !== "circulo"; }).map(function (o) { return o.pts; }),
    circ: obs.filter(function (o) { return o.tipo === "circulo"; }).map(function (o) { return { c: o.c, r: o.r }; }),
    esp: t.esp, ang: t.ang, seg: t.seg, cob: t.cob, sentido: t.sentido,
    geo: { map: ehMapeamento(t.modo) ? rotaDeMapeamento(t) : null, mapeamento: ehMapeamento(t.modo) ? parametrosMapa(t) : null, v: 1, laco: 1.5, folgaLig: 0, folgaObs: folgaObsTarefa(t), sem: semDaTarefa(t),
      con: M.voo && M.voo.id === t.id ? M.voo.con : [],
      chave: lim.length + "|" + lim[0][0].toFixed(2) + "|" + lim[0][1].toFixed(2) } });
}
/* fase da tarefa (não usar faseVoo): chao | ida | trabalho | pausa | concluida */
function faseTarefa(E, R) {
  var V = M.voo, v = E && E.v;
  if (!v) return "chao";
  var est = v.estado, tem = !!v.temRota;
  if (V && V.trabalhou && ((R && R.r && R.feitos >= R.r.length) || est === "concluído")) return "concluida";
  if (est === "em solo" || est === "concluído") return "chao";
  /* subindo/indo com rota é a retomada depois de uma pausa; antes de
     trabalhar é a ida do começo (o decolar() do campo também grava retomar) */
  if ((est === "manual" && tem) || est === "voltando" || est === "pousando" || est === "reabastecendo" ||
      ((est === "subindo" || est === "indo") && tem && V && V.trabalhou)) return "pausa";
  if (V && V.magIda) return noAr(E) ? "ida" : "chao";
  return "trabalho";
}
/* o maior dos dois pontos de corte {i, p} (trecho i = r[i-1] -> r[i]) */
function cinzaMaior(a, b, r) {
  if (!a) return b;
  if (!b) return a;
  if (b.i !== a.i) return b.i > a.i ? b : a;
  if (!r || b.i < 1 || b.i >= r.length) return b;
  return projecaoT(b.p, r[b.i - 1], r[b.i]) >= projecaoT(a.p, r[b.i - 1], r[b.i]) ? b : a;
}
/* a cada estado novo na execução: magenta da ida, pontos passados, cinza da pausa */
function atualizarVoo(E) {
  if (M.sub !== "execucao" || !M.exec || !E) return;
  if (!M.voo || M.voo.id !== M.exec.id) M.voo = novoVoo(M.exec);
  var V = M.voo;
  if (E.t === V.t) return;
  V.t = E.t;
  if (!V.origem && E.d && !noAr(E)) V.origem = [E.d.x, E.d.z];
  var R = E.rota, r = R && R.r && R.r.length > 1 ? R.r : null;
  if (r) {
    var ch = r.length + ":" + r[0][0] + ":" + r[0][1];
    if (ch !== V.chave) {
      V.chave = ch; V.magIda = true; V.passados = {};
      /* tarefa retomada de "Em andamento": o cinza guardado volta já na rota nova */
      V.cinza = V.cinzaIni || null; V.trabalhou = !!V.cinzaIni; V.cinzaIni = null;
      /* app recarregado ou execução reaberta no meio da tarefa: os pontos de
         conexão só ficaram na rota do jogo (tipo 4, no começo); refeitos dela */
      if (!V.con.length || V.conDaRota) {
        var cr = [];
        for (var ic = 0; ic < r.length && r[ic][3] === 4; ic++) cr.push([r[ic][0], r[ic][1]]);
        if (cr.length || V.conDaRota) { V.con = cr; V.conDaRota = true; }
      }
    }
    var i0 = primeiroDaRota(r);
    if (V.magIda && i0 < r.length && E.d && (Math.hypot(E.d.x - r[i0][0], E.d.z - r[i0][1]) < 1 || (R.feitos || 0) > i0)) V.magIda = false;
  }
  var fase = faseTarefa(E, r ? R : null);
  var est = E.v ? E.v.estado : "";
  /* decolou de novo depois de concluir, sem novo "Use": começa do zero */
  if (fase === "concluida") {
    /* só sai de "Em andamento" se a rota foi feita até o fim: depois do
       Encerrar o jogo também pousa como "concluído", e aí o progresso fica */
    if (!V.concluiu && R && R.r && R.feitos >= R.r.length) tarefaConcluida(M.exec);
    V.concluiu = true;
  }
  else if (V.concluiu && est !== "voltando" && est !== "pousando" && (est === "subindo" || est === "indo" || est === "aplicando" || noAr(E))) {
    V.concluiu = false; V.magIda = true; V.passados = {}; V.cinza = null; V.trabalhou = false;
    if (E.d) V.origem = [E.d.x, E.d.z];
    fase = faseTarefa(E, r ? R : null);
  }
  if (!V.trabalhou && est === "aplicando" && !V.magIda) {
    V.trabalhou = true;
    if (!M.exec.executada) { M.exec.executada = true; salvarTarefas(); }
  }
  if (fase === "pausa" && V.fase !== "pausa") {
    /* entrou em pausa/RTH: o feito até aqui fica cinza (e continua cinza nos
       voos seguintes). Antes de pulverizar não há feito: sem cinza */
    V.pausaDesde = Date.now(); V.passados = {}; V.retAlvo = null;   // a janelinha volta ao padrão
    /* o C na rota (E.ret.c, sem o desvio do GNSS); app antigo: o do jogo */
    var rt = E.ret && E.ret.c ? { i: E.ret.ci, p: E.ret.c } : E.v && E.v.retomar;
    var ret = rt && rt.p ? { i: Number(rt.i) || 0, p: [rt.p[0], rt.p[1]] } : r && E.d ? { i: Math.max(0, R.feitos || 0), p: [E.d.x, E.d.z] } : null;
    if (ret && V.trabalhou) V.cinza = cinzaMaior(V.cinza, ret, r);
  }
  /* pontos de conexão passados: na ida e no translado da retomada (pausa,
     subindo/indo), a menos de 1,5 m; a entrada na pausa zera (g6 #0201, #0235) */
  if (E.d && (V.magIda && fase !== "pausa" || fase === "pausa" && (est === "subindo" || est === "indo")))
    V.con.forEach(function (c, j) { if (Math.hypot(E.d.x - c[0], E.d.z - c[1]) < 1.5) V.passados[j] = true; });
  V.fase = fase;
  if (!V.concluiu) guardarProgresso(E);
}
function enviarP() {
  var P = M.P;
  if (M.exec && ehMapeamento(M.exec.modo)) {
    cmd("p", { v: { xgPulverizar: false } });
    return;
  }
  var tetoAlt = P.desvio ? 8 : 15;
  if (P.altura > tetoAlt) { P.altura = tetoAlt; salvarP(); }
  cmd("p", { v: { vazao: P.taxa, vel: P.vel / 3.6, altura: P.altura, gota: P.gota, rth: P.rthAlt, rthVel: P.rthVel / 3.6, terreno: P.terreno,
    desvio: P.desvio, estab: P.estab, xgContornar: P.contornar, xgEspMmais: P.espMmais, xgPulverizar: M.exec && ehMapeamento(M.exec.modo) ? false : P.sistemas } });
}
function fluxoCalc() { var t = M.exec || {}; return M.P.taxa * (t.esp || (M.modo === "manual" && M.abaMan === "M+" && Number(M.P.espMmais)) || 6) * M.P.vel / 600; }

function painelExecucao(p) {
  var pil = el("div", "pilula");
  ["Tarefa", "Voo"].forEach(function (a) { pil.appendChild(botao(M.abaExec === a ? "ativo" : "", a, function () { M.abaExec = a; montar(); })); });
  p.appendChild(pil);
  p.appendChild(el("div", "divisor"));
  var r = el("div", "rolagem");
  if (M.exec && ehMapeamento(M.exec.modo)) {
    r.appendChild(el("div","titulo","Mapeamento aéreo"));
    r.appendChild(el("div","campo","Área: " + num(areaHa(M.exec.limite),2) + " ha"));
    r.appendChild(el("div","campo",M.exec.rotaMap === "fronteira" ? "Rota de fronteira" : "Rota da área"));
    r.appendChild(el("div","campo","Altura: " + num(M.exec.alturaMap || 30, 0) + " m"));
    r.appendChild(el("div","campo","Velocidade: " + num(M.exec.velMap || 18, 1) + " km/h"));
    r.appendChild(el("div","campo","Resolução: " + (M.exec.res === "Alta" ? "2K" : "1K")));
  } else if (M.abaExec === "Tarefa") abaTarefa(r, false);
  else abaVoo(r);
  p.appendChild(r);
}
function abaTarefa(r, manual) {
  var g = el("div", "gabarito", '<button class="sel">Nenhum gabarito aplicado' + ic("i-abaixo") + '</button><button class="reset">' + ic("i-reset") + "</button>");
  g.style.paddingTop = "24px";
  r.appendChild(g);
  var fl = el("div", "lin-info", "<span>Fluxo</span><b>" + num(fluxoCalc()) + "L/Min</b>");
  var mudou = function () { $("b", fl).textContent = num(fluxoCalc()) + "L/Min"; enviarP(); atualizarInfo(); };
  if (manual && M.abaMan === "M") {
    /* o Fluxo do M é o mesmo da roda esquerda (L/min, xgPulvManual.fluxo do
       jogo): vai pelo comando fluxoM e volta no estado (E.fm). Não mexe na
       taxa da Rota (P.vazao) */
    var cFm = passo("Fluxo", "L/Min", "fluxoM", .5, 1, 1, 16, function (nv) { M.fluxoMQuando = Date.now(); cmd("fluxoM", { v: nv }); });
    cFm.setAttribute("data-fluxo-m", "");
    r.appendChild(cFm);
  } else {
    r.appendChild(passo("Taxa de aplicação", "L/Ha", "taxa", .5, 1, 1, 200, mudou));
    r.appendChild(fl);
  }
  var gota = el("button", "lin-link", '<span>Tamanho da gota de pulverização</span><em>' + M.P.gota + " μm</em>" + ic("i-direita"));
  gota.addEventListener("click", abrirGota);
  r.appendChild(gota);
  if (manual && M.abaMan === "M") {
    r.appendChild(chave("Velocidade máxima de voo <i style=\"font-style:normal;color:#8a8f94;font-size:30px\">(km/h)</i>", M.P.velMaxLig, function (v) { M.P.velMaxLig = v; salvarP(); }));
    return;
  }
  r.appendChild(passo("Velocidade do voo", "km/h", "vel", .1, 1, 1, 36, mudou));
  /* T50: com o desvio de obstáculos multidirecional ligado, até 8 m; desligado, até 15 m */
  r.appendChild(passo("Altura acima das culturas", "m", "altura", .1, 1, 1.5, M.P.desvio ? 8 : 15, mudou));
  if (!manual) {
    var t = M.exec;
    if (t) r.appendChild(passoEd("Espaçamento de rota", "m", t, "esp", .01, 2, 1.6, 59.03, function () { salvarTarefas(); cmd("p", { v: { faixa: t.esp } }); mudou(); }));
  } else if (M.abaMan === "M+") {
    /* M+: separação das faixas tracejadas (6,0 m padrão) */
    r.appendChild(passo("Espaçamento de rota", "m", "espMmais", .01, 2, 1.6, 59.03, function () { desenharAero(); mudou(); }));
  }
  r.appendChild(chave("Subida em baixa velocidade <i style=\"font-style:normal;color:#8a8f94;font-size:30px\">(m)</i>", M.P.subidaBaixa, function (v) { M.P.subidaBaixa = v; salvarP(); }));
}
function chaveDesvio(rot, campo, iconeSvg) {
  return chave(rot, M.P[campo], function (v, aplicar) {
    if (campo === "contornar" && v) {
      dialogo({ icone: "alerta", titulo: "Habilitando o desvio de obstáculos",
        itens: [{ t: "Evite usar em clima chuvoso ou quando houver linhas de energia, galhos de árvores ou outros pequenos obstáculos", verm: true },
          { t: "Mantenha os sensores de visão binocular limpos para evitar obstáculos com mais eficiência" }],
        botoes: [{ t: "Agora não(R2)" }, { t: "Habilitar(R3)", cls: "verde", fn: function () {
          M.P.contornar = true; if (M.P.altura > 8) M.P.altura = 8; salvarP(); enviarP(); aplicar(); montarPainel();
        } }] });
      return false;
    }
    M.P[campo] = v; salvarP(); enviarP();
  }, '<svg viewBox="0 0 48 48" style="width:48px;height:48px">' + iconeSvg + "</svg>");
}
function abaVoo(r) {
  var c = el("div", "campo", '<div class="rot">Cenário</div>');
  var mapa = { "Planícies": "planicie", "Pomar / Colina": "montanha", "Acima da água": "agua" };
  var atual = Object.keys(mapa).filter(function (k) { return mapa[k] === M.P.terreno; })[0];
  c.appendChild(seg(["Planícies", "Pomar / Colina", "Acima da água"], atual, function (o) { M.P.terreno = mapa[o]; salvarP(); enviarP(); }, true,
    ["i-sat", "i-sat", "i-sat"]));
  $$("svg", c).forEach(function (s, i) {
    s.innerHTML = ['<g fill="#2b2e31"><rect x="6" y="6" width="16" height="16" rx="2"/><rect x="26" y="6" width="16" height="16" rx="2"/><rect x="6" y="26" width="16" height="16" rx="2"/><rect x="26" y="26" width="16" height="16" rx="2"/></g>',
      '<path d="M24 4 38 26h-8l6 12H12l6-12h-8z" fill="#2b2e31"/><rect x="22" y="38" width="4" height="8" fill="#2b2e31"/>',
      '<path d="M4 16c6-6 12-6 20 0s14 6 20 0M4 26c6-6 12-6 20 0s14 6 20 0M4 36c6-6 12-6 20 0s14 6 20 0" fill="none" stroke="#2b2e31" stroke-width="3.4" stroke-linecap="round"/>'][i];
  });
  r.appendChild(c);
  r.appendChild(passo("Roteamento de conexão e velocidade RTH", "km/h", "rthVel", 1, 1, 10.8, 36, function (v) {
    if (v > 25.2 && !M.okVel) {
      dialogo({ icone: "alerta", titulo: "Definir a velocidade de voo acima de 25,2 km/h pode afetar a segurança do voo. Continuar?",
        botoes: [{ t: "Cancelar(R2)", fn: function () { M.P.rthVel = 25.2; salvarP(); montarPainel(); } }, { t: "OK(R3)", cls: "verde", fn: function () { M.okVel = true; enviarP(); } }] });
      return;
    }
    enviarP();
  }));
  r.appendChild(passo("Roteamento de conexão e altitude RTH", "m", "rthAlt", 1, 0, 3, 30, enviarP));
  var rb = el("button", "lin-link", '<span>Retorno à base automático<br><em style="font-weight:400">Totalmente ativado</em></span>' + ic("i-direita"));
  r.appendChild(rb);
  r.appendChild(chaveDesvio("desvio de obstáculos multidirecional", "desvio", '<circle cx="24" cy="24" r="16" fill="none" stroke="#2b2e31" stroke-width="3.4"/><circle cx="24" cy="24" r="6" fill="#2b2e31"/>'));
  r.appendChild(chaveDesvio("Estabilização da altitude", "estab", '<circle cx="24" cy="12" r="5" fill="#2b2e31"/><path d="M10 26a20 20 0 0 1 28 0M16 33a10 10 0 0 1 16 0" fill="none" stroke="#2b2e31" stroke-width="3.4" stroke-linecap="round"/>'));
  r.appendChild(chaveDesvio("Desvio de obstáculos", "contornar", '<path d="M24 6v24M14 20l10 10 10-10M8 40h32" fill="none" stroke="#2b2e31" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'));
}

function abrirGota() {
  /* "Tamanho da gota de pulverização" (gravação 4/119): régua vertical de 500
     a 50 μm, categorias em etiquetas à direita, valor em cima e Aplicar */
  var p = $("#painel"), escolha = M.P.gota, MIN = 50, MAX = 500, TOPO = 120, ALT = 560;
  p.innerHTML = "";
  p.appendChild(el("div", "", '<div style="display:flex;gap:24px;padding:30px 24px 0">' +
    '<b style="flex:1;font-size:36px;line-height:48px">Tamanho da gota de pulverização</b>' +
    '<span style="width:110px;font-size:34px;line-height:48px;color:#8a8f94">Categorias antigas</span>' +
    '<svg viewBox="0 0 48 48" style="width:44px;height:44px;margin-top:30px"><path d="M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z" fill="none" stroke="#8a8f94" stroke-width="3.4"/><circle cx="24" cy="24" r="6" fill="none" stroke="#8a8f94" stroke-width="3.4"/><path d="M8 40 40 8" stroke="#8a8f94" stroke-width="3.4"/></svg></div>' +
    '<p style="margin:18px 24px 0;font-size:36px;line-height:50px">Configuração atual:<span style="color:#0ca35c">Camada dupla (padrão)</span></p>' +
    '<div style="height:1px;background:#dcdcdc;margin-top:24px"></div>'));
  var v = el("div", "", "");
  v.style.cssText = "flex:1;position:relative;overflow:hidden";
  var cats = [["Muito grosso", "#1fae55", 450], ["Grosso", "#2a8bf0", 350], ["Médio", "#f0c419", 250], ["Fino", "#f08a24", 150], ["Muito fino", "#e5372e", 75]];
  var y = function (val) { return TOPO + (MAX - val) / (MAX - MIN) * ALT; };
  var desenhar = function () {
    v.innerHTML = '<div style="position:absolute;left:0;right:0;top:24px;text-align:center"><b style="font-size:56px">' + escolha + '</b><i style="font-style:normal;font-size:36px"> μm</i></div>' +
      '<span style="position:absolute;left:220px;top:' + (TOPO - 50) + 'px;font-size:32px;color:#8a8f94">' + MAX + '</span>' +
      '<span style="position:absolute;left:236px;top:' + (TOPO + ALT + 6) + 'px;font-size:32px;color:#8a8f94">' + MIN + "</span>" +
      '<i class="trilho-gota" style="position:absolute;left:246px;top:' + TOPO + 'px;width:12px;height:' + ALT + 'px;border-radius:6px;background:#e3e3e3"></i>' +
      '<i style="position:absolute;left:228px;top:' + (y(escolha) - 24) + 'px;width:48px;height:48px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></i>' +
      cats.map(function (c) {
        return '<button data-v="' + c[2] + '" style="position:absolute;left:300px;top:' + (y(c[2]) - 36) + 'px;display:flex;align-items:center;gap:18px">' +
          '<i style="width:14px;height:14px;border-radius:50%;background:' + c[1] + '"></i><span style="padding:6px 12px;border-radius:8px;background:#ececec;font-size:32px;line-height:40px;max-width:150px;text-align:left">' + c[0] + "</span></button>";
      }).join("");
    $$("[data-v]", v).forEach(function (b) { b.addEventListener("click", function () { escolha = Number(b.dataset.v); desenhar(); }); });
  };
  var arrastar = function (e) {
    var r = v.getBoundingClientRect(), py = (e.clientY - r.top) / APP.escala;
    escolha = Math.round(Math.max(MIN, Math.min(MAX, MAX - (py - TOPO) / ALT * (MAX - MIN))) / 10) * 10;
    desenhar();
  };
  v.addEventListener("pointerdown", function (e) {
    var r = v.getBoundingClientRect(), px = (e.clientX - r.left) / APP.escala;
    if (px > 290) return;
    v.setPointerCapture(e.pointerId); arrastar(e); v.onpointermove = arrastar;
  });
  v.addEventListener("pointerup", function () { v.onpointermove = null; });
  desenhar();
  p.appendChild(v);
  var ap = botao("", "Aplicar", function () { M.P.gota = escolha; salvarP(); enviarP(); montar(); });
  ap.style.cssText = "height:120px;flex:none;font-size:40px;font-weight:700;color:#0ca35c;border-top:1px solid #dcdcdc";
  p.appendChild(ap);
}

/* desloca o talhão inteiro (limite, obstáculos, áreas sem aplicação, marcas) */
function deslocarTarefa(t, dx, dz) {
  if (!t || (!dx && !dz)) return;
  var mv = function (p) { return [p[0] + dx, p[1] + dz]; };
  if (t.limite) t.limite = t.limite.map(mv);
  (t.obs || []).forEach(function (o) { if (o.pts) o.pts = o.pts.map(mv); if (o.c) o.c = mv(o.c); });
  if (t.marcas) t.marcas = t.marcas.map(function (m) { return m && m.length >= 2 ? mv(m) : m; });
}

/* Retificar a compensação: o mapa do campo ficou deslocado do lugar de
   verdade (GNSS sem RTK, mapa feito em outro dia): cada seta empurra o talhão
   inteiro 0,1 m naquela direção (para cima = norte), o mapa mostra na hora e
   "Sim" grava e manda o talhão novo para a aeronave. "Cancelar" desfaz. */
function abrirRetificar() {
  var t = M.exec;
  if (!t) return;
  var p = $("#painel"), ox = 0, oz = 0, PASSO = 0.1;
  M.painel = true; document.body.classList.add("painel-aberto"); p.classList.add("ativo");
  p.innerHTML = "";
  p.appendChild(el("div", "titulo", "Retificar a compensação"));
  p.lastChild.style.cssText = "height:72px;padding:12px 24px 0;text-align:left;font-size:34px";
  var area = el("div", "", "");
  area.style.cssText = "flex:1;position:relative";
  var mexer = function (dx, dz) {
    deslocarTarefa(t, dx, dz);
    ox = Math.round((ox + dx) * 100) / 100; oz = Math.round((oz + dz) * 100) / 100;
    desenhar(); desenharTudo(); atualizarInfo();
  };
  var desenhar = function () {
    var dist = Math.hypot(ox, oz);
    area.innerHTML = '<svg viewBox="0 0 408 408" style="position:absolute;left:36px;top:84px;width:408px;height:408px"><circle cx="204" cy="204" r="200" fill="#f8f8f8"/><circle cx="204" cy="204" r="120" fill="#fff"/>' +
      '<g fill="#00ad53"><path d="M204 30l-18 28h36z"/><path d="M204 378l-18-28h36z"/><path d="M30 204l28-18v36z"/><path d="M378 204l-28-18v36z"/></g></svg>' +
      '<div style="position:absolute;left:0;width:480px;top:250px;text-align:center"><b style="font-size:56px">' + dist.toFixed(1) + '</b><i style="font-style:normal;font-size:30px"> m</i>' +
      '<div style="font-size:30px;color:#666b70;margin-top:6px">Distância ajustada</div></div>';
    /* para cima = norte (-z no mapa), baixo = sul, esquerda = oeste (-x), direita = leste */
    [[204, 44, 0, -PASSO], [204, 364, 0, PASSO], [44, 204, -PASSO, 0], [364, 204, PASSO, 0]].forEach(function (pt) {
      var b = el("button", "", "");
      b.style.cssText = "position:absolute;left:" + (36 + pt[0] - 60) + "px;top:" + (84 + pt[1] - 60) + "px;width:120px;height:120px";
      b.addEventListener("click", function () { mexer(pt[2], pt[3]); });
      area.appendChild(b);
    });
  };
  desenhar();
  p.appendChild(area);
  var rod = el("div", "", '<button style="flex:1;font-size:36px">Cancelar(R2)</button><button style="flex:1;font-size:36px;color:#0ca35c;border-left:1px solid #dcdcdc">Sim(R3)</button>');
  rod.style.cssText = "display:flex;height:120px;border-top:1px solid #dcdcdc;flex:none";
  rod.children[0].addEventListener("click", function () {
    deslocarTarefa(t, -ox, -oz);            // desfaz
    desenharTudo(); montar();
  });
  rod.children[1].addEventListener("click", function () {
    if (ox || oz) {
      /* a mesma tarefa na lista guardada também anda (M.exec pode ser cópia) */
      var g = tarefaPorId(t.id);
      if (g && g !== t) deslocarTarefa(g, ox, oz);
      salvarTarefas();
      enviarTalhao(t);
      avisoInfo("Compensação retificada em " + Math.hypot(ox, oz).toFixed(1) + " m");
    }
    montar();
  });
  p.appendChild(rod);
}

/* Iniciar: gente/obstáculo perto pede confirmação, como o aparelho */
function iniciarComConferencia(aoConfirmar, aoFim) {
  var E = APP.E;
  if (!APP.conectado) return toast("Aeronave desconectada");
  if (ehMapeamento(M.modo) && !mapeamentoDisponivel()) return toast("Mapeamento disponível somente para administrador");
  if (ehMapeamento(M.modo) && !rtkAtivo()) return toast("Ative o Posicionamento RTK para iniciar o mapeamento");
  if (ehMapeamento(M.modo) && !tanqueVazioParaMapear()) return toast("Esvazie o tanque para iniciar o mapeamento");
  var perto = Infinity;
  (E && E.radar || []).forEach(function (s) { perto = Math.min(perto, s[1]); });
  var ir = function () {
    if (typeof aoConfirmar === "function") aoConfirmar();
    if (M.modo === "manual") return;      // no M decola pelo CSC (sem meta-texto na tela)
    verificacao(aoFim);
  };
  if (perto < 6 && E.v && E.v.estado === "em solo") {
    dialogo({ largura: 1200, html: '<div style="display:flex;align-items:center;gap:36px;background:#f5f5f5;border-radius:16px;padding:24px;margin-bottom:24px">' +
      '<svg viewBox="0 0 120 60" style="width:300px;height:150px;flex:none"><ellipse cx="54" cy="44" rx="48" ry="12" fill="none" stroke="#f08a24" stroke-width="2"/>' +
      '<ellipse cx="54" cy="44" rx="30" ry="7" fill="rgba(240,138,36,.18)"/><g fill="#3c4245"><rect x="40" y="26" width="28" height="9" rx="3"/></g>' +
      '<path d="M30 24h14M64 24h14" stroke="#3c4245" stroke-width="3"/><g fill="#e8442e"><circle cx="100" cy="16" r="5"/><rect x="95" y="22" width="10" height="20" rx="3"/></g></svg>' +
      '<b style="font-size:40px;text-align:left">Pessoa/obstáculo detectado em um 6.0m raio</b></div>',
      texto: "Confirme se os avisos estão liberados e pressione os pinos de controle para decolar",
      botoes: [{ t: "Cancelar(R2)" }, { t: "Confirmar(R3)", cls: "verm", fn: ir }] });
    return;
  }
  ir();
}

/* --------------------------------------------------------- modo manual */
function painelManual(p) {
  var abas = el("div", "abas");
  abas.style.height = "96px";
  ["M", "M+"].forEach(function (a) { abas.appendChild(botao(M.abaMan === a ? "ativa" : "", a, function () { M.abaMan = a; montar(); })); });
  p.appendChild(abas);
  var pil = el("div", "pilula");
  ["Tarefa", "Voo"].forEach(function (a) { pil.appendChild(botao(M.abaExec === a ? "ativo" : "", a, function () { M.abaExec = a; montar(); })); });
  p.appendChild(pil);
  p.appendChild(el("div", "divisor"));
  var r = el("div", "rolagem");
  if (M.abaExec === "Tarefa") abaTarefa(r, true); else abaVoo(r);
  p.appendChild(r);
}

/* ------------------------------------------------- ferramentas do mapa */
$$(".bt-f").forEach(function (b) {
  b.addEventListener("click", function (e) {
    e.stopPropagation();
    var f = b.dataset.f;
    if (f === "camadas") return abrirTipoMapa();
    if (f === "prescricao") return abrirPrescricao();
    if (f === "regua") {
      M.regua = M.regua ? null : [];
      b.classList.toggle("ativo", !!M.regua);
      if (M.regua && !limiteRegua()) toast("Toque no mapa para medir a distância");
      desenharTudo();
      return;
    }
    if (f === "borracha") {
      /* 26/10/2026 (Eduardo): a borracha do topo só limpa o rastro do voo (gsCleanAirline) e zera a régua, em qualquer tela;
         na edição ela desfazia o último ponto/Redondo, o que o controle de verdade não faz. Na edição só o "Excluir" do painel do Redondo apaga
         (apagar ponto de limite/marca fica sem botão até ele dizer como é no aparelho). */
      apagarTrilha();
      M.regua = M.regua ? [] : null; desenharTudo();
      return;
    }
    if (f === "local") {
      var E = APP.E, alvo = E && (E.d ? [E.d.x, E.d.z] : E.b ? [E.b.x, E.b.z] : null);
      if (alvo) { var px = paraPx(alvo[0], alvo[1]); centrarEm(px[0], px[1]); }
      return;
    }
    if (f === "trava") { M.seguir = !M.seguir; b.classList.toggle("ativo", M.seguir); toast(M.seguir ? "Mapa centralizado na aeronave" : "Mapa livre"); }
  });
});

function fecharFlutuantes() { $$(".janelinha,.tipo-mapa").forEach(function (j) { j.remove(); }); }

/* ---------------------------------- janelinha "Retornar à" (piloto nº 38)
   Rota pausada no manual: à direita, a escolha do ponto de retomada (g6
   #0174; video_2_retornar_a). Na pausa normal: Ponto de interrupção (padrão)
   e os pontos de retorno 1 e 2 que existirem; na subida/ida do começo:
   Ponto de conexão (se houver) e Ponto inicial. Toca-se na linha para
   escolher; não se toca nas bolinhas do mapa. O HTML só é refeito quando
   muda a chave (opções e seleção): os toques não se perdem. */
function opcoesRetorno(E) {
  var ret = E && E.ret, V = M.voo;
  var ida = ret ? !!ret.ida : !(V && V.trabalhou);
  var ops;
  if (ida) {
    ops = [];
    var temCon = ret ? ret.con > 0 : !!(V && V.con && V.con.length);
    if (temCon) ops.push({ id: "conexao", t: "Ponto de conexão", cor: "#CC11E4" });
    ops.push({ id: "inicio", t: "Ponto inicial", cor: "#6DD400" });
  } else {
    ops = [{ id: "c", t: "Ponto de interrupção", cor: "#E8312F" }];
    if (ret && ret.pas && ret.e1) ops.push({ id: "1", t: "Ponto de retorno 1", cor: "#C42BD6", n: 1 });
    if (ret && ret.pas && ret.e2) ops.push({ id: "2", t: "Ponto de retorno 2", cor: "#C42BD6", n: 2 });
  }
  return { ida: ida, ops: ops };
}
function atualizarRetornar(E) {
  var caixa = $("#retornar-a");
  if (!caixa) return;
  E = E || APP.E;
  var v = E && E.v;
  var mostra = APP.conectado && M.sub === "execucao" && M.modo === "rota" && v && v.estado === "manual" && v.temRota;
  if (!mostra) {
    if (!caixa.classList.contains("oculto")) caixa.classList.add("oculto");
    caixa._k = ""; caixa._ops = null;
    return;
  }
  var o = opcoesRetorno(E), ids = o.ops.map(function (x) { return x.id; });
  var sel = M.voo && ids.indexOf(M.voo.retAlvo) >= 0 ? M.voo.retAlvo : ids[0];
  var chave = (o.ida ? "ida" : "pausa") + "|" + ids.join(",") + "|" + sel;
  caixa._ops = ids;
  caixa.classList.remove("oculto");
  if (caixa._k === chave) return;
  caixa._k = chave;
  caixa.innerHTML = '<div class="cab">Retornar à</div><div class="corpo">' + o.ops.map(function (x) {
    return '<button data-alvo="' + x.id + '" class="' + (x.id === sel ? "ativo" : "") + '"><i style="background:' + x.cor + '">' +
      (x.n ? "<b>" + x.n + "</b>" : "") + "</i><span>" + x.t + "</span></button>";
  }).join("") + "</div>";
  $$("[data-alvo]", caixa).forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      if (M.voo) M.voo.retAlvo = b.dataset.alvo;
      atualizarRetornar();
    });
  });
}
/* o alvo do Retomar: a linha escolhida na janelinha (ou a primeira) */
function alvoRetorno() {
  var caixa = $("#retornar-a"), ids = caixa && !caixa.classList.contains("oculto") && caixa._ops;
  if (!ids || !ids.length) return "c";
  return M.voo && ids.indexOf(M.voo.retAlvo) >= 0 ? M.voo.retAlvo : ids[0];
}

/* ------------------------------------------------- recados do jogo (0.1, 0.10)
   botão de pulverização no M e recusa do Iniciar: cartões do aparelho */
var recadoN = null;
ouvir("conexao", function (vivo) { if (vivo) recadoN = null; });   // 1º estado depois de conectar: só anota
function lerRecado(E) {
  var rc = E && E.recado;
  /* o jogo ainda sem recado: o próximo que vier já é novo */
  if (!rc || rc.n == null) { if (recadoN === null && E && E.v) recadoN = 0; return; }
  if (rc.n === recadoN) return;
  var primeiro = recadoN === null;
  recadoN = rc.n;
  if (primeiro) return;
  var c = String(rc.c || "");
  if (c === "ligou") avisoInfo("Habilitar pulverização");
  else if (c === "parou") avisoInfo("Desabilitar pulverização");
  else if (c === "recusa:ja-voando") avisoInfo("Operação cancelada");          // p.57; texto a confirmar (pergunta 13)
  else if (c === "recusa:rtk") avisoInfo("Ative o Posicionamento RTK para iniciar o mapeamento");
  else if (c === "recusa:mapeamento-admin") avisoInfo("Mapeamento disponível somente para administrador");
  else if (c === "recusa:tanque-mapeamento") avisoInfo("Esvazie o tanque para iniciar o mapeamento");
  else if (c === "recusa:sem-rota" || c === "recusa:sem-mapa") avisoInfo("O planejamento da rota falhou");   // g6 #0037
  /* recusa:pessoa-perto: o alerta vermelho de pedestres já está na tela */
}

/* --------------------------------------------- queda (0.10): "Aeronave perdida"
   O porquê vai no cartão de queda (a regra do projeto permite): a mesma conta
   do controle antigo (operacao.js, mostrarQueda) mais a dica do campo */
function mostrarQuedaApp(q) {
  var nome = q.nome || "um obstáculo", sujeito = nome.charAt(0).toUpperCase() + nome.slice(1);
  var nr = function (v) { var a = Math.round(v * 10) / 10; return (a % 1 === 0 ? String(a) : a.toFixed(1)).replace(".", ","); };
  var de = function (n) { return /^o /.test(n) ? "do " + n.slice(2) : /^a /.test(n) ? "da " + n.slice(2) : /^os /.test(n) ? "dos " + n.slice(3) : /^as /.test(n) ? "das " + n.slice(3) : "de " + n; };
  var voltando = q.antes === "voltando", itens = [];
  if (q.alturaObstaculo != null) itens.push({ t: "Altura " + escTxt(de(nome)) + ": " + nr(q.alturaObstaculo) + " m" });
  if (voltando && q.rth != null) itens.push({ t: "Altitude de retorno (RTH): " + nr(q.rth) + " m", verm: q.alturaObstaculo != null && q.rth < q.alturaObstaculo });
  else if (q.altura != null) itens.push({ t: "Altura de trabalho: " + nr(q.altura) + " m", verm: q.alturaObstaculo != null && q.altura < q.alturaObstaculo });
  if (q.desvio != null && !q.fio) itens.push({ t: "Desvio de obstáculos: " + (q.desvio ? "Ligado" : "Desligado"), verm: !q.desvio });
  var conta = "", minha = voltando ? q.rth : q.altura;
  if (minha != null && q.alturaObstaculo != null)
    conta = "A aeronave " + (voltando ? "voltava" : "aplicava") + " a " + nr(minha) + " m; " + nome + ", ali, está a " + nr(q.alturaObstaculo) + " m do chão.";
  else if (q.relevo && ["indo", "voltando", "subindo"].indexOf(q.antes) >= 0 && q.rth != null)
    conta = "No deslocamento a aeronave voa reto, a " + nr(q.rth) + " m acima do ponto de decolagem, sem acompanhar o terreno" +
      (q.relevoSobreOrigem != null ? " — e aqui o chão já estava " + nr(q.relevoSobreOrigem) + " m acima da decolagem." : ".") +
      " Com terreno subindo, a altitude de RTH tem de ser maior que o morro.";
  else if (q.relevo) conta = "O terreno subiu mais rápido do que a aeronave.";
  if (q.fio) conta += " A colisão foi com um fio de rede.";
  else if (q.desvio === false) conta += " Com o desvio de obstáculos desligado, nada a fez parar.";
  var licao = ((conta ? conta + " " : "") + (q.dica || "")).trim();
  dialogo({ icone: "alerta", titulo: "Aeronave perdida", texto: escTxt(sujeito) + " derrubou a aeronave.", itens: itens,
    depois: function (d) {
      if (!licao) return;
      var p = el("p", "licao-queda", escTxt(licao));
      $(".conteudo", d).appendChild(p);
    },
    botoes: [{ t: "OK(R3)", cls: "verde" }] });
}
PALCO.addEventListener("pointerdown", function (e) {
  if (!e.target.closest(".janelinha,.tipo-mapa,.status,.bt-f,.camada-dlg,.hsi,.bt-radar")) fecharFlutuantes();
}, true);

var opMapa = lerGuardado("opMapa", { tipo: "Satélite", hd: "Não exibir", girar: false, campos: true, aux: { Horizonte: true, "Orientação": true, Grade: false } });
document.body.classList.toggle("mapa-padrao", opMapa.tipo === "Padrão");
function abrirTipoMapa() {
  if ($(".tipo-mapa")) return fecharFlutuantes();
  fecharFlutuantes();
  var t = el("div", "tipo-mapa");
  var mini = function (nome) {
    return '<button class="mini' + (opMapa.tipo === nome ? " ativo" : "") + '" data-tipo="' + nome + '"><i style="background-image:url(' + (APP.urlMapa || "") + ');' +
      (nome === "Padrão" ? "filter:saturate(.3) brightness(1.35)" : "") + '"></i>' + nome + "</button>";
  };
  var ch = function (rot, k) { return '<div class="lin"><span>' + rot + '</span><button class="chave' + (opMapa[k] ? " lig" : "") + '" data-k="' + k + '"></button></div>'; };
  t.innerHTML = '<div class="lin" style="min-height:223px"><span>Tipo de<br>mapa</span><div class="minis">' + mini("Padrão") + mini("Satélite") + "</div></div>" +
    '<div class="lin" style="min-height:186px"><span>Sobrepor<br>mapa HD</span><button class="hd">' + opMapa.hd + " ✎</button></div>" +
    ch("Girar mapa", "girar") + ch("Mostrar campos próximos", "campos") +
    '<div class="lin" style="min-height:80px"><span>Auxílios visuais</span></div><div class="aux">' +
    ["Horizonte", "Orientação", "Grade"].map(function (a) { return '<button class="' + (opMapa.aux[a] ? "ativo" : "") + '" data-a="' + a + '"><i></i>' + a + "</button>"; }).join("") + "</div>";
  PALCO.appendChild(t);
  var salvar = function () { guardar("opMapa", opMapa); document.body.classList.toggle("mapa-padrao", opMapa.tipo === "Padrão"); };
  $$("[data-tipo]", t).forEach(function (b) { b.addEventListener("click", function () { opMapa.tipo = b.dataset.tipo; salvar(); fecharFlutuantes(); abrirTipoMapa(); }); });
  $$("[data-k]", t).forEach(function (b) { b.addEventListener("click", function () { opMapa[b.dataset.k] = !opMapa[b.dataset.k]; b.classList.toggle("lig"); salvar(); }); });
  $$("[data-a]", t).forEach(function (b) { b.addEventListener("click", function () { opMapa.aux[b.dataset.a] = !opMapa.aux[b.dataset.a]; b.classList.toggle("ativo"); salvar(); }); });
  $(".hd", t).addEventListener("click", function () {
    var escolha = opMapa.hd;
    dialogo({ titulo: "Sobrepor mapa HD", texto: "Certifique-se de que a conexão de rede seja estável. Carregar o mapa HD em tempo real pode consumir mais dados.",
      html: "", botoes: [{ t: "Cancelar(R2)" }, { t: "Sim(R3)", cls: "verde", fn: function () { opMapa.hd = escolha; salvar(); $(".hd", t).textContent = escolha + " ✎"; } }],
      depois: function (d) {
        var rd = el("div", "radios", ["Não exibir", "Mapa de conta pessoal", "Link do URL"].map(function (o) {
          return '<button class="' + (o === escolha ? "ativo" : "") + '"><i></i>' + o + "</button>"; }).join(""));
        $(".conteudo", d).appendChild(rd);
        $$("button", rd).forEach(function (b) { b.addEventListener("click", function () { escolha = (window.TPD_IDIOMAS ? TPD_IDIOMAS.original(b) : b.textContent); $$("button", rd).forEach(function (x) { x.classList.toggle("ativo", x === b); }); }); });
      } });
  });
}

function abrirPrescricao() {
  var p = $("#painel");
  M.painel = true; document.body.classList.add("painel-aberto"); p.classList.add("ativo");
  p.innerHTML = "";
  p.appendChild(el("div", "titulo", "Mapa de prescrição"));
  p.lastChild.style.cssText = "height:72px;padding:12px 24px 0;text-align:left;font-size:30px";
  var abas = el("div", "abas");
  var corpo = el("div", "lista");
  var vazio = '<div class="vazio" style="padding:96px 24px 0">' + ic("i-documento") + "Nenhum mapa de prescrição disponível. Acesse a página SmartFarm para criar um mapa de prescrição</div>";
  ["Local", "Nuvem"].forEach(function (a, i) {
    abas.appendChild(botao(i === 0 ? "ativa" : "", a, function () {
      $$("button", abas).forEach(function (x) { x.classList.toggle("ativa", (window.TPD_IDIOMAS ? TPD_IDIOMAS.original(x) : x.textContent) === a); });
      corpo.innerHTML = '<div class="vazio">carregando…</div>';
      setTimeout(function () { corpo.innerHTML = vazio; }, 700);
    }));
  });
  p.appendChild(abas);
  corpo.innerHTML = vazio;
  p.appendChild(corpo);
  var rod = el("div", "", '<button style="flex:1;font-size:36px">Cancelar(R2)</button><button style="flex:1;font-size:36px;color:#0ca35c;border-left:1px solid #dcdcdc">Sim(R3)</button>');
  rod.style.cssText = "display:flex;height:120px;border-top:1px solid #dcdcdc;flex:none";
  rod.children[0].addEventListener("click", montar);
  rod.children[1].addEventListener("click", montar);
  p.appendChild(rod);
}

/* ------------------------------------------- janelinhas da barra de estado */
$$(".status[data-jan]").forEach(function (s) {
  s.addEventListener("click", function (e) { e.stopPropagation(); abrirJanelinha(s); });
});
function abrirJanelinha(s) {
  var tipo = s.dataset.jan, ja = $('.janelinha[data-t="' + tipo + '"]');
  fecharFlutuantes();
  if (ja || !APP.conectado) return;
  var E = APP.E, v = E.v || {}, h = "", tit = "", pag = "";
  var cx = function (val, rot, cls) { return '<div class="caixa ' + (cls || "") + '"><b>' + val + "</b><span>" + rot + "</span></div>"; };
  if (tipo === "bateria") { tit = "Bateria Inteligente"; pag = "bateria"; h = '<div class="duas">' + cx(Math.round(v.bateria || 0) + "%", "Nível da bateria") + cx("21.8˚C", "Temperatura") + "</div>"; }
  if (tipo === "sinal") { tit = "Configurações da transmissão de imagem"; pag = "aovivo"; h = '<div class="duas">' + cx("ıll Bom", "Sinal Direto") + "</div>"; }
  if (tipo === "rtk") {
    tit = "Configurações RTK"; pag = "rtk";
    h = '<div class="duas">' + cx("GNSS Normal", "Precisão do Posicionamento") + cx("23", "Satélites") + "</div>" +
      "<h4>Previsão de Atividade Ionosférica</h4><small>Fornece previsão para a atividade ionosférica na região atual nas próximas horas. Quando o nível de atividade é moderado, alto ou muito alto, a precisão do posicionamento RTK pode ser afetada</small>";
  }
  if (tipo === "tanque") {
    tit = "Configurações do sistema de pulverização"; pag = "pulverizacao";
    var r = v.tanque || 0;
    h = '<div class="duas">' + cx(num(r) + "<i>l</i>", "Carga líquida restante", r <= .05 ? "verm" : "") + cx(num(E.m && E.m.tanque) + "<i>l</i>", "Carga Útil Recomendada", "preto") + "</div>";
  }
  if (tipo === "cr") {
    tit = "Configurações do CR"; pag = "controle";
    h = cx($("#rc-bat").textContent + "%", "Nível da Bateria Interna") + '<div style="height:12px"></div>' + cx("Modo " + (lerGuardado("modoJoy", 2)), "Modo do joystick");
  }
  var j = el("div", "janelinha", '<button class="tit"><span>' + tit + "</span>" + ic("i-direita") + "</button>" + h);
  j.dataset.t = tipo;
  var r2 = s.getBoundingClientRect(), pr = PALCO.getBoundingClientRect();
  var cxPx = (r2.left + r2.width / 2 - pr.left) / APP.escala;
  var left = Math.max(12, Math.min(1920 - 672, cxPx - 330));
  j.style.left = left + "px";
  j.style.setProperty("--seta", (cxPx - left) + "px");
  PALCO.appendChild(j);
  $(".tit", j).addEventListener("click", function () { fecharFlutuantes(); if (window.abrirConfig) abrirConfig(pag); });
}

/* radar: chaves de obstáculo */
function abrirRadar() {
  var pop = el("div", "janelinha", "");
  /* gravação 4/124: quadro em x 410..985, y 296..866, seta para baixo no radar */
  pop.className = "janelinha pop-radar";
  [["desvio de obstáculos multidirecional", "desvio", '<circle cx="24" cy="24" r="16" fill="none" stroke="#2b2e31" stroke-width="3.4"/><circle cx="24" cy="24" r="6" fill="#2b2e31"/>'],
    ["Estabilização da altitude", "estab", '<circle cx="24" cy="12" r="5" fill="#2b2e31"/><path d="M10 26a20 20 0 0 1 28 0M16 33a10 10 0 0 1 16 0" fill="none" stroke="#2b2e31" stroke-width="3.4" stroke-linecap="round"/>'],
    ["Desvio de obstáculos", "contornar", '<path d="M24 6v24M14 20l10 10 10-10M8 40h32" fill="none" stroke="#2b2e31" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>']].forEach(function (x) {
    pop.appendChild(chaveDesvio(x[0], x[1], x[2]));
    pop.lastChild.style.padding = "24px 0";
  });
  fecharFlutuantes();
  PALCO.appendChild(pop);
}
/* tocar no radar (o círculo) ou no botão dele abre as três chaves */
$("#bt-radar").addEventListener("click", abrirRadar);
$(".hsi").addEventListener("click", abrirRadar);

/* ------------------------------------------------- navegação e ciclo */
$("#bt-modo").addEventListener("click", function () { $$(".cartao-modo").forEach(function (c) { c.classList.toggle("ativo", c.dataset.modo === M.modo); }); mostrar("modos"); });
$("#modos-fechar").addEventListener("click", function () { mostrar("mapa"); });
$$(".cartao-modo").forEach(function (c) {
  c.addEventListener("click", function () {
    if (ehMapeamento(c.dataset.modo) && !mapeamentoDisponivel()) return;
    var mm = missaoMapa();
    if (mm && (["voando", "pausado", "retornando", "reconstruindo", "concluido"].indexOf(mm.estado) >= 0 || mm.estado === "cancelado" && noAr(APP.E))) return toast("Conclua ou encerre o mapeamento atual antes de trocar o modo");
    if (M.exec && ehMapeamento(M.exec.modo) && !noAr(APP.E) && !ehMapeamento(c.dataset.modo)) { M.exec=null; cmd("p",{v:{xgMapeamento:false,xgGeo:null,xgPulverizar:M.P.sistemas}}); }
    M.modo = c.dataset.modo; guardar("modo", M.modo);
    M.sub = ehMapeamento(M.modo) ? "edicao" : "lista";
    M.painel = M.modo !== "rota" || M.sub !== "lista" ? true : M.painel;
    if (M.sub === "edicao") M.ed = novaEdicao(null);
    M.sel = null;
    mostrar("mapa"); montar();
  });
});
$("#puxador").addEventListener("click", function () { M.painel = !M.painel; montar(); });
function trocarFpv(cheia) {
  $("#fpv").classList.toggle("cheia", cheia);
  document.body.classList.toggle("fpv-cheia", cheia);
  enquadrarMapinha();
}
/* mapinha do canto: o mesmo zoom do mapa grande, recortado em volta do drone
   (431x270 da tela, não o mapa inteiro encolhido) */
function enquadrarMapinha() {
  if (!document.body.classList.contains("fpv-cheia")) { SVG.setAttribute("viewBox", "0 0 1920 1200"); return; }
  var E = APP.E, dp = E && E.d ? poseAgora(E.d) : null, alvo = dp ? paraPx(dp.x, dp.z) : [960, 600];
  var sx = alvo[0] * M.vista.k + M.vista.x, sy = alvo[1] * M.vista.k + M.vista.y;
  SVG.setAttribute("viewBox", (sx - 216).toFixed(1) + " " + (sy - 135).toFixed(1) + " 432 270");
}
var trocouEm = 0;
$("#fpv").addEventListener("click", function () {
  /* o mesmo toque que voltou o mapa cai na janelinha da câmera: ignora */
  if (Date.now() - trocouEm < 600) return;
  if (!$("#fpv").classList.contains("cheia")) trocarFpv(true);
});
/* com a câmera cheia, o mapinha do canto volta ao mapa (o toque não vira arrasto) */
SVG.addEventListener("pointerdown", function (e) {
  if (document.body.classList.contains("fpv-cheia")) { e.stopImmediatePropagation(); trocouEm = Date.now(); trocarFpv(false); }
}, true);
$("#bt-engr").addEventListener("click", function () { if (window.abrirConfig) abrirConfig(); });

/* a cada quadro da tela (~60/s): só o drone, o seguir e o mapinha andam, pela
   posição de agora (poseAgora). O resto redesenha com o estado (até 10/s). */
var poseDesenhada = "";
ouvir("quadro", function (E) {
  if (APP.tela !== "mapa") return;
  var d = poseAgora(E.d), chave = d.x.toFixed(2) + "," + d.z.toFixed(2) + "," + (d.rumo || 0).toFixed(3) + "," + M.vista.k;
  if (chave === poseDesenhada) return;
  poseDesenhada = chave;
  if (M.seguir) {
    /* só desloca o mapa (mesmo zoom): sem redesenhar rota e trilha a cada quadro */
    var p = paraPx(d.x, d.z);
    M.vista.x = 960 - p[0] * M.vista.k;
    M.vista.y = 600 - p[1] * M.vista.k;
    VISTA.setAttribute("transform", "translate(" + M.vista.x + " " + M.vista.y + ") scale(" + M.vista.k + ")");
  }
  desenharAero();
  enquadrarMapinha();
});

/* o voo do jogo manda: decolou, a tela vai para a execução */
var voavaAntes = false, centrou = false;
var rtkAnterior, tanqueVazioAnterior;
ouvir("estado", function (E) {
  atualizarAcessoMapeamento();
  // Uma reconexão do controle deve recuperar a missão que continua no PC.
  var mm = E.mapaMissao;
  if (E.mapeamento && mm) avisosInfo = avisosInfo.filter(function (a) {
    if (a.txt === "Tarefa pausada" && mm.estado !== "pausado") return false;
    return !(mm.fotos > 0 && a.txt.indexOf("Aeronave se preparando para decolar") === 0);
  });
  if (mapeamentoDisponivel() && E.mapeamento && mm && !mm.confirmada && (!M.exec || M.exec.id !== mm.id || M.sub !== "execucao")) {
    var tm = tarefaPorId(mm.id);
    if (!tm && E.rota && Array.isArray(E.rota.lim) && E.rota.lim.length >= 3) {
      tm = Object.assign(novaEdicao(), { id: mm.id, nome: "Mapeamento", data: Date.now(), modo: mm.tipo,
        limite: E.rota.lim, alturaMap: mm.altura, velMap: mm.vel * 3.6, res: mm.res, rotaMap: mm.rotaMap });
      M.tarefas.unshift(tm); salvarTarefas();
    }
    if (tm) {
      M.exec = tm; M.modo = tm.modo; M.sub = "execucao"; M.ed = null;
      M.voo = novoVoo(tm); M.painel = false; montar();
    }
  }
  if (rtkAnterior !== E.rtk || tanqueVazioAnterior !== E.mapaTanqueVazio) {
    rtkAnterior = E.rtk; tanqueVazioAnterior = E.mapaTanqueVazio;
    delete M.alertasFechados["tanque-mapeamento"]; montarDireita();
  }
  /* a trilha voada é gravada em qualquer tela e modo */
  var mudouTrilha = gravarTrilha(E);
  if (!centrou && E.d) { centrou = true; var c0 = paraPx(E.d.x, E.d.z); centrarEm(c0[0], c0[1] - 200, 0.9); }
  atualizarVoo(E);
  atualizarBarra();
  desenharAero();
  desenharHsi();
  avisosDeTroca();
  desenharAlertas();
  var voando = E.v && ["em solo", "concluído"].indexOf(E.v.estado) < 0;
  if (voando !== voavaAntes) {
    voavaAntes = voando;
    if (voando && M.modo === "rota" && M.sub !== "execucao" && M.exec) { M.sub = "execucao"; }
    if (voando && M.sub === "execucao") M.painel = false;
    if (!voando) { M.mmais = false; cmd("pulvManual", { v: false }); }   // o pouso encerra a tarefa M+ (e a bomba/altura do M+ no jogo)
    atualizarVoo(E);
    montar();
  }
  if (M.sub === "execucao") { desenharTudo(); montarDireitaSeMudou(); atualizarInfo(); }
  else if (mudouTrilha) desenharTrilha();
  atualizarRetornar(E);
  if (M.seguir && E.d) { var dS = poseAgora(E.d), p = paraPx(dS.x, dS.z); centrarEm(p[0], p[1]); }
  enquadrarMapinha();
  /* a tarefa pausou (manche, Pausa ou RTH cancelado): cartão "Tarefa pausada >>" */
  var estAgora = E.v ? E.v.estado : null;
  if (estAgora === "manual" && E.v.temRota && estadoAntes && estadoAntes !== "manual") avisoInfo("Tarefa pausada");
  /* a queda: o cartão "Aeronave perdida" uma vez por queda */
  if (estAgora === "caiu") { if (E.queda && !quedaMostrada) { quedaMostrada = true; mostrarQuedaApp(E.queda); } }
  else quedaMostrada = false;
  estadoAntes = estAgora;
  lerRecado(E);
  /* Fluxo do M: o valor do jogo (roda esquerda) no campo do painel, sem refazê-lo */
  if (typeof E.fm === "number" && !(Date.now() - (M.fluxoMQuando || 0) < 1500)) {
    var fm = Math.round(E.fm * 10) / 10;
    if (fm !== M.P.fluxoM) {
      M.P.fluxoM = fm; salvarP();
      var cFm = $("[data-fluxo-m] .val");
      if (cFm) cFm.textContent = num(fm, 1);
    }
  }
  /* obstáculo no caminho (o jogo para e pergunta). Só para obstáculo: com o
     tanque vazio, a conclusão ou a bateria, a aeronave paira e o aluno usa o
     RTH. Sem o texto do campo (meta-texto) */
  if (!(E.protecao && E.protecao.horizontal) && E.alerta && E.alerta.tit === "Obstáculo detectado" && !dialogoAberto && E.v.estado === "pairando") {
    dialogo({ icone: "alerta", titulo: "Obstáculo detectado",
      botoes: [{ t: "Retornar à base", fn: function () { cmd("rth"); } }, { t: "Subir e passar por cima", cls: "verde", fn: function () { cmd("subir"); } }] });
  }
});
var estadoAntes = null, quedaMostrada = false;
ouvir("conexao", function () { atualizarBarra(); desenharAlertas(); montar(); });
ouvir("tela", function (t) { if (t === "mapa") montar(); });

/* começo: centraliza no campo do jogo */
centrarEm(960, 600, 1.15);
M.painel = M.modo !== "rota";
if (ehMapeamento(M.modo)) { M.sub = "edicao"; M.ed = novaEdicao(null); }
montar();
setInterval(desenharAlertas, 1000);


/* ---------- Verificação automática antes da tarefa (igual ao controle do site):
   cenário, RTH e os três sensores; a barra sincroniza a tarefa; depois deslizar
   (ou segurar R3) confirma; contagem de 3 s e a aeronave decola. */
function verificacao(aoFim) {
  var mapeando = ehMapeamento(M.modo);
  function impedimento() {
    if (!mapeando) return "";
    if (!mapeamentoDisponivel()) return "Mapeamento disponível somente para administrador";
    if (!rtkAtivo()) return "Ative o Posicionamento RTK para iniciar o mapeamento";
    return tanqueVazioParaMapear() ? "" : "Esvazie o tanque para iniciar o mapeamento";
  }
  var motivo = impedimento();
  if (motivo) return toast(motivo);
  var P = Object.assign({}, M.P);
  if (M.exec && ehMapeamento(M.exec.modo)) P.rthAlt = Math.max(M.exec.alturaMap || 30, 33);
  var cen = { planicie: "Planícies", montanha: "Colina/Pomar", agua: "Acima da água" }[P.terreno] || "Planícies";
  var ch = [P.desvio, P.estab, P.contornar], lig = ch.filter(Boolean).length;
  var nomes = ["desvio de obstáculos multidirecional", "Estabilização da altitude", "Desvio de obstáculos"];
  var v = el("div", "verif");
  v.innerHTML = '<div class="cartao"><h3>Verificação automática antes da tarefa</h3><div class="lista">' +
    '<div class="bloco"><div class="lin"><span>Cenário</span><b>' + cen + "</b></div></div>" +
    '<div class="bloco"><div class="lin"><span>Roteamento de conexão e velocidade RTH</span><b>' + num(P.rthVel) + " km/h</b></div>" +
    '<div class="lin"><span>Roteamento de conexão e altitude RTH</span><b>' + num(P.rthAlt) + " m</b></div>" +
    '<div class="lin"><span>Retorno à base automático</span><b>' + (lig === 3 ? "Totalmente ativado" : "Parcialmente ativado") + "</b></div></div>" +
    '<div class="cartoes">' + nomes.map(function (n, i) { return '<div class="' + (ch[i] ? "" : "off") + '"><span>' + n + "</span><b>" + (ch[i] ? "Habilitado" : "Desabilitado") + "</b></div>"; }).join("") + "</div></div>" +
    '<div class="rodape"><p class="sinc">Sincronizando tarefa com a aeronave…</p><div class="barra"><i></i></div>' +
    '<div class="desliza"><span class="rot">Deslize ou pressione e segure o botão R3 para confirmar</span><b>›››</b></div>' +
    '<div class="botoes"><button class="min">Minimizar(R2)</button></div></div></div>';
  PALCO.appendChild(v);
  var contando = false, r2;
  var fechar = function () { clearInterval(rel); clearInterval(r2); v.remove(); window.rcplusSegurarR3 = null; };
  $(".min", v).addEventListener("click", fechar);
  var passo = 0, rel = setInterval(function () {
    passo += 10;
    $(".barra i", v).style.width = Math.min(passo, 100) + "%";
    if (passo >= 100) {
      clearInterval(rel);
      $(".sinc", v).textContent = "Tarefa sincronizada com a aeronave";
      $(".desliza", v).classList.add("aberta");
    }
  }, 250);
  var trilho = $(".desliza", v), punho = $("b", trilho);
  var mover = function (f) { punho.style.left = (10 + (trilho.clientWidth - 104) * f) + "px"; };
  var contar = function () {
    if (contando) return;
    var bloqueio = impedimento();
    if (bloqueio) { fechar(); toast(bloqueio); return; }
    contando = true; window.rcplusSegurarR3 = null;
    $(".cartao", v).style.display = "none";
    /* cartão da contagem igual ao Agras (g5 #0042, g7 #0144): branco 900x870,
       título, número vermelho grande e o aviso do pino esquerdo */
    var n = 3, c = el("div", "conta",
      '<h4>Aeronave se preparando para decolar. Afaste-se a uma distância segura</h4>' +
      '<b>3</b><p>Empurre o pino de controle esquerdo (no Modo 2) para baixo para cancelar a decolagem</p>');
    v.appendChild(c);
    if (window.avisoInfo) avisoInfo("Aeronave se preparando para decolar. Afaste-se a uma distância segura");
    r2 = setInterval(function () {
      n -= 1;
      if (n > 0) {
        var b = $("b", c), nb = b.cloneNode(false);
        nb.textContent = String(n);
        b.parentNode.replaceChild(nb, b);   /* recomeça a animação do número */
        return;
      }
      fechar();
      var bloqueioFinal = impedimento();
      if (bloqueioFinal) return toast(bloqueioFinal);
      if (typeof aoFim === "function") aoFim(); else cmd("iniciar");
    }, 1000);
  };
  trilho.addEventListener("pointerdown", function (e) {
    if (!trilho.classList.contains("aberta")) return;
    trilho.setPointerCapture(e.pointerId);
    /* 11/11/2026: pela posicao do dedo na barra (antes era o arrasto desde onde o dedo encostou: encostando no meio da barra
       nunca se chegava ao fim e a aeronave nao decolava). O punho acompanha o dedo; soltar a partir de 90 % confirma. */
    var r = trilho.getBoundingClientRect(), meio = Math.max(8, punho.getBoundingClientRect().width / 2), x0 = e.clientX;
    var naBarra = function (x) { return Math.max(0, Math.min(1, (x - r.left - meio) / Math.max(1, r.width - 2 * meio))); };
    var f = 0, fMax = 0, fim = false;   /* so um toque, sem arrastar, nao confirma */
    /* 12/11/2026 (Eduardo no Mac: a bolinha "vai e volta" ao soltar): vale o ponto mais longe que a bolinha chegou, a posicao
       do proprio soltar tambem conta, a partir de 80 % confirma, e perder a captura equivale a soltar */
    trilho.onpointermove = function (ev) { f = naBarra(ev.clientX); if (f > fMax) fMax = f; mover(f); };
    trilho.onpointerup = trilho.onpointercancel = trilho.onlostpointercapture = function (ev) {
      if (fim) return; fim = true;
      if (ev && ev.type === "pointerup" && typeof ev.clientX === "number") { var fs = naBarra(ev.clientX); if (fs > fMax) fMax = fs; }
      trilho.onpointermove = null; trilho.onpointerup = trilho.onpointercancel = trilho.onlostpointercapture = null;
      if (fMax >= .8) { mover(1); contar(); } else mover(0);
    };
  });
  /* R3 segurado (app Android avisa) confirma também */
  window.rcplusSegurarR3 = function () { if (trilho.classList.contains("aberta")) { mover(1); contar(); } };
}

// Atendimento solicitado pela conversa Falar com auxiliar no simulador.
