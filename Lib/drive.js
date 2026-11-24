// Pustaka bersama: login Supabase, kunci Google Drive, folder, dan upload.
// Tiga rahasia (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)
// dibaca dari pengaturan Vercel, TIDAK ditulis di file ini.
const https = require('https');

const SUPABASE_URL = 'https://fcsdzdyndybswqqqhixw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jJu7VQl5H3zLbf4wZg7jiA_DOWr-Hdl'; // publishable: aman
const APP_ORIGIN = 'https://my-little-atlas-hr32.vercel.app';
const ROOT = 'MY LITTLE ATLAS';
const VARIANTS = { original: 'Original Photos', optimized: 'Optimized Photos' };
const KINDS = { place: 'Places', food: 'Food', wishlist: 'Wishlist' };

// Pastikan yang memanggil adalah akun yang sudah login di Supabase
async function requireUser(req, res) {
  const h = req.headers.authorization || '';
  if (h.indexOf('Bearer ') !== 0) { res.status(401).json({ error: 'Not signed in' }); return null; }
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { Authorization: h, apikey: SUPABASE_KEY } });
  if (!r.ok) { res.status(401).json({ error: 'Not signed in' }); return null; }
  return r.json();
}

// Kunci sementara Google (diperbarui otomatis dari refresh token)
let cache = { token: null, exp: 0 };
async function accessToken() {
  if (cache.token && Date.now() < cache.exp - 60000) return cache.token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Google token error: ' + (d.error_description || d.error));
  cache = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return cache.token;
}

async function g(path, opt) {
  const t = await accessToken();
  opt = opt || {};
  return fetch('https://www.googleapis.com' + path, {
    method: opt.method, body: opt.body,
    headers: Object.assign({ Authorization: 'Bearer ' + t }, opt.headers || {})
  });
}

const folderCache = {};
async function ensureFolder(name, parent) {
  const key = (parent || 'root') + '/' + name;
  if (folderCache[key]) return folderCache[key];
  const q = "name='" + name.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false and '" + (parent || 'root') + "' in parents";
  const r = await g('/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q));
  const d = await r.json();
  if (!r.ok) throw new Error('Drive search failed: ' + JSON.stringify(d.error || d));
  let id = d.files && d.files[0] && d.files[0].id;
  if (!id) {
    const c = await g('/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.folder', parents: [parent || 'root'] })
    });
    const cd = await c.json();
    if (!c.ok) throw new Error('Drive folder failed: ' + JSON.stringify(cd.error || cd));
    id = cd.id;
  }
  folderCache[key] = id;
  return id;
}

// MY LITTLE ATLAS / Original Photos (atau Optimized Photos) / 2026 / Places
async function ensurePath(variant, year, kind) {
  let id = await ensureFolder(ROOT, null);
  id = await ensureFolder(VARIANTS[variant], id);
  id = await ensureFolder(year, id);
  return ensureFolder(KINDS[kind], id);
}

// Cari file dengan nama tertentu di folder (supaya upload ulang tidak membuat file ganda)
async function findFile(name, folderId) {
  const q = "name='" + name.replace(/'/g, "\\'") + "' and '" + folderId + "' in parents and trashed=false";
  const r = await g('/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q));
  const d = await r.json();
  if (!r.ok) throw new Error('Drive lookup failed: ' + JSON.stringify(d.error || d));
  return d.files && d.files[0] ? d.files[0].id : null;
}

// Buat "pintu upload" ke Drive; browser mengirim foto langsung ke alamat ini
function startResumable(token, name, folderId, mime, size) {
  return new Promise(function (resolve, reject) {
    const body = JSON.stringify({ name: name, parents: [folderId] });
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: '/upload/drive/v3/files?uploadType=resumable&fields=id',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(size),
        Origin: APP_ORIGIN
      }
    }, function (res) {
      res.resume();
      res.on('end', function () {
        if (res.headers.location) resolve(res.headers.location);
        else reject(new Error('Drive did not return an upload address (status ' + res.statusCode + ')'));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { requireUser, accessToken, g, ensurePath, findFile, startResumable, VARIANTS, KINDS };
