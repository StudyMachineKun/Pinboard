import type { Platform } from './types';

export const PLATFORM_URLS: Record<Platform, string> = {
  claude: 'https://claude.ai',
  chatgpt: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com',
};

export const BRAND_COLOR = '#6C5CE7';

export const DEFAULT_BOARD_COLORS = [
  '#6C5CE7', // purple (brand)
  '#0984E3', // blue
  '#00B894', // green
  '#FDCB6E', // yellow
  '#E17055', // orange
  '#D63031', // red
  '#E84393', // pink
  '#636E72', // gray
];

export const STORAGE_KEYS = {
  lastUsedBoardId: 'pinboard_last_used_board_id',
  onboardingDismissed: 'pinboard_onboarding_dismissed',
} as const;
