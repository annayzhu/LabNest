export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "sage";

export type RecordLifecycleStatus = "draft" | "recorded" | "submitted" | "reviewed";

export type ItemType =
  | "entry"
  | "experiment"
  | "protocol"
  | "protocol_version"
  | "project"
  | "entity"
  | "sample_profile"
  | "sample_lifecycle_event"
  | "inventory_item"
  | "result"
  | "purchase"
  | "procurement_inquiry"
  | "procurement_quote_line"
  | "reference_connector"
  | "sequence"
  | "attachment"
  | "protocol_run";

export type ProtocolParameter = {
  name: string;
  type: "number" | "text" | "select" | "entity" | "boolean";
  default?: string | number | boolean;
  unit?: string;
  required?: boolean;
  entity_type?: string;
  options?: string[];
};

export type ProtocolMaterial = {
  name: string;
  unit?: string;
  role?: string;
  notes?: string;
};

export type ProtocolStep = {
  order: number;
  title: string;
  description: string;
  requires_confirmation?: boolean;
  allows_deviation?: boolean;
};

export type ConsumptionRule = {
  material_name: string;
  formula: string;
  unit: string;
  requires_inventory_selection?: boolean;
};

export type ResultTemplateField = {
  name: string;
  type: "text" | "number" | "select" | "attachment[]" | "boolean";
  unit?: string;
  required?: boolean;
  options?: string[];
};

export type ResultTemplate = {
  result_type: string;
  fields: ResultTemplateField[];
};

export type ProtocolVersionData = {
  id: string;
  protocolId: string;
  versionNumber: number;
  recordStatus: RecordLifecycleStatus;
  createdFromVersionId?: string;
  changeSummary?: string;
  title: string;
  purpose: string;
  background: string;
  scope: string;
  notes: string;
  parameters: ProtocolParameter[];
  materials: ProtocolMaterial[];
  equipment: ProtocolMaterial[];
  steps: ProtocolStep[];
  consumptionRules: ConsumptionRule[];
  resultTemplates: ResultTemplate[];
  createdAt: string;
};

export type Protocol = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "active" | "retired" | "archived";
  recordStatus: RecordLifecycleStatus;
  tags: string[];
  currentVersion: ProtocolVersionData;
  versions: ProtocolVersionData[];
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed" | "archived";
  tags: string[];
};

export type Entry = {
  id: string;
  title: string;
  body: string;
  occurredAt: string;
  projectId?: string;
  projectName?: string;
  tags: string[];
  sourceType: "text" | "photo" | "file" | "voice" | "manual";
  recordStatus: RecordLifecycleStatus;
  moodStatus?: string;
  attachmentCount: number;
  relevantItems: RelevantItem[];
  pendingActionCount: number;
};

export type ExperimentStepRecord = {
  id: string;
  order: number;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  deviationNote?: string;
};

export type Experiment = {
  id: string;
  title: string;
  projectId?: string;
  projectName?: string;
  status: "planned" | "running" | "completed" | "failed" | "archived";
  recordStatus: RecordLifecycleStatus;
  date: string;
  purpose: string;
  background: string;
  materialsText: string;
  observations: string;
  resultSummary: string;
  conclusion: string;
  deviations: string;
  protocolVersionId?: string;
  protocolRunId?: string;
  tags: string[];
  steps: ExperimentStepRecord[];
};

export type InventoryItem = {
  id: string;
  name: string;
  entityId?: string;
  containerType?: string;
  barcode?: string;
  aliquotCode?: string;
  lotNumber?: string;
  vendor?: string;
  catalogNumber?: string;
  currentQuantity: number;
  unit: string;
  concentration?: string;
  location: string;
  positionCode?: string;
  parentInventoryItemId?: string;
  freezeThawCount?: number;
  expiryDate?: string;
  storageCondition?: string;
  status: "active" | "inactive" | "archived";
  notes?: string;
  lowThreshold?: number;
};

export type InventoryTransaction = {
  id: string;
  inventoryItemId: string;
  type:
    | "add"
    | "consume"
    | "transfer"
    | "adjust"
    | "discard"
    | "receive"
    | "aliquot"
    | "thaw"
    | "refreeze"
    | "qc"
    | "return";
  quantityChange: number;
  unit: string;
  fromLocation?: string;
  toLocation?: string;
  experimentId?: string;
  purchaseId?: string;
  proposedActionId?: string;
  notes?: string;
  createdAt: string;
};

export type SampleLifecycleStatus =
  | "registered"
  | "prepared"
  | "stocked"
  | "in_use"
  | "depleted"
  | "discarded"
  | "archived";

export type SampleLifecycleEventType =
  | "register"
  | "collect"
  | "prepare"
  | "aliquot"
  | "receive"
  | "store"
  | "transfer"
  | "thaw"
  | "refreeze"
  | "consume"
  | "qc"
  | "discard"
  | "result_link"
  | "note";

export type SampleWarning = {
  type: "expiry" | "low_quantity" | "freeze_thaw" | "missing_location" | "unlinked_result";
  severity: "watch" | "action";
  message: string;
};

