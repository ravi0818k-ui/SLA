/**
 * PWA registration (requirement 16).
 *
 * The service worker is registered with a scope of /mindmap/ so it can never
 * cache or intercept the rest of superlearneracademy.in — the landing page,
 * the quiz and the notes generator keep their own (non-service-worker)
 * behaviour.
 *
 * Registration is deferred to the load event so it never competes with the
 * editor's first paint.
 */
export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // A service worker needs a secure origin; file:// previews simply skip it.
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

    const register = () => {
        navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {
            // Offline support is a bonus, never a hard requirement.
        });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
}

/**
 * The "Install app" button only makes sense once the browser says the app is
 * installable, so the event is captured and the caller is told when to show it.
 */
export function watchInstallPrompt(onAvailable) {
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferred = event;
        onAvailable(async () => {
            if (!deferred) return false;
            deferred.prompt();
            const choice = await deferred.userChoice;
            deferred = null;
            return choice && choice.outcome === 'accepted';
        });
    });
    window.addEventListener('appinstalled', () => { deferred = null; });
}
