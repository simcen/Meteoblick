import { requireNativeModule } from 'expo';

const SharedStorageModule = requireNativeModule('SharedStorage');

export const SharedStorage = {
  async getItem(key: string): Promise<string | null> {
    return await SharedStorageModule.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await SharedStorageModule.setItem(key, value);
  },
};
