# Eventos y participantes iniciales

Carga de referencia para enero a noviembre de 2026, un evento por mes y una sola sucursal por evento. Todos se publican de 10:00 a 12:00, hora de Guatemala, con cupo de 30 personas.

Los eventos parten del dia 20 y se desplazan al siguiente dia de atencion cuando corresponde: Peten al lunes siguiente y Jutiapa al sabado siguiente. Los dias disponibles se validan contra la configuracion de sucursales.

| Mes | Sucursal | Fecha | Confirmados |
|---|---|---|---:|
| 01/2026 | GUA01 | 2026-01-20 | 14 |
| 02/2026 | MIX01 | 2026-02-20 | 15 |
| 03/2026 | XELA01 | 2026-03-20 | 12 |
| 04/2026 | PET01 | 2026-04-20 | 15 |
| 05/2026 | JUT01 | 2026-05-23 | 12 |
| 06/2026 | GUA01 | 2026-06-20 | 10 |
| 07/2026 | MIX01 | 2026-07-20 | 11 |
| 08/2026 | XELA01 | 2026-08-20 | 15 |
| 09/2026 | PET01 | 2026-09-21 | 13 |
| 10/2026 | JUT01 | 2026-10-24 | 13 |
| 11/2026 | GUA01 | 2026-11-20 | 10 |

Total: 11 eventos y 140 inscripciones confirmadas. Las cantidades se sortearon entre 10 y 15 y se fijaron en el archivo para que repetir la carga no cambie los resultados ni duplique inscripciones.

La nomenclatura de evento aparece en el titulo, por ejemplo GUA01-EVENTO-2026-01. Cada participante tiene un identificador como GUA01-ASISTENTE-2026-01-01, un nombre ficticio y correo example.com. Los telefonos quedan vacios. Las fechas historicas de registro son simuladas; estar confirmado no significa que se verifico asistencia presencial. El evento de noviembre es futuro respecto al 13 de noviembre de 2026.

La carga manual database/data/008_eventos_asistentes.sql inserta directamente los registros; no llama a inscribir_evento ni inserta correos en la cola. Los tokens se generaron como hashes aleatorios sin conservar enlaces de confirmacion. El sistema mantiene su politica normal de recordatorios futuros: si el worker esta activo, puede encolar recordatorios cuando se acerque el evento de noviembre; los destinatarios de esta carga son exclusivamente direcciones de prueba example.com.
