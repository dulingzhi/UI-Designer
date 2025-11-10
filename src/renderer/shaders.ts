// 简化的 MDX 模型着色器
// 支持硬件蒙皮（Hardware Skinning）的基础渲染

export const vertexShader = `
attribute vec3 aVertexPosition;
attribute vec3 aNormal;
attribute vec2 aTextureCoord;
attribute vec4 aGroup; // 骨骼索引 (最多4个)

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNodesMatrices[254]; // 骨骼变换矩阵

varying vec2 vTextureCoord;
varying vec3 vNormal;
varying vec3 vPosition;

void main(void) {
    // 暂时不应用骨骼变换，直接使用顶点位置
    // TODO: 实现正确的骨骼蒙皮逻辑
    vec4 position = vec4(aVertexPosition, 1.0);
    vec4 normal = vec4(aNormal, 0.0);
    
    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;
    vNormal = normalize((uMVMatrix * normal).xyz);
    vPosition = (uMVMatrix * position).xyz;
}
`;

export const fragmentShader = `
precision mediump float;

varying vec2 vTextureCoord;
varying vec3 vNormal;
varying vec3 vPosition;

uniform sampler2D uSampler;
uniform vec3 uReplaceableColor; // 可替换颜色（如团队颜色）
uniform int uReplaceableType; // 0=普通纹理, 1=团队颜色, 2=团队光泽
uniform float uDiscardAlphaLevel; // Alpha 测试阈值
uniform bool uWireframe; // 线框模式

void main(void) {
    if (uWireframe) {
        gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); // 绿色线框
        return;
    }
    
    vec4 texColor = texture2D(uSampler, vTextureCoord);
    
    // Alpha 测试
    if (texColor.a < uDiscardAlphaLevel) {
        discard;
    }
    
    // 可替换颜色处理
    vec3 finalColor = texColor.rgb;
    if (uReplaceableType == 1) {
        // 团队颜色：使用纹理的亮度调制团队颜色
        float brightness = (texColor.r + texColor.g + texColor.b) / 3.0;
        finalColor = uReplaceableColor * brightness;
    } else if (uReplaceableType == 2) {
        // 团队光泽：混合纹理和团队颜色
        finalColor = mix(texColor.rgb, uReplaceableColor, 0.5);
    }
    // else: uReplaceableType == 0，使用原始纹理颜色
    
    // 简单的 Lambert 光照
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(normalize(vNormal), lightDir), 0.3); // 最小环境光 0.3
    
    gl_FragColor = vec4(finalColor * diffuse, texColor.a);
}
`;
