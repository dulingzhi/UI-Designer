import { describe, it, expect } from 'vitest';
import {
  parseWar3Skins,
  getTextureForRace,
  findTextureKey,
  isRaceSpecificTexture,
  getRaceSpecificTextureKeys,
  replaceRaceInPath,
} from './war3SkinsParser';

describe('parseWar3Skins', () => {
  it('parses sections, Skins list and race key-values, skipping comments/blanks', () => {
    const content = [
      '// comment line',
      '',
      '[Main]',
      'Skins = Human, Orc,  NightElf ',
      '[Human]',
      'HumanUITile = UI\\Human\\Tile.blp',
      '[Default]',
      'DefaultTile = UI\\Default\\Tile.blp',
      '[UnknownSection]',
      'IgnoredKey = x',
    ].join('\n');

    const result = parseWar3Skins(content);
    expect(result.skins).toEqual(['Human', 'Orc', 'NightElf']);
    expect(result.Human['HumanUITile']).toBe('UI\\Human\\Tile.blp');
    expect(result.Default['DefaultTile']).toBe('UI\\Default\\Tile.blp');
  });

  it('initialize all default sections empty', () => {
    const result = parseWar3Skins('');
    expect(result.skins).toEqual([]);
    expect(result.Human).toEqual({});
    expect(result.Orc).toEqual({});
    expect(result.NightElf).toEqual({});
    expect(result.Undead).toEqual({});
    expect(result.Default).toEqual({});
  });

  it('skips lines without an equals sign that are not sections', () => {
    const result = parseWar3Skins('\ngarbage line without equals\n[Main]\nSkins=Human');
    expect(result.skins).toEqual(['Human']);
  });

  it('parses line values with surrounding whitespace trimmed', () => {
    const result = parseWar3Skins('[Orc]\n  Peon =  UI\\Orc\\Peon.blp  ');
    expect(result.Orc['Peon']).toBe('UI\\Orc\\Peon.blp');
  });

  it('ignores non-Skins keys in Main section', () => {
    const result = parseWar3Skins('[Main]\nOtherKey = notskins\nSkins=Human');
    expect(result.skins).toEqual(['Human']);
    expect((result as Record<string, unknown>)['OtherKey']).toBeUndefined();
  });
});

describe('getTextureForRace', () => {
  const skins = {
    skins: [] as string[],
    Human: { key: 'H.blp' },
    Orc: {},
    NightElf: {},
    Undead: {},
    Default: { key: 'D.blp' },
  };

  it('returns race-specific texture when present', () => {
    expect(getTextureForRace(skins, 'Human', 'key')).toBe('H.blp');
  });

  it('falls back to Default when race has no value', () => {
    expect(getTextureForRace(skins, 'Orc', 'key')).toBe('D.blp');
  });

  it('returns Default directly', () => {
    expect(getTextureForRace(skins, 'Default', 'key')).toBe('D.blp');
  });

  it('returns undefined when neither race nor default has key', () => {
    const s = { ...skins, Orc: {} } as typeof skins;
    expect(getTextureForRace(s, 'Orc', 'missing')).toBeUndefined();
  });
});

describe('findTextureKey', () => {
  const skins = {
    skins: [] as string[],
    Human: { HumanTile: 'UI\\HUMAN\\Tile.blp' },
    Orc: {},
    NightElf: {},
    Undead: {},
    Default: { DefaultTile: 'UI/Default/Tile.blp' },
  };

  it('returns undefined for empty path', () => {
    expect(findTextureKey(skins, '')).toBeUndefined();
  });

  it('matches case-insensitively and normalizes separators', () => {
    expect(findTextureKey(skins, 'UI/human/TILE.blp')).toBe('HumanTile');
    expect(findTextureKey(skins, 'UI/Default/tile.BLP')).toBe('DefaultTile');
  });

  it('returns undefined when nothing matches', () => {
    expect(findTextureKey(skins, 'nonexistent')).toBeUndefined();
  });
});

