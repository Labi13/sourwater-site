
(function(){
  document.querySelectorAll('.register').forEach(function(form){
    var groups=['build','brand','content','production','strategy'];
    var vfd=form.querySelector('[data-vfd]'),count=form.querySelector('[data-count]'),copy=form.querySelector('.plan-copy'),email=form.querySelector('.plan-email');
    var S={idle:'Press one key per row',ready:'Plan printed · email ready',next:'Next row',note:'Choose one key in each row to build a recommendation.',rec:'Recommendation: ',hello:'Hello,\n\nI would like to discuss this plan:\n- ',subject:'My SOURwater plan'};
    var dateEl=form.querySelector('[data-date]'),ticketEl=form.querySelector('[data-ticket]'),timer=0;
    try{dateEl.textContent=new Date().toLocaleDateString('en-US',{day:'2-digit',month:'2-digit',year:'2-digit'});}catch(e){}
    var tk;try{tk=sessionStorage.getItem('swTicket');}catch(e){}
    if(!tk){tk=String(1000+Math.floor(Math.random()*9000));try{sessionStorage.setItem('swTicket',tk);}catch(e){}}
    ticketEl.textContent=tk;
    function status(picks){
      var n=picks.filter(Boolean).length;count.textContent=n+'/'+groups.length;
      if(n===groups.length){vfd.textContent=S.ready;return;}
      var k=picks.findIndex(function(p){return !p;});
      vfd.textContent=n?S.next+' · 0'+(k+1):S.idle;
    }
    form.addEventListener('change',function(ev){
      var picks=groups.map(function(name){return form.querySelector('input[name="'+name+'"]:checked');});
      groups.forEach(function(name,i){
        var li=form.querySelector('[data-row="'+name+'"]'),em=li.querySelector('em'),p=picks[i];
        if(!p)return;
        var label=p.parentNode.querySelector('b').textContent;
        if(em.textContent!==label){em.textContent=label;li.classList.remove('is-empty','is-new');void li.offsetWidth;li.classList.add('is-new');}
      });
      if(ev&&ev.target&&ev.target.checked){
        vfd.textContent=(ev.target.getAttribute('data-code')||'')+' · '+ev.target.parentNode.querySelector('b').textContent;
        clearTimeout(timer);timer=setTimeout(function(){status(picks);},1500);
      }
      var n=picks.filter(Boolean).length;count.textContent=n+'/'+groups.length;
      if(n<groups.length){copy.textContent=S.note;email.classList.remove('is-ready');return;}
      var labels=picks.map(function(item){return item.value;});
      copy.textContent=S.rec+labels.join(' + ');
      email.classList.add('is-ready');
      email.href='mailto:hello@sourwater.space?subject='+encodeURIComponent(S.subject)+'&body='+encodeURIComponent(S.hello+labels.map(function(label,i){return form.querySelector('[data-row="'+groups[i]+'"] span').textContent+': '+label;}).join('\n- '));
    });
  });
})();
