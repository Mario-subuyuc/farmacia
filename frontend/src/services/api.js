import { createApi } from './api-client.js';
import { readSession, saveSession } from './session.js';

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
export const api = createApi({ baseUrl, getSession: readSession, setSession: saveSession });
