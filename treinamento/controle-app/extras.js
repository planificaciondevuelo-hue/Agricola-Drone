/* ==========================================================================
   Telas da tela inicial: perfil (+ registros de voo), notificações,
   configurações gerais, pastinha (Local / Nuvem / microSD), gerenciamento
   de registros e do dispositivo (+ firmware). Textos das gravações.
   ========================================================================== */
"use strict";

var EX = { tela: null, aba: null, secao: null, sub: null, sel: false, marcados: [] };

function topoExtra(titulo, abas) {
  var t = el("div", "ex-topo");
  if (EX.sub) {
    var v = botao("voltar", '<svg viewBox="0 0 48 48"><path d="M30 10 16 24l14 14" fill="none" stroke="#1f2224" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      function () { EX.sub = null; montarExtra(); });
    t.appendChild(v);
  }
  if (abas && !EX.sub) {
    var a = el("div", "abas-topo");
    abas.forEach(function (n) { a.appendChild(botao(n === EX.aba ? "ativa" : "", n, function () { EX.aba = n; EX.sel = false; EX.marcados = []; if (EX.tela === "arquivos") EX.secao = MENU_ARQ[n][0]; montarExtra(); })); });
    t.appendChild(a);
  } else t.appendChild(el("h2", "", titulo));
  t.appendChild(botao("fechar", ic("i-x"), fecharExtra));
  return t;
}
function fecharExtra() { $("#extra").classList.remove("aberto"); }
function abrirExtra(nome) {
  EX.tela = nome === "arquivos-sd" ? "arquivos" : nome;
  EX.sub = null; EX.sel = false; EX.marcados = [];
  EX.aba = { arquivos: nome === "arquivos-sd" ? "microSD" : "Local", notificacoes: "Não lido" }[EX.tela] || null;
  if (EX.tela === "arquivos") EX.secao = MENU_ARQ[EX.aba][0];
  $("#extra").classList.add("aberto");
  montarExtra();
}
window.abrirExtra = abrirExtra;

/* --------------------------------------------------------------- dados */
var MENU_ARQ = {
  Local: ["Tarefa", "Tarefas em andamento", "Modelos de tarefa", "Material", "Saída de reconstrução", "Mapa de prescrição"],
  Nuvem: ["Tarefa", "Tarefas em andamento", "Modelos de tarefa", "Material", "Saída de reconstrução", "Mapa de prescrição"],
  microSD: ["Tarefa", "Saída de reconstrução", "Mapa de prescrição"]
};
var AVISO_SD = {
  "Tarefa": "O arquivo de tarefa deve ser colocado em /DJI/routes/, e o arquivo SHP deve ser colocado em /DJI/Shapefile/",
  "Saída de reconstrução": "Certifique-se de colocar os arquivos no local correto: /DJI/rebuild/",
  "Mapa de prescrição": "Certifique-se de colocar os arquivos no local correto: /DJI/RX/"
};
var VOOS = [["2026-08-18 16:52:49", "0.14Ha", "01minuto58s", "1.99l", "Rota automática"], ["2026-08-18 16:42:04", "0.11Ha", "01minuto48s", "0.90l", "Rota automática"],
  ["2026-08-18 16:40:59", "0.00Ha", "00minuto22s", "0.00l", "Manual"], ["2026-08-18 16:36:47", "0.00Ha", "00minuto29s", "0.00l", "Manual"]];

function itensArquivos() {
  if (EX.aba === "Local" && EX.secao === "Tarefa") return M.tarefas.map(function (t) {
    return { id: t.id, data: dataCurta(t.data), nome: t.nome, area: num(t.area || areaHa(t.limite), 2), etq: "Rota" };
  });
  if (EX.aba === "Local" && EX.secao === "Tarefas em andamento") return M.andamento.map(tarefaPorId).filter(Boolean).map(function (t) {
    return { id: t.id, data: dataCurta(t.data), nome: t.nome, area: "0", etq: "" };
  });
  if (EX.aba === "Local" && EX.secao === "Modelos de tarefa") return [{ data: "2025/01/04 16:59", nome: "Padrão", etq: "Pulverização", etq2: nomeDrone(), sem: true }];
  return [];
}

/* -------------------------------------------------------------- telas */
function montarExtra() {
  var x = $("#extra");
  x.innerHTML = "";
  var f = TELAS_EX[EX.tela];
  if (f) f(x);
}

var TELAS_EX = {
  usuario: function (x) {
    if (EX.sub === "voos") {
      x.appendChild(topoExtra("Registros de voos locais"));
      var r = el("div", "ex-rol cinza");
      r.innerHTML = '<div class="filtros"><button>' + nomeDrone() + " ⌄</button><span style=\"flex:1\"></span><button class=\"bt-verde\" style=\"background:#00ad53;color:#fff\">Carregar</button></div>" +
        '<div class="tabela" style="background:#fff"><div class="l cab" style="--cols:5"><span>Data/localização</span><span>Área da tarefa</span><span>Duração do voo</span><span>Quantidade</span><span>Modo</span></div>' +
        VOOS.map(function (v) { return '<div class="l" style="--cols:5;min-height:120px"><span>' + v[0] + "<br><small style=\"color:#8a8f94\">Verificando on-line…</small></span><span>" + v[1] + "</span><span>" + v[2] + "</span><span>" + v[3] + "</span><span>" + v[4] + "</span></div>"; }).join("") + "</div>";
      x.appendChild(r);
      return;
    }
    x.appendChild(topoExtra("Informação do usuário"));
    var c = el("div", "ex-rol");
    c.innerHTML = '<div style="display:flex;align-items:center;gap:30px;padding:24px 0"><span style="width:144px;height:144px;border-radius:50%;background:#e2e2e1;display:flex;align-items:center;justify-content:center">' + ic("i-perfil").replace("<svg", '<svg style="width:84px;height:84px;opacity:.4"') + "</span>" +
      '<div style="flex:1"><b style="font-size:44px;font-weight:500">Operador <span class="etq" style="background:#e4f1e8;color:#0ca35c">Proprietário</span></b><div class="ex-email" style="font-size:34px;color:#8a8f94;margin-top:12px">operador@treinamento</div></div>' +
      '<span style="font-size:28px;color:#a4a8ab;align-self:flex-start">(Conecte-se à internet e sincronize pela primeira vez)</span></div>' +
      '<div class="cartoes-usuario"><div><b>N/A<i>Ha</i></b><span>Área da tarefa</span></div><div><b>N/A<i>Hora</i></b><span>Horas de voo</span></div><div><b>N/A</b><span>Total de voos</span></div></div>' +
      '<div class="lin-reg"><span style="flex:1">Minha Equipe</span><span style="color:#555a5f">Treinamento</span><button class="bt-verde-c">Alterar</button></div>' +
      '<button class="cfg-link" data-voos><span>Registros de voo</span>' + ic("i-direita") + '</button><button class="cfg-verde" data-sair style="color:#e5372e">Sair</button>';
    $("[data-voos]", c).addEventListener("click", function () { EX.sub = "voos"; montarExtra(); });
    /* conta do treinamento neste controle (conta.js): mostra o e-mail e o Sair funciona */
    var contaAtiva = window.CONTA_CONTROLE && CONTA_CONTROLE.ativo && CONTA_CONTROLE.logado();
    if (contaAtiva) $(".ex-email", c).textContent = CONTA_CONTROLE.email();
    $("[data-sair]", c).addEventListener("click", function () { if (contaAtiva) CONTA_CONTROLE.sair(); });
    x.appendChild(c);
  },
  notificacoes: function (x) {
    x.appendChild(topoExtra("", ["Não lido", "Histórico"]));
    x.appendChild(el("div", "ex-rol", '<div class="vazio" style="padding-top:300px">' + ic("i-documento") + "Sem mais dados</div>"));
  },
  gerais: function (x) {
    var subs = {
      unidades: ["Unidades de medida", '<div class="cfg-lin cfg-bloco"><span class="cfg-tit">Unidades</span><div class="grupo" style="width:420px;margin:0"><button class="ativo">Métrica</button><button>Inglesa</button></div></div>' +
        '<div class="cfg-lin cfg-bloco"><span class="cfg-tit">Unidade de velocidade</span><div class="grupo" style="width:420px;margin:0"><button class="ativo">km/h</button><button>m/s</button></div></div>'],
      idioma: ["Idioma", '<div class="lin-reg"><span class="marcar sim" style="border-radius:50%"></span>Padrão do sistema</div>'],
      privacidade: ["Configurações de privacidade", ["Informações de localização aproximada", "Informações GNSS", "Número de série do dispositivo", "Sincronizar dados de voo em tempo real",
        "Sincronização automática do registro de voo", "Autorizar o uso de registros de voo", "Programa de Melhoria do Produto"].map(function (n) {
          return '<div class="cfg-bloco cfg-lin"><span class="cfg-tit">' + n + '</span><button class="chave lig"></button></div>'; }).join("") +
        '<div class="cfg-bloco cfg-lin"><span class="cfg-tit">Modo de dados locais</span><button class="chave"></button></div>'],
      armazenamento: ["Gerenciamento de armazenamento", '<div style="height:28px;border-radius:6px;background:#ececeb;margin:24px 0;display:flex;overflow:hidden"><i style="width:7%;background:#e055c8"></i><i style="width:18%;background:#f08a24"></i><i style="width:5%;background:#3ab54a"></i><i style="width:32%;background:#8b8f93"></i></div>' +
        '<p class="cfg-sec">Espaço do aplicativo utilizado</p><div class="cfg-val">10,54GB</div><p style="color:#e5372e;font-size:30px">Os dados a seguir não podem ser recuperados depois de excluídos. Tenha cuidado ao excluir dados</p>' +
        [["Registro do aplicativo", "218,49MB"], ["Pacotes de atualização de firmware", "6,43GB"], ["Cache do mapa HD", "0bytes"], ["Dados de tarefa local", M.tarefas.length + "Entradas"], ["Registros de voo", "1,56GB"]]
          .map(function (i) { return '<div class="lin-reg"><span style="flex:1">' + i[0] + '</span><span style="color:#555a5f">' + i[1] + '</span><button class="bt-verde-c">Limpar</button></div>'; }).join("")],
      rede: ["Diagnóstico de rede", '<div class="vazio" style="padding-top:120px">Controlador ── Wi-Fi ── Plataforma de gerenciamento Agras<br><br><button class="bt-verde-c">Atualizar</button></div>'],
      audio: ["Arquivos de áudio em vários idiomas", ["alemão", "espanhol", "francês", "japonês", "coreano", "russo", "italiano", "holandês", "português do Brasil", "português europeu"].map(function (l) {
        return '<div class="lin-reg"><span style="flex:1">Arquivo de áudio em ' + l + '</span><button class="bt-verde-c' + (l === "português do Brasil" ? " desl" : "") + '">' + (l === "português do Brasil" ? "Baixado" : "Baixar") + "</button></div>"; }).join("")]
    };
    if (EX.sub) {
      x.appendChild(topoExtra(subs[EX.sub][0]));
      var s = el("div", "ex-rol", subs[EX.sub][1]);
      $$(".chave", s).forEach(function (c) { c.addEventListener("click", function () { c.classList.toggle("lig"); }); });
      $$(".grupo", s).forEach(function (g) { $$("button", g).forEach(function (b) { b.addEventListener("click", function () { $$("button", g).forEach(function (o) { o.classList.toggle("ativo", o === b); }); }); }); });
      x.appendChild(s);
      return;
    }
    x.appendChild(topoExtra("Configurações gerais"));
    var r = el("div", "ex-rol");
    [["Unidades de medida", "unidades"], ["Idioma", "idioma", "Padrão do sistema"], ["Arquivos de áudio em vários idiomas", "audio"], ["Configurações de privacidade", "privacidade"],
      ["Gerenciamento de armazenamento", "armazenamento"], ["Diagnóstico de rede", "rede"]].forEach(function (i) {
      var b = el("button", "cfg-link", "<span>" + i[0] + "</span><span>" + (i[2] ? "<em>" + i[2] + "</em>" : "") + ic("i-direita") + "</span>");
      $$("span", b)[1].style.display = "flex";
      b.addEventListener("click", function () { EX.sub = i[1]; montarExtra(); });
      r.appendChild(b);
    });
    r.appendChild(el("div", "cfg-lin cfg-bloco", '<span class="cfg-tit">Guia para iniciantes</span><button class="bt-verde-c">Redefinir</button>'));
    r.appendChild(el("button", "cfg-link", "<span>Requerimentos da Política</span>" + ic("i-direita")));
    r.appendChild(el("p", "", '<a href="https://guridosdrones-treinamento.web.app/treinamento/conta/termos.html#privacidade" target="_blank" rel="noopener" style="color:#0ca35c">Política de privacidade</a> · <a href="https://guridosdrones-treinamento.web.app/treinamento/conta/termos.html#termos" target="_blank" rel="noopener" style="color:#0ca35c">Termos de uso do simulador</a>'));
    r.lastChild.style.cssText = "text-align:center;font-size:30px;color:#8a8f94;margin-top:48px";
    x.appendChild(r);
  },
  arquivos: function (x) {
    x.appendChild(topoExtra("", ["Local", "Nuvem", "microSD"]));
    var corpo = el("div", "ex-corpo");
    var menu = el("div", "ex-menu");
    MENU_ARQ[EX.aba].forEach(function (s) { menu.appendChild(botao(s === EX.secao ? "ativo" : "", s, function () { EX.secao = s; EX.sel = false; EX.marcados = []; montarExtra(); })); });
    corpo.appendChild(menu);
    var r = el("div", "ex-rol");
    var itens = itensArquivos(), sd = EX.aba === "microSD", marcando = sd || EX.sel;
    if (sd) r.appendChild(el("p", "cfg-desc", "ⓘ " + AVISO_SD[EX.secao]));
    else if (!EX.sel) {
      var fil = el("div", "filtros", '<button>' + ic("i-ordenar") + (EX.secao === "Tarefa" ? "Distância" : "Tempo") + '</button><button>Todos os Tipos ⌄</button><span class="busca">' + ic("i-lupa") + "Nome ou local</span>" +
        (EX.secao === "Tarefas em andamento" ? "<button>Sincronizar</button>" : "") + '<button data-sel>Selecione</button>');
      $("[data-sel]", fil).addEventListener("click", function () { EX.sel = true; EX.marcados = []; montarExtra(); });
      r.appendChild(fil);
    }
    if (!itens.length) r.appendChild(el("div", "vazio", ic("i-documento") + "Nenhum arquivo encontrado"));
    itens.forEach(function (it, i) {
      var marc = EX.marcados.indexOf(i) >= 0;
      var a = el("div", "arq" + (marc ? " marcado" : ""), (marcando ? '<span class="marcar' + (marc ? " sim" : "") + '"></span>' : "") +
        (sd || it.sem ? "" : '<span class="mini" style="background:linear-gradient(135deg,#8a7a68,#6d7a45)"></span>') +
        '<div class="dd"><small>' + it.data + "</small><b>" + it.nome + "</b>" + (it.sem || sd ? "" : "<span>Campo de treinamento</span>") + "</div>" +
        '<div class="dir">' + (it.area ? "<b>" + it.area + "<i>Ha</i></b>" : "") + "<span>" + (it.etq ? '<span class="etq">' + it.etq + "</span> " : "") + (it.etq2 ? '<span class="etq">' + it.etq2 + "</span>" : "") + "</span></div>");
      if (marcando) a.addEventListener("click", function () {
        var k = EX.marcados.indexOf(i); if (k >= 0) EX.marcados.splice(k, 1); else EX.marcados.push(i); montarExtra();
      });
      r.appendChild(a);
    });
    if (itens.length) r.appendChild(el("p", "sem-mais", "Sem mais dados"));
    if (marcando) {
      var n = EX.marcados.length;
      var rod = el("div", "rodape-sel", '<label style="display:flex;align-items:center;gap:12px" data-todos><span class="marcar' + (n && n === itens.length ? " sim" : "") + '"></span>Selecionar tudo</label>' +
        '<span class="grow"></span><button data-desm>Desmarcar tudo</button><span style="color:#0ca35c">' + n + " selecionado</span>" +
        (EX.aba === "Local" ? '<button class="bt-verm' + (n ? "" : " desl") + '" data-exc>Excluir</button>' : "") +
        '<button class="bt-verde' + (n ? "" : " desl") + '" data-ok>' + (sd ? "Importar" : EX.aba === "Nuvem" ? "Baixar" : EX.secao === "Tarefas em andamento" ? "Concluir" : "Carregar") + "</button>");
      $("[data-todos]", rod).addEventListener("click", function () { EX.marcados = n === itens.length ? [] : itens.map(function (_, i) { return i; }); montarExtra(); });
      $("[data-desm]", rod).addEventListener("click", function () { EX.marcados = []; if (!sd) EX.sel = false; montarExtra(); });
      var exc = $("[data-exc]", rod);
      if (exc) exc.addEventListener("click", function () {
        if (!n) return;
        dialogo({ icone: "alerta", titulo: "Excluir arquivos selecionados do controle remoto atual?", botoes: [{ t: "Cancelar(R2)" }, { t: "Excluir(R3)", cls: "verm", fn: function () {
          var ids = EX.marcados.map(function (i) { return itens[i].id; });
          if (EX.secao === "Tarefa") M.tarefas = M.tarefas.filter(function (t) { return ids.indexOf(t.id) < 0; });
          M.andamento = M.andamento.filter(function (id) { return ids.indexOf(id) < 0; });
          salvarTarefas(); EX.marcados = []; EX.sel = false; montarExtra(); toast("Arquivos excluídos", "ok");
        } }] });
      });
      $("[data-ok]", rod).addEventListener("click", function () {
        if (!n) return;
        if (EX.secao === "Tarefas em andamento") {
          var ids2 = EX.marcados.map(function (i) { return itens[i].id; });
          M.andamento = M.andamento.filter(function (id) { return ids2.indexOf(id) < 0; }); salvarTarefas();
        }
        EX.marcados = []; EX.sel = false; montarExtra(); toast("Concluído", "ok");
      });
      r.appendChild(rod);
    }
    corpo.appendChild(r);
    x.appendChild(corpo);
  },
  registros: function (x) {
    if (EX.sub) {
      x.appendChild(topoExtra(EX.sub));
      var l = el("div", "ex-rol", '<p class="cfg-desc">Os registros contêm informações sobre o dispositivo, a conta e a localização, bem como filmagens de vídeo feitas pela câmera da aeronave. Essas informações só serão utilizadas para ajudar o suporte a localizar problemas com o seu dispositivo<br>Uma entrada de registro gerada para ligar e desligar o controle remoto</p>');
      for (var i = 0; i < 8; i++) {
        var d = new Date(Date.now() - i * 3600e3 * 5), z = function (n) { return (n < 10 ? "0" : "") + n; };
        var lin = el("div", "lin-reg", '<span class="marcar"></span>[Registro-' + (688 - i) + "] " + d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) + " " + z(d.getHours()) + ":" + z(d.getMinutes()));
        lin.addEventListener("click", function () { $(".marcar", this).classList.toggle("sim"); });
        l.appendChild(lin);
      }
      x.appendChild(l);
      return;
    }
    x.appendChild(topoExtra("Gerenciamento de registros"));
    var r = el("div", "ex-rol cinza");
    r.innerHTML = '<div class="filtros"><button style="background:#fff">Salvo em Local</button><button style="background:#fff">Histórico de carregamento</button><span style="flex:1"></span><button style="background:transparent">Carregamento personalizado ›</button></div>';
    var g = el("div", "grade2");
    [["Problemas gerais", "Oferece suporte para problemas relacionados a voo, detecção de obstáculos, planejamento de rotas e outros", true],
      ["Problemas de transmissão", "Oferece suporte para problemas relacionados à atualização de firmware, transmissão de imagens, velocidade de transferência de dados, conexão da aeronave com controle remoto e outros"],
      ["Problemas de mapeamento e reconstrução", ""], ["Problemas com o dispositivo de carregamento", "", true]].forEach(function (c) {
      var b = el("button", "cartao-reg" + (c[2] ? " desl" : ""), "<b>" + c[0] + "</b>" + (c[1] ? "<span>" + c[1] + "</span>" : ""));
      if (!c[2]) b.addEventListener("click", function () { EX.sub = c[0]; montarExtra(); });
      g.appendChild(b);
    });
    r.appendChild(g);
    r.appendChild(el("p", "sem-mais", "Carregar registros quando conectado ao Wi-Fi"));
    x.appendChild(r);
  },
  dispositivo: function (x) {
    if (EX.sub === "firmware") {
      x.appendChild(topoExtra("Atualização de firmware"));
      var f = el("div", "ex-rol cinza", '<div class="grade4">' + [["Controlador", true], ["Relé"], ["Estação móvel D-RTK"]].map(function (c) {
        return '<div class="cartao-disp' + (c[1] ? " ativo" : "") + '" style="background:#fff"><div class="t"><span class="marcar"></span>' + c[0] + "</div>" +
          (c[1] ? '<div class="c"><p>Versão atual<b>06.05.0921</b></p></div>' : "") + "</div>"; }).join("") + "</div>" +
        '<div class="rodape-sel"><button>Desmarcar tudo</button><span class="grow"></span><button class="bt-verde desl">Atualizar todos os selecionados</button></div>');
      x.appendChild(f);
      return;
    }
    x.appendChild(topoExtra("Gerenciamento do dispositivo"));
    var con = APP.conectado;
    var r = el("div", "ex-rol");
    r.innerHTML = '<div class="filtros"><button style="color:#1f2224">Atualização de firmware</button><button style="color:#8a8f94">Integridade do dispositivo</button></div>' +
      '<div class="grade4">' + [["Controlador", true, [["NS", "4LGZL2R007025P"], ["Versão", "06.05.0921(BR)"], ["Versão do aplicativo", "8.6.38"]]],
        ["Aeronave", con, [["NS", con ? "1581F6BUB233200102BT" : "-"], ["Versão", con ? "06.05.0921" : "-"], ["Número de série da bateria", "-"]]],
        ["Dispositivo de carregamento", false, [["NS", "-"], ["Versão", "-"], ["NS do controlador CC", "-"]]], ["Dongle CR RTK", false, [["NS", "-"], ["Versão", "-"]]],
        ["Relé", false, [["NS", "-"]]], ["Estação móvel D-RTK", false, [["NS", "-"]]]].map(function (c) {
        return '<div class="cartao-disp' + (c[1] ? " ativo" : "") + '" data-c="' + c[0] + '"><div class="t">' + ic("i-cubo") + c[0] + '</div><div class="c">' +
          c[2].map(function (f) { return "<p>" + f[0] + "<b>" + f[1] + "</b></p>"; }).join("") + "</div></div>"; }).join("") + "</div>";
    $('[data-c="Controlador"]', r).addEventListener("click", function () { EX.sub = "firmware"; montarExtra(); });
    x.appendChild(r);
  }
};
