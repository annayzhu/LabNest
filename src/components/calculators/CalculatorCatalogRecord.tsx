"use client";
import { useI18n } from "@/components/I18nProvider";
import { CalculatorCatalog } from "./CalculatorCatalog";
import { useCalculatorRecordBridge } from "./useCalculatorRecordBridge";

/** The catalog inside a record's tool workspace; choosing a calculation keeps the record connection. */
export function CalculatorCatalogRecord({ contextQuery }: { contextQuery: string }) {
  const { locale } = useI18n();
  useCalculatorRecordBridge({ active: true, zh: locale === "zh" });
  return <main className="min-h-screen bg-warm/35 p-3 sm:p-5"><CalculatorCatalog contextQuery={contextQuery} /></main>;
}
