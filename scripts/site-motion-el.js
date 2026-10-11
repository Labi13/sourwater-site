
(function(){
  var wordRoots=document.querySelectorAll(
    '.hero h1,.hero .tag,.hero .pos,.hero .hero-note,.diagnosis-strip .label,.commerce-offer h2,.commerce-offer p,.band .head,.band .lead,.band blockquote,.band .tag,.strategy .c,.plan-builder .intro,.plan-question legend,.plan-result h3,.plan-result p,footer .footer-kick,footer h2,footer .studioline'
  );
  Array.prototype.forEach.call(wordRoots,function(root){
    if(root.closest('[data-no-wet]'))return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(textNode){
      if(!/\S/.test(textNode.nodeValue))return NodeFilter.FILTER_REJECT;
      var parent=textNode.parentElement;
      if(!parent||parent.closest('[data-no-wet],script,style,input,textarea,select,button,a,.sw-word-reactive'))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    var textNodes=[],current;
    while((current=walker.nextNode()))textNodes.push(current);
    textNodes.forEach(function(textNode){
      var frag=document.createDocumentFragment();
      textNode.nodeValue.split(/(\s+)/).forEach(function(part){
        if(!part)return;
        if(/^\s+$/.test(part)){frag.appendChild(document.createTextNode(part));return;}
        var span=document.createElement('span');
        span.className='sw-word-reactive sw-local-reactive';span.textContent=part;frag.appendChild(span);
      });
      textNode.parentNode.replaceChild(frag,textNode);
    });
  });
  var nodes=Array.prototype.slice.call(document.querySelectorAll(
    'nav .brand,nav .links a,.hero .studioline,.hero h1,.hero>.wrap>.tag,.hero .pos,.hero .hero-cta,.hero .hero-note,.diagnosis-strip .label,.diagnosis-strip a,.commerce-offer .inner,.band .head,.band .lead,.band blockquote,.band .tags,.band .col,.band .wrap>div[style*="margin-top:60px"],.strategy .c,.plan-builder .intro>*,.plan-builder .plan-question,.plan-builder .plan-result,footer .footer-kick,footer h2,footer .contact,footer .studioline'
  ));
  var localTargets=Array.prototype.slice.call(document.querySelectorAll(
    '.sw-word-reactive,.band .col img,.band .browser,.band .tag,.diagnosis-strip a,.hero-cta a,.btn,.plan-option span,.plan-email,footer .contact a'
  ));
  if(!nodes.length&&!localTargets.length)return;
  nodes.forEach(function(node,index){
    node.classList.add('sw-reactive');
    var size=2+(index%3),lateral=2+(index%3),direction=index%2?1:-1;
    node.style.setProperty('--sw-float-up',(-size)+'px');
    node.style.setProperty('--sw-float-down',(size+2)+'px');
    node.style.setProperty('--sw-float-side',(direction*lateral)+'px');
    node.style.setProperty('--sw-float-opposite',(-direction*(lateral+1))+'px');
    node.style.setProperty('--sw-float-up-diag',(-size*.72).toFixed(2)+'px');
    node.style.setProperty('--sw-float-down-diag',((size+2)*.72).toFixed(2)+'px');
    node.style.setProperty('--sw-float-side-diag',(direction*lateral*.72).toFixed(2)+'px');
    node.style.setProperty('--sw-float-opposite-diag',(-direction*(lateral+1)*.72).toFixed(2)+'px');
    node.style.setProperty('--sw-float-duration',(7.2+(index%5)*.85)+'s');
    node.style.setProperty('--sw-float-delay',(-(index%7)*.83)+'s');
  });
  localTargets.forEach(function(node){node.classList.add('sw-local-reactive');});
  var calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scale=calm ? .72 : 1,sensitivity=1.1,queued=false;
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

  function scrollMotion(){
    queued=false;
    var vh=innerHeight||800;
    nodes.forEach(function(node,index){
      var r=node.getBoundingClientRect();
      if(r.bottom<0||r.top>vh)return;
      var relation=(vh*.5-(r.top+r.height*.5))/vh;
      var strength=7+(index%3)*1.5;
      var y=Math.max(-6,Math.min(6,relation*strength))*scale;
      var x=Math.sin((relation*1.35+index*.31)*Math.PI)*(1.5+index%2)*scale;
      node.style.setProperty('--sw-sy',y.toFixed(2)+'px');
      node.style.setProperty('--sw-sx',x.toFixed(2)+'px');
    });
  }
  function requestScrollMotion(){
    if(!queued){queued=true;requestAnimationFrame(scrollMotion);}
  }
  addEventListener('scroll',requestScrollMotion,{passive:true});
  addEventListener('resize',requestScrollMotion,{passive:true});

  var motionStates=[],motionRunning=false,motionLast=0;
  function directHitAt(x,y){
    var stack=document.elementsFromPoint?document.elementsFromPoint(x,y):[document.elementFromPoint(x,y)];
    for(var i=0;i<stack.length;i++){
      var el=stack[i];if(!el||!el.closest)continue;
      if(el.closest('[data-no-wet]')){if(i===0)return null;continue;}
      var local=el.closest('.sw-local-reactive');
      if(local)return {node:local,local:true};
      var base=el.closest('.sw-reactive');
      if(base)return {node:base,local:false};
    }
    return null;
  }
  function stateFor(hit){
    var state=hit.node._swMellow;
    if(state)return state;
    state={node:hit.node,local:hit.local,x:0,y:0,gx:0,gy:0,tx:0,ty:0,r:0,gr:0,tr:0,seed:Math.random()*6.283,held:false,releaseAt:0};
    hit.node._swMellow=state;motionStates.push(state);return state;
  }
  function writeState(state,now){
    var amount=Math.min(1.15,Math.hypot(state.x,state.y)*.045),phase=(now||0)*.0018+state.seed;
    var organicX=Math.cos(phase)*amount,organicY=Math.sin(phase)*amount*.72;
    if(state.local){
      state.node.style.setProperty('--sw-lx',(state.x+organicX).toFixed(2)+'px');state.node.style.setProperty('--sw-ly',(state.y+organicY).toFixed(2)+'px');
    }else{
      state.node.style.setProperty('--sw-tx',(state.x+organicX).toFixed(2)+'px');state.node.style.setProperty('--sw-ty',(state.y+organicY).toFixed(2)+'px');
    }
    state.node.style.setProperty('--sw-rot',state.r.toFixed(3)+'deg');
  }
  function runMotion(){if(!motionRunning){motionRunning=true;motionLast=0;requestAnimationFrame(motionFrame);}}
  function aimMotion(hit,x,y,held,linger){
    var state=stateFor(hit);state.tx=x;state.ty=y;state.tr=clamp((x-y)*.026,-1.05,1.05);state.held=!!held;state.releaseAt=performance.now()+(linger||520);
    state.node.classList.add('sw-physics-motion','sw-direct-active');
    if(state.local)state.node.classList.add('sw-local-hit');
    state.node.classList.toggle('sw-direct-grabbed',!!held);runMotion();
    if(motionStates.length>34){for(var i=0;i<motionStates.length-30;i++)if(!motionStates[i].held)motionStates[i].releaseAt=0;}
    return state;
  }
  function releaseMotion(state,linger){
    if(!state)return;state.held=false;state.releaseAt=performance.now()+(linger||0);state.node.classList.remove('sw-direct-grabbed');runMotion();
  }
  function motionFrame(now){
    var dt=motionLast?Math.min(2.2,(now-motionLast)/16.667):1;motionLast=now;
    for(var i=motionStates.length-1;i>=0;i--){
      var state=motionStates[i];
      if(!state.held&&now>=state.releaseAt){state.tx=0;state.ty=0;state.tr=0;}
      var pursuing=Math.abs(state.tx)+Math.abs(state.ty)>.08;
      var guideRate=state.held?.18:(pursuing?.115:.045),bodyRate=state.held?.105:(pursuing?.062:.025);
      var guideAlpha=1-Math.pow(1-guideRate,dt),bodyAlpha=1-Math.pow(1-bodyRate,dt);
      state.gx+=(state.tx-state.gx)*guideAlpha;state.gy+=(state.ty-state.gy)*guideAlpha;state.gr+=(state.tr-state.gr)*guideAlpha;
      state.x+=(state.gx-state.x)*bodyAlpha;state.y+=(state.gy-state.y)*bodyAlpha;state.r+=(state.gr-state.r)*bodyAlpha;writeState(state,now);
      if(!state.held&&!pursuing&&Math.abs(state.gx)<.08&&Math.abs(state.gy)<.08&&Math.abs(state.x)<.08&&Math.abs(state.y)<.08){
        state.x=state.y=state.gx=state.gy=state.r=state.gr=0;writeState(state,now);
        state.node.classList.remove('sw-physics-motion','sw-direct-active','sw-direct-grabbed','sw-local-hit');state.node._swMellow=null;motionStates.splice(i,1);
      }
    }
    if(motionStates.length)requestAnimationFrame(motionFrame);else{motionRunning=false;motionLast=0;}
  }
  function resetMotion(){for(var i=0;i<motionStates.length;i++)releaseMotion(motionStates[i],0);}

  var hoverState=null,mouseDrag=null,mouseVX=0,mouseVY=0,mouseLastX=null,mouseLastY=null,suppressClick=null;
  addEventListener('pointermove',function(event){
    if(event.pointerType==='touch')return;
    var rawX=mouseLastX===null?(event.movementX||0):event.clientX-mouseLastX;
    var rawY=mouseLastY===null?(event.movementY||0):event.clientY-mouseLastY;
    mouseLastX=event.clientX;mouseLastY=event.clientY;
    if(mouseDrag&&event.pointerId===mouseDrag.id){
      event.preventDefault();var dx=clamp(event.clientX-mouseDrag.x,-46,46),dy=clamp(event.clientY-mouseDrag.y,-46,46);
      if(Math.hypot(dx,dy)>5)mouseDrag.moved=true;aimMotion(mouseDrag.hit,dx,dy,true,0);return;
    }
    mouseVX=mouseVX*.52+clamp(rawX,-18,18)*.48;mouseVY=mouseVY*.52+clamp(rawY,-18,18)*.48;
    var hit=directHitAt(event.clientX,event.clientY);
    if(hoverState&&(!hit||hoverState.node!==hit.node)){releaseMotion(hoverState,110);hoverState=null;}
    var speed=Math.hypot(mouseVX,mouseVY);
    if(hit&&speed>.08){
      var force=clamp(10+speed*.78,10,22)*scale,nx=mouseVX/speed,ny=mouseVY/speed;
      hoverState=aimMotion(hit,clamp((nx*force-ny*2.4)*sensitivity,-26.4,26.4),clamp((ny*force+nx*2.4)*sensitivity,-26.4,26.4),false,460);
    }
  },{passive:false});
  addEventListener('pointerdown',function(event){
    if(event.pointerType==='touch'||(event.button!==undefined&&event.button!==0))return;
    mouseLastX=event.clientX;mouseLastY=event.clientY;
    var hit=directHitAt(event.clientX,event.clientY);if(!hit)return;
    if(hoverState){releaseMotion(hoverState,0);hoverState=null;}
    mouseDrag={id:event.pointerId,hit:hit,node:hit.node,x:event.clientX,y:event.clientY,moved:false,state:aimMotion(hit,0,0,true,0)};
    window.swDirectDragging=true;try{hit.node.setPointerCapture(event.pointerId);}catch(ignore){}
  },{passive:true});
  function finishMouse(event){
    if(event.pointerType==='touch'||!mouseDrag||event.pointerId!==mouseDrag.id)return;
    var done=mouseDrag;mouseDrag=null;window.swDirectDragging=false;releaseMotion(done.state,100);
    if(done.moved)suppressClick={node:done.node,until:Date.now()+700};
  }
  addEventListener('pointerup',finishMouse,{passive:true});addEventListener('pointercancel',finishMouse,{passive:true});

  var touchCandidate=null,touchDrag=null,touchStartX=0,touchStartY=0,touchLastX=0,touchLastY=0,touchVX=0,touchVY=0;
  function beginTouchDrag(candidate){
    if(!candidate||candidate.cancelled||touchCandidate!==candidate)return;
    candidate.state=aimMotion(candidate.hit,0,0,true,0);candidate.active=true;touchDrag=candidate;window.swDirectDragging=true;
  }
  addEventListener('touchstart',function(event){
    if(event.touches.length!==1)return;
    var touch=event.touches[0],hit=directHitAt(touch.clientX,touch.clientY);
    touchStartX=touchLastX=touch.clientX;touchStartY=touchLastY=touch.clientY;touchVX=touchVY=0;
    if(!hit){touchCandidate=null;return;}
    var candidate={hit:hit,node:hit.node,x:touch.clientX,y:touch.clientY,active:false,cancelled:false,moved:false,timer:0,state:null};
    candidate.timer=setTimeout(function(){beginTouchDrag(candidate);},155);touchCandidate=candidate;
  },{passive:true});
  addEventListener('touchmove',function(event){
    if(event.touches.length!==1)return;
    var touch=event.touches[0];
    if(touchDrag&&touchDrag.active){
      event.preventDefault();
      var dragX=clamp(touch.clientX-touchDrag.x,-52,52),dragY=clamp(touch.clientY-touchDrag.y,-52,52);
      if(Math.hypot(dragX,dragY)>5)touchDrag.moved=true;
      aimMotion(touchDrag.hit,dragX,dragY,true,0);return;
    }
    var total=Math.hypot(touch.clientX-touchStartX,touch.clientY-touchStartY);
    if(touchCandidate){
      if(total>11){touchCandidate.cancelled=true;clearTimeout(touchCandidate.timer);touchCandidate=null;}
      else{touchLastX=touch.clientX;touchLastY=touch.clientY;return;}
    }
    var dx=touch.clientX-touchLastX,dy=touch.clientY-touchLastY;
    touchVX=touchVX*.66+dx*.34;touchVY=touchVY*.66+dy*.34;
    var travel=Math.hypot(touchVX,touchVY);
    if(travel>.2){
      var hit=directHitAt(touch.clientX,touch.clientY);
      if(hit){
        var force=clamp(11+travel*.82,11,24)*scale,nx=touchVX/travel,ny=touchVY/travel;
        aimMotion(hit,clamp((nx*force-ny*2.6)*sensitivity,-28.6,28.6),clamp((ny*force+nx*2.6)*sensitivity,-28.6,28.6),false,620);
      }
    }
    touchLastX=touch.clientX;touchLastY=touch.clientY;
  },{passive:false});
  function finishTouch(){
    if(touchCandidate){clearTimeout(touchCandidate.timer);touchCandidate.cancelled=true;touchCandidate=null;}
    if(!touchDrag)return;
    var done=touchDrag;touchDrag=null;window.swDirectDragging=false;releaseMotion(done.state,120);
    if(done.moved)suppressClick={node:done.node,until:Date.now()+850};
  }
  addEventListener('touchend',finishTouch,{passive:true});
  addEventListener('touchcancel',finishTouch,{passive:true});
  addEventListener('click',function(event){
    if(!suppressClick)return;
    var block=Date.now()<suppressClick.until&&(event.target===suppressClick.node||suppressClick.node.contains(event.target));
    suppressClick=null;if(block){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  addEventListener('contextmenu',function(event){if(mouseDrag||(touchDrag&&touchDrag.active))event.preventDefault();});
  document.documentElement.addEventListener('pointerleave',function(){mouseLastX=mouseLastY=null;if(!mouseDrag){if(hoverState)releaseMotion(hoverState,0);hoverState=null;resetMotion();}},{passive:true});
  window.swMellowPhysics=true;
  scrollMotion();
})();
