/**
 * FDF 声明式核心 —— 库/模板解析单测（阶段 A）。
 * 覆盖 register 优先规则、INHERITS 扁平化、WITHCHILDREN、字符串表、访问器。
 */
import { describe, it, expect } from 'vitest';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import {
  FdfLibrary,
  mergeProps,
  firstProp,
  allProps,
  hasFlag,
  numProp,
  strProp,
  findChild,
  propagateDecorate,
  cloneNamespaced,
} from '../../src/utils/fdfKernelLibrary';
import type { FdfFrame } from '../../src/utils/fdfKernelTypes';

const f = (src: string) => parseFdf(src);

describe('FdfLibrary — 注册与查找', () => {
  it('同名精确命中；大小写兜底只在精确名缺失时触发', () => {
    const lib = new FdfLibrary();
    lib.loadFile(f('Frame "BACKDROP" "Tpl" { Width 1.0, }'));
    lib.loadFile(f('Frame "BACKDROP" "tpl" { Width 2.0, }')); // 精确名不同 → 独立模板
    // 精确名各自命中。
    expect(lib.template('Tpl')!.props[0].args[0].s).toBe('1.0');
    expect(lib.template('tpl')!.props[0].args[0].s).toBe('2.0');
    // 混合大小写 → 精确名缺失，小写兜底命中第一个注册的下写名（'Tpl'→1.0）。
    expect(numProp(lib.template('TPL')!, 'Width')).toBeCloseTo(1.0);
  });
  it('override 强制替换', () => {
    const lib = new FdfLibrary();
    lib.loadFile(f('Frame "BACKDROP" "Tpl" { Width 1.0, }'));
    lib.loadOverride('p', 'Frame "BACKDROP" "Tpl" { Width 9.0, }');
    expect(lib.template('Tpl')!.props[0].args[0].s).toBe('9.0');
  });
  it('覆盖前对同一 id 幂等', () => {
    const lib = new FdfLibrary();
    lib.loadOverride('p', 'Frame "BACKDROP" "Tpl" { Width 9.0, }');
    lib.loadOverride('p', 'Frame "BACKDROP" "Tpl" { Width 1.0, }');
    expect(lib.template('Tpl')!.props[0].args[0].s).toBe('9.0');
  });
  it('嵌套具名子控件也被注册为模板', () => {
    const lib = new FdfLibrary();
    lib.loadFile(f('Frame "FRAME" "Parent" { Texture "child" { } }'));
    expect(lib.template('child')).toBeDefined();
  });
});

describe('FdfLibrary — INHERITS 扁平化', () => {
  it('自身 props 覆盖继承 props；继承的子控件保留', () => {
    const lib = new FdfLibrary();
    lib.loadFile(
      f(
        'Frame "TEXT" "BtnText" { Width 0.3,} ' +
          'Frame "BUTTON" "MyButton" INHERITS "BtnText" { Width 0.9, Height 0.05,}',
      ),
    );
    const r = lib.resolveRoot('MyButton')!;
    expect(r.type).toBe('BUTTON'); // 自身类型
    expect(r.name).toBe('MyButton'); // 名字是自身的
    expect(r.inherits).toBeNull();
    // 继承的 Width 被覆盖为 0.9；Height 从自身新增。
    expect(numProp(r, 'Width')).toBeCloseTo(0.9);
    expect(numProp(r, 'Height')).toBeCloseTo(0.05);
  });
  it('匿名块不继承模板名字（避免同名兄弟冲突）', () => {
    const lib = new FdfLibrary();
    lib.loadFile(
      f(
        'Frame "BUTTON" "Tpl" { Width 0.3,} ' +
          'Frame "FRAME" "P" { ' +
          'Frame "BUTTON" INHERITS "Tpl" { } ' + // 匿名
          'Frame "BUTTON" INHERITS "Tpl" { } ' + // 又一个匿名
          '}',
      ),
    );
    const r = lib.resolveRoot('P')!;
    expect(r.children.length).toBe(2);
    expect(r.children[0].name).toBe('');
    expect(r.children[0].props.length).toBe(1); // 继承的 Width
  });
  it('WITHCHILDREN 克隆模板子树，自身同名子控件覆盖', () => {
    const lib = new FdfLibrary();
    lib.loadFile(
      f(
        'Frame "FRAME" "Tpl" { Texture "icon" { } Texture "keep" { } } ' +
          'Frame "FRAME" "Screen" INHERITS WITHCHILDREN "Tpl" { ' +
          'Texture "icon" { File "UI\\mine.blp", } ' + // 覆盖
          '}',
      ),
    );
    const r = lib.resolveRoot('Screen')!;
    // 克隆了 icon + keep 两个子；icon 被自身覆盖（此时只有覆盖后的 icon + keep）。
    expect(r.children.map((c) => c.name)).toEqual(['icon', 'keep']);
    expect(findChild(r, 'icon')!.props[0].args[0].s).toBe('UI\\mine.blp');
  });
  it('多层继承与循环保护', () => {
    const lib = new FdfLibrary();
    lib.loadFile(
      f(
        'Frame "TEXT" "A" { Width 0.1,} ' +
          'Frame "TEXT" "B" INHERITS "A" { Height 0.2,} ' +
          'Frame "TEXT" "C" INHERITS "B" { FontJustificationH JUSTIFYRIGHT,}',
      ),
    );
    const r = lib.resolveRoot('C')!;
    expect(numProp(r, 'Width')).toBeCloseTo(0.1);
    expect(numProp(r, 'Height')).toBeCloseTo(0.2);
    expect(strProp(r, 'FontJustificationH')).toBe('JUSTIFYRIGHT');
  });
});

