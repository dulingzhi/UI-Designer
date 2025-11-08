import { invoke } from '@tauri-apps/api/core';

/**
 * 测试 MDX 解析功能
 * 
 * 用法：
 * 1. 确保有 war3.mpq 或其他 MPQ 档案
 * 2. 打开浏览器控制台
 * 3. 运行 testMdxParsing()
 */

interface MdxModel {
  version: number;
  name: string;
  vertices: Array<{ x: number; y: number; z: number }>;
  normals: Array<{ x: number; y: number; z: number }>;
  uvs: Array<{ u: number; v: number }>;
  faces: Array<{ indices: [number, number, number] }>;
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

export async function testMdxParsing() {
  console.log('========== MDX 解析测试 ==========');
  
  // 测试用例：常见的魔兽 3 模型
  const testCases = [
    {
      name: 'UI 背景模型',
      archivePath: 'war3.mpq',
      modelPath: 'UI/Glues/ScoreScreen/ScoreScreen-Background.mdx',
    },
    {
      name: '人族农民',
      archivePath: 'war3.mpq',
      modelPath: 'Units/Human/Peasant/Peasant.mdx',
    },
    {
      name: '兽族苦工',
      archivePath: 'war3x.mpq',
      modelPath: 'Units/Orc/Peon/Peon.mdx',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.name}`);
    console.log(`档案: ${testCase.archivePath}`);
    console.log(`模型: ${testCase.modelPath}`);
    
    try {
      const startTime = performance.now();
      
      // 调用 Rust 解析
      const modelJson = await invoke<string>('parse_mdx_from_mpq', {
        archivePath: testCase.archivePath,
        fileName: testCase.modelPath,
      });
      
      const endTime = performance.now();
      const model: MdxModel = JSON.parse(modelJson);
      
      console.log(`✅ 解析成功 (${(endTime - startTime).toFixed(2)}ms)`);
      console.log(`  - 版本: ${model.version}`);
      console.log(`  - 名称: ${model.name}`);
      console.log(`  - 顶点数: ${model.vertices.length}`);
      console.log(`  - 法线数: ${model.normals.length}`);
      console.log(`  - UV数: ${model.uvs.length}`);
      console.log(`  - 面数: ${model.faces.length}`);
      console.log(`  - 边界框: min(${model.bounds.min.x.toFixed(2)}, ${model.bounds.min.y.toFixed(2)}, ${model.bounds.min.z.toFixed(2)}) max(${model.bounds.max.x.toFixed(2)}, ${model.bounds.max.y.toFixed(2)}, ${model.bounds.max.z.toFixed(2)})`);
      
      // 采样第一个顶点
      if (model.vertices.length > 0) {
        const v = model.vertices[0];
        console.log(`  - 第一个顶点: (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`);
      }
      
      // 采样第一个面
      if (model.faces.length > 0) {
        const f = model.faces[0];
        console.log(`  - 第一个面: [${f.indices[0]}, ${f.indices[1]}, ${f.indices[2]}]`);
      }
      
    } catch (error) {
      console.error(`❌ 解析失败:`, error);
    }
  }
  
  console.log('\n========== 测试完成 ==========');
}

// 测试直接解析 MDX 二进制数据
export async function testMdxBinaryParsing(mdxData: Uint8Array) {
  console.log('========== 二进制 MDX 解析测试 ==========');
  console.log(`数据大小: ${mdxData.length} bytes`);
  
  try {
    const startTime = performance.now();
    
    const modelJson = await invoke<string>('parse_mdx_file', {
      mdxData: Array.from(mdxData),
    });
    
    const endTime = performance.now();
    const model: MdxModel = JSON.parse(modelJson);
    
    console.log(`✅ 解析成功 (${(endTime - startTime).toFixed(2)}ms)`);
    console.log('模型信息:', model);
    
    return model;
  } catch (error) {
    console.error('❌ 解析失败:', error);
    throw error;
  }
}

// 在浏览器控制台中暴露测试函数
if (typeof window !== 'undefined') {
  (window as any).testMdxParsing = testMdxParsing;
  (window as any).testMdxBinaryParsing = testMdxBinaryParsing;
  console.log('MDX 测试函数已加载:');
  console.log('  - testMdxParsing() - 测试从 MPQ 解析模型');
  console.log('  - testMdxBinaryParsing(data) - 测试解析二进制数据');
}
