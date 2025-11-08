// MDX/MDL 模型文件解析器
// 参考格式: Warcraft III MDX binary format specification

use byteorder::{LittleEndian, ReadBytesExt};
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read, Seek, SeekFrom};

// MDX 文件头结构 (4 bytes magic + version)
const MDX_MAGIC: &[u8; 4] = b"MDLX";
const MDL_VERSION: u32 = 800; // Warcraft III uses version 800

#[derive(Debug, Serialize, Deserialize)]
pub struct MdxModel {
    pub version: u32,
    pub name: String,
    pub vertices: Vec<Vertex>,
    pub normals: Vec<Normal>,
    pub uvs: Vec<UV>,
    pub faces: Vec<Face>,
    pub bounds: BoundingBox,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct Vertex {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct Normal {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct UV {
    pub u: f32,
    pub v: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Face {
    pub indices: [u16; 3], // 三角面的三个顶点索引
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct BoundingBox {
    pub min: Vertex,
    pub max: Vertex,
}

// Chunk 类型标识符 (4 bytes)
#[derive(Debug, PartialEq)]
enum ChunkType {
    Vers, // Version
    Modl, // Model info
    Seqs, // Sequences (animations)
    Mtls, // Materials
    Texs, // Textures
    Geos, // Geosets (geometry data)
    Geoa, // Geoset animations
    Bone, // Bones
    Help, // Helpers
    Atch, // Attachments
    Pivt, // Pivot points
    Evts, // Events
    Clid, // Collision shapes
    Unknown,
}

impl ChunkType {
    fn from_bytes(bytes: &[u8; 4]) -> Self {
        match bytes {
            b"VERS" => ChunkType::Vers,
            b"MODL" => ChunkType::Modl,
            b"SEQS" => ChunkType::Seqs,
            b"MTLS" => ChunkType::Mtls,
            b"TEXS" => ChunkType::Texs,
            b"GEOS" => ChunkType::Geos,
            b"GEOA" => ChunkType::Geoa,
            b"BONE" => ChunkType::Bone,
            b"HELP" => ChunkType::Help,
            b"ATCH" => ChunkType::Atch,
            b"PIVT" => ChunkType::Pivt,
            b"EVTS" => ChunkType::Evts,
            b"CLID" => ChunkType::Clid,
            _ => ChunkType::Unknown,
        }
    }
}

pub struct MdxParser {
    cursor: Cursor<Vec<u8>>,
}

impl MdxParser {
    pub fn new(data: Vec<u8>) -> Result<Self, String> {
        Ok(MdxParser {
            cursor: Cursor::new(data),
        })
    }

    pub fn parse(&mut self) -> Result<MdxModel, String> {
        // 读取文件头
        let mut magic = [0u8; 4];
        self.cursor
            .read_exact(&mut magic)
            .map_err(|e| format!("Failed to read magic: {}", e))?;

        if &magic != MDX_MAGIC {
            return Err(format!(
                "Invalid MDX magic: expected {:?}, got {:?}",
                MDX_MAGIC, magic
            ));
        }

        let mut model = MdxModel {
            version: 0,
            name: String::new(),
            vertices: Vec::new(),
            normals: Vec::new(),
            uvs: Vec::new(),
            faces: Vec::new(),
            bounds: BoundingBox {
                min: Vertex { x: 0.0, y: 0.0, z: 0.0 },
                max: Vertex { x: 0.0, y: 0.0, z: 0.0 },
            },
        };

        // 读取所有 chunks
        loop {
            // 读取 chunk type (4 bytes)
            let mut chunk_id = [0u8; 4];
            match self.cursor.read_exact(&mut chunk_id) {
                Ok(_) => {}
                Err(_) => break, // 文件结束
            }

            let chunk_type = ChunkType::from_bytes(&chunk_id);

            // 读取 chunk size (4 bytes)
            let chunk_size = self
                .cursor
                .read_u32::<LittleEndian>()
                .map_err(|e| format!("Failed to read chunk size: {}", e))?;

            // 根据 chunk 类型处理
            match chunk_type {
                ChunkType::Vers => {
                    model.version = self
                        .cursor
                        .read_u32::<LittleEndian>()
                        .map_err(|e| format!("Failed to read version: {}", e))?;
                }
                ChunkType::Modl => {
                    self.parse_model_info(&mut model, chunk_size)?;
                }
                ChunkType::Geos => {
                    self.parse_geosets(&mut model, chunk_size)?;
                }
                _ => {
                    // 跳过未知或暂不处理的 chunk
                    self.cursor
                        .seek(SeekFrom::Current(chunk_size as i64))
                        .map_err(|e| format!("Failed to skip chunk: {}", e))?;
                }
            }
        }

        // 计算边界框
        self.calculate_bounds(&mut model);

        Ok(model)
    }

    fn parse_model_info(&mut self, model: &mut MdxModel, size: u32) -> Result<(), String> {
        // 模型名称 (80 bytes, null-terminated string)
        let mut name_bytes = vec![0u8; 80];
        self.cursor
            .read_exact(&mut name_bytes)
            .map_err(|e| format!("Failed to read model name: {}", e))?;

        // 找到第一个 null 字符
        let name_end = name_bytes.iter().position(|&b| b == 0).unwrap_or(80);
        model.name = String::from_utf8_lossy(&name_bytes[..name_end]).to_string();

        // 跳过剩余的 MODL 数据 (boundary sphere, extents, etc.)
        let remaining = size as i64 - 80;
        if remaining > 0 {
            self.cursor
                .seek(SeekFrom::Current(remaining))
                .map_err(|e| format!("Failed to skip MODL data: {}", e))?;
        }

        Ok(())
    }

    fn parse_geosets(&mut self, model: &mut MdxModel, _size: u32) -> Result<(), String> {
        // GEOS chunk 包含多个 geoset
        // 每个 geoset 有自己的几何数据

        loop {
            // 尝试读取下一个 geoset
            let start_pos = self.cursor.position();

            // 读取可能的 chunk ID
            let mut next_chunk = [0u8; 4];
            match self.cursor.read_exact(&mut next_chunk) {
                Ok(_) => {
                    // 检查是否是新的顶层 chunk（非 geoset 数据）
                    if ChunkType::from_bytes(&next_chunk) != ChunkType::Unknown {
                        // 回退，让主循环处理
                        self.cursor.seek(SeekFrom::Start(start_pos)).ok();
                        break;
                    }
                    // 回退，继续读取 geoset
                    self.cursor.seek(SeekFrom::Start(start_pos)).ok();
                }
                Err(_) => break,
            }

            // 读取 geoset size
            let geoset_size = match self.cursor.read_u32::<LittleEndian>() {
                Ok(size) => size,
                Err(_) => break,
            };

            self.parse_single_geoset(model, geoset_size)?;
        }

        Ok(())
    }

    fn parse_single_geoset(&mut self, model: &mut MdxModel, size: u32) -> Result<(), String> {
        let geoset_start = self.cursor.position();
        let geoset_end = geoset_start + size as u64;

        // 读取 geoset 内的 sub-chunks
        while self.cursor.position() < geoset_end {
            let mut chunk_id = [0u8; 4];
            self.cursor
                .read_exact(&mut chunk_id)
                .map_err(|e| format!("Failed to read geoset chunk: {}", e))?;

            match &chunk_id {
                b"VRTX" => {
                    // Vertices
                    let count = self
                        .cursor
                        .read_u32::<LittleEndian>()
                        .map_err(|e| format!("Failed to read vertex count: {}", e))?;

                    for _ in 0..count {
                        let x = self.cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                        let y = self.cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                        let z = self.cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                        model.vertices.push(Vertex { x, y, z });
                    }
                }
                b"NRMS" => {
                    // Normals
                    let count = self.cursor.read_u32::<LittleEndian>().unwrap_or(0);
                    for _ in 0..count {
                        let x = self.cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                        let y = self.cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                        let z = self.cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                        model.normals.push(Normal { x, y, z });
                    }
                }
                b"UVBS" => {
                    // UV coordinates (texture coordinates)
                    let count = self.cursor.read_u32::<LittleEndian>().unwrap_or(0);
                    for _ in 0..count {
                        let u = self.cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                        let v = self.cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                        model.uvs.push(UV { u, v });
                    }
                }
                b"PVTX" | b"GNDX" | b"MTGC" | b"MATS" => {
                    // 其他 geoset 数据，暂时跳过
                    let count = self.cursor.read_u32::<LittleEndian>().unwrap_or(0);
                    let skip_size = match &chunk_id {
                        b"PVTX" => count * 2,  // u16 indices
                        b"GNDX" => count * 1,  // u8 group indices
                        b"MTGC" => count * 4,  // u32 matrix counts
                        b"MATS" => count * 4,  // u32 matrix indices
                        _ => 0,
                    };
                    self.cursor.seek(SeekFrom::Current(skip_size as i64)).ok();
                }
                _ => {
                    // 未知 chunk，跳到 geoset 结尾
                    self.cursor.seek(SeekFrom::Start(geoset_end)).ok();
                    break;
                }
            }
        }

        // 确保指针在 geoset 结尾
        self.cursor.seek(SeekFrom::Start(geoset_end)).ok();

        Ok(())
    }

    fn calculate_bounds(&self, model: &mut MdxModel) {
        if model.vertices.is_empty() {
            return;
        }

        let mut min = model.vertices[0];
        let mut max = model.vertices[0];

        for vertex in &model.vertices {
            min.x = min.x.min(vertex.x);
            min.y = min.y.min(vertex.y);
            min.z = min.z.min(vertex.z);

            max.x = max.x.max(vertex.x);
            max.y = max.y.max(vertex.y);
            max.z = max.z.max(vertex.z);
        }

        model.bounds = BoundingBox { min, max };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_type_parsing() {
        assert_eq!(ChunkType::from_bytes(b"VERS"), ChunkType::Vers);
        assert_eq!(ChunkType::from_bytes(b"GEOS"), ChunkType::Geos);
        assert_eq!(ChunkType::from_bytes(b"XXXX"), ChunkType::Unknown);
    }

    #[test]
    fn test_mdx_magic() {
        assert_eq!(MDX_MAGIC, b"MDLX");
    }
}