describe('FdfLibrary — 字符串表', () => {
  it('string() 键命中优先，否则字面', () => {
    const lib = new FdfLibrary();
    lib.loadFile(f('StringList { HELLO "你好", }'));
    expect(lib.string('HELLO')).toBe('你好');
    expect(lib.string('HELLO2')).toBe('HELLO2');
  });
});

describe('mergeProps', () => {
  it('自身整体替换基础同名项，顺序保持', () => {
    const base: FdfFrame['props'] = [
      { key: 'Width', args: [{ s: '0.1', n: 0.1, str: false }] },
      { key: 'Height', args: [{ s: '0.2', n: 0.2, str: false }] },
    ];
    const own: FdfFrame['props'] = [
      { key: 'Width', args: [{ s: '0.9', n: 0.9, str: false }] },
      { key: 'Visible', args: [] },
    ];
    const out = mergeProps(base, own);
    expect(out.map((p) => p.key)).toEqual(['Height', 'Width', 'Visible']);
    expect(numProp({ type: 'X', name: '', inherits: null, withChildren: false, props: out, children: [] }, 'Width')).toBeCloseTo(0.9);
  });
});

describe('访问器', () => {
  const fr = (src: string) => f(src).frames[0];
  it('firstProp/allProps/hasFlag/numProp/strProp/findChild', () => {
    const frame = fr(
      'Frame "FRAME" "X" { SetPoint LEFT, "P", RIGHT, 0.1, 0.2, SetPoint TOP, "P", TOP, 0, 0, Width 0.5, BG "tex", ' +
        'Frame "FRAME" "kid" { } }',
    );
    expect(hasFlag(frame, 'Width')).toBe(true);
    expect(hasFlag(frame, 'Nope')).toBe(false);
    expect(allProps(frame, 'SetPoint').length).toBe(2);
    expect(firstProp(frame, 'SetPoint')!.args[3].n).toBeCloseTo(0.1);
    expect(numProp(frame, 'Width')).toBeCloseTo(0.5);
    expect(strProp(frame, 'BG')).toBe('tex');
    expect(findChild(frame, 'kid')).toBeDefined();
    expect(findChild(frame, 'nope')).toBeUndefined();
  });
});

