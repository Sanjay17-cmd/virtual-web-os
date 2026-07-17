/**
 * driveService.js
 * Google Drive API utility for the Virtual OS cloud storage layer.
 *
 * Key design decisions:
 * - Promise-caching on ensureWebOSFolder & ensureSubFolder prevents race-condition
 *   duplicate creation when multiple apps open simultaneously.
 * - getDriveFileBlob() fetches private Drive files with Bearer token and returns
 *   an object URL safe for <audio>/<video> src — the ONLY correct way to play
 *   private Drive files in a browser.
 * - getAccessToken is exported so apps can fetch files directly when needed.
 *
 * Supported sub-folders: 'text' | 'video' | 'audio'
 */
import supabase from './supabaseClient';

const DRIVE_API   = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_NAME = 'WebOS_Data';

// ── Promise cache — prevents concurrent duplicate folder creation ──────────────
// Keyed by folder label so each folder is only created once per session.
const _folderPromiseCache = {};

// ── Internal: get the Google access_token from the active Supabase session ───
export async function getAccessToken() {
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

// ── Internal: find a named folder within a specific parent (or root) ─────────
async function findFolder(accessToken, name, parentId = null) {
  let query = `name='${name}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`[DriveService] Folder search failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.files?.[0] ?? null; // always pick first if duplicates exist
}

// ── Internal: create a named folder within a parent (or root) ─────────────────
async function createFolder(accessToken, name, parentId = null) {
  const metadata = { name, mimeType: FOLDER_MIME };
  if (parentId) metadata.parents = [parentId];
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw new Error(`[DriveService] Folder creation failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * ensureWebOSFolder()
 * Finds or creates the WebOS_Data root folder.
 * Promise-cached so concurrent callers share a single resolution.
 * Returns { token, folderId }
 */
export function ensureWebOSFolder() {
  if (!_folderPromiseCache.__root) {
    _folderPromiseCache.__root = (async () => {
      const token  = await getAccessToken();
      const folder = await findFolder(token, FOLDER_NAME);
      if (folder) return { token, folderId: folder.id };
      const created = await createFolder(token, FOLDER_NAME);
      console.info(`[DriveService] Created '${FOLDER_NAME}' folder: ${created.id}`);
      return { token, folderId: created.id };
    })();
  }
  return _folderPromiseCache.__root;
}

/**
 * ensureSubFolder(subfolder)
 * Ensures a named sub-folder exists inside WebOS_Data.
 * Promise-cached per subfolder name to prevent race-condition duplicates.
 * Returns { token, folderId, subFolderId }
 */
export function ensureSubFolder(subfolder) {
  const cacheKey = `sub_${subfolder}`;
  if (!_folderPromiseCache[cacheKey]) {
    _folderPromiseCache[cacheKey] = (async () => {
      const { token, folderId } = await ensureWebOSFolder();
      const existing = await findFolder(token, subfolder, folderId);
      if (existing) return { token, folderId, subFolderId: existing.id };
      const created = await createFolder(token, subfolder, folderId);
      console.info(`[DriveService] Created sub-folder '${subfolder}': ${created.id}`);
      return { token, folderId, subFolderId: created.id };
    })();
  }
  return _folderPromiseCache[cacheKey];
}

/**
 * initializeDriveFolders()
 * Pre-creates all required sub-folders sequentially on app start.
 * Call this once after authentication to prevent lazy race conditions.
 */
export async function initializeDriveFolders() {
  await ensureWebOSFolder();
  // Create all sub-folders sequentially — NOT concurrently
  await ensureSubFolder('text');
  await ensureSubFolder('video');
  await ensureSubFolder('audio');
  await ensureSubFolder('wallpaper');
  console.info('[DriveService] All Drive folders initialized.');
}

/**
 * listDriveFolder(subfolder)
 * Lists all non-folder files in a WebOS_Data sub-folder.
 * @param {string|null} subfolder — 'text' | 'video' | 'audio' | null (root)
 */
export async function listDriveFolder(subfolder = null) {
  const token = await getAccessToken();
  let parentId;

  if (subfolder) {
    const { subFolderId } = await ensureSubFolder(subfolder);
    parentId = subFolderId;
  } else {
    const { folderId } = await ensureWebOSFolder();
    parentId = folderId;
  }

  const query = encodeURIComponent(
    `'${parentId}' in parents and trashed=false and mimeType!='${FOLDER_MIME}'`
  );
  const fields = 'files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink)';
  const res = await fetch(
    `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=name&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`[DriveService] List failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.files ?? [];
}

/**
 * listDriveFolderTree()
 * Lists all sub-folders and files directly inside WebOS_Data root.
 * Returns { folders, files, rootFolderId, token }
 */
export async function listDriveFolderTree() {
  const token = await getAccessToken();
  const { folderId } = await ensureWebOSFolder();

  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = 'files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink)';
  const res = await fetch(
    `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=name&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`[DriveService] Tree list failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const items = json.files ?? [];

  return {
    rootFolderId: folderId,
    folders: items.filter(f => f.mimeType === FOLDER_MIME),
    files:   items.filter(f => f.mimeType !== FOLDER_MIME),
    token,
  };
}

/**
 * listSubFolderContents(subFolderId, token)
 * Lists all items inside a specific folder ID.
 */
export async function listSubFolderContents(subFolderId, token) {
  const accessToken = token || await getAccessToken();
  const query = encodeURIComponent(`'${subFolderId}' in parents and trashed=false`);
  const fields = 'files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink)';
  const res = await fetch(
    `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=name&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`[DriveService] Subfolder list failed: ${res.status}`);
  const json = await res.json();
  return json.files ?? [];
}

/**
 * getDriveFileBlob(fileId)
 * Fetches a private Drive file using the Bearer token and returns a Blob Object URL.
 * This is the ONLY correct way to play private Drive audio/video in an HTML element.
 * ⚠️ Caller is responsible for calling URL.revokeObjectURL() when done.
 *
 * @param {string} fileId - Drive file ID
 * @returns {Promise<string>} - Object URL (blob:...)
 */
export async function getDriveFileBlob(fileId) {
  const token = await getAccessToken();
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`[DriveService] File fetch failed (${res.status}): ${res.statusText}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * saveFileToDrive(fileName, content, extension?, subfolder?)
 * Writes content as a UTF-8 text file into WebOS_Data/[subfolder]/ folder.
 * Defaults to 'text' subfolder.
 */
export async function saveFileToDrive(fileName, content, extension = 'txt', subfolder = 'text') {
  const { token, subFolderId } = await ensureSubFolder(subfolder);

  const safeName = (fileName.trim() || 'Untitled');
  const fullName = safeName.includes('.') ? safeName : `${safeName}.${extension}`;

  const boundary   = '-------WebOS_Drive_Boundary_7a3f';
  const delimiter  = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = JSON.stringify({ name: fullName, parents: [subFolderId] });

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

/**
 * uploadFileToDrive(file, subfolder, onProgress?)
 * Uploads a File object to WebOS_Data/[subfolder]/.
 * Uses multipart for files < 5 MB, resumable for larger.
 */
export async function uploadFileToDrive(file, subfolder = 'text', onProgress = null) {
  const { token, subFolderId } = await ensureSubFolder(subfolder);
  const metadata = JSON.stringify({ name: file.name, parents: [subFolderId] });

  if (file.size < 5 * 1024 * 1024) {
    const boundary   = '-------WebOS_Upload_Boundary_9b2e';
    const delimiter  = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const metaPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata;

    const textEncoder = new TextEncoder();
    const metaBytes   = textEncoder.encode(metaPart + `${delimiter}Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`);
    const closeBytes  = textEncoder.encode(closeDelim);
    const fileBuffer  = await file.arrayBuffer();

    const combined = new Uint8Array(metaBytes.length + fileBuffer.byteLength + closeBytes.length);
    combined.set(metaBytes, 0);
    combined.set(new Uint8Array(fileBuffer), metaBytes.length);
    combined.set(closeBytes, metaBytes.length + fileBuffer.byteLength);

    const res = await fetch(
      `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink,mimeType,size`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: combined,
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[DriveService] Upload failed (${res.status}): ${errText}`);
    }
    return res.json();
  }

  // Resumable upload for large files
  const initRes = await fetch(
    `${UPLOAD_API}/files?uploadType=resumable&fields=id,name,webViewLink,mimeType,size`,
    {
      method: 'POST',
      headers: {
        Authorization:   `Bearer ${token}`,
        'Content-Type':  'application/json; charset=UTF-8',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': file.size,
      },
      body: metadata,
    }
  );
  if (!initRes.ok) throw new Error(`[DriveService] Resumable init failed: ${initRes.status}`);

  const uploadUrl = initRes.headers.get('Location');
  const fileBuffer = await file.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Length': file.size,
    },
    body: fileBuffer,
  });
  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`[DriveService] Resumable upload failed (${uploadRes.status}): ${errText}`);
  }
  return uploadRes.json();
}

/**
 * deleteFileFromDrive(fileId)
 * Moves a file to trash.
 */
export async function deleteFileFromDrive(fileId) {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files/${fileId}/trash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`[DriveService] Delete failed: ${res.status}`);
}

/** Invalidate folder cache (useful after cleanup) */
export function clearFolderCache() {
  Object.keys(_folderPromiseCache).forEach(k => delete _folderPromiseCache[k]);
}
