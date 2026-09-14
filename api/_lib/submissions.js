import Busboy from 'busboy';
import { ObjectId } from 'mongodb';
import { clientError } from './http.js';

const acceptedTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export function cleanSubmission(input) {
  const title = String(input.title || '').trim().replace(/\s+/g, ' ');
  const analysis = String(input.analysis || '').trim();
  const additionalSources = String(input.additionalSources || '').trim();
  const integrityConfirmed = input.integrityConfirmed === true || input.integrityConfirmed === 'true';

  if (title.length < 2 || title.length > 140) throw clientError('Жұмыс атауы 2–140 таңба болуы керек.');
  if (analysis.length < 80 || analysis.length > 50_000) throw clientError('Талдау 80–50 000 таңба болуы керек.');
  if (additionalSources.length > 4_000) throw clientError('Дереккөздер тізімі тым ұзын.');
  if (!integrityConfirmed) throw clientError('Академиялық адалдық туралы растауды белгілеңіз.');

  return { title, analysis, additionalSources, integrityConfirmed };
}

export function maxUploadBytes() {
  const value = Number(process.env.MAX_UPLOAD_BYTES || 4 * 1024 * 1024);
  return Number.isSafeInteger(value) && value > 0 && value <= 4 * 1024 * 1024 ? value : 4 * 1024 * 1024;
}

export function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let upload = null;
    let failed = false;
    const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: maxUploadBytes(), fields: 12, fieldSize: 50_000 } });

    busboy.on('field', (name, value) => { fields[name] = value; });
    busboy.on('file', (name, stream, info) => {
      if (name !== 'attachment') {
        stream.resume();
        return;
      }
      const chunks = [];
      let size = 0;
      stream.on('data', chunk => { size += chunk.length; chunks.push(chunk); });
      stream.on('limit', () => { failed = true; });
      stream.on('end', () => {
        if (info.filename) upload = { filename: info.filename, mimeType: info.mimeType, data: Buffer.concat(chunks), size };
      });
    });
    busboy.on('filesLimit', () => { failed = true; });
    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (failed) return reject(clientError(`Файл ${Math.floor(maxUploadBytes() / 1024 / 1024)} МБ-тан аспауы керек.`, 413));
      resolve({ fields, upload });
    });
    req.pipe(busboy);
  });
}

export function validateUpload(upload) {
  if (!upload) return null;
  if (!acceptedTypes.has(upload.mimeType)) throw clientError('Тек PDF, DOCX немесе TXT файлдарын тіркей аласыз.');
  if (upload.size === 0) throw clientError('Бос файлды тіркеу мүмкін емес.');
  const filename = upload.filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'attachment';
  return { ...upload, filename };
}

export function submissionView(submission) {
  return {
    id: submission._id.toString(),
    student: submission.student,
    title: submission.title,
    analysis: submission.analysis,
    additionalSources: submission.additionalSources,
    integrityConfirmed: submission.integrityConfirmed,
    grading: submission.grading ? {
      status: submission.grading.status,
      scoreA: submission.grading.scoreA,
      scoreD: submission.grading.scoreD,
      total: submission.grading.total,
      feedback: submission.grading.feedback,
      gradedAt: submission.grading.gradedAt,
    } : null,
    attachment: submission.attachment ? { filename: submission.attachment.filename, mimeType: submission.attachment.mimeType, size: submission.attachment.size } : null,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

export function parseObjectId(value) {
  if (!ObjectId.isValid(value)) throw clientError('Жұмыс идентификаторы жарамсыз.');
  return new ObjectId(value);
}
