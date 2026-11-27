/* Checkpoint do simulador. Só dados de operação: não inclui login, saldo,
   conexões, eventos pressionados ou sessões de VR. Executado na mesma origem. */
(function () {
  'use strict';
  const copia = x => JSON.parse(JSON.stringify(x));
  function simples(o) {
    const r = {};
    for (const k of Object.keys(o || {})) {
      const v = o[k];
      if (v == null || ['string','number','boolean'].includes(typeof v)) r[k] = v;
      else if (Array.isArray(v) || Object.getPrototypeOf(v)?.constructor?.name === 'Object') {
        try { r[k] = copia(v); } catch (_) { /* objetos da cena não são estado */ }
      }
    }
    return r;
  }
  function campo() {
    // Não JSONificar a grade inteira (mais de um milhão de células).
    /* 18/11/2026 (Eduardo: "e a pessoa que tá notando que o drone tá travando no simulador?"): este checkpoint roda a cada 5 s e
       travava o quadro (25 a 40 ms num computador rápido, bem mais num fraco, e crescia com a área pulverizada). O que pesava:
       varrer a grade lendo 4 listas por célula e montar a lista de células num array comum, e copiar as gotas por JSON.
       Agora a varredura lê só litros e contagem (toda célula que recebeu gota tem litros; dose e dose da passada vêm junto),
       escreve os índices numa lista fixa reaproveitada, e as gotas são copiadas campo a campo. Os dados gravados são os mesmos. */
    let idsFixo = null;
    function cobertura() {
      const X = window.xgPulv, N = cobN.length, L = X.litros, D = X.dose, DP = X.dosePasse;
      if (!idsFixo || idsFixo.length !== N) idsFixo = new Uint32Array(N);
      let n = 0;
      for (let i=0;i<N;i++) if (L[i] !== 0 || cobN[i] !== 0) idsFixo[n++] = i;
      const ids = idsFixo.slice(0, n);
      const r={w:COB_W,h:COB_H,ids,n:new Uint8Array(n),p:new Int32Array(n),l:new Float32Array(n),d:new Float32Array(n),dp:new Float32Array(n),cor:new Uint8Array(n*4)};
      for (let k=0;k<n;k++) {
        const i=ids[k], pixel=((COB_H-1-((i/COB_W)|0))*COB_W+i%COB_W)*4, c=k*4;
        r.n[k]=cobN[i];r.p[k]=cobPasse[i];r.l[k]=L[i];r.d[k]=D[i];r.dp[k]=DP[i];
        r.cor[c]=pintDados[pixel];r.cor[c+1]=pintDados[pixel+1];r.cor[c+2]=pintDados[pixel+2];r.cor[c+3]=pintDados[pixel+3];
      }
      return r;
    }
    const json = x => JSON.parse(JSON.stringify(x));
    const dados = o => {const r={};Object.keys(o||{}).forEach(k=>{const v=o[k];if(typeof v!=='function' && !v?.isObject3D && !v?.isMaterial && !v?.isBufferGeometry){try{r[k]=json(v);}catch(_){}}});return r;};
    const pose = o => o ? {p:o.position.toArray(),q:o.quaternion.toArray()} : null;
    window.__retomadaCampo = {
      capturar() {
        return {cenario:cen.id,P:json(P),V:dados(V),rota:json(rota),mapa:json(mapaAtual()),base:json(BASE),talhao:json(TALHAO),veiculo:window.xgVeiculo?.salvar?.()||null,
          drone:pose(drone),inclina:pose(inclina),operador:pose(grupoOperador),vista,
          bateria:dados(window.xgBateria),gnss:dados(window.xgGnss),andar:dados(window.xgAndar),
          mapeamento:window.xgMapeamento?.capturar()||null,
          equipe:dados(window.xgEquipe),badeco:pose(window.xgEquipe?.b),
          pulverizacao:dados(window.xgPulvManual),holofote:!!window.__xgHolofote?.ligado,
          vento:json(xgPulv.vento),gotas:xgPulv.motor.gotas.map(g=>Object.assign({},g)),total:json(xgPulv.motor.total),foraGrade:xgPulv.foraGrade,
          cobertura:cobertura()};
      },
      restaurar(s) {
        if(s.cenario!==cen.id) throw Error('O mapa salvo não está disponível para esta conta.');
        if(s.P?.xgMapeamento && !s.mapeamento) throw Error('Este mapeamento foi salvo sem os dados de coleta. Inicie uma nova tarefa de mapeamento.');
        if(s.mapeamento && !window.xgMapeamento?.restaurar) throw Error('O motor de mapeamento ainda não carregou.');
        const c=s.cobertura;
        if(c.w!==COB_W || c.h!==COB_H || c.ids.length!==c.n.length || c.cor.length!==c.ids.length*4 || ['p','l','d','dp'].some(k=>c[k].length!==c.ids.length) || c.ids.some(i=>i>=cobN.length)) throw Error('A cobertura salva é incompatível.');
        comecar();['painel','verif','queda','fim'].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true;});
        Object.keys(P).forEach(k=>delete P[k]);Object.assign(P,s.P);Object.assign(BASE,s.base);Object.assign(TALHAO,s.talhao);window.xgVeiculo?.restaurar?.(s.veiculo);salvarMapa(s.mapa);
        Object.keys(V).forEach(k=>delete V[k]);Object.assign(V,s.V);rota=json(s.rota);
        const repor=(o,p)=>{if(o&&p){o.position.fromArray(p.p);o.quaternion.fromArray(p.q);}};
        repor(drone,s.drone);repor(inclina,s.inclina);repor(grupoOperador,s.operador);
        Object.assign(window.xgBateria||{},s.bateria);Object.assign(window.xgGnss||{},s.gnss);
        if(window.xgMapeamento)window.xgMapeamento.restaurar(s.mapeamento||null);
        Object.assign(window.xgAndar||{},s.andar,{f:0,l:0,giro:0,olhar:0,correr:false});
        Object.assign(window.xgEquipe||{},s.equipe);repor(window.xgEquipe?.b,s.badeco);
        window.xgPulvManual=Object.assign(window.xgPulvManual||{},s.pulverizacao);
        Object.assign(xgPulv.vento,s.vento);xgPulv.motor.limpar();
        s.gotas.forEach(g=>xgPulv.motor.gotas.push(g));Object.assign(xgPulv.motor.total,s.total);xgPulv.foraGrade=s.foraGrade;
        cobN.fill(0);cobPasse.fill(-1);pintDados.fill(0);xgPulv.litros.fill(0);xgPulv.dose.fill(0);xgPulv.dosePasse.fill(0);
        c.ids.forEach((i,k)=>{
          cobN[i]=c.n[k];cobPasse[i]=c.p[k];xgPulv.litros[i]=c.l[k];xgPulv.dose[i]=c.d[k];xgPulv.dosePasse[i]=c.dp[k];
          const pixel=((COB_H-1-Math.floor(i/COB_W))*COB_W+i%COB_W)*4;pintDados.set(c.cor.subarray(k*4,k*4+4),pixel);
        });
        pintMudou=true;pintTx.needsUpdate=true;
        if(window.xgHolofote)window.xgHolofote(s.holofote);
        if(window.xgManches)Object.keys(xgManches).forEach(k=>xgManches[k]=0);
        vista=['drone','controle','operador','livre'].includes(s.vista)?s.vista:'drone';aplicarVista();posCamera(true,0);
        repor(grupoOperador,s.operador);
      }
    };
  }
  function controlador() { return document.getElementById('controle')?.contentWindow; }
  function instalar() {
    const j=window.XG?.ponte?.janela;
    if(!j?.xgPulv || !XG.manual()?.instalado) return false;
    if(!j.__retomadaCampo)j.eval('('+campo.toString()+')()');
    return true;
  }
  const seletores='.painel-config input,.painel-config .interruptor,.painel-config .grupo-opcoes button,.painel-execucao input,.painel-execucao .interruptor,.painel-execucao [id]';
  function capturar() {
    if(!instalar())throw Error('A operação ainda está carregando.');
    const j=controlador(),a=window.__xgAppVirtual;
    const s={campo:XG.ponte.janela.__retomadaCampo.capturar(),vinculo:simples(XG.vinculo()),ajustes:simples(XG.ajustes?.()),
      andamento:simples(XG.operacao()?.andamento),demarcacao:copia(window.__xgDemarcacao||null)};
    delete s.vinculo.foto;delete s.vinculo.caixa;
    if(j?.RETOMADA_XAG)s.xag=j.RETOMADA_XAG.capturar();
    else if(j) {
      s.controle=j.eval('JSON.parse(JSON.stringify({estado,tarefas,emAndamento,abaLista,selecionada,faseControle,modoJoystick}))');
      s.controle.ajustes=Array.from(j.document.querySelectorAll(seletores)).map(e=>({cls:e.className,v:e.value,on:e.getAttribute('aria-pressed'),texto:e.childElementCount?null:e.textContent}));
    }
    if(a?.M)s.app={M:copia({...a.M,arraste:null}),tela:a.APP.tela};
    return s;
  }
  function restaurar(s) {
    if(!instalar())throw Error('A operação ainda está carregando.');
    if ((s.campo?.P?.xgMapeamento || s.campo?.mapeamento || Array.isArray(s.campo?.P?.xgGeo?.map)) && !window.APP_RCPLUS?.mapeamentoDisponivel())
      throw Error('O mapeamento está disponível somente para administrador.');
    const j=controlador(),a=window.__xgAppVirtual;
    // O módulo injeta os ganchos antes de repor V.rodando/altura da missão.
    // A restauração permanece síncrona e pausada pelo fluxo de retomada.
    if(s.campo?.mapeamento && !window.APP_RCPLUS?.instalarMapeamento())throw Error('O motor de mapeamento ainda não carregou.');
    XG.ponte.janela.__retomadaCampo.restaurar(s.campo);
    if(s.xag) {if(!j?.RETOMADA_XAG)throw Error('O controle XAG ainda não carregou.');j.RETOMADA_XAG.restaurar(s.xag);}
    if(s.controle) {
      j.__checkpoint=s.controle;
      j.eval(`(()=>{const s=window.__checkpoint;cancelarTemporizadores();Object.assign(estado,s.estado);tarefas.splice(0,tarefas.length,...s.tarefas);emAndamento.splice(0,emAndamento.length,...s.emAndamento);abaLista=s.abaLista;selecionada=s.selecionada;modoJoystick=s.modoJoystick;definirFaseControle(s.faseControle==='pronto'?'pronto':'desligado');mostrarTela(estado.tela,false);})()`);
      delete j.__checkpoint;
      Array.from(j.document.querySelectorAll(seletores)).forEach((e,i)=>{const v=s.controle.ajustes[i];if(!v)return;e.className=v.cls;if(v.v!==undefined)e.value=v.v;if(v.on!==null)e.setAttribute('aria-pressed',v.on);if(v.texto!==null)e.textContent=v.texto;});
    }
    if(s.app) {
      if(!a?.M)throw Error('O aplicativo do controle ainda não carregou.');
      a.APP.E=APP_RCPLUS.estado();
      Object.assign(a.M,copia(s.app.M));a.mostrar(s.app.tela);a.montar();a.salvarTarefas();a.salvarProg();a.salvarP();
    }
    Object.assign(XG.vinculo()||{},s.vinculo);Object.assign(XG.ajustes?.()||{},s.ajustes);
    Object.assign(XG.operacao()?.andamento||{},s.andamento);
    window.__xgDemarcacao=s.demarcacao;
    XG.ponte.prepararCobertura();
  }
  window.RETOMADA_ESTADO={instalar,capturar,restaurar};
})();
