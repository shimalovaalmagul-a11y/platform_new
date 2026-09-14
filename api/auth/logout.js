import { allowMethod, json } from '../_lib/http.js';
import { clearSessionCookie } from '../_lib/auth.js';

export default function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
}
