"use client";
import { QuantityInput } from "./QuantityInput";
import { convert, parseScalar } from "@/lib/calculators/quantities";
import {newClientMutationId} from "@/lib/client-mutation-id";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formInputClass, preventImplicitEnterSubmit } from "./forms";
import { Button } from "./ui/Button";
import { enqueueMobileMutation } from "@/lib/mobile-mutation-queue";
type Row = {
  id: string;
  name: string;
  expected: number | null;
  actual: number | null;
  unit: string;
  source: string;
  inventoryItemId: string | null;
  containerId: string | null;
  status: string;
  error: string | null;
  correctionOfId: string | null;
};
type Stock = {
  id: string;
  name: string;
  unit: string;
  managementMode: string;
  lotNumber: string | null;
  containers: { id: string; holder: string | null }[];
};
export function RunMaterials({
  experimentId,
  rows,
  stock,
  editable,
  planned = [],
}: {
  experimentId: string;
  rows: Row[];
  stock: Stock[];
  editable: boolean;
  planned: {
    materialName: string;
    quantity: number;
    unit: string;
    formula?: string;
  }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [unit, setUnit] = useState("mL");
  const [source, setSource] = useState("manual");
  const [inventory, setInventory] = useState("");
  const [container, setContainer] = useState("");
  const [correction, setCorrection] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = stock.find((s) => s.id === inventory);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const id = draftId ?? newClientMutationId();
    setDraftId(id);
    const payload = {
      action: "save",
      id,
      name,
      expected: expected.trim() ? Number(expected) : null,
      actual: actual.trim() ? Number(actual) : null,
      unit,
      source,
      inventoryItemId: inventory || null,
      containerId: container || null,
      correctionOfId: correction,
    };
    try {
      if (!navigator.onLine) {
        await enqueueMobileMutation({
          actionType: "run.material",
          clientMutationId: id,
          deviceCreatedAt: new Date().toISOString(),
          state: "pending",
          retryCount: 0,
          payload: { experimentId, row: payload },
        });
        setStatus("已存本机，等待同步；尚未扣减库存。");
      } else {
        const r = await fetch(`/api/experiments/${experimentId}/materials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setStatus("使用记录已保存，尚未执行库存扣减。");
        router.refresh();
      }
      setDraftId(null);
      setName("");
      setExpected("");
      setActual("");
      setCorrection(null);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "保存失败，输入仍保留",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      const r = await fetch(`/api/experiments/${experimentId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          ids: rows.filter((r) => r.status === "pending").map((r) => r.id),
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setStatus(
        result.some((r: { status: string }) => r.status === "pending")
          ? "部分扣减待处理，使用记录已保留。"
          : "已完成确认。",
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "提交失败，可重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border-t border-hairline py-4">
      <h2 className="mb-3 text-lg font-semibold">本次使用的试剂与耗材</h2>
      <div className="overflow-x-auto">
        <table className="ln-run-material-table w-full text-left text-sm">
          <thead>
            <tr>
              {["物料", "预计", "实际", "来源", "执行状态"].map((h) => (
                <th key={h} className="px-2 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-hairline">
                <td data-label="物料" className="p-2">{row.name}</td>
                <td data-label="预计" className="p-2">
                  {row.expected ?? "未记录"} {row.unit}
                </td>
                <td data-label="实际" className="p-2">
                  {row.actual ?? "未确认"} {row.unit}
                </td>
                <td data-label="来源" className="p-2">
                  {row.containerId ??
                    stock.find((s) => s.id === row.inventoryItemId)?.name ??
                    "不管理库存"}
                  <span className="block text-muted">{row.source === "manual" ? "手工记录" : row.source}</span>
                </td>
                <td data-label="状态" className="p-2">
                  {row.status === "submitted"
                    ? "已扣减"
                    : row.status === "pending"
                      ? "待确认扣减"
                      : "仅记录"}
                  {row.error ? <p className="text-error">{row.error}</p> : null}
                  {row.status !== "submitted" && editable ? <button type="button" className="focus-ring ml-2 min-h-11 text-moss" onClick={()=>{setDraftId(row.id);setName(row.name);setExpected(row.expected===null?"":String(row.expected));setActual(row.actual===null?"":String(row.actual));setUnit(row.unit);setInventory(row.inventoryItemId??"");setContainer(row.containerId??"");setCorrection(row.correctionOfId);setSource(row.source);}}>编辑</button>:null}
                  {row.status === "submitted" &&
                  editable &&
                  !rows.some((r) => r.correctionOfId === row.id) ? (
                    <button
                      type="button"
                      className="focus-ring ml-2 min-h-11 text-moss"
                      onClick={() => {
                        setDraftId(null);
                        setName(row.name);
                        setExpected(
                          row.expected === null ? "" : String(row.expected),
                        );
                        setActual(
                          row.actual === null ? "" : String(row.actual),
                        );
                        setUnit(row.unit);
                        setInventory(row.inventoryItemId ?? "");
                        setContainer("");
                        setCorrection(row.id);
                        setSource(`correction:${row.id}`);
                      }}
                    >
                      登记更正
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <>
          <form
            onSubmit={save}
            onKeyDown={preventImplicitEnterSubmit}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            {planned.length ? (
              <label className="text-sm">
                预计材料
                <select
                  aria-label="预计材料"
                  className={formInputClass}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value === "") { setSource("manual"); return; }
                    const p = planned[Number(e.target.value)];
                    if (p) {
                      setName(p.materialName);
                      setExpected(String(p.quantity));
                      setUnit(p.unit);
                      setSource(`Consumption: ${p.formula ?? p.materialName}`);
                    }
                  }}
                >
                  <option value="">手工记录</option>
                  {planned.map((p, i) => (
                    <option key={i} value={i}>
                      {p.materialName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="text-sm">
              名称
              <input
                required
                className={formInputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              预计
              <input
                className={formInputClass}
                type="number"
                min="0"
                step="any"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </label>
            <QuantityInput label="实际" name="actual" value={actual} unit={unit || "mL"} onChange={(next, nextUnit) => {
              try { const nextExpected = nextUnit !== unit && expected.trim() ? String(Number(convert(parseScalar(expected),unit,nextUnit).toPrecision(14))) : expected; setExpected(nextExpected); setActual(next); setUnit(nextUnit); }
              catch { setStatus("请先完成预计用量，再切换单位。"); }
            }} />
            <label className="text-sm">
              用量依据
              <input required className={formInputClass} value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
            <label className="text-sm">
              库存来源
              <select
                className={formInputClass}
                value={inventory}
                disabled={!!correction}
                onChange={(e) => {
                  setInventory(e.target.value);
                  setContainer("");
                }}
              >
                <option value="">不管理库存</option>
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.lotNumber ?? "批号未记录"} · {s.id.slice(-6)}
                  </option>
                ))}
              </select>
            </label>
            {selected?.managementMode === "package" ? (
              <label className="text-sm">
                实际瓶
                <select
                  required
                  className={formInputClass}
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                >
                  <option value="">请选择已领用的瓶</option>
                  {selected.containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.holder ?? "持有人未记录"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button type="submit" disabled={busy}>
              {correction ? "保存更正" : "保存使用记录"}
            </Button>
          </form>
          {rows.some((r) => r.status === "pending") ? (
            <Button
              type="button"
              className="mt-4"
              disabled={busy}
              onClick={confirm}
            >
              确认实际用量并提交{" "}
              {rows.filter((r) => r.status === "pending").length} 项扣减
            </Button>
          ) : null}
        </>
      ) : null}
      {status ? (
        <p role="status" className="mt-3 text-sm">
          {status}
        </p>
      ) : null}
    </section>
  );
}
