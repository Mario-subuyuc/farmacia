// Evita que una celda de texto se interprete como fórmula al abrirla en Excel.
export function csvText(rows, columns) {
  function cell(value) {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  return [columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n');
}
export function downloadCsv(name, rows, columns) {
  const blob = new Blob(['\uFEFF', csvText(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
