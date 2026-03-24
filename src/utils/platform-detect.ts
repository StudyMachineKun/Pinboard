import type { Platform } from '../shared/types';
import { PLATFORM_URLS } from '../shared/constants';

export function detectPlatform(): Platform | null {
  const url = window.location.origin;
  for (const [platform, baseUrl] of Object.entries(PLATFORM_URLS)) {
    if (url.startsWith(baseUrl)) {
      return platform as Platform;
    }
  }
  return null;
}
