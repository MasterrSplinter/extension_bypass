const fs = require('fs');

function updateMainWorld(path) {
    let content = fs.readFileSync(path, 'utf8');

    // 1. Rewrite bypassWebflix to just rely on user manual click but ensure popups are blocked
    content = content.replace(
        /let webflixBypassed = false;\s*function bypassWebflix\(\) \{[\s\S]*?\}\s*\}/,
        `let webflixBypassed = false;
  function bypassWebflix() {
    if (!window.__WFB_ENABLED) return;
    if (webflixBypassed) return;
    if (!location.hostname.includes('webflix.lol')) return;

    // L'auto-clic (simulé) ne fonctionne pas de manière fiable avec le player Webflix (React)
    // Nous laissons l'utilisateur cliquer manuellement mais nous renforçons le nettoyage des overlays.
    hideAdOverlays();
    
    const playIcon = document.querySelector('svg.lucide-play');
    if (playIcon) {
      const playBtn = playIcon.closest('button');
      if (playBtn) {
        // Optionnel : s'assurer que le bouton est au-dessus
        playBtn.style.position = 'relative';
        playBtn.style.zIndex = '9999999';
        webflixBypassed = true;
      }
    }
  }`
    );

    // 2. Enhance hideAdOverlays to remove ALL full-screen transparent overlays
    content = content.replace(
        /function hideAdOverlays\(\) \{[\s\S]*?\}\s*\}/,
        `function hideAdOverlays() {
    if (!window.__WFB_ENABLED) return;
    const elements = document.querySelectorAll('a, div, iframe');
    elements.forEach(el => {
      if (el.tagName === 'A' && el.href && isAdUrl(el.href)) {
        el.remove();
        return;
      }
      
      const rect = el.getBoundingClientRect();
      const isGiant = rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8;
      
      if (isGiant) {
        const style = window.getComputedStyle(el);
        const isClickable = (el.tagName === 'A' || style.cursor === 'pointer');
        const isOverlay = (style.position === 'absolute' || style.position === 'fixed' || style.position === 'relative');
        const isTransparent = (style.opacity < 0.1 || style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent');
        const isHighZIndex = parseInt(style.zIndex, 10) > 1000;
        
        if (isClickable || (isOverlay && isTransparent && isHighZIndex)) {
          // Ne pas supprimer le conteneur du lecteur vidéo lui-même
          if (!el.querySelector('video') && !el.classList.contains('jwplayer')) {
            console.log('[StreamBlocker/MAIN] Overlay géant/transparent publicitaire supprimé', el);
            el.remove();
          }
        }
      }
    });
  }`
    );

    fs.writeFileSync(path, content);
}

function updateContentJs(path) {
    let content = fs.readFileSync(path, 'utf8');

    // Remove the interception of Webflix manual clicks that was returning early
    content = content.replace(
        /\/\/ Bloquer le clic manuel sur le bouton Play de Webflix[\s\S]*?return;\s*\}/,
        `// Bloquer le clic manuel sur le bouton Play de Webflix pour éviter la popup résiduelle
      if (location.hostname.includes('webflix.lol') && e.detail && e.detail.isPlayBtn) {
          // On ne fait plus return ici, on laisse le message USER_CLICK partir
          // pour que le SW soit prêt à bloquer l'éventuel popup.
      }`
    );

    fs.writeFileSync(path, content);
}

updateMainWorld('chrome/content/main_world.js');
updateMainWorld('firefox/content/main_world.js');
updateContentJs('chrome/content/content.js');
updateContentJs('firefox/content/content.js');

console.log('Updated Webflix bypass logic.');
