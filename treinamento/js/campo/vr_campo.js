/* VR usa exclusivamente o controle original e o voo MANUAL existente. */
(function () {
  "use strict";
  const T=THREE, rig=new T.Group(), raio=new T.Raycaster(), estados=new Map(), capturas=new Map();
  const zero=()=>({esq:{x:0,y:0},dir:{x:0,y:0}}), limitar=n=>Math.max(-1,Math.min(1,n));
  let host=null,ativo=false,sessao=null,entrando=false,visual=null,salvo=null,suspenso=false;
  let comandos=zero(),yaw=0,pitch=0,mouse=null,ultimoT=0,suportaXR=false,verificandoXR=true,numero=100;
  let ajuda=null;
  let interacoes=null;
  const cima=new T.Vector3(0,1,0),direcao=new T.Vector3();
  const navegadorOculos=/OculusBrowser|Meta Quest|Quest\/|Quest [23Pro]/i.test(navigator.userAgent);
  cena.add(rig);rig.name="Piloto VR";
  const barra=document.createElement("div");barra.id="tpd-vr-barra";barra.hidden=!navegadorOculos;
  barra.innerHTML='<button type="button" id="tpd-vr-botao" aria-pressed="false" title="VR no Meta Quest">🥽 VR</button><button type="button" id="tpd-vr-botoes" title="Configurar os botões e analógicos do Quest">⚙ Botões</button><span id="tpd-vr-recado" role="status"></span>';
  document.body.appendChild(barra);
  // Configurar os botões antes de entrar: abre o painel "Controles do Meta Quest" (teclado_rc.js, na página de cima).
  document.getElementById("tpd-vr-botoes").onclick=()=>{try{parent.XG_TECLADO&&parent.XG_TECLADO.abrir();}catch(_){}};
  const btn=document.getElementById("tpd-vr-botao"),recado=document.getElementById("tpd-vr-recado");btn.disabled=true;
  const css=document.createElement("style");
  css.textContent="#tpd-vr-barra{position:fixed;right:12px;top:64px;z-index:9500;display:flex;align-items:flex-end;flex-direction:column;gap:6px;pointer-events:none;font:14px Arial,sans-serif}#tpd-vr-botao,#tpd-vr-botoes{pointer-events:auto;min-height:42px;padding:8px 12px;border:1px solid #637785;border-radius:9px;color:white;background:#132630;cursor:pointer}#tpd-vr-botao[aria-pressed=true]{background:#146b51}#tpd-vr-recado{max-width:min(350px,80vw);padding:8px;border-radius:6px;background:#132630e8;color:white}#tpd-vr-recado:empty{display:none}body.tpd-vr-imersivo> :not(canvas):not(script):not(style){opacity:0!important;pointer-events:none!important}";
  document.head.appendChild(css);
  css.textContent+="#tpd-vr-barra[hidden]{display:none!important}";
  function avisar(t){recado.textContent=t;}
  function atualizarDispositivo(){
    document.documentElement.dataset.vrDispositivo=navegadorOculos?"oculos":(movel()?"celular":"computador");
    document.documentElement.dataset.vrDisponivel=String(navegadorOculos&&suportaXR);
    btn.title=navegadorOculos&&suportaXR?"Entrar em VR no Meta Quest":"VR indisponível neste navegador";
    btn.disabled=!navegadorOculos||!suportaXR||!host||verificandoXR||entrando;
  }
  // O sensor altera somente o olhar. A orientacao inicial centraliza a vista.
  let sensorAtivo=false,sensorBase=null,sensorAviso=0;
  const olharSensor=new T.Quaternion(),leituraSensor=new T.Quaternion(),eulerSensor=new T.Euler(0,0,0,"YXZ");
  const eixoTela=new T.Vector3(0,0,1),ajusteTela=new T.Quaternion(),ajusteCamera=new T.Quaternion(-Math.SQRT1_2,0,0,Math.SQRT1_2);
  function movel(){
    try{if(parent.DISPOSITIVO_SIM)return parent.DISPOSITIVO_SIM.movel;}catch(_){}
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Mac/i.test(navigator.platform)&&navigator.maxTouchPoints>1);
  }
  function orientar(e){
    if(!sensorAtivo||!ativo||sessao||document.hidden)return;
    if(![e.alpha,e.beta,e.gamma].every(Number.isFinite))return;
    const graus=Math.PI/180;
    const angulo=screen.orientation&&Number.isFinite(screen.orientation.angle)?screen.orientation.angle:(Number.isFinite(window.orientation)?window.orientation:0);
    // DeviceOrientation usa Z-X'-Y''. A camera olha por -Z; a tela pode girar.
    eulerSensor.set(e.beta*graus,e.alpha*graus,-e.gamma*graus,"YXZ");
    leituraSensor.setFromEuler(eulerSensor).multiply(ajusteCamera).multiply(ajusteTela.setFromAxisAngle(eixoTela,-angulo*graus));
    if(!sensorBase){
      sensorBase=leituraSensor.clone().invert();
      clearTimeout(sensorAviso);avisar("Mova o celular para olhar.");
      sensorAviso=setTimeout(()=>{if(sensorAtivo&&sensorBase)avisar("");},2500);
    }
    olharSensor.copy(sensorBase).multiply(leituraSensor).normalize();
  }
  function iniciarSensor(){
    sensorAtivo=true;sensorBase=null;olharSensor.identity();
    addEventListener("deviceorientation",orientar);
    avisar("Mova o celular para olhar.");
    sensorAviso=setTimeout(()=>{
      if(sensorAtivo&&!sensorBase)avisar("Sem leitura de movimento. Confira a permissão dos sensores no navegador e entre em VR novamente.");
    },4000);
  }
  function pararSensor(){
    removeEventListener("deviceorientation",orientar);clearTimeout(sensorAviso);
    sensorAtivo=false;sensorBase=null;
  }
  async function permitirSensor(){
    if(!isSecureContext||!window.DeviceOrientationEvent){
      avisar("Este navegador não disponibilizou o movimento do aparelho. Abra o simulador pelo link HTTPS no navegador do celular.");return false;
    }
    try{
      // Chamado diretamente pelo clique VR: o iPhone exige esse gesto.
      if(typeof DeviceOrientationEvent.requestPermission==="function"&&await DeviceOrientationEvent.requestPermission()!=="granted"){
        avisar("Permita o acesso ao movimento do aparelho no navegador e toque em VR novamente.");return false;
      }
      return true;
    }catch(_){avisar("Não foi possível acessar o movimento do aparelho. Confira a permissão no navegador e toque em VR novamente.");return false;}
  }
  function cancelar(id) {
    const c=capturas.get(id);if(!c)return;
    if(c.alvo.tipo==="manche")comandos[c.alvo.lado]={x:0,y:0};
    else if(visual){visual.evento(c.alvo,"pointercancel",id);visual.evento(c.alvo,"pointerleave",id);}
    capturas.delete(id);
  }
  function limpar() {
    if(interacoes)interacoes.limpar();
    [...capturas.keys()].forEach(cancelar);comandos=zero();mouse=null;
    for(const lado in analogicoAtivo)delete analogicoAtivo[lado];
    estados.forEach(e=>{e.pincha=false;e.armado=false;e.toqueArmado=false;e.toque=false;e.selecionando=false;ocultarEntrada(e);});
    if(window.xgManches)Object.keys(xgManches).forEach(k=>xgManches[k]=0);
    if(host)host.limpar();
  }
  function pixels(local) {return {x:(local.x/visual.largura+.5)*visual.w,y:(.5-local.y/visual.altura)*visual.h,z:local.z};}
  function perto(pos) {
    rig.updateMatrixWorld(true);visual.malha.updateMatrixWorld(true);
    const p=new T.Vector3(pos.x,pos.y,pos.z);rig.localToWorld(p);visual.malha.worldToLocal(p);return pixels(p);
  }
  function mirar(pose) {
    if(!pose||!visual)return null;
    rig.updateMatrixWorld(true);visual.malha.updateMatrixWorld(true);
    const m=new T.Matrix4().fromArray(pose.transform.matrix).premultiply(rig.matrixWorld);
    raio.ray.origin.setFromMatrixPosition(m);raio.ray.direction.set(0,0,-1).transformDirection(m);
    const hit=raio.intersectObject(visual.malha,false)[0];
    return hit?{x:hit.uv.x*visual.w,y:(1-hit.uv.y)*visual.h,z:0}:null;
  }
  function pressionar(id,p,modo) {
    if(!visual||!p)return;
    const alvo=visual.alvo(p);if(!alvo)return;
    if(alvo.tipo==="manche"&&[...capturas.values()].some(c=>c.alvo.tipo==="manche"&&c.alvo.lado===alvo.lado))return;
    capturas.set(id,{alvo,inicio:p,modo,ultimo:p});
    if(alvo.tipo==="botao")visual.evento(alvo,"pointerdown",id);
  }
  function mover(id,p) {
    const c=capturas.get(id);if(!c)return;
    // Um botao pressionado conserva a captura enquanto a fonte e a pressao
    // continuam validas, mesmo se o raio sair do painel ou a mao se afastar.
    // Perda de rastreamento/suspensao ainda cancela em entradas()/limpar().
    if(c.alvo.tipo==="botao"&&(!p||(c.modo==="perto"&&Math.abs(p.z)>.18)))return;
    if(!p||(c.modo==="perto"&&Math.abs(p.z)>.18)){cancelar(id);return;}
    c.ultimo=p;
    if(c.alvo.tipo==="manche"){
      const a=c.alvo,curso=a.pad.curso;
      // O ponto de pega vira o centro: fechar a pinca nunca da um salto no comando.
      comandos[a.lado]={x:limitar((p.x-c.inicio.x)/curso),y:limitar((c.inicio.y-p.y)/curso)};
    }else{
      const alvo=visual.alvo(p);
      if(alvo&&alvo.tipo==="botao")visual.evento({...c.alvo,x:alvo.x,y:alvo.y},"pointermove",id);
    }
  }
  function deslizePequeno(c,p){
    const fim=p||c.ultimo;if(!fim||!visual)return false;
    return Math.hypot(fim.x-c.inicio.x,fim.y-c.inicio.y)*visual.largura/visual.w<=DESLIZE_CLIQUE;
  }
  const DESLIZE_CLIQUE=.01; // metros sobre o RC
  function soltar(id,p) {
    const c=capturas.get(id);if(!c)return;
    if(c.alvo.tipo==="manche"){comandos[c.alvo.lado]={x:0,y:0};capturas.delete(id);return;}
    const a=visual&&visual.alvo(p);
    if(a&&a.tipo==="botao"&&(a.el===c.alvo.el||c.alvo.el.contains(a.el)||a.el.contains(c.alvo.el))){
      visual.evento({...c.alvo,x:a.x,y:a.y},"pointerup",id);capturas.delete(id);
    }else if(deslizePequeno(c,p)){
      // A mao treme alguns milimetros e os botoes do app tem menos de 1 cm no RC:
      // como numa tela de toque, um deslize curto ainda e clique no botao apertado.
      visual.evento(c.alvo,"pointerup",id);capturas.delete(id);
    }else cancelar(id);
  }
  function segmento(obj,a,b,raio) {
    direcao.subVectors(b,a);const tamanho=direcao.length();
    obj.visible=tamanho>.0001;if(!obj.visible)return;
    obj.position.copy(a).add(b).multiplyScalar(.5);
    obj.quaternion.setFromUnitVectors(cima,direcao.multiplyScalar(1/tamanho));obj.scale.set(raio,tamanho,raio);
  }
  function criarMao(cor) {
    const grupo=new T.Group(),juntas=new Map(),ossos=[];
    grupo.name="Mao VR";grupo.visible=false;rig.add(grupo);
    const material=new T.MeshBasicMaterial({color:cor}),esfera=new T.SphereGeometry(1,8,6),cilindro=new T.CylinderGeometry(1,1,1,6);
    function junta(nome){const m=new T.Mesh(esfera,material);m.name="Junta VR";m.visible=false;grupo.add(m);juntas.set(nome,m);}
    junta("wrist");
    for(const dedo of ["thumb","index-finger","middle-finger","ring-finger","pinky-finger"]){
      let anterior="wrist";
      const partes=dedo==="thumb"?["metacarpal","phalanx-proximal","phalanx-distal","tip"]:["metacarpal","phalanx-proximal","phalanx-intermediate","phalanx-distal","tip"];
      for(const parte of partes){const nome=dedo+"-"+parte;junta(nome);const osso=new T.Mesh(cilindro,material);osso.visible=false;grupo.add(osso);ossos.push({osso,a:anterior,b:nome});anterior=nome;}
    }
    return {grupo,juntas,ossos,material};
  }
  function atualizarMao(mao,source,frame,ref) {
    mao.grupo.visible=false;
    for(const [nome,junta] of mao.juntas){
      const space=source.hand.get(nome),pose=space&&frame.getJointPose(space,ref);
      junta.visible=!!pose;
      if(pose){junta.position.copy(pose.transform.position);junta.scale.setScalar(Math.max(.004,Math.min(.012,pose.radius||.007)));mao.grupo.visible=true;}
    }
    for(const {osso,a,b} of mao.ossos){const ja=mao.juntas.get(a),jb=mao.juntas.get(b);osso.visible=false;if(ja.visible&&jb.visible)segmento(osso,ja.position,jb.position,.004);}
  }
  function criarControle(cor,lado) {
    // Representacao leve presa ao gripSpace: nao depende de modelos baixados de outro servidor.
    const grupo=new T.Group();grupo.name="Controle de mao VR";grupo.visible=false;grupo.matrixAutoUpdate=false;rig.add(grupo);
    const sinal=lado==="left"?-1:1,botoes=[];
    const material=c=>{const m=new T.MeshStandardMaterial({color:c,roughness:.8,metalness:0});m.color.convertSRGBToLinear();return m;};
    function peca(nome,geometria,c,pos){const m=new T.Mesh(geometria,material(c));m.name=nome;m.position.set(...pos);grupo.add(m);return m;}
    const corpo=peca("Empunhadura Quest",new T.SphereGeometry(1,24,16),0xe5e9ed,[0,-.024,.012]);
    corpo.scale.set(.021,.065,.024);corpo.rotation.x=-.18;
    const borda=peca("Carcaca superior Quest",new T.SphereGeometry(1,32,16),0xf1f3f5,[0,.028,-.005]);
    borda.scale.set(.034,.014,.042);
    const topo=peca("Face dos botoes Quest",new T.CylinderGeometry(1,1,1,40),0x222a31,[0,.042,-.005]);
    topo.scale.set(.031,.003,.038);
    function legenda(pai,texto,raio){
      const c=document.createElement("canvas");c.width=c.height=128;const g=c.getContext("2d");
      g.fillStyle="#ffffff";g.font="bold 80px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText(texto,64,68);
      const mapa=new T.CanvasTexture(c);mapa.encoding=T.sRGBEncoding;
      const m=new T.Mesh(new T.PlaneGeometry(raio*1.6,raio*1.6),new T.MeshBasicMaterial({map:mapa,transparent:true,depthWrite:false,toneMapped:false}));
      m.rotation.x=-Math.PI/2;m.position.y=.0019;pai.add(m);
    }
    function botao(nome,indice,x,z,rotulo,raio=.006){
      const m=peca(nome,new T.CylinderGeometry(raio,raio,.003,24),0x47525c,[x,.046,z]);
      m.userData.indice=indice;m.userData.rotulo=rotulo;
      if(rotulo)legenda(m,rotulo,raio);
      botoes.push({m,indice,base:m.position.clone(),tipo:"botao"});return m;
    }
    botao(lado==="left"?"Botao X":"Botao A",4,-sinal*.004,.014,lado==="left"?"X":"A");
    botao(lado==="left"?"Botao Y":"Botao B",5,-sinal*.016,-.008,lado==="left"?"Y":"B");
    // O botao Meta pertence ao sistema; nao inventar uma acao do simulador para ele.
    botao(lado==="left"?"Botao Menu":"Botao Meta",lado==="left"?7:null,sinal*.015,.018,lado==="left"?"≡":"∞",.0045);
    peca("Base do analogico Quest",new T.CylinderGeometry(.010,.011,.002,24),0x10171d,[sinal*.011,.045,-.013]);
    const analogico=new T.Group();analogico.name="Analogico Quest";analogico.position.set(sinal*.011,.047,-.013);grupo.add(analogico);
    const haste=new T.Mesh(new T.CylinderGeometry(.0035,.0035,.009,16),material(0x66717b));haste.position.y=.004;analogico.add(haste);
    const tampa=new T.Mesh(new T.CylinderGeometry(.0075,.008,.003,28),material(0x47525c));tampa.name="Clique do analogico";tampa.position.y=.010;analogico.add(tampa);
    const aro=new T.Mesh(new T.TorusGeometry(.0055,.0007,6,24),material(0x84919b));aro.rotation.x=Math.PI/2;aro.position.y=.0016;tampa.add(aro);
    const gatilho=peca("Gatilho indicador Quest",new T.SphereGeometry(1,20,12),0x47525c,[0,.019,-.039]);gatilho.scale.set(.013,.010,.005);
    const lateral=peca("Gatilho lateral Quest",new T.SphereGeometry(1,20,12),0x47525c,[-sinal*.020,-.012,.010]);lateral.scale.set(.003,.018,.012);
    botoes.push({m:gatilho,indice:0,base:gatilho.position.clone(),tipo:"gatilho"},{m:lateral,indice:1,base:lateral.position.clone(),tipo:"lateral"});
    return {grupo,gatilho,botoes,analogico,tampa,sinal,cor};
  }
  function atualizarControle(controle,source,selecionando) {
    const pad=source.gamepad;
    function leitura(indice){
      const b=pad&&indice!==null&&pad.buttons[indice];
      const valor=b?limitar(Number.isFinite(b.value)?b.value:(b.pressed?1:0)):(indice===0&&selecionando?1:0);
      return {valor:Math.max(0,valor),pressionado:!!(b&&b.pressed)||valor>.5,tocado:!!(b&&b.touched)};
    }
    function cor(m,b){m.material.color.set(b.pressionado?0x52e0ac:b.tocado?controle.cor:0x47525c).convertSRGBToLinear();}
    for(const b of controle.botoes){
      const valor=leitura(b.indice);b.m.position.copy(b.base);cor(b.m,valor);
      if(b.tipo==="gatilho")b.m.position.z+=valor.valor*.004;
      else if(b.tipo==="lateral")b.m.position.x+=controle.sinal*valor.valor*.002;
      else b.m.position.y-=valor.valor*.0015;
      b.m.userData.pressionado=valor.pressionado;
    }
    const stick=leitura(3),eixos=pad&&pad.axes||[];
    controle.analogico.rotation.set(limitar(eixos[3]||0)*.28,0,-limitar(eixos[2]||0)*.28);
    controle.tampa.position.y=.010-stick.valor*.0015;cor(controle.tampa,stick);
  }
  function ocultarEntrada(e){
    for(const o of [e.ponto,e.cursor,e.raio,e.mao&&e.mao.grupo,e.controle&&e.controle.grupo])if(o)o.visible=false;
  }
  function mostrarRaio(e,pose,p) {
    e.raio.visible=false;if(!pose||e.modo==="perto")return;
    const m=new T.Matrix4().fromArray(pose.transform.matrix),a=new T.Vector3().setFromMatrixPosition(m),b=new T.Vector3();
    if(p){b.set((p.x/visual.w-.5)*visual.largura,(.5-p.y/visual.h)*visual.altura,.002);visual.malha.localToWorld(b);rig.worldToLocal(b);}
    else if(e.mundoAlvo){b.copy(e.mundoAlvo);rig.worldToLocal(b);}
    else b.set(0,0,-.7).applyMatrix4(m);
    segmento(e.raio,a,b,.0015);e.raio.material.color.set(capturas.has(e.id)?0x61ddb5:e.cor);
  }
  function ajudaEntrada(texto) {
    if(!visual)return;
    if(!ajuda){
      const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=96;
      const textura=new T.CanvasTexture(canvas);textura.encoding=T.sRGBEncoding;
      ajuda=new T.Mesh(new T.PlaneGeometry(.55,.052),new T.MeshBasicMaterial({map:textura,transparent:true,depthTest:false}));
      ajuda.name="Ajuda de entrada VR";ajuda.renderOrder=102;ajuda.position.set(0,visual.altura/2+.036,.004);visual.malha.add(ajuda);
    }
    if(ajuda.userData.texto===texto)return;ajuda.userData.texto=texto;
    const c=ajuda.material.map.image,g=c.getContext("2d");g.clearRect(0,0,c.width,c.height);g.fillStyle="#132630ed";g.fillRect(0,0,c.width,c.height);
    g.fillStyle="white";g.font="30px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText(texto,c.width/2,c.height/2,c.width-24);ajuda.material.map.needsUpdate=true;
  }
  function descartarObjeto(obj){
    const geometrias=new Set(),materiais=new Set();obj.traverse(o=>{if(o.geometry)geometrias.add(o.geometry);if(o.material)materiais.add(o.material);});
    geometrias.forEach(g=>g.dispose());materiais.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});obj.removeFromParent();
  }
  function estado(source) {
    if(estados.has(source))return estados.get(source);
    const ponto=new T.Mesh(new T.SphereGeometry(.006,8,6),new T.MeshBasicMaterial({color:0xffffff,depthTest:false}));
    ponto.renderOrder=100;ponto.visible=false;rig.add(ponto);
    const cursor=new T.Mesh(new T.RingGeometry(.003,.005,20),new T.MeshBasicMaterial({color:0xffffff,depthTest:false,side:T.DoubleSide}));
    cursor.name="Alvo VR";cursor.renderOrder=101;cursor.visible=false;visual.malha.add(cursor);
    const cor=source.handedness==="left"?0x70caff:0xffcc80;
    const linha=new T.Mesh(new T.CylinderGeometry(1,1,1,6),new T.MeshBasicMaterial({color:cor,depthTest:false}));
    linha.name="Raio VR";linha.renderOrder=99;linha.visible=false;rig.add(linha);
    const e={id:++numero,pincha:false,armado:false,selecionando:false,ponto,cursor,cor,raio:linha,mao:source.hand?criarMao(cor):null,controle:source.hand?null:criarControle(cor,source.handedness)};
    estados.set(source,e);return e;
  }
  // O RC fica preso ao peito, nao a cabeca: a base e o pescoco (girar ou inclinar
  // a cabeca nao o move) e o rumo do corpo so acompanha o olhar depois de 50 graus.
  // Enquanto um comando esta seguro o rumo nao muda, para o manche nao saltar.
  const PESCOCO=new T.Vector3(0,.10,-.09),RC_PEITO=new T.Vector3(0,-.32,-.49),RC_INCLINACAO=-.65;
  const GIRO_LIVRE=50*Math.PI/180,GIRO_VELOCIDADE=2.5;
  function rumoDaCabeca(cabeca,anterior){
    // Olhando para baixo (para o RC) a frente some; o topo da cabeca indica o rumo.
    const f=new T.Vector3(0,0,-1).applyQuaternion(cabeca),u=new T.Vector3(0,1,0).applyQuaternion(cabeca);
    f.addScaledVector(u,Math.max(0,-f.y));f.y=0;
    return f.lengthSq()<.0025?anterior:Math.atan2(-f.x,-f.z);
  }
  function criarInteracoes() {
    const marcadores=new Map(),painel=new T.Group(),botoes=[];
    const corpo={pronto:false,rumo:0,seguindo:false,t:0,rel:new T.Matrix4()};
    // RC empunhado: as laterais dos dois controles apertadas, cada uma do seu lado do RC.
    // So assim os analogicos viram os manches (como segurar o aparelho de verdade).
    const empunhado={ativo:false,offset:null};
    let dono=null,offset=null,assinatura='';
    function baseDasMaos(a,b){
      const pa=new T.Vector3().setFromMatrixPosition(a),pb=new T.Vector3().setFromMatrixPosition(b);
      const x=pb.clone().sub(pa).normalize(),cimaMaos=new T.Vector3(0,1,0).transformDirection(a).add(new T.Vector3(0,1,0).transformDirection(b));
      const z=new T.Vector3().crossVectors(x,cimaMaos).normalize(),y=new T.Vector3().crossVectors(z,x);
      return new T.Matrix4().makeBasis(x,y,z).setPosition(pa.add(pb).multiplyScalar(.5));
    }
    function duasMaos(sources,frame,ref){
      const g={};
      for(const s of sources){
        if(s.hand||!s.gamepad||!s.gripSpace)continue;const p=frame.getPose(s.gripSpace,ref);if(!p)continue;
        g[s.handedness]={m:new T.Matrix4().fromArray(p.transform.matrix),pos:p.transform.position,lateral:!!s.gamepad.buttons[1]?.pressed};
      }
      const l=g.left,r=g.right;
      if(!l||!r||!l.lateral||!r.lateral||pausado()){empunhado.ativo=false;empunhado.offset=null;return false;}
      if(!empunhado.ativo){
        // Cada mao no seu lado do RC (ou um pouco para fora/abaixo, onde ficam as empunhaduras).
        const naLateral=(p,esq)=>Math.abs(p.z)<.15&&p.y>visual.h*.25&&p.y<visual.h*1.3&&(esq?p.x<visual.w*.4&&p.x>-visual.w*.2:p.x>visual.w*.6&&p.x<visual.w*1.2);
        if(!naLateral(perto(l.pos),true)||!naLateral(perto(r.pos),false))return false;
        visual.malha.updateMatrix();empunhado.offset=baseDasMaos(l.m,r.m).invert().multiply(visual.malha.matrix);
        empunhado.ativo=true;dono=null;offset=null;
      }
      baseDasMaos(l.m,r.m).multiply(empunhado.offset).decompose(visual.malha.position,visual.malha.quaternion,visual.malha.scale);
      visual.malha.updateMatrixWorld(true);return true;
    }
    painel.name='Conversa VR com auxiliar';cena.add(painel);
    const pausado=()=>!!(window.PAUSA_SIM&&PAUSA_SIM.pausado);
    const api=()=>host.auxiliar&&host.auxiliar();
    function liberar(e){if(dono===e){dono=null;offset=null;}e.acao=null;e.gripArmado=false;e.toqueArmado=false;}
    function limpar(){
      dono=null;offset=null;
      estados.forEach(e=>{liberar(e);for(const id of Object.values(e.atalhos||{}))host.botao&&host.botao(id,false);e.atalhos={};e.atalhosArmados=false;});
      marcadores.forEach(m=>m.visible=false);if(api())api().fechar();
    }
    function atualizar(viewer){
      painel.visible=!pausado()&&!!window.xgEquipe?.b;
      const a=api(),dados=a&&a.estado();painel.visible=!!(painel.visible&&dados?.disponivel);
      if(painel.visible){
        const linhas=dados.aberto?dados.opcoes:[{id:'abrir',texto:dados.titulo}];
        if(dados.aviso)linhas.unshift({id:'aviso',texto:dados.aviso});
        const chave=JSON.stringify([linhas,dados.aviso]);
        if(chave!==assinatura){
          assinatura=chave;botoes.splice(0).forEach(descartarObjeto);
          linhas.forEach((linha,i)=>{
            const c=document.createElement('canvas');c.width=768;c.height=112;const g=c.getContext('2d');
            g.fillStyle=linha.id==='fechar'?'#293c47':'#163d2f';g.fillRect(0,0,768,112);g.strokeStyle='#a7d8a0';g.lineWidth=4;g.strokeRect(2,2,764,108);
            g.fillStyle='#fff';g.font='bold 43px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(linha.texto,384,56,735);
            const mapa=new T.CanvasTexture(c);mapa.encoding=T.sRGBEncoding;
            const b=new T.Mesh(new T.PlaneGeometry(.85,.124),new T.MeshBasicMaterial({map:mapa,side:T.DoubleSide,toneMapped:false}));
            b.name='Auxiliar VR '+linha.id;b.userData.acao=linha.id;b.position.y=(linhas.length-1-i)*.14;painel.add(b);botoes.push(b);
          });
        }
        painel.position.copy(xgEquipe.b.position);painel.position.y+=xgEquipe.estado==='sentado'?1.4:1.95;
        const olho=cam.getWorldPosition(new T.Vector3());painel.lookAt(olho);painel.updateMatrixWorld(true);
      }
      const pos=viewer?.transform?.position,q=viewer?.transform?.orientation;
      if(pos&&q){
        const agora=performance.now(),dt=Math.min(.1,(agora-(corpo.t||agora))/1000);corpo.t=agora;
        const olho=new T.Vector3(pos.x,pos.y,pos.z),cabeca=new T.Quaternion(q.x,q.y,q.z,q.w);
        const pescoco=olho.clone().sub(PESCOCO.clone().applyQuaternion(cabeca)),rumo=rumoDaCabeca(cabeca,corpo.rumo);
        if(!corpo.pronto){
          corpo.rumo=rumo;corpo.pronto=true;
          corpo.rel.compose(RC_PEITO,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),RC_INCLINACAO),visual.malha.scale);
        }
        const desvio=Math.atan2(Math.sin(rumo-corpo.rumo),Math.cos(rumo-corpo.rumo));
        if(Math.abs(desvio)>GIRO_LIVRE)corpo.seguindo=true;
        if(corpo.seguindo&&!capturas.size&&!dono&&!empunhado.ativo){
          corpo.rumo+=Math.sign(desvio)*Math.min(Math.abs(desvio),GIRO_VELOCIDADE*dt);
          if(Math.abs(desvio)<.05)corpo.seguindo=false;
        }
        const peito=new T.Matrix4().compose(pescoco,new T.Quaternion().setFromAxisAngle(cima,corpo.rumo),new T.Vector3(1,1,1));
        if(dono||empunhado.ativo){
          // Segurando pela carcaca: ao soltar, o RC fica nesse lugar em relacao ao peito.
          visual.malha.updateMatrix();corpo.rel.copy(peito.clone().invert().multiply(visual.malha.matrix));
        }else peito.multiply(corpo.rel).decompose(visual.malha.position,visual.malha.quaternion,visual.malha.scale);
        const mundo=rig.localToWorld(olho.clone());grupoOperador.position.set(mundo.x,alt(mundo.x,mundo.z),mundo.z);
      }
    }
    function terreno(pose){
      if(!pose)return null;
      const m=new T.Matrix4().fromArray(pose.transform.matrix).premultiply(rig.matrixWorld);
      const origem=new T.Vector3().setFromMatrixPosition(m),dir=new T.Vector3(0,0,-1).transformDirection(m);
      if(dir.y>-.06)return null;
      let anterior=origem.clone();
      for(let d=.15;d<=30;d+=.15){
        const p=origem.clone().addScaledVector(dir,d),chao=alt(p.x,p.z);
        if(Number.isFinite(chao)&&p.y<=chao){
          let lo=anterior,hi=p;for(let i=0;i<8;i++){const meio=lo.clone().add(hi).multiplyScalar(.5);if(meio.y>alt(meio.x,meio.z))lo=meio;else hi=meio;}
          hi.y=alt(hi.x,hi.z)+.02;
          const valido=!bloqueiaCaminhada(hi.x,hi.z)&&Math.hypot(hi.x-drone.position.x,hi.z-drone.position.z)>2 && (!window.xgEquipe?.b || hi.distanceTo(xgEquipe.b.position)>.8);
          return {p:hi,valido};
        }anterior=p;
      }return null;
    }
    function alvoUI(pose,dedo){
      if(!painel.visible)return null;
      if(dedo){
        const mundo=rig.localToWorld(new T.Vector3(dedo.x,dedo.y,dedo.z));
        for(const b of botoes){const local=b.worldToLocal(mundo.clone());if(Math.abs(local.x)<.425&&Math.abs(local.y)<.062&&Math.abs(local.z)<.075)return {id:b.userData.acao,toque:Math.abs(local.z)<.02};}
      }
      if(!pose)return null;
      const m=new T.Matrix4().fromArray(pose.transform.matrix).premultiply(rig.matrixWorld),r=new T.Raycaster();r.ray.origin.setFromMatrixPosition(m);r.ray.direction.set(0,0,-1).transformDirection(m);
      const hit=r.intersectObjects(botoes,false)[0];return hit?{id:hit.object.userData.acao,toque:false}:null;
    }
    function entrada(e,source,frame,ref,pose,p,fecha,abre){
      let marcador=marcadores.get(e.id);
      if(!marcador){marcador=new T.Mesh(new T.RingGeometry(.20,.26,40),new T.MeshBasicMaterial({color:0x53e6a3,side:T.DoubleSide}));marcador.name='Destino de teletransporte';marcador.rotation.x=-Math.PI/2;cena.add(marcador);marcadores.set(e.id,marcador);}
      marcador.visible=false;e.mundoAlvo=null;
      if(pausado()){liberar(e);return true;}
      let maoPose=null,dedo=null,pega=false,pegou=false;
      if(source.hand){
        const i=source.hand.get('index-finger-tip'),w=source.hand.get('wrist');
        const ip=i&&frame.getJointPose(i,ref),wp=w&&frame.getJointPose(w,ref);
        dedo=ip?.transform.position;maoPose=wp||ip;
        // So a pinca pega o RC. Mao fechada apontando o indicador e o gesto de apertar
        // botao: antes ela agarrava o RC antes de o dedo encostar.
        pega=fecha;
      }else{maoPose=source.gripSpace&&frame.getPose(source.gripSpace,ref);pega=!!source.gamepad?.buttons[1]?.pressed;}
      if(!pega)e.gripArmado=true;
      const toque=maoPose?.transform.position,pertoCorpo=toque&&perto(toque),pertoDedo=dedo&&perto(dedo);
      // Mao: a pinca (ponta do indicador) na carcaca. Controle: empunhadura perto da carcaca.
      const corpo=source.hand?(visual.corpo(pertoDedo)&&Math.abs(pertoDedo.z)<.06):(visual.corpo(pertoCorpo)&&Math.abs(pertoCorpo.z)<.10);
      const corpoRaio=p&&visual.corpo(p);
      const matrizMao=()=>maoPose.transform.matrix?new T.Matrix4().fromArray(maoPose.transform.matrix):new T.Matrix4().compose(new T.Vector3().copy(toque),new T.Quaternion(),new T.Vector3(1,1,1));
      if(dono===e){
        if(!pega||!maoPose){dono=null;offset=null;}else{const m=matrizMao().multiply(offset);m.decompose(visual.malha.position,visual.malha.quaternion,visual.malha.scale);visual.malha.updateMatrixWorld(true);}
        return true;
      }
      // Raio ou dedo em cima de botao/manche: e para apertar, nao para pegar o RC.
      const sobreComando=(p&&visual.alvo(p))||(pertoDedo&&Math.abs(pertoDedo.z)<.06&&visual.alvo(pertoDedo));
      if(!dono&&!empunhado.ativo&&pega&&e.gripArmado&&maoPose&&!capturas.has(e.id)&&!e.toque&&!sobreComando&&(corpo||(!source.hand&&corpoRaio))){
        visual.malha.updateMatrix();offset=matrizMao().invert().multiply(visual.malha.matrix);dono=e;e.gripArmado=false;e.acao=null;return true;
      }
      // Os atalhos sao optativos; segurar mantém a mesma duracao do botao original.
      const mapa=host.atalhos?host.atalhos():{},atalhos=e.atalhos||(e.atalhos={});
      for(const indice of [3,4,5]){const id=mapa[source.handedness+':'+indice],b=!!source.gamepad?.buttons[indice]?.pressed,anterior=atalhos[indice];
        if(anterior&&(!b||anterior!==id)){host.botao(anterior,false);delete atalhos[indice];}
        if(id===SAIR_VR)continue; // tratado em verificarSaida, inclusive com o simulador pausado
        if(b&&id&&!atalhos[indice]&&e.atalhosArmados){host.botao(id,true);atalhos[indice]=id;}
      }
      if(![3,4,5].some(i=>source.gamepad?.buttons[i]?.pressed))e.atalhosArmados=true;
      if(capturas.has(e.id)||e.toque)return false;
      const ui=alvoUI(pose,dedo),rc=!!(p&&visual.alvo(p)),destino=!ui&&!p?terreno(pose):null;
      if(destino){marcador.position.copy(destino.p);marcador.material.color.set(destino.valido?0x53e6a3:0xeb725f);marcador.visible=true;e.mundoAlvo=destino.p;}
      const contato=ui?.toque;
      if(!contato)e.uiToqueArmado=true;
      const apertou=fecha&&e.armado&&!e.pincha;
      if(e.acao){
        if((e.acao.toque&&!contato)||(!e.acao.toque&&abre)){
          if(e.acao.tipo==='auxiliar'&&ui?.id===e.acao.id&&api())api().acionar(e.acao.id);
          if(e.acao.tipo==='teleporte'&&destino?.valido){
            const olho=cam.getWorldPosition(new T.Vector3()),chao=alt(destino.p.x,destino.p.z);
            rig.position.x+=destino.p.x-olho.x;rig.position.z+=destino.p.z-olho.z;rig.position.y=chao;
            grupoOperador.position.set(destino.p.x,chao,destino.p.z);rig.updateMatrixWorld(true);
          }
          e.acao=null;e.pincha=false;e.armado=abre;
        }
        return true;
      }
      if(!rc&&ui&&(apertou||(contato&&e.uiToqueArmado))){e.acao={tipo:'auxiliar',id:ui.id,toque:!!contato};e.uiToqueArmado=false;e.pincha=true;return true;}
      if(!p&&destino?.valido&&apertou){e.acao={tipo:'teleporte'};e.pincha=true;return true;}
      return false;
    }
    return {atualizar,entrada,duasMaos,get empunhado(){return empunhado.ativo;},perdida(e){liberar(e);for(const id of Object.values(e.atalhos||{}))host.botao&&host.botao(id,false);e.atalhos={};e.atalhosArmados=false;e.uiToqueArmado=false;marcadores.get(e.id)&&(marcadores.get(e.id).visible=false);},limpar,
      descartar(){limpar();botoes.forEach(descartarObjeto);painel.removeFromParent();marcadores.forEach(descartarObjeto);}};
  }
  // Atalho "Sair do VR" (padrao: X do controle esquerdo). Um clique sai (pedido do
  // operador); o botao so precisa ter sido solto uma vez depois de entrar no VR.
  const SAIR_VR="sair-vr",SEGURAR_SAIR_MS=0,saida=new Map(),LETRAS={"left:4":"X","left:5":"Y","right:4":"A","right:5":"B","left:3":"Clique do analógico esq.","right:3":"Clique do analógico dir."};
  // Analogicos do Quest = manches do RC, so com o RC empunhado pelas duas laterais.
  // Configuracao "left:eixo"/"right:eixo" (teclado_rc.js): "manche-esq", "manche-dir" ou "".
  const analogicoAtivo={};
  function zonaMorta(x,y){const r=Math.hypot(x,y);if(r<.12)return {x:0,y:0};const k=Math.min(1,(r-.12)/.88)/r;return {x:limitar(x*k),y:limitar(y*k)};}
  function analogicos(sources,segurando){
    const mapa=host&&host.atalhos?host.atalhos():{};
    for(const lado of Object.keys(visual.pads)){
      const preso=[...capturas.values()].some(c=>c.alvo.tipo==="manche"&&c.alvo.lado===lado);
      let v=null;
      if(segurando&&!preso)for(const s of sources){
        if(s.hand||!s.gamepad||mapa[s.handedness+":eixo"]!=="manche-"+lado)continue;
        const ax=s.gamepad.axes||[];v=zonaMorta(ax[2]||0,-(ax[3]||0)); // para frente = manche para cima
      }
      if(v){comandos[lado]=v;analogicoAtivo[lado]=true;}
      else if(analogicoAtivo[lado]){if(!preso)comandos[lado]={x:0,y:0};analogicoAtivo[lado]=false;}
    }
  }
  let saindo=false;
  function teclaDeSaida(){
    const mapa=host&&host.atalhos?host.atalhos():{};
    return Object.keys(LETRAS).find(k=>mapa[k]===SAIR_VR);
  }
  function verificarSaida(sources){
    const mapa=host&&host.atalhos?host.atalhos():{},agora=performance.now();let segurando=0;
    for(const source of sources){
      const pad=source.gamepad;if(!pad)continue;
      for(const indice of [3,4,5]){
        const chave=source.handedness+":"+indice;if(mapa[chave]!==SAIR_VR)continue;
        const s=saida.get(chave)||{armado:false,desde:0};saida.set(chave,s);
        if(!pad.buttons[indice]?.pressed){s.armado=true;s.desde=0;continue;}
        if(!s.armado)continue;
        s.desde=s.desde||agora;segurando=Math.max(segurando,agora-s.desde);
        if(agora-s.desde>=SEGURAR_SAIR_MS&&!saindo){saindo=true;s.armado=false;sair().finally(()=>{saindo=false;});}
      }
    }
    return segurando;
  }
  function entradas(frame) {
    if(!visual||!sessao)return;
    const sources=[...sessao.inputSources],segurandoSaida=suspenso?0:verificarSaida(sources);
    if(!visual||!sessao)return; // a saida pode ter encerrado a sessao agora
    if(window.PAUSA_SIM&&PAUSA_SIM.pausado){limpar();return;}
    const ref=render.xr.getReferenceSpace();
    const viewer=!suspenso&&frame&&ref&&frame.getViewerPose(ref);
    if(!viewer){limpar();return;}
    if(interacoes)interacoes.atualizar(viewer);
    const segurandoRC=interacoes?interacoes.duasMaos(sources,frame,ref):false;
    estados.forEach((e,source)=>{if(!sources.includes(source)){cancelar(e.id);if(interacoes)interacoes.perdida(e);ocultarEntrada(e);e.armado=false;e.pincha=false;e.selecionando=false;}});
    let maos=0,controles=0;
    for(const source of sources){
      const e=estado(source),pose=source.targetRaySpace&&frame.getPose(source.targetRaySpace,ref);
      ocultarEntrada(e);
      let p=null,fecha=false,abre=false;
      if(source.hand){
        atualizarMao(e.mao,source,frame,ref);if(e.mao.grupo.visible)maos++;
        const polegar=source.hand.get("thumb-tip"),indicador=source.hand.get("index-finger-tip");
        const a=polegar&&frame.getJointPose(polegar,ref),b=indicador&&frame.getJointPose(indicador,ref);
        if(!a||!b){cancelar(e.id);if(interacoes)interacoes.perdida(e);e.armado=false;e.toque=false;e.toqueArmado=false;e.pincha=false;e.ponto.visible=false;continue;}
        const pa=a.transform.position,pb=b.transform.position;
        const distancia=Math.hypot(pa.x-pb.x,pa.y-pb.y,pa.z-pb.z);
        const meio={x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2,z:(pa.z+pb.z)/2};
        e.ponto.position.set(meio.x,meio.y,meio.z);e.ponto.visible=true;
        const proximo=perto(meio),c=capturas.get(e.id);
        if(c)p=c.modo==="perto"?proximo:mirar(pose);
        else p=Math.abs(proximo.z)<.09&&visual.alvo(proximo)?proximo:mirar(pose);
        e.modo=c?c.modo:(p===proximo?"perto":"raio");
        fecha=distancia<.022;abre=distancia>.034;
        const dedo=perto(pb),alvoDedo=visual.alvo(dedo),cDedo=capturas.get(e.id);
        if(dedo.z>.035||!alvoDedo)e.toqueArmado=true;
        if(e.toque){
          p=dedo;e.modo='perto';fecha=true;abre=false;
          if(dedo.z>.038||dedo.z<-.045||!alvoDedo||alvoDedo.el!==cDedo?.alvo.el){
            if(cDedo)soltar(e.id,cDedo.ultimo);e.toque=false;e.toqueArmado=false;e.pincha=false;e.armado=false;continue;
          }
        }else if(!cDedo&&!e.pincha&&e.toqueArmado&&!fecha&&alvoDedo?.tipo==='botao'&&dedo.z<=.014&&dedo.z>=-.025){
          p=dedo;e.modo='perto';e.toque=true;e.toqueArmado=false;e.armado=true;fecha=true;abre=false;
        }
      }else{
        e.ponto.visible=false;p=mirar(pose);e.modo="raio";
        const grip=source.gripSpace&&frame.getPose(source.gripSpace,ref);
        if(grip||pose){e.controle.grupo.matrix.fromArray((grip||pose).transform.matrix);e.controle.grupo.visible=true;controles++;}
        const botao=source.gamepad&&source.gamepad.buttons[0];
        if(!pose){cancelar(e.id);if(interacoes)interacoes.perdida(e);e.armado=false;e.pincha=false;e.selecionando=false;e.toque=false;continue;}
        fecha=botao?botao.pressed:e.selecionando;abre=!fecha;
        // Encostar a ponta do controle num botao do RC tambem aperta, como o dedo.
        // A bolinha na ponta aparece perto do RC para mostrar onde vai encostar.
        const tp=pose.transform.position,ponta=perto(tp),alvoPonta=visual.alvo(ponta),cPonta=capturas.get(e.id);
        e.ponto.position.set(tp.x,tp.y,tp.z);e.ponto.visible=Math.abs(ponta.z)<.12&&ponta.x>-visual.w*.1&&ponta.x<visual.w*1.1&&ponta.y>-visual.h*.1&&ponta.y<visual.h*1.1;
        if(ponta.z>.035||!alvoPonta)e.toqueArmado=true;
        if(e.toque){
          p=ponta;e.modo='perto';fecha=true;abre=false;
          if(ponta.z>.038||ponta.z<-.06||!alvoPonta||alvoPonta.el!==cPonta?.alvo.el){
            if(cPonta)soltar(e.id,cPonta.ultimo);e.toque=false;e.toqueArmado=false;e.pincha=false;e.armado=false;
            atualizarControle(e.controle,source,e.selecionando);continue;
          }
        }else if(!cPonta&&!e.pincha&&e.toqueArmado&&!fecha&&alvoPonta?.tipo==='botao'&&ponta.z<=.015&&ponta.z>=-.04){
          p=ponta;e.modo='perto';e.toque=true;e.toqueArmado=false;e.armado=true;fecha=true;abre=false;
        }
      }
      if(interacoes&&interacoes.entrada(e,source,frame,ref,pose,p,fecha,abre)){
        if(e.controle)atualizarControle(e.controle,source,e.selecionando);mostrarRaio(e,pose,p);continue;
      }
      if(abre){
        if(e.pincha)soltar(e.id,p);
        e.pincha=false;e.armado=true;
      }else if(fecha&&e.armado&&!e.pincha){
        e.pincha=true;pressionar(e.id,p,e.modo);
      }
      if(e.pincha)mover(e.id,p);
      e.ponto.material.color.set(e.pincha?0x61ddb5:0xffffff);
      if(e.mao)e.mao.material.color.set(capturas.has(e.id)?0x61ddb5:e.cor);
      if(e.controle)atualizarControle(e.controle,source,e.selecionando);
      mostrarRaio(e,pose,p);
      if(p){
        e.cursor.position.set((p.x/visual.w-.5)*visual.largura,(.5-p.y/visual.h)*visual.altura,.002);
        e.cursor.visible=true;e.cursor.material.color.set(capturas.has(e.id)?0x61ddb5:0xffffff);
      }
    }
    analogicos(sources,segurandoRC);
    const fase=host.fase&&host.fase(),tecla=controles&&teclaDeSaida();
    if(segurandoSaida)ajudaEntrada("Saindo do VR... continue segurando "+(LETRAS[teclaDeSaida()]||"o botão")+".");else
    ajudaEntrada(!maos&&!controles?"Mostre as mãos ou mova os controles do Quest.":fase==="desligado"?"Energia: toque, solte e segure novamente por 1,5 s.":fase==="armado"?"Luzes acesas: segure Energia por 1,5 s para ligar.":fase&&fase!=="pronto"?"Controle iniciando. Pode soltar o botão.":capturas.size?"Comando pressionado. Solte para liberar.":segurandoRC?"RC nas duas mãos: analógicos pilotam. Solte uma lateral para largar.":controles?"Laterais dos 2 controles: pilotar. Gatilho: clicar."+(tecla?" "+LETRAS[tecla]+": sair do VR.":""):"Toque nos botões. Pinça nos manches ou na carcaça para pegar.");
    if(!visual.pads.esq&&host.auxiliares)comandos.esq={...host.auxiliares().esq};
  }
  function camera() {
    orb.enabled=false;grupoOperador.visible=false;
    if(!sessao){
      cam.position.set(0,1.62,0);
      if(sensorAtivo&&sensorBase)cam.quaternion.copy(olharSensor);
      else cam.rotation.set(pitch,yaw,0,"YXZ");
    }
    cam.updateMatrixWorld();
  }
  function ativar() {
    salvo={vista,position:cam.position.clone(),quaternion:cam.quaternion.clone(),parent:cam.parent,fov:cam.fov,alvo:orb.target.clone(),orb:orb.enabled,visivel:grupoOperador.visible};
    ativo=true;suspenso=false;limpar();host.ativar(!!sessao);
    definirVista("controle"); // Mantem o aparelho e a tela original tambem no computador.
    rig.position.copy(grupoOperador.position);rig.position.y=alt(rig.position.x,rig.position.z);
    rig.rotation.set(0,Math.atan2(-(drone.position.x-rig.position.x),-(drone.position.z-rig.position.z)),0);
    rig.add(cam);cam.position.set(0,sessao?0:1.62,0);cam.rotation.set(0,0,0);yaw=pitch=0;
    cam.fov=70;cam.updateProjectionMatrix();orb.enabled=false;
    document.body.classList.toggle("tpd-vr-imersivo",!!sessao);
    btn.textContent="Sair VR";btn.setAttribute("aria-pressed","true");
    avisar(sessao?"":"Mova o mouse no campo para olhar. O controle continua igual. Esc: sair.");
  }
  function restaurar() {
    pararSensor();
    if(!ativo)return;
    limpar();ativo=false;suspenso=false;saida.clear();
    if(interacoes){interacoes.descartar();interacoes=null;}
    if(ajuda){descartarObjeto(ajuda);ajuda=null;}
    if(visual){visual.malha.removeFromParent();visual.descartar();visual=null;}
    cam.removeFromParent();if(salvo.parent)salvo.parent.add(cam);
    cam.position.copy(salvo.position);cam.quaternion.copy(salvo.quaternion);cam.fov=salvo.fov;cam.updateProjectionMatrix();
    orb.target.copy(salvo.alvo);grupoOperador.visible=salvo.visivel;definirVista(salvo.vista);orb.enabled=salvo.orb;
    document.body.classList.remove("tpd-vr-imersivo");host.desativar();
    estados.forEach(e=>{for(const objeto of [e.ponto,e.cursor,e.raio,e.mao&&e.mao.grupo,e.controle&&e.controle.grupo])if(objeto)descartarObjeto(objeto);});estados.clear();
    btn.textContent="🥽 VR";btn.setAttribute("aria-pressed","false");if(!render.xr.isPresenting)render.setSize(innerWidth,innerHeight);
  }
  async function sair(){if(sessao){try{await sessao.end();}catch(e){avisar("Encerre o VR pelo menu dos óculos.");}}else restaurar();}
  async function entrar() {
    if(ativo)return sair();if(entrando||!host)return;
    if(!navegadorOculos)return;
    if(!suportaXR){avisar("VR indisponível. Abra o site por HTTPS no navegador do Meta Quest e confira a permissão de realidade virtual.");return;}
    if(telaInicial||modoMapa||!document.getElementById("painel").hidden||!document.getElementById("verif").hidden){avisar("Entre no campo antes de ativar VR.");return;}
    const motivo=host.preparar();if(motivo){avisar(motivo);return;}
    entrando=true;btn.disabled=true;
    try{
      if(suportaXR){
        const s=await navigator.xr.requestSession("immersive-vr",{optionalFeatures:["local-floor","hand-tracking"]});
        sessao=s;
        s.addEventListener("end",()=>{sessao=null;restaurar();},{once:true});
        s.addEventListener("visibilitychange",()=>{suspenso=s.visibilityState!=="visible";limpar();});
        s.addEventListener("inputsourceschange",limpar);
        s.addEventListener("selectstart",e=>{if(ativo&&visual&&!suspenso)estado(e.inputSource).selecionando=true;});
        s.addEventListener("selectend",e=>{const entrada=estados.get(e.inputSource);if(entrada)entrada.selecionando=false;});
        // A imagem vem dos mesmos elementos/modelos do simulador, antes de esconder a interface 2D.
        definirVista("controle");
        const original=await host.original();
        if(sessao!==s){original.descartar();return;}
        visual=original;
        render.xr.enabled=true;render.xr.setReferenceSpaceType("local-floor");render.xr.setFramebufferScaleFactor(.8);
        ativar();rig.add(visual.malha);visual.malha.position.set(0,1.18,-.55);visual.malha.rotation.set(-.5,0,0);
        interacoes=criarInteracoes();
        ajudaEntrada("Mostre as mãos ou mova os controles do Quest.");
        await render.xr.setSession(s);render.xr.setFoveation(1);
      }
    }catch(e){
      if(sessao){try{await sessao.end();}catch(_){}sessao=null;}
      restaurar();if(visual){visual.descartar();visual=null;}
      avisar("Não foi possível abrir VR: "+(e.message||"confira a permissão dos óculos."));
      console.warn("[VR]",e);
    }finally{entrando=false;atualizarDispositivo();}
  }
  render.domElement.addEventListener("pointermove",e=>{
    if(!ativo||sessao||sensorAtivo)return;
    // Os eventos dos manches originais nao passam pelo canvas do campo.
    if(mouse&&(e.pointerType==="mouse"||e.buttons)){
      yaw-=(e.clientX-mouse.x)*.004;pitch=Math.max(-1.35,Math.min(1.35,pitch-(e.clientY-mouse.y)*.004));
    }
    mouse={x:e.clientX,y:e.clientY};
  });
  render.domElement.addEventListener("pointerleave",()=>{mouse=null;});
  render.domElement.addEventListener("pointerdown",e=>{if(ativo&&!sessao)mouse={x:e.clientX,y:e.clientY};});
  addEventListener("blur",()=>{if(ativo&&!sessao)limpar();});
  document.addEventListener("visibilitychange",()=>{if(ativo&&document.hidden)limpar();});
  addEventListener("keydown",e=>{if(ativo&&e.code==="Escape"){e.preventDefault();sair();}},true);
  btn.onclick=entrar;
  if(navegadorOculos&&navigator.xr&&isSecureContext)navigator.xr.isSessionSupported("immersive-vr").then(ok=>{suportaXR=ok;}).catch(()=>{}).finally(()=>{verificandoXR=false;atualizarDispositivo();});
  else {verificandoXR=false;atualizarDispositivo();}
  window.xgVR={
    get ativo(){return ativo;},get imersivo(){return !!sessao;},get controle(){return visual;},
    get dispositivo(){return document.documentElement.dataset.vrDispositivo;},get suportaImersivo(){return suportaXR;},
    conectar(h){host=h;atualizarDispositivo();},entrar,sair,limpar,camera,
    manches(){return suspenso?zero():comandos;},
    antesQuadro(t,frame){
      if(!ativo){ultimoT=t;return;}
      const dt=Math.max(0,Math.min(.05,(t-(ultimoT||t))/1000));ultimoT=t;
      if(sessao){entradas(frame);host.tique(dt);if(visual)visual.atualizar(t,comandos);}
    },
    renderizar(){
      render.render(cena,cam);
      // A vista de mouse conserva tambem o modelo 3D original do XAG.
      if(!sessao&&window.__xgHud&&__xgHud.visivel){
        render.autoClear=false;render.clearDepth();render.render(__xgHud.cena,__xgHud.cam);render.autoClear=true;
      }
    }
  };
})();
