# FDF跨层级relativeTo引用修复方案

## 问题根源

### 当前代码流程:
```typescript
// 1. transformFrame() - 创建Frame并应用属性
applyAnchor() {
  frame.anchors.push({
    point,
    relativeTo: relativeToName,  // 保存Frame名称字符串
    relativePoint,
    x, y
  });
}

// 2. collectNestedFrames() - 收集嵌套Frame
if (anchor.relativeTo === '__PARENT__') {
  anchor.relativeTo = parentFrame.name;  // 替换为父Frame名称
}

// 3. resolveRelativeFrames() - 名称→ID转换
const nameToId = new Map<string, string>();
for (const frame of frames) {  // ❌ 只遍历顶层frames!
  nameToId.set(frame.name, frame.id);
}
```

### 问题所在:
`resolveRelativeFrames()`只构建**顶层Frame**的名称映射,嵌套Frame无法被找到!

### 示例场景:
```
EscMenuMainPanel (顶层)
├── MainPanel (嵌套,不在nameToId中)
    ├── PauseButton
        └── SetPoint TOP, "EscMenuMainPanel", TOP, 0, -0.067
             // relativeTo="EscMenuMainPanel" ✅ 能找到
    ├── SaveGameButton  
        └── SetPoint TOP, "EscMenuMainPanel", TOP, 0, -0.104
             // relativeTo="EscMenuMainPanel" ✅ 能找到
    └── LoadGameButton
        └── SetPoint TOP, "SaveGameButton", BOTTOM, 0, -0.002
             // relativeTo="SaveGameButton" ❌ 找不到!
```

## 修复方案

### 方案A: 递归构建完整的名称映射 (推荐)

```typescript
/**
 * 递归收集所有Frame的名称映射(包括嵌套Frame)
 */
private buildNameToIdMap(frames: FrameData[], map: Map<string, string> = new Map()): Map<string, string> {
  for (const frame of frames) {
    map.set(frame.name, frame.id);
    
    // 递归处理children  
    if (frame.children && frame.children.length > 0) {
      // 需要从allFrames中找到children
      // 但是这里只有children的ID数组...
    }
  }
  return map;
}
```

**问题**: children只存储ID,需要完整的Frame对象才能递归

### 方案B: 在transform()阶段收集所有Frame (推荐 ✅)

```typescript
public transform(ast: FDFProgram): FrameData[] {
  const frames: FrameData[] = [];
  const allFrames: FrameData[] = []; // 新增:存储所有Frame(包括嵌套)
  
  for (const node of ast.body) {
    if (node.type === FDFNodeType.FRAME_DEFINITION) {
      const frame = this.transformFrame(node);
      frames.push(frame);
      allFrames.push(frame); // 顶层Frame
      
      // 收集嵌套Frame到allFrames
      this.collectNestedFrames(node, frame, allFrames);
    }
  }
  
  // 使用allFrames构建完整映射
  this.resolveRelativeFrames(allFrames); // 而不是frames
  this.recalculateSizesWithRelativeAnchors(allFrames);
  
  return frames;
}
```

### 方案C: 修改数据结构保留Frame引用

在FrameData中添加:
```typescript
interface FrameData {
  // ...现有字段
  childrenFrames?: FrameData[];  // 直接存储Frame对象引用
}
```

**问题**: 会导致循环引用,序列化困难

## 选择方案B的实现

### 修改点1: transform()方法

```typescript
public transform(ast: FDFProgram): FrameData[] {
  const frames: FrameData[] = [];
  const allFramesFlat: FrameData[] = []; // 扁平化的所有Frame列表
  
  for (const node of ast.body) {
    if (node.type === FDFNodeType.FRAME_DEFINITION) {
      const frame = this.transformFrame(node);
      frames.push(frame);
      
      // 添加到扁平列表
      allFramesFlat.push(frame);
      
      // 处理__PARENT__并收集所有嵌套Frame
      if (frame.anchors && frame.anchors.length > 0) {
        for (const anchor of frame.anchors) {
          if (anchor.relativeTo === '__PARENT__') {
            // 顶层Frame没有父元素,删除relativeTo
            delete anchor.relativeTo;
            delete anchor.relativePoint;
            
            // 根据锚点类型设置画布坐标
            const canvasCoords = this.getCanvasCoordinateForPoint(anchor.point);
            anchor.x = canvasCoords.x;
            anchor.y = canvasCoords.y;
          }
        }
      }
      
      // 递归收集嵌套Frame到allFramesFlat
      this.collectNestedFrames(node, frame, allFramesFlat);
      
      // 注册为模板
      if (node.name) {
        this.templateRegistry.set(node.name, frame);
      }
    }
  }
  
  // 后处理:将锚点的relativeTo从名称映射到ID
  // 使用allFramesFlat确保能找到所有Frame
  this.resolveRelativeFrames(allFramesFlat);
  
  // 第二次尺寸计算
  this.recalculateSizesWithRelativeAnchors(allFramesFlat);
  
  return frames;
}
```

