/**
 * Match confidence computation (Requirement 3.1).
 *
 * Signals priority:
 * - ISRC match → base 0.95, +0.05 if title+artist also match → ≥0.9
 * - Without ISRC: 0.45·title + 0.30·artist + 0.15·duration + 0.10·album
 *
 * String similarity: Jaro-Winkler for title/album, Jaccard for artists.
 * Duration similarity: threshold ±3 seconds.
 */

import { normalizeTitle, normalizeArtist } from './normalize';

export interface MatchSignals {
  isrcMatch: boolean;
  titleSimilarity: number;
  artistSimilarity: number;
  durationSimilarity: number;
  albumSimilarity: number;
}

export interface ConfidenceResult {
  confidence: number;
  signals: MatchSignals;
}

interface TrackForMatch {
  title: string;
  artists: string[];
  album?: string;
  durationMs: number;
  isrc?: string | null;
}

/**
 * Compute Match_Confidence between two tracks.
 */
export function computeConfidence(a: TrackForMatch, b: TrackForMatch): ConfidenceResult {
  const titleA = normalizeTitle(a.title);
  const titleB = normalizeTitle(b.title);
  const artistsA = a.artists.map(normalizeArtist);
  const artistsB = b.artists.map(normalizeArtist);
  const albumA = a.album ? normalizeTitle(a.album) : '';
  const albumB = b.album ? normalizeTitle(b.album) : '';

  const titleSimilarity = jaroWinkler(titleA, titleB);
  const artistSimilarity = jaccardSimilarity(artistsA, artistsB);
  const durationSimilarity = durationSim(a.durationMs, b.durationMs);
  const albumSimilarity = albumA && albumB ? jaroWinkler(albumA, albumB) : 0;
  const isrcMatch = !!(a.isrc && b.isrc && a.isrc === b.isrc);

  let confidence: number;

  if (isrcMatch) {
    // ISRC path: base 0.95, +0.05 if title+artist confirm
    const titleArtistConfirm = titleSimilarity >= 0.8 && artistSimilarity >= 0.5;
    confidence = titleArtistConfirm ? 1.0 : 0.95;
  } else {
    // Weighted combination without ISRC
    confidence =
      0.45 * titleSimilarity +
      0.30 * artistSimilarity +
      0.15 * durationSimilarity +
      0.10 * albumSimilarity;
  }

  // Clamp to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    confidence,
    signals: { isrcMatch, titleSimilarity, artistSimilarity, durationSimilarity, albumSimilarity },
  };
}

// ─── Similarity Functions ────────────────────────────────────────────────────

/**
 * Jaro-Winkler string similarity (0..1).
 */
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;

  const matchDistance = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler bonus for common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Jaccard similarity for artist arrays.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;

  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;

  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Duration similarity with ±3 second tolerance.
 * Returns 1.0 if within 3 seconds, decays linearly to 0 at 10 seconds difference.
 */
function durationSim(ms1: number, ms2: number): number {
  if (ms1 === 0 || ms2 === 0) return 0.5; // Unknown duration — neutral
  const diffMs = Math.abs(ms1 - ms2);
  const thresholdMs = 3000;
  const maxDiffMs = 10000;

  if (diffMs <= thresholdMs) return 1.0;
  if (diffMs >= maxDiffMs) return 0.0;
  return 1.0 - (diffMs - thresholdMs) / (maxDiffMs - thresholdMs);
}
