/**
 * driveService.js
 * Google Drive API utility for the Virtual OS cloud storage layer.
 *
 * Responsibilities:
 *  1. Retrieve the authenticated Google OAuth access token from the Supabase session.
 *  2. Ensure the 'WebOS_Data' folder exists in the user's Drive root (create if missing).
 *  3. Upload text file content via Drive multipart upload API.
 *
 * All functions are safe to call when Supabase is null (offline/mock mode) —
 * they return graceful error objects instead of throwing.
 */
import supabase from './supabaseClient';

const DRIVE_API   = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_NAME = 'WebOS_Data';

// ── Internal: get the Google access_token from the active Supabase session ───
async function getAccessToken() {
  if (!supabase) {
    throw new Error('[DriveService] Supabase is not initialised (offline mode).');
  }
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Error('[DriveService] No active session — user must be signed in with Google.');
  }
  const token = session.provider_token;
  if (!token) {
    throw new Error(
      '[DriveService] Google provider_token is missing. ' +
      'Ensure the drive.file scope was requested during sign-in.'
    );
  }
  return token;
}

// ── Internal: find the WebOS_Data folder in Drive root ───────────────────────
async function findFolder(accessToken) {
  const query = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const res = await fetch(
    `${DRIVE_API}/files?q=${query}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`[DriveService] Folder search failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.files?.[0] ?? null;
}

// ── Internal: create the WebOS_Data folder in Drive root ─────────────────────
async function createFolder(accessToken) {
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: FOLDER_MIME,
    }),
  });
  if (!res.ok) throw new Error(`[DriveService] Folder creation failed: ${res.status} ${res.statusText}`);
  return res.json(); // { id, name, … }
}

/**
 * ensureWebOSFolder()
 * Checks for the WebOS_Data folder, creating it if absent.
 * Returns the folder ID string.
 *
 * @returns {Promise<string>} folderId
 */
export async function ensureWebOSFolder() {
  const token  = await getAccessToken();
  const folder = await findFolder(token);
  if (folder) return folder.id;
  const created = await createFolder(token);
  console.info(`[DriveService] Created '${FOLDER_NAME}' folder: ${created.id}`);
  return created.id;
}

/**
 * saveFileToDrive(fileName, content)
 * Writes `content` as a UTF-8 .txt file into the WebOS_Data Drive folder.
 * Uses the Drive multipart upload API so metadata + body are sent in one request.
 *
 * @param {string} fileName  - File name (e.g. 'notes.txt'). '.txt' appended if absent.
 * @param {string} content   - Plain text file body.
 * @returns {Promise<{ id: string, name: string, webViewLink: string }>}
 */
export async function saveFileToDrive(fileName, content) {
  const token    = await getAccessToken();
  const folderId = await ensureWebOSFolder();

  // Normalise file name
  const safeName = fileName.trim() || 'Untitled';
  const fullName = safeName.endsWith('.txt') ? safeName : `${safeName}.txt`;

  // Build multipart/related body
  const boundary   = '-------WebOS_Drive_Boundary_7a3f';
  const delimiter  = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = JSON.stringify({
    name:    fullName,
    parents: [folderId],
  });

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    delimiter +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    content +
    closeDelim;

  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[DriveService] Upload failed (${res.status}): ${errText}`);
  }

  const result = await res.json();
  console.info(`[DriveService] Saved '${result.name}' → ${result.webViewLink}`);
  return result;
}
