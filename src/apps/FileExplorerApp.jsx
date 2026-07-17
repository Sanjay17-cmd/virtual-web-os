/**
 * FileExplorerApp.jsx
 * Virtual OS File Explorer — browse and upload files in Google Drive WebOS_Data folder.
 * Features: folder tree sidebar, file listing, upload button, file type icons,
 * auto-creates video/, audio/, text/ sub-folders if missing.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Folder, FileText, File, Film, Music, Image, Upload,
  RefreshCw, Loader2, AlertCircle, ChevronRight, ChevronDown,
  Download, Trash2, Plus, Home, HardDrive, Search,
} from 'lucide-react';
import {
  listDriveFolderTree, listSubFolderContents,
  uploadFileToDrive, ensureSubFolder, deleteFileFromDrive,
} from '../lib/driveService';
import supabase from '../lib/supabaseClient';

// ── File type icon helper ─────────────────────────────────────────────────────
const getFileIcon = (name, mimeType) => {
  const ext = name.split('.').pop().toLowerCase();
  if (['mp4','mkv','avi','mov','webm'].includes(ext) || mimeType?.startsWith('video/')) return Film;
  if (['mp3','wav','ogg','flac','aac','m4a'].includes(ext) || mimeType?.startsWith('audio/')) return Music;
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext) || mimeType?.startsWith('image/')) return Image;
  if (['txt','md','json','log','csv','html'].includes(ext) || mimeType?.startsWith('text/')) return FileText;
  return File;
};

const getFileColor = (name, mimeType) => {
  const ext = name.split('.').pop().toLowerCase();
  if (['mp4','mkv','avi','mov','webm'].includes(ext) || mimeType?.startsWith('video/')) return '#6366f1';
  if (['mp3','wav','ogg','flac','aac','m4a'].includes(ext) || mimeType?.startsWith('audio/')) return '#ec4899';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext) || mimeType?.startsWith('image/')) return '#10b981';
  if (['txt','md','json','log','csv','html'].includes(ext) || mimeType?.startsWith('text/')) return '#0ea5e9';
  return '#94a3b8';
};

// ── Format file size ─────────────────────────────────────────────────────────
const fmtSize = (bytes) => {
  if (!bytes) return '—';
  const b = parseInt(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

// ── Format date ───────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Upload progress bar ───────────────────────────────────────────────────────
const UploadProgress = ({ name, progress }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className="flex items-center gap-3 px-4 py-3 rounded-xl"
    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}
  >
    <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: '#818cf8' }} />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{name}</p>
      <div className="w-full h-1 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
    <span className="text-xs flex-shrink-0" style={{ color: '#a5b4fc' }}>{progress}%</span>
  </motion.div>
);

// ── Folder tree item ──────────────────────────────────────────────────────────
const FolderItem = ({ folder, isSelected, onClick }) => (
  <motion.button
    whileHover={{ x: 2 }}
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left"
    style={{
      background: isSelected ? 'rgba(99,102,241,0.15)' : 'transparent',
      borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent',
    }}
  >
    {isSelected
      ? <FolderOpen size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
      : <Folder size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
    }
    <span
      className="text-xs font-medium truncate"
      style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)' }}
    >
      {folder.name}
    </span>
  </motion.button>
);

// ── Main FileExplorerApp ──────────────────────────────────────────────────────
const FileExplorerApp = () => {
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState(null);
  const [tree,         setTree]         = useState(null);   // { folders, files, rootFolderId, token }
  const [selectedFolder, setSelectedFolder] = useState(null); // folder object or null (root)
  const [folderFiles,  setFolderFiles]  = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploads,      setUploads]      = useState([]);     // [{ name, progress }]
  const [search,       setSearch]       = useState('');
  const [deleting,     setDeleting]     = useState(null);   // file id being deleted

  const fileInputRef = useRef(null);

  // ── Determine which subfolder slug the selected folder maps to ──────────
  const getSubfolderSlug = useCallback(() => {
    if (!selectedFolder) return null;
    const n = selectedFolder.name.toLowerCase();
    if (n === 'video') return 'video';
    if (n === 'audio') return 'audio';
    if (n === 'text')  return 'text';
    return null;
  }, [selectedFolder]);

  // ── Load folder tree ──────────────────────────────────────────────────────
  const loadTree = useCallback(async () => {
    if (!supabase) {
      setError('Sign in with Google to access your Drive files.');
      setLoading(false);
      return;
    }
    try {
      const data = await listDriveFolderTree();
      setTree(data);
      // Show root files initially
      setFolderFiles(data.files);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  // ── Load sub-folder contents ───────────────────────────────────────────────
  useEffect(() => {
    if (!tree) return;
    if (!selectedFolder) {
      setFolderFiles(tree.files);
      return;
    }
    const fetch = async () => {
      setLoadingFiles(true);
      try {
        const items = await listSubFolderContents(selectedFolder.id, tree.token);
        setFolderFiles(items);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingFiles(false);
      }
    };
    fetch();
  }, [selectedFolder, tree]);

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Determine target subfolder
    const slug = getSubfolderSlug() || detectSubfolder(selectedFiles[0]);

    for (const file of selectedFiles) {
      const uploadId = Date.now() + file.name;
      setUploads(prev => [...prev, { id: uploadId, name: file.name, progress: 0 }]);

      // Simulate progress (real API doesn't give progress for multipart)
      const progressInterval = setInterval(() => {
        setUploads(prev => prev.map(u =>
          u.id === uploadId ? { ...u, progress: Math.min(u.progress + 15, 90) } : u
        ));
      }, 200);

      try {
        await uploadFileToDrive(file, slug);
        clearInterval(progressInterval);
        setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: 100 } : u));
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.id !== uploadId));
        }, 1500);
        // Refresh file list
        await loadTree();
      } catch (err) {
        clearInterval(progressInterval);
        setUploads(prev => prev.filter(u => u.id !== uploadId));
        alert(`Upload failed: ${err.message}`);
      }
    }
  };

  // Detect subfolder from file type
  const detectSubfolder = (file) => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'text';
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = async (fileId) => {
    setDeleting(fileId);
    try {
      await deleteFileFromDrive(fileId);
      setFolderFiles(prev => prev.filter(f => f.id !== fileId));
      if (tree) {
        setTree(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }));
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadTree();
  };

  // Filter files
  const displayFiles = folderFiles.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6366f1' }} />
        <p className="text-sm">Connecting to Drive…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={28} style={{ color: '#f87171' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Drive Not Connected</p>
          <p className="text-xs mt-1 max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const folders = [
    { id: '__root__', name: 'WebOS_Data', isRoot: true },
    ...(tree?.folders ?? []),
  ];

  const breadcrumb = selectedFolder
    ? `WebOS_Data / ${selectedFolder.name}`
    : 'WebOS_Data';

  return (
    <div className="flex h-full overflow-hidden" style={{ color: 'rgba(255,255,255,0.88)' }}>
      {/* ── Sidebar ── */}
      <div
        className="flex-shrink-0 w-44 flex flex-col overflow-hidden py-4"
        style={{ borderRight: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}
      >
        {/* Drive root */}
        <div className="px-3 mb-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <HardDrive size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Drive
            </span>
          </div>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {folders.map(f => (
            <FolderItem
              key={f.id}
              folder={f}
              isSelected={
                f.isRoot
                  ? selectedFolder === null
                  : selectedFolder?.id === f.id
              }
              onClick={() => setSelectedFolder(f.isRoot ? null : f)}
            />
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.1)' }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <FolderOpen size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {breadcrumb}
            </span>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Search size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-28 bg-transparent text-xs outline-none placeholder:text-white/20"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            />
          </div>

          {/* Upload button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
            }}
          >
            <Upload size={13} />
            Upload
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />

          {/* Refresh */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              className={refreshing ? 'animate-spin' : ''}
              style={{ color: 'rgba(255,255,255,0.4)' }}
            />
          </motion.button>
        </div>

        {/* Upload progress area */}
        <AnimatePresence>
          {uploads.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex-shrink-0 px-4 py-2 space-y-2 overflow-hidden"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              {uploads.map(u => <UploadProgress key={u.id} name={u.name} progress={u.progress} />)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* File listing */}
        <div className="flex-1 overflow-y-auto">
          {loadingFiles ? (
            <div className="flex items-center justify-center h-32 gap-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : displayFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <FolderOpen size={40} strokeWidth={1.5} />
              <p className="text-sm">{search ? 'No files match your search' : 'This folder is empty'}</p>
              {!search && (
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mt-2"
                  style={{
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    color: '#a5b4fc',
                  }}
                >
                  <Upload size={12} />
                  Upload files here
                </motion.button>
              )}
            </div>
          ) : (
            <>
              {/* Table header */}
              <div
                className="grid gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest sticky top-0"
                style={{
                  gridTemplateColumns: '1fr auto auto auto',
                  color: 'rgba(255,255,255,0.3)',
                  background: 'rgba(10,10,25,0.95)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span>Name</span>
                <span className="w-24 text-right">Size</span>
                <span className="w-28 text-right">Modified</span>
                <span className="w-16 text-right">Actions</span>
              </div>

              {/* File rows */}
              <div className="px-2 py-2">
                <AnimatePresence>
                  {displayFiles.map((f, i) => {
                    const IconComp = getFileIcon(f.name, f.mimeType);
                    const iconColor = getFileColor(f.name, f.mimeType);
                    const isDeleting = deleting === f.id;

                    return (
                      <motion.div
                        key={f.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: i * 0.02 }}
                        whileHover={{ background: 'rgba(255,255,255,0.04)' }}
                        className="grid gap-2 px-3 py-2.5 rounded-xl items-center group transition-colors"
                        style={{ gridTemplateColumns: '1fr auto auto auto' }}
                      >
                        {/* Name */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}
                          >
                            <IconComp size={14} style={{ color: iconColor }} />
                          </div>
                          <span className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
                            {f.name}
                          </span>
                        </div>

                        {/* Size */}
                        <span className="w-24 text-right text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {fmtSize(f.size)}
                        </span>

                        {/* Date */}
                        <span className="w-28 text-right text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {fmtDate(f.modifiedTime)}
                        </span>

                        {/* Actions */}
                        <div className="w-16 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {f.webContentLink && (
                            <a
                              href={f.webContentLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                            >
                              <motion.div whileHover={{ scale: 1.15 }}>
                                <Download size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                              </motion.div>
                            </a>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            onClick={() => handleDelete(f.id)}
                            disabled={isDeleting}
                          >
                            {isDeleting
                              ? <Loader2 size={13} className="animate-spin" style={{ color: '#f87171' }} />
                              : <Trash2 size={13} style={{ color: 'rgba(239,68,68,0.6)' }} />
                            }
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        {/* Status bar */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
        >
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {displayFiles.length} item{displayFiles.length !== 1 ? 's' : ''}
            {search && ` · filtered from ${folderFiles.length}`}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            WebOS_Data · Google Drive
          </span>
        </div>
      </div>
    </div>
  );
};

export default FileExplorerApp;
