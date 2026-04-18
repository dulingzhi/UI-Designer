import { describe, expect, it } from 'vitest';
import { FrameType, type FrameData } from '../../src/types';
import { getRenderableText } from '../../src/renderer/textLayout';

function mkFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 't1',
    name: 'T',
    type: FrameType.TEXT_FRAME,
    x: 0,
    y: 0,
    width: 0.1,
    height: 0.02,
    z: 0,
    parentId: null,
    children: [],
    anchors: [],
    text: 'abcdefghij',
    ...overrides,
  } as FrameData;
}

describe('getRenderableText', () => {
  it('默认返回原文本', () => {
    expect(getRenderableText(mkFrame())).toBe('abcdefghij');
  });

  it('TextLength 截断文本长度', () => {
    expect(getRenderableText(mkFrame({ textLength: 4 }))).toBe('abcd');
  });

  it('maxChars 优先于 textLength', () => {
    expect(getRenderableText(mkFrame({ textLength: 8, maxChars: 3 }))).toBe('abc');
  });

  it('PASSWORDFIELD 将可见字符替换为星号', () => {
    expect(getRenderableText(mkFrame({ fontFlags: ['PASSWORDFIELD'] }))).toBe('**********');
  });

  it('PASSWORDFIELD 保留换行，仅替换可见字符', () => {
    expect(getRenderableText(mkFrame({ text: 'ab\ncd', fontFlags: ['PASSWORDFIELD'] }))).toBe('**\n**');
  });

  it('先截断再做 PASSWORDFIELD 掩码', () => {
    expect(getRenderableText(mkFrame({ textLength: 3, fontFlags: ['PASSWORDFIELD'] }))).toBe('***');
  });

  it('0 长度限制返回空字符串', () => {
    expect(getRenderableText(mkFrame({ textLength: 0 }))).toBe('');
  });
});