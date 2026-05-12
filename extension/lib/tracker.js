// lib/tracker.js — Prompt ↔ Result Card ↔ File mapping & counts.
export const Tracker = {
  buildEntries(prompts, payload) {
    return prompts.map((prompt, i) => ({
      idx: i + 1,
      prompt,
      status: "pending",                     // pending|submitted|generating|completed|downloaded|failed|missing|skipped
      startImage: payload?.startImages?.[i] || null,
      endImage:   payload?.endImages?.[i]   || null,
      cardId: null,
      mediaUrl: null,
      fingerprint: null,
      filename: null,
      downloaded: false,
      error: null,
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
  },
  update(tracker, idx, patch) {
    if (!Array.isArray(tracker)) return null;
    let entry = tracker.find(t => t.idx === idx);
    if (!entry) { entry = { idx }; tracker.push(entry); }
    Object.assign(entry, patch, { updatedAt: Date.now() });
    return entry;
  },
  counts(tracker) {
    const c = { total: tracker.length, pending:0, submitted:0, generating:0, completed:0, downloaded:0, failed:0, missing:0, skipped:0 };
    for (const t of tracker) if (c[t.status] !== undefined) c[t.status]++;
    return c;
  }
};
