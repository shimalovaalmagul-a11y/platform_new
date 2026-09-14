import { allowMethod, handleError, json } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { submissionView } from '../_lib/submissions.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  try {
    await requireAdmin(req);
    const requested = Number(req.query.limit || 50);
    const limit = Number.isSafeInteger(requested) ? Math.max(1, Math.min(requested, 100)) : 50;
    const submissions = await (await getDb()).collection('submissions').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
    return json(res, 200, { submissions: submissions.map(submissionView) });
  } catch (error) {
    return handleError(res, error);
  }
}
