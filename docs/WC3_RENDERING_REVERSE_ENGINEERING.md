# WC3 FDF Rendering Reverse Engineering Report

> Source: Game.dll 1.27a via IDA Pro  
> Base address: 0x6f000000  
> Total functions: 86,102 (80,274 named with RTTI)

---

## 1. Alpha Blend Modes — `EGxMatAlphaOp`

### Enum Values

| Value | Name         | Description |
|-------|-------------|-------------|
| 0     | DISABLE     | Opaque rendering, no blending |
| 1     | ALPHAKEY    | Alpha test (hard-edge cutoff) |
| 2     | BLEND       | Standard alpha blending |
| 3     | ADD         | Additive blending (glow effect) |
| 4     | MODULATE    | Modulate (multiply) |
| 5     | MODULATE2X  | 2× modulate |

### AlphaRef Thresholds (`s_alphaRef`)

| Mode       | AlphaRef (0-255) | Normalized | WebGL Equivalent |
|------------|-----------------|------------|-----------------|
| DISABLE    | 0xFF (255)      | 1.0        | No alpha test   |
| ALPHAKEY   | **0xC0 (192)**  | **0.753**  | `discard` if alpha < 0.753 |
| BLEND      | 0x04            | 0.016      | Near-zero threshold |
| ADD        | 0x04            | 0.016      | Near-zero threshold |
| MODULATE   | 0x04            | 0.016      | Near-zero threshold |
| MODULATE2X | 0x04            | 0.016      | Near-zero threshold |

### Blend Factors (D3D → WebGL Mapping)

| Mode       | D3D SrcBlend      | D3D DstBlend        | WebGL SrcFactor        | WebGL DstFactor              |
|------------|-------------------|---------------------|------------------------|------------------------------|
| DISABLE    | ONE (2)           | ZERO (1)            | `gl.ONE`               | `gl.ZERO`                    |
| ALPHAKEY   | SRC_ALPHA (5)     | INV_SRC_ALPHA (6)   | `gl.SRC_ALPHA`         | `gl.ONE_MINUS_SRC_ALPHA`     |
| BLEND      | SRC_ALPHA (5)     | INV_SRC_ALPHA (6)   | `gl.SRC_ALPHA`         | `gl.ONE_MINUS_SRC_ALPHA`     |
| ADD        | SRC_ALPHA (5)     | ONE (2)             | `gl.SRC_ALPHA`         | `gl.ONE`                     |
| MODULATE   | DST_COLOR (9)     | ZERO (1)            | `gl.DST_COLOR`         | `gl.ZERO`                    |
| MODULATE2X | DST_COLOR (9)     | SRC_COLOR (3)       | `gl.DST_COLOR`         | `gl.SRC_COLOR`               |

### Alpha Function
- `D3DRS_ALPHAFUNC = 7` → `D3DCMP_GREATEREQUAL`
- GLSL: `if (texColor.a < alphaRef) discard;`

---

## 2. Nine-Slice (Backdrop Edge) Rendering

### Source Functions
- `CBackdropFrame::OnUpdateModels` (0x6f0a4cd0) — 5393 bytes, builds all 9 geometry pieces
- `CBackdropFrame::BuildGeosetMaterialList` (0x6f0a4900) — builds material/texture arrays
- `CBackdropGenerator::Generate` (0x6f0c3200) — computes UV coordinates for edge pieces
- `CBackdropGenerator::SetOutput` (0x6f0c3650) — 2349 bytes, sets up edge frames

### Bit Flags (`*(this + 432)`)
Controls which edge/corner pieces are enabled:

| Bit  | Hex  | Piece        |
|------|------|-------------|
| 0    | 0x01 | Top-Left corner |
| 1    | 0x02 | Top-Right corner |
| 2    | 0x04 | Bottom-Left corner |
| 3    | 0x08 | Bottom-Right corner |
| 4    | 0x10 | Top edge |
| 5    | 0x20 | Bottom edge |
| 6    | 0x40 | Left edge |
| 7    | 0x80 | Right edge |

### UV Layout — Edge Texture (when separate edge texture exists, `v90=true`)

The edge texture is divided into **8 horizontal strips**, each 1/8 of the texture width:

