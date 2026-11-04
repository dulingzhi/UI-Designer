//! Compression algorithm implementations (browser subset).

pub(super) mod adpcm;
pub(super) mod huffman;
#[cfg(test)]
pub(super) mod huffman_regression;
pub(super) mod implode;
pub(super) mod lzma;
pub(super) mod pkware;
pub(super) mod sparse;
pub(super) mod zlib;
