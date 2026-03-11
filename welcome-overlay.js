(function () {
  var loader = document.getElementById('loadingScreen');
  if (!loader) return;

  var container = document.getElementById('loaderContainer');
  var topRow = document.getElementById('loaderTopRow');
  var center = document.getElementById('loaderCenter');
  var title = document.getElementById('loaderTitle');
  var bottomRow = document.getElementById('loaderBottomRow');
  var typeText = document.getElementById('loaderTypeText');

  var state = {
    visible: true,
    fullText: typeText ? typeText.dataset.fullText || 'Explore Incredible India' : 'Explore Incredible India'
  };

  var timers = {
    typeInterval: null,
    hideTimer: null,
    unlockTimer: null
  };

  function lockPageScroll() {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
  }

  function unlockPageScroll() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.height = '';
  }

  function enforceOverlayPosition() {
    loader.style.position = 'fixed';
    loader.style.top = '0';
    loader.style.left = '0';
    loader.style.right = '0';
    loader.style.bottom = '0';
    loader.style.width = '100vw';
    loader.style.height = '100vh';
    loader.style.zIndex = '99999';
    loader.style.display = 'flex';
    loader.style.alignItems = 'center';
    loader.style.justifyContent = 'center';
    loader.style.pointerEvents = 'auto';
  }

  function setInitialRevealState() {
    if (topRow) {
      topRow.style.opacity = '0';
      topRow.style.transform = 'translateY(-18px)';
    }
    if (center) {
      center.style.opacity = '0';
      center.style.transform = 'translateY(16px)';
    }
    if (bottomRow) {
      bottomRow.style.opacity = '0';
      bottomRow.style.transform = 'translateY(22px)';
    }
    if (title) {
      title.style.opacity = '0';
      title.style.transform = 'translateY(10px)';
    }
  }

  function animateReveal() {
    var framer = window.Motion || window.framerMotion;
    var canUseFramerAnimate = framer && typeof framer.animate === 'function';

    if (canUseFramerAnimate) {
      if (container) {
        framer.animate(
          container,
          { opacity: [0, 1], transform: ['scale(0.98)', 'scale(1)'] },
          { duration: 0.55, easing: 'ease-out' }
        );
      }
      if (topRow) {
        framer.animate(
          topRow,
          { opacity: [0, 1], transform: ['translateY(-18px)', 'translateY(0px)'] },
          { duration: 0.55, delay: 0.12, easing: 'ease-out' }
        );
      }
      if (title) {
        framer.animate(
          title,
          { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] },
          { duration: 0.45, delay: 0.22, easing: 'ease-out' }
        );
      }
      if (center) {
        framer.animate(
          center,
          { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] },
          { duration: 0.55, delay: 0.2, easing: 'ease-out' }
        );
      }
      if (bottomRow) {
        framer.animate(
          bottomRow,
          { opacity: [0, 1], transform: ['translateY(22px)', 'translateY(0px)'] },
          { duration: 0.6, delay: 0.35, easing: 'ease-out' }
        );
      }
      return;
    }

    [topRow, title, center, bottomRow].forEach(function (el, idx) {
      if (!el) return;
      el.style.transition = 'all 0.6s ease';
      window.setTimeout(function () {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 120 + idx * 100);
    });
  }

  function startTypewriter() {
    if (!typeText) return;
    typeText.textContent = '';
    var index = 0;

    timers.typeInterval = window.setInterval(function () {
      index += 1;
      typeText.textContent = state.fullText.slice(0, index);
      if (index >= state.fullText.length) {
        window.clearInterval(timers.typeInterval);
      }
    }, 60);
  }

  function hideOverlay() {
    if (!state.visible) return;
    state.visible = false;

    var framer = window.Motion || window.framerMotion;
    var canUseFramerAnimate = framer && typeof framer.animate === 'function';

    if (canUseFramerAnimate) {
      framer.animate(
        loader,
        { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(-16px)'] },
        { duration: 0.65, easing: 'ease-in-out' }
      );
      timers.unlockTimer = window.setTimeout(function () {
        loader.style.display = 'none';
        loader.classList.add('hidden');
        loader.style.pointerEvents = 'none';
        unlockPageScroll();
      }, 700);
      return;
    }

    loader.style.transition = 'opacity 0.65s ease, transform 0.65s ease';
    loader.style.opacity = '0';
    loader.style.transform = 'translateY(-16px)';
    timers.unlockTimer = window.setTimeout(function () {
      loader.style.display = 'none';
      loader.classList.add('hidden');
      loader.style.pointerEvents = 'none';
      unlockPageScroll();
    }, 700);
  }

  function startWelcomeOverlay() {
    enforceOverlayPosition();
    lockPageScroll();
    setInitialRevealState();
    animateReveal();
    startTypewriter();

    timers.hideTimer = window.setTimeout(hideOverlay, 5000);
  }

  window.addEventListener('beforeunload', function () {
    window.clearInterval(timers.typeInterval);
    window.clearTimeout(timers.hideTimer);
    window.clearTimeout(timers.unlockTimer);
    unlockPageScroll();
  });

  startWelcomeOverlay();
})();
