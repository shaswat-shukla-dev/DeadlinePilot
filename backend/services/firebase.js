const { Firestore } = require('@google-cloud/firestore');

let db;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

if (!projectId) {
  console.warn('No GOOGLE_CLOUD_PROJECT set — using in-memory store (local dev mode). Data will not persist across restarts.');
  db = createInMemoryDb();
} else {
  try {
    db = new Firestore({
      projectId,
      databaseId: process.env.FIRESTORE_DATABASE || '(default)',
    });
  } catch (err) {
    console.warn('Firestore init failed, falling back to in-memory store:', err.message);
    db = createInMemoryDb();
  }
}

function createInMemoryDb() {
  const store = {};
  const makeRef = (path) => {
    const parts = path.split('/');
    return {
      id: parts[parts.length - 1],
      get: async () => {
        const data = getNestedPath(store, parts);
        return { exists: !!data, data: () => data, id: parts[parts.length - 1] };
      },
      set: async (data, opts) => {
        setNestedPath(store, parts, opts?.merge ? { ...getNestedPath(store, parts), ...data } : data);
      },
      update: async (data) => {
        const existing = getNestedPath(store, parts) || {};
        setNestedPath(store, parts, { ...existing, ...data });
      },
      delete: async () => { deleteNestedPath(store, parts); },
      collection: (name) => makeCollection([...parts, name]),
    };
  };
  const makeCollection = (parts) => {
    const getAllDocs = () => {
      const colData = getNestedPath(store, parts) || {};
      return Object.entries(colData).map(([id, data]) => ({ id, data: () => data, exists: true }));
    };
    return {
      doc: (id) => makeRef([...parts, id || generateId()].join('/')),
      add: async (data) => {
        const id = generateId();
        const ref = makeRef([...parts, id].join('/'));
        await ref.set({ ...data, id });
        return ref;
      },
      where: (field, op, value) => makeQuery(parts, [{ field, op, value }]),
      get: async () => {
        const docs = getAllDocs();
        return { docs, empty: docs.length === 0 };
      },
      orderBy: () => makeQuery(parts, []),
    };
  };
  const makeQuery = (parts, filters) => {
    const applyFilters = (docs) => docs.filter(d => {
      const data = d.data();
      return filters.every(f => {
        const val = data[f.field];
        if (f.op === '==') return val === f.value;
        if (f.op === '!=') return val !== f.value;
        if (f.op === '>') return val > f.value;
        if (f.op === '<') return val < f.value;
        if (f.op === '>=') return val >= f.value;
        if (f.op === '<=') return val <= f.value;
        return true;
      });
    });
    return {
      where: (field, op, value) => makeQuery(parts, [...filters, { field, op, value }]),
      orderBy: () => makeQuery(parts, filters),
      limit: () => makeQuery(parts, filters),
      get: async () => {
        const colData = getNestedPath(store, parts) || {};
        const allDocs = Object.entries(colData).map(([id, data]) => ({ id, data: () => data, exists: true }));
        const docs = applyFilters(allDocs);
        return { docs, empty: docs.length === 0 };
      },
    };
  };
  return { collection: (name) => makeCollection([name]) };
}

function getNestedPath(obj, parts) {
  return parts.reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}
function setNestedPath(obj, parts, value) {
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!o[parts[i]]) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = value;
}
function deleteNestedPath(obj, parts) {
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!o[parts[i]]) return;
    o = o[parts[i]];
  }
  delete o[parts[parts.length - 1]];
}
function generateId() {
  return Math.random().toString(36).substr(2, 20);
}

module.exports = { db };
