/* Comportamento de treinamento descrito pelo operador em 03/10/2026.
 * Reserva de 60 s é referência interna do simulador, não autonomia DJI.
 * Instalar depois de manual/física. Não altera consumo, gotas ou radar.
 */
window.BATERIA = (function () {
  'use strict';
  function instalarNoCampo() {
    if (window.xgBateria) { window.xgBateria.rever(); return true; }
    if (typeof passo !== 'function' || typeof cair !== 'function') return false;
    var B = window.xgBateria = { baixa:false, critica:false, pousou:false, corte:false, zero:0, rthFeito:false };
    var sentidos = [];
    function limites() {
      var baixo = Number(P.xgBatBaixa), critico = Number(P.xgBatCritica);
      baixo = Number.isFinite(baixo) ? Math.max(2, Math.min(50, baixo)) : 20;
      critico = Number.isFinite(critico) ? Math.max(1, Math.min(baixo-1, critico)) : Math.min(5,baixo-1);
      return { baixa:baixo, critica:critico, rth:P.xgBatRth !== false };
    }
    function reset() {
      B.baixa=B.critica=B.pousou=B.corte=B.rthFeito=false; B.zero=0;
      sentidos.forEach(function(x){x.h.userData.sentido=x.s;});sentidos=[];
    }
    B.rever=function(){
      // Troca de bateria/novo treino. Não rearma o RTH apenas por assumir o manual.
      if(V.bat>limites().baixa && (B.baixa||B.corte||B.zero))reset();
    };
    B.estado=function(){B.rever();var l=limites();return {baixa:B.baixa,critica:B.critica,pousou:B.pousou,corte:B.corte,limiteBaixo:l.baixa,limiteCritico:l.critica,rth:l.rth};};
    var cairAntes=cair;
    cair=function(c){if(c && c.nome==='falta de bateria')return;return cairAntes.apply(this,arguments);};
    var reiniciarAntes=reiniciarVoo;
    reiniciarVoo=function(){var r=reiniciarAntes.apply(this,arguments);reset();return r;};
    function cortar() {
      B.corte=true;B.critica=false;B.baixa=false;
      V.vqx=V.estado==='manual'?(V.mvx||0):(V.v||0)*(V.dirx||0);
      V.vqz=V.estado==='manual'?(V.mvz||0):(V.v||0)*(V.dirz||0);
      V.estado='caiu';V.rodando=true;V.aplicando=false;V.vazaoAtual=0;V.retomar=null;
      V.motivo={nome:'',silenciosa:true};V.noChao=false;
      if(window.xgPulvManual){xgPulvManual.ligado=false;xgPulvManual.esgotar=false;}
      helices.forEach(function(h){sentidos.push({h:h,s:h.userData.sentido});h.userData.sentido=0;});
      fecharAlerta();
    }
    function quedaSemEnergia(dt) {
      if(V.noChao)return;
      var d=drone.position;V.vy=(V.vy||0)-9.81*dt;
      d.x+=(V.vqx||0)*dt;d.z+=(V.vqz||0)*dt;d.y+=V.vy*dt;
      inclina.rotation.x+=dt*.7;inclina.rotation.z+=dt*.4;
      var solo=alt(d.x,d.z);
      if(d.y<=solo+.2){d.y=solo+.2;V.vy=0;V.noChao=true;V.rodando=false;}
    }
    var passoAntes=passo;
    passo=function(dt){
      // O relógio do campo já suspende passo() durante a pausa do simulador.
      if(!(dt>0))return;
      B.rever();if(B.corte){quedaSemEnergia(dt);return;}
      if(V.estado==='caiu')return passoAntes.apply(this,arguments);
      var l=limites(),d=drone.position,ar=d.y>alt(d.x,d.z)+.05;
      // Suprime apenas a decisão fixa de bateria do legado; o consumo continua nele.
      V.avisoBat=true;
      B.baixa=V.bat<=l.baixa;B.critica=V.bat<=l.critica;
      if(B.critica&&ar&&V.rodando){
        if(V.estado!=='manual'){
          if(typeof xgGravarInterrupcao==='function')xgGravarInterrupcao();
          V.mvx=(V.v||0)*(V.dirx||0);V.mvz=(V.v||0)*(V.dirz||0);
          V.estado='manual';V.xgFreio=false;V.aplicando=false;
        }
      }else if(B.baixa&&ar&&V.rodando&&!B.rthFeito){
        B.rthFeito=true;
        if(l.rth && !['voltando','pousando'].includes(V.estado)){
          if(typeof xgGravarInterrupcao==='function')xgGravarInterrupcao();
          iniciarRetorno(V.retomar);fecharAlerta();
        }
      }
      var y=d.y, critico=B.critica&&ar&&V.rodando;
      // A altitude automática não deve vencer a descida de emergência.
      var stab=P.estab;if(critico)P.estab=false;
      try{passoAntes.apply(this,arguments);}finally{P.estab=stab;}
      if(critico&&V.estado!=='caiu'){
        var thr=Math.max(-1,Math.min(1,(window.xgManches&&xgManches.thr)||0));
        V.vy=thr*3-.8;d.y=Math.max(alt(d.x,d.z),y+V.vy*dt);delete V.xgAgl;
        if(d.y<=alt(d.x,d.z)+.01){
          d.y=alt(d.x,d.z);V.vy=0;V.v=0;V.mvx=V.mvz=0;V.rodando=false;V.aplicando=false;V.estado='em solo';B.pousou=true;
        }
      }
      if(V.bat<=0 && V.rodando){B.zero+=dt;if(B.zero>=60)cortar();}
      else if(V.bat>0)B.zero=0;
    };
    return true;
  }
  return { instalar:function(ponte){
    if(!ponte||!ponte.janela)return false;
    try{return ponte.janela.eval('('+instalarNoCampo.toString()+')()')===true;}
    catch(e){console.warn('Bateria do simulador:',e);return false;}
  }};
})();