| UV Range     | Float Values     | Piece           |
|-------------|-----------------|-----------------|
| 0.000–0.125 | 0.0 – 0.125     | Top-Left corner |
| 0.125–0.250 | 0.125 – 0.25    | Top-Right corner |
| 0.250–0.375 | 0.25 – 0.375    | Bottom-Left corner |
| 0.375–0.500 | 0.375 – 0.5     | Bottom-Right corner |
| 0.500–0.625 | 0.5 – 0.625     | Top edge |
| 0.625–0.750 | 0.625 – 0.75    | Bottom edge |
| 0.750–0.875 | 0.75 – 0.875    | Left edge |
| 0.875–1.000 | 0.875 – 1.0     | Right edge |

### UV Layout — No Edge Texture (using backdrop texture, `v90=false`)

When no separate edge texture, the backdrop texture is divided into quadrants:

| Piece        | U Range   | V Range   |
|-------------|-----------|-----------|
| Top edge     | 0.0–0.5   | 0.0–0.5   |
| Bottom edge  | 0.5–1.0   | 0.0–0.5   |
| Left edge    | 0.0–0.5   | 0.5–1.0   |
| Right edge   | 0.5–1.0   | 0.5–1.0   |
| Corners      | Full texture (0–1) scaled |

### Tiling Calculation
```
cornerSize = *(this + 110)    // aka field_110, the edge size  
tileCountX = (width / cornerSize) - 2.0   // center area horizontal tiles
tileCountY = (height / cornerSize) - 2.0  // center area vertical tiles
if (tileCount < 0) tileCount = 0
```

### Corner Position Factor
```
cornerPositionOffset = cornerSize * 0.95   // 5% inset for corner placement
```

### Rendering Pipeline
1. Create empty model via `ModelCreateEmpty("CBackdropFrame::OnUpdateModels()")`
2. For each piece (center + up to 8 edges/corners):
   - Compute UV coordinates based on edge texture presence
   - Compute vertex positions from frame rect ± cornerSize
   - Call `SnapTexelsToPixels()` for pixel-perfect alignment
   - Call `ModelGeosetAdd()` with 4 vertices (quad), texture, and alpha mode
3. Set vertex alpha: `ModelSetVertexAlpha(model, this->vertexAlpha, 1)`
4. Finalize with `HandleClose()`

### Primitive Type
All pieces use quad primitives with `EGxPrim = 13` and 4 vertices.

---

## 3. Texture Filtering Modes

### Filter Mode Table (`s_filterModes`, 4 modes × 3 stages)

| Mode | Mag Filter   | Min Filter   | Mip Filter   | Description |
|------|-------------|-------------|-------------|-------------|
| 0    | POINT (1)   | POINT (1)   | NONE (0)    | **Nearest-neighbor** (no mipmapping) |
| 1    | LINEAR (2)  | LINEAR (2)  | NONE (0)    | Bilinear (no mipmapping) |
| 2    | LINEAR (2)  | LINEAR (2)  | POINT (1)   | Bilinear + nearest mipmap |
| 3    | LINEAR (2)  | LINEAR (2)  | LINEAR (2)  | Trilinear |

### Texture Filter Selection
The filter mode is determined by `(texFlags >> 0) & 3`:
- Bits 0-1 of texture flags select the filter mode (0-3)

### Wrap/Address Modes (`s_wrapModes`)

| Value | D3D Mode  | WebGL Equivalent |
|-------|----------|-----------------|
| 0     | WRAP (3)  | `gl.REPEAT` |
| 1     | CLAMP (1) | `gl.CLAMP_TO_EDGE` |

### Wrap Mode Selection
- U wrap: `(texFlags >> 2) & 1` → 0=REPEAT, 1=CLAMP
- V wrap: `(texFlags >> 3) & 1` → 0=REPEAT, 1=CLAMP

---

## 4. Frame Layout — FRAMEPOINT Enum

```c
FRAMEPOINT_TOPLEFT     = 0
FRAMEPOINT_TOP         = 1
FRAMEPOINT_TOPRIGHT    = 2
FRAMEPOINT_LEFT        = 3
FRAMEPOINT_CENTER      = 4
FRAMEPOINT_RIGHT       = 5
FRAMEPOINT_BOTTOMLEFT  = 6
FRAMEPOINT_BOTTOM      = 7
FRAMEPOINT_BOTTOMRIGHT = 8
```

### CRect Memory Layout
```c
struct CRect {
    float bottom;   // offset +0
    float left;     // offset +4
    float top;      // offset +8
    float right;    // offset +12
};
```

### SetPoint — Absolute
```c
CLayoutFrame::SetPoint(FRAMEPOINT point, float x, float y, BOOL resize)
```
Creates a `CFramePointAbsolute` and optionally triggers resize.

