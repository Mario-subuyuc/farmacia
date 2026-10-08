// En esta API, la vista prepara los datos que se enviarán como JSON.
export function publicUser(user) {
  let username = null;

  if (user.user_metadata && user.user_metadata.username != null) {
    username = user.user_metadata.username;
  }

  return {
    id: user.id,
    username: username,
    email: user.email,
  };
}

export function publicSession(session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
  };
}

