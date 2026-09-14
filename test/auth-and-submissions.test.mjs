import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';

process.env.APP_JWT_SECRET = 'test-secret-that-is-long-enough-to-sign-session-tokens';

const { normalizeEmail, publicUser, signSession } = await import('../api/_lib/auth.js');
const { cleanSubmission, maxUploadBytes, validateUpload } = await import('../api/_lib/submissions.js');

test('normalizes email before account lookup', () => {
  assert.equal(normalizeEmail('  STUDENT@Example.KZ '), 'student@example.kz');
});

test('creates a signed session token for a user', async () => {
  const token = await signSession({ _id: new ObjectId(), name: 'Аружан', role: 'student' });
  assert.equal(token.split('.').length, 3);
});

test('does not expose password hashes in public user data', () => {
  const user = { _id: new ObjectId(), name: 'Аружан', email: 'a@example.kz', role: 'student', passwordHash: 'hidden', createdAt: new Date() };
  assert.deepEqual(Object.keys(publicUser(user)).sort(), ['createdAt', 'email', 'id', 'name', 'role']);
});

test('accepts a valid submitted analysis and integrity declaration', () => {
  const result = cleanSubmission({ title: 'Үзінді талдауы', analysis: 'Автордың бейнелі тілі балалық шақтың мейірімді әлемін оқырманға сезіндіреді. '.repeat(2), additionalSources: '', integrityConfirmed: true });
  assert.equal(result.title, 'Үзінді талдауы');
  assert.equal(result.integrityConfirmed, true);
});

test('rejects an analysis without integrity declaration or an unsafe attachment type', () => {
  assert.throws(() => cleanSubmission({ title: 'Талдау', analysis: 'Мәтіндік талдау сөйлемі.'.repeat(5), integrityConfirmed: false }), /растауды/);
  assert.throws(() => validateUpload({ filename: 'run.exe', mimeType: 'application/octet-stream', size: 10 }), /PDF/);
  assert.equal(maxUploadBytes(), 4 * 1024 * 1024);
});
