import { describe, expect, it } from 'vitest';
import { resolveFontPath } from '../../src/renderer/fontResolver';
import type { War3Skins } from '../../src/utils/war3SkinsParser';

const skins: War3Skins = {
  skins: ['Human'],
  Human: {
    MasterFont: 'Fonts\\dfst-m3u.ttf',
    InfoPanelTextFont: 'Fonts\\frizqt__.ttf',
  },
  Orc: {},
  NightElf: {},
  Undead: {},
  Default: {
    MasterFont: 'Fonts\\default.ttf',
    EscMenuTextFont: 'Fonts\\esc.ttf',
  },
};

describe('fontResolver', () => {
  it('resolves race-specific logical font names via war3Skins', () => {
    expect(resolveFontPath('MasterFont', 'D:\\P\\target', skins, 'Human')).toBe(
      'D:\\P\\target\\vendor\\Fonts\\dfst-m3u.ttf',
    );
  });

  it('falls back to Default section when current race lacks the font key', () => {
    expect(resolveFontPath('EscMenuTextFont', 'D:\\P', skins, 'Human')).toBe(
      'D:\\P\\target\\vendor\\Fonts\\esc.ttf',
    );
  });

  it('passes through direct relative font paths into vendor path', () => {
    expect(resolveFontPath('Fonts\\abc.ttf', 'D:\\P\\target', skins, 'Human')).toBe(
      'D:\\P\\target\\vendor\\Fonts\\abc.ttf',
    );
  });

  it('without projectDir returns normalized relative path', () => {
    expect(resolveFontPath('MasterFont', undefined, skins, 'Human')).toBe('Fonts\\dfst-m3u.ttf');
  });

  it('returns undefined for unknown logical font names', () => {
    expect(resolveFontPath('UnknownFont', 'D:\\P', skins, 'Human')).toBeUndefined();
  });
});