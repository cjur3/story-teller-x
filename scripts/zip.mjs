/**
 * Minimal ZIP reader (enough for EPUB files), no library needed.
 * Supports stored and deflate entries; the browser's DecompressionStream does
 * the inflating. ZIP64 and encrypted archives are rejected with a clear error.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export class ZipReader {
  #bytes;
  #view;
  #entries = new Map();

  /** @param {ArrayBuffer|Uint8Array} data */
  constructor(data) {
    this.#bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.#view = new DataView(this.#bytes.buffer, this.#bytes.byteOffset, this.#bytes.byteLength);
    this.#readDirectory();
  }

  static async fromFile(file) {
    return new ZipReader(await file.arrayBuffer());
  }

  #readDirectory() {
    const view = this.#view;
    // the end-of-central-directory record is within the last 64 KiB + 22 bytes
    let eocd = -1;
    const lowest = Math.max(0, view.byteLength - 22 - 0xffff);
    for (let i = view.byteLength - 22; i >= lowest; i--) {
      if (view.getUint32(i, true) === EOCD_SIGNATURE) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("Not a ZIP file");

    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    if (count === 0xffff || offset === 0xffffffff) throw new Error("ZIP64 archives are not supported");

    const decoder = new TextDecoder("utf-8");
    for (let i = 0; i < count; i++) {
      if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error("Damaged ZIP directory");
      const flags = view.getUint16(offset + 8, true);
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const size = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(this.#bytes.subarray(offset + 46, offset + 46 + nameLength));
      if (compressedSize === 0xffffffff || size === 0xffffffff) throw new Error("ZIP64 archives are not supported");
      if (!name.endsWith("/")) {
        this.#entries.set(name, { name, flags, method, compressedSize, size, localOffset });
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
  }

  /** Names of all files in the archive. */
  get names() {
    return [...this.#entries.keys()];
  }

  has(name) {
    return this.#entries.has(name);
  }

  /** The (decompressed) content of a file. */
  async bytes(name) {
    const entry = this.#entries.get(name);
    if (!entry) throw new Error(`File not in archive: ${name}`);
    if (entry.flags & 1) throw new Error("Encrypted archives are not supported");

    const view = this.#view;
    if (view.getUint32(entry.localOffset, true) !== LOCAL_SIGNATURE) throw new Error("Damaged ZIP entry");
    const nameLength = view.getUint16(entry.localOffset + 26, true);
    const extraLength = view.getUint16(entry.localOffset + 28, true);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    const raw = this.#bytes.subarray(start, start + entry.compressedSize);

    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflateRaw(raw);
    throw new Error(`Unsupported ZIP compression method ${entry.method}`);
  }

  async text(name) {
    return new TextDecoder("utf-8").decode(await this.bytes(name));
  }
}
