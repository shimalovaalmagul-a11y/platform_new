import { allowMethod, handleError, json } from '../_lib/http.js';
import { requireAdmin, publicUser } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  try {
    await requireAdmin(req);
    const users = await (await getDb()).collection('users').find({}).sort({ createdAt: -1 }).limit(200).toArray();
    return json(res, 200, { users: users.map(publicUser) });
  } catch (error) {
    return handleError(res, error);
  }
}
