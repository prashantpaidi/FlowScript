/**
 * Detects URL changes in Single Page Applications (SPAs) that use the History API
 * or hash changes without a hard page reload.
 */

type URLChangeListener = (url: string) => void;

let lastUrl = window.location.href;

export function observeSPAChanges(callback: URLChangeListener) {
  const checkUrl = () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      callback(currentUrl);
    }
  };

  // Intercept History API methods
  const originalPushState = history.pushState;
  history.pushState = function (...args: any[]) {
    // @ts-ignore
    const result = originalPushState.apply(this, args);
    checkUrl();
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args: any[]) {
    // @ts-ignore
    const result = originalReplaceState.apply(this, args);
    checkUrl();
    return result;
  };

  // Listen for back/forward navigation and hash changes
  window.addEventListener('popstate', checkUrl);
  window.addEventListener('hashchange', checkUrl);

  // Fallback: Check on any clicks that might lead to navigation
  // sometimes useful for frameworks that handle navigation in a way that doesn't 
  // immediately trigger the above (though rare for History API users)
  window.addEventListener('click', () => {
    // Small delay to let the URL update
    setTimeout(checkUrl, 0);
  });

  // Return a cleanup function
  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', checkUrl);
    window.removeEventListener('hashchange', checkUrl);
    // Cleanup for the click listener is not strictly necessary if we don't store 
    // the listener but good practice to be consistent
  };
}