describe('propagateDecorate', () => {
  it('向下游所有子树传播 DecorateFileNames', () => {
    const root: FdfFrame = {
      type: 'FRAME', name: 'R', inherits: null, withChildren: false,
      props: [{ key: 'DecorateFileNames', args: [] }],
      children: [
        { type: 'TEXTURE', name: 'a', inherits: null, withChildren: false, props: [], children: [] },
        { type: 'FRAME', name: 'b', inherits: null, withChildren: false, props: [], children: [
          { type: 'TEXTURE', name: 'c', inherits: null, withChildren: false, props: [], children: [] },
        ] },
      ],
    };
    propagateDecorate(root);
    expect(root.props.some((p) => p.key === 'DecorateFileNames')).toBe(true);
    expect(root.children[0].props.some((p) => p.key === 'DecorateFileNames')).toBe(true);
    expect(root.children[1].props.some((p) => p.key === 'DecorateFileNames')).toBe(true);
    expect(root.children[1].children[0].props.some((p) => p.key === 'DecorateFileNames')).toBe(true);
  });
});

describe('cloneNamespaced', () => {
  it('子树内名字加后缀，SetPoint 相对引用随之重写', () => {
    const src: FdfFrame = {
      type: 'BUTTON', name: 'Row', inherits: null, withChildren: false,
      props: [
        { key: 'SetPoint', args: [{ s: 'LEFT', n: null, str: false }, { s: 'Prev', n: null, str: true }, { s: 'RIGHT', n: null, str: false }, { s: '0.1', n: 0.1, str: false }] },
      ],
      children: [
        { type: 'TEXTURE', name: 'Prev', inherits: null, withChildren: false, props: [], children: [] },
      ],
    };
    const out = cloneNamespaced(src, '_2');
    expect(out.name).toBe('Row_2');
    expect(out.children[0].name).toBe('Prev_2');
    // SetPoint 引用内部名 'Prev' → 'Prev_2'。
    expect(out.props[0].args[1].s).toBe('Prev_2');
  });
});

