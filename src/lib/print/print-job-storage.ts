const DEFAULT_TTL_MS = 30 * 60 * 1000;

type StoredPrintJob<T> = {
  savedAt: number;
  payload: T;
};

/**
 * Save print job to both localStorage and sessionStorage for cross-window sharing.
 * sessionStorage does NOT share across windows/tabs, so we use localStorage as primary.
 */
export function savePrintJob(key: string, data: unknown): void {
  const stored: StoredPrintJob<unknown> = {
    savedAt: Date.now(),
    payload: data,
  };
  const raw = JSON.stringify(stored);
  
  try {
    localStorage.setItem(key, raw);
  } catch {
    // quota / private mode
  }
  
  try {
    sessionStorage.setItem(key, raw);
  } catch {
    // ignore
  }
}

/**
 * Load and validate print job from storage.
 * Tries localStorage first, then sessionStorage.
 * Supports legacy raw payload (without wrapper) if isValid passes.
 * Expires by TTL (default 30 minutes).
 */
export function loadPrintJob<T>(
  key: string,
  isValid: (v: unknown) => v is T,
  ttlMs: number = DEFAULT_TTL_MS
): T | null {
  const read = (storage: Storage): T | null => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      
      const parsed = JSON.parse(raw);
      
      // New format: wrapped with savedAt
      if (
        parsed &&
        typeof parsed === "object" &&
        "payload" in parsed &&
        "savedAt" in parsed
      ) {
        const stored = parsed as StoredPrintJob<unknown>;
        
        // Check expiry
        if (Date.now() - stored.savedAt > ttlMs) {
          storage.removeItem(key);
          return null;
        }
        
        // Validate payload
        return isValid(stored.payload) ? stored.payload : null;
      }
      
      // Legacy format: raw payload without wrapper
      return isValid(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  
  return read(localStorage) ?? read(sessionStorage);
}
