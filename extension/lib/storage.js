// lib/storage.js — thin wrapper around chrome.storage.local with merge helpers.
export const Storage = {
  async get(keys) {
    return new Promise((res) => chrome.storage.local.get(keys, (v) => res(v || {})));
  },
  async set(obj) {
    return new Promise((res) => chrome.storage.local.set(obj, () => res(true)));
  },
  async merge(key, partial) {
    const cur = (await this.get([key]))[key] || {};
    const merged = { ...cur, ...partial };
    await this.set({ [key]: merged });
    return merged;
  },
  async initDefaults(defs) {
    const cur = await this.get(Object.keys(defs));
    const next = {};
    for (const k of Object.keys(defs)) {
      if (cur[k] === undefined) next[k] = defs[k];
    }
    if (Object.keys(next).length) await this.set(next);
  }
};
