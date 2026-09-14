import { allowMethod, handleError, json } from '../../../_lib/http.js';
import { requireUser } from '../../../_lib/auth.js';
import { getDb, getFilesBucket } from '../../../_lib/db.js';
import { parseObjectId } from '../../../_lib/submissions.js';

function safeFilename(value) {
  return String(value || 'attachment').replace(/["\\\r\n]/g, '_');
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  try {
    const user = await requireUser(req);
    const submission = await (await getDb()).collection('submissions').findOne({ _id: parseObjectId(req.query.id) });
    if (!submission?.attachment) return json(res, 404, { error: 'Тіркелген файл жоқ.' });
    if (user.role !== 'admin' && !submission.studentId.equals(user._id)) return json(res, 403, { error: 'Бұл файлға қолжетімділік жоқ.' });

    res.setHeader('Content-Type', submission.attachment.mimeType);
    res.setHeader('Content-Length', submission.attachment.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(submission.attachment.filename)}"`);
    return (await getFilesBucket()).openDownloadStream(submission.attachment.fileId).pipe(res);
  } catch (error) {
    return handleError(res, error);
  }
}
