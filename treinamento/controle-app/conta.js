/* ==========================================================================
   Conta do Treinamento dentro do app do controle (06/10/2026).

   Substitui o "número de cadastro": o aluno entra aqui com o MESMO e-mail e a
   MESMA senha da conta do site do Treinamento Piloto de Drone (não é a conta
   DJI). Com a conta aberta:
   - o app nativo libera manches e comandos (RCPLUS.definirConta);
   - o rtc.js acha o simulador da mesma conta pelo Firebase
     (sinalConta/{uid}/aparelhos/{aparelho}), sempre com o token da conta;
   - a ponte do PC reconhece o controle pelo uid da conta.
   O Firebase só deixa a própria conta ler e gravar esse documento
   (firestore.rules), então ninguém de fora vê nem mexe no pareamento.

   A senha não é guardada: fica só o "refresh token" que o Firebase devolve
   (no armazenamento privado do app). Conta bloqueada ou senha trocada derruba
   esse token, e o app volta para esta tela.

   Só funciona dentro do APK (window.RCPLUS). No controle virtual do site a
   conta já é a do navegador: aqui fica parado.
   ========================================================================== */
"use strict";
var CONTA_CONTROLE = (function () {
  var CHAVE_API = "AIzaSyDELlE6eAF-wqlYaBSh1tmIxyd908wQWGc";   // chave pública do site (conta/config.js)
  var GUARDA = "tpd_conta_controle", GUARDA_APARELHO = "tpd_aparelho_controle";
  var nativo = !!(window.RCPLUS && window.RCPLUS.definirConta);
  var conta = null, token = null, tokenAte = 0, renovando = null, tela = null;

  function ler(chave) { try { return JSON.parse(localStorage.getItem(chave) || "null"); } catch (e) { return null; } }
  function gravar(chave, v) { try { if (v == null) localStorage.removeItem(chave); else localStorage.setItem(chave, JSON.stringify(v)); } catch (e) { /* sem espaço */ } }
  function avisarNativo(uid) { try { if (nativo) window.RCPLUS.definirConta(uid || ""); } catch (e) { /* app antigo */ } }

  /* identificador deste aparelho na conta: aleatório, só serve para separar
     dois controles da mesma pessoa */
  function aparelho() {
    var a = ler(GUARDA_APARELHO);
    if (typeof a === "string" && /^[a-f0-9]{32}$/.test(a)) return a;
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    a = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    gravar(GUARDA_APARELHO, a);
    return a;
  }

  function mensagemDeErro(codigo) {
    codigo = String(codigo || "");
    if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(codigo)) return "E-mail ou senha incorretos.";
    if (/USER_DISABLED/.test(codigo)) return "Esta conta está bloqueada. Fale com o suporte do treinamento.";
    if (/TOO_MANY_ATTEMPTS/.test(codigo)) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
    return "Não foi possível entrar agora. Confira a internet do controle e tente de novo.";
  }

  function entrar(email, senha) {
    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + CHAVE_API, {
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: senha, returnSecureToken: true })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.localId || !j.idToken) throw new Error(mensagemDeErro(j.error && j.error.message));
        conta = { uid: j.localId, email: j.email || email, refresh: j.refreshToken };
        renovando = null; token = j.idToken; tokenAte = Date.now() + (Number(j.expiresIn || 3600) - 120) * 1000;
        gravar(GUARDA, conta);
        avisarNativo(conta.uid);
        return conta;
      });
    }, function () { throw new Error(mensagemDeErro("rede")); });
  }

  /* token da conta para o Firestore; renova sozinho antes de vencer.
     Falha de rede não derruba a conta; token recusado pelo servidor derruba. */
  function obterToken(forcar) {
    if (!conta) return Promise.reject(new Error("sem conta"));
    if (!forcar && token && Date.now() < tokenAte) return Promise.resolve(token);
    if (renovando) return renovando;
    var refresh = conta.refresh, esta;
    esta = renovando = fetch("https://securetoken.googleapis.com/v1/token?key=" + CHAVE_API, {
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refresh)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          // so derruba se a recusa e da conta aberta agora (nao de uma renovacao antiga)
          if (conta && conta.refresh === refresh && (r.status === 400 || r.status === 401 || r.status === 403)) {
            sair("Sua sessão terminou (senha trocada, conta bloqueada ou removida). Entre de novo.");
          }
          throw new Error("token recusado");
        }
        if (!conta || conta.refresh !== refresh) throw new Error("conta trocada");
        token = j.id_token; tokenAte = Date.now() + (Number(j.expires_in || 3600) - 120) * 1000;
        if (j.refresh_token && j.refresh_token !== conta.refresh) { conta.refresh = j.refresh_token; gravar(GUARDA, conta); }
        return token;
      });
    }).then(function (t) { if (renovando === esta) renovando = null; return t; },
            function (e) { if (renovando === esta) renovando = null; throw e; });
    return esta;
  }

  function sair(m) {
    conta = null; token = null; tokenAte = 0; renovando = null;
    gravar(GUARDA, null);
    avisarNativo("");
    /* volta para a tela inicial, como o Agras: só o aviso no canto */
    try { if (typeof fecharExtra === "function") fecharExtra(); } catch (e) { /* tela não montada */ }
    try { if (typeof fecharConfig === "function") fecharConfig(); } catch (e) { /* tela não montada */ }
    try { if (typeof mostrar === "function") mostrar("inicial"); } catch (e) { /* tela não montada */ }
    motivo = m || "";
    esconderTela();
    atualizarAviso();
  }

  /* ------------------------------------------------------------- a tela
     Igual ao app Agras do RC Plus (fotos do Eduardo, 06/10/2026):
     - sem conta, a tela inicial abre normal e só aparece o aviso vermelho no
       canto do banner ("Login expirou ou não está conectado...");
     - tocar no aviso, no Começar ou em qualquer outro botão (da tela ou
       físico) abre a janelinha "Entrar"; nada funciona antes de entrar;
     - o "Sair" de Informação do usuário volta para esse estado.
     A janelinha copia o layout da DJI, mas diz no alto que é a conta do
     SIMULADOR e avisa para não usar a senha DJI (sem marca da DJI).
     Desenho anterior: copias-de-seguranca/login-estilo-agras-20261006. */
  var GUARDA_EMAILS = "tpd_emails_controle";
  var aviso = null, motivo = "";

  var CSS =
    "#conta-login{position:absolute;left:0;top:0;width:1920px;height:1200px;z-index:9000;display:none;" +
      "align-items:center;justify-content:center;background:rgba(0,0,0,.55)}" +
    "#conta-form{position:relative;width:1200px;height:1100px;box-sizing:border-box;background:#f4f4f4;border-radius:24px;color:#1f2224}" +
    "#conta-form .cl-titulo{position:absolute;left:130px;right:130px;top:42px;text-align:center;font-size:46px;line-height:60px;font-weight:500;white-space:nowrap;overflow:hidden}" +
    "#conta-form .cl-fechar{position:absolute;right:46px;top:36px;width:72px;height:72px;display:flex;align-items:center;justify-content:center}" +
    "#conta-form .cl-fechar svg{width:50px;height:50px}" +
    "#conta-form .cl-dica{position:absolute;left:88px;right:88px;top:116px;text-align:center;font-size:28px;line-height:38px;color:#8a8f94;white-space:nowrap;overflow:hidden}" +
    "#conta-form .cl-rot{position:absolute;left:88px;font-size:38px;line-height:50px;color:#1f2224}" +
    "#conta-form .cl-campo{position:absolute;left:88px;right:88px;height:108px;border-radius:10px;background:#e6e6e6;display:flex;align-items:center}" +
    "#conta-form .cl-campo input{flex:1;min-width:0;height:100%;border:0;background:transparent;padding:0 38px;font-size:42px;" +
      "color:#1f2224;outline:none;font-family:inherit;-webkit-user-select:text;user-select:text}" +
    "#conta-form .cl-campo input::placeholder{color:#9a9ea2}" +
    "#conta-form .cl-sel{padding:0 40px;height:100%;font-size:40px;font-weight:500;color:#3cb34a}" +
    "#conta-form .cl-link{font-size:38px;line-height:50px;font-weight:500;color:#3cb34a}" +
    "#conta-form #conta-esqueci{position:absolute;right:100px;top:588px}" +
    "#conta-form #conta-erro{position:absolute;left:88px;right:88px;top:660px;margin:0;font-size:32px;line-height:42px;color:#e5372e;display:none}" +
    "#conta-form #conta-entrar{position:absolute;left:88px;right:88px;top:782px;height:124px;border-radius:10px;background:#3cb34a;" +
      "color:#fff;font-size:46px;font-weight:500}" +
    "#conta-form #conta-entrar:disabled{opacity:.7}" +
    "#conta-form #conta-criar{position:absolute;left:0;right:0;top:978px;text-align:center}" +
    "#conta-form .cl-lista{position:absolute;left:88px;right:88px;top:366px;z-index:2;background:#fff;border-radius:10px;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.18);display:none;overflow:hidden}" +
    "#conta-form .cl-lista button{display:block;width:100%;text-align:left;padding:0 38px;height:96px;font-size:38px;border-bottom:1px solid #eee}" +
    "#conta-aviso{position:absolute;left:1220px;top:676px;width:650px;box-sizing:border-box;z-index:50;display:none;align-items:flex-start;" +
      "gap:26px;padding:30px 34px;background:#f2f2f2;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.25);text-align:left;" +
      "font-size:38px;line-height:54px;color:#1f2224}" +
    "#conta-aviso svg{flex:none;width:58px;height:52px;margin-top:2px}";

  function estilo() {
    if (document.getElementById("conta-estilo")) return;
    var s = document.createElement("style");
    s.id = "conta-estilo";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* e-mails que já entraram neste controle (só o e-mail, nunca a senha):
     é o "Selecione" do campo de e-mail do Agras */
  function emailsLembrados() { var l = ler(GUARDA_EMAILS); return Array.isArray(l) ? l.filter(function (e) { return typeof e === "string"; }) : []; }
  function lembrarEmail(email) {
    var l = emailsLembrados().filter(function (e) { return e !== email; });
    l.unshift(email);
    gravar(GUARDA_EMAILS, l.slice(0, 5));
  }

  function mensagem(texto, tipo) {
    var p = tela.querySelector("#conta-erro");
    p.textContent = texto || "";
    p.style.color = tipo === "info" ? "#555a5f" : "#e5372e";
    p.style.display = texto ? "block" : "none";
  }
  function fecharLista() { if (tela) tela.querySelector(".cl-lista").style.display = "none"; }

  function mostrarTela(txt) {
    if (!nativo) return;
    if (!tela) montarTela();
    tela.style.display = "flex";
    fecharLista();
    var sel = tela.querySelector(".cl-sel");
    sel.style.display = emailsLembrados().length ? "block" : "none";
    mensagem(txt || motivo, "erro");
    motivo = "";
    ajustarTextos();
    setTimeout(ajustarTextos, 60);
    setTimeout(ajustarTextos, 400);
  }
  /* título e aviso numa linha só: em inglês/espanhol a frase é maior e a
     letra diminui até caber (a tradução chega um instante depois) */
  function caber(no, maior, menor) {
    no.style.fontSize = maior + "px";
    for (var f = maior; f > menor && no.scrollWidth > no.clientWidth; f--) no.style.fontSize = (f - 1) + "px";
  }
  function ajustarTextos() {
    if (!tela) return;
    caber(tela.querySelector(".cl-titulo"), 46, 30);
    caber(tela.querySelector(".cl-dica"), 28, 20);
  }
  function esconderTela() { if (tela) { tela.style.display = "none"; fecharLista(); } }
  function telaAberta() { return !!tela && tela.style.display !== "none"; }

  function montarTela() {
    tela = document.createElement("div");
    tela.id = "conta-login";
    tela.innerHTML =
      '<form id="conta-form" autocomplete="on" novalidate>' +
        '<div class="cl-titulo">Entre com o e-mail e senha do simulador</div>' +
        '<button type="button" class="cl-fechar" aria-label="Fechar"><svg viewBox="0 0 48 48"><path d="M10 10 38 38M38 10 10 38" ' +
          'fill="none" stroke="#1f2224" stroke-width="3.4" stroke-linecap="round"/></svg></button>' +
        '<div class="cl-dica">Conta do site do Treinamento Piloto de Drone. Não use a senha da sua conta DJI.</div>' +
        '<label class="cl-rot" for="conta-email" style="top:196px">E-mail</label>' +
        '<div class="cl-campo" style="top:252px">' +
          '<input id="conta-email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="Campo obrigatório">' +
          '<button type="button" class="cl-sel">Selecione</button></div>' +
        '<div class="cl-lista"></div>' +
        '<label class="cl-rot" for="conta-senha" style="top:400px">Senha</label>' +
        '<div class="cl-campo" style="top:458px">' +
          '<input id="conta-senha" type="password" autocomplete="current-password" placeholder="Campo obrigatório"></div>' +
        '<button type="button" class="cl-link" id="conta-esqueci">Esqueceu a senha?</button>' +
        '<p id="conta-erro" role="alert"></p>' +
        '<button id="conta-entrar" type="submit">Entrar</button>' +
        '<div id="conta-criar"><button type="button" class="cl-link">Usuário novo? Criar conta</button></div>' +
      "</form>";
    var palco = document.getElementById("palco") || document.body;
    palco.appendChild(tela);
    var form = tela.querySelector("#conta-form"), botao = tela.querySelector("#conta-entrar");
    var campoEmail = tela.querySelector("#conta-email"), lista = tela.querySelector(".cl-lista");

    tela.querySelector(".cl-fechar").addEventListener("click", esconderTela);
    tela.querySelector(".cl-sel").addEventListener("click", function () {
      if (lista.style.display === "block") { fecharLista(); return; }
      lista.innerHTML = "";
      emailsLembrados().forEach(function (e) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = e;
        b.addEventListener("click", function () { campoEmail.value = e; fecharLista(); tela.querySelector("#conta-senha").focus(); });
        lista.appendChild(b);
      });
      lista.style.display = lista.firstChild ? "block" : "none";
    });
    tela.querySelector("#conta-esqueci").addEventListener("click", function () {
      mensagem("Para recuperar a senha, abra guridosdrones-treinamento.web.app no computador ou no celular e toque em \"Esqueci a senha\".", "info");
    });
    tela.querySelector("#conta-criar button").addEventListener("click", function () {
      mensagem("Para criar uma conta, abra guridosdrones-treinamento.web.app no computador ou no celular e toque em \"Cadastre-se\".", "info");
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      fecharLista();
      var email = campoEmail.value.trim(), senha = tela.querySelector("#conta-senha").value;
      if (!email || !senha) { mensagem("Digite o e-mail e a senha da conta do treinamento.", "erro"); return; }
      botao.disabled = true; botao.textContent = "Entrando…";
      entrar(email, senha).then(function () {
        tela.querySelector("#conta-senha").value = "";
        lembrarEmail(conta.email);
        mensagem("", "erro");
        esconderTela();
        atualizarAviso();
      }, function (e) { mensagem(e.message, "erro"); })
        .then(function () { botao.disabled = false; botao.textContent = "Entrar"; });
    });
  }

  /* aviso do canto do banner, só na tela inicial e só sem conta */
  function montarAviso() {
    if (aviso) return;
    var inicial = document.getElementById("t-inicial");
    if (!inicial) return;
    aviso = document.createElement("button");
    aviso.type = "button";
    aviso.id = "conta-aviso";
    aviso.innerHTML = '<svg viewBox="0 0 58 52"><path d="M29 3 55 49H3Z" fill="#e5372e" stroke="#e5372e" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M29 19v14" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="29" cy="41" r="3.2" fill="#fff"/></svg>' +
      "<span>Login expirou ou não está conectado. Fazer login novamente &gt;&gt;</span>";
    aviso.addEventListener("click", function () { mostrarTela(""); });
    inicial.appendChild(aviso);
  }
  function atualizarAviso() {
    if (!nativo) return;
    montarAviso();
    if (aviso) aviso.style.display = conta ? "none" : "flex";
  }

  /* sem conta, nenhum toque passa: o que não for a janelinha ou o aviso
     abre o "Entrar" (fase de captura da janela, antes de qualquer outro) */
  function doLogin(alvo) {
    return !!alvo && ((tela && tela.contains(alvo)) || (aviso && aviso.contains(alvo)));
  }
  function barrarToque(ev) {
    if (conta || doLogin(ev.target)) return;
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    if (ev.type === "click") { ev.preventDefault(); if (!telaAberta()) mostrarTela(""); }
  }
  function barrarTecla(ev) {
    if (conta || doLogin(ev.target)) return;
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    ev.preventDefault();
  }
  /* botões físicos do RC Plus (botoes.js: o Java chama rcplusBotao) */
  function travarBotoesFisicos() {
    var original = window.rcplusBotao;
    if (typeof original !== "function" || original.__contaControle) return;
    var envolto = function (nome, apertou) {
      if (!conta) { if (apertou && !telaAberta()) mostrarTela(""); return; }
      return original.apply(this, arguments);
    };
    envolto.__contaControle = true;
    window.rcplusBotao = envolto;
  }

  /* ------------------------------------------------------------ começo */
  if (nativo) {
    estilo();
    ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click", "dblclick", "contextmenu"].forEach(function (t) {
      window.addEventListener(t, barrarToque, { capture: true, passive: false });
    });
    window.addEventListener("keydown", barrarTecla, true);
    window.addEventListener("keyup", barrarTecla, true);

    var guardada = ler(GUARDA);
    if (guardada && /^[A-Za-z0-9]{1,128}$/.test(String(guardada.uid || "")) && guardada.refresh) {
      conta = guardada;
      avisarNativo(conta.uid);
      obterToken().catch(function () { /* sem rede: continua com a conta lembrada */ });
    } else {
      avisarNativo("");
    }
    var preparar = function () { travarBotoesFisicos(); atualizarAviso(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", preparar); else preparar();
    /* de 15 em 15 minutos confere se o servidor ainda aceita a conta */
    setInterval(function () { if (conta) obterToken(true).catch(function () { /* rede */ }); }, 15 * 60000);
  }

  return {
    ativo: nativo,
    logado: function () { return !!conta; },
    uid: function () { return conta ? conta.uid : ""; },
    email: function () { return conta ? conta.email : ""; },
    aparelho: aparelho,
    token: obterToken,
    sair: function () { sair(""); },
    mostrar: mostrarTela,
  };
})();
