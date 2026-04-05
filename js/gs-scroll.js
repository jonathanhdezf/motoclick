(function() {
  function inject() {
    if (document.getElementById('gs-scroll-bar')) return;
    var s = document.createElement('style');
    s.textContent = ".gs-c{position:fixed;top:0;right:0;width:4px;height:100vh;background:rgba(255,255,255,0.03);z-index:90000;pointer-events:none;}" +
      ".gs-b{width:100%;height:0;background:linear-gradient(135deg,#00B347,#00E65B);box-shadow:0 0 15px rgba(0,230,91,0.4);transition:height 0.1s linear;}" +
      ".gs-c.dr .gs-b{background:linear-gradient(135deg,#3b82f6,#2563eb);box-shadow:0 0 15px rgba(59,130,246,0.5);}";
    document.head.appendChild(s);
    var c = document.createElement('div');
    c.className = 'gs-c';
    if (location.pathname.indexOf('/repartidor/') !== -1) c.classList.add('dr');
    var b = document.createElement('div');
    b.className = 'gs-b'; b.id = 'gs-scroll-bar';
    c.appendChild(b); document.body.appendChild(c);
    function up() {
      var h = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      b.style.height = (h > 0 ? (window.pageYOffset || document.documentElement.scrollTop) / h * 100 : 0) + '%';
    }
    window.addEventListener('scroll', up, {passive:true});
    window.addEventListener('resize', up);
    up();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
