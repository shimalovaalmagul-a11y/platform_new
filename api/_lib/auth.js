import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb, ensureIndexes } from './db.js';

const COOKIE = 'ushqan_session';
const encoder = new TextEncoder();

function secret() {
  const value = process.env.APP_JWT_SECRET;
  if (!value || value.length < 32) {
    const error = new Error('APP_JWT_SECRET кемінде 32 таңбадан тұруы керек.');
    error.status = 503;
    throw error;
  }
  return encoder.encode(value);
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

export async function ensureAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  await ensureIndexes();
  const users = (await getDb()).collection('users');
  const existing = await users.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      const error = new Error('ADMIN_EMAIL басқа тіркелгімен бос емес.');
      error.status = 503;
      throw error;
    }
    if (!(await bcrypt.compare(password, existing.passwordHash))) {
      await users.updateOne({ _id: existing._id }, { $set: { passwordHash: await bcrypt.hash(password, 12) } });
    }
    return;
  }

  try {
    await users.insertOne({
      name: 'Администратор',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
      createdAt: new Date(),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

export async function signSession(user) {
  return new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user._id.toString())
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export function cookies(req) {
  const source = req.headers.cookie || '';
  return Object.fromEntries(source.split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? [part.trim(), ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export async function currentUser(req) {
  const token = cookies(req)[COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await (await getDb()).collection('users').findOne({ _id: new ObjectId(payload.sub) });
    return user || null;
  } catch {
    return null;
  }
}

export async function requireUser(req) {
  const user = await currentUser(req);
  if (user) return user;
  const error = new Error('Жалғастыру үшін жүйеге кіріңіз.');
  error.status = 401;
  throw error;
}

export async function requireAdmin(req) {
  const user = await requireUser(req);
  if (user.role === 'admin') return user;
  const error = new Error('Бұл бөлім тек әкімшіге арналған.');
  error.status = 403;
  throw error;
}
