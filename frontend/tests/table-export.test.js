import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tableRows,excelBuffer} from '../src/utils/table-export.js';
import ExcelJS from 'exceljs';
test('tabla filtra tildes y todas las filas; ordena importes decimales y fechas',()=>{
 const rows=[{nombre:'Ácido',monto:'90.11',fecha:'2026-02-01'},{nombre:'Acido',monto:'90.2',fecha:'2026-01-15'},{nombre:'Otro',monto:'5',fecha:'2025-01-01'}];const format=(key,value)=>value;
 assert.equal(tableRows(rows,['nombre','monto'],format,'acido',{monto:'90'}).length,2);
 assert.deepEqual(tableRows(rows,['nombre','monto'],format,'',{}, {key:'monto',direction:'asc'}).map(row=>row.monto),['5','90.11','90.2']);
 assert.equal(tableRows(rows,['fecha'],format,'',{}, {key:'fecha',direction:'asc'})[0].fecha,'2025-01-01');
});
test('xlsx conserva números y texto sin ejecutar fórmulas',async()=>{
 const data=await excelBuffer([{nombre:'=HYPERLINK("https://example.com")',total:'90.20',telefono:'0055551234'}],['nombre','total','telefono'],(key,value)=>value,'Prueba','Filtros activos');const book=new ExcelJS.Workbook();await book.xlsx.load(data);const sheet=book.worksheets[0];assert.equal(sheet.getCell('B4').value,90.2);assert.equal(sheet.getCell('A4').type,ExcelJS.ValueType.String);assert.equal(sheet.getCell('A4').value,'=HYPERLINK("https://example.com")');assert.ok(sheet.autoFilter);assert.equal(sheet.getCell('C4').value,'0055551234');
});

test('búsqueda global incluye coincidencias más allá de la primera página',()=>{const rows=Array.from({length:125},(_,index)=>({nombre:'Producto '+index}));assert.equal(tableRows(rows,['nombre'],(key,value)=>value,'124')[0].nombre,'Producto 124');});
