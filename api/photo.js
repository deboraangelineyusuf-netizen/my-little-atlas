// Mengambil foto (versi ringan) dari Drive-mu dan mengirimkannya ke app.
// Wajib login, tidak ada link publik. Hanya untuk file ringan (di bawah ~4 MB).
const { requireUser, g } = require('../lib/drive');

module.exports = async function (req, res) {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = String(req.query.id || '');
    if (!/^[\w-]{10,}$/.test(id)) return res.status(400).json({ error: 'Bad request' });
    const r = await g('/drive/v3/files/' + encodeURIComponent(id) + '?alt=media');
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json({ error: 'Photo not available' });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