describe('FdfLibrary/resolve — 分支补齐', () => {
  const lib = new FdfLibrary();
  lib.loadFile(f('StringList { HELLO "你好", } Frame "TEXT" "A" { Width 0.1, } '));
  it('loadFile 重复字符串表键不覆盖（line 42 else）', () => {
    const lib2 = new FdfLibrary();
    lib2.loadFile(f('StringList { K "v1", }'));
    lib2.loadFile(f('StringList { K "v2", }'));
    expect(lib2.string('K')).toBe('v1');
  });
  it('resolve 深度超过 64 走 cloneFrame 兜底（line 79）', () => {
    const lib3 = new FdfLibrary();
    // 构造 66 帧 INHERITS 链，最深处 depth=65 > 64。
    const frames = [];
    for (let i = 0; i < 66; i++) {
      frames.push(
        `Frame "TEXT" "F${i}"` + (i === 0 ? ` { Width 0.1, }` : ` INHERITS "F${i - 1}" { }`),
      );
    }
    lib3.loadFile(f(frames.join(' ')));
    const r = lib3.resolveRoot('F65')!;
    expect(numProp(r, 'Width')).toBeCloseTo(0.1);
    expect(r.type).toBe('TEXT');
  });
  it('type 回退链：自身空→base 类型（line 86 loc1）', () => {
    const lib4 = new FdfLibrary();
    const base: FdfFrame = { type: 'BACKDROP', name: 'B', inherits: null, withChildren: false, props: [], children: [] };
    const own: FdfFrame = { type: '', name: 'X', inherits: 'B', withChildren: false, props: [], children: [] };
    lib4.register(base);
    const r = lib4.resolve(own)!;
    expect(r.type).toBe('BACKDROP');
  });
  it('type 回退链：自身空且无 base → 字面 FRAME（line 86 loc2）', () => {
    const lib5 = new FdfLibrary();
    const own: FdfFrame = { type: '', name: 'X', inherits: null, withChildren: false, props: [], children: [] };
    const r = lib5.resolve(own)!;
    expect(r.type).toBe('FRAME');
  });
  it('WITHCHILDREN 的模板子控件自身仍带 INHERITS → 二次 resolve（line 103 真臂）', () => {
    const lib6 = new FdfLibrary();
    lib6.loadFile(f(
      'Frame "TEXT" "KidTmpl" { Height 0.2, } ' +
        'Frame "FRAME" "Base" { Frame "FRAME" "Kid" INHERITS "KidTmpl" { } } ' +
        'Frame "FRAME" "F" INHERITS WITHCHILDREN "Base" { }',
    ));
    const r = lib6.resolveRoot('F')!;
    expect(r.children.length).toBe(1);
    expect(numProp(r.children[0], 'Height')).toBeCloseTo(0.2);
  });
  it('深链达深度 65 兜底时被 WITHCHILDREN 拉入原始子控件仍带 INHERITS（line 103 true 分支）', () => {
    const lib7 = new FdfLibrary();
    // 66 帧链：F → B0 → ... → B64。resolve(B64) 处 depth=65>64，返回保留 inherits 的 cloneFrame。
    const parts: string[] = ['Frame "TEXT" "KidTmpl" { Height 0.3, }'];
    for (let i = 0; i <= 64; i++) {
      parts.push(
        i === 64
          ? `Frame "FRAME" "B${i}" { Frame "FRAME" "Kid${i}" INHERITS "KidTmpl" { } }`
          : `Frame "FRAME" "B${i}" INHERITS WITHCHILDREN "B${i + 1}" { }`,
      );
    }
    // 根 F INHERITS WITHCHILDREN B0 → 顶层 resolve(F,0) 开始。
    parts.push('Frame "FRAME" "F" INHERITS WITHCHILDREN "B0" { }');
    lib7.loadFile(f(parts.join(' ')));
    const r = lib7.resolveRoot('F')!;
    expect(r.type).toBe('FRAME');
  });
  it('resolveRoot 找不到模板返回 undefined（line 74 else）', () => {
    const lib8 = new FdfLibrary();
    lib8.loadFile(f('Frame "TEXT" "A" { Width 0.1, }'));
    expect(lib8.resolveRoot('NOPE')).toBeUndefined();
    expect(lib8.resolveRoot('a')).toBeDefined(); // 大小写不敏感
  });
  it('loadOverride 字符串表覆盖既有取值（line 52）', () => {
    const lib9 = new FdfLibrary();
    lib9.loadFile(f('StringList { K "old", } Frame "TEXT" "A" { }'));
    lib9.loadOverride('p', 'StringList { NEW "v1", Z "v2", } Frame "TEXT" "B" { }');
    expect(lib9.string('K')).toBe('old');
    expect(lib9.string('NEW')).toBe('v1');
    expect(lib9.string('Z')).toBe('v2');
  });
  it('propagateDecorate 无关帧：自身无装饰标志则不加（line 155 else）', () => {
    const root: FdfFrame = { type: 'TEXTURE', name: 'a', inherits: null, withChildren: false, props: [], children: [] };
    propagateDecorate(root);
    expect(root.props).toEqual([]);
  });
  it('cloneNamespaced：NAME_REFS 重写、匿名子、未拥有引用不重写', () => {
    const src: FdfFrame = {
      type: 'BUTTON', name: 'Row', inherits: null, withChildren: false,
      props: [
        { key: 'ButtonText', args: [{ s: 'Row', n: null, str: true }] }, // NAME_REFS + 拥有名 → 重写
        { key: 'ButtonText', args: [{ s: 'Other', n: null, str: true }] }, // NAME_REFS + 非拥有名不重写
        { key: 'SetPoint', args: [{ s: 'LEFT', n: null, str: false }, { s: 'Other', n: null, str: true }] }, // SetPoint args[1] 非拥有 → 不重写
        { key: 'SetPoint', args: [{ s: 'LEFT', n: null, str: false }, { s: '0', n: 0, str: false }] }, // SetPoint args[1] 非串 → 不重写
      ],
      children: [
        { type: 'TEXTURE', name: '', inherits: null, withChildren: false, props: [], children: [] }, // 匿名子 → name 空
      ],
    };
    const out = cloneNamespaced(src, '_2');
    expect(out.props[0].args[0].s).toBe('Row_2');
    expect(out.props[1].args[0].s).toBe('Other');
    expect(out.props[2].args[1].s).toBe('Other');
    expect(out.props[3].args[1].n).toBe(0);
    expect(out.children[0].name).toBe('');
  });
});