import { experimentSections, normalizeScientificDocument, reportSections, researchPlanSections, resultSections, type ScientificDocument } from "./scientific-document";
import { resultDocumentWithLegacyValues, resultLegacyValuesArePromoted } from "./result-document";
import type { ToolOwner } from "./tool-workflow";

const sections = { result: resultSections, experiment: experimentSections, research_plan: researchPlanSections, report: reportSections };

type SavedRecord = { contentJson: unknown; metadataJson?: unknown; numericValue?: unknown; unit?: string | null; textValue?: string | null; notes?: string | null };

/**
 * The saved record as its form builds it, so a tool save merges like with like: the same sections and block ids, and for
 * an older result the values still kept in its columns, which would otherwise vanish from the page.
 */
export function savedRecordDocument(ownerType: Exclude<ToolOwner["ownerType"], "entry">, record: SavedRecord): ScientificDocument {
  const document = normalizeScientificDocument(record.contentJson, sections[ownerType]);
  if (ownerType !== "result" || resultLegacyValuesArePromoted(record.metadataJson)) return document;
  return resultDocumentWithLegacyValues(document, { numericValue: record.numericValue == null ? null : Number(record.numericValue), unit: record.unit, textValue: record.textValue, notes: record.notes });
}
