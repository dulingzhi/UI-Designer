/**
 * War3 Skins 配置解析器
 * 解析 war3skins.txt 文件，支持种族特定纹理
 */

export type Race = 'Human' | 'Orc' | 'NightElf' | 'Undead' | 'Default';

export interface SkinConfig {
  [key: string]: string;
}

export interface War3Skins {
  skins: Race[];
  Human: SkinConfig;
  Orc: SkinConfig;
  NightElf: SkinConfig;
  Undead: SkinConfig;
  Default: SkinConfig;
}

/**
 * 解析 war3skins.txt 文件
 */
export function parseWar3Skins(content: string): War3Skins {
  const result: War3Skins = {
    skins: [],
    Human: {},
    Orc: {},
    NightElf: {},
    Undead: {},
    Default: {},
  };

  const lines = content.split('\n');
  let currentSection: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }

    // 检测段落标题
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1);
      continue;
    }

    // 解析键值对
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim();

    if (currentSection === 'Main') {
      if (key === 'Skins') {
        result.skins = value.split(',').map(s => s.trim()) as Race[];
      }
    } else if (currentSection && ['Human', 'Orc', 'NightElf', 'Undead', 'Default'].includes(currentSection)) {
      result[currentSection as Race][key] = value;
    }
  }

  return result;
}

/**
 * 根据种族获取纹理路径
 * @param skins War3Skins配置
 * @param race 当前种族
 * @param key 纹理键名
 * @returns 纹理路径，如果种族特定纹理不存在则返回默认纹理
 */
export function getTextureForRace(skins: War3Skins, race: Race, key: string): string | undefined {
  // 优先使用种族特定纹理
  if (race !== 'Default' && skins[race][key]) {
    return skins[race][key];
  }

  // 回退到默认纹理
  return skins.Default[key];
}

/**
 * 根据纹理路径查找对应的键名
 * @param skins War3Skins配置
 * @param texturePath 纹理路径
 * @returns 找到的键名，如果没找到则返回undefined
 */
export function findTextureKey(skins: War3Skins, texturePath: string): string | undefined {
  if (!texturePath) return undefined;

  const normalizedPath = texturePath.toLowerCase().replace(/\\/g, '/');

  // 遍历所有种族和默认配置
  const allRaces: Race[] = ['Human', 'Orc', 'NightElf', 'Undead', 'Default'];
  for (const race of allRaces) {
    for (const [key, value] of Object.entries(skins[race])) {
      const normalizedValue = value.toLowerCase().replace(/\\/g, '/');
      if (normalizedValue === normalizedPath) {
        return key;
      }
    }
  }

  return undefined;
}

/**
 * 检查纹理是否是种族相关的
 * 通过检查是否在多个种族中有不同的定义
 */
export function isRaceSpecificTexture(skins: War3Skins, key: string): boolean {
  const races: Race[] = ['Human', 'Orc', 'NightElf', 'Undead'];
  const values = new Set<string>();

  for (const race of races) {
    const value = skins[race][key];
    if (value) {
      values.add(value);
    }
  }

  // 如果有多个不同的值，说明是种族特定的
  return values.size > 1;
}

/**
 * 获取所有种族特定的纹理键
 */
export function getRaceSpecificTextureKeys(skins: War3Skins): string[] {
  const keys = new Set<string>();

  // 收集所有键
  for (const race of ['Human', 'Orc', 'NightElf', 'Undead', 'Default'] as Race[]) {
    Object.keys(skins[race]).forEach(key => keys.add(key));
  }

  // 过滤出种族特定的键
  return Array.from(keys).filter(key => isRaceSpecificTexture(skins, key));
}

/**
 * 替换纹理路径中的种族标识
 * 用于处理像 "UI\Console\{Race}\{Race}UITile01" 这样的路径
 */
export function replaceRaceInPath(path: string, race: Race): string {
  if (!path) return path;

  const raceMap: Record<Race, string> = {
    Human: 'Human',
    Orc: 'Orc',
    NightElf: 'NightElf',
    Undead: 'Undead',
    Default: 'Human', // 默认使用人族
  };

  const raceName = raceMap[race];
  
  // 替换路径中的种族名称（大小写不敏感）
  return path
    .replace(/\{Race\}/gi, raceName)
    .replace(/\\Human\\/g, `\\${raceName}\\`)
    .replace(/\\Orc\\/g, `\\${raceName}\\`)
    .replace(/\\NightElf\\/g, `\\${raceName}\\`)
    .replace(/\\Undead\\/g, `\\${raceName}\\`);
}
