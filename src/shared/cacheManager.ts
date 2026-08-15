/**
 * Centralized Cache & Storage Lifecycle Manager
 * Handles multi-device automated cache versioning, manual cache purge,
 * and service worker cache invalidation.
 */

export const CURRENT_CACHE_VERSION = 'v_2026_08_15_r2';

const DATA_CACHE_KEYS = [
  'membership_members',
  'company_outlets_cache',
  'company_properties_cache',
  'company_roles_cache',
  'membership_categories_cache',
  'membership_types_cache',
  'portal_users_cache',
  'staff_members_cache',
  'app_settings_cache',
  'offline_sync_queue',
  'pos_product_catalog_cache',
  'massage_types_cache'
];

/**
 * Automatically purges stale data caches across all client devices
 * when a new build or cache version is released.
 */
export function autoValidateCacheVersion(): boolean {
  try {
    const storedVersion = localStorage.getItem('app_system_cache_version');
    if (storedVersion !== CURRENT_CACHE_VERSION) {
      console.log(`[CacheManager] Stale cache detected (${storedVersion || 'none'} vs ${CURRENT_CACHE_VERSION}). Invalidate and re-syncing.`);
      purgeDataCachesOnly();
      localStorage.setItem('app_system_cache_version', CURRENT_CACHE_VERSION);
      return true;
    }
  } catch (e) {
    console.warn('[CacheManager] Error validating cache version:', e);
  }
  return false;
}

/**
 * Clears data caches from localStorage while preserving user login credentials and session.
 */
export function purgeDataCachesOnly() {
  try {
    DATA_CACHE_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
    // Remove any timestamped or dynamic cache entries
    Object.keys(localStorage).forEach(key => {
      if (key.endsWith('_cache') || key.startsWith('cached_') || key.startsWith('offline_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error('[CacheManager] Error purging data caches:', e);
  }
}

/**
 * 1-Click Complete Cache Purge & Fresh Synchronization
 * Clears data cache, deletes Service Worker CacheStorage buckets,
 * updates version stamp, and triggers a clean reload.
 */
export async function purgeAllDeviceCaches(options: { reload?: boolean; hardLogout?: boolean } = { reload: true, hardLogout: false }) {
  try {
    if (options.hardLogout) {
      localStorage.clear();
      sessionStorage.clear();
    } else {
      purgeDataCachesOnly();
      localStorage.setItem('app_system_cache_version', CURRENT_CACHE_VERSION);
    }

    // Purge Service Worker / PWA caches
    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
      } catch (err) {
        console.warn('[CacheManager] Error clearing ServiceWorker caches:', err);
      }
    }

    if (options.reload) {
      // Force hard reload from server
      window.location.reload();
    }
  } catch (e) {
    console.error('[CacheManager] Failed to complete purge:', e);
    if (options.reload) {
      window.location.reload();
    }
  }
}
