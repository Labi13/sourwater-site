// Carousel arrows. First-party, no autoplay. Cards are plain links, so the page works with this script absent.
(function () {
  var cars = document.querySelectorAll('.sw-car');
  Array.prototype.forEach.call(cars, function (car) {
    var track = car.querySelector('.sw-car-track'), btns = car.querySelectorAll('.sw-car-btn');
    if (!track || btns.length < 2) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function sync() {
      var max = track.scrollWidth - track.clientWidth - 2;
      btns[0].disabled = track.scrollLeft <= 2;
      btns[1].disabled = track.scrollLeft >= max;
      car.querySelector('.sw-car-bar').style.visibility = max <= 0 ? 'hidden' : 'visible';
    }
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        var card = track.querySelector('.sw-card');
        var step = card ? card.getBoundingClientRect().width + 20 : track.clientWidth;
        track.scrollBy({left: step * Number(b.getAttribute('data-dir')), behavior: reduce ? 'auto' : 'smooth'});
      });
    });
    track.addEventListener('scroll', sync, {passive: true});
    window.addEventListener('resize', sync);
    sync();
  });
  var more = document.querySelector('.sw-more');
  if (more) document.addEventListener('keydown', function (e) { if (e.key === 'Escape') more.removeAttribute('open'); });
})();
