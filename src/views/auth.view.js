export const publicUser = (user) => ({
  id: user.id,
  username: user.user_metadata?.username ?? null,
  email: user.email,
});

export const publicSession = (session) => ({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_in: session.expires_in,
  expires_at: session.expires_at,
  token_type: session.token_type,
});

