import { useEffect, useState } from 'react';
import { renderEmail } from '../../../src/services/email-template.js';
import { emailPreview } from '../../../src/services/email-preview.js';
import { Notice } from '../components/Feedback.jsx';
const fields = [
  ['marca', 'Nombre de la farmacia', 'text'],
  ['lema', 'Lema', 'text'],
  ['color_principal', 'Color principal', 'color'],
  ['color_fondo', 'Fondo', 'color'],
  ['color_alerta', 'Color de alerta crítica', 'color'],
  ['introduccion', 'Texto de introducción', 'textarea'],
  ['pie', 'Pie de página', 'textarea'],
  ['fuente', 'Tipografía', 'select'],
];
export default function EmailDesignPage({ client }) {
  const [rows, setRows] = useState([]),
    [id, setId] = useState(''),
    [form, setForm] = useState(null),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    client
      .getAll('/plantillas-correo')
      .then((data) => {
        if (!data.length) throw new Error('No hay plantillas de correo configuradas.');
        setRows(data);
        setId(String(data[0].id_plantilla));
        setForm(data[0]);
      })
      .catch((failure) => setError(failure.message));
  }, [client]);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = Object.fromEntries(fields.map(([name]) => [name, form[name] || null]));
      const result = await client.write('PATCH', '/plantillas-correo/' + id, body);
      setRows((old) => old.map((row) => (String(row.id_plantilla) === id ? result.data : row)));
      setMessage('Diseño guardado. Se utilizará en los próximos correos.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const preview = form ? renderEmail(emailPreview(form)) : '';
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Diseño de correos</h1>
          <p>Personaliza alertas, pedidos, inscripciones y recordatorios sin editar código.</p>
        </div>
      </div>
      <Notice success>{message}</Notice>
      <Notice>{error}</Notice>
      {form && (
        <div className="email-design-layout">
          <form className="panel page-stack" onSubmit={save}>
            <label>
              Tipo de correo
              <select
                value={id}
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value;
                  setId(value);
                  setForm(rows.find((row) => String(row.id_plantilla) === value));
                  setMessage('');
                  setError('');
                }}
              >
                {rows.map((row) => (
                  <option value={row.id_plantilla} key={row.id_plantilla}>
                    {row.tipo}
                  </option>
                ))}
              </select>
            </label>
            {fields.map(([name, label, type]) => (
              <label key={name}>
                {label}
                {type === 'textarea' ? (
                  <textarea
                    value={form[name] || ''}
                    maxLength={500}
                    required={name !== 'introduccion'}
                    onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))}
                  />
                ) : type === 'select' ? (
                  <select
                    value={form[name]}
                    onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))}
                  >
                    <option>Arial</option>
                    <option>Georgia</option>
                  </select>
                ) : (
                  <input
                    type={type}
                    required
                    maxLength={name === 'marca' ? 80 : 150}
                    value={form[name] || ''}
                    onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))}
                  />
                )}
              </label>
            ))}
            <button className="button primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar diseño'}
            </button>
          </form>
          <section className="panel email-preview-panel">
            <h2>Vista previa</h2>
            <p>Ejemplo de la categoría {form.tipo}. La vista previa no envía mensajes.</p>
            <iframe title="Vista previa del correo" sandbox="" srcDoc={preview} />
          </section>
        </div>
      )}
    </div>
  );
}
