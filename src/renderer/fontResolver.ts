import { convertFileSrc } from '@tauri-apps/api/core';
import type { Race, War3Skins } from '../utils/war3SkinsParser';

type FontRace = Race | undefined;

interface FontResolverContext {
  projectDir?: string;
  war3Skins?: War3Skins | null;
  race?: FontRace;
}

const loadedFontFamilies = new Map<string, string>();
const loadingFonts = new Map<string, Promise<string | undefined>>();
let resolverContext: FontResolverContext = {};

function normalizeSlashes(path: string): string {
  return path.replace(/\//g, '\\');
}

function buildVendorPath(projectDir: string, relative: string): string {
  const normalizedDir = projectDir.replace(/[\\/]+$/, '');
  const relForFs = relative.replace(/\//g, '\\');
  const inProjectVendor = `${normalizedDir}\\vendor\\${relForFs}`;
  const inTargetVendor = `${normalizedDir}\\target\\vendor\\${relForFs}`;
  return /[\\/]target$/i.test(normalizedDir) ? inProjectVendor : inTargetVendor;
}

export function setFontResolverContext(context: FontResolverContext): void {
  resolverContext = context;
}

export function getResolvedFontFamily(fontName: string | undefined): string | undefined {
  if (!fontName) return undefined;
  return loadedFontFamilies.get(fontName) ?? fontName;
}

export function resolveFontPath(
  fontName: string | undefined,
  projectDir?: string,
  war3Skins?: War3Skins | null,
  race?: FontRace,
): string | undefined {
  if (!fontName) return undefined;

  if (fontName.includes('\\') || fontName.includes('/')) {
    if (!projectDir) return normalizeSlashes(fontName);
    return buildVendorPath(projectDir, normalizeSlashes(fontName));
  }

  if (!war3Skins) return undefined;

  const selectedRace = race && race !== 'Default' ? race : 'Human';
  const raceConfig = selectedRace ? war3Skins[selectedRace] : undefined;
  const relative = raceConfig?.[fontName] ?? war3Skins.Default[fontName];
  if (!relative) return undefined;
  if (!projectDir) return normalizeSlashes(relative);
  return buildVendorPath(projectDir, normalizeSlashes(relative));
}

function buildCssFamily(fontName: string, fontPath: string): string {
  const safePath = fontPath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `wc3-${fontName}-${safePath}`;
}

export async function ensureWar3FontLoaded(fontName: string | undefined): Promise<string | undefined> {
  if (!fontName) return undefined;
  const cached = loadedFontFamilies.get(fontName);
  if (cached) return cached;

  const fontPath = resolveFontPath(fontName, resolverContext.projectDir, resolverContext.war3Skins, resolverContext.race);
  if (!fontPath) return undefined;

  const loadKey = `${fontName}@@${fontPath}`;
  const inFlight = loadingFonts.get(loadKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const family = buildCssFamily(fontName, fontPath);
      const source = `url(${convertFileSrc(fontPath)})`;
      const face = new FontFace(family, source, { display: 'swap' });
      await face.load();
      document.fonts.add(face);
      loadedFontFamilies.set(fontName, family);
      return family;
    } catch (error) {
      console.warn('[fontResolver] Failed to load font:', fontName, fontPath, error);
      return undefined;
    } finally {
      loadingFonts.delete(loadKey);
    }
  })();

  loadingFonts.set(loadKey, promise);
  return promise;
}
