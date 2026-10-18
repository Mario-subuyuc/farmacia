import { useEffect, useState } from 'react';

// Un hook es una función que reutiliza estado y efectos de React.
export function useRecords(client, path, params = {}, all = false) {
  const [state, setState] = useState({ rows: [], total: 0, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const query = JSON.stringify(params);
  useEffect(function () {
    let ignore = false;
    setState({ rows: [], total: 0, loading: true, error: '' });
    (all ? client.getAll(path,JSON.parse(query)).then(data=>({data})) : client.get(path, JSON.parse(query))).then(function (result) {
      if (!ignore) setState({ rows: result.data, total: result.pagination?.total || result.data.length, loading: false, error: '' });
    }).catch(function (error) {
      if (!ignore) setState({ rows: [], total: 0, loading: false, error: error.message });
    });
    // Una respuesta anterior no debe reemplazar la pantalla después de navegar.
    return function () { ignore = true; };
  }, [client, path, query, version, all]);
  return { ...state, reload: () => setVersion(value => value + 1) };
}
