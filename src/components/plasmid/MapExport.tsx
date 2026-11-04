"use client";

import { Download } from "lucide-react";

// The map draws with classes from the workbench stylesheet; a downloaded file has none, so these computed values are
// written onto every element of the copy.
const kept = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline", "paint-order"] as const;

/** A standalone copy of the map as drawn, with its styles inlined and a white background (Q380). */
function standalone(svg: SVGSVGElement) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const source = [svg, ...svg.querySelectorAll("*")];
  [copy, ...copy.querySelectorAll("*")].forEach((element, index) => {
    const style = getComputedStyle(source[index]);
    const inline = kept.map((name) => `${name}:${style.getPropertyValue(name)}`).join(";");
    element.setAttribute("style", inline);
    element.removeAttribute("class");
  });
  const box = svg.viewBox.baseVal;
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  for (const [name, value] of Object.entries({ x: box.x, y: box.y, width: box.width, height: box.height, fill: "#ffffff" })) background.setAttribute(name, String(value));
  copy.insertBefore(background, copy.firstChild);
  return { text: new XMLSerializer().serializeToString(copy), width, height };
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** The map on screen as a standalone SVG, for a record's snapshot; undefined when the map is not showing. */
export function mapSnapshot() {
  const found = document.querySelector<SVGSVGElement>(".ln-pw-map .ln-pw-map-svg");
  return found ? standalone(found).text : undefined;
}

/** 图谱导出 (Q380): the map as SVG, or as a PNG at twice its size; PDF goes through printing. */
export function MapExport({ name }: { name: string }) {
  const file = name.replace(/[^\w.-]+/g, "_").slice(0, 80) || "plasmid";
  const map = () => document.querySelector<SVGSVGElement>(".ln-pw-map .ln-pw-map-svg");
  const svg = () => {
    const found = map();
    if (found) save(new Blob([standalone(found).text], { type: "image/svg+xml" }), `${file}-map.svg`);
  };
  const png = () => {
    const found = map();
    if (!found) return;
    const { text, width, height } = standalone(found);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(2, 2);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => { if (blob) save(blob, `${file}-map.png`); }, "image/png");
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  };
  return (
    <span className="ln-pw-actions">
      <button type="button" className="ln-pw-link" onClick={svg}><Download className="h-3.5 w-3.5" aria-hidden />Map SVG</button>
      <button type="button" className="ln-pw-link" onClick={png}><Download className="h-3.5 w-3.5" aria-hidden />Map PNG</button>
    </span>
  );
}
