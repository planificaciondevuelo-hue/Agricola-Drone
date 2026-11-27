/* Os dois tutoriais acompanham o idioma compartilhado do site. */
(function () {
  'use strict';
  var base = new URL('.', document.currentScript.src);
  var traducoes = {
    'Como usar o controle do drone no simulador | Guri dos Drones': ['How to use your drone controller in the simulator | Guri dos Drones', 'Cómo usar el control del dron en el simulador | Guri dos Drones'],
    'Como usar o controle do drone no simulador': ['How to use your drone controller in the simulator', 'Cómo usar el control del dron en el simulador'],
    'Veja como conectar o RC Plus, transferir e instalar o APK e encontrar o código do seu controle.': ['Learn to connect the RC Plus, transfer and install the APK, and find your controller code.', 'Aprende a conectar el RC Plus, transferir e instalar el APK y encontrar el código de tu control.'],
    'Tutorial de instalação do aplicativo no RC Plus, narrado e legendado em português': ['RC Plus installation tutorial, with English narration and captions', 'Tutorial de instalación en RC Plus, con narración y subtítulos en español'],
    'Seu navegador não reproduz este vídeo.': ['Your browser cannot play this video.', 'Tu navegador no puede reproducir este video.'],
    'Abrir o tutorial em MP4': ['Open the MP4 tutorial', 'Abrir el tutorial en MP4'],
    'Voltar aos drones': ['Back to drones', 'Volver a los drones'],
    'Com narração e legendas · velocidade 1,5×': ['Narration and captions · 1.5× speed', 'Narración y subtítulos · velocidad 1,5×'],
    'Seu primeiro voo no simulador': ['Your first simulator flight', 'Tu primer vuelo en el simulador'],
    'Tutorial em 1,5×. Seu tempo de prática fica pausado enquanto você assiste.': ['Tutorial at 1.5× speed. Your practice time is paused while you watch.', 'Tutorial a velocidad 1,5×. Tu tiempo de práctica queda pausado mientras lo ves.'],
    'Seu tempo de prática fica pausado enquanto você assiste.': ['Your practice time is paused while you watch.', 'Tu tiempo de práctica queda pausado mientras lo ves.'],
    'Não foi possível carregar o vídeo. Você pode começar a prática e tentar novamente pelo botão do tutorial.': ['The video could not load. You can start practicing and try again using the tutorial button.', 'No se pudo cargar el video. Puedes comenzar a practicar e intentarlo de nuevo con el botón del tutorial.'],
    'Pular e começar a prática': ['Skip and start practicing', 'Omitir y comenzar a practicar'],
    'Voltar à prática': ['Back to practice', 'Volver a la práctica'],
    'Toque em reproduzir para assistir.': ['Tap Play to watch.', 'Toca Reproducir para ver el video.'],
    'Você já operou um drone agrícola?': ['Have you operated an agricultural drone before?', '¿Ya has operado un dron agrícola?'],
    'Se esta é sua primeira vez, veja um tutorial antes de começar a prática.': ['If this is your first time, watch a tutorial before you start practicing.', 'Si es tu primera vez, mira un tutorial antes de comenzar a practicar.'],
    'Nunca operei — ver tutorial': ['Never — watch tutorial', 'Nunca — ver tutorial'],
    'Já operei — começar': ['Yes — get started', 'Sí — comenzar'],
    'Ver tutorial novamente': ['Watch tutorial again', 'Ver el tutorial de nuevo']
  };
  // O tradutor mantém referência a este catálogo; não substituir o objeto.
  if (window.TPD_TRADUCOES) Object.assign(window.TPD_TRADUCOES, traducoes);
  function idioma() {
    var v = window.TPD_IDIOMAS && TPD_IDIOMAS.atual();
    if (!v) { try { v = localStorage.getItem('tpd_idioma'); } catch (_) {} }
    v = String(v || 'pt').toLowerCase().split(/[-_]/)[0];
    return ['en', 'es'].includes(v) ? v : 'pt';
  }
  function arquivo(tipo, extensao) {
    var nome = tipo === 'install' ? 'instalar-rc-plus' : 'primeiro-voo';
    var lang = idioma();
    // Tutorial do primeiro voo de 14/10/2026: velocidade normal, com capa nos três idiomas.
    if (tipo !== 'install') return new URL('tutorial-primeiro-voo' + (lang === 'pt' ? '' : '-' + lang) + '.' + extensao, base).href;
    if (extensao === 'jpg' && lang === 'pt') return tipo === 'install' ? new URL('instalar-rc-plus-capa.jpg', base).href : '';
    return new URL(nome + (lang === 'pt' ? '' : '-' + lang) + '-1-5x.' + extensao, base).href;
  }
  function ligar(video, tipo) {
    var atual, metadata;
    // O vídeo novo não é mais acelerado; o aviso do diálogo (tutorial_primeiro_voo.js) ainda diz 1,5×.
    if (tipo !== 'install' && video.parentNode) video.parentNode.querySelectorAll('p').forEach(function (p) {
      if (/1[,.]5×/.test(p.textContent)) p.textContent = 'Seu tempo de prática fica pausado enquanto você assiste.';
    });
    function trocar() {
      var lang = idioma(); if (lang === atual) return;
      var continuar = atual && !video.paused && !video.ended;
      var fracao = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0;
      atual = lang;
      if (metadata) video.removeEventListener('loadedmetadata', metadata);
      metadata = function () {
        if (Number.isFinite(video.duration) && fracao > 0) video.currentTime = Math.min(.97, fracao) * video.duration;
        if (continuar) video.play().catch(function () { /* controles continuam disponíveis */ });
      };
      video.addEventListener('loadedmetadata', metadata, { once: true });
      video.src = arquivo(tipo, 'mp4');
      video.dataset.idioma = lang;
      var poster = arquivo(tipo, 'jpg');
      if (poster) video.poster = poster; else video.removeAttribute('poster');
      video.querySelectorAll('source').forEach(function (s) { s.src = video.src; });
      video.querySelectorAll('a').forEach(function (a) { a.href = video.src; });
      video.load();
    }
    trocar();
    window.addEventListener('tpd:idioma', trocar);
    return function () { window.removeEventListener('tpd:idioma', trocar); if (metadata) video.removeEventListener('loadedmetadata', metadata); };
  }
  function seletor(alvo) {
    var label = document.createElement('label'); label.setAttribute('translate', 'no');
    label.style.cssText = 'display:block;margin:8px 0 16px;font:14px system-ui';
    label.textContent = '🌐 '; var select = document.createElement('select');
    select.setAttribute('aria-label', 'Idioma / Language / Idioma');
    select.style.cssText = 'font:inherit;padding:6px;border-radius:6px;background:#1c3025;color:#fff;border:1px solid #73917d';
    [['pt','Português'],['en','English'],['es','Español']].forEach(function (par) {
      var opt = document.createElement('option'); opt.value = par[0]; opt.textContent = par[1]; select.appendChild(opt);
    });
    select.dataset.tutorialIdioma = 'true';
    select.value = idioma(); select.onchange = function () { TPD_IDIOMAS.definir(select.value); };
    label.appendChild(select); alvo.appendChild(label);
  }
  window.TPD_TUTORIAIS = { idioma: idioma, arquivo: arquivo, ligar: ligar, seletor: seletor };
  window.addEventListener('tpd:idioma', function () {
    document.querySelectorAll('[data-tutorial-idioma]').forEach(function (s) { s.value = idioma(); });
  });
  if (window.TPD_IDIOMAS) TPD_IDIOMAS.traduzir();
  document.querySelectorAll('video[data-tutorial]').forEach(function (v) { ligar(v, v.dataset.tutorial); });
})();
