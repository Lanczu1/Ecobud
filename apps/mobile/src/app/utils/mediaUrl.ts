import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { resolveMediaUrl } from './appUtils';

export function getValidImageUrl(url: string | null | undefined): string | undefined {
  return resolveMediaUrl(url, ecobudApiOrigin) || undefined;
}
