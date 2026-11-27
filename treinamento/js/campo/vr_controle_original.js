/* Reaproveita os controles existentes. Nao desenha um controle alternativo. */
(function () {
  "use strict";
  const recursos = new Map(), estilos = new WeakMap(), ponteiros = new WeakMap();
  function imagem(url) {
    return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(Error("Imagem do controle indisponivel")); im.src = url; });
  }
  async function embutir(url, base) {
    if (!url || url.startsWith("data:") || url.startsWith("#")) return url;
    const absoluto = new URL(url, base).href;
    if (!recursos.has(absoluto)) recursos.set(absoluto, fetch(absoluto).then(r => { if (!r.ok) throw Error("Recurso do controle: " + r.status); return r.blob(); }).then(blob => new Promise((resolve, reject) => {
      const leitor = new FileReader(); leitor.onload = () => resolve(leitor.result); leitor.onerror = reject; leitor.readAsDataURL(blob);
    })).catch(e => { recursos.delete(absoluto); throw e; }));
    return recursos.get(absoluto);
  }
  async function urls(css, base) {
    const lista = [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)];
    for (const m of lista) {
      if (m[2].startsWith("#") || m[2].startsWith("data:")) continue;
      const dado = await embutir(m[2], base); css = css.replace(m[0], 'url("' + dado + '")');
    }
    return css;
  }
  async function cssDoDocumento(doc) {
    // As folhas fixas sao armazenadas; estilos injetados seguem o documento atual.
    const assinatura = [...doc.styleSheets].map(s => s.href || s.ownerNode.textContent).join("|");
    const salvo = estilos.get(doc); if (salvo && salvo.assinatura === assinatura) return salvo.texto;
    let texto = "";
    for (const sheet of doc.styleSheets) {
      let regras;
      try { regras = [...sheet.cssRules].map(r => r.cssText).join("\n"); }
      catch (_) { continue; } // fontes remotas nao acessiveis: usa a familia de reserva do proprio site
      texto += await urls(regras, sheet.href || doc.baseURI) + "\n";
    }
    estilos.set(doc, { assinatura, texto }); return texto;
  }
  async function fotografar(doc, recorte) {
    const win = doc.defaultView, w = Math.max(1, win.innerWidth), h = Math.max(1, win.innerHeight);
    const copia = doc.documentElement.cloneNode(true);
    const originais = [...doc.querySelectorAll("img,image,canvas,video,iframe,input,textarea,select")];
    const clones = [...copia.querySelectorAll("img,image,canvas,video,iframe,input,textarea,select")];
    await Promise.all(originais.map(async (el, i) => {
      const clone = clones[i];
      if (!clone) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) { if (el.tagName === "IFRAME") clone.remove(); return; }
      // Uma imagem SVG nao e um <img>. O mapa usa <image href="...">;
      // recursos externos nao carregam dentro da imagem foreignObject do VR.
      if (el.localName === "image") {
        const href = el.getAttribute("href") || el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (href) {
          clone.setAttribute("href", await embutir(href, doc.baseURI));
          clone.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
        }
      }
      if (el.tagName === "IMG") { clone.removeAttribute("srcset"); clone.src = await embutir(el.currentSrc || el.src, doc.baseURI); }
      if (el.tagName === "CANVAS" || el.tagName === "IFRAME" || el.tagName === "VIDEO") {
        const im = doc.createElement("img");
        for (const a of [...clone.attributes]) im.setAttribute(a.name, a.value);
        const estilo = win.getComputedStyle(el);
        for (const nome of estilo) im.style.setProperty(nome, estilo.getPropertyValue(nome));
        im.removeAttribute("srcdoc"); im.removeAttribute("srcset");
        if (el.tagName === "VIDEO") {
          // No Quest o video 2D pode parar na sessao imersiva. O canvas FPV
          // original continua sendo desenhado pelo laco XR do simulador.
          let fonte = el;
          if (win.__xgVirtual && el.id === "fpv-video") {
            const campo = win.top.document.getElementById("campo");
            fonte = (campo && campo.contentWindow.__xgFpvCanvas) || el;
          }
          const frame = doc.createElement("canvas");
          frame.width = fonte.videoWidth || fonte.width || el.clientWidth;
          frame.height = fonte.videoHeight || fonte.height || el.clientHeight;
          if (fonte !== el || el.readyState >= 2) frame.getContext("2d").drawImage(fonte, 0, 0, frame.width, frame.height);
          im.src = frame.toDataURL();
        } else if (el.tagName === "CANVAS") {
          if (el.__tpdVRRender) el.__tpdVRRender();
          im.src = el.toDataURL();
        } else {
          const dentro = await fotografar(el.contentDocument);
          im.src = dentro.toDataURL();
        }
        im.style.width = el.clientWidth + "px"; im.style.height = el.clientHeight + "px";
        clone.replaceWith(im);
      }
      if (el.tagName === "INPUT") { clone.setAttribute("value", el.value); if (el.checked) clone.setAttribute("checked", ""); else clone.removeAttribute("checked"); }
      if (el.tagName === "TEXTAREA") clone.textContent = el.value;
      if (el.tagName === "SELECT") [...clone.options].forEach((o, n) => o.toggleAttribute("selected", el.options[n].selected));
    }));
    for (const el of copia.querySelectorAll("script,link,meta,style")) el.remove();
    const style = doc.createElement("style");
    style.textContent = await cssDoDocumento(doc);
    copia.querySelector("head").appendChild(style);
    // Fundo do app, dimensoes e tipografia continuam os originais.
    copia.style.width = w + "px"; copia.style.height = h + "px";
    const xml = new XMLSerializer().serializeToString(copia);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
      '"><foreignObject width="100%" height="100%">' + xml + '</foreignObject></svg>';
    const im = await imagem("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    const r = recorte || { x: 0, y: 0, w, h };
    const cv = doc.createElement("canvas"); cv.width = Math.max(1, Math.round(r.w)); cv.height = Math.max(1, Math.round(r.h));
    cv.getContext("2d").drawImage(im, r.x, r.y, r.w, r.h, 0, 0, cv.width, cv.height);
    return cv;
  }
  function dentro(p, r) { return p && p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h; }
  function ret(el) { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function evento(el, tipo, id, x, y) {
    if (!el) return;
    const win = el.ownerDocument.defaultView;
    let ativos = ponteiros.get(win.document);
    if (!ativos) { ativos = new Map(); ponteiros.set(win.document, ativos); }
    const alvo = ativos.get(id) || el, proto = win.Element.prototype;
    const nomes = ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"];
    const salvos = nomes.map(n => Object.getOwnPropertyDescriptor(proto, n));
    // Eventos WebXR sinteticos nao possuem pointerId nativo. A captura e
    // mantida pelo adaptador, apenas durante estes eventos; toques normais
    // continuam passando pelas implementacoes do navegador.
    const funcoes = [function(){ativos.set(id,this);},function(){if(ativos.get(id)===this)ativos.delete(id);},function(){return ativos.get(id)===this;}];
    try {
      nomes.forEach((n, i) => Object.defineProperty(proto, n, {...salvos[i], value:function(pointerId){
        return pointerId === id ? funcoes[i].call(this) : salvos[i].value.call(this,pointerId);
      }}));
      alvo.dispatchEvent(new win.PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: id, pointerType: "touch", isPrimary: false,
        button: 0, buttons: tipo === "pointerup" || tipo === "pointercancel" ? 0 : 1, clientX: x, clientY: y }));
      if (tipo === "pointerup") alvo.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    } finally {
      nomes.forEach((n, i) => Object.defineProperty(proto,n,salvos[i]));
      if (tipo === "pointerup" || tipo === "pointercancel") ativos.delete(id);
    }
  }
  function alvoTela(doc, x, y) {
    let el = doc.elementFromPoint(x, y);
    while (el && el.tagName === "IFRAME" && el.contentDocument) {
      const r = el.getBoundingClientRect(); x -= r.left; y -= r.top; doc = el.contentDocument; el = doc.elementFromPoint(x, y);
    }
    return { el, x, y };
  }
  async function criar(x) {
    const j = x.ponte.janela, T = j.THREE, doc = document.getElementById("controle").contentDocument;
    const xag = new URLSearchParams(location.search).get("marca") === "xag";
    const portatil = xag && x.vinculo().aparelhoEscolhido() === "portatil";
    const cv = j.document.createElement("canvas"), ctx = cv.getContext("2d");
    let w = 2000, h = 1440, pads = {}, regiaoTela, crop = null, aux = null;
    let sujo = true, ocupado = false, erro = null, ultima = 0, face = null, tela = null;
    let botoes = [], vidro = null, quadro3d = null;
    if (!xag) {
      pads = { esq: { x: 230, y: 810, r: 128, curso: 90 }, dir: { x: 1770, y: 810, r: 128, curso: 90 } };
      regiaoTela = { x: 398, y: 400, w: 1204, h: 765 };
    } else if (!portatil) {
      quadro3d = j.__xgHud;
      if (!quadro3d || !quadro3d.cena.getObjectByName("xgSrc4Vista")) throw Error("Aguarde o controle XAG original carregar.");
      const grupo = quadro3d.cena.getObjectByName("xgSrc4Vista");
      grupo.visible = true; grupo.updateMatrixWorld(true);
      const caixa = new T.Box3().setFromObject(grupo);
      const projetar = v => { v.project(quadro3d.cam); return { x: (v.x + 1) * j.innerWidth / 2, y: (1 - v.y) * j.innerHeight / 2 }; };
      const pontos = [];
      for (const a of [caixa.min.x, caixa.max.x]) for (const b of [caixa.min.y, caixa.max.y]) for (const c of [caixa.min.z, caixa.max.z]) pontos.push(projetar(new T.Vector3(a,b,c)));
      const xs = pontos.map(p=>p.x), ys=pontos.map(p=>p.y);
      crop = { x: Math.floor(Math.min(...xs)), y: Math.floor(Math.min(...ys)), w: Math.ceil(Math.max(...xs)-Math.min(...xs)), h: Math.ceil(Math.max(...ys)-Math.min(...ys)) };
      w=crop.w; h=crop.h;
      for (const [lado,nome] of [["esq","Pivo_joystick_E"],["dir","Pivo_joystick_D"]]) {
        const pivo=grupo.getObjectByName(nome); if (!pivo) throw Error("Manche ausente no modelo XAG original.");
        const centro=new T.Box3().setFromObject(pivo).getCenter(new T.Vector3()), p=projetar(centro);
        pads[lado]={x:p.x-crop.x,y:p.y-crop.y,r:w*.075,curso:w*.055,pivo};
      }
      vidro=window.CONTROLE_XAG_3D.telaNaVista(x.ponte);
      if (!vidro) throw Error("Tela original do XAG ainda nao esta pronta.");
      regiaoTela={x:vidro.x-crop.x,y:vidro.y-crop.y,w:vidro.w,h:vidro.h};
      aux=new T.WebGLRenderer({canvas:j.document.createElement("canvas"),alpha:true,antialias:true});
      aux.setSize(j.innerWidth,j.innerHeight);aux.setPixelRatio(1);aux.outputEncoding=T.sRGBEncoding;
      const pecas=[
        [/^(Botao_ligar|Moldura_ligar|Simbolo_power|Traco_power)/,".hardware-power"],
        [/^(Tecla|Icone|Borda_botao)_E0/,".hardware-side:first-child .hardware-buttons span:nth-child(1)"],
        [/^(Tecla|Icone|Borda_botao)_E1/,".hardware-side:first-child .hardware-buttons span:nth-child(2)"],
        [/^(Tecla|Icone|Borda_botao)_D0/,".hardware-side:last-child .hardware-buttons span:nth-child(1)"],
        [/^(Tecla|Icone|Borda_botao)_D1/,".hardware-side:last-child .hardware-buttons span:nth-child(2)"]
      ];
      grupo.traverse(o=>{if(!o.isMesh)return;const m=pecas.find(a=>a[0].test(o.name));if(!m)return;
        const p=projetar(new T.Box3().setFromObject(o).getCenter(new T.Vector3()));
        botoes.push({x:p.x-crop.x-w*.035,y:p.y-crop.y-h*.035,w:w*.07,h:h*.07,el:doc.querySelector(m[1])});
      });
    } else {
      const remote=doc.querySelector(".remote.handheld"); if(!remote)throw Error("Controle portatil original indisponivel.");
      crop=ret(remote);w=crop.w;h=crop.h;
      const p=ret(remote.querySelector(".handheld-joystick"));
      pads.dir={x:p.x-crop.x+p.w/2,y:p.y-crop.y+p.h/2,r:Math.max(p.w,p.h)/2,curso:Math.max(20,p.w/2)};
      regiaoTela=null;
    }
    cv.width=Math.max(1,Math.round(w));cv.height=Math.max(1,Math.round(h));
    const textura=new T.CanvasTexture(cv);textura.encoding=T.sRGBEncoding;
    const largura=.48, altura=largura*h/w;
    const malha=new T.Mesh(new T.PlaneGeometry(largura,altura),new T.MeshBasicMaterial({map:textura,transparent:true,alphaTest:.02,toneMapped:false,side:T.DoubleSide}));
    malha.name="Controle original VR";
    // Volume usa o contorno do mesmo RC mostrado no SVG; a tela segue sendo o app original.
    const volume=new T.Group(),pivos={};volume.name="Corpo 3D do controle";malha.add(volume);
    const cinza=new T.MeshStandardMaterial({color:0x383b40,roughness:.85}),borracha=new T.MeshStandardMaterial({color:0x171b20,roughness:.95});
    function peca(nome,geo,mat,x,y,z){const m=new T.Mesh(geo,mat);m.name=nome;m.position.set(x,y,z);volume.add(m);return m;}
    const sx=n=>(n/w-.5)*largura,sy=n=>(.5-n/h)*altura;
    if(!xag){
      const s=new T.Shape(),p=(x,y)=>[sx(x),sy(y)];
      s.moveTo(...p(300,345));s.lineTo(...p(1700,345));s.quadraticCurveTo(...p(1765,345),...p(1790,425));
      s.lineTo(...p(1905,565));s.quadraticCurveTo(...p(1948,615),...p(1948,705));s.lineTo(...p(1948,1335));
      s.quadraticCurveTo(...p(1948,1422),...p(1862,1422));s.lineTo(...p(138,1422));
      s.quadraticCurveTo(...p(52,1422),...p(52,1335));s.lineTo(...p(52,705));s.quadraticCurveTo(...p(52,615),...p(95,565));
      s.lineTo(...p(210,425));s.quadraticCurveTo(...p(235,345),...p(300,345));
      peca('Carcaca RC Plus',new T.ExtrudeGeometry(s,{depth:.032,bevelEnabled:false,curveSegments:12}),cinza,0,0,-.033);
      for(const x of [362,1638])peca('Antena RC Plus',new T.BoxGeometry(88/w*largura,345/h*altura,.016),borracha,sx(x),sy(180),-.009);
      for(const lado of ['esq','dir']){
        const c=pads[lado],pivo=new T.Group();pivo.name='Manche 3D '+lado;pivo.position.set(sx(c.x),sy(c.y),0);volume.add(pivo);pivos[lado]=pivo;
        const haste=new T.Mesh(new T.CylinderGeometry(.004,.006,.014,12),cinza);haste.rotation.x=Math.PI/2;haste.position.z=.007;pivo.add(haste);
        const topo=new T.Mesh(new T.CylinderGeometry(.013,.015,.006,24),borracha);topo.rotation.x=Math.PI/2;topo.position.z=.016;pivo.add(topo);
        const pegada=peca('Empunhadura RC '+lado,new T.SphereGeometry(1,20,14),borracha,sx(lado==='esq'?145:1855),sy(1160),-.035);pegada.scale.set(.023,.049,.029);
      }
    }else{
      // O desenho XAG continua vindo de seu modelo existente, com espessura para pega.
      peca('Carcaca XAG',new T.BoxGeometry(largura*.88,altura*.78,.035),cinza,0,-altura*.05,-.02);
    }
    const adapter={
      malha,w,h,largura,altura,pads,
      corpo(p){return !!p && p.x>w*.025 && p.x<w*.975 && p.y>h*.28 && p.y<h*.985 && !adapter.alvo(p);},
      get erro(){return erro;},
      async atualizar(agora, manches, forcar=false) {
        for(const lado of Object.keys(pivos)){pivos[lado].rotation.x=-manches[lado].y*.3;pivos[lado].rotation.y=manches[lado].x*.3;}
        if(ocupado||(!forcar&&agora-ultima<250))return;
        ocupado=true;ultima=agora;
        try {
          if(!xag) {
            const svg=j.document.querySelector("#vCtrlRc svg").cloneNode(true);
            svg.setAttribute("xmlns","http://www.w3.org/2000/svg");svg.setAttribute("width","2000");svg.setAttribute("height","1440");
            face=await imagem("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(svg)));
            // A captura inclui o iframe do app original, suas mensagens e a telemetria.
            tela=await fotografar(doc);
            ctx.clearRect(0,0,w,h);ctx.drawImage(tela,regiaoTela.x,regiaoTela.y,regiaoTela.w,regiaoTela.h);ctx.drawImage(face,0,0,w,h);
          } else if(!portatil) {
            for(const lado of ["esq","dir"]){const p=pads[lado].pivo,m=manches[lado];p.rotation.x=-m.y*.32;p.rotation.z=-m.x*.32;}
            aux.render(quadro3d.cena,quadro3d.cam);
            ctx.clearRect(0,0,w,h);ctx.drawImage(aux.domElement,crop.x,crop.y,w,h,0,0,w,h);
            tela=await fotografar(doc);ctx.drawImage(tela,regiaoTela.x,regiaoTela.y,regiaoTela.w,regiaoTela.h);
          } else {
            tela=await fotografar(doc,crop);ctx.clearRect(0,0,w,h);ctx.drawImage(tela,0,0,w,h);
          }
          textura.needsUpdate=true;erro=null;sujo=false;
        }catch(e){erro=e;console.warn("[VR controle original]",e);}
        finally{ocupado=false;}
      },
      alvo(p) {
        if(!p)return null;
        for(const lado of Object.keys(pads)){const c=pads[lado];if(Math.abs(p.x-c.x)<=c.r&&Math.abs(p.y-c.y)<=c.r)return {tipo:"manche",lado,pad:c};}
        if(regiaoTela&&dentro(p,regiaoTela)){
          const q=alvoTela(doc,(p.x-regiaoTela.x)/regiaoTela.w*doc.defaultView.innerWidth,(p.y-regiaoTela.y)/regiaoTela.h*doc.defaultView.innerHeight);
          return q.el?{tipo:"botao",...q}:null;
        }
        if(!xag){
          const svg=j.document.querySelector("#vCtrlRc svg");
          for(const el of [...svg.querySelectorAll(".rcbt")].reverse()){
            const b=el.getBBox();if(dentro(p,{x:b.x,y:b.y,w:b.width,h:b.height})){
              const pt=svg.createSVGPoint();pt.x=p.x;pt.y=p.y;const q=pt.matrixTransform(svg.getScreenCTM());
              return {tipo:"botao",el,x:q.x,y:q.y};
            }
          }
        }else if(portatil){const q=alvoTela(doc,p.x+crop.x,p.y+crop.y);if(q.el)return {tipo:"botao",...q};}
        else {const b=botoes.find(b=>dentro(p,b));if(b&&b.el){const r=ret(b.el);return {tipo:"botao",el:b.el,x:r.x+r.w/2,y:r.y+r.h/2};}}
        return null;
      },
      evento(alvo,tipo,id){if(alvo&&alvo.tipo==="botao")evento(alvo.el,tipo,id,alvo.x,alvo.y);},
      descartar(){if(aux)aux.dispose();const geos=new Set(),mats=new Set();malha.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textura.dispose();},
      get pronto(){return !sujo&&!erro;}
    };
    await adapter.atualizar(performance.now(),{esq:{x:0,y:0},dir:{x:0,y:0}},true);
    if(!adapter.pronto){adapter.descartar();throw erro||Error("Controle original ainda nao ficou pronto.");}
    return adapter;
  }
  window.VR_CONTROLE_ORIGINAL={criar,fotografar};
})();
