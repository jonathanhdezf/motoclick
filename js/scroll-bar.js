(function initScrollProgress() {
  const setupBar = () => {
    if (document.getElementById('scrollProgress')) return;

    // Inject CSS Inline to be self-contained
    const style = document.createElement('style');
    style.textContent = \`
      .scroll-progress-container {
        position: fixed;
        top: 0;
        right: 0;
        width: 4px;
        height: 100vh;
        background: rgba(255, 255, 255, 0.03);
        z-index: 10005;
        pointer-events: none;
      }
      .scroll-progress-bar {
        width: 100%;
        height: 0%;
        background: linear-gradient(135deg, #00B347, #00E65B);
        box-shadow: 0 0 15px rgba(0, 230, 91, 0.4);
        transition: height 0.1s linear;
        border-bottom-left-radius: 4px;
        border-bottom-right-radius: 4px;
      }
      @media (max-width: 768px) {
        .scroll-progress-container { width: 3px; }
      }
      .scroll-progress-container.driver-mode .scroll-progress-bar {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
      }
    \`;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.className = 'scroll-progress-container';
    
    // Role detection
    if (window.location.pathname.includes('/repartidor/')) {
      container.classList.add('driver-mode');
    }

    const bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    bar.id = 'scrollProgress';
    container.appendChild(bar);
    document.body.appendChild(container);

    const updateBar = () => {
      const winScroll = window.pageYOffset || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      bar.style.height = scrolled + '%';
    };

    window.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);
    updateBar();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBar);
  } else {
    setupBar();
  }
})();
