"use client";
import { QuantityInput } from "./QuantityInput";
import { ContextProperties } from "./ContextProperties";
import {newClientMutationId} from "@/lib/client-mutation-id";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formInputClass, preventImplicitEnterSubmit } from "./forms";
import { Button } from "./ui/Button";
type Purchase = {
  id: string;
  title: string;
  quantity: number;
  unit: string;
  status: string;
  vendor?: string | null;
  procurementQuoteLine?: { specification: string | null } | null;
  invoiceStatus: string;
  invoiceReference: string | null;
  receipts: { quantity: number }[];
};
export function PurchaseRecordForm({
  purchase,
  stock = [],
  initial = {},
}: {
  initial?: Record<string, string>;
  purchase?: Purchase;
  stock?: { id: string; name: string; unit: string }[];
}) {
  const router = useRouter();
  const [operation, setOperation] = useState(
    purchase?.status === "received" ? "invoice" : "receive",
  );
  const [inventory, setInventory] = useState("none");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [key, setKey] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);
    const mutation = key ?? newClientMutationId();
    setKey(mutation);
    try {
      const payload = purchase
        ? {
            ...data,
            action: operation,
            quantity: data.quantity ? Number(data.quantity) : undefined,
            ...(operation === "details"
              ? { actualAmount: data.actualAmount || null }
              : {}),
            clientMutationId: mutation,
          }
        : {
            ...data,
            quantity: Number(data.quantity),
            actualAmount: data.actualAmount || undefined,
            vendor: data.vendor || undefined,
            clientMutationId: mutation,
          };
      const r = await fetch(
        purchase ? `/api/purchases/${purchase.id}` : "/api/purchases",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setKey(null);
      if (purchase) {
        setError("已保存");
        router.refresh();
      } else router.push(`/purchases/${result.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setPending(false);
    }
  }
  const field = (
    name: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label className="min-w-0 text-sm">
      {label}
      <input
        name={name}
        aria-label={label}
        type={type}
        required={required}
        defaultValue={initial[name] ?? ""}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? "0" : undefined}
        className={formInputClass}
      />
    </label>
  );
  return (
    <form
      onSubmit={submit}
      onChange={() => setKey(null)}
      onKeyDown={preventImplicitEnterSubmit}
      className="grid gap-4 sm:grid-cols-2"
    >
      {purchase ? <ContextProperties title="采购属性"><dl className="space-y-3"><div><dt>供应商</dt><dd>{purchase.vendor ?? "未记录"}</dd></div><div><dt>规格</dt><dd>{purchase.procurementQuoteLine?.specification ?? "未记录"}</dd></div><div><dt>采购单位</dt><dd>{purchase.unit}</dd></div></dl></ContextProperties> : null}
      {!purchase ? (
        <>
          {initial.linkedInventoryItemId ? (
            <input
              type="hidden"
              name="linkedInventoryItemId"
              value={initial.linkedInventoryItemId}
            />
          ) : null}
          {initial.procurementQuoteLineId ? (
            <input
              type="hidden"
              name="procurementQuoteLineId"
              value={initial.procurementQuoteLineId}
            />
          ) : null}
          {field("title", "物料名称", "text", true)}
          <ContextProperties title="采购属性">{field("vendor", "供应商")}<p className="text-xs text-muted">数量和实际金额保留在主界面；供应商随购买记录保存。</p></ContextProperties>
          <QuantityInput label="购买数量" name="quantity" required initialValue={initial.quantity ?? ""} initialUnit={initial.unit || "box"} options={["box","bottle","pack","vial","mL","µL","g","mg"]} />
          {field("actualAmount", "实际总金额（CNY）", "number")}
          <label className="text-sm">
            购买状态
            <select
              name="status"
              className={formInputClass}
              defaultValue="ordered"
            >
              <option value="planned">计划购买</option>
              <option value="ordered">已下单</option>
              <option value="received">已收货／历史购买</option>
            </select>
          </label>
          <input type="hidden" name="invoiceStatus" value="pending" />
        </>
      ) : (
        <>
          <label className="text-sm">
            操作
            <select
              aria-label="采购操作"
              className={formInputClass}
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
            >
              <option value="receive" disabled={purchase.status === "received"}>
                分批收货
              </option>
              <option value="invoice">发票材料</option>
              <option value="details">更正购买明细</option>
              <option value="link">补关联库存（不入库）</option>
            </select>
          </label>
          {operation === "receive" ? (
            <>
              {field(
                "quantity",
                `本次收货（${purchase.unit}）`,
                "number",
                true,
              )}
              <label className="text-sm">
                库存处理
                <select
                  name="inventory"
                  value={inventory}
                  onChange={(e) => setInventory(e.target.value)}
                  className={formInputClass}
                >
                  <option value="none">不加入库存</option>
                  <option value="new">新建库存</option>
                  <option value="existing">补充已有库存</option>
                </select>
              </label>
            </>
          ) : null}
          {operation === "link" ||
          (operation === "receive" && inventory === "existing") ? (
            <label className="text-sm">
              库存来源
              <select
                name="inventoryItemId"
                required
                className={formInputClass}
              >
                <option value="">请选择</option>
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.unit}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {operation === "details" ? (
            <>
              {field("quantity", "实际购买数量", "number", true)}
              {field("actualAmount", "实际总金额（CNY）", "number")}
            </>
          ) : null}
          {operation === "invoice" ? (
            <>
              <label className="text-sm">
                发票状态
                <select
                  name="invoiceStatus"
                  className={formInputClass}
                  defaultValue={purchase.invoiceStatus}
                >
                  <option value="pending">待补</option>
                  <option value="available">已备齐</option>
                  <option value="not_required">无需发票</option>
                </select>
              </label>
              {field("invoiceReference", "发票编号／凭证信息")}
            </>
          ) : null}
        </>
      )}
      <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-3">
        {error ? (
          <p role="status" className="text-sm">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "保存中…" : purchase ? "确认操作" : "保存购买记录"}
        </Button>
      </div>
    </form>
  );
}
