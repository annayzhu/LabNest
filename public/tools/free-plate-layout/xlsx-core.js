(function attachXlsxCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XlsxCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createXlsxCore() {
  "use strict";

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      table[index] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
  }

  function concat(parts) {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }

  function littleEndian(values) {
    const size = values.reduce((sum, item) => sum + item[0], 0);
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    let offset = 0;
    for (const [width, value] of values) {
      if (width === 2) view.setUint16(offset, value, true);
      else view.setUint32(offset, value >>> 0, true);
      offset += width;
    }
    return bytes;
  }

  function zip(entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, content] of entries) {
      const nameBytes = encoder.encode(name);
      const data = typeof content === "string" ? encoder.encode(content) : content;
      const checksum = crc32(data);
      const localHeader = littleEndian([[4, 0x04034b50], [2, 20], [2, 0x0800], [2, 0], [2, 0], [2, 0], [4, checksum], [4, data.length], [4, data.length], [2, nameBytes.length], [2, 0]]);
      const local = concat([localHeader, nameBytes, data]);
      locals.push(local);
      const centralHeader = littleEndian([[4, 0x02014b50], [2, 20], [2, 20], [2, 0x0800], [2, 0], [2, 0], [2, 0], [4, checksum], [4, data.length], [4, data.length], [2, nameBytes.length], [2, 0], [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]]);
      centrals.push(concat([centralHeader, nameBytes]));
      offset += local.length;
    }
    const central = concat(centrals);
    const end = littleEndian([[4, 0x06054b50], [2, 0], [2, 0], [2, entries.length], [2, entries.length], [4, central.length], [4, offset], [2, 0]]);
    return concat([...locals, central, end]);
  }

  function xml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
  }

  function unxml(value) {
    return String(value ?? "").replace(/&(lt|gt|amp|quot|apos|#\d+);/g, (match, entity) => {
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      if (entity === "amp") return "&";
      if (entity === "quot") return '"';
      if (entity === "apos") return "'";
      if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
      return match;
    });
  }

  function columnName(index) {
    let value = index + 1;
    let result = "";
    while (value) { value -= 1; result = String.fromCharCode(65 + (value % 26)) + result; value = Math.floor(value / 26); }
    return result;
  }

  function uniqueSheetNames(names) {
    const used = new Set();
    return names.map((raw, index) => {
      const cleaned = String(raw || `Sheet ${index + 1}`).replace(/[\\/*?:\[\]]/g, " ").replace(/\s+/g, " ").trim() || `Sheet ${index + 1}`;
      let candidate = cleaned.slice(0, 31);
      let copy = 2;
      while (used.has(candidate.toLowerCase())) {
        const suffix = ` (${copy})`;
        candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
        copy += 1;
      }
      used.add(candidate.toLowerCase());
      return candidate;
    });
  }

  function worksheetXml(sheet) {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const maxColumns = Math.max(1, ...rows.map((row) => row.length));
    const cells = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      const style = rowIndex === 0 ? ' s="1"' : "";
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
      if (typeof value === "boolean") return `<c r="${ref}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join("")}</row>`).join("");
    const dimension = `A1:${columnName(maxColumns - 1)}${Math.max(1, rows.length)}`;
    const views = sheet.freezeRows ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : "<sheetViews><sheetView workbookViewId=\"0\"/></sheetViews>";
    const filter = sheet.autoFilter && rows.length ? `<autoFilter ref="${dimension}"/>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimension}"/>${views}<sheetFormatPr defaultRowHeight="15"/><sheetData>${cells}</sheetData>${filter}</worksheet>`;
  }

  function buildWorkbook({ sheets = [] } = {}) {
    if (!Array.isArray(sheets) || !sheets.length) throw new Error("At least one worksheet is required.");
    const names = uniqueSheetNames(sheets.map((sheet) => sheet.name));
    const workbookSheets = names.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
    const relationships = names.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
    const overrides = names.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
    const entries = [
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12635F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`],
      ...sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet)]),
    ];
    return zip(entries);
  }

  async function inflateRaw(data) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot decompress Excel worksheets.");
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let eocd = data.length - 22;
    while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
    if (eocd < 0) throw new Error("Invalid XLSX ZIP container.");
    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const files = new Map();
    for (let index = 0; index < count; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid ZIP central directory.");
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(data.slice(offset + 46, offset + 46 + nameLength));
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = data.slice(start, start + compressedSize);
      const content = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
      if (!content) throw new Error(`Unsupported ZIP compression method: ${method}`);
      files.set(name, content);
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  function parseSharedStrings(content) {
    if (!content) return [];
    const source = decoder.decode(content);
    return [...source.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => [...match[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => unxml(part[1])).join(""));
  }

  function parseSheet(content, sharedStrings) {
    const source = decoder.decode(content);
    const rows = [...source.matchAll(/<row(?: [^>]*)?>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
      const row = [];
      for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1] || "A";
        let column = 0;
        for (const char of ref) column = column * 26 + char.charCodeAt(0) - 64;
        column -= 1;
        const type = /\bt="([^"]+)"/.exec(attrs)?.[1] || "n";
        const inline = /<t(?: [^>]*)?>([\s\S]*?)<\/t>/.exec(body)?.[1];
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] || "";
        let value;
        if (type === "inlineStr" || type === "str") value = unxml(inline ?? raw);
        else if (type === "s") value = sharedStrings[Number(raw)] ?? "";
        else if (type === "b") value = raw === "1";
        else value = raw === "" ? "" : Number(raw);
        while (row.length < column) row.push("");
        row[column] = value;
      }
      return row;
    });
    const pane = /<pane[^>]*\bySplit="([^"]+)"/.exec(source);
    return { rows, freezeRows: pane ? Number(pane[1]) : 0, autoFilter: /<autoFilter\b/.test(source), mergedCells: [...source.matchAll(/<mergeCell[^>]*\bref="([^"]+)"/g)].map((match) => match[1]) };
  }

  async function parseWorkbook(bytes) {
    const files = await unzip(bytes);
    const workbook = decoder.decode(files.get("xl/workbook.xml") || new Uint8Array());
    const rels = decoder.decode(files.get("xl/_rels/workbook.xml.rels") || new Uint8Array());
    const targets = new Map([...rels.matchAll(/<Relationship[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((match) => [match[1], match[2]]));
    const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml"));
    const sheets = [];
    for (const match of workbook.matchAll(/<sheet[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"[^>]*\/>/g)) {
      const target = targets.get(match[2]);
      if (!target) continue;
      const path = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`;
      const parsed = parseSheet(files.get(path) || new Uint8Array(), sharedStrings);
      sheets.push({ name: unxml(match[1]), ...parsed });
    }
    return { sheets };
  }

  return { buildWorkbook, parseWorkbook, uniqueSheetNames };
});

