import { mat4, vec3, quat } from 'gl-matrix';
import type { MDXModel } from './types';
import { vertexShader, fragmentShader } from './shaders';

interface ShaderProgram {
  program: WebGLProgram;
  attribLocations: {
    vertexPosition: number;
    normal: number;
    textureCoord: number;
    group: number;
  };
  uniformLocations: {
    projectionMatrix: WebGLUniformLocation;
    modelViewMatrix: WebGLUniformLocation;
    nodesMatrices: WebGLUniformLocation;
    sampler: WebGLUniformLocation;
    replaceableColor: WebGLUniformLocation;
    replaceableType: WebGLUniformLocation;
    discardAlphaLevel: WebGLUniformLocation;
    wireframe: WebGLUniformLocation;
  };
}

export class ModelRenderer {
  private gl!: WebGLRenderingContext | WebGL2RenderingContext; // 在 initGL 中初始化
  private model: MDXModel;
  private shaderProgram: ShaderProgram | null = null;

  // 缓冲区
  private vertexBuffers: WebGLBuffer[] = [];
  private normalBuffers: WebGLBuffer[] = [];
  private texCoordBuffers: WebGLBuffer[] = [];
  private groupBuffers: WebGLBuffer[] = [];
  private indexBuffers: WebGLBuffer[] = [];

  // 纹理
  private textures: Map<string, WebGLTexture> = new Map();
  private defaultTexture: WebGLTexture | null = null;

  // 动画状态
  private currentSequence: number = 0;
  private currentFrame: number = 0;
  private animationSpeed: number = 1.0;

  // 骨骼矩阵
  private nodesMatrices: mat4[] = [];

  // 相机和渲染状态
  private teamColor: vec3 = vec3.fromValues(1.0, 0.0, 0.0); // 默认红色

  constructor(model: MDXModel) {
    this.model = model;

    // 初始化骨骼矩阵（最多254个）
    for (let i = 0; i < 254; i++) {
      this.nodesMatrices[i] = mat4.create();
      mat4.identity(this.nodesMatrices[i]);
    }

    // 根据节点层级初始化矩阵
    if (model.Nodes) {
      for (let i = 0; i < model.Nodes.length; i++) {
        const node = model.Nodes[i];
        if (node && node.PivotPoint) {
          // 设置平移到轴心点
          mat4.fromTranslation(this.nodesMatrices[i], node.PivotPoint as any);
        }
      }
    }
  }

  /**
   * 初始化 WebGL 上下文和资源
   */
  public initGL(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.gl = gl;

    // 编译着色器
    this.shaderProgram = this.initShaderProgram();
    if (!this.shaderProgram) {
      throw new Error('Failed to initialize shader program');
    }

    // 创建几何体缓冲区
    this.initBuffers();

    // 创建默认纹理（白色1x1）
    this.createDefaultTexture();

    console.log('✅ ModelRenderer 初始化完成');
  }

  /**
   * 编译并链接着色器程序
   */
  private initShaderProgram(): ShaderProgram | null {
    const gl = this.gl;

    // 编译顶点着色器
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return null;
    gl.shaderSource(vs, vertexShader);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('顶点着色器编译错误:', gl.getShaderInfoLog(vs));
      return null;
    }

