import { googleDriveService, isDriveFolder } from '@/services/google/googleDriveService';
import { dropboxFilesService, isDropboxFolder } from '@/services/dropbox/dropboxFilesService';

export type MediaProvider = 'drive' | 'dropbox';
export type MediaKind = 'folder' | 'image' | 'video' | 'other';

// Entrada unificada: `ref` é o id do arquivo no Drive ou o caminho no Dropbox.
export interface MediaEntry {
  ref: string;
  name: string;
  kind: MediaKind;
  size?: number;
  provider: MediaProvider;
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'];

function kindFromName(name: string): MediaKind {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return 'other';
}

function kindFromMime(mime: string, name: string): MediaKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return kindFromName(name);
}

function base64ToFile(base64: string, name: string, mimetype: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mimetype });
}

const thumbCache = new Map<string, string | null>();

export const mediaLibraryService = {
  async getStatus(provider: MediaProvider): Promise<boolean> {
    const status = provider === 'drive' ? await googleDriveService.getStatus() : await dropboxFilesService.getStatus();
    return status.connected;
  },

  // `location`: id da pasta no Drive ('' = raiz) ou caminho da pasta no Dropbox ('' = raiz).
  async list(provider: MediaProvider, location: string): Promise<MediaEntry[]> {
    if (provider === 'drive') {
      const { files } = await googleDriveService.listFiles(location || null);
      return files.map((f) => ({
        ref: f.id,
        name: f.name,
        kind: isDriveFolder(f) ? 'folder' : kindFromMime(f.mimeType, f.name),
        size: f.size ? Number(f.size) : undefined,
        provider,
      }));
    }
    const { entries } = await dropboxFilesService.listFolder(location);
    return entries.map((e) => ({
      ref: e.path_display,
      name: e.name,
      kind: isDropboxFolder(e) ? 'folder' : kindFromName(e.name),
      size: e.size,
      provider,
    }));
  },

  async createFolder(provider: MediaProvider, location: string, name: string): Promise<void> {
    if (provider === 'drive') await googleDriveService.createFolder(name, location || null);
    else await dropboxFilesService.createFolder(`${location}/${name}`);
  },

  async upload(provider: MediaProvider, location: string, file: File): Promise<void> {
    if (provider === 'drive') await googleDriveService.uploadFile(file, location || null);
    else await dropboxFilesService.uploadFile(file, location);
  },

  async remove(entry: MediaEntry): Promise<void> {
    if (entry.provider === 'drive') await googleDriveService.deleteFile(entry.ref);
    else await dropboxFilesService.deleteEntry(entry.ref);
  },

  // Baixa o arquivo como File — mesmo tipo que o <input type="file"> entrega,
  // então o resto do fluxo de criação de anúncio não muda.
  async download(entry: MediaEntry): Promise<File> {
    const data =
      entry.provider === 'drive'
        ? await googleDriveService.downloadFile(entry.ref)
        : await dropboxFilesService.downloadFile(entry.ref);
    return base64ToFile(data.base64, data.name || entry.name, data.mimetype || 'application/octet-stream');
  },

  async thumbnail(entry: MediaEntry): Promise<string | null> {
    const key = `${entry.provider}:${entry.ref}`;
    if (thumbCache.has(key)) return thumbCache.get(key) ?? null;
    try {
      const data =
        entry.provider === 'drive'
          ? await googleDriveService.getThumbnail(entry.ref)
          : await dropboxFilesService.getThumbnail(entry.ref);
      const url = `data:${data.mimetype};base64,${data.base64}`;
      thumbCache.set(key, url);
      return url;
    } catch {
      thumbCache.set(key, null);
      return null;
    }
  },
};
