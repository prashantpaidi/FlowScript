/**
 * StorageService standardizes how we interact with wxt/storage.
 * Includes error handling and logging for "Set" operations.
 *
 * Note: We use global 'storage' which is auto-imported by WXT or
 * available in the background context.
 */
class StorageService {
  async getItem<T>(key: string): Promise<T | null> {
    try {
      // @ts-ignore
      return await storage.getItem<T>(key);
    } catch (error) {
      console.error(`[StorageService] Failed to get item "${key}":`, error);
      return null;
    }
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      console.log(`[StorageService] Setting item "${key}":`, value);
      // @ts-ignore
      await storage.setItem(key, value);
    } catch (error) {
      console.error(`[StorageService] Failed to set item "${key}":`, error, value);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      // @ts-ignore
      await storage.removeItem(key);
    } catch (error) {
      console.error(`[StorageService] Failed to remove item "${key}":`, error);
      throw error;
    }
  }

  watch<T>(key: string, callback: (newValue: T | null, oldValue: T | null) => void): () => void {
    try {
      // @ts-ignore
      return storage.watch<T>(key, callback);
    } catch (error) {
      console.error(`[StorageService] Failed to watch key "${key}":`, error);
      return () => {};
    }
  }
}

export const storageService = new StorageService();
