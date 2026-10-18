// sessionStorage conserva la sesión solo en esta pestaña. No guardamos contraseñas.
const storageKey = 'nexo-farma-session';
let current = null;
const listeners = new Set();
try { current = JSON.parse(window.sessionStorage.getItem(storageKey)); } catch { current = null; }
if (!current?.session?.access_token || !current?.user?.id) current = null;

export function readSession() { return current; }

export function saveSession(value) {
  current = value;
  try {
    if (value) window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    else window.sessionStorage.removeItem(storageKey);
  } catch { /* Si el navegador bloquea storage, la sesión funciona en memoria. */ }
  for (const listener of listeners) listener(value);
}

export function subscribeSession(listener) {
  listeners.add(listener);
  return function () { listeners.delete(listener); };
}
