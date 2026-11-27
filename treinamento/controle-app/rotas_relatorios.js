/* Relatórios RC Plus de 03/10: planejamento A-B e estados de tarefa.
 * Separado de mapa.js, que também está recebendo a marcação de campos.
 * A gravação não determina os limites angulares nem a extensão da rota A-B:
 * nesta versão de treinamento as passadas são finitas e configuráveis.
 */
(function () {
  'use strict';
  var AB = window.ROTA_AB = { ativa: false, a: null, b: null, lado: 1, esp: 6, passadas: 20 };
  var tipoAdicao = 'campo';
  function aviso(t) { avisoInfo(t); return false; }
  function podeMarcar() {
    var E = APP.E, v = E && E.v;
    if (!APP.conectado || !v || !E.d) return aviso('Aeronave desconectada');
    if (v.estado !== 'manual' || (E.sens && E.sens.chao)) return aviso('Marque os pontos em voo manual');
    if (v.temRota && v.retomar) return aviso('Encerre a tarefa atual antes de marcar a rota A-B');
    if (!(v.tanque > .05)) return aviso('Não é possível adicionar o ponto A ou B quando o tanque está vazio');
    if (Math.abs(v.velocidade || 0) * 3.6 > 3) return aviso('Velocidade de voo muito alta. Não é possível adicionar ponto');
    return true;
  }
  AB.marcar = function (letra) {
    if (!AB.ativa) return false;
    if (!podeMarcar()) return false;
    if (letra === 'b' && !AB.a) return aviso('Defina o ponto A primeiro');
    var p = [APP.E.d.x, APP.E.d.z], outro = letra === 'a' ? AB.b : AB.a;
    if (outro && Math.hypot(p[0] - outro[0], p[1] - outro[1]) < 1) return aviso('Os pontos A e B estão muito próximos');
    AB[letra] = p;
    avisoInfo('Ponto ' + letra.toUpperCase() + ' definido com sucesso');
    montar(); return true;
  };
  AB.tarefa = function () {
    if (!AB.a || !AB.b) return null;
    var a = AB.a, b = AB.b, len = Math.hypot(b[0]-a[0], b[1]-a[1]);
    if (len < 1) return null;
    var nx = -(b[1]-a[1])/len * AB.lado, nz = (b[0]-a[0])/len * AB.lado;
    var esp = Math.max(1.6, Math.min(59.03, AB.esp)), n = Math.max(1, Math.min(100, Math.round(AB.passadas)));
    function desloc(p, d) { return [p[0]+nx*d, p[1]+nz*d]; }
    // Meia faixa de cada lado: os centros da primeira passada são A e B.
    return { id: 'ab-' + Date.now(), nome: 'Rota A-B', modo: 'rota', obs: [], margem: 0,
      limite: [desloc(a,-esp/2),desloc(b,-esp/2),desloc(b,(n-.5)*esp),desloc(a,(n-.5)*esp)],
      esp: esp, ang: Math.atan2(b[1]-a[1], b[0]-a[0]), seg: [0,100], cob: 'Somente rota', sentido: 'horario',
      ab: { a:a.slice(), b:b.slice(), lado:AB.lado, passadas:n } };
  };
  AB.abrir = function () {
    if (M.sub === 'execucao') return aviso('Encerre a tarefa atual antes de planejar outra rota');
    AB.ativa = true; M.modo = 'rota'; M.sub = 'lista'; M.sel = null; M.exec = null; M.voo = null;
    fecharFlutuantes(); montar();
  };
  AB.iniciar = function () {
    if (!podeMarcar()) return;
    var t = AB.tarefa(); if (!t) return aviso('Defina os pontos A e B');
    AB.ativa = false;
    M.tarefas.push(t); salvarTarefas(); M.aba = 'Tarefa'; usar(t);
    // A confirmação continua sendo a mesma usada pelas tarefas de campo.
    iniciarComConferencia();
  };
  function limpar() {
    dialogo({ icone:'alerta', titulo:'Excluir pontos de ajuste A e B?', botoes:[
      {t:'Cancelar(R2)'}, {t:'Limpar(R3)',cls:'verm',fn:function(){ AB.a=null;AB.b=null;montar(); }}] });
  }
  function menuTipo(e) {
    if(e)e.stopPropagation();
    fecharFlutuantes();
    var menu = el('div', 'janelinha rota-ab-tipo');
    menu.setAttribute('role','menu');
    menu.setAttribute('aria-label','Tipo de tarefa');
    menu.appendChild(el('div','tit','Tipo'));
    [['campo','Campos'],['ab','Rota A-B']].forEach(function(opcao){
      var b=botao('bt-claro',opcao[1],function(){
        tipoAdicao=opcao[0];fecharFlutuantes();montarDireita();
      });
      b.setAttribute('role','menuitemradio');
      b.setAttribute('aria-checked',String(tipoAdicao===opcao[0]));
      menu.appendChild(b);
    });
    PALCO.appendChild(menu);
    var bt=e&&e.currentTarget || $('#dir-centro .linha-add .bt-icone');
    if(bt){
      var r=bt.getBoundingClientRect(),p=PALCO.getBoundingClientRect(),k=APP.escala||1;
      var centro=(r.left+r.width/2-p.left)/k;
      var esquerda=Math.max(12,Math.min(centro-menu.offsetWidth/2,PALCO.clientWidth-menu.offsetWidth-12));
      menu.style.left=esquerda+'px';
      menu.style.top=Math.max(132,(r.top-p.top)/k-menu.offsetHeight-24)+'px';
      menu.style.setProperty('--seta',(centro-esquerda)+'px');
    }
  }
  var direitaAntes = montarDireita;
  montarDireita = function () {
    direitaAntes();
    if (AB.ativa) {
      var dc=$('#dir-centro'), ac=$('#acoes'); dc.innerHTML=''; ac.innerHTML=''; dc.style.top='375px';
      ['a','b'].forEach(function(k){
        var b=botao('bt-claro',k.toUpperCase()+'⊕',function(){AB.marcar(k);});
        b.setAttribute('aria-label','Definir ponto '+k.toUpperCase());
        b.style.cssText='width:216px;height:110px;color:#d638da;font-size:52px;display:block;margin-bottom:14px';
        dc.appendChild(b);
      });
      dc.appendChild(botao('bt-claro','⇄',function(){AB.lado*=-1;desenharTudo();}));
      ac.appendChild(acao('i-sair','Sair',function(){AB.ativa=false;montar();}));
      ac.appendChild(acao('i-x','Limpar',limpar));
      ac.appendChild(acao('i-iniciar','Iniciar',AB.iniciar,!(AB.a&&AB.b)));
    } else if (M.modo==='rota' && M.sub==='lista' && !M.sel) {
      var linha=$('#dir-centro .linha-add');
      if(linha) {
        // Substituir os dois listeners: o seletor escolhe; Adicionar executa.
        var seletor=linha.firstElementChild.cloneNode(true);
        linha.firstElementChild.replaceWith(seletor);
        seletor.onclick=menuTipo;
        seletor.title='Tipo de tarefa: '+(tipoAdicao==='ab'?'Rota A-B':'Campos');
        seletor.setAttribute('aria-label',seletor.title);
        seletor.setAttribute('aria-haspopup','menu');
        if(tipoAdicao==='ab')seletor.innerHTML='<span style="color:#CC11E4;font-size:38px;font-weight:600">A-B</span>';
        var adicionar=linha.lastElementChild.cloneNode(true);
        linha.lastElementChild.replaceWith(adicionar);
        adicionar.onclick=function(){fecharFlutuantes();if(tipoAdicao==='ab')AB.abrir();else editar(null);};
      }
    } else if(M.sub==='execucao' && APP.E && APP.E.v) {
      var v=APP.E.v, ac=$('#acoes');
      if(APP.E.tarefaPreparada && v.estado==='manual') {
        ac.innerHTML='';
        ac.appendChild(acao('i-sair','Sair',sairExecucao));
        ac.appendChild(acao('i-iniciar','Iniciar',function(){iniciarComConferencia();}));
      } else if(['pairando','reabastecendo','manual'].includes(v.estado) && v.retomar) {
        ac.innerHTML='';
        ac.appendChild(acao('i-encerrar','Encerrar',function(){dialogo({icone:'alerta',titulo:'Finalizar tarefa atual?',botoes:[{t:'Cancelar(R2)'},{t:'Encerrar(R3)',cls:'verm',fn:function(){cmd('encerrar');}}]});}));
        ac.appendChild(acao('i-iniciar','Retomar',function(){cmd('retomar',{alvo:alvoRetorno()});}));
      }
    }
    montarDireita._k=chaveDireita();
  };
  var painelAntes=montarPainel;
  montarPainel=function(){
    if(!AB.ativa)return painelAntes();
    var p=$('#painel');p.innerHTML='';
    p.appendChild(el('div','titulo','Rota A-B'));
    var r=el('div','rolagem'); abaTarefa(r,false);
    r.appendChild(passoEd('Espaçamento de rota','m',AB,'esp',.01,2,1.6,59.03,desenharTudo));
    r.appendChild(passoEd('Passadas','',AB,'passadas',1,0,1,100,desenharTudo));
    p.appendChild(r);
  };
  var desenhoAntes=desenharTudo;
  desenharTudo=function(){
    desenhoAntes();var velho=$('#previa-rota-ab');if(velho)velho.remove();
    if(!AB.ativa)return;
    var svg=document.createElementNS('http://www.w3.org/2000/svg','g');svg.id='previa-rota-ab';svg.style.pointerEvents='none';
    var h='',k=1/M.vista.k,t=AB.tarefa();
    if(t){var desenho=desenharRotaPts(rotaPlanejada(t,t.ang),k,{});h+=desenho.r+desenho.m;}
    ['a','b'].forEach(function(s){if(!AB[s])return;var p=paraPx(AB[s][0],AB[s][1]);h+='<g transform="translate('+p.join(' ')+') scale('+k+')"><circle r="23" fill="#d638da"/><text text-anchor="middle" y="11" font-size="34" fill="white">'+s.toUpperCase()+'</text></g>';});
    svg.innerHTML=h;VISTA.appendChild(svg);
  };
  var barraAntes=atualizarBarra;
  atualizarBarra=function(){
    barraAntes();var E=APP.E,v=E&&E.v;if(!APP.conectado||!v||v.estado==='caiu')return;
    var t=null;
    if(AB.ativa)t=AB.a?'Planejamento no modo Rota A-B':'Modo manual';
    else if(M.sub==='execucao'){
      if(v.estado==='manual')t=E.sens&&E.sens.chao?'Tarefa pausada. Aeronave em espera':'Tarefa pausada. Modo manual';
      else if(v.estado==='pairando')t='Tarefa pausada. Voo estacionário';
      else if(v.estado==='voltando')t=E.mapeamento&&E.mapaMissao&&E.mapaMissao.completa?'Retornando à base':'Tarefa pausada. Retornando à base';
      else if(v.estado==='reabastecendo')t='Tarefa pausada. Aeronave em espera';
      else if(['aplicando','indo','descendo'].includes(v.estado))t=E.mapeamento?'Tarefa em andamento. Modo de mapeamento':'Tarefa em andamento. Modo de rota';
    }
    if(t&&!(E.protecao&&E.protecao.bloqueioDecolagem))$('#estado-voo').textContent=t;
  };
  var chaveAntes=chaveDireita;
  chaveDireita=function(){return chaveAntes()+'|'+AB.ativa+'|'+!!(APP.E&&APP.E.tarefaPreparada)+'|'+!!(APP.E&&APP.E.v&&APP.E.v.retomar);};
  // Trocar o modo encerra somente a edição A-B; não interfere no mapeamento.
  document.querySelectorAll('.cartao-modo').forEach(function(b){b.addEventListener('click',function(){AB.ativa=false;montar();});});
  montar();
})();
