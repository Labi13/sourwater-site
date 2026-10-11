
/* HOUSE RULES — bucket of water. Cards leave the water, drip and dry.
   Each extracted rule stays in the drying pile until the bucket is refilled.
   Reduced motion quiets ambient motion and keeps user interactions fully wet. Without WebGL the grid stays. */
(function(){
  'use strict';
  var sec=document.querySelector('.house-rules');if(!sec)return;
  var stage=sec.querySelector('.rules-bucket'),grid=sec.querySelector('.rules-grid');
  if(!stage||!grid)return;
  var viewAll=sec.querySelector('.rules-view-all'),dialog=sec.querySelector('.rules-dialog');
  if(viewAll&&dialog&&typeof dialog.showModal==='function'){
    viewAll.hidden=false;
    viewAll.addEventListener('click',function(){
      var overview=dialog.querySelector('.rules-overview');
      if(!overview.children.length){
        [].forEach.call(grid.children,function(item){overview.appendChild(item.cloneNode(true));});
      }
      dialog.showModal();viewAll.setAttribute('aria-expanded','true');
    });
    dialog.querySelector('.rules-dialog-close').addEventListener('click',function(){dialog.close();});
    dialog.addEventListener('close',function(){viewAll.setAttribute('aria-expanded','false');});
    dialog.addEventListener('click',function(e){
      if(e.target!==dialog)return;
      var r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
    });
  }
  var bucketStarted=false;
  function initBucket(){
  if(bucketStarted)return;bucketStarted=true;
  var CALM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AMBIENT=CALM?0.4:1;
  var imgEls=[].slice.call(grid.querySelectorAll('img'));if(!imgEls.length)return;
  var canvas=document.createElement('canvas');
  canvas.className='rules-canvas';canvas.setAttribute('aria-hidden','true');
  var gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
  if(!gl)return;

  /* ---------- shaders ---------- */
  var CARD_VS=[
    'attribute vec2 aUV;',
    'uniform vec2 uRes,uCenter,uSize,uVel,uPull,uGrab;',
    'uniform float uRot,uFlat,uMelt,uTime,uSeed,uPad;',
    'varying vec2 vUV;',
    'void main(){',
    '  vec2 p=(aUV-0.5)*(uSize+2.0*uPad);',
    '  vUV=p/uSize+0.5;',
    '  vec2 uv=clamp(vUV,0.0,1.0);',
    '  float m=uMelt;',
    '  float drip=pow(0.5+0.5*sin(uv.x*9.42+uSeed),4.0)*0.6+pow(0.5+0.5*sin(uv.x*17.3+uSeed*2.1),6.0)*0.45;',
    '  p.y+=m*uSize.y*pow(uv.y,1.7)*(0.08+0.34*drip);',
    '  p.y+=m*uSize.y*0.08*pow(abs(uv.x-0.5)*2.0,2.2);',
    '  p.x+=m*uSize.x*0.075*sin(uv.y*3.3+uTime*1.7+uSeed)*uv.y;',
    '  p.x*=1.0-m*0.08*sin(uv.y*3.14159);',
    '  p.y*=uFlat;',
    '  float c=cos(uRot),s=sin(uRot);',
    '  p=vec2(c*p.x-s*p.y,s*p.x+c*p.y);',
    '  float g=distance(uv,uGrab);',
    '  p-=uVel*g;',
    '  p+=uPull*exp(-g*g*5.0);',
    '  vec2 pos=uCenter+p;',
    '  vec2 cl=pos/uRes*2.0-1.0;',
    '  gl_Position=vec4(cl.x,-cl.y,0.0,1.0);',
    '}'].join('\n');
  var CARD_FS=[
    '#ifdef GL_FRAGMENT_PRECISION_HIGH','precision highp float;','#else','precision mediump float;','#endif',
    'uniform sampler2D uTex;',
    'uniform vec2 uSize;',
    'uniform vec4 uTint;',
    'uniform float uWet,uTime,uSeed,uAlpha,uShadow,uPad;',
    'varying vec2 vUV;',
    'void main(){',
    '  vec2 e=min(vUV,1.0-vUV)*uSize;float d=min(e.x,e.y);',
    '  if(uShadow>0.0){',
    '    float a=smoothstep(-uPad,uPad*0.5,d)*uShadow;',
    '    gl_FragColor=vec4(vec3(0.141,0.122,0.102)*a,a);return;',
    '  }',
    '  if(d<-0.5){discard;}',
    '  vec3 c=texture2D(uTex,vUV).rgb;',
    '  c=mix(c,uTint.rgb,uTint.a);',
    '  float sh=pow(max(0.0,sin((vUV.x*1.3+vUV.y)*9.0-uTime*1.3+uSeed)),16.0);',
    '  float st=pow(max(0.0,sin(vUV.x*41.0+uSeed*3.0)),30.0)*smoothstep(0.35,1.0,vUV.y);',
    '  c=c*(1.0-0.13*uWet)+vec3(1.0,0.985,0.94)*(sh*0.30+st*0.18)*uWet;',
    '  float a=clamp(d+0.5,0.0,1.0)*uAlpha;',
    '  gl_FragColor=vec4(c*a,a);',
    '}'].join('\n');
  var FULL_VS='attribute vec2 aP;void main(){gl_Position=vec4(aP,0.0,1.0);}';
  var COMP_FS=[
    'precision highp float;',
    'uniform sampler2D uInner;',
    'uniform vec2 uRes;uniform float uDpr,uTime,uAmbient;',
    'uniform vec4 uRim,uWater,uBody,uBox;',
    'uniform vec4 uRip[8];',
    'float sdE(vec2 p,vec2 c,vec2 r){vec2 q=(p-c)/r;float k=length(q);vec2 g=q/(r*max(k,1e-4));return (k-1.0)/max(length(g),1e-4);}',
    'vec4 over(vec4 d,vec4 s){return s+d*(1.0-s.a);}',
    'float hgt(vec2 p){',
    '  vec2 q=vec2(p.x,(p.y-uWater.y)*uWater.z/uWater.w);',
    '  float h=(sin(q.x*0.019+uTime*1.10)*0.55+sin(q.y*0.023-uTime*0.90+q.x*0.007)*0.45+sin((q.x-q.y*1.3)*0.031+uTime*1.55)*0.28)*uAmbient;',
    '  for(int i=0;i<8;i++){',
    '    vec4 r=uRip[i];float age=uTime-r.z;',
    '    if(r.w<=0.0||age<0.0||age>3.5)continue;',
    '    vec2 d=vec2(p.x-r.x,(p.y-r.y)*uWater.z/uWater.w);',
    '    float dist=length(d);float fr=age*230.0;float band=(dist-fr)/70.0;',
    '    h+=r.w*3.2*sin(dist*0.085-age*12.0)*exp(-band*band)*exp(-age*0.95);',
    '  }',
    '  return h;',
    '}',
    'void main(){',
    '  vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;',
    '  if(p.x<uBox.x||p.x>uBox.z||p.y<uBox.y||p.y>uBox.w){gl_FragColor=vec4(0.0);return;}',
    '  float cx=uRim.x,cy=uRim.y,rx=uRim.z,ry=uRim.w,bodyH=uBody.x,bs=uBody.y,rimW=uBody.z;',
    '  float botY=cy+bodyH;vec3 ink=vec3(0.141,0.122,0.102);',
    '  vec2 gq=(p-vec2(cx,botY+ry*bs*0.70))/vec2(rx*bs*1.30,ry*bs*0.62);',
    '  float gsh=exp(-dot(gq,gq)*2.0)*0.30;',
    '  vec4 col=vec4(ink*gsh,gsh);',
    /* handle, lying back behind the bucket */
    '  vec2 hc=vec2(cx,cy+ry*0.05);vec2 hr=vec2(rx*1.012,ry+rx*0.17);',
    '  if(p.y<hc.y){float hd=abs(sdE(p,hc,hr));float ha=clamp(3.0-hd,0.0,1.0);',
    '    float hl=clamp(1.0-abs(sdE(p,hc+vec2(0.0,-0.9),hr)),0.0,1.0);',
    '    col=over(col,vec4(mix(ink,vec3(0.78,0.75,0.69),hl*0.45)*ha,ha));}',
    /* body */
    '  float t=clamp((p.y-cy)/bodyH,0.0,1.0);float hw=mix(rx,rx*bs,t);float ax=abs(p.x-cx);',
    '  float sb=sdE(p,vec2(cx,botY),vec2(rx*bs,ry*bs));',
    '  if(p.y>=cy-1.0&&ax<=hw+1.0&&(p.y<=botY||sb<=0.5)){',
    '    float aa=clamp(hw-ax+0.5,0.0,1.0);if(p.y>botY)aa*=clamp(0.5-sb,0.0,1.0);',
    '    float u=clamp((p.x-cx)/hw,-1.0,1.0);float cyl=sqrt(max(0.0,1.0-u*u));',
    '    vec3 c=vec3(0.60,0.585,0.55)*(0.42+0.58*cyl);',
    '    c+=vec3(1.0,0.98,0.93)*exp(-pow((u+0.40)/0.12,2.0))*0.30;',
    '    c+=vec3(1.0)*exp(-pow((u-0.64)/0.07,2.0))*0.09;',
    '    c*=0.955+0.045*fract(sin(dot(floor(p*0.7),vec2(12.9898,78.233)))*43758.5453);',
    '    for(int i=0;i<2;i++){float tb=i==0?0.30:0.68;float yb=cy+tb*bodyH+ry*mix(1.0,bs,tb)*cyl;float dy=p.y-yb;',
    '      c*=1.0-0.38*exp(-dy*dy/5.0);c+=vec3(0.96,0.94,0.89)*0.24*exp(-pow(dy+3.2,2.0)/3.0);}',
    '    float ed=smoothstep(hw-2.4,hw-0.6,ax);if(p.y>botY)ed=max(ed,smoothstep(-2.4,-0.6,sb));',
    '    c=mix(c,ink,ed*0.88);',
    '    col=over(col,vec4(c*aa,aa));',
    '  }',
    /* rim, inner wall, water */
    '  float sd=sdE(p,vec2(cx,cy),vec2(rx,ry));',
    '  if(sd<rimW*0.62+1.0){',
    '    if(sd<-rimW*0.38+0.5){',
    '      float yy=clamp((p.y-(cy-ry))/(2.0*ry),0.0,1.0);',
    '      vec3 wall=mix(vec3(0.27,0.26,0.24),vec3(0.47,0.455,0.42),yy);',
    '      vec3 ic=wall;',
    '      float sw=sdE(p,uWater.xy,uWater.zw);',
    '      if(sw<1.0){',
    '        vec2 wq=(p-uWater.xy)/uWater.zw;float wr=length(wq);',
    '        float h=hgt(p);vec2 g=vec2(hgt(p+vec2(1.0,0.0))-h,hgt(p+vec2(0.0,1.0))-h);',
    '        vec2 sp=p+g*10.0;',
    '        vec4 inner=texture2D(uInner,vec2(sp.x/uRes.x,1.0-sp.y/uRes.y));',
    '        float dn=clamp((p.y-(uWater.y-uWater.w))/(2.0*uWater.w),0.0,1.0);',
    '        vec3 wc=mix(vec3(0.06,0.185,0.18),vec3(0.14,0.37,0.355),dn*0.75+0.12);',
    '        wc*=mix(1.0,0.66,smoothstep(0.68,1.0,wr));',
    '        vec3 c=wc*(1.0-inner.a)+inner.rgb;',
    '        c=mix(c,wc,0.08);',
    '        vec3 n=normalize(vec3(-g.x*2.2,-g.y*2.2,1.0));',
    '        float spec=pow(max(dot(n,normalize(vec3(-0.30,-0.50,0.81))),0.0),140.0);',
    '        c+=vec3(1.0,0.97,0.90)*spec*0.75;',
    '        c=mix(c,vec3(0.92,0.89,0.82),0.17*(1.0-dn)*clamp(0.5+n.x*2.0-n.y,0.0,1.0)*smoothstep(0.25,1.0,wr));',
    '        c+=vec3(0.55,0.85,0.80)*0.06*uAmbient*smoothstep(0.55,1.0,sin(p.x*0.055+h*1.8)*sin((p.y-uWater.y)*0.11-h*1.6+uTime*0.7));',
    '        c+=vec3(0.95,0.93,0.86)*0.32*exp(-pow(sw/1.6,2.0));',
    '        float wa=clamp(0.5-sw,0.0,1.0);',
    '        ic=mix(wall,c,wa);',
    '      }',
    '      float ia=clamp(-rimW*0.38-sd+0.5,0.0,1.0);',
    '      col=over(col,vec4(ic*ia,ia));',
    '    }',
    '    float s=(sd-rimW*0.12)/(rimW*0.5);',
    '    float ra=clamp((1.0-abs(s))*rimW*0.5+0.5,0.0,1.0);',
    '    if(ra>0.0){',
    '      vec2 q=(p-vec2(cx,cy))/vec2(rx,ry);float ang=atan(q.y,q.x);',
    '      float tube=sqrt(max(0.0,1.0-s*s));',
    '      vec3 rc=vec3(0.80,0.78,0.73)*(0.55+0.45*tube)*(0.86+0.14*(-sin(ang)));',
    '      rc+=vec3(1.0)*0.35*exp(-pow((s+0.35)/0.22,2.0))*(0.6+0.4*(-sin(ang)));',
    '      rc=mix(rc,ink,smoothstep(0.62,0.95,s)*0.85);',
    '      col=over(col,vec4(rc*ra,ra));',
    '    }',
    '  }',
    '  gl_FragColor=col;',
    '}'].join('\n');
  var DROP_VS='attribute vec3 aP;uniform vec2 uRes;uniform float uDpr;void main(){vec2 cl=aP.xy/uRes*2.0-1.0;gl_Position=vec4(cl.x,-cl.y,0.0,1.0);gl_PointSize=aP.z*2.0*uDpr;}';
  var DROP_FS='precision mediump float;void main(){vec2 q=gl_PointCoord-0.5;float d=length(q)*2.0;float a=smoothstep(1.0,0.72,d);vec3 c=mix(vec3(0.10,0.30,0.29),vec3(0.82,0.93,0.90),smoothstep(0.95,0.35,d));c+=vec3(1.0)*0.6*exp(-dot(q+vec2(0.16,0.18),q+vec2(0.16,0.18))*90.0);gl_FragColor=vec4(c*a*0.92,a*0.92);}';

  function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){throw new Error(gl.getShaderInfoLog(s));}return s;}
  function prog(vs,fs){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    var u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(var i=0;i<n;i++){var info=gl.getActiveUniform(p,i),nm=info.name.replace(/\[0\]$/,'');u[nm]=gl.getUniformLocation(p,info.name);}
    return {p:p,u:u};}
  var P;
  try{P={card:prog(CARD_VS,CARD_FS),comp:prog(FULL_VS,COMP_FS),drop:prog(DROP_VS,DROP_FS)};}
  catch(err){if(window.console)console.warn("rules bucket:",err.message);return;}

  /* enhance: from here on the bucket replaces the grid */
  stage.insertBefore(canvas,stage.firstChild);
  sec.classList.add('is-bucket');grid.setAttribute('aria-hidden','true');
  var hintEl=stage.querySelector('.rules-hint'),liveEl=stage.querySelector('.rules-live'),keysEl=stage.querySelector('.rules-keys');
  var TOUCH=matchMedia('(hover: none)').matches;
  var TXT={pull:stage.getAttribute('data-hint')||'',touch:stage.getAttribute('data-hint-touch')||'',back:(TOUCH?stage.getAttribute('data-back-touch'):stage.getAttribute('data-back'))||'',read:stage.getAttribute('data-read')||''};
  var drying=sec.querySelector('.rules-drying'),dried=sec.querySelector('.rules-dried'),countEl=sec.querySelector('.rules-count');
  var asideBtn=sec.querySelector('.rules-set-aside'),refillBtn=sec.querySelector('.rules-refill'),emptyEl=sec.querySelector('.rules-empty');
  var takenCount=0;
  function hint(t){if(hintEl)hintEl.textContent=t;}
  function updateDrying(){
    drying.hidden=!takenCount;countEl.textContent=takenCount+' / '+imgEls.length;
    asideBtn.hidden=!outCard;emptyEl.hidden=takenCount!==imgEls.length;
    hint(outCard?TXT.back:(takenCount===imgEls.length?emptyEl.textContent:(TOUCH?TXT.touch:TXT.pull)));
  }
  function markTaken(c){
    if(c.taken)return;c.taken=true;takenCount++;if(c.key)c.key.disabled=true;
    var li=document.createElement('li'),b=document.createElement('button'),im=imgEls[c.i].cloneNode(true);
    b.type='button';b.setAttribute('aria-label',TXT.read+': '+c.alt);im.loading='eager';b.appendChild(im);
    if(im.dataset.title){var label=document.createElement('span');label.className='rules-dried-label';label.textContent=im.dataset.title;b.appendChild(label);}
    li.appendChild(b);dried.appendChild(li);
    b.addEventListener('click',function(){
      if(!dialog||!viewAll)return;
      viewAll.click();dialog.querySelector('.rules-overview').children[c.i].scrollIntoView({block:'center'});
    });
    updateDrying();
  }
  function keep(c){
    c.state='kept';c.vx=c.vy=0;if(outCard===c)outCard=null;
    updateDrying();announce(c);if(CALM)start();
  }
  function refill(){
    drag=null;touchId=null;hoverCard=null;outCard=null;window.swDirectDragging=false;canvas.style.cursor='';
    takenCount=0;dried.textContent='';drops.length=0;rip.fill(0);
    cards.forEach(function(c){
      c.taken=false;if(c.key)c.key.disabled=false;c.state=c.ready?'water':'wait';
      c.x=c.hx;c.y=c.hy;c.vx=c.vy=0;c.size=L.sW;c.flat=L.flatW;c.rot=c.hr;
      c.melt=c.wet=c.lift=c.age=0;c.pull=[0,0];c.vel=[0,0];
    });
    updateDrying();announce(null);render();
  }
  asideBtn.addEventListener('click',function(){if(outCard)keep(outCard);});
  refillBtn.addEventListener('click',refill);
  hint(TOUCH?TXT.touch:TXT.pull);

  /* mesh */
  var N=26,verts=[],idx=[];
  for(var j=0;j<=N;j++)for(var i=0;i<=N;i++)verts.push(i/N,j/N);
  for(j=0;j<N;j++)for(i=0;i<N;i++){var a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;idx.push(a,b,c,b,d,c);}
  var meshVB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,meshVB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
  var meshIB=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,meshIB);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);
  var fullVB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,fullVB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var dropVB=gl.createBuffer();
  var aniso=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

  /* framebuffer for the cards under water */
  var fbo=gl.createFramebuffer(),fboTex=gl.createTexture();
  function sizeFbo(w,h){gl.bindTexture(gl.TEXTURE_2D,fboTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,fboTex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);}

  /* ---------- cards ---------- */
  var HOME=[[-0.56,-0.40,-0.22],[0.02,-0.52,0.10],[0.58,-0.38,0.26],[-0.70,0.12,0.18],[-0.24,0.02,-0.12],[0.24,0.06,0.20],[0.70,0.14,-0.24],[-0.36,0.56,0.08],[0.34,0.58,-0.16]];
  var cards=imgEls.map(function(img,k){
    var h=HOME[k%HOME.length];
    return {i:k,alt:img.getAttribute('alt')||'',src:img.getAttribute('src'),tex:null,ready:false,
      nx:h[0],ny:h[1],hr:h[2],x:0,y:-400,vx:0,vy:0,rot:h[2],size:100,flat:0.8,state:'wait',delay:0,
      melt:0,wet:0,lift:0,depth:0.15+((k*37)%9)/9*0.5,pull:[0,0],pvx:0,pvy:0,vel:[0,0],grab:[0.5,0.5],
      seed:1.7+k*2.31,ph:k*1.37,tx:0,ty:0,age:0,dropT:0};
  });
  cards.forEach(function(c){
    var im=new Image();im.decoding='async';
    im.onload=function(){
      var cv=document.createElement('canvas'),textureSize=Math.min(Number(imgEls[c.i].getAttribute('data-texture-size'))||1024,gl.getParameter(gl.MAX_TEXTURE_SIZE));
      cv.width=cv.height=textureSize;
      cv.getContext('2d').drawImage(im,0,0,textureSize,textureSize);
      var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      c.tex=t;c.ready=true;
      if(CALM){c.state='water';c.x=c.hx;c.y=c.hy;c.size=L.sW;c.flat=L.flatW;c.rot=c.hr;start();}
    };
    c.img=im;
  });
  var loadStarted=false;
  function startLoad(){if(loadStarted)return;loadStarted=true;cards.forEach(function(c){c.img.src=c.src;});}

  /* keyboard / screen reader access */
  cards.forEach(function(c){
    var b=document.createElement('button');b.type='button';b.textContent=TXT.read+': '+c.alt;
    c.key=b;b.addEventListener('click',function(){if(c.ready&&!c.taken)pullOut(c);});
    if(keysEl)keysEl.appendChild(b);
  });

  /* ---------- layout ---------- */
  var L={},dpr=1,dprCap=2;
  function layout(){
    var W=stage.clientWidth,H=stage.clientHeight;if(!W||!H)return;
    dpr=Math.min(window.devicePixelRatio||1,dprCap);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    sizeFbo(canvas.width,canvas.height);
    var mob=W<700;
    var rx=mob?W*0.54:Math.min(W*0.42,560);
    var ry=rx*(mob?0.60:0.40);
    var bodyH=ry*(mob?1.05:1.35),bs=0.80,rimW=mob?7:10;
    var cy=H-26-bodyH-ry*bs;
    L={W:W,H:H,mob:mob,cx:W/2,cy:cy,rx:rx,ry:ry,bodyH:bodyH,bs:bs,rimW:rimW,
       wcx:W/2,wcy:cy+ry*0.09,wrx:rx-rimW*0.9,wry:ry*0.86,
       sW:mob?rx*0.72:rx*0.60,flatW:mob?0.84:0.74};
    L.readS=mob?Math.min(W*0.86,H*0.60):Math.min(560,H*0.66,W*0.46);
    L.readY=mob?L.readS/2+44:L.readS/2+40;
    cards.forEach(function(c){
      var hx=L.wcx+c.nx*(L.wrx-L.sW*0.40),hy=L.wcy+c.ny*(L.wry-L.sW*L.flatW*0.40);
      c.hx=hx;c.hy=hy;
      if(c.state==='water'){c.x=hx;c.y=hy;c.size=L.sW;c.flat=L.flatW;}
      if(c.state==='out'){c.size=L.readS;c.tx=clampX(c.tx);c.ty=Math.min(clampY(c.ty),L.readY);}
    });
    if(CALM)start();
  }
  function clampX(x){var h=L.readS/2+10;return Math.max(h,Math.min(L.W-h,x));}
  function clampY(y){var h=L.readS/2+10;return Math.max(h,Math.min(L.H-h,y));}
  function inWater(x,y){var a=(x-L.wcx)/L.wrx,b=(y-L.wcy)/L.wry;return a*a+b*b<1;}

  /* ---------- ripples & drops ---------- */
  var rip=new Float32Array(32),ripN=0,T=0,drops=[];
  function ripple(x,y,amp){var k=(ripN++%8)*4;rip[k]=x;rip[k+1]=y;rip[k+2]=T;rip[k+3]=amp;}
  function splash(x,y,power,n){
    ripple(x,y,power);
    for(var k=0;k<(n||16);k++){var an=-Math.PI*(0.1+0.8*Math.random()),sp=180+Math.random()*420*power;
      drops.push({x:x+(Math.random()-0.5)*L.sW*0.5,y:y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,r:1.6+Math.random()*3.2,wet:true});}
    if(window.swSplash)try{window.swSplash(x,y);}catch(e){}
  }

  /* ---------- state changes ---------- */
  var outCard=null;
  function toTop(c){cards.splice(cards.indexOf(c),1);cards.push(c);}
  function announce(c){if(liveEl)liveEl.textContent=c?c.alt:'';}
  function free(c){
    if(outCard&&outCard!==c)keep(outCard);
    c.state='free';c.melt=1;c.wet=1;c.age=0;outCard=c;markTaken(c);toTop(c);
    splash(c.x,c.y,1.0,18);hint(TXT.back);announce(c);if(CALM)start();
  }
  function pullOut(c){
    if(c.taken)return;
    if(outCard&&outCard!==c)keep(outCard);
    if(c.state==='water'||c.state==='held'){splash(c.x,c.y,1.0,18);}
    c.state='out';c.melt=1;c.wet=1;c.age=0;c.tx=L.W/2;c.ty=L.readY;c.grab=[0.5,0.15];
    outCard=c;markTaken(c);toTop(c);hint(TXT.back);announce(c);if(CALM)start();
  }

  /* ---------- hit testing ---------- */
  function hit(c,px,py){
    if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||!(c.flat>0)||!(c.size>0))return null;
    var dx=px-c.x,dy=py-c.y,co=Math.cos(-c.rot),si=Math.sin(-c.rot);
    var lx=co*dx-si*dy,ly=(si*dx+co*dy)/c.flat;
    var h=c.size/2;if(Math.abs(lx)>h||Math.abs(ly)>h*(1+c.melt*0.3))return null;
    return [lx/c.size+0.5,Math.min(1,ly/c.size+0.5)];
  }
  function topWaterCard(px,py){
    if(!inWater(px,py))return null;
    for(var k=cards.length-1;k>=0;k--){var c=cards[k];if(c.state!=='water'||!c.ready)continue;var uv=hit(c,px,py);if(uv)return {c:c,uv:uv};}
    return null;
  }

  /* ---------- pointer ---------- */
  var drag=null,hoverCard=null,lastRip=0,lastPX=0,lastPY=0;
  function local(cx,cy){var r=canvas.getBoundingClientRect();return [cx-r.left,cy-r.top];}
  function down(p){
    if(outCard&&(outCard.state==='out'||outCard.state==='free')){
      var uv=hit(outCard,p[0],p[1]);
      if(uv){drag={mode:'move',c:outCard,ox:outCard.x-p[0],oy:outCard.y-p[1],sx:p[0],sy:p[1],px:p[0],py:p[1],t:performance.now(),moved:0};outCard.state='free';if(CALM)start();return true;}
    }
    var h=topWaterCard(p[0],p[1]);
    if(h){h.c.state='held';h.c.grab=h.uv;toTop(h.c);drag={mode:'pull',c:h.c,sx:p[0],sy:p[1],px:p[0],py:p[1],t:performance.now(),moved:0};
      ripple(p[0],p[1],0.35);if(CALM)start();return true;}
    return false;
  }
  function move(p){
    if(!drag){
      var h=topWaterCard(p[0],p[1]),oc=outCard&&hit(outCard,p[0],p[1]);
      hoverCard=h?h.c:null;canvas.style.cursor=(h||oc)?'grab':'';
      var now=performance.now(),sp=Math.hypot(p[0]-lastPX,p[1]-lastPY);
      if(inWater(p[0],p[1])&&now-lastRip>110&&sp>4){ripple(p[0],p[1],Math.min(0.45,0.10+sp*0.012));lastRip=now;}
      lastPX=p[0];lastPY=p[1];return;
    }
    canvas.style.cursor='grabbing';if(CALM)start();
    var c=drag.c;drag.moved=Math.max(drag.moved,Math.hypot(p[0]-drag.sx,p[1]-drag.sy));
    drag.px=p[0];drag.py=p[1];
    if(drag.mode==='pull'&&c.state==='held'){
      var dx=p[0]-drag.sx,dy=p[1]-drag.sy,dist=Math.hypot(dx,dy);
      var thr=L.mob?64:104;
      var past=!inWater(p[0],p[1]+L.sW*0.1)&&dist>thr*0.55;
      if(dist>thr||past){free(c);}
    }
  }
  function up(p){
    if(!drag)return;move(p);
    var c=drag.c,tap=drag.moved<8&&performance.now()-drag.t<420;
    var releaseX=p[0],releaseY=p[1];
    if(drag.mode==='pull'){
      var gx=(c.grab[0]-0.5)*c.size,gy=(c.grab[1]-0.5)*c.size*c.flat,co=Math.cos(c.rot),si=Math.sin(c.rot);
      releaseX-=co*gx-si*gy;releaseY-=si*gx+co*gy;
    }else{releaseX+=drag.ox;releaseY+=drag.oy;}
    var swipeLeft=p[0]-drag.sx<-Math.min(90,L.W*0.2)&&p[0]<L.W*0.28;
    if(drag.mode==='pull'){
      if(c.state==='held'){if(tap)pullOut(c);else{c.state='water';ripple(c.x,c.y,0.5);}}
      else if(c.state==='free'){
        if(swipeLeft)keep(c);
        else{c.state='out';c.age=0;c.tx=clampX(releaseX);c.ty=Math.min(clampY(releaseY),L.readY);}
      }
    }else{
      if(tap||swipeLeft)keep(c);
      else{c.state='out';c.tx=clampX(releaseX);c.ty=Math.min(clampY(releaseY),L.readY);}
    }
    drag=null;canvas.style.cursor='';window.swDirectDragging=false;if(CALM)start();
  }
  canvas.addEventListener('pointerdown',function(e){
    if(e.pointerType==='touch')return;
    var p=local(e.clientX,e.clientY);
    if(down(p)){e.preventDefault();window.swDirectDragging=true;try{canvas.setPointerCapture(e.pointerId);}catch(_){}}
  });
  canvas.addEventListener('pointermove',function(e){if(e.pointerType==='touch')return;move(local(e.clientX,e.clientY));});
  canvas.addEventListener('pointerup',function(e){if(e.pointerType==='touch')return;up(local(e.clientX,e.clientY));});
  function finishDrag(){if(drag)up([drag.px,drag.py]);touchId=null;}
  canvas.addEventListener('pointercancel',finishDrag);
  canvas.addEventListener('lostpointercapture',finishDrag);
  addEventListener('blur',finishDrag);
  canvas.addEventListener('pointerleave',function(){if(!drag){hoverCard=null;canvas.style.cursor='';}});
  var touchId=null;
  canvas.addEventListener('touchstart',function(e){
    if(touchId!==null)return;var t=e.changedTouches[0],p=local(t.clientX,t.clientY);
    if(down(p)){touchId=t.identifier;e.preventDefault();window.swDirectDragging=true;}
  },{passive:false});
  canvas.addEventListener('touchmove',function(e){
    if(touchId===null)return;
    for(var k=0;k<e.changedTouches.length;k++){var t=e.changedTouches[k];if(t.identifier===touchId){e.preventDefault();move(local(t.clientX,t.clientY));}}
  },{passive:false});
  function tend(e){
    if(touchId===null)return;
    for(var k=0;k<e.changedTouches.length;k++){var t=e.changedTouches[k];if(t.identifier===touchId){touchId=null;up(local(t.clientX,t.clientY));}}
  }
  canvas.addEventListener('touchend',tend);canvas.addEventListener('touchcancel',tend);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&outCard&&!(dialog&&dialog.open))keep(outCard);});

  /* ---------- simulation ---------- */
  function ease(cur,target,rate,dt){return cur+(target-cur)*(1-Math.exp(-rate*dt));}
  function spring(c,tx,ty,k,damp,dt){
    c.vx+=(tx-c.x)*k*dt;c.vy+=(ty-c.y)*k*dt;c.vx*=Math.exp(-damp*dt);c.vy*=Math.exp(-damp*dt);
    c.x+=c.vx*dt;c.y+=c.vy*dt;
  }
  function step(dt){
    T+=dt;
    cards.forEach(function(c){
      c.age+=dt;
      if(c.state==='wait'){
        if(c.ready&&introAt!==null&&T>introAt+c.delay){c.state='drop';c.x=c.hx;c.y=-L.sW;c.vy=0;c.vx=0;c.size=L.sW;c.flat=1;c.rot=c.hr*2;c.melt=0.35;c.wet=1;}
        return;
      }
      var bobx=Math.sin(T*0.55+c.ph)*5*AMBIENT,boby=Math.cos(T*0.47+c.ph*1.3)*3.5*AMBIENT,bobr=Math.sin(T*0.4+c.ph)*0.03*AMBIENT;
      if(c.state==='drop'){
        c.vy+=2600*dt;c.y+=c.vy*dt;c.x=ease(c.x,c.hx,6,dt);c.flat=ease(c.flat,L.flatW,5,dt);c.rot=ease(c.rot,c.hr,4,dt);
        if(c.y>=c.hy){c.y=c.hy;c.state='water';c.vy=0;splash(c.x,c.y,0.9,10);}
      }else if(c.state==='water'){
        var lt=(c===hoverCard)?1:0;c.lift=ease(c.lift,lt,6,dt);
        c.x=ease(c.x,c.hx+bobx,4,dt);c.y=ease(c.y,c.hy+boby-c.lift*4,4,dt);c.rot=ease(c.rot,c.hr+bobr,3,dt);
        c.size=ease(c.size,L.sW*(1+c.lift*0.04),5,dt);c.flat=ease(c.flat,L.flatW,5,dt);
        c.melt=ease(c.melt,0,2.5,dt);c.wet=ease(c.wet,0,1.5,dt);
        c.pull[0]=ease(c.pull[0],0,7,dt);c.pull[1]=ease(c.pull[1],0,7,dt);
        c.vel[0]=ease(c.vel[0],0,6,dt);c.vel[1]=ease(c.vel[1],0,6,dt);
      }else if(c.state==='held'){
        var dx=drag?drag.px-drag.sx:0,dy=drag?drag.py-drag.sy:0;
        c.x=ease(c.x,c.hx+dx*0.26,14,dt);c.y=ease(c.y,c.hy+dy*0.26,14,dt);
        c.pull[0]=dx*0.74;c.pull[1]=dy*0.74;
        var thr=L.mob?64:104;c.melt=ease(c.melt,Math.min(1,Math.hypot(dx,dy)/thr)*0.45,8,dt);
        c.size=ease(c.size,L.sW*1.05,6,dt);c.lift=1;c.wet=1;
        if(Math.random()<dt*9)ripple(c.x+(Math.random()-0.5)*L.sW*0.5,c.y,0.22);
      }else if(c.state==='free'||c.state==='out'){
        var tx,ty;
        if(c.state==='free'&&drag&&drag.c===c){
          if(drag.mode==='pull'){
            var gx=(c.grab[0]-0.5)*c.size,gy=(c.grab[1]-0.5)*c.size*c.flat,co=Math.cos(c.rot),si=Math.sin(c.rot);
            tx=drag.px-(co*gx-si*gy);ty=drag.py-(si*gx+co*gy);
          }else{tx=drag.px+drag.ox;ty=drag.py+drag.oy;}
        }else{tx=c.tx;ty=c.ty;}
        spring(c,tx,ty,c.state==='free'?190:70,c.state==='free'?15:10,dt);
        var spd=Math.hypot(c.vx,c.vy);
        c.vel[0]=ease(c.vel[0],Math.max(-90,Math.min(90,c.vx*0.045)),10,dt);
        c.vel[1]=ease(c.vel[1],Math.max(-90,Math.min(90,c.vy*0.045)),10,dt);
        c.pull[0]=ease(c.pull[0],0,4.5,dt);c.pull[1]=ease(c.pull[1],0,4.5,dt);
        c.size=ease(c.size,c.state==='free'?L.readS*0.9:L.readS,c.state==='free'?4:3,dt);
        c.flat=ease(c.flat,1,4,dt);
        c.rot=ease(c.rot,c.state==='free'?Math.max(-0.25,Math.min(0.25,c.vx*0.00025)):0,c.state==='free'?5:3.5,dt);
        if(c.state==='free'){if(drag&&drag.mode==='move'){c.melt=ease(c.melt,Math.min(0.3,spd/5000),3,dt);c.wet=Math.max(0,c.wet-dt/2.8);}else{c.melt=ease(c.melt,0.62+Math.min(0.38,spd/2600),2.2,dt);c.wet=1;}}
        else{
          /* dry up, straighten up: decay with a last wobble */
          c.melt=Math.max(0,c.melt*Math.exp(-dt*(c.age<0.25?0.6:2.0)));
          c.wet=Math.max(0,c.wet-dt/2.8);
        }
        if(c.wet>0.12&&Math.random()<dt*c.wet*(c.state==='free'?26:12)){
          var bx=(Math.random()-0.5)*c.size*0.84,by=c.size*0.5*c.flat+c.melt*c.size*0.22,cr=Math.cos(c.rot),sr=Math.sin(c.rot);
          drops.push({x:c.x+cr*bx-sr*by,y:c.y+sr*bx+cr*by,vx:c.vx*0.15,vy:30+Math.random()*60,r:1.8+Math.random()*2.8*c.wet,wet:true});
        }

      }
    });
    for(var k=drops.length-1;k>=0;k--){
      var d=drops[k];d.vy+=1500*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;
      if(d.vy>0&&inWater(d.x,d.y)&&d.y>L.wcy-L.wry*0.6){if(Math.random()<0.5)ripple(d.x,d.y,0.18);drops.splice(k,1);continue;}
      if(d.y>L.H+10||drops.length>220){drops.splice(k,1);}
    }
  }

  /* ---------- render ---------- */
  var WATER_TINT=[0.06,0.185,0.18];
  function bindMesh(prg){var loc=gl.getAttribLocation(prg.p,'aUV');gl.bindBuffer(gl.ARRAY_BUFFER,meshVB);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,meshIB);}
  function drawCard(c,tint,shadow){
    var u=P.card.u;
    var ox=shadow?10+c.melt*6:0,oy=shadow?24:0;
    gl.uniform2f(u.uCenter,c.x+ox,c.y+oy);gl.uniform2f(u.uSize,c.size,c.size);
    gl.uniform2f(u.uVel,c.vel[0],c.vel[1]);gl.uniform2f(u.uPull,c.pull[0],c.pull[1]);gl.uniform2f(u.uGrab,c.grab[0],c.grab[1]);
    gl.uniform1f(u.uRot,c.rot);gl.uniform1f(u.uFlat,c.flat);gl.uniform1f(u.uMelt,c.melt);gl.uniform1f(u.uSeed,c.seed);
    gl.uniform1f(u.uWet,c.wet);
    if(shadow){gl.uniform1f(u.uPad,28);gl.uniform1f(u.uShadow,0.26*(1-c.melt*0.35));}
    else{gl.uniform1f(u.uPad,0);gl.uniform1f(u.uShadow,0);
      gl.uniform4f(u.uTint,WATER_TINT[0],WATER_TINT[1],WATER_TINT[2],tint);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,c.tex);}
    gl.drawElements(gl.TRIANGLES,idx.length,gl.UNSIGNED_SHORT,0);
  }
  function render(){
    var W=L.W,H=L.H;
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    /* 1. cards under water */
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,canvas.width,canvas.height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(P.card.p);bindMesh(P.card);
    var u=P.card.u;gl.uniform2f(u.uRes,W,H);gl.uniform1f(u.uTime,T);gl.uniform1i(u.uTex,0);gl.uniform1f(u.uAlpha,1);
    cards.forEach(function(c){if(c.state==='water'&&c.tex)drawCard(c,0.10+c.depth*(1-c.lift*0.8)*0.55,false);});
    /* 2. bucket + water */
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.useProgram(P.comp.p);var cu=P.comp.u;
    var la=gl.getAttribLocation(P.comp.p,'aP');gl.bindBuffer(gl.ARRAY_BUFFER,fullVB);gl.enableVertexAttribArray(la);gl.vertexAttribPointer(la,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,fboTex);gl.uniform1i(cu.uInner,0);
    gl.uniform2f(cu.uRes,W,H);gl.uniform1f(cu.uDpr,dpr);gl.uniform1f(cu.uTime,T);gl.uniform1f(cu.uAmbient,AMBIENT);
    gl.uniform4f(cu.uRim,L.cx,L.cy,L.rx,L.ry);gl.uniform4f(cu.uWater,L.wcx,L.wcy,L.wrx,L.wry);
    gl.uniform4f(cu.uBody,L.bodyH,L.bs,L.rimW,0);
    gl.uniform4f(cu.uBox,L.cx-L.rx*1.25-40,L.cy-L.ry-L.rx*0.2-12,L.cx+L.rx*1.25+40,L.H);
    gl.uniform4fv(cu.uRip,rip);
    gl.drawArrays(gl.TRIANGLES,0,3);
    /* 3. cards in the air */
    gl.enable(gl.BLEND);
    gl.useProgram(P.card.p);bindMesh(P.card);
    gl.uniform2f(u.uRes,W,H);gl.uniform1f(u.uTime,T);gl.uniform1i(u.uTex,0);gl.uniform1f(u.uAlpha,1);
    var air=cards.filter(function(c){return c.tex&&(c.state==='drop'||c.state==='held'||c.state==='free'||c.state==='out');});
    air.forEach(function(c){if(c.state!=='held'&&c.state!=='drop')drawCard(c,0,true);});
    air.forEach(function(c){drawCard(c,c.state==='held'?0.16:0,false);});
    /* 4. drops */
    if(drops.length){
      var arr=new Float32Array(drops.length*3);drops.forEach(function(d,k){arr[k*3]=d.x;arr[k*3+1]=d.y;arr[k*3+2]=d.r;});
      gl.useProgram(P.drop.p);gl.uniform2f(P.drop.u.uRes,W,H);gl.uniform1f(P.drop.u.uDpr,dpr);
      var da=gl.getAttribLocation(P.drop.p,'aP');gl.bindBuffer(gl.ARRAY_BUFFER,dropVB);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STREAM_DRAW);
      gl.enableVertexAttribArray(da);gl.vertexAttribPointer(da,3,gl.FLOAT,false,0,0);
      gl.drawArrays(gl.POINTS,0,drops.length);gl.disableVertexAttribArray(da);
    }
  }

  /* ---------- loop ---------- */
  var running=false,last=0,introAt=null,raf=0,slow=0;
  function frame(now){
    if(!running){raf=0;return;}
    var dt=Math.min(0.05,(now-last)/1000||0.016);last=now;
    slow=slow*0.95+(dt>0.034?1:0)*0.05;
    if(slow>0.6&&dprCap>1){dprCap=1;slow=0;layout();}
    step(dt);render();
    raf=requestAnimationFrame(frame);
  }
  function start(){if(running)return;running=true;last=performance.now();if(!raf)raf=requestAnimationFrame(frame);}
  function stop(){running=false;}
  layout();
  if(window.ResizeObserver)new ResizeObserver(function(){layout();}).observe(stage);
  else addEventListener('resize',layout);
  cards.forEach(function(c,k){c.delay=0.18+k*0.16;});
  if(window.IntersectionObserver){
    new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)startLoad();});},{rootMargin:'900px 0px'}).observe(stage);
    new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){if(introAt===null)introAt=T+0.15;start();}else stop();
    });},{threshold:0.05}).observe(stage);
  }else{startLoad();introAt=0;start();}
  document.addEventListener('visibilitychange',function(){if(document.hidden){finishDrag();stop();}else if(stage.getBoundingClientRect().bottom>0&&stage.getBoundingClientRect().top<innerHeight)start();});
  canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();stop();sec.classList.remove('is-bucket');grid.removeAttribute('aria-hidden');});
  window.swRulesBucket={cards:cards,pullOut:function(i){var c=cards.filter(function(x){return x.i===i;})[0];if(c&&c.ready)pullOut(c);},returnAll:refill,layout:function(){return L;},tick:function(sec){for(var k=0;k<sec*60;k++)step(1/60);render();}};
  }
  if(window.IntersectionObserver){
    var initObserver=new IntersectionObserver(function(entries){
      if(entries.some(function(entry){return entry.isIntersecting;})){initObserver.disconnect();initBucket();}
    },{rootMargin:'400px 0px'});
    initObserver.observe(sec);
  }else initBucket();
})();