### SetPoint — Relative
```c
CLayoutFrame::SetPoint(FRAMEPOINT point, CLayoutFrame* relative, FRAMEPOINT relPoint, float x, float y, BOOL resize)
```
Creates a `CFramePointRelative` linking to another frame/point, registers for resize notifications.

---

## 5. Pixel Snapping — `SnapTexelsToPixels`

### Purpose
Ensures texel-to-pixel alignment for crisp rendering without sub-pixel bleeding.

### Algorithm (simplified)
1. Get texture dimensions from `TextureGetGxTex` → `GxTexParameters`
2. Transform 4 vertex positions to 2D screen coordinates via `GxuXformCalc2dScreenCoords`
3. Apply `PixSnap` to each vertex (rounds to nearest pixel boundary)
4. Compute average offset across 4 vertices (× 0.25 per component)
5. Adjust UVs with ±0.5 texel offset based on whether vertex is before/after center
6. Build 3×3 matrix from screen positions and UVs
7. Invert matrix and multiply to compute corrected UV coordinates
8. Divide final UVs by texture dimensions for normalized coords

### Key Mipmap Level Selection
```c
threshold = sqrt(crossProduct) * 2.0 * 1.5;
while (threshold <= uvRange) {
    uvRange *= 0.5;
    mipLevel++;
}
texWidth >>= mipLevel;
texHeight >>= mipLevel;
```

---

## 6. Rendering State Machine Summary

### Per-Material State Setup (`IStateSyncMaterial`)

For modes DISABLE(0), BLEND(2), MODULATE(4):
- Internal states 145=0, 147=0 (likely internal blend/test flags)

For modes ALPHAKEY(1), ADD(3), MODULATE2X(5):
- Internal states 145=1, 147=1

### D3D State When AlphaOp != DISABLE:
```
D3DRS_ALPHABLENDENABLE = 1
D3DRS_SRCBLEND = s_srcBlend[alphaOp]
D3DRS_DESTBLEND = s_dstBlend[alphaOp]
D3DRS_ZWRITEENABLE = 1
D3DRS_ALPHAFUNC = 7 (GREATEREQUAL)
D3DRS_ALPHAREF = s_alphaRef[alphaOp]
```

### D3D State When AlphaOp == DISABLE:
```
D3DRS_ALPHABLENDENABLE = 0
D3DRS_ZWRITEENABLE = 0
```

---

## 7. WebGL/Three.js Implementation Implications

### Alpha Blending (Three.js ShaderMaterial)
```glsl
// ALPHAKEY mode (most common for UI textures)
if (texColor.a < 0.753) discard;  // 192/255

// ADD mode (highlight/glow effects)
// Use THREE.CustomBlending with:
//   blendSrc: THREE.SrcAlphaFactor
//   blendDst: THREE.OneFactor
```

### Nine-Slice Shader Strategy
- Single draw call per backdrop frame using a custom shader
- UV atlas addressing: pass cornerSize, frameSize as uniforms
- Shader selects UV region based on fragment position relative to corners
- Edge tiling: `tileCount = (dimension / cornerSize) - 2.0` with UV wrapping in the shader

### Texture Settings
```javascript
texture.magFilter = THREE.NearestFilter;    // Mode 0 for pixel art
texture.minFilter = THREE.NearestFilter;    // Mode 0
texture.wrapS = THREE.RepeatWrapping;       // Default for tiling edges
texture.wrapT = THREE.RepeatWrapping;
```

### Pixel Snapping
- Round vertex positions to integer pixel boundaries before rendering
- Apply half-texel offset for texel-center alignment
- This eliminates the 1-2px rounding errors seen in CSS rendering

---

## 8. Key Class Layout (Partial)

### CBackdropFrame
| Offset | Type | Field |
|--------|------|-------|
| +94    | HTEXTURE* | mainTexture |
| +95    | HTEXTURE* | edgeTexture (NULL = no edge texture) |
| +96-   | HTEXTURE*[] | pieceTextures |
| +101-  | EGxMatAlphaOp[] | pieceAlphaModes |
| +109   | DWORD | tileFlags |
| +110   | float | cornerSize |
| +111   | float | altCornerSize (0 = use cornerSize) |
| +112   | DWORD | cornerTexFlags |
| +113   | DWORD | mirrorFlags |
| +114-117 | float[4] | backdropInsets (left, right, top, bottom) |
| +118   | DWORD | renderUpdateFlag |
| +172   | DWORD | vertexAlpha |
| +248   | CRect | snapRect |
| +432   | DWORD | edgePieceBitfield |
