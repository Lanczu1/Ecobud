import * as FileSystem from 'expo-file-system/legacy';
import type { LessonWithProgress } from '../api/ecobudApi';
import { mobileStorage } from '../storage/mobileStorage';

// The whole lesson is cached except progress and status, which always come from the
// live lesson list, and quiz questions, which are left out because quizzes need the server.
export type DownloadedLessonContent = Omit<
  LessonWithProgress,
  'quizQuestions' | 'progress' | 'status' | 'videoTimestamp' | 'progressUpdatedAt'
>;

export interface LessonDownloadEntry {
  downloadedAt: number;
  videoFile: string | null;
  imageFile?: string | null;
}

export type LessonDownloadIndex = Record<string, LessonDownloadEntry>;

const INDEX_KEY_PREFIX = 'ecobud.mobile.lesson_downloads.';
const CONTENT_KEY_PREFIX = 'ecobud.mobile.lesson_download.';

const indexKey = (userId: string) => `${INDEX_KEY_PREFIX}${userId}`;
const contentKey = (userId: string, lessonId: string) => `${CONTENT_KEY_PREFIX}${userId}.${lessonId}`;

// Rebuilt on every read because iOS changes the absolute container path between app updates.
const mediaDirectory = (userId: string) =>
  FileSystem.documentDirectory ? `${FileSystem.documentDirectory}lesson-downloads/${userId}/` : null;

const fileExtension = (url: string, fallback: string) => {
  const match = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : fallback;
};

const parseIndex = (raw: string | null): LessonDownloadIndex => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as LessonDownloadIndex : {};
  } catch {
    return {};
  }
};

const writeIndex = async (userId: string, index: LessonDownloadIndex) => {
  const serialized = JSON.stringify(index);
  try { mobileStorage.setItemSync(indexKey(userId), serialized); } catch {}
  await mobileStorage.setItem(indexKey(userId), serialized);
};

export const lessonDownloads = {
  async readIndex(userId: string): Promise<LessonDownloadIndex> {
    return parseIndex(await mobileStorage.getItem(indexKey(userId)));
  },

  async readContent(userId: string, lessonId: string): Promise<DownloadedLessonContent | null> {
    try {
      const raw = await mobileStorage.getItem(contentKey(userId, lessonId));
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.id === lessonId ? parsed as DownloadedLessonContent : null;
    } catch {
      return null;
    }
  },

  async readAllContents(userId: string): Promise<DownloadedLessonContent[]> {
    const lessonIds = Object.keys(await this.readIndex(userId));
    const contents = await Promise.all(lessonIds.map((lessonId) => this.readContent(userId, lessonId)));
    return contents.filter((content): content is DownloadedLessonContent => content !== null);
  },

  videoUri(userId: string, entry: LessonDownloadEntry | undefined): string | null {
    const directory = mediaDirectory(userId);
    return directory && entry?.videoFile ? `${directory}${entry.videoFile}` : null;
  },

  imageUri(userId: string, entry: LessonDownloadEntry | undefined): string | null {
    const directory = mediaDirectory(userId);
    return directory && entry?.imageFile ? `${directory}${entry.imageFile}` : null;
  },

  async save(
    userId: string,
    lesson: LessonWithProgress,
    remoteVideoUrl: string | null,
    remoteImageUrl: string | null,
    onProgress?: (percent: number) => void,
  ): Promise<LessonDownloadEntry> {
    const directory = mediaDirectory(userId);
    let videoFile: string | null = null;
    let imageFile: string | null = null;

    if (directory) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

    if (remoteImageUrl && directory) {
      // The cover is optional, so a failed image never blocks the lesson download.
      try {
        const coverFile = `${lesson.id}-cover.${fileExtension(remoteImageUrl, 'jpg')}`;
        const result = await FileSystem.downloadAsync(remoteImageUrl, `${directory}${coverFile}`);
        if (result.status >= 200 && result.status < 300) imageFile = coverFile;
      } catch {}
    }

    if (remoteVideoUrl && directory) {
      videoFile = `${lesson.id}.${fileExtension(remoteVideoUrl, 'mp4')}`;
      const partialUri = `${directory}${videoFile}.part`;
      await FileSystem.deleteAsync(partialUri, { idempotent: true });

      const download = FileSystem.createDownloadResumable(remoteVideoUrl, partialUri, {}, (progress) => {
        if (progress.totalBytesExpectedToWrite > 0) {
          onProgress?.(Math.min(99, Math.floor((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100)));
        }
      });
      const result = await download.downloadAsync();

      if (!result || result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(partialUri, { idempotent: true });
        throw new Error('The lesson video could not be downloaded.');
      }

      // Written under a temporary name so an interrupted download never looks complete.
      await FileSystem.deleteAsync(`${directory}${videoFile}`, { idempotent: true });
      await FileSystem.moveAsync({ from: partialUri, to: `${directory}${videoFile}` });
    }

    const { quizQuestions, progress: _progress, status: _status, videoTimestamp: _videoTimestamp, progressUpdatedAt: _progressUpdatedAt, ...lessonContent } = lesson;
    const content: DownloadedLessonContent = {
      ...lessonContent,
      pages: lesson.pages ?? [],
      hasQuiz: Boolean(lesson.hasQuiz || quizQuestions?.length),
    };
    await mobileStorage.setItem(contentKey(userId, lesson.id), JSON.stringify(content));

    const entry: LessonDownloadEntry = { downloadedAt: Date.now(), videoFile, imageFile };
    await writeIndex(userId, { ...(await this.readIndex(userId)), [lesson.id]: entry });
    onProgress?.(100);
    return entry;
  },

  async remove(userId: string, lessonId: string): Promise<void> {
    const index = await this.readIndex(userId);
    for (const uri of [this.videoUri(userId, index[lessonId]), this.imageUri(userId, index[lessonId])]) {
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    await mobileStorage.removeItem(contentKey(userId, lessonId));
    const { [lessonId]: _removed, ...rest } = index;
    await writeIndex(userId, rest);
  },
};
