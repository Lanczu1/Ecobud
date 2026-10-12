import { HttpError } from '../http/errorResponder';

export function parseLessonVideoCredits(body: Record<string, unknown>) {
  const fields = ['videoCreditsEnabled', 'videoCreditsName', 'videoCreditsUrl'];
  if (!fields.some(field => body[field] !== undefined)) return {};
  if (body.videoCreditsEnabled !== true && body.videoCreditsEnabled !== false && body.videoCreditsEnabled !== 'true' && body.videoCreditsEnabled !== 'false') {
    throw new HttpError(400, 'Choose whether video credits are enabled.');
  }
  const videoCreditsEnabled = body.videoCreditsEnabled === true || body.videoCreditsEnabled === 'true';
  if (!videoCreditsEnabled) {
    return { videoCreditsEnabled: false, videoCreditsName: null, videoCreditsUrl: null };
  }
  const videoCreditsName = typeof body.videoCreditsName === 'string' ? body.videoCreditsName.trim() : '';
  const videoCreditsUrl = typeof body.videoCreditsUrl === 'string' ? body.videoCreditsUrl.trim() : '';
  if (!videoCreditsName || videoCreditsName.length > 200) {
    throw new HttpError(400, 'Enter a credit name of up to 200 characters.');
  }
  let url: URL;
  try { url = new URL(videoCreditsUrl); } catch {
    throw new HttpError(400, 'Enter a valid YouTube link for video credits.');
  }
  const host = url.hostname.toLowerCase();
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || videoCreditsUrl.length > 2048 ||
      !(host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com'))) {
    throw new HttpError(400, 'Enter a valid YouTube link for video credits.');
  }
  url.protocol = 'https:';
  return { videoCreditsEnabled, videoCreditsName, videoCreditsUrl: url.toString() };
}
