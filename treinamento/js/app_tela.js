/* Tela cheia, instalacao e confirmacao de saida. Nao bloqueia gestos do sistema. */
(function () {
  'use strict';
  const sim=location.pathname.endsWith('/sim.html')&&!!document.getElementById('campo');
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Mac/i.test(navigator.platform)&&navigator.maxTouchPoints>1);
  const movel=window.DISPOSITIVO_SIM?DISPOSITIVO_SIM.movel:ios||/Android/i.test(navigator.userAgent);
  const instalado=()=>navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
  const cheia=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const podeTela=()=>!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
  let convite=null,dialogo=null,botao=null,saidaLiberada=false;
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();convite=e;atualizarInstalar();});
  addEventListener('appinstalled',()=>{convite=null;atualizarInstalar();});

  const css=document.createElement('style');
  css.textContent='#app-tela-abrir{background:#132630;color:#fff;border:1px solid #637785;border-radius:8px;min-height:40px;padding:8px 12px;font:600 13px system-ui;cursor:pointer;margin:12px 0}' +
    'body.app-tela-sim #app-tela-abrir{position:fixed;right:12px;top:12px;width:44px;height:40px;padding:0;margin:0;z-index:55;font-size:12px}' +
    '#app-tela-dialogo{box-sizing:border-box;width:min(420px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;border:1px solid #50674e;border-radius:14px;padding:22px;background:#17281f;color:#f3f7f1;font:15px/1.45 system-ui}' +
    '#app-tela-dialogo::backdrop{background:#080f0bdd}#app-tela-dialogo h2{font:700 21px system-ui;margin:0 0 12px}#app-tela-dialogo p{margin:10px 0}#app-tela-dialogo ol{padding-left:22px}' +
    '#app-tela-dialogo button{font:600 14px system-ui;min-height:42px;border-radius:8px;border:1px solid #83988b;background:#244534;color:#fff;padding:10px 14px;cursor:pointer}' +
    '#app-tela-dialogo .app-tela-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}#app-tela-dialogo .principal{background:#7cc955;color:#102014}#app-tela-dialogo button[hidden]{display:none}' +
    '#app-tela-dialogo small{display:block;color:#b9c8bb;margin-top:12px}' +
    'html.xg-dispositivo-movel #medidor{left:12px;right:66px;top:12px;transform:none;font-size:11px;gap:6px;padding:6px 9px;min-height:40px;border-radius:12px}' +
    'html.xg-dispositivo-movel #medidor>span:first-child{min-width:0;flex:1}html.xg-dispositivo-movel #medidor>a{padding:4px}';
  document.head.appendChild(css);
  if(sim)document.body.classList.add('app-tela-sim');

  function abrir(titulo,conteudo){
    if(dialogo)return null;
    const pausadoAntes=!!(window.PAUSA_SIM&&PAUSA_SIM.pausado),foco=document.activeElement;
    if(sim&&window.PAUSA_SIM)PAUSA_SIM.definir(true);
    const d=document.createElement('dialog');d.id='app-tela-dialogo';
    d.setAttribute('aria-labelledby','app-tela-titulo');
    d.innerHTML='<h2 id="app-tela-titulo"></h2>'+conteudo;
    d.querySelector('h2').textContent=titulo;
    document.body.appendChild(d);dialogo=d;
    d.addEventListener('close',()=>{
      d.remove();dialogo=null;
      if(!saidaLiberada){
        if(sim&&window.PAUSA_SIM)PAUSA_SIM.definir(pausadoAntes);
        if(foco&&foco.isConnected)foco.focus();
      }
    },{once:true});
    d.showModal();return d;
  }
  function atualizarInstalar(){
    if(!dialogo)return;
    const b=dialogo.querySelector('#app-tela-instalar');if(b)b.hidden=!convite||instalado();
  }
  function opcoes(){
    let instrucao=instalado()?'<p>Você já está usando o simulador como app.</p>':ios?
      '<p>Para abrir sem as barras do Safari:</p><ol><li>Toque em <b>Compartilhar</b> no Safari.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Ative <b>Abrir como App da Web</b>, se aparecer, e toque em Adicionar.</li><li>Depois, abra pelo ícone <b>Simulador</b>.</li></ol>':
      '<p>Instale pelo botão abaixo ou pelo menu do navegador: <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>';
    instrucao+=ios?'<p>Para evitar sair acidentalmente, ative <b>Ajustes → Acessibilidade → Acesso Guiado</b>. Mantenha <b>Movimento e Toque</b> habilitados para usar o VR e os controles.</p>':
      '<p>No Android, use <b>Fixar app</b> nas configurações do aparelho para evitar trocar de app acidentalmente.</p>';
    instrucao+='<small>O bloqueio de saída é ativado no próprio celular. O simulador precisa de internet.</small>';
    if(sim&&!instalado())instrucao+='<small>Para recuperar este treino, volte pelo mesmo navegador ou ícone que está usando agora.</small>';
    const d=abrir('Tela do simulador',instrucao+'<p id="app-tela-status" role="status"></p><div class="app-tela-acoes"><button id="app-tela-cheia" class="principal">Tela cheia</button><button id="app-tela-instalar">Instalar app</button><button id="app-tela-fechar">'+(sim?'Voltar ao treino':'Fechar')+'</button></div>');
    if(!d)return;
    const tela=d.querySelector('#app-tela-cheia');tela.hidden=!podeTela();tela.textContent=cheia()?'Sair da tela cheia':'Tela cheia';
    tela.onclick=async()=>{
      try{
        if(cheia())await (document.exitFullscreen||document.webkitExitFullscreen).call(document);
        else await (document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen).call(document.documentElement);
        d.close();
      }catch(_){d.querySelector('#app-tela-status').textContent='O navegador não permitiu tela cheia. Use a opção de adicionar à Tela de Início.';}
    };
    d.querySelector('#app-tela-instalar').onclick=async()=>{
      const pedido=convite;if(!pedido)return;convite=null;atualizarInstalar();
      try{await pedido.prompt();await pedido.userChoice;}catch(_){d.querySelector('#app-tela-status').textContent='Use o menu do navegador para instalar o simulador.';}
    };
    d.querySelector('#app-tela-fechar').onclick=()=>d.close();atualizarInstalar();
  }
  if(movel){
    botao=document.createElement('button');botao.id='app-tela-abrir';botao.type='button';
    botao.textContent=sim?'Tela':'Instalar simulador';botao.setAttribute('aria-label','Tela cheia e instalação do simulador');botao.onclick=opcoes;
    (sim?document.body:document.querySelector('.acesso__caixa,main .pilha,main')||document.body).appendChild(botao);
  }
  if(!sim)return;
  const inicioCampo=document.createElement('button');
  inicioCampo.id='app-voltar-inicio';inicioCampo.type='button';inicioCampo.textContent='‹ Tela inicial';
  inicioCampo.setAttribute('aria-label','Voltar à tela inicial do simulador');inicioCampo.hidden=true;
  css.textContent+='#app-voltar-inicio{position:fixed;right:12px;top:174px;z-index:55;background:#17281f;color:#f3f7f1;border:1px solid #83988b;border-radius:8px;padding:9px 12px;font:600 13px system-ui;cursor:pointer;min-height:40px}#app-voltar-inicio[hidden]{display:none!important}html.xg-dispositivo-movel #app-voltar-inicio{top:158px}';
  document.body.appendChild(inicioCampo);
  const atualizarInicio=()=>{inicioCampo.hidden=!window.PAUSA_SIM?.emOperacao||!!PAUSA_SIM.pausado;};
  addEventListener('operacao-simulador',atualizarInicio);addEventListener('pausa-simulador',atualizarInicio);atualizarInicio();
  inicioCampo.onclick=()=>{
    if(!window.PAUSA_SIM?.emOperacao)return;
    const d=abrir('Voltar à tela inicial do simulador?','<p>A operação será salva neste navegador antes de voltar à escolha do cenário e do controle. Você poderá recuperá-la por <b>Continuar de onde parou</b> na sua conta.</p><p id="app-tela-status" role="status"></p><div class="app-tela-acoes"><button id="app-inicio-cancelar" class="principal" autofocus>Continuar no campo</button><button id="app-inicio-confirmar">Salvar e voltar</button></div>');
    if(!d)return;
    d.querySelector('#app-inicio-cancelar').onclick=()=>d.close();
    d.querySelector('#app-inicio-confirmar').onclick=async()=>{
      const b=d.querySelector('#app-inicio-confirmar');b.disabled=true;
      try{
        const campo=document.getElementById('campo')?.contentWindow;
        if(typeof campo?.abrirInicio!=='function'||!window.RETOMADA_SIM)throw Error('Aguarde o carregamento.');
        if(await RETOMADA_SIM.salvar()!==true)throw Error('Salvamento não concluído.');
        if(!d.open)return;
        campo.abrirInicio();d.close();atualizarInicio();
      }catch(_){d.querySelector('#app-tela-status').textContent='Não foi possível salvar e voltar. Continue no campo e tente novamente.';b.disabled=false;}
    };
  };
  function emTreino(){
    const carga=document.getElementById('carregando');
    return !!(window.XG&&(!carga||carga.classList.contains('esconder'))&&!document.getElementById('medidor-fim'));
  }
  document.addEventListener('click',e=>{
    const link=e.target.closest&&e.target.closest('#medidor a,.guia__voltar');
    if(!link||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||!emTreino())return;
    e.preventDefault();
    const d=abrir('Sair do treino?','<p>Vamos salvar sua operação neste navegador. Para voltar depois, use <b>Continuar de onde parou</b> na tela inicial.</p><p id="app-tela-status" role="status"></p><div class="app-tela-acoes"><button id="app-tela-cancelar" class="principal" autofocus>Continuar no treino</button><button id="app-tela-sair">Salvar e sair</button></div>');
    if(!d)return;
    d.querySelector('#app-tela-cancelar').onclick=()=>d.close();
    d.querySelector('#app-tela-sair').onclick=async()=>{
      const b=d.querySelector('#app-tela-sair');b.disabled=true;
      try{if(window.RETOMADA_SIM)await RETOMADA_SIM.salvar();if(!d.open)return;saidaLiberada=true;d.close();location.assign(link.href);}
      catch(_){d.querySelector('#app-tela-status').textContent='Não foi possível salvar. Continue no treino e tente novamente antes de sair.';b.disabled=false;}
    };
  },true);
  // Protecao adicional quando o navegador oferece beforeunload; sem prender o historico.
  addEventListener('beforeunload',e=>{if(!saidaLiberada&&emTreino()){e.preventDefault();e.returnValue='';}});
  addEventListener('pageshow',()=>{saidaLiberada=false;});
})();
