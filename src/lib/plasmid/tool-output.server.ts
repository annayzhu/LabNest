import { prisma } from "@/lib/db";

async function primaryVersion(productId: string) {
  const product = await prisma.inventoryProduct.findUnique({ where: { id: productId }, select: { name: true, entityId: true, type: { select: { key: true } } } });
  if (!product || product.type?.key !== "plasmid") return null;
  const link = product.entityId ? await prisma.entitySequenceLink.findFirst({ where: { entityId: product.entityId, role: "primary" }, select: { sequenceVersion: { select: { id: true, sequenceId: true, displayVersion: true } } } }) : null;
  return link?.sequenceVersion ? { name: product.name, version: link.sequenceVersion } : null;
}

/** The version a plasmid is on now, so a saved map can say a newer one exists. */
export async function currentPlasmidVersion(productId: string) {
  const primary = await primaryVersion(productId);
  return primary ? { id: primary.version.id, label: `v${primary.version.displayVersion}` } : null;
}

/** What a record keeps about a plasmid version, read from what is saved rather than from the browser. */
export async function plasmidOutput({ productId, versionId, zh }: { productId: string; versionId: string; zh: boolean }) {
  const primary = await primaryVersion(productId);
  if (!primary) throw new Error(zh ? "请先把序列保存到库存里的质粒" : "Save the sequence to a plasmid in inventory first");
  const version = await prisma.sequenceVersion.findUnique({ where: { id: versionId }, select: { sequenceId: true, displayVersion: true, sequence: true, topology: true, checksum: true, _count: { select: { features: true } } } });
  if (!version || version.sequenceId !== primary.version.sequenceId) throw new Error(zh ? "这个版本不属于此质粒" : "This version does not belong to this plasmid");
  const versionLabel = `v${version.displayVersion}`;
  const topology = version.topology === "circular" ? (zh ? "环状" : "Circular") : version.topology === "linear" ? (zh ? "线性" : "Linear") : (zh ? "未知" : "Unknown");
  return {
    label: `${primary.name} · ${versionLabel}`,
    table: { headers: zh ? ["项目", "内容"] : ["Item", "Value"], rows: [[zh ? "版本" : "Version", versionLabel], [zh ? "长度" : "Length", `${version.sequence.length.toLocaleString("en-US")} bp`], [zh ? "形态" : "Topology", topology], [zh ? "特征数" : "Features", String(version._count.features)]] },
    method: `${zh ? "质粒工作台 · 序列校验" : "Plasmid workbench · sequence checksum"} ${version.checksum.slice(0, 12)}`,
    plasmid: { productId, versionId, versionLabel },
  };
}
