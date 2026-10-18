// Único lugar donde hacemos fetch. La fábrica permite probarlo sin internet.
export function createApi({ baseUrl, getSession, setSession, fetcher = fetch }) {
  let refreshing = null;

  async function send(path, options = {}, token) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetcher(`${baseUrl}${path}`, { ...options, headers }); }
    catch {
      const error = new Error('No se pudo conectar con el servidor. Comprueba que el backend esté disponible.');
      error.network = true;
      throw error;
    }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('El servidor no devolvió JSON. Revisa la dirección de la API.'); }
    if (!response.ok) {
      const error = new Error(result.message || 'No se pudo completar la solicitud.');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function renewSession() {
    // Varias consultas pueden necesitar renovar a la vez; reutilizamos una sola petición.
    if (!refreshing) {
      const oldSession = getSession();
      refreshing = (async function () {
        if (!oldSession?.session?.refresh_token) throw new Error('Inicia sesión nuevamente.');
        try {
          const result = await send('/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: oldSession.session.refresh_token }) });
          // Un logout durante esta petición no debe volver a abrir la sesión.
          if (getSession() !== oldSession) throw new Error('La sesión cambió. Inicia sesión nuevamente.');
          setSession({ user: result.user, session: result.session });
          return result.session.access_token;
        } catch (error) {
          if (error.status === 401) setSession(null);
          throw error;
        }
      })().finally(function () { refreshing = null; });
    }
    return refreshing;
  }

  async function request(path, options = {}, authenticated = true) {
    let saved = getSession();
    let token = authenticated ? saved?.session?.access_token : undefined;
    if (authenticated && saved?.session?.expires_at && saved.session.expires_at * 1000 < Date.now() + 30000) {
      token = await renewSession();
      saved = getSession();
    }
    try { return await send(path, options, token); }
    catch (error) {
      if (authenticated && error.status === 401 && saved?.session?.refresh_token) {
        // Si otra consulta ya renovó, usamos su token en lugar de renovar otra vez.
        const newest = getSession()?.session?.access_token;
        token = newest && newest !== token ? newest : await renewSession();
        try { return await send(path, options, token); }
        catch (retryError) { if (retryError.status === 401) setSession(null); throw retryError; }
      }
      if (authenticated && error.status === 401) setSession(null);
      throw error;
    }
  }

  async function get(path, params = {}, authenticated = true) {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      if (value !== '' && value !== undefined && value !== null) query.set(name, value);
    }
    return request(path + (query.size ? `?${query}` : ''), {}, authenticated);
  }

  async function getAll(path, params = {}) {
    const rows = [];
    let page = 1;
    let result;
    do {
      result = await get(path, { ...params, page, limit: 100 });
      rows.push(...result.data);
      page++;
    } while (result.data.length === 100 && rows.length < result.pagination.total);
    return rows;
  }

  return {
    get, getAll,
    uploadEventImage:(id,file)=>request('/eventos/'+id+'/imagen',{method:'POST',body:file,headers:{'Content-Type':file.type}}),
    uploadPrescription: (token,file) => request('/tienda/recetas',{method:'POST',body:file,headers:{'Content-Type':file.type,'X-Upload-Token':token}},false),
    uploadImage: (id, file) => request('/medicamentos/' + id + '/imagen', { method: 'POST', body: file, headers: { 'Content-Type': file.type } }),
    publicGet: (path, params) => get(path, params, false),
    publicPost: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }, false),
    write: (method, path, body, key) => request(path, {
      method, body: JSON.stringify(body), headers: key ? { 'Idempotency-Key': key } : {},
    }),
  };
}
