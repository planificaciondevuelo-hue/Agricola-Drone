/* Conversa do piloto com o auxiliar; o atendimento continua pertencendo a equipe.js. */
(function () {
  'use strict';
  if (document.getElementById('falar-auxiliar')) return;
  var textos = {
    pt: ['Falar com auxiliar', 'Encher tanque', 'Trocar bateria', 'Enche o tanque pra nós.', 'Troca a bateria porque tá acabando.', 'Tá bom.', 'Piloto', 'Auxiliar', 'Pouse e desligue os motores para chamar o auxiliar.', 'O auxiliar ainda não está disponível.', 'Fechar', 'Não foi possível tocar o áudio. Tente novamente.', 'Parar de abastecer', 'Pode parar de abastecer.', 'Ouvir novamente', 'Esvaziar tanque', 'Parar de esvaziar', 'Ligar o drone', 'Coloca a bateria e liga o drone.', 'Afastar do drone', 'Pode se afastar do drone, vou decolar.', 'O drone voltou. Troco a bateria ou encho o tanque?', 'O drone está sem bateria e com o tanque vazio. Coloco a bateria e ligo?', 'Andar a pé', 'Voltar à cadeira', 'Trocar bateria e encher tanque', 'Ligar o drone e encher tanque', 'Troca a bateria e enche o tanque.', 'Liga o drone e enche o tanque.', 'Ei, tô aqui!', 'Tá querendo me matar? Espera eu falar que terminei de encher o tanque!', 'Tá querendo me matar? Espera eu falar que terminei!', 'O tanque tá cheio, pode decolar.', 'A bateria tá trocada, pode decolar.', 'Bateria pronta e tanque cheio, pode decolar.', 'Pronto, o drone tá ligado.', 'Pronto, pode decolar.', 'Tá louco? Tira esse drone daqui!'],
    en: ['Talk to assistant', 'Fill tank', 'Change battery', 'Fill the tank for us, please.', 'Change the battery, it’s running low.', 'Okay.', 'Pilot', 'Assistant', 'Land and turn off the motors to call the assistant.', 'The assistant is not available yet.', 'Close', 'Could not play the audio. Please try again.', 'Stop refilling', 'You can stop refilling now.', 'Play again', 'Empty tank', 'Stop emptying', 'Turn on the drone', 'Put the battery in and turn on the drone.', 'Step away from the drone', 'You can step away from the drone, I’m taking off.', 'The drone is back. Should I change the battery or fill the tank?', 'The drone has no battery and the tank is empty. Shall I put the battery in and turn it on?', 'Walk around', 'Back to the chair', 'Change battery and fill tank', 'Turn on the drone and fill tank', 'Change the battery and fill the tank.', 'Turn on the drone and fill the tank.', 'Hey, I’m right here!', 'Are you trying to kill me? Wait until I say the tank is full!', 'Are you trying to kill me? Wait until I say I’m done!', 'The tank is full, you can take off.', 'The battery is changed, you can take off.', 'Battery ready and tank full, you can take off.', 'Done, the drone is on.', 'Done, you can take off.', 'Are you crazy? Get that drone away from me!'],
    es: ['Hablar con el auxiliar', 'Llenar tanque', 'Cambiar batería', 'Llénanos el tanque, por favor.', 'Cambia la batería, que se está agotando.', 'Está bien.', 'Piloto', 'Auxiliar', 'Aterriza y apaga los motores para llamar al auxiliar.', 'El auxiliar todavía no está disponible.', 'Cerrar', 'No se pudo reproducir el audio. Inténtalo de nuevo.', 'Dejar de llenar', 'Puedes dejar de llenar el tanque.', 'Escuchar de nuevo', 'Vaciar tanque', 'Dejar de vaciar', 'Encender el dron', 'Pon la batería y enciende el dron.', 'Alejarse del dron', 'Puedes alejarte del dron, voy a despegar.', 'El dron volvió. ¿Cambio la batería o lleno el tanque?', 'El dron no tiene batería y el tanque está vacío. ¿Pongo la batería y lo enciendo?', 'Caminar', 'Volver a la silla', 'Cambiar batería y llenar tanque', 'Encender el dron y llenar tanque', 'Cambia la batería y llena el tanque.', 'Enciende el dron y llena el tanque.', '¡Ey, estoy aquí!', '¿Me quieres matar? ¡Espera a que te diga que terminé de llenar el tanque!', '¿Me quieres matar? ¡Espera a que te diga que terminé!', 'El tanque está lleno, puedes despegar.', 'La batería está cambiada, puedes despegar.', 'Batería lista y tanque lleno, puedes despegar.', 'Listo, el dron está encendido.', 'Listo, puedes despegar.', '¿Estás loco? ¡Saca ese dron de aquí!']
  };
  var idioma = 'pt', pedido = null, erro = 0, semAudio = false, geracao = 0, tocando = null, ultimo = null, audios = {};
  /* 12/10/2026: conversa em texto (pedidos sem MP3 e a pergunta do auxiliar) e a primeira pergunta da operacao */
  var conversaTexto = null, perguntouInicio = false;
  /* 18/11/2026 (Eduardo: "as vozes voce pode gerar por ia mesmo so tava estranho o tom" -> Voz B no auxiliar; "e eles tem que falar todas as
     frases que estao la"): todos os pedidos e as duas perguntas do auxiliar tem MP3 (ferramentas/gerar_vozes_auxiliar_20261118.py). */
  var COM_AUDIO = ['tanque', 'bateria', 'parar', 'esvaziar', 'parar-esvaziar', 'ligar', 'afastar', 'completo-trocar', 'completo-ligar', 'pergunta-voltou', 'pergunta-inicio'];
  /* 19/11/2026 (Eduardo, testando o P60): falas que so o auxiliar diz, pedidas pelo campo em xgEquipe.fala (equipe.js): o grito e a bronca
     quando mandam decolar com ele abastecendo, o aviso de que terminou ("pode decolar") e o grito com o drone voando em cima dele no manual.
     O numero e o indice do texto; o MP3 tem o mesmo nome da chave (ferramentas/gerar_vozes_auxiliar_20261119.py). */
  var FALAS = { 'aqui': 29, 'matar-tanque': 30, 'matar': 31, 'pronto-tanque': 32, 'pronto-bateria': 33, 'pronto-completo': 34, 'pronto-ligar': 35, 'pronto': 36, 'louco': 37 };
  var VERSAO_FALAS = '20261119-falas';
  COM_AUDIO = COM_AUDIO.concat(Object.keys(FALAS));
  var caixa = document.createElement('section');
  caixa.id = 'falar-auxiliar'; caixa.setAttribute('data-sem-traducao', ''); caixa.hidden = true;
  caixa.innerHTML = '<button type="button" id="auxiliar-abrir" aria-expanded="false" aria-controls="auxiliar-opcoes"></button>' +
    '<button type="button" id="piloto-andar" aria-pressed="false" hidden></button>' +
    '<div id="auxiliar-fala" role="status" aria-live="assertive" hidden></div>' +
    '<div id="auxiliar-opcoes" hidden><div class="auxiliar-acoes"><button type="button" data-pedido="completo"></button><button type="button" data-pedido="ligar"></button><button type="button" data-pedido="tanque"></button><button type="button" data-pedido="esvaziar" hidden></button><button type="button" data-pedido="bateria"></button><button type="button" data-pedido="parar"></button><button type="button" data-pedido="afastar"></button><button type="button" id="auxiliar-fechar">×</button></div>' +
    '<div id="auxiliar-dialogo" role="status" aria-live="polite" hidden></div><small id="auxiliar-audio" role="status" hidden></small><button type="button" id="auxiliar-repetir" hidden></button></div>';
  var estilo = document.createElement('style');
  estilo.textContent = '#falar-auxiliar{position:fixed;left:10px;top:180px;z-index:1005;max-width:calc(100vw - 20px);font:13px/1.4 system-ui;color:#f3f7f1;text-align:left}' +
    '#falar-auxiliar[hidden],#falar-auxiliar [hidden]{display:none!important}#falar-auxiliar button{font:600 13px system-ui;min-height:36px;border:1px solid #8dac7c;border-radius:7px;background:#183527;color:#fff;padding:7px 10px;cursor:pointer;touch-action:manipulation}' +
    '#falar-auxiliar button:focus-visible{outline:3px solid #c0ee8c;outline-offset:2px}#auxiliar-opcoes{margin-top:6px;padding:10px;background:rgba(15,32,23,.96);border:1px solid #698560;border-radius:9px;width:300px;max-width:calc(100vw - 20px);box-sizing:border-box;text-align:left;max-height:45vh;overflow:auto}' +
    '.auxiliar-acoes{display:flex;flex-wrap:wrap;gap:6px;align-items:center}#auxiliar-fechar{margin-left:auto}#auxiliar-dialogo p{margin:8px 0 0}#auxiliar-audio{display:block;margin-top:8px;color:#e6cf96}@media(max-height:450px){#auxiliar-opcoes{max-height:55vh}#falar-auxiliar button{min-height:32px;padding:5px 8px;font-size:12px}}';
  estilo.textContent += '#piloto-andar{display:block;margin-top:6px}';
  estilo.textContent += '#auxiliar-fala{margin-top:6px;padding:8px 10px;background:rgba(15,32,23,.96);border:1px solid #c0ee8c;border-radius:9px;width:300px;max-width:calc(100vw - 20px);box-sizing:border-box}';
  document.head.appendChild(estilo); document.body.appendChild(caixa);
  var abrir = caixa.querySelector('#auxiliar-abrir'), menu = caixa.querySelector('#auxiliar-opcoes'), dialogo = caixa.querySelector('#auxiliar-dialogo'), andarBtn = caixa.querySelector('#piloto-andar');
  var balao = caixa.querySelector('#auxiliar-fala'), balaoIndice = 0, balaoTimer = 0;
  function mostrarBalao() {
    var t = textos[idioma] || textos.pt;
    balao.hidden = !balaoIndice; balao.textContent = '';
    if (!balaoIndice) return;
    var b = document.createElement('b'); b.textContent = t[7] + ': ';
    balao.appendChild(b); balao.appendChild(document.createTextNode(t[balaoIndice]));
  }
  function atualizarTexto() {
    idioma = window.TPD_IDIOMAS ? TPD_IDIOMAS.atual() : 'pt';
    if (!textos[idioma]) idioma = 'pt';
    var t = textos[idioma];
    mostrarBalao();
    abrir.textContent = t[0]; caixa.setAttribute('aria-label', t[0]);
    caixa.querySelector('[data-pedido="tanque"]').textContent = t[1];
    caixa.querySelector('[data-pedido="bateria"]').textContent = t[2];
    caixa.querySelector('[data-pedido="ligar"]').textContent = t[17];
    var qc = equipe();
    caixa.querySelector('[data-pedido="completo"]').textContent = t[qc && qc.semBateria ? 26 : 25];   // 17/10/2026: bateria + tanque no mesmo roteiro do auxiliar
    caixa.querySelector('[data-pedido="afastar"]').textContent = t[19];
    atualizarEsvaziar();
    atualizarAndar();
    caixa.querySelector('#auxiliar-fechar').setAttribute('aria-label', t[10]);
    dialogo.hidden = !erro && !conversaTexto;
    dialogo.textContent = '';
    if (erro) dialogo.textContent = t[erro];
    else if (conversaTexto) conversaTexto.forEach(function (l) {
      var p = document.createElement('p'), b = document.createElement('b');
      b.textContent = t[l[0]] + ': '; p.appendChild(b); p.appendChild(document.createTextNode(t[l[1]])); dialogo.appendChild(p);
    });
    var aviso = caixa.querySelector('#auxiliar-audio'); aviso.hidden = !semAudio; aviso.textContent = t[11];
    var repetir = caixa.querySelector('#auxiliar-repetir'); repetir.hidden = !semAudio; repetir.textContent = t[14];

  }
  function equipe() {
    try { var f = document.getElementById('campo'), j = f && f.contentWindow; return j && j.xgEquipe && j.xgEquipe.pode ? j.xgEquipe : null; }
    catch (_) { return null; }
  }
  /* cada botao so aparece quando o auxiliar pode fazer aquilo agora (equipe.js, xgEquipe.pode) */
  function atualizarBateria() {
    var q = equipe();
    ['completo', 'ligar', 'tanque', 'bateria', 'afastar'].forEach(function (id) {
      caixa.querySelector('[data-pedido="' + id + '"]').hidden = !(q && q.pode(id));
    });
    var bc = caixa.querySelector('[data-pedido="completo"]'), tc = textos[idioma] || textos.pt;
    bc.textContent = tc[q && q.semBateria ? 26 : 25];                  // "Ligar o drone e encher tanque" no comeco, "Trocar bateria e encher tanque" depois
    return !caixa.querySelector('[data-pedido="bateria"]').hidden;
  }
  function estadoEsvaziar() {
    try {
      var f = document.getElementById('campo'), j = f && f.contentWindow;
      return { permitido: !!(window.APP_RCPLUS && APP_RCPLUS.mapeamentoDisponivel()),
        ativo: !!(j && j.xgEquipe && j.xgEquipe.tarefa.esvaziar),
        volume: j ? j.eval('V.tan') : NaN };
    } catch (_) { return { permitido: false, ativo: false, volume: NaN }; }
  }
  function atualizarEsvaziar() {
    var e = estadoEsvaziar(), t = textos[idioma];
    var b = caixa.querySelector('[data-pedido="esvaziar"]');
    b.textContent = t[15];
    var q = equipe();
    b.hidden = !e.permitido || e.ativo || !Number.isFinite(e.volume) || e.volume <= 0 || !(q && q.pode('esvaziar'));
    var parar = caixa.querySelector('[data-pedido="parar"]');
    parar.textContent = t[e.ativo ? 16 : 12];
    parar.hidden = !(q && q.pode('parar'));
    return e;
  }
  /* 16/10/2026 (Eduardo): botao para o piloto levantar da cadeira e andar (equipe.js, xgEquipe.andar).
     A pe ele anda com os mesmos comandos do drone, olha com o mouse e faz sozinho o servico do
     auxiliar (bateria, ligar, abastecer) com a tecla E. So aparece com o drone parado no chao. */
  function atualizarAndar() {
    var q = equipe(), t = textos[idioma] || textos.pt, aPe = !!(q && q.aPe);
    andarBtn.hidden = !(q && q.podeAndar && q.podeAndar());
    andarBtn.textContent = aPe ? t[24] : t[23];
    andarBtn.setAttribute('aria-pressed', String(aPe));
    abrir.hidden = aPe;                                  // a pe nao ha o que falar com o auxiliar
    return !andarBtn.hidden;
  }
  andarBtn.onclick = function () {
    var q = equipe(), f = document.getElementById('campo'), j = f && f.contentWindow;
    if (!q || !j || (window.PAUSA_SIM && PAUSA_SIM.pausado)) return;
    fechar(); cancelarVoz(); conversaTexto = null; erro = 0;
    var ligar = !q.aPe;
    if (q.andar(ligar) && ligar) { try { if (j.xgAndar && j.xgAndar.travar) j.xgAndar.travar(); } catch (_) { /* arrastar com o botao esquerdo */ } }
    atualizarTexto(); andarBtn.blur();
    try { j.focus(); } catch (_) { /* segue */ }
  };
  /* a tecla E interage (equipe.js); antes dos botoes do controle, onde E e o L2 do holofote */
  function teclaE(e, desceu) {
    if (e.code !== 'KeyE') return;
    var alvo = e.target; if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
    var q = equipe(); if (!q || !q.aPe || (window.PAUSA_SIM && PAUSA_SIM.pausado)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (desceu && !e.repeat && q.interagir) q.interagir();
  }
  window.addEventListener('keydown', function (e) { teclaE(e, true); }, true);
  window.addEventListener('keyup', function (e) { teclaE(e, false); }, true);
  function conversaVR(ativa) {
    var j = document.getElementById('campo')?.contentWindow;
    if (j?.xgEquipe?.conversar) j.xgEquipe.conversar(ativa);
  }
  function fechar() { menu.hidden = true; abrir.setAttribute('aria-expanded', 'false'); conversaVR(false); }
  abrir.onclick = function () { menu.hidden = !menu.hidden; abrir.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) menu.querySelector('button').focus(); };
  caixa.querySelector('#auxiliar-fechar').onclick = function () { fechar(); abrir.focus(); };
  caixa.addEventListener('keydown', function (e) { if (e.key === 'Escape') { fechar(); abrir.focus(); } e.stopPropagation(); });
  ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend'].forEach(function (tipo) { caixa.addEventListener(tipo, function (e) { e.stopPropagation(); }); });
  // Um unico MP3 inclui o pedido e a resposta; play ocorre no proprio toque,
  // sem depender de vozes do sistema nem de uma segunda permissao de autoplay.
  function obterAudio(tipo) {
    var chave = idioma + '-' + tipo;
    if (!audios[chave]) {
      var a = new Audio('audio/auxiliar/' + chave + '.mp3?v=' + (FALAS[tipo] ? VERSAO_FALAS : '20261118-voz-b'));
      a.preload = 'auto'; audios[chave] = a;
    }
    return audios[chave];
  }
  function prepararAudios() { COM_AUDIO.forEach(obterAudio); }
  /* 18/11/2026 (Eduardo: "a fala da pessoa tem que sair depois o auxiliar se movimentar"): enquanto o pedido do piloto e a
     resposta tocam, o auxiliar fica parado, virado para o piloto (xgEquipe.conversar, o mesmo da conversa aberta); so quando
     a fala termina ele sai para o servico. Sem som (falha, pausa, fala cortada) ele e solto na hora; o relogio e a garantia. */
  var segurando = false, seguraTimer = 0;
  function soltarAuxiliar() {
    if (!segurando) return;
    segurando = false; clearTimeout(seguraTimer);
    conversaVR(false);
  }
  function segurarAuxiliar(a) {
    var q = equipe();
    if (!q || !q.conversar) return;
    segurando = true; clearTimeout(seguraTimer);
    q.conversar(true);
    var ms = isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 + 300 : 9000;
    seguraTimer = setTimeout(soltarAuxiliar, Math.min(15000, ms));
  }
  function somCalado() { try { return localStorage.getItem('tpd_sons') === '0'; } catch (_) { return false; } }
  window.addEventListener('som-simulador', function () { if (tocando) tocando.muted = somCalado(); });
  function cancelarVoz() {
    geracao++;
    if (tocando) { tocando.pause(); tocando.currentTime = 0; tocando = null; }
    soltarAuxiliar();
  }
  /* toca um MP3 da conversa; avisarFalha = mostra "Nao foi possivel tocar o audio" (so quando o aluno pediu a fala);
     segurar = o auxiliar espera a fala terminar antes de se mexer */
  function tocar(chave, avisarFalha, segurar) {
    var token = geracao;
    function falhou() { if (token !== geracao) return; soltarAuxiliar(); if (!avisarFalha) return; semAudio = true; atualizarTexto(); }
    try {
      var a = obterAudio(chave); tocando = a;
      /* 19/11/2026: com o botao "Som" da tela desligado (sons_dji.js, tpd_sons = "0") a fala toca CALADA: o auxiliar espera o
         mesmo tempo antes de sair, so nao se ouve */
      a.volume = 1; a.muted = somCalado(); a.currentTime = 0;
      a.onerror = falhou;
      a.onended = function () { if (token === geracao) { tocando = null; soltarAuxiliar(); } };
      var inicio = a.play(); if (inicio && inicio.catch) inicio.catch(falhou);
      if (segurar) segurarAuxiliar(a);
    } catch (_) { falhou(); }
  }
  function falar(tipo, segurar) {
    cancelarVoz(); semAudio = false;
    var qq = equipe(), chave = tipo;
    /* ligar, afastar e o pedido completo continuam mostrando o texto da conversa, e agora tambem falam */
    conversaTexto = tipo === 'ligar' ? [[6, 18], [7, 5]] : tipo === 'afastar' ? [[6, 20], [7, 5]] :
      tipo === 'completo' ? [[6, qq && qq.tarefa.ligar ? 28 : 27], [7, 5]] : null;
    if (tipo === 'completo') chave = qq && qq.tarefa.ligar ? 'completo-ligar' : 'completo-trocar';
    if (conversaTexto) { menu.hidden = false; abrir.setAttribute('aria-expanded', 'true'); }
    if (COM_AUDIO.indexOf(chave) < 0) { atualizarTexto(); return; }
    ultimo = tipo;
    tocar(chave, true, !!segurar);
    atualizarTexto();
  }
  caixa.querySelector('#auxiliar-repetir').onclick = function () {
    if (ultimo && !(window.PAUSA_SIM && PAUSA_SIM.pausado)) falar(ultimo);
  };
  caixa.querySelectorAll('[data-pedido]').forEach(function (b) { b.onclick = function () {
    fechar(); abrir.focus();
    if (window.PAUSA_SIM && PAUSA_SIM.pausado) return;
    atualizarBateria();
    if (b.hidden) return;
    var retirada = atualizarEsvaziar();
    if (b.dataset.pedido === 'esvaziar' && (!retirada.permitido || retirada.ativo || !Number.isFinite(retirada.volume) || retirada.volume <= 0)) return;
    cancelarVoz(); erro = 0; pedido = null; semAudio = false; conversaTexto = null;
    var f = document.getElementById('campo'), j = f && f.contentWindow, tipo = b.dataset.pedido;
    try {
      if (!j || !j.xgEquipe || !j.xgEquipe.b) erro = 9;
      else if (tipo === 'esvaziar') {
        // A ponte confere a autorizacao privada de mapeamento antes de chamar a equipe.
        APP_RCPLUS.executar({ c: 'badeco', v: 'esvaziar' });
        if (j.xgEquipe.tarefa.esvaziar) pedido = tipo;
        else erro = 8;
      }
      else if (!j.xgEquipe.pedir(tipo)) erro = 8;
      else pedido = tipo === 'parar' && retirada.ativo ? 'parar-esvaziar' : tipo;
    } catch (_) { erro = 9; }
    atualizarTexto(); if (pedido) falar(pedido, true);
  }; });
  window.addEventListener('tpd:idioma', function () { cancelarVoz(); semAudio = false; ultimo = null; atualizarTexto(); prepararAudios(); });
  window.addEventListener('pausa-simulador', function (e) { if (e.detail) { cancelarVoz(); fechar(); } });
  window.addEventListener('pagehide', cancelarVoz);
  document.addEventListener('visibilitychange', function () { if (document.hidden) cancelarVoz(); });
  function reservarEspaco() {
    if (window.__auxiliarLayout || typeof layoutControle !== 'function') return;
    window.__auxiliarLayout = true;
    var anterior = layoutControle;
    layoutControle = function () {
      anterior();
      if (vista !== 'controle' || !window.__auxiliarTopo) return;
      var c = rcCaixa, topo = window.__auxiliarTopo;
      if (!c || c.y >= topo) return;
      var escala = Math.min(1, Math.max(80, innerHeight - topo - 48) / c.h);
      var x = (innerWidth - c.w * escala) / 2;
      c.sx = x + (c.sx - c.x) * escala; c.sy = topo + (c.sy - c.y) * escala;
      c.x = x; c.y = topo; c.w *= escala; c.h *= escala; c.sw *= escala; c.sh *= escala;
      Object.assign(document.getElementById('vCtrlRc').style, {left:c.x+'px', top:c.y+'px', width:c.w+'px', height:c.h+'px'});
      Object.assign(document.getElementById('tela').style, {left:c.sx+'px', top:c.sy+'px', width:c.sw+'px', height:c.sh+'px'});
    };
  }
  function posicionar() {
    atualizarBateria();
    atualizarEsvaziar();
    atualizarAndar();
    try {
      var f = document.getElementById('campo'), j = f && f.contentWindow;
      var noCampo = window.XG && XG.ponte && XG.ponte.estado().tela === 'campo';
      var ocultar = !noCampo || !j || !j.xgEquipe || !j.xgEquipe.b;
      if (ocultar) {
        if (!caixa.hidden) {
          fechar(); cancelarVoz();
          if (caixa.contains(document.activeElement)) document.activeElement.blur();
        }
        caixa.hidden = true;
        if (j && j.__auxiliarTopo) { j.__auxiliarTopo = 0; j.eval('layoutControle()'); }
        return;
      }
      caixa.hidden = false;
      var clima = document.getElementById('meteorologia'), topo = clima ? clima.getBoundingClientRect().bottom + 10 : 150;
      j.__auxiliarTopo = topo + 44 - f.getBoundingClientRect().top;
      if (!j.__auxiliarLayout) j.eval('(' + reservarEspaco.toString() + ')()');
      j.eval('layoutControle()');
      var rc = j.document.getElementById('vCtrlRc'), v = j.document.getElementById('vCtrl');
      var r = rc && rc.getBoundingClientRect(), visivel = v && !v.hidden && j.getComputedStyle(v).display !== 'none';
      if (visivel && r && r.width) topo = Math.max(topo, f.getBoundingClientRect().top + r.top - 84);
      caixa.style.top = Math.min(innerHeight - 48, topo) + 'px';
    } catch (_) { caixa.hidden = true; }
  }
  function perguntar(indice) {
    conversaTexto = [[7, indice]]; erro = 0;
    menu.hidden = false; abrir.setAttribute('aria-expanded', 'true');
    atualizarTexto();
    /* a pergunta tambem e falada; sem um toque do aluno antes o navegador pode recusar o som, e ai fica so o texto */
    cancelarVoz(); semAudio = false;
    if (!(window.PAUSA_SIM && PAUSA_SIM.pausado)) tocar(indice === 22 ? 'pergunta-inicio' : 'pergunta-voltou', false);
  }
  /* 19/11/2026 (Eduardo: "quando o badeco chega perto pra brigar o som do drone baixa"): enquanto a fala do auxiliar toca, o motor fica baixo */
  var abafaTimer = 0;
  function abafarDrone(ms) {
    clearTimeout(abafaTimer);
    try { if (window.xgSons && xgSons.abafar) xgSons.abafar(ms > 0); } catch (_) { /* sem som */ }
    if (ms > 0) abafaTimer = setTimeout(function () { abafarDrone(0); }, ms);
  }
  function dizer(chave) {
    var i = FALAS[chave]; if (!i) return;
    balaoIndice = i; mostrarBalao();
    clearTimeout(balaoTimer); balaoTimer = setTimeout(function () { balaoIndice = 0; mostrarBalao(); }, 7000);
    cancelarVoz(); semAudio = false;
    if (!(window.PAUSA_SIM && PAUSA_SIM.pausado)) {
      tocar(chave, false);
      var a = tocando, ms = a && isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 + 500 : 5200;
      abafarDrone(Math.min(8000, ms));
    }
  }
  function conferirPergunta() {
    var q = equipe();
    if (!q || !q.b || caixa.hidden) return;
    if (q.fala) { var f = q.fala; q.fala = null; dizer(f); return; }
    if (!perguntouInicio && q.semBateria && q.estado === 'aguardando') { perguntouInicio = true; perguntar(22); return; }
    if (q.pergunta) { q.pergunta = false; perguntar(21); }
  }
  window.FALAR_AUXILIAR_VR = {
    estado: function () {
      atualizarBateria(); atualizarEsvaziar();
      return { disponivel: !caixa.hidden, aberto: !menu.hidden, titulo: textos[idioma][0], aviso: erro ? textos[idioma][erro] : '',
        opcoes: Array.from(caixa.querySelectorAll('[data-pedido]')).filter(b => !b.hidden).map(b => ({id:b.dataset.pedido,texto:b.textContent})).concat(semAudio ? [{id:'repetir',texto:textos[idioma][14]}] : [], [{id:'fechar',texto:textos[idioma][10]}]) };
    },
    acionar: function (id) {
      if (id === 'fechar') { fechar(); return; }
      if (caixa.hidden || (window.PAUSA_SIM && PAUSA_SIM.pausado)) return;
      if (id === 'abrir') { menu.hidden = false; abrir.setAttribute('aria-expanded','true'); conversaVR(true); return; }
      if (id === 'repetir') { caixa.querySelector('#auxiliar-repetir').click(); fechar(); return; }
      var b = Array.from(caixa.querySelectorAll('[data-pedido]')).find(b => b.dataset.pedido === id && !b.hidden);
      if (b) b.click();
    },
    fechar: fechar
  };
  atualizarTexto(); prepararAudios(); posicionar(); setInterval(function () { posicionar(); conferirPergunta(); }, 250);
})();