### 修改点2: collectNestedFrames()签名

```typescript
/**
 * 收集嵌套的Frame并建立父子关系
 * @param allFrames 扁平化的所有Frame数组(会被修改)
 */
private collectNestedFrames(
  node: FDFFrameDefinition, 
  parentFrame: FrameData, 
  allFrames: FrameData[]  // 改为扁平数组
): void {
  for (const prop of node.properties) {
    if (prop.type === FDFNodeType.NESTED_FRAME) {
      const frameType = prop.frameType.toLowerCase();
      if (frameType !== 'texture' && frameType !== 'string' && frameType !== 'controlstyle') {
        const nestedFrameDef: FDFFrameDefinition = {
          type: FDFNodeType.FRAME_DEFINITION,
          frameType: prop.frameType,
          name: prop.name || `NestedFrame_${Date.now()}`,
          inherits: prop.inherits,
          properties: prop.properties,
          loc: prop.loc,
        };
        
        const childFrame = this.transformFrame(nestedFrameDef);
        
        // 建立父子关系
        childFrame.parentId = parentFrame.id;
        parentFrame.children.push(childFrame.id);
        
        // 处理__PARENT__
        if (childFrame.anchors && childFrame.anchors.length > 0) {
          for (const anchor of childFrame.anchors) {
            if (anchor.relativeTo === '__PARENT__') {
              anchor.relativeTo = parentFrame.name; // 使用父Frame名称
            }
          }
        }
        
        // 添加到扁平数组
        allFrames.push(childFrame);
        
        // 递归处理
        this.collectNestedFrames(nestedFrameDef, childFrame, allFrames);
      }
    }
  }
}
```

### 修改点3: resolveRelativeFrames()保持不变

```typescript
private resolveRelativeFrames(frames: FrameData[]): void {
  // 构建名称到ID的映射(现在frames包含所有Frame)
  const nameToId = new Map<string, string>();
  for (const frame of frames) {
    nameToId.set(frame.name, frame.id);
  }
  
  // 解析所有锚点的relativeTo
  for (const frame of frames) {
    if (frame.anchors && frame.anchors.length > 0) {
      for (const anchor of frame.anchors) {
        if (anchor.relativeTo && typeof anchor.relativeTo === 'string') {
          const targetId = nameToId.get(anchor.relativeTo);
          if (targetId) {
            anchor.relativeTo = targetId;
          } else {
            console.warn(`[FDF Transformer] Cannot resolve relativeTo: ${anchor.relativeTo} for frame ${frame.name}`);
          }
        }
      }
    }
  }
}
```

## 验证测试

```typescript
test('should resolve cross-level relativeTo references', () => {
  const fdfContent = `
    Frame "FRAME" "EscMenuMainPanel" {
      SetAllPoints,
      
      Frame "FRAME" "MainPanel" {
        Width 0.288,
        Height 0.384,
        
        Frame "GLUETEXTBUTTON" "PauseButton" {
          SetPoint TOP, "EscMenuMainPanel", TOP, 0.0, -0.067,
        }
        
        Frame "GLUETEXTBUTTON" "SaveGameButton" {
          SetPoint TOP, "PauseButton", BOTTOM, 0.0, -0.002,
        }
      }
    }
  `;
  
  const frames = parseFDF(fdfContent);
  
  // 找到PauseButton
  const pauseButton = frames.find(f => f.name === 'PauseButton');
  expect(pauseButton).toBeDefined();
  
  // 验证relativeTo被正确解析为EscMenuMainPanel的ID
  const escMenu = frames.find(f => f.name === 'EscMenuMainPanel');
  expect(pauseButton.anchors[0].relativeTo).toBe(escMenu.id);
  
  // 找到SaveGameButton
  const saveButton = frames.find(f => f.name === 'SaveGameButton');
  expect(saveButton).toBeDefined();
  
  // 验证relativeTo被正确解析为PauseButton的ID
  expect(saveButton.anchors[0].relativeTo).toBe(pauseButton.id);
});
```

## 预期结果

修复后的行为:
1. ✅ EscMenuMainPanel, MainPanel, PauseButton, SaveGameButton都在allFramesFlat中
2. ✅ nameToId包含所有Frame的映射
3. ✅ PauseButton的relativeTo="EscMenuMainPanel"能找到对应ID
4. ✅ SaveGameButton的relativeTo="SaveGameButton"能找到对应ID
5. ✅ Canvas渲染时所有Frame位置正确计算
