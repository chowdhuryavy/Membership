import { createClient } from '@supabase/supabase-js';

// Provided credentials linked directly to the code
export const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';

const realSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

if (!realSupabase) {
  console.warn("Supabase initialization failed. App is running in Local Persistence Mode.");
}

// Resilient wrapper to handle Supabase query failures and timeouts by falling back to local storage
const createResilientSupabase = (rawClient: any) => {
  let supabaseFailed = false;
  let supabaseFailures = 0;
  let lastFailureTime = 0;

  const isSupabaseOnline = () => {
    if (supabaseFailed) {
      if (Date.now() - lastFailureTime > 60000) {
        console.log("Resilient Supabase: Cooldown expired. Retrying database connection...");
        supabaseFailed = false;
        supabaseFailures = 0;
      } else {
        return false;
      }
    }
    return true;
  };

  const triggerSupabaseFailure = (err?: any) => {
    supabaseFailures++;
    if (supabaseFailures >= 3) { // Fall back on 3 consecutive failures/timeouts to prevent false positives
      supabaseFailed = true;
      lastFailureTime = Date.now();
      console.warn("Resilient Supabase: Marked offline due to 3 consecutive failures/timeouts:", err);
    }
  };

  const getFallbackData = async (table: string, filters: any[]): Promise<any[]> => {
    let items: any[] = [];

    try {
      if (table === 'members') {
        items = JSON.parse(localStorage.getItem('membership_members') || '[]');
      } else if (table === 'freezes') {
        items = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
      } else if (table === 'membership_categories') {
        items = JSON.parse(localStorage.getItem('membership_categories') || '[]');
      } else if (table === 'outlets') {
        items = JSON.parse(localStorage.getItem('company_outlets_cache') || '[]');
      } else if (table === 'properties') {
        items = JSON.parse(localStorage.getItem('company_properties_cache') || '[]');
      } else {
        // Scan all localStorage keys for any matches containing the table name in their cache keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes(table) || (table === 'massage_bookings' && key.includes('bookings')))) {
            try {
              const val = localStorage.getItem(key);
              if (val) {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  items.push(...parsed);
                } else if (parsed && Array.isArray(parsed.bookings)) {
                  items.push(...parsed.bookings);
                } else if (parsed && typeof parsed === 'object') {
                  if (parsed.id) items.push(parsed);
                }
              }
            } catch (e) {
              // Ignore JSON parse errors for unrelated keys
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Resilient Supabase: Error loading fallback data for table ${table}:`, err);
    }

    // De-duplicate items by id
    const seen = new Set<string>();
    items = items.filter(item => {
      if (!item) return false;
      if (typeof item !== 'object') return false;
      if (!item.id) return true;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Apply recorded filters in-memory
    for (const filter of filters) {
      const { method, args } = filter;
      try {
        if (method === 'eq' && args.length >= 2) {
          const [col, val] = args;
          items = items.filter(item => {
            if (val === null) return item[col] === null || item[col] === undefined;
            return String(item[col]) === String(val);
          });
        } else if (method === 'neq' && args.length >= 2) {
          const [col, val] = args;
          items = items.filter(item => String(item[col]) !== String(val));
        } else if (method === 'in' && args.length >= 2) {
          const [col, vals] = args;
          if (Array.isArray(vals)) {
            const stringVals = vals.map(String);
            items = items.filter(item => stringVals.includes(String(item[col])));
          }
        } else if (method === 'gte' && args.length >= 2) {
          const [col, val] = args;
          items = items.filter(item => item[col] !== undefined && item[col] !== null && item[col] >= val);
        } else if (method === 'lte' && args.length >= 2) {
          const [col, val] = args;
          items = items.filter(item => item[col] !== undefined && item[col] !== null && item[col] <= val);
        } else if (method === 'limit' && args.length >= 1) {
          const [limitVal] = args;
          items = items.slice(0, Number(limitVal));
        }
      } catch (e) {
        console.warn(`Resilient Supabase: Error applying in-memory filter ${method} on table ${table}:`, e);
      }
    }

    return items;
  };

  return new Proxy(rawClient, {
    get(target, prop, receiver) {
      // Allow pages or tools to force/reset offline state if needed
      if (prop === 'isSupabaseOnline') return isSupabaseOnline;
      if (prop === 'triggerSupabaseFailure') return triggerSupabaseFailure;

      if (prop === 'from') {
        return (table: string) => {
          let realBuilder: any = null;
          try {
            realBuilder = rawClient.from(table);
          } catch (e) {
            console.warn(`Resilient Supabase: Failed to create real query builder for table "${table}":`, e);
          }

          const builderState = {
            table,
            isMutation: false,
            filters: [] as any[],
            selectColumns: '*',
          };

          const wrapQueryBuilder = (builder: any): any => {
            return new Proxy(builder || {}, {
              get(bTarget, bProp, bReceiver) {
                if (bProp === 'then') {
                  return async (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
                    try {
                      // 1. If we are explicitly offline and this is a read query, trigger instant fallback
                      if (!isSupabaseOnline() && !builderState.isMutation && bTarget) {
                        throw new Error('Supabase is offline or in cooldown mode');
                      }

                      // 2. Try the real query but race it against a timeout
                      if (bTarget && typeof bTarget.then === 'function') {
                        // Allow 45s timeout for standard queries to account for database cold-starts or latency
                        const timeoutPromise = new Promise<never>((_, reject) =>
                          setTimeout(() => reject(new Error('Query timeout')), 45000)
                        );
                        const result = await Promise.race([bTarget, timeoutPromise]);

                        if (result && result.error) {
                          throw result.error;
                        }

                        // Success: clear failures
                        supabaseFailures = 0;
                        supabaseFailed = false;

                        if (onfulfilled) return onfulfilled(result);
                        return result;
                      } else {
                        throw new Error('No real query builder available');
                      }
                    } catch (err: any) {
                      console.warn(`Resilient Supabase: Query on table "${builderState.table}" failed. Error:`, err);

                      // Only fall back to local storage for read queries
                      if (!builderState.isMutation) {
                        triggerSupabaseFailure(err);
                        try {
                          const fallbackData = await getFallbackData(builderState.table, builderState.filters);
                          const result = { data: fallbackData, error: null };
                          if (onfulfilled) return onfulfilled(result);
                          return result;
                        } catch (fallbackErr) {
                          console.error('Resilient Supabase: Local fallback failed too:', fallbackErr);
                          const result = { data: [], error: fallbackErr };
                          if (onfulfilled) return onfulfilled(result);
                          return result;
                        }
                      } else {
                        // For mutations/writes, propagate the error so calling components can react
                        if (onrejected) return onrejected(err);
                        throw err;
                      }
                    }
                  };
                }

                // Wrap method calls to build state and support chaining
                if (typeof bTarget[bProp] === 'function') {
                  return (...args: any[]) => {
                    const method = String(bProp);
                    if (['insert', 'update', 'delete', 'upsert'].includes(method)) {
                      builderState.isMutation = true;
                    }
                    if (method === 'select' && args[0]) {
                      builderState.selectColumns = args[0];
                    }
                    if (['eq', 'neq', 'in', 'gte', 'lte', 'limit', 'order'].includes(method)) {
                      builderState.filters.push({ method, args });
                    }

                    let nextBuilder: any = null;
                    try {
                      nextBuilder = bTarget[bProp](...args);
                    } catch (e) {
                      console.warn(`Resilient Supabase: Error executing query builder method ${method}:`, e);
                    }
                    return wrapQueryBuilder(nextBuilder);
                  };
                }

                return Reflect.get(bTarget, bProp, bReceiver);
              }
            });
          };

          return wrapQueryBuilder(realBuilder);
        };
      }

      return Reflect.get(target, prop, receiver);
    }
  });
};

export const supabase = createResilientSupabase(realSupabase);
