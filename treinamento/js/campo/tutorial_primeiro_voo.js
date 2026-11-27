/* Ajuda inicial DJI. O histórico da conta determina o limite, nunca o saldo. */
(function () {
  'use strict';
  var url = new URLSearchParams(location.search), drone = url.get('drone');
  /* 14/10/2026 (pedido do Eduardo): no T25/T50 o "Como jogar" da tela inicial abre este tutorial,
     a qualquer momento; a pergunta e o botao "Ver tutorial novamente" seguem so nos 10 primeiros minutos */
  var t25t50 = ['t25', 't50'].includes(drone || (url.get('marca') === 'dji' && url.get('modelo')) || '');
  if (!t25t50) return;
  var minutos = 0, chave, dialogo, botao, video, pausaAnterior = false, primeira = false;
  var aguardando = false, encerrado = false, desligarIdioma;
  var css = document.createElement('style');
  css.textContent = '#primeiro-voo-dialogo{box-sizing:border-box;width:min(960px,96vw);max-height:94vh;overflow:auto;background:#14271e;color:#f3f7f1;border:1px solid #47694d;border-radius:16px;padding:24px;font:16px Asap,Segoe UI,sans-serif}' +
    '#primeiro-voo-dialogo::backdrop{background:rgba(5,13,9,.9)}#primeiro-voo-dialogo h2{margin:0 0 12px;font-size:25px}#primeiro-voo-dialogo video{display:block;width:100%;max-height:65vh;background:#000;margin:16px 0}' +
    '#primeiro-voo-dialogo button{padding:12px 18px;border-radius:10px;border:1px solid #73ad59;background:#244534;color:#fff;font:600 16px inherit;cursor:pointer;margin:6px}#primeiro-voo-dialogo .principal{background:#7cc955;color:#102014}' +
    '#rever-primeiro-voo{position:fixed;left:116px;bottom:12px;z-index:9000;padding:8px 12px;border:1px solid #83988b;border-radius:10px;background:#14271e;color:#fff;font:600 14px Asap,Segoe UI,sans-serif;cursor:pointer}@media(max-width:600px){#rever-primeiro-voo{bottom:58px;left:12px}}';
  document.head.appendChild(css);
  function guardar(valor) { if (!chave) return; try { localStorage.setItem(chave, valor); } catch (_) {} }
  function resposta() { try { return localStorage.getItem(chave); } catch (_) { return null; } }
  function pausar() {
    pausaAnterior = !!(window.PAUSA_SIM && PAUSA_SIM.pausado);
    if (window.PAUSA_SIM) PAUSA_SIM.definir(true);
  }
  function fechar() {
    if (desligarIdioma) { desligarIdioma(); desligarIdioma = null; }
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video = null; }
    if (dialogo) { dialogo.close(); dialogo.remove(); dialogo = null; }
    if (window.PAUSA_SIM) PAUSA_SIM.definir(pausaAnterior);
  }
  function criar(titulo) {
    pausar();
    dialogo = document.createElement('dialog'); dialogo.id = 'primeiro-voo-dialogo';
    dialogo.setAttribute('aria-labelledby', 'primeiro-voo-titulo');
    var h = document.createElement('h2'); h.id = 'primeiro-voo-titulo'; h.textContent = titulo; dialogo.appendChild(h);
    dialogo.addEventListener('cancel', function (e) { e.preventDefault(); });
    ['keydown','keyup','keypress'].forEach(function (tipo) { dialogo.addEventListener(tipo, function (e) { e.stopPropagation(); }); });
    document.body.appendChild(dialogo); dialogo.showModal();
    if (window.TPD_TUTORIAIS) TPD_TUTORIAIS.seletor(dialogo);
  }
  function texto(t) { var p = document.createElement('p'); p.textContent = t; dialogo.appendChild(p); return p; }
  function acao(t, fn, principal) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = t;
    if (principal) b.className = 'principal'; b.onclick = fn; dialogo.appendChild(b); return b;
  }
  function entrarVirtual() {
    if (aguardando) return;
    aguardando = true;
    var limite = Date.now() + 60000;
    function tentar() {
      var j = window.XG && XG.ponte && XG.ponte.janela;
      var pronto = document.getElementById('carregando');
      if (j && j.document.getElementById('bComecar') && pronto && pronto.classList.contains('esconder')) {
        CONTROLE_REAL.usarVirtual();
        var seletor = j.document.querySelector('[data-manches="virtual"]');
        if (seletor) seletor.click();
        if (j.eval('typeof telaInicial !== "undefined" && telaInicial')) {
          j.document.getElementById('bComecar').click();
          j.eval("document.getElementById('painel').hidden=true;definirVista('drone')");
        }
        aguardando = false; return;
      }
      if (Date.now() < limite) setTimeout(tentar, 200); else aguardando = false;
    }
    tentar();
  }
  function assistir(inicial, sempre) {
    if (dialogo || (!sempre && (encerrado || minutos >= 10))) return;
    primeira = inicial;
    criar('Seu primeiro voo no simulador');
    texto('Seu tempo de prática fica pausado enquanto você assiste.');
    video = document.createElement('video'); video.controls = true; video.playsInline = true;
    // O arquivo já foi acelerado: playbackRate continua em 1 para não duplicar a velocidade.
    video.preload = 'metadata'; dialogo.appendChild(video);
    if (window.TPD_TUTORIAIS) desligarIdioma = TPD_TUTORIAIS.ligar(video, 'flight');
    else video.src = 'tutoriais/tutorial-primeiro-voo.mp4';
    function continuar() { var iniciar = primeira; guardar('assistido'); fechar(); if (iniciar) entrarVirtual(); }
    video.addEventListener('ended', continuar);
    var aviso = texto(''); aviso.setAttribute('role', 'status');
    video.addEventListener('error', function () { aviso.textContent = 'Não foi possível carregar o vídeo. Você pode começar a prática e tentar novamente pelo botão do tutorial.'; });
    acao(inicial ? 'Pular e começar a prática' : 'Voltar à prática', continuar);
    var play = video.play(); if (play) play.catch(function () { aviso.textContent = 'Toque em reproduzir para assistir.'; });
  }
  function perguntar() {
    criar('Você já operou um drone agrícola?');
    texto('Se esta é sua primeira vez, veja um tutorial antes de começar a prática.');
    acao('Nunca operei — ver tutorial', function () { guardar('iniciante'); fechar(); assistir(true); }, true);
    acao('Já operei — começar', function () { guardar('experiente'); fechar(); });
  }
  function encerrar() {
    encerrado = true; if (botao) { botao.remove(); botao = null; }
    if (dialogo) fechar();
  }
  /* "Como jogar" fica no campo (iframe, que pode recarregar): o clique abre o video em vez da lista */
  setInterval(function () {
    var c = document.getElementById('campo'), d;
    try { d = c && c.contentDocument; } catch (_) { return; }
    var s = d && d.querySelector('details.como > summary');
    if (!s || s.dataset.tutorial) return;
    s.dataset.tutorial = '1';
    s.addEventListener('click', function (e) { e.preventDefault(); assistir(false, true); });
  }, 700);
  if (!drone || !window.TREINO_AUTORIZADO) return;
  window.addEventListener('treino-minuto-registrado', function () { minutos++; if (minutos >= 10) encerrar(); });
  TREINO_AUTORIZADO.then(function () {
    var conta = CONTAS.atual(); if (!conta) return;
    minutos = Math.max(CONTAS.minutosTreinados(conta), (conta.treinos || []).reduce(function (s, t) { return s + (Number(t.minutos) || 0); }, 0));
    if (minutos >= 10 || conta.testeGratisConcluidoEm) { encerrar(); return; }
    chave = 'tpd_primeiro_voo_v1:' + (conta.uid || conta.email);
    botao = document.createElement('button'); botao.id = 'rever-primeiro-voo'; botao.type = 'button';
    botao.textContent = 'Ver tutorial novamente'; botao.onclick = function () { assistir(false); }; document.body.appendChild(botao);
    if (minutos === 0 && !resposta() && !new URLSearchParams(location.search).has('retomar')) perguntar();
  }).catch(function () { /* a tela de autorização já explica o problema */ });
})();
