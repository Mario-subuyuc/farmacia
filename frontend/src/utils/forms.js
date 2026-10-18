// Los inputs HTML devuelven texto. Convertimos números y booleanos antes de enviarlos.
export function initialValues(fields, record = {}) {
  const result = {};
  for (const field of fields) {
    result[field.name] = record[field.name] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : '');
    if(field.type==='datetime-local'&&result[field.name])result[field.name]=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guatemala',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(result[field.name])).replace(' ','T');
    if (field.type === 'date' && result[field.name]) result[field.name] = String(result[field.name]).slice(0, 10);
  }
  return result;
}

export function formPayload(fields, values, editing = false) {
  const result = {};
  for (const field of fields) {
    if (editing && field.createOnly) continue;
    const value = values[field.name];
    if (value === '' || value === undefined || value === null) {
      if (editing && field.nullable) result[field.name] = null;
      continue;
    }
    if (field.type === 'checkbox') result[field.name] = Boolean(value);
    else if (field.type === 'number' || field.numeric) result[field.name] = Number(value);
    else if(field.type==='datetime-local')result[field.name]=new Date(value+'-06:00').toISOString();
    else if (field.type === 'month') result[field.name] = `${value}-01`;
    else result[field.name] = String(value).trim();
  }
  return result;
}

export function parseItems(rows) {
  if (!rows.length) throw new Error('Agrega al menos un medicamento.');
  const seen = new Set();
  return rows.map(function (row) {
    const id = Number(row.id_medicamento);
    const quantity = Number(row.cantidad);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Selecciona cada medicamento e indica una cantidad entera positiva.');
    if (seen.has(id)) throw new Error('No repitas medicamentos; cambia la cantidad de la misma línea.');
    seen.add(id);
    return { id_medicamento: id, cantidad: quantity };
  });
}

// Ante un error de red, la misma operación conserva clave. Cambiar el cuerpo crea otra.
export function operationKey(previous, path, body, newUuid = () => crypto.randomUUID()) {
  const fingerprint = JSON.stringify({ path, body });
  if (previous?.fingerprint === fingerprint) return previous;
  return { fingerprint, key: newUuid() };
}
