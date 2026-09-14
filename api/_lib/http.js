const MAX_JSON_BYTES = 1_000_000;

export function allowMethod(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  res.status(405).json({ error: 'Әдіс қолдау таппайды.' });
  return false;
}

export function json(res, status, body) {
  res.status(status).json(body);
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) {
      const error = new Error('Сұрау тым үлкен.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('JSON пішімі жарамсыз.');
    error.status = 400;
    throw error;
  }
}

export function clientError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function handleError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Сервер қатесі. Кейінірек қайталап көріңіз.' : error.message });
}
