// lib/project.js — Project CRUD & export/import. Stored under storage.local.projects (map by id)
import { Storage } from "./storage.js";

function uuid() {
  return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const Project = {
  async list() {
    const { projects = {} } = await Storage.get(["projects"]);
    return Object.values(projects).sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
  },
  async getActive() {
    const { projects = {}, activeProjectId } = await Storage.get(["projects","activeProjectId"]);
    return activeProjectId ? projects[activeProjectId] || null : null;
  },
  async setActive(id) {
    await Storage.set({ activeProjectId: id });
  },
  async load(id) {
    const { projects = {} } = await Storage.get(["projects"]);
    await this.setActive(id);
    return projects[id] || null;
  },
  async create(partial) {
    const { projects = {} } = await Storage.get(["projects"]);
    const id = uuid();
    const p = {
      id,
      name: partial.name || "Untitled",
      platform: partial.platform || "grok",
      generationType: partial.generationType || "text_to_video",
      method: partial.method || "auto",
      batchSize: partial.batchSize || 5,
      prompts: partial.prompts || [],
      tracker: partial.tracker || [],
      startImages: partial.startImages || [],
      endImages: partial.endImages || [],
      downloads: partial.downloads || [],
      edits: partial.edits || [],
      logs: partial.logs || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    projects[id] = p;
    await Storage.set({ projects, activeProjectId: id });
    return p;
  },
  async save(project) {
    const { projects = {} } = await Storage.get(["projects"]);
    project.updatedAt = Date.now();
    projects[project.id] = project;
    await Storage.set({ projects });
    return project;
  },
  async upsertActive(partial) {
    const { projects = {}, activeProjectId } = await Storage.get(["projects","activeProjectId"]);
    if (partial && partial.id && projects[partial.id]) {
      const next = { ...projects[partial.id], ...partial, updatedAt: Date.now() };
      projects[partial.id] = next;
      await Storage.set({ projects, activeProjectId: partial.id });
      return next;
    }
    if (activeProjectId && projects[activeProjectId] && !partial.forceNew) {
      const next = { ...projects[activeProjectId], ...partial, updatedAt: Date.now() };
      projects[activeProjectId] = next;
      await Storage.set({ projects });
      return next;
    }
    return await this.create(partial || {});
  },
  async remove(id) {
    const { projects = {}, activeProjectId } = await Storage.get(["projects","activeProjectId"]);
    delete projects[id];
    const next = { projects };
    if (activeProjectId === id) next.activeProjectId = null;
    await Storage.set(next);
    return true;
  },
  async exportAll() {
    const { projects = {} } = await Storage.get(["projects"]);
    return JSON.stringify({ exportedAt: Date.now(), projects }, null, 2);
  },
  async importAll(json) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    const { projects = {} } = await Storage.get(["projects"]);
    let count = 0;
    for (const id of Object.keys(data.projects || {})) {
      projects[id] = data.projects[id];
      count++;
    }
    await Storage.set({ projects });
    return count;
  },
  async exportDownloadLog() {
    const p = await this.getActive();
    if (!p) return "";
    const rows = ["idx,prompt,status,filename,fingerprint,mediaUrl"];
    for (const t of (p.tracker||[])) {
      const csv = [
        t.idx, JSON.stringify(t.prompt||""), t.status||"", t.filename||"",
        t.fingerprint||"", t.mediaUrl||""
      ].join(",");
      rows.push(csv);
    }
    return rows.join("\n");
  }
};
