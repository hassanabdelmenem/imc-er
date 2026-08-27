/**
 * Mock Firebase ESM Interceptor for Playwright E2E Tests
 * Intercepts https://www.gstatic.com/firebasejs/10.8.1/*.js
 * Provides authentic in-memory reactive Auth, Firestore, and Remote Config state.
 */

export async function installFirebaseMocks(pageOrContext, options = {}) {
  const {
    user = null,
    initialPatients = [],
    initialUsers = [],
    initialRemoteConfig = { enable_batch_purge: true, enable_edge_ai_synthesis: true },
    initialDeadLetterQueue = [],
    simulateUnreachable = false,
    simulateUnfiled = false,
    simulateEnsureFailure = false,
    authDelayMs = 15
  } = options;

  // 1. Inject in-memory DB and Auth state into window
  await pageOrContext.addInitScript(({
    user,
    initialPatients,
    initialUsers,
    initialRemoteConfig,
    initialDeadLetterQueue,
    simulateUnreachable,
    simulateUnfiled,
    simulateEnsureFailure,
    authDelayMs
  }) => {
    window.__mockUser = user ? JSON.parse(JSON.stringify(user)) : null;
    window.__mockDbStore = {
      patients: {},
      users: {},
      settings: {
        remote_config: JSON.parse(JSON.stringify(initialRemoteConfig))
      },
      dead_letter_queue: {},
      telemetry_alerts: {}
    };

    initialPatients.forEach(p => {
      window.__mockDbStore.patients[p.id] = JSON.parse(JSON.stringify(p));
    });

    initialUsers.forEach(u => {
      const id = u.id || u.uid;
      window.__mockDbStore.users[id] = JSON.parse(JSON.stringify(u));
    });

    initialDeadLetterQueue.forEach((d, idx) => {
      const id = d.id || (`dlq_${idx}`);
      window.__mockDbStore.dead_letter_queue[id] = JSON.parse(JSON.stringify(d));
    });

    window.__simulateUnreachable = simulateUnreachable;
    window.__simulateUnfiled = simulateUnfiled;
    window.__simulateEnsureFailure = simulateEnsureFailure;
    window.__authDelayMs = authDelayMs;

    window.__snapshotListeners = {};
    window.__authListeners = [];

    window.__notifySnapshot = (col, docId) => {
      Object.entries(window.__snapshotListeners).forEach(([subId, listener]) => {
        if (!listener) return;
        if (listener.isDoc) {
          if (listener.col === col && (!docId || listener.docId === docId)) {
            listener.cb();
          }
        } else {
          if (listener.col === col) {
            listener.cb();
          }
        }
      });
    };

    window.__notifyAllSnapshots = () => {
      Object.values(window.__snapshotListeners).forEach(listener => {
        if (listener && typeof listener.cb === "function") {
          listener.cb();
        }
      });
    };

    window.__notifyAuth = (user) => {
      if (user) {
        window.__mockUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email,
          getIdToken: () => Promise.resolve("mock-token"),
          getIdTokenResult: () => Promise.resolve({ claims: {} })
        };
      } else {
        window.__mockUser = null;
      }
      window.__authListeners.forEach(cb => {
        try {
          cb(window.__mockUser);
        } catch (e) {
          console.error("Auth listener error:", e);
        }
      });
    };

    window.__updateRemoteConfig = (patch) => {
      window.__mockDbStore.settings.remote_config = {
        ...window.__mockDbStore.settings.remote_config,
        ...patch
      };
      window.__notifySnapshot("settings", "remote_config");
    };

    window.__getDbStore = () => window.__mockDbStore;
  }, {
    user,
    initialPatients,
    initialUsers,
    initialRemoteConfig,
    initialDeadLetterQueue,
    simulateUnreachable,
    simulateUnfiled,
    simulateEnsureFailure,
    authDelayMs
  });

  // 2. Intercept firebase-app.js
  await pageOrContext.route("https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js", route => {
    route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "export function initializeApp(config) { return { name: \"[DEFAULT]\", options: config || {} }; }"
    });
  });

  // 3. Intercept firebase-auth.js
  await pageOrContext.route("https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js", route => {
    route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: `
        export function getAuth(app) {
          return {
            app,
            get currentUser() {
              return window.__mockUser;
            }
          };
        }

        export function onAuthStateChanged(auth, callback) {
          window.__authListeners.push(callback);
          const delay = typeof window.__authDelayMs === "number" ? window.__authDelayMs : 10;
          setTimeout(() => {
            callback(window.__mockUser);
          }, delay);
          return () => {
            window.__authListeners = window.__authListeners.filter(cb => cb !== callback);
          };
        }

        export function signInWithEmailAndPassword(auth, email, password) {
          const user = {
            uid: "uid_" + email.replace(/[^a-zA-Z0-9]/g, "_"),
            email: email,
            emailVerified: true
          };
          window.__notifyAuth(user);
          return Promise.resolve({ user });
        }

        export function createUserWithEmailAndPassword(auth, email, password) {
          const user = {
            uid: "uid_" + email.replace(/[^a-zA-Z0-9]/g, "_"),
            email: email,
            emailVerified: true
          };
          window.__notifyAuth(user);
          return Promise.resolve({ user });
        }

        export function signOut(auth) {
          window.__notifyAuth(null);
          return Promise.resolve();
        }

        export class GoogleAuthProvider {
          constructor() {
            this.providerId = "google.com";
          }
        }

        export function signInWithPopup(auth, provider) {
          const user = {
            uid: "uid_google_staff",
            email: "staff@imc.com",
            displayName: "Clinical Staff Member"
          };
          window.__notifyAuth(user);
          return Promise.resolve({ user });
        }

        export function signInWithRedirect(auth, provider) {
          return Promise.resolve();
        }

        export function getRedirectResult(auth) {
          return Promise.resolve({ user: null });
        }
      `
    });
  });

  // 4. Intercept firebase-firestore.js
  await pageOrContext.route("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js", route => {
    route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: `
        export function getFirestore(app) {
          return { app, type: "firestore" };
        }

        export function collection(first, ...rest) {
          let path = "";
          if (typeof first === "string") {
            path = [first, ...rest].join("/");
          } else if (first && first.path) {
            path = [first.path, ...rest].join("/");
          } else {
            path = rest.join("/");
          }
          return { type: "col", path };
        }

        export function doc(first, ...rest) {
          let path = "";
          if (typeof first === "string") {
            path = [first, ...rest].join("/");
          } else if (first && first.path) {
            if (rest.length === 0) {
              const autoId = "doc_" + Math.random().toString(36).substr(2, 9);
              path = first.path + "/" + autoId;
            } else {
              path = first.path + "/" + rest.join("/");
            }
          } else {
            path = rest.join("/");
          }
          const parts = path.split("/").filter(Boolean);
          const id = parts[parts.length - 1] || "";
          return { type: "doc", path, id };
        }

        export function query(colRef, ...constraints) {
          return { type: "query", path: colRef.path, colRef, constraints };
        }

        export function orderBy(field, direction = "asc") {
          return { type: "orderBy", field, direction };
        }

        export function limit(n) {
          return { type: "limit", n };
        }

        export async function getDoc(docRef) {
          const parts = docRef.path.split("/").filter(Boolean);
          const col = parts[0];
          const docId = parts[1];

          if (window.__simulateUnreachable && col === "users") {
            return Promise.reject(new Error("Network lookup failed: server unreachable"));
          }

          if (window.__simulateUnfiled && col === "users") {
            return Promise.resolve({
              id: docId,
              ref: docRef,
              exists: () => false,
              data: () => undefined
            });
          }

          const record = window.__mockDbStore[col]?.[docId];
          const exists = !!record;
          return Promise.resolve({
            id: docId,
            ref: docRef,
            exists: () => exists,
            data: () => (exists ? JSON.parse(JSON.stringify(record)) : undefined)
          });
        }

        export async function setDoc(docRef, data, opts = {}) {
          const parts = docRef.path.split("/").filter(Boolean);
          const col = parts[0];
          const docId = parts[1];

          if (window.__simulateEnsureFailure && col === "users") {
            return Promise.reject(new Error("Write permission denied: simulated ensure failure"));
          }

          window.__mockDbStore[col] = window.__mockDbStore[col] || {};
          const current = window.__mockDbStore[col][docId] || {};
          window.__mockDbStore[col][docId] = opts.merge
            ? { ...current, ...JSON.parse(JSON.stringify(data)) }
            : JSON.parse(JSON.stringify(data));

          window.__notifySnapshot(col, docId);
          return Promise.resolve();
        }

        export async function updateDoc(docRef, data) {
          const parts = docRef.path.split("/").filter(Boolean);
          const col = parts[0];
          const docId = parts[1];

          window.__mockDbStore[col] = window.__mockDbStore[col] || {};
          const current = window.__mockDbStore[col][docId] || {};
          window.__mockDbStore[col][docId] = {
            ...current,
            ...JSON.parse(JSON.stringify(data))
          };

          window.__notifySnapshot(col, docId);
          return Promise.resolve();
        }

        export async function deleteDoc(docRef) {
          const parts = docRef.path.split("/").filter(Boolean);
          const col = parts[0];
          const docId = parts[1];

          if (window.__mockDbStore[col]) {
            delete window.__mockDbStore[col][docId];
          }

          window.__notifySnapshot(col, docId);
          return Promise.resolve();
        }

        export async function addDoc(colRef, data) {
          const col = colRef.path;
          const docId = "doc_" + Math.random().toString(36).substr(2, 9);
          window.__mockDbStore[col] = window.__mockDbStore[col] || {};
          window.__mockDbStore[col][docId] = JSON.parse(JSON.stringify(data));

          window.__notifySnapshot(col, docId);
          return Promise.resolve({
            id: docId,
            path: col + "/" + docId,
            type: "doc"
          });
        }

        export function writeBatch(db) {
          const operations = [];
          return {
            set: (docRef, data, opts = {}) => {
              operations.push(() => setDoc(docRef, data, opts));
            },
            update: (docRef, data) => {
              operations.push(() => updateDoc(docRef, data));
            },
            delete: (docRef) => {
              operations.push(() => deleteDoc(docRef));
            },
            commit: async () => {
              for (const op of operations) {
                await op();
              }
              window.__notifyAllSnapshots();
              return Promise.resolve();
            }
          };
        }

        export function onSnapshot(target, onNext, onError) {
          const subId = "sub_" + Math.random().toString(36).substr(2, 9);
          const isDoc = target.type === "doc";
          const parts = target.path.split("/").filter(Boolean);
          const col = parts[0];
          const docId = isDoc ? parts[1] : null;

          const notify = () => {
            try {
              if (isDoc) {
                const record = window.__mockDbStore[col]?.[docId];
                const exists = !!record;
                onNext({
                  id: docId,
                  ref: target,
                  exists: () => exists,
                  data: () => (exists ? JSON.parse(JSON.stringify(record)) : undefined)
                });
              } else {
                const colData = window.__mockDbStore[col] || {};
                const docs = Object.entries(colData).map(([id, data]) => ({
                  id,
                  ref: { type: "doc", path: col + "/" + id, id },
                  exists: () => true,
                  data: () => JSON.parse(JSON.stringify(data))
                }));
                onNext({
                  docs,
                  size: docs.length,
                  empty: docs.length === 0,
                  forEach: (fn) => docs.forEach(fn)
                });
              }
            } catch (err) {
              if (typeof onError === "function") onError(err);
            }
          };

          window.__snapshotListeners[subId] = { col, docId, isDoc, cb: notify };
          setTimeout(notify, 0);

          return () => {
            delete window.__snapshotListeners[subId];
          };
        }
      `
    });
  });
}
