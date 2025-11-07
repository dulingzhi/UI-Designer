import React, { useEffect, useState, useMemo } from 'react';
import { TextureAtlasSplitter, parseCornerFlags, type EdgeFlag } from '../utils/textureAtlas';

export interface BackdropEdgeProps {
  /** 边框纹理文件路径 */
  edgeFile: string;
  /** 角标志，例如 "UL|UR|BL|BR|T|L|B|R" */
  cornerFlags: string;
  /** 角尺寸（相对于0.8屏幕宽度） */
  cornerSize: number;
  /** 背景内边距 [left, top, right, bottom] */
  backgroundInsets?: [number, number, number, number];
  /** 纹理数据 URL */
  textureDataURL?: string;
  /** Canvas 宽度（用于坐标转换） */
  canvasWidth?: number;
}

/**
 * Backdrop 边框渲染组件
 * 
 * 使用 9-slice 技术渲染 WC3 风格的边框纹理
 * 纹理图集包含 8 个部分：4个角 + 4条边
 */
export const BackdropEdge: React.FC<BackdropEdgeProps> = ({
  edgeFile: _edgeFile,
  cornerFlags,
  cornerSize,
  backgroundInsets: _backgroundInsets = [0, 0, 0, 0],
  textureDataURL,
  canvasWidth = 800,
}) => {
  const [subTextures, setSubTextures] = useState<Map<EdgeFlag, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // 解析要渲染的边框部分
  const flags = useMemo(() => parseCornerFlags(cornerFlags), [cornerFlags]);

  // 计算角尺寸（像素）
  const cornerSizePx = useMemo(() => {
    return (cornerSize / 0.8) * canvasWidth;
  }, [cornerSize, canvasWidth]);

  // 加载并分割纹理图集
  useEffect(() => {
    if (!textureDataURL) {
      setLoading(false);
      return;
    }

    const loadTextures = async () => {
      try {
        setLoading(true);
        const splitter = new TextureAtlasSplitter();
        
        // 自动检测布局并提取子纹理
        const { layout, subSize } = await splitter.detectLayout(textureDataURL);
        const textures = await splitter.extractSubTextures(textureDataURL, layout, subSize);
        
        setSubTextures(textures);
      } catch (error) {
        console.error('边框纹理加载失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTextures();
  }, [textureDataURL]);

  if (loading || !textureDataURL) {
    return null;
  }

  // 检查是否有指定部分的纹理
  const hasTexture = (flag: EdgeFlag) => {
    return flags.includes(flag) && subTextures.has(flag);
  };

  // 获取纹理 URL
  const getTexture = (flag: EdgeFlag) => {
    return subTextures.get(flag);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: -cornerSizePx,
        left: -cornerSizePx,
        right: -cornerSizePx,
        bottom: -cornerSizePx,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      {/* 左上角 */}
      {hasTexture('UL') && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: cornerSizePx,
            height: cornerSizePx,
            backgroundImage: `url(${getTexture('UL')})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {/* 右上角 */}
      {hasTexture('UR') && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: cornerSizePx,
            height: cornerSizePx,
            backgroundImage: `url(${getTexture('UR')})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {/* 左下角 */}
      {hasTexture('BL') && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: cornerSizePx,
            height: cornerSizePx,
            backgroundImage: `url(${getTexture('BL')})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {/* 右下角 */}
      {hasTexture('BR') && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: cornerSizePx,
            height: cornerSizePx,
            backgroundImage: `url(${getTexture('BR')})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {/* 顶边 */}
      {hasTexture('T') && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: cornerSizePx,
            right: cornerSizePx,
            height: cornerSizePx,
            backgroundImage: `url(${getTexture('T')})`,
            backgroundSize: `${cornerSizePx}px ${cornerSizePx}px`,
            backgroundRepeat: 'repeat-x',
          }}
        />
      )}

      {/* 底边 */}
      {hasTexture('B') && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: cornerSizePx,
            right: cornerSizePx,
            height: cornerSizePx,
            backgroundImage: `url(${getTexture('B')})`,
            backgroundSize: `${cornerSizePx}px ${cornerSizePx}px`,
            backgroundRepeat: 'repeat-x',
          }}
        />
      )}

      {/* 左边 */}
      {hasTexture('L') && (
        <div
          style={{
            position: 'absolute',
            top: cornerSizePx,
            bottom: cornerSizePx,
            left: 0,
            width: cornerSizePx,
            backgroundImage: `url(${getTexture('L')})`,
            backgroundSize: `${cornerSizePx}px ${cornerSizePx}px`,
            backgroundRepeat: 'repeat-y',
          }}
        />
      )}

      {/* 右边 */}
      {hasTexture('R') && (
        <div
          style={{
            position: 'absolute',
            top: cornerSizePx,
            bottom: cornerSizePx,
            right: 0,
            width: cornerSizePx,
            backgroundImage: `url(${getTexture('R')})`,
            backgroundSize: `${cornerSizePx}px ${cornerSizePx}px`,
            backgroundRepeat: 'repeat-y',
          }}
        />
      )}
    </div>
  );
};
