document.querySelectorAll('[data-ai-film]').forEach(function(player){
  var video=player.querySelector('video');
  var play=player.querySelector('[data-film-play]');
  var mute=player.querySelector('[data-film-mute]');
  var full=player.querySelector('[data-film-fullscreen]');
  var seek=player.querySelector('input');
  var time=player.querySelector('output');
  var status=player.querySelector('[data-film-status]');
  var greek=document.documentElement.lang==='el';
  function stamp(seconds){seconds=Math.floor(Number.isFinite(seconds)?seconds:0);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
  function update(){
    play.textContent=video.paused?(greek?'Αναπαραγωγή':'Play film'):(greek?'Παύση':'Pause');
    play.setAttribute('aria-pressed',String(!video.paused));
    mute.textContent=video.muted?(greek?'Ήχος':'Unmute'):(greek?'Σίγαση':'Mute');
    mute.setAttribute('aria-pressed',String(video.muted));
    seek.disabled=!Number.isFinite(video.duration);
    seek.max=Number.isFinite(video.duration)?video.duration:40;
    seek.value=video.currentTime;
    seek.setAttribute('aria-valuetext',stamp(video.currentTime)+' / '+stamp(video.duration));
    time.textContent=stamp(video.currentTime)+' / '+stamp(video.duration||40);
  }
  function toggle(){
    if(!video.paused){video.pause();return;}
    status.textContent='';
    // Keep play inside the click gesture so mobile browsers allow sound.
    video.play().catch(function(){status.textContent=greek?'Η αναπαραγωγή δεν ξεκίνησε. Δοκιμάστε ξανά.':'Playback could not start. Please try again.';});
  }
  play.addEventListener('click',toggle);
  video.addEventListener('click',toggle);
  player.addEventListener('contextmenu',function(event){event.preventDefault();});
  mute.addEventListener('click',function(){video.muted=!video.muted;});
  seek.addEventListener('input',function(){if(Number.isFinite(video.duration))video.currentTime=Number(seek.value);});
  full.addEventListener('click',function(){
    var action=document.fullscreenElement?document.exitFullscreen():player.requestFullscreen?player.requestFullscreen():video.webkitEnterFullscreen?video.webkitEnterFullscreen():null;
    if(action&&action.catch)action.catch(function(){status.textContent=greek?'Η πλήρης οθόνη δεν είναι διαθέσιμη σε αυτό το πρόγραμμα περιήγησης.':'Fullscreen is unavailable in this browser.';});
  });
  ['loadedmetadata','timeupdate','play','pause','ended','volumechange'].forEach(function(name){video.addEventListener(name,update);});
  video.addEventListener('waiting',function(){status.textContent=greek?'Φόρτωση ταινίας…':'Loading film…';});
  video.addEventListener('seeked',function(){status.textContent='';});
  video.addEventListener('playing',function(){status.textContent='';});
  video.addEventListener('error',function(){status.textContent=greek?'Δεν ήταν δυνατή η φόρτωση της ταινίας. Ανανεώστε τη σελίδα και δοκιμάστε ξανά.':'The film could not load. Refresh the page and try again.';});
  update();
});
