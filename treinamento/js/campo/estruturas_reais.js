/* ===================================================================
   ESTRUTURAS — rede de energia (por tipo) e cabo de fibra óptica.

   Mesmo arquivo no editor (web/estruturas.js) e no treinamento
   (treinamento/js/campo/estruturas_reais.js, copiado pelo gerador a cada
   exportação), como plantas.js. Recebe o THREE de quem chama.

   Devolve, além do desenho, a lista de postes e de trechos de fio: o
   treinamento registra isso como obstáculo (o fio só é visto de perto
   pelo radar, como no campo do jogo).

   Rede:  { tipo, altura, flecha, pontos: [[x,z], ...] }
   Fibra: { altura, pontos: [{x, z, apoio: {tipo:"casa", i} | {tipo:"poste"} | null}] }
   =================================================================== */
(function (raiz) {
  "use strict";

  /* dx = distância lateral (perpendicular à linha), dy = altura em relação
     ao topo útil do poste (onde fica a cruzeta) */
  const TIPOS_REDE = {
    monofasica: {
      nome: "Monofásica rural (1 fio)", altura: 9, flecha: 0.8,
      desc: "Um fio só, no topo do poste. A mais comum em lavoura.",
      fios: [{ dx: 0, dy: 0.32 }], cruzeta: 0, isoladorTopo: true,
    },
    baixa: {
      nome: "Baixa tensão (4 fios no poste)", altura: 9, flecha: 0.6,
      desc: "Quatro fios um embaixo do outro, presos na lateral do poste (rede que entra nas casas).",
      fios: [{ dx: 0.22, dy: -0.15 }, { dx: 0.22, dy: -0.45 }, { dx: 0.22, dy: -0.75 }, { dx: 0.22, dy: -1.05 }], cruzeta: 0, armacao: true,
    },
    trifasica: {
      nome: "Trifásica / média tensão (cruzeta)", altura: 11, flecha: 1.0,
      desc: "Poste alto com cruzeta e três fios em cima, mais o neutro embaixo. São as redes grandes.",
      fios: [{ dx: -1.0, dy: 0.2 }, { dx: 0, dy: 0.2 }, { dx: 1.0, dy: 0.2 }, { dx: 0.2, dy: -1.6 }], cruzeta: 2.4,
    },
  };
  // Proporções visuais paramétricas, não projetos estruturais certificados.
  const transmissao = (nome, forma, altura, fases, desc) => ({nome, forma, torre:true, altura, flecha:altura*.12,
    desc:desc+' Dimensões ilustrativas: ajuste pela torre existente na área.',
    fases, fios:[...fases.map(([x,y])=>({x,y})),{x:-.075,y:1,guarda:true},{x:.075,y:1,guarda:true}]});
  Object.assign(TIPOS_REDE, {
    torre_delta: transmissao('Torre treliçada delta','delta',40,[[-.25,.72],[0,.83],[.25,.72]],'Autoportante, três fases em disposição triangular e dois cabos para-raios.'),
    torre_dupla: transmissao('Torre treliçada de circuito duplo','dupla',45,[[-.17,.54],[.17,.54],[-.2,.7],[.2,.7],[-.17,.85],[.17,.85]],'Seis fases em três níveis de braços.'),
    torre_portico: transmissao('Torre pórtico H','portico',30,[[-.23,.79],[0,.79],[.23,.79]],'Duas colunas e travessa superior, três fases na horizontal.'),
    torre_estaiada: transmissao('Torre estaiada V','estaiada',50,[[-.25,.8],[0,.8],[.25,.8]],'Mastros inclinados em V, travessa e quatro estais ancorados no solo.'),
    torre_monopolo: transmissao('Torre monopolo tubular','monopolo',28,[[-.13,.57],[.13,.57],[-.16,.73],[.16,.73],[-.13,.87],[.13,.87]],'Fuste tubular e braços em três níveis.'),
    torre_ancoragem: transmissao('Torre treliçada de ancoragem','ancoragem',35,[[-.25,.73],[0,.82],[.25,.73]],'Base reforçada e cadeias de isoladores longitudinais para mudanças de direção.')
  });

  function montarTorre(T, def, H, x, z, nx, nz, alt, grupo, M, segmentos) {
    const y=alt(x,z), barras=[], isoladores=[];
    const mundo=p=>new T.Vector3(x+nx*p[0]+nz*p[2], y+p[1], z+nz*p[0]-nx*p[2]);
    function barra(a,b,r=.085,estai=false){
      const A=mundo(a),B=mundo(b); if(A.distanceToSquared(B)<1e-8)return;
      barras.push({a:A,b:B,r});segmentos.push({a:A,b:B,raio:r,fio:estai,nome:estai?'o estai da torre':'a estrutura da torre'});
    }
    function coluna(cx,larg,topo,inclinacao=0,inicio=0){
      const n=8;
      for(let k=0;k<n;k++){
        const ya=H*(inicio+(topo-inicio)*k/n),yb=H*(inicio+(topo-inicio)*(k+1)/n);
        const wa=larg*(1-.72*k/n),wb=larg*(1-.72*(k+1)/n);
        const a=[],b=[];for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
          a.push([cx+inclinacao*k/n+sx*wa,ya,sz*wa]);b.push([cx+inclinacao*(k+1)/n+sx*wb,yb,sz*wb]);
        }
        for(let j=0;j<4;j++){const l=(j+1)%4;barra(a[j],b[j],.11);barra(b[j],b[l],.065);barra(a[j],b[l],.055);barra(a[l],b[j],.055);}
      }
    }
    if(def.forma==='monopolo') barra([0,0,0],[0,H,0],H*.016);
    else if(def.forma==='portico'){coluna(-H*.2,H*.027,.91);coluna(H*.2,H*.027,.91);}
    else if(def.forma==='estaiada'){
      coluna(-H*.025,H*.019,.91,-H*.17);coluna(H*.025,H*.019,.91,H*.17);
      for(const sx of [-1,1])for(const sz of [-1,1]){const ex=sx*H*.42,ez=sz*H*.28;const wp=mundo([ex,0,ez]);barra([sx*H*.19,H*.87,0],[ex,alt(wp.x,wp.z)-y,ez],.045,true);}
    }else if(def.forma==='delta'||def.forma==='ancoragem'){
      // Janela central livre: o condutor central não atravessa o aço.
      coluna(0,H*(def.forma==='ancoragem'?.13:.095),.55);
      coluna(-H*.025,H*.024,.95,-H*.115,.55);
      coluna(H*.025,H*.024,.95,H*.115,.55);
      barra([-H*.14,H*.93,0],[H*.14,H*.93,0],.11);
    }else coluna(0,H*.095,.97);
    for(const f of def.fios){
      const px=f.x*H,py=f.y*H;
      if(f.guarda){barra([0,H*.93,0],[px,py,0],.075);continue;}
      const iy=H*.055;
      // Isolador pendente; na ancoragem o conjunto é longitudinal à linha.
      const a=def.forma==='ancoragem'?[px,py,-H*.05]:[px,py+iy,0];
      const b=[px,py,0];
      if(def.forma==='ancoragem'){
        barra([0,H*.93,0],a,.10);
        if(Math.abs(px)>0)barra([Math.sign(px)*H*.09,H*.72,0],a,.07);
      }else if(Math.abs(px)>0){barra([0,a[1],0],a,.10);barra([0,a[1]-H*.055,0],a,.07);}
      else barra([0,H*.93,0],a,.10);
      isoladores.push({a:mundo(a),b:mundo(b),r:H*.006});
    }
    if(def.forma==='portico'||def.forma==='estaiada'){
      for(const dz of [-H*.018,H*.018]){barra([-H*.27,H*.88,dz],[H*.27,H*.88,dz],.11);barra([-H*.27,H*.93,dz],[H*.27,H*.93,dz],.085);
        for(let k=0;k<12;k++)barra([H*(-.27+.54*k/12),H*.88,dz],[H*(-.27+.54*(k+1)/12),H*.93,dz],.055);}
    }
    function instanciar(lista,material){if(!lista.length)return;const g=new T.CylinderGeometry(1,1,1,6),mesh=new T.InstancedMesh(g,material,lista.length),o=new T.Object3D(),up=new T.Vector3(0,1,0);
      lista.forEach((b,i)=>{o.position.copy(b.a).add(b.b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(up,b.b.clone().sub(b.a).normalize());o.scale.set(b.r,b.a.distanceTo(b.b),b.r);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});mesh.castShadow=true;mesh.frustumCulled=false;grupo.add(mesh);}
    instanciar(barras,M.cruzeta);instanciar(isoladores,M.isolador);
  }
  /* nomes que os mapas antigos gravaram */
  const APELIDOS = { "baixa tensão": "baixa", "média tensão": "trifasica", "alta tensão": "trifasica", "monofásica": "monofasica" };
  const tipoDe = t => TIPOS_REDE[t] ? t : APELIDOS[t] || "baixa";

  const chave = (x, z) => Math.round(x * 5) + "," + Math.round(z * 5);   // 20 cm

  function materiais(T, fantasma) {
    const m = (cor, extra) => new T.MeshStandardMaterial(Object.assign({ color: cor, roughness: 0.85 },
      fantasma ? { transparent: true, opacity: 0.45, depthWrite: false } : {}, extra || {}));
    return { poste: m("#a7abad"), cruzeta: m("#8d9091"), isolador: m("#cfd8d3", { roughness: 0.35 }), fio: m("#1b1d20", { roughness: 0.6, metalness: 0.3 }),
      fibra: m("#111214", { roughness: 0.7 }), gancho: m("#6b6f72") };
  }

  function catenaria(T, a, b, flecha, n) {
    const ps = [];
    for (let k = 0; k <= n; k++) { const t = k / n, p = a.clone().lerp(b, t); p.y -= flecha * 4 * t * (1 - t); ps.push(p); }
    return ps;
  }
  function tubo(T, ps, raio, mat) {
    return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(ps), ps.length * 2, raio, 5, false), mat);
  }

  /* ---------------- rede de energia ---------------- */
  function redes(T, lista, alt, op) {
    op = op || {};
    const M = materiais(T, op.fantasma), grupo = new T.Group(), segmentos = [], postes = [];
    const raioFio = op.raioFio || 0.028;

    /* poste compartilhado: o mesmo ponto em duas redes é UM poste */
    const P = new Map();
    for (const r of lista) {
      const def = TIPOS_REDE[tipoDe(r.tipo)], H = r.altura || def.altura;
      if(def.torre) continue;
      r.pontos.forEach(([x, z]) => {
        const k = chave(x, z), q = P.get(k);
        if (!q) P.set(k, { x, z, H }); else q.H = Math.max(q.H, H);
      });
    }
    for (const q of P.values()) {
      const y = alt(q.x, q.z), g = new T.Group();
      const corpo = new T.Mesh(new T.BoxGeometry(0.24, q.H, 0.3), M.poste);
      corpo.position.y = q.H / 2; corpo.scale.set(1, 1, 1);
      const topo = new T.Mesh(new T.BoxGeometry(0.15, 0.4, 0.19), M.poste); topo.position.y = q.H - 0.2;
      g.add(corpo, topo); g.position.set(q.x, y, q.z);
      g.traverse(o => { if (o.isMesh) o.castShadow = !op.fantasma; });
      grupo.add(g);
      postes.push({ x: q.x, z: q.z, y0: y, y1: y + q.H });
    }

    for (const r of lista) {
      const def = TIPOS_REDE[tipoDe(r.tipo)], H = r.altura || def.altura, fl = r.flecha != null ? r.flecha : def.flecha;
      const fios=def.torre?def.fios.map(f=>({dx:f.x*H,dy:f.y*H-H+.45,guarda:f.guarda})):def.fios;
      const topo = [];
      r.pontos.forEach(([x, z], i) => {
        const viz = r.pontos[Math.min(i + 1, r.pontos.length - 1)], ant = r.pontos[Math.max(i - 1, 0)];
        const ang = Math.atan2(viz[1] - ant[1], viz[0] - ant[0]);
        const y = alt(x, z) + H - 0.45, nx = -Math.sin(ang), nz = Math.cos(ang);
        topo.push({ x, z, y, ang, nx, nz });
        if(def.torre){montarTorre(T,def,H,x,z,nx,nz,alt,grupo,M,segmentos);return;}
        /* ferragem do poste para este tipo de rede */
        if (def.cruzeta) {
          const c = new T.Mesh(new T.BoxGeometry(def.cruzeta, 0.1, 0.1), M.cruzeta);
          c.position.set(x, y, z); c.rotation.y = -ang + Math.PI / 2; grupo.add(c);
        }
        if (def.armacao) {
          const a = new T.Mesh(new T.BoxGeometry(0.05, 1.1, 0.05), M.cruzeta);
          a.position.set(x + nx * 0.2, y - 0.6, z + nz * 0.2); grupo.add(a);
        }
        for (const f of fios) {
          const iso = new T.Mesh(new T.CylinderGeometry(0.05, 0.065, 0.18, 8), M.isolador);
          iso.position.set(x + nx * f.dx, y + f.dy - 0.1, z + nz * f.dx);
          if (f.dy < 0 && !def.armacao) iso.position.y = y + f.dy;
          grupo.add(iso);
        }
      });
      for (let i = 0; i + 1 < topo.length; i++) {
        const A = topo[i], B = topo[i + 1];
        for (const f of fios) {
          const a = new T.Vector3(A.x + A.nx * f.dx, A.y + f.dy, A.z + A.nz * f.dx);
          const b = new T.Vector3(B.x + B.nx * f.dx, B.y + f.dy, B.z + B.nz * f.dx);
          const n=def.torre?Math.max(16,Math.min(128,Math.ceil(a.distanceTo(b)/8))):16;
          const ps = catenaria(T, a, b, f.guarda?fl*.65:fl, n);
          grupo.add(tubo(T, ps, raioFio, M.fio));
          for (let k = 0; k < n; k++) segmentos.push({ a: ps[k], b: ps[k + 1], nome: "a rede " + (def.nome.split(" (")[0]).toLowerCase() });
        }
      }
    }
    return { grupo, segmentos, postes, descartar: () => descartar(grupo, M) };
  }

  /* ---------------- cabo de fibra ---------------- */
  /* altura em cada ponto: na casa, preso no beiral; no poste e solto no ar,
     na altura pedida. Trecho com ponta solta fica RETO (sem barriga) e a
     ponta solta segue mais 20 m na mesma direção, como cabo que vai embora. */
  function fibras(T, lista, alt, casas, op) {
    op = op || {};
    const M = materiais(T, op.fantasma), grupo = new T.Group(), segmentos = [];
    const raio = op.raioFibra || 0.018;
    const altura = (f, p) => {
      if (p.apoio && p.apoio.tipo === "casa" && casas[p.apoio.i]) return alt(p.x, p.z) + Math.min(f.altura, casas[p.apoio.i].alt + 0.3);
      return alt(p.x, p.z) + f.altura;
    };
    for (const f of lista) {
      const pts = f.pontos.map(p => ({ v: new T.Vector3(p.x, altura(f, p), p.z), preso: !!p.apoio, casa: p.apoio && p.apoio.tipo === "casa" }));
      if (pts.length < 2) continue;
      const linha = ps => { grupo.add(tubo(T, ps, raio, M.fibra)); for (let k = 0; k + 1 < ps.length; k++) segmentos.push({ a: ps[k], b: ps[k + 1], nome: "o cabo de fibra" }); };
      for (let i = 0; i + 1 < pts.length; i++) {
        const A = pts[i], B = pts[i + 1], L = A.v.distanceTo(B.v);
        linha(catenaria(T, A.v, B.v, A.preso && B.preso ? Math.min(0.6, L * 0.012) : 0, 10));
      }
      for (const [ponta, antes] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
        if (ponta.preso) {
          if (ponta.casa) { const g = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), M.gancho); g.position.copy(ponta.v); grupo.add(g); }
          continue;
        }
        const dir = ponta.v.clone().sub(antes.v); dir.y = 0;
        if (dir.lengthSq() < 1e-6) continue;
        dir.normalize();
        linha([ponta.v.clone(), ponta.v.clone().addScaledVector(dir, 20)]);
      }
    }
    return { grupo, segmentos, descartar: () => descartar(grupo, M) };
  }

  function descartar(grupo, M) {
    grupo.traverse(o => { if (o.isInstancedMesh && o.dispose) o.dispose(); if (o.geometry) o.geometry.dispose(); });
    for (const k in M) M[k].dispose();
    if (grupo.parent) grupo.parent.remove(grupo);
  }

  raiz.EstruturasReais = { TIPOS_REDE, tipoDe, chave, redes, fibras };
})(typeof window !== "undefined" ? window : this);
