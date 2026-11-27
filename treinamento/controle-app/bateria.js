/* Configuração e alarme de bateria DJI; limites enviados ao simulador. */
(function(){
  'use strict';
  var C=window.BATERIA_RC={};
  function valores(){
    var l=CFG.local;
    return {xgBatBaixa:l.batBaixa==null?20:l.batBaixa,xgBatCritica:l.batCritica==null?5:l.batCritica,
      xgBatRth:l['g:Advertência|RTH']!==0};
  }
  function salvar(){guardar('cfgLocal',CFG.local);cmd('p',{v:valores()});}
  var ajustesAntes=ajustesLocais;
  ajustesLocais=function(){return Object.assign(ajustesAntes(),valores());};
  var blocoAntes=blocoCfg;
  blocoCfg=function(b){
    if(CFG.pag!=='bateria')return blocoAntes(b);
    var v=valores();
    if(b.t==='grupo'&&b.ops[0]==='Advertência'){
      var e=blocoAntes(b);e.addEventListener('click',salvar);return e;
    }
    if(b.t==='tit'&&b.x.includes('Com bateria fraca ('))return el('div','cfg-tit','Com bateria fraca (abaixo de <span style="color:#f08a24">'+v.xgBatBaixa+'%</span>)');
    if(b.t==='lt'&&b.x.includes('Bateria muito fraca'))return el('div','cfg-lin','<span class="cfg-tit">Bateria muito fraca (abaixo de '+v.xgBatCritica+'%)</span><span style="font-size:32px">Aterrissagem</span>');
    if(b.t==='desc'&&b.x.includes('Quando o nível da bateria estiver baixo'))return el('p','cfg-desc','O controle emite avisos sonoros. Com RTH selecionado, a aeronave retorna à base; assumir o manual cancela o retorno e mantém os avisos sonoros.');
    if(b.t==='desc'&&b.x.includes('muito baixo'))return el('p','cfg-desc','A aeronave inicia o pouso forçado. Mantenha o manche de subida acionado para contrariar a descida.');
    if(b.t==='faixaDupla'){
      var box=el('div','faixa-pad');
      [['batBaixa','Bateria fraca',v.xgBatBaixa,2,50],['batCritica','Bateria muito fraca',v.xgBatCritica,1,49]].forEach(function(x){
        var row=el('label','cfg-lin');row.style.cssText='display:block;padding:20px 0;font-size:32px';
        row.innerHTML='<span>'+x[1]+' <b>'+x[2]+'%</b></span><input aria-label="'+x[1]+'" type="range" min="'+x[3]+'" max="'+x[4]+'" value="'+x[2]+'" style="width:100%;height:60px;accent-color:#f08a24">';
        var input=$('input',row);input.addEventListener('input',function(){
          var n=Number(input.value),a=valores();
          if(x[0]==='batBaixa'){CFG.local.batBaixa=n;CFG.local.batCritica=Math.min(a.xgBatCritica,n-1);}
          else CFG.local.batCritica=Math.min(n,a.xgBatBaixa-1);
          input.value=CFG.local[x[0]];$('b',row).textContent=input.value+'%';salvar();
        });
        input.addEventListener('change',montarCfg);box.appendChild(row);
      });return box;
    }
    return blocoAntes(b);
  };
  var alertasAntes=alertasAtuais;
  alertasAtuais=function(){
    var l=alertasAntes().filter(function(a){return a.id!=='bat'&&a.id!=='bat2';});
    if(!APP.conectado||!APP.E||!APP.E.v)return l;
    var b=APP.E.bateria,v=valores(),pct=APP.E.v.bateria;
    if(b&&b.pousou)l.push({id:'bat-pouso',tipo:'vermelho',txt:'Pouso forçado por bateria'});
    else if(b?b.critica:pct<=v.xgBatCritica)l.push({id:'bat2',tipo:'vermelho',txt:'Pouso forçado por bateria. Mantenha o manche para cima para contrariar a descida'});
    else if(b?b.baixa:pct<=v.xgBatBaixa)l.push({id:'bat',tipo:'vermelho',txt:'Nível da bateria baixo. Retorne à base ou pouse imediatamente'});
    return l;
  };
  var contexto=null,ultimo=0;
  function desbloquear(){
    try{if(!contexto){var A=window.AudioContext||window.webkitAudioContext;if(A)contexto=new A();}if(contexto&&contexto.state==='suspended')contexto.resume().catch(function(){});}catch(e){}
  }
  document.addEventListener('pointerdown',desbloquear);document.addEventListener('keydown',desbloquear);
  C.alarmeAtivo=function(){
    if(!APP.conectado||!APP.E||!APP.E.v)return false;
    var b=APP.E.bateria;
    return b?!!(b.baixa||b.critica):APP.E.v.bateria<=valores().xgBatBaixa;
  };
  function apitar(){
    if(!C.alarmeAtivo()||Date.now()-ultimo<900)return;
    ultimo=Date.now();if(!contexto||contexto.state!=='running')return;
    try{if(localStorage.getItem('tpd_sons')==='0')return;}catch(e){}   // 19/11/2026: botao "Som" da tela do simulador (sons_dji.js)
    var o=contexto.createOscillator(),g=contexto.createGain(),t=contexto.currentTime;
    o.frequency.value=APP.E.bateria&&APP.E.bateria.critica?1500:1100;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.1,t+.015);g.gain.setValueAtTime(.1,t+.16);g.gain.linearRampToValueAtTime(0,t+.2);
    o.connect(g);g.connect(contexto.destination);o.start(t);o.stop(t+.21);
  }
  ouvir('estado',apitar);ouvir('conexao',function(v){if(v)salvar();});
})();
