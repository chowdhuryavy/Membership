try {
  const _test = window.localStorage;
  const testKey = '__test_storage__';
  if (_test) {
      _test.setItem(testKey, '1');
      _test.removeItem(testKey);
  }
} catch (e) {
  console.warn('localStorage is blocked. Using memory fallback.');
  const memoryStorage = new Map<string, string>();
  try {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => memoryStorage.get(k) || null,
        setItem: (k: string, v: string) => memoryStorage.set(k, v),
        removeItem: (k: string) => memoryStorage.delete(k),
        clear: () => memoryStorage.clear(),
        get length() { return memoryStorage.size; },
        key: (i: number) => Array.from(memoryStorage.keys())[i] || null,
      },
      writable: true,
      configurable: true,
    });
  } catch (err) {
    console.error('Could not polyfill localStorage:', err);
  }
}

try {
  const _test = window.sessionStorage;
  const testKey = '__test_storage__';
  if (_test) {
      _test.setItem(testKey, '1');
      _test.removeItem(testKey);
  }
} catch (e) {
  console.warn('sessionStorage is blocked. Using memory fallback.');
  const memorySessionStorage = new Map<string, string>();
  try {
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (k: string) => memorySessionStorage.get(k) || null,
        setItem: (k: string, v: string) => memorySessionStorage.set(k, v),
        removeItem: (k: string) => memorySessionStorage.delete(k),
        clear: () => memorySessionStorage.clear(),
        get length() { return memorySessionStorage.size; },
        key: (i: number) => Array.from(memorySessionStorage.keys())[i] || null,
      },
      writable: true,
      configurable: true,
    });
  } catch (err) {
    console.error('Could not polyfill sessionStorage:', err);
  }
}

// Intercept console.warn and console.error to filter out benign/noisy layout or development tools logs
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = function (...args: any[]) {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      // Filter out Recharts container measurement warnings during layout phase
      if (firstArg.includes('The width(0) and height(0) of chart should be greater than 0')) {
        return;
      }
      // Filter out Vite WebSocket reconnection attempts
      if (firstArg.includes('failed to connect to websocket') || firstArg.includes('[vite] failed to connect')) {
        return;
      }
    }
    originalWarn.apply(console, args);
  };

  const originalError = console.error;
  console.error = function (...args: any[]) {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      if (firstArg.includes('failed to connect to websocket') || firstArg.includes('[vite] failed to connect')) {
        return;
      }
    }
    originalError.apply(console, args);
  };
}

