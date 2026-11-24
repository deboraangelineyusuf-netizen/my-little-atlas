// Menyiapkan upload satu foto ke Google Drive-mu.
// - Wajib login. Foto TIDAK lewat server ini: browser mengirim langsung ke Drive.
// - Kalau file dengan ID upload yang sama sudah ada, dikembalikan apa adanya (tidak ada file ganda).
const { requireUser, accessToken, ensurePath, findFile, startResumable, VARIANTS, KINDS } = require('../lib/drive');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const b = req.body || {};
    const variant = b.variant, kind = b.kind, year = String(b.year || ''), uid = String(b.clientUploadId || '');
    if (!VARIANTS[variant] || !KINDS[kind] || !/^\d{4}$/.test(year) || !/^[0-9a-f-]{36}$/i.test(uid)) {
      return res.status(400).json({ error: 'Bad request' });
    }
    const filename = String(b.filename || 'photo').replace(/[^\w.\- ]/g, '_').slice(0, 120);
    const mime = String(b.mimeType || 'application/octet-stream').slice(0, 100);
    const size = Number(b.size) || 0;

    const folderId = await ensurePath(variant, year, kind);
    const name = uid + '_' + variant + '_' + filename;

    const existing = await findFile(name, folderId);
    if (existing) return res.status(200).json({ done: true, fileId: existing });
    if (b.verifyOnly) return res.status(200).json({ done: false });

    const token = await accessToken();
    const uploadUrl = await startResumable(token, name, folderId, mime, size);
    return res.status(200).json({ done: false, uploadUrl: uploadUrl });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
