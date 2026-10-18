// Supabase vuelve con datos en #...; el menú también usa #inventario.
// Reconocemos solo el resultado de Auth y quitamos los tokens de la dirección.
// Pedimos login normal: no confiamos en un usuario decodificado del enlace.
export function consumeConfirmation(location, history) {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has('access_token') && !params.has('error')) return '';
  history.replaceState(null, '', `${location.pathname}${location.search}#inicio`);
  if (params.has('error')) return 'El enlace de confirmación venció o no es válido. Solicita un nuevo correo desde Supabase o contacta al administrador.';
  return 'Correo confirmado. Inicia sesión con tu correo y contraseña. El administrador debe asignarte un perfil activo para acceder.';
}