    // 编译片段着色器
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fs) return null;
    gl.shaderSource(fs, fragmentShader);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('片段着色器编译错误:', gl.getShaderInfoLog(fs));
      return null;
    }

    // 链接程序
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('着色器程序链接错误:', gl.getProgramInfoLog(program));
      return null;
    }

    // 获取 attribute 和 uniform 位置
    const attribLocations = {
      vertexPosition: gl.getAttribLocation(program, 'aVertexPosition'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      textureCoord: gl.getAttribLocation(program, 'aTextureCoord'),
      group: gl.getAttribLocation(program, 'aGroup'),
    };

    const uniformLocations = {
      projectionMatrix: gl.getUniformLocation(program, 'uPMatrix')!,
      modelViewMatrix: gl.getUniformLocation(program, 'uMVMatrix')!,
      nodesMatrices: gl.getUniformLocation(program, 'uNodesMatrices')!,
      sampler: gl.getUniformLocation(program, 'uSampler')!,
      replaceableColor: gl.getUniformLocation(program, 'uReplaceableColor')!,
      replaceableType: gl.getUniformLocation(program, 'uReplaceableType')!,
      discardAlphaLevel: gl.getUniformLocation(program, 'uDiscardAlphaLevel')!,
      wireframe: gl.getUniformLocation(program, 'uWireframe')!,
    };

    return { program, attribLocations, uniformLocations };
  }

  /**
   * 创建所有 Geoset 的 WebGL 缓冲区
   */
  private initBuffers(): void {
    const gl = this.gl;

    for (let i = 0; i < this.model.Geosets.length; i++) {
      const geoset = this.model.Geosets[i];

      // 顶点位置缓冲区
      const vertexBuffer = gl.createBuffer();
      if (vertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geoset.Vertices, gl.STATIC_DRAW);
        this.vertexBuffers[i] = vertexBuffer;
      }

      // 法线缓冲区
      const normalBuffer = gl.createBuffer();
      if (normalBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geoset.Normals, gl.STATIC_DRAW);
        this.normalBuffers[i] = normalBuffer;
      }

      // UV 坐标缓冲区
      const texCoordBuffer = gl.createBuffer();
      if (texCoordBuffer && geoset.TVertices && geoset.TVertices[0]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geoset.TVertices[0], gl.STATIC_DRAW);
        this.texCoordBuffers[i] = texCoordBuffer;
      }

      // 骨骼组缓冲区
      const groupBuffer = gl.createBuffer();
      if (groupBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, groupBuffer);
        
        // 将 VertexGroup 和 Groups 转换为 vec4 格式（每个顶点最多4个骨骼）
        const groupData = new Uint16Array(geoset.VertexGroup.length * 4);
        for (let j = 0; j < geoset.VertexGroup.length; j++) {
          const groupIndex = geoset.VertexGroup[j];
          const group = geoset.Groups[groupIndex] || [];
          
          groupData[j * 4] = group[0] !== undefined ? group[0] : 254; // 254 表示无骨骼
          groupData[j * 4 + 1] = group[1] !== undefined ? group[1] : 254;
          groupData[j * 4 + 2] = group[2] !== undefined ? group[2] : 254;
          groupData[j * 4 + 3] = group[3] !== undefined ? group[3] : 254;
        }
        
        gl.bufferData(gl.ARRAY_BUFFER, groupData, gl.STATIC_DRAW);
        this.groupBuffers[i] = groupBuffer;
      }

      // 索引缓冲区
      const indexBuffer = gl.createBuffer();
      if (indexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geoset.Faces, gl.STATIC_DRAW);
        this.indexBuffers[i] = indexBuffer;
      }
    }

    console.log(`✅ 创建了 ${this.model.Geosets.length} 个 Geoset 的缓冲区`);
  }

  /**
   * 创建默认白色纹理
   */
  private createDefaultTexture(): void {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    const pixel = new Uint8Array([255, 255, 255, 255]); // 白色
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    this.defaultTexture = texture;
  }

  /**
   * 设置纹理图片
   */
  public setTextureImage(path: string, image: HTMLImageElement): void {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // 生成 mipmap
    if (this.isPowerOf2(image.width) && this.isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.textures.set(path, texture);
  }

  private isPowerOf2(value: number): boolean {
    return (value & (value - 1)) === 0;
  }

  /**
   * 设置团队颜色
   */
  public setTeamColor(color: number[] | vec3): void {
    if (Array.isArray(color)) {
      vec3.set(this.teamColor, color[0], color[1], color[2]);
    } else {
      vec3.copy(this.teamColor, color);
    }
  }

  /**
   * 设置当前动画序列
   */
  public setSequence(index: number): void {
    if (index >= 0 && this.model.Sequences && index < this.model.Sequences.length) {
      this.currentSequence = index;
      const seq = this.model.Sequences[index];
      this.currentFrame = seq.Interval[0];
      console.log(`🎬 切换到动画: ${seq.Name || index} (${seq.Interval[0]}-${seq.Interval[1]})`);
    }
  }

  /**
   * 设置相机（当前版本简化，主要用于接口兼容）
   */
  public setCamera(_position: vec3, _rotation: quat): void {
    // 简化版本暂不处理相机变换
  }

  /**
   * 更新动画帧
   */
  public update(delta: number): void {
    if (!this.model.Sequences || this.model.Sequences.length === 0) return;

    const seq = this.model.Sequences[this.currentSequence];
    if (!seq) return;

    // 更新帧数（delta 是毫秒，魔兽3的动画通常是30fps = 33.33ms/帧）
    const frameIncrement = (delta / 33.33) * this.animationSpeed;
    this.currentFrame += frameIncrement;

    // 循环动画
    if (this.currentFrame > seq.Interval[1]) {
      if (seq.NonLooping) {
        this.currentFrame = seq.Interval[1]; // 停在最后一帧
      } else {
        this.currentFrame = seq.Interval[0]; // 循环回开始
      }
    }

    // TODO: 更新骨骼矩阵（需要解析关键帧动画数据）
  }

  /**
   * 渲染模型
   */
  public render(
    mvMatrix: mat4,
    pMatrix: mat4,
    options: { wireframe?: boolean } = {}
  ): void {
    const gl = this.gl;
    const program = this.shaderProgram;
    if (!program) return;

    // 设置 WebGL 状态
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // 使用着色器程序
    gl.useProgram(program.program);

    // 设置矩阵 uniform
    gl.uniformMatrix4fv(program.uniformLocations.modelViewMatrix, false, mvMatrix);
    gl.uniformMatrix4fv(program.uniformLocations.projectionMatrix, false, pMatrix);

    // 设置骨骼矩阵数组
    const matricesFlat = new Float32Array(254 * 16);
    for (let i = 0; i < 254; i++) {
      matricesFlat.set(this.nodesMatrices[i], i * 16);
    }
    gl.uniformMatrix4fv(program.uniformLocations.nodesMatrices, false, matricesFlat);

    // 设置团队颜色
    gl.uniform3fv(program.uniformLocations.replaceableColor, this.teamColor);

    // 线框模式
    gl.uniform1i(program.uniformLocations.wireframe, options.wireframe ? 1 : 0);

    // 渲染每个 Geoset
    for (let i = 0; i < this.model.Geosets.length; i++) {
      this.renderGeoset(i, program, options.wireframe || false);
    }
  }

  /**
   * 渲染单个 Geoset
   */
  private renderGeoset(index: number, program: ShaderProgram, wireframe: boolean): void {
    const gl = this.gl;
    const geoset = this.model.Geosets[index];
    const material = this.model.Materials[geoset.MaterialID];

    if (!material || !material.Layers || material.Layers.length === 0) {
      return; // 没有材质，跳过
    }

    const layer = material.Layers[0]; // 简化：只渲染第一层
    const texture = this.getTextureForLayer(layer);

    // 绑定纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(program.uniformLocations.sampler, 0);

    // 设置可替换纹理类型
    const textureObj = layer.TextureID >= 0 && layer.TextureID < this.model.Textures.length 
      ? this.model.Textures[layer.TextureID] 
      : null;
    const replaceableType = textureObj?.ReplaceableId ?? 0;
    gl.uniform1i(program.uniformLocations.replaceableType, replaceableType);

    // 调试输出
    if (index === 0) {
      console.log('Geoset 0:', {
        textureID: layer.TextureID,
        replaceableType,
        texturePath: textureObj?.Image,
        filterMode: layer.FilterMode
      });
    }

    // Alpha 测试阈值
    const alphaTest = (layer.FilterMode ?? 1) === 0 ? 0.75 : 0.0;
    gl.uniform1f(program.uniformLocations.discardAlphaLevel, alphaTest);

    // 设置混合模式
    this.setBlendMode(layer.FilterMode ?? 1);

    // 绑定顶点属性
    if (this.vertexBuffers[index]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffers[index]);
      gl.enableVertexAttribArray(program.attribLocations.vertexPosition);
      gl.vertexAttribPointer(program.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    }

    if (this.normalBuffers[index]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffers[index]);
      gl.enableVertexAttribArray(program.attribLocations.normal);
      gl.vertexAttribPointer(program.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
    }

    if (this.texCoordBuffers[index]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffers[index]);
      gl.enableVertexAttribArray(program.attribLocations.textureCoord);
      gl.vertexAttribPointer(program.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
    }

    if (this.groupBuffers[index]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.groupBuffers[index]);
      gl.enableVertexAttribArray(program.attribLocations.group);
      gl.vertexAttribPointer(program.attribLocations.group, 4, gl.UNSIGNED_SHORT, false, 0, 0);
    }

    // 绘制
    if (this.indexBuffers[index]) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffers[index]);
      
      if (wireframe) {
        // 线框模式：绘制线条
        // TODO: 需要创建线框索引缓冲区
        gl.drawElements(gl.TRIANGLES, geoset.Faces.length, gl.UNSIGNED_SHORT, 0);
      } else {
        gl.drawElements(gl.TRIANGLES, geoset.Faces.length, gl.UNSIGNED_SHORT, 0);
      }
    }
  }

  /**
   * 获取材质层对应的纹理
   */
  private getTextureForLayer(layer: any): WebGLTexture {
    const textureObj = this.model.Textures[layer.TextureID];
    
    if (!textureObj) {
      return this.defaultTexture!;
    }

    // 如果是可替换纹理，使用默认纹理（团队颜色等在着色器中处理）
    if (textureObj.ReplaceableId !== 0) {
      return this.defaultTexture!;
    }

    // 查找已加载的纹理
    const texture = this.textures.get(textureObj.Image);
    return texture || this.defaultTexture!;
  }

  /**
   * 设置 WebGL 混合模式
   */
  private setBlendMode(filterMode: number): void {
    const gl = this.gl;

    switch (filterMode) {
      case 0: // None - 无混合，使用 alpha 测试
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        break;

      case 1: // Transparent - 透明混合
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        break;

      case 2: // Blend - 混合
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        break;

      case 3: // Additive - 加法混合
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        break;

      case 4: // AddAlpha - Alpha 加法
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        break;

      case 5: // Modulate - 调制
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        break;

      case 6: // Modulate2x - 调制2倍
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.DST_COLOR, gl.SRC_COLOR);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        break;

      default:
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        break;
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    const gl = this.gl;

    // 删除缓冲区
    for (const buffer of this.vertexBuffers) {
      gl.deleteBuffer(buffer);
    }
    for (const buffer of this.normalBuffers) {
      gl.deleteBuffer(buffer);
    }
    for (const buffer of this.texCoordBuffers) {
      gl.deleteBuffer(buffer);
    }
    for (const buffer of this.groupBuffers) {
      gl.deleteBuffer(buffer);
    }
    for (const buffer of this.indexBuffers) {
      gl.deleteBuffer(buffer);
    }

    // 删除纹理
    for (const texture of this.textures.values()) {
      gl.deleteTexture(texture);
    }
    if (this.defaultTexture) {
      gl.deleteTexture(this.defaultTexture);
    }

    // 删除着色器程序
    if (this.shaderProgram) {
      gl.deleteProgram(this.shaderProgram.program);
    }

    console.log('✅ ModelRenderer 资源已清理');
  }
}
