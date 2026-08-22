/**
 * Device-aware session storage management
 * 
 * Rules:
 * - On Mobile (iOS, Android, Tablets): Sessions persist in localStorage across app closures.
 * - On Desktop / Desktop PWA: Sessions are stored in sessionStorage ONLY so closing the app window
 *   automatically logs out the user on next launch.
 */

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  
  // Test common mobile user agent signatures
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Silk|Kindle/i.test(ua);
  
  // Test iPadOS (Safari on iPad reports as Macintosh with multi-touch points)
  const isTouchMac = /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;

  return Boolean(isMobileUA || isTouchMac);
};

/**
 * Retrieves a session string based on device type:
 * - On mobile: checks sessionStorage first, falls back to localStorage (persistent across app restarts).
 * - On desktop / desktop PWA: checks sessionStorage ONLY. If not found, purges any legacy/stale
 *   localStorage token so closing and reopening the desktop app logs the user out.
 */
export const getDeviceSessionItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;

  const isMobile = isMobileDevice();
  let sessionVal: string | null = null;
  
  try {
    sessionVal = sessionStorage.getItem(key);
  } catch (e) {
    // Ignore sessionStorage access errors
  }

  if (sessionVal) {
    return sessionVal;
  }

  if (isMobile) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  } else {
    // Desktop / Desktop PWA: If not active in sessionStorage, clear any legacy persistent entry
    try {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }
};

/**
 * Saves a session item based on device type:
 * - Mobile: saves to both sessionStorage and localStorage (persists across app closure).
 * - Desktop / Desktop PWA: saves to sessionStorage ONLY and removes from localStorage
 *   (session terminates when the desktop app/window is closed).
 */
export const setDeviceSessionItem = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[DeviceStorage] Failed to write to sessionStorage for key: ${key}`, e);
  }

  if (isMobileDevice()) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[DeviceStorage] Failed to write to localStorage for key: ${key}`, e);
    }
  } else {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
  }
};

/**
 * Removes a session item from both sessionStorage and localStorage.
 */
export const removeDeviceSessionItem = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch (e) {
    // Ignore
  }
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // Ignore
  }
};
