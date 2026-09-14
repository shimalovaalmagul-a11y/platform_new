import bcrypt from 'bcryptjs';
import { allowMethod, clientError, handleError, json, readJson } from '../_lib/http.js';
import { ensureAdmin, normalizeEmail, publicUser, setSessionCookie, signSession } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  try {
    await ensureAdmin();
    const { email, password } = await readJson(req);
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || typeof password !== 'string') throw clientError('Email және құпиясөзді жазыңыз.');

    const user = await (await getDb()).collection('users').findOne({ email: cleanEmail });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return json(res, 401, { error: 'Email немесе құпиясөз дұрыс емес.' });
    }

    setSessionCookie(res, await signSession(user));
    return json(res, 200, { user: publicUser(user) });
  } catch (error) {
    return handleError(res, error);
  }
}
