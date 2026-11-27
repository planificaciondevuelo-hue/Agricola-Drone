/* VR conserva a interface original. So a entrada imersiva vem das maos. */
(function(){
  "use strict";
  let campo=null,manual=null;
  const api=window.XG_VR={
    get ativo(){return !!(campo&&campo.ativo);},
    get imersivo(){return !!(campo&&campo.imersivo);}
  };
  const css=document.createElement("style");
  css.textContent="body.tpd-vr-imersivo> :not(#campo):not(script):not(style){opacity:0!important;pointer-events:none!important}";
  document.head.appendChild(css);
  function limpar(){
    if(!manual)return;
    manual.teclas={};manual.mouse={esq:null,dir:null};manual.csc=0;manual.desligando=0;manual.pulvDesde=0;manual.botoesAntes=0;
    const a=window.XG&&XG.aparelho();if(a){a.comandos={esq:{x:0,y:0},dir:{x:0,y:0}};a.aplicarManches();}
  }
  function instalar(){
    const x=window.XG;
    if(!x||!x.ponte.janela||!x.manual()||!x.manual().instalado)return false;
    campo=x.ponte.janela.xgVR;if(!campo)return false;manual=x.manual();
    const m=manual.manches,t=manual.tique,b=manual.botoesERodas,d=manual.demarcando;
    manual.manches=function(){
      if(!api.imersivo)return m.call(this);
      return x.vinculo().faseDoAparelho()==="pronto"?campo.manches():{esq:{x:0,y:0},dir:{x:0,y:0}};
    };
    manual.tique=function(dt){if(!api.imersivo)t.call(this,dt);};
    manual.botoesERodas=function(dt,e){if(!api.imersivo)b.call(this,dt,e);};
    manual.demarcando=function(){return api.imersivo?null:d.call(this);};
    campo.conectar({
      preparar(){
        if(window.CONTROLE_REAL)CONTROLE_REAL.usarVirtual();
        const v=x.vinculo();
        const dji=new URLSearchParams(location.search).get("marca")!=="xag";
        if(!v||!v.faseDoAparelho()){x.ponte.trocarVista("controle");return "Aguarde o controle virtual carregar.";}
        // No Quest, o gesto longo do botao deve poder acontecer dentro do VR.
        // A ponte acima so entrega os manches ao voo quando o aparelho esta pronto.
        if(!dji&&v.faseDoAparelho()!=="pronto"){x.ponte.trocarVista("controle");return "Ligue o controle virtual na vista Controle; depois toque em VR.";}
        if(manual.demarcando())return "Conclua o mapeamento antes de entrar em VR.";
        x.ponte.trocarVista("controle"); // Mede a tela original antes de iniciar a sessao XR.
        return "";
      },
      original:()=>window.VR_CONTROLE_ORIGINAL.criar(x),
      fase:()=>x.vinculo().faseDoAparelho(),
      auxiliar:()=>window.FALAR_AUXILIAR_VR,
      atalhos:()=>window.XG_TECLADO ? XG_TECLADO.quest() : {},
      botao(id,pressionado){
        if(pressionado && ((window.PAUSA_SIM && PAUSA_SIM.pausado)||x.vinculo().faseDoAparelho()!=="pronto"))return;
        const app=window.__xgAppVirtual;if(app&&app.rcplusBotao)app.rcplusBotao(id,pressionado);
      },
      ativar(imersivo){limpar();document.body.classList.toggle("tpd-vr-imersivo",imersivo);},
      desativar(){limpar();document.body.classList.remove("tpd-vr-imersivo");},
      limpar,tique:dt=>t.call(manual,dt),
      auxiliares:()=>x.aparelho()?x.aparelho().comandos:{esq:{x:0,y:0},dir:{x:0,y:0}}
    });
    window.addEventListener("keydown",e=>{if(api.ativo&&e.code==="Escape")campo.sair();},true);
    window.addEventListener("blur",()=>{if(api.ativo&&!api.imersivo&&!document.hasFocus())campo.limpar();});
    return true;
  }
  let tentativas=0;
  const timer=setInterval(()=>{if(instalar()||++tentativas>=600)clearInterval(timer);},500);
})();
