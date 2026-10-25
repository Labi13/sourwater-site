
(function(){
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-mermaid-film]').forEach(function(box){
    var sticky=box.querySelector('.mermaid-film-sticky');
    var video=box.querySelector('video');
    var button=box.querySelector('.mermaid-film-button');
    var quality=box.querySelector('.mermaid-film-quality select');
    var playing=false,queued=false,duration=44;
    function clamp(value){return Math.max(0,Math.min(1,value));}
    function progress(){
      var rect=box.getBoundingClientRect();
      return clamp(-rect.top/Math.max(1,box.offsetHeight-window.innerHeight));
    }
    function update(){
      queued=false;
      if(playing||reduced)return;
      var p=progress();
      box.style.setProperty('--film-progress',p.toFixed(4));
      if(video.readyState>=1&&isFinite(video.duration)){
        var target=Math.min(video.duration-.08,video.duration*p);
        if(Math.abs(video.currentTime-target)>.08)video.currentTime=target;
      }
    }
    function requestUpdate(){if(!queued){queued=true;requestAnimationFrame(update);}}
    function chosenSource(){return quality.options[quality.selectedIndex].getAttribute('data-src');}
    function changeSource(source,time,shouldPlay){
      var target=Math.max(0,time||0);
      video.src=source;video.load();
      video.addEventListener('loadedmetadata',function ready(){
        video.removeEventListener('loadedmetadata',ready);
        video.currentTime=Math.min(target,Math.max(0,video.duration-.08));
        if(shouldPlay)video.play().catch(function(){button.textContent=button.getAttribute('data-resume');});
      });
    }
    video.addEventListener('loadedmetadata',function(){duration=video.duration||44;update();});
    video.addEventListener('contextmenu',function(event){event.preventDefault();});
    quality.addEventListener('change',function(){
      var time=video.currentTime||0,shouldPlay=playing&&!video.paused;
      changeSource(chosenSource(),time,shouldPlay);
    });
    button.addEventListener('click',function(){
      if(!playing){
        playing=true;box.classList.add('is-playing');video.muted=false;video.controls=true;
        button.textContent=button.getAttribute('data-pause');
        video.currentTime=0;
        video.play().catch(function(){
          playing=false;box.classList.remove('is-playing');video.controls=false;video.muted=true;
          button.textContent=button.getAttribute('data-play');
        });
      }else if(video.paused){video.play();button.textContent=button.getAttribute('data-pause');}
      else{video.pause();button.textContent=button.getAttribute('data-resume');}
    });
    video.addEventListener('play',function(){if(playing)button.textContent=button.getAttribute('data-pause');});
    video.addEventListener('pause',function(){if(playing&&!video.ended)button.textContent=button.getAttribute('data-resume');});
    video.addEventListener('ended',function(){
      playing=false;box.classList.remove('is-playing');video.controls=false;video.muted=true;button.textContent=button.getAttribute('data-play');update();
    });
    addEventListener('scroll',requestUpdate,{passive:true});
    addEventListener('resize',requestUpdate,{passive:true});
    document.addEventListener('visibilitychange',function(){if(document.hidden&&playing)video.pause();});
    if(!reduced)requestUpdate();
  });
})();
