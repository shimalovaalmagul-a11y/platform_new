import { Readable } from 'node:stream';
import { allowMethod, handleError, json, readJson } from '../_lib/http.js';
import { requireUser } from '../_lib/auth.js';
import { getDb, getFilesBucket } from '../_lib/db.js';
import { cleanSubmission, parseMultipart, submissionView, validateUpload } from '../_lib/submissions.js';

export const config = { api: { bodyParser: false } };

async function saveAttachment(upload, ownerId) {
  if (!upload) return null;
  const bucket = await getFilesBucket();
  const stream = bucket.openUploadStream(upload.filename, {
    contentType: upload.mimeType,
    metadata: { ownerId: ownerId.toString(), uploadedAt: new Date() },
  });
  await new Promise((resolve, reject) => {
    Readable.from(upload.data).pipe(stream).on('finish', resolve).on('error', reject);
  });
  return { fileId: stream.id, filename: upload.filename, mimeType: upload.mimeType, size: upload.size };
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET', 'POST'])) return;
  try {
    const user = await requireUser(req);
    const submissions = (await getDb()).collection('submissions');

    if (req.method === 'GET') {
      const records = await submissions.find({ studentId: user._id }).sort({ createdAt: -1 }).limit(50).toArray();
      return json(res, 200, { submissions: records.map(submissionView) });
    }

    const contentType = req.headers['content-type'] || '';
    let raw;
    let upload = null;
    if (contentType.startsWith('multipart/form-data')) {
      const parsed = await parseMultipart(req);
      raw = parsed.fields;
      upload = validateUpload(parsed.upload);
    } else {
      raw = await readJson(req);
    }

    const work = cleanSubmission(raw);
    const attachment = await saveAttachment(upload, user._id);
    const now = new Date();
    try {
      const submission = {
        studentId: user._id,
        student: { name: user.name, email: user.email },
        ...work,
        attachment,
        grading: null,
        createdAt: now,
        updatedAt: now,
      };
      const result = await submissions.insertOne(submission);
      submission._id = result.insertedId;
      return json(res, 201, { submission: submissionView(submission) });
    } catch (error) {
      if (attachment) await (await getFilesBucket()).delete(attachment.fileId).catch(() => {});
      throw error;
    }
  } catch (error) {
    return handleError(res, error);
  }
}
