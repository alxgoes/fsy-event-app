import { Buffer } from "node:buffer";
import { deflateRawSync, inflateRawSync } from "node:zlib";

export interface ZipReadLimits {
  maxArchiveBytes?: number;
  maxUncompressedTotalBytes?: number;
  maxEntryCount?: number;
  maxCompressionRatio?: number;
}

export interface ZipWriteEntry {
  name: string;
  data: Buffer | Uint8Array | string;
  compress?: boolean;
}

const DEFAULT_MAX_ARCHIVE_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024; // 40 MB
const DEFAULT_MAX_ENTRY_COUNT = 128;
const DEFAULT_MAX_RATIO = 100;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validateSafeEntryName(name: string): string {
  if (!name || name.includes("\0") || name.startsWith("/") || name.startsWith("\\")) {
    throw new Error("Caminho de arquivo inválido dentro do pacote compactado.");
  }
  const normalized = name.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((seg) => seg === "..")) {
    throw new Error("Tentativa de travessia de diretório detectada no arquivo compactado.");
  }
  return normalized;
}

/**
 * Lê um arquivo ZIP em memória aplicando limites estritos contra zip-bomb,
 * entradas duplicadas, excesso de entradas e path traversal.
 */
export function readZipArchive(
  input: Buffer | Uint8Array,
  limits: ZipReadLimits = {}
): Map<string, Buffer> {
  const maxArchiveBytes = limits.maxArchiveBytes ?? DEFAULT_MAX_ARCHIVE_BYTES;
  const maxUncompressedTotalBytes =
    limits.maxUncompressedTotalBytes ?? DEFAULT_MAX_UNCOMPRESSED_BYTES;
  const maxEntryCount = limits.maxEntryCount ?? DEFAULT_MAX_ENTRY_COUNT;
  const maxCompressionRatio = limits.maxCompressionRatio ?? DEFAULT_MAX_RATIO;

  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length > maxArchiveBytes) {
    throw new Error(
      `O arquivo excede o tamanho máximo permitido (${Math.round(maxArchiveBytes / (1024 * 1024))} MB).`
    );
  }
  if (buf.length < 22) {
    throw new Error("Arquivo inválido ou corrompido (cabeçalho ZIP ausente).");
  }

  let eocdOffset = -1;
  const minEocdSearch = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minEocdSearch; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Formato de arquivo inválido: diretório central ZIP não encontrado.");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralDirSize = buf.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);

  if (totalEntries > maxEntryCount) {
    throw new Error(
      `O pacote contém entradas demais (${totalEntries}; limite máximo ${maxEntryCount}).`
    );
  }
  if (centralDirOffset + centralDirSize > buf.length) {
    throw new Error("Diretório central do pacote ZIP está truncado.");
  }

  const files = new Map<string, Buffer>();
  let ptr = centralDirOffset;
  let totalUncompressed = 0;

  for (let idx = 0; idx < totalEntries; idx++) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error("Entrada inválida no diretório central do pacote ZIP.");
    }
    const compressionMethod = buf.readUInt16LE(ptr + 10);
    const expectedCrc = buf.readUInt32LE(ptr + 16);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const uncompressedSize = buf.readUInt32LE(ptr + 24);
    const fileNameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      throw new Error("Arquivos ZIP64 de grande porte não são permitidos neste endpoint.");
    }

    const rawName = buf.subarray(ptr + 46, ptr + 46 + fileNameLen).toString("utf8");
    const safeName = validateSafeEntryName(rawName);
    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (safeName.endsWith("/")) {
      continue;
    }

    if (files.has(safeName)) {
      throw new Error(`Entrada duplicada detectada no pacote compactado: "${safeName}".`);
    }

    if (uncompressedSize > maxUncompressedTotalBytes) {
      throw new Error("Uma entrada do pacote excede o limite de memória descompactada.");
    }
    if (
      compressedSize > 0 &&
      uncompressedSize / compressedSize > maxCompressionRatio &&
      uncompressedSize > 16 * 1024
    ) {
      throw new Error("Taxa de compressão suspeita detectada (proteção contra zip-bomb).");
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > maxUncompressedTotalBytes) {
      throw new Error("O conteúdo descompactado total excede o limite de segurança.");
    }

    if (localHeaderOffset + 30 > buf.length || buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error("Cabeçalho local ZIP inválido.");
    }
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) {
      throw new Error("Dados da entrada ZIP truncados.");
    }

    const compressedSlice = buf.subarray(dataStart, dataEnd);
    let content: Buffer;
    if (compressionMethod === 0) {
      content = Buffer.from(compressedSlice);
    } else if (compressionMethod === 8) {
      content = inflateRawSync(compressedSlice, { maxOutputLength: uncompressedSize + 1024 });
    } else {
      throw new Error(`Método de compressão ZIP não suportado (${compressionMethod}).`);
    }

    if (content.length !== uncompressedSize) {
      throw new Error("Tamanho descompactado diverge do cabeçalho ZIP.");
    }
    if (crc32(content) !== expectedCrc) {
      throw new Error("Falha de integridade (CRC32) ao ler o arquivo compactado.");
    }

    files.set(safeName, content);
  }

  return files;
}

/**
 * Cria um arquivo ZIP padrão em memória (usado para exportação .xlsx e lotes de PDF).
 */
export function createZipArchive(entries: readonly ZipWriteEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const seenNames = new Set<string>();
  let offset = 0;

  for (const entry of entries) {
    const safeName = validateSafeEntryName(entry.name);
    if (seenNames.has(safeName)) {
      throw new Error(`Entrada duplicada ao gerar arquivo compactado: "${safeName}".`);
    }
    seenNames.add(safeName);

    const nameBuf = Buffer.from(safeName, "utf8");
    const rawData =
      typeof entry.data === "string"
        ? Buffer.from(entry.data, "utf8")
        : Buffer.isBuffer(entry.data)
          ? entry.data
          : Buffer.from(entry.data);

    const shouldCompress = entry.compress ?? true;
    const compressedData = shouldCompress ? deflateRawSync(rawData, { level: 6 }) : rawData;
    const method = shouldCompress ? 8 : 0;
    const entryCrc = crc32(rawData);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x21, 12);
    localHeader.writeUInt32LE(entryCrc, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressedData);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x21, 14);
    centralHeader.writeUInt32LE(entryCrc, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressedData.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuffer, eocd]);
}