export type SampleProfile = {
  id: string;
  entityId: string;
  name: string;
  sampleCode: string;
  sampleType: string;
  sourceLabel?: string;
  sourceType?: string;
  parentSampleId?: string;
  projectId?: string;
  projectName?: string;
  status: SampleLifecycleStatus;
  collectedAt?: string;
  preparedAt?: string;
  biosafetyLevel?: string;
  storageRequirement?: string;
  freezeThawCount: number;
  aliquotCount: number;
  totalQuantity: number;
  unit: string;
  primaryLocation?: string;
  relatedExperimentIds: string[];
  warnings: SampleWarning[];
  notes?: string;
};

export type SampleLifecycleEvent = {
  id: string;
  sampleProfileId: string;
  type: SampleLifecycleEventType;
  title: string;
  occurredAt: string;
  experimentId?: string;
  experimentTitle?: string;
  inventoryItemId?: string;
  aliquotCode?: string;
  fromLocation?: string;
  toLocation?: string;
  quantityChange?: number;
  unit?: string;
  notes?: string;
};

export type ProposedAction = {
  id: string;
  sourceType: "ai" | "protocol" | "entry" | "import" | "manual" | "system";
  sourceLabel: string;
  actionType:
    | "create_experiment"
    | "update_experiment"
    | "consume_inventory"
    | "create_entity"
    | "create_result"
    | "create_purchase_request"
    | "receive_purchase"
    | "link_attachment"
    | "link_item"
    | "create_inventory_item"
    | "create_protocol_run";
  status: "pending" | "accepted" | "rejected" | "edited" | "executed";
  confidence?: number;
  reason: string;
  payload: Record<string, unknown>;
  affectedItem?: string;
  createdAt: string;
};

export type RelevantItem = {
  id: string;
  type: ItemType;
  title: string;
  relation: string;
  createdBy: "user" | "system" | "ai";
  confidence?: number;
};

export type EntityRecord = {
  id: string;
  name: string;
  type:
    | "plasmid"
    | "primer"
    | "oligo"
    | "cell_line"
    | "antibody"
    | "protein"
    | "reagent"
    | "compound"
    | "bacteria"
    | "mixture"
    | "sample"
    | "other";
  code?: string;
  projectName?: string;
  status: "active" | "inactive" | "archived";
  description: string;
};

export type ResultRecord = {
  id: string;
  title: string;
  resultType: string;
  experimentTitle?: string;
  entityName?: string;
  projectName?: string;
  status: "active" | "inactive" | "archived";
  numericValue?: number;
  textValue?: string;
  unit?: string;
  notes?: string;
};

export type PurchaseRequest = {
  id: string;
  title: string;
  status: "planned" | "ordered" | "received" | "stocked" | "cancelled";
  vendor?: string;
  catalogNumber?: string;
  procurementQuoteLineId?: string;
  quantity: number;
  unit: string;
  price?: number;
  orderDate?: string;
  receivedDate?: string;
  notes?: string;
};

export type ProcurementInquiryStatus = "draft" | "quoted" | "selected" | "converted" | "archived";

export type ProcurementQuoteLineStatus =
  | "candidate"
  | "selected"
  | "not_selected"
  | "expired"
  | "rejected"
  | "duplicate"
  | "future_candidate"
  | "converted";

export type ProcurementSourceType = "excel" | "manual" | "school_template";

export type ProcurementInquiry = {
  id: string;
  title: string;
  status: ProcurementInquiryStatus;
  sourceType: ProcurementSourceType;
  projectId?: string;
  projectName?: string;
  importedFileName?: string;
  supplierScope?: string;
  quotedAt?: string;
  notes?: string;
  quoteLineIds: string[];
  createdAt: string;
};

export type ProcurementQuoteLine = {
  id: string;
  inquiryId: string;
  status: ProcurementQuoteLineStatus;
  supplierName?: string;
  productCategory?: string;
  productName: string;
  casNumber?: string;
  specification?: string;
  quantity: number;
  packageUnit: string;
  amountExclTax?: number;
  taxAmount?: number;
  unitPriceExclTax?: number;
  specialPurchaseNote?: string;
  capacity?: number;
  capacityUnit?: string;
  brand?: string;
  catalogNumber?: string;
  taxRate?: number;
  amountInclTax?: number;
  decisionReason?: string;
  selectedAt?: string;
  purchaseRequestId?: string;
};

export type SchoolSelfPurchaseRow = {
  "产品分类*": string;
  "商品名称*": string;
  CAS号: string;
  规格: string;
  "数量*": number;
  "包装单位*": string;
  "未税金额(元)*": number;
  "税额(元)*": number;
  "未税单价(元)": number;
  特殊购买情况说明: string;
  容量: number | "";
  容量单位: string;
};

export type SequenceRecord = {
  id: string;
  name: string;
  type: "DNA" | "RNA" | "Protein";
  sequence: string;
  description: string;
  linkedEntity?: string;
};

export type ActivityItem = {
  id: string;
  action: string;
  targetType: ItemType;
  targetTitle: string;
  createdAt: string;
  detail: string;
};

export type AIProviderRecord = {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "openai_compatible" | "manual_copy_paste";
  baseUrl?: string;
  maskedKey?: string;
  defaultModel?: string;
  capabilities: string[];
  enabled: boolean;
};

export type ReferenceConnectorRecord = {
  id: string;
  provider: "zotero" | "endnote";
  displayName: string;
  libraryScope?: string;
  baseUrl?: string;
  enabled: boolean;
  lastSyncedAt?: string;
  notes?: string;
};
