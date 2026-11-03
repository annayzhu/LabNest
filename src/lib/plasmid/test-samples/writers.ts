/**
 * Writers for the simulated test files (软件测试用模拟序列). They follow the published
 * ABIF and SnapGene layouts so independent readers (Biopython) can check the samples.
 */

const encoder = new TextEncoder();

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}

function latin1(text: string) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);
}

export type AbifTag = { name: string; number: number; type: number; elementSize: number; count: number; data: Uint8Array };

export const abifTag = {
  chars: (name: string, number: number, text: string): AbifTag => ({ name, number, type: 2, elementSize: 1, count: text.length, data: latin1(text) }),
  bytes: (name: string, number: number, values: number[]): AbifTag => ({ name, number, type: 2, elementSize: 1, count: values.length, data: Uint8Array.from(values) }),
  pString: (name: string, number: number, text: string): AbifTag => {
    const body = encoder.encode(text);
    return { name, number, type: 18, elementSize: 1, count: body.length + 1, data: concat([Uint8Array.of(body.length), body]) };
  },
  shorts: (name: string, number: number, values: ArrayLike<number>): AbifTag => {
    const data = new Uint8Array(values.length * 2);
    const view = new DataView(data.buffer);
    for (let index = 0; index < values.length; index += 1) view.setInt16(index * 2, values[index]);
    return { name, number, type: 4, elementSize: 2, count: values.length, data };
  },
  date: (name: string, number: number, year: number, month: number, day: number): AbifTag => ({
    name, number, type: 10, elementSize: 4, count: 1, data: Uint8Array.of(year >> 8, year & 0xff, month, day),
  }),
  time: (name: string, number: number, hour: number, minute: number, second: number): AbifTag => ({
    name, number, type: 11, elementSize: 4, count: 1, data: Uint8Array.of(hour, minute, second, 0),
  }),
};

/** ABIF: 128-byte header holding the root directory entry, data blocks, then the directory. */
export function writeAbif(tags: AbifTag[]) {
  const header = new Uint8Array(128);
  const blocks: Uint8Array[] = [];
  let offset = header.length;
  const placed = tags.map((tag) => {
    if (tag.data.length <= 4) return { tag, offset: -1 };
    const at = offset;
    blocks.push(tag.data);
    offset += tag.data.length;
    return { tag, offset: at };
  });
  const directory = new Uint8Array(tags.length * 28);
  const view = new DataView(directory.buffer);
  placed.forEach(({ tag, offset: dataOffset }, index) => {
    const at = index * 28;
    directory.set(latin1(tag.name.padEnd(4).slice(0, 4)), at);
    view.setInt32(at + 4, tag.number);
    view.setInt16(at + 8, tag.type);
    view.setInt16(at + 10, tag.elementSize);
    view.setInt32(at + 12, tag.count);
    view.setInt32(at + 16, tag.data.length);
    if (dataOffset < 0) directory.set(tag.data, at + 20);
    else view.setInt32(at + 20, dataOffset);
  });
  const headerView = new DataView(header.buffer);
  header.set(latin1("ABIF"), 0);
  headerView.setInt16(4, 101);
  header.set(latin1("tdir"), 6);
  headerView.setInt32(10, 1);
  headerView.setInt16(14, 1023);
  headerView.setInt16(16, 28);
  headerView.setInt32(18, tags.length);
  headerView.setInt32(22, directory.length);
  headerView.setInt32(26, offset);
  return concat([header, ...blocks, directory]);
}

export function snapGenePacket(type: number, data: Uint8Array) {
  const head = new Uint8Array(5);
  head[0] = type;
  new DataView(head.buffer).setUint32(1, data.length);
  return concat([head, data]);
}

export function writeSnapGene(packets: Array<{ type: number; data: Uint8Array | string }>) {
  const cookie = new Uint8Array(14);
  cookie.set(latin1("SnapGene"), 0);
  const view = new DataView(cookie.buffer);
  view.setUint16(8, 1);
  view.setUint16(10, 15);
  view.setUint16(12, 19);
  return concat([
    snapGenePacket(0x09, cookie),
    ...packets.map((packet) => snapGenePacket(packet.type, typeof packet.data === "string" ? encoder.encode(packet.data) : packet.data)),
  ]);
}

export function snapGeneDna(sequence: string, circular: boolean) {
  return { type: 0x00, data: concat([Uint8Array.of((circular ? 0x01 : 0) | 0x02), latin1(sequence)]) };
}

export function xmlEscape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