describe('isRaceSpecificTexture', () => {
  const base = {
    skins: [] as string[],
    Human: {} as Record<string, string>,
    Orc: {} as Record<string, string>,
    NightElf: {} as Record<string, string>,
    Undead: {} as Record<string, string>,
    Default: {} as Record<string, string>,
  };

  it('returns true when races define different values', () => {
    const s = { ...base, Human: { k: 'A' }, Orc: { k: 'B' } } as typeof base;
    expect(isRaceSpecificTexture(s, 'k')).toBe(true);
  });

  it('returns false when all defined races share the same value', () => {
    const s = { ...base, Human: { k: 'A' }, Orc: { k: 'A' } } as typeof base;
    expect(isRaceSpecificTexture(s, 'k')).toBe(false);
  });

  it('returns false when no race defines the key', () => {
    expect(isRaceSpecificTexture(base, 'k')).toBe(false);
  });
});

describe('getRaceSpecificTextureKeys', () => {
  it('collects keys across races and filters to race-specific ones', () => {
    // A key is "race-specific" only when at least two races define DIFFERENT values.
    const skins = {
      skins: [] as string[],
      Human: { shared: 'S', skin: 'H' },
      Orc: { shared: 'S', skin: 'O' },
      NightElf: { shared: 'S' },
      Undead: { shared: 'S' },
      Default: { shared: 'S' },
    };
    expect(getRaceSpecificTextureKeys(skins)).toEqual(['skin']);
  });

  it('returns empty when all races agree', () => {
    const skins = {
      skins: [] as string[],
      Human: { shared: 'S' },
      Orc: { shared: 'S' },
      NightElf: { shared: 'S' },
      Undead: { shared: 'S' },
      Default: { shared: 'S' },
    };
    expect(getRaceSpecificTextureKeys(skins)).toEqual([]);
  });
});

describe('replaceRaceInPath', () => {
  it('replaces {Race} token', () => {
    // {Race} and the \Human\ segment are replaced independently.
    expect(replaceRaceInPath('UI\\Console\\{Race}UITile01', 'Orc')).toBe('UI\\Console\\OrcUITile01');
  });

  it('replaces \\Human\\ directory segment', () => {
    expect(replaceRaceInPath('UI\\Human\\foo\\x.blp', 'Undead')).toBe('UI\\Undead\\foo\\x.blp');
    expect(replaceRaceInPath('UI\\human\\foo.blp', 'NightElf')).toBe('UI\\human\\foo.blp'); // case-sensitive: lowercase untouched
  });

  it('replaces \\Orc\\, \\NightElf\\ and \\Undead\\ segments', () => {
    expect(replaceRaceInPath('UI\\Orc\\a.blp', 'Human')).toBe('UI\\Human\\a.blp');
    expect(replaceRaceInPath('UI\\NightElf\\a.blp', 'Human')).toBe('UI\\Human\\a.blp');
    expect(replaceRaceInPath('UI\\Undead\\a.blp', 'Human')).toBe('UI\\Human\\a.blp');
  });

  it('maps Default race to Human', () => {
    expect(replaceRaceInPath('UI\\Orc\\{Race}\\x.blp', 'Default')).toBe('UI\\Human\\Human\\x.blp');
    expect(replaceRaceInPath('UI\\{Race}\\x.blp', 'Orc')).toBe('UI\\Orc\\x.blp');
  });

  it('returns empty path unchanged', () => {
    expect(replaceRaceInPath('', 'Human')).toBe('');
  });
});

describe('unquote 语义（openwar3 仲裁：1.27 值常带成对引号）', () => {
  it('剥离成对包裹引号（CampaignButtonHighlight="UI\\..." 形式）', () => {
    const skins = parseWar3Skins('[Default]\nCampaignButtonHighlight="UI\\Widgets\\x.blp"\n');
    expect(skins.Default['CampaignButtonHighlight']).toBe('UI\\Widgets\\x.blp');
  });

  it('不成对的引号保留（值本身以引号开头的音乐列表等）', () => {
    const skins = parseWar3Skins('[Default]\nKey="a;b\n');
    expect(skins.Default['Key']).toBe('"a;b');
  });
});