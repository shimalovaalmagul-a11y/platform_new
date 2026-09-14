import bcrypt from 'bcryptjs';
import { allowMethod, clientError, handleError, json, readJson } from '../_lib/http.js';
import { ensureAdmin, normalizeEmail, publicUser, setSessionCookie, signSession } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  try {
    await ensureAdmin();
    const { name, email, password } = await readJson(req);
    const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
    const cleanEmail = normalizeEmail(email);

    if (cleanName.length < 2 || cleanName.length > 80) throw clientError('Аты-жөніңіз 2–80 таңба болуы керек.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw clientError('Жарамды email мекенжайын жазыңыз.');
    if (typeof password !== 'string' || password.length < 10 || password.length > 200) throw clientError('Құпиясөз 10–200 таңба болуы керек.');

    const users = (await getDb()).collection('users');
    const user = {
      name: cleanName,
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'student',
      createdAt: new Date(),
    };
    const result = await users.insertOne(user);
    user._id = result.insertedId;
    setSessionCookie(res, await signSession(user));
    return json(res, 201, { user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return json(res, 409, { error: 'Бұл email арқылы тіркелгі бар. Жүйеге кіріңіз.' });
    return handleError(res, error);
  }
}
