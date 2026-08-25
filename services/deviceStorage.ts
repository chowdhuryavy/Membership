/**
 * Device-aware session storage management
 * 
 * Rules:
 * - Sessions persist in localStorage across app closures and are shared across tabs.
 * - sessionStorage is checked first for high-speed retrieval.
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
 * Retrieves a session string:
 * Checks sessionStorage first, falls back to localStorage.
 * This ensures "Open in new tab" works as localStorage is shared.
 */
export const getDeviceSessionItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;

  let sessionVal: string | null = null;
  
  try {
    sessionVal = sessionStorage.getItem(key);
  } catch (e) {
    // Ignore sessionStorage access errors
  }

  if (sessionVal) {
    return sessionVal;
  }

  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

/**
 * Saves a session item to both sessionStorage and localStorage.
 */
export const setDeviceSessionItem = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[DeviceStorage] Failed to write to sessionStorage for key: ${key}`, e);
  }

  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[DeviceStorage] Failed to write to localStorage for key: ${key}`, e);
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
