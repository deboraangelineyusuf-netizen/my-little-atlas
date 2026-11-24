// Buka /api/drive-status di browser untuk mengecek koneksi ke Google Drive.
// Hanya menampilkan "ok" atau penyebab masalah, tidak pernah menampilkan rahasia.
const { accessToken } = require('../lib/drive');

module.exports = async function (req, res) {
  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'].filter(function (k) { return !process.env[k]; });
  if (missing.length) return res.status(200).json({ ok: false, problem: 'Missing settings: ' + missing.join(', ') });
  try {
    await accessToken();
    return res.status(200).json({ ok: true, message: 'Google Drive connection works.' });
  } catch (e) {
    return res.status(200).json({ ok: false, problem: String(e.message || e) });
  }
};
