import { allowMethod, handleError, json } from '../_lib/http.js';
import { currentUser, publicUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  try {
    const user = await currentUser(req);
    return json(res, 200, { user: user ? publicUser(user) : null });
  } catch (error) {
    return handleError(res, error);
  }
}
