/**
 * Track title/artist/album normalization for matching.
 * Requirements: 3.1 — NFD diacritics removal, lowercase, bracket removal,
 * feat unification, Unicode punctuation removal, whitespace collapse.
 */

interface NormalizeResult {
  normalized: string;
  extractedFlags: {
    isLive: boolean;
    explicit: boolean;
    acoustic: boolean;
  };
}

// Pattern for bracket content: (Remastered), [Live], (Deluxe Edition), etc.
const BRACKET_PATTERN = /[\(\[][^\)\]]*[\)\]]/g;

// Flags extracted from bracket content
const LIVE_PATTERN = /\b(live|concert|вживую)\b/i;
const EXPLICIT_PATTERN = /\b(explicit)\b/i;
const ACOUSTIC_PATTERN = /\b(acoustic|акустик)/i;
const CLEAN_PATTERN = /\b(clean)\b/i;

// Feat variations → unified "feat"
const FEAT_PATTERN = /\b(feat\.|ft\.|featuring|feat)\b/gi;

// Unicode punctuation (general category P)
const PUNCTUATION_PATTERN = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g;

/**
 * Normalize a text string for track matching.
 * Idempotent: normalize(normalize(s)) === normalize(s)
 */
export function normalize(input: string): NormalizeResult {
  let text = input;

  // Extract flags from bracket content before removing
  const brackets = text.match(BRACKET_PATTERN) ?? [];
  const bracketContent = brackets.join(' ');

  const isLive = LIVE_PATTERN.test(bracketContent);
  const explicit = EXPLICIT_PATTERN.test(bracketContent);
  const acoustic = ACOUSTIC_PATTERN.test(bracketContent);

  // Remove bracket content
  text = text.replace(BRACKET_PATTERN, '');

  // NFD normalization → remove combining diacritics
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Lowercase
  text = text.toLowerCase();

  // Unify feat variations
  text = text.replace(FEAT_PATTERN, 'feat');

  // Remove punctuation
  text = text.replace(PUNCTUATION_PATTERN, ' ');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return {
    normalized: text,
    extractedFlags: { isLive, explicit, acoustic },
  };
}

/**
 * Normalize a title string only (returns just the string).
 */
export function normalizeTitle(title: string): string {
  return normalize(title).normalized;
}

/**
 * Normalize an artist name.
 */
export function normalizeArtist(artist: string): string {
  return normalize(artist).normalized;
}

/**
 * Extract variant flags from a title to check Live/Explicit/Acoustic.
 * Used by the Live/Explicit guard (Req 3.7).
 */
export function extractFlags(title: string): { isLive: boolean; explicit: boolean; acoustic: boolean } {
  return normalize(title).extractedFlags;
}
