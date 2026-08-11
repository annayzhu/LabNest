export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "sage";

export type RecordLifecycleStatus = "draft" | "recorded" | "submitted" | "reviewed";

export type ItemType =
  | "entry"
  | "experiment"
  | "protocol"
  | "protocol_version"
  | "project"
  | "research_plan"
  | "report"
  | "tool"
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

export type ResultFieldDataType = "text" | "number" | "select" | "attachment[]" | "boolean" | "date" | "datetime";
export type ResultDatasetColumnType = "text" | "number" | "category" | "boolean" | "date" | "datetime";
export type ResultSemanticRole = "identifier" | "design" | "group" | "label" | "measurement" | "qc" | "annotation";
export type ResultCardinality = "single" | "per_run" | "per_sample" | "per_timepoint" | "repeatable";
export type ResultKind = "measurement" | "assay" | "imaging" | "blot" | "flow_cytometry" | "omics" | "observation";
export type ResultViewPreset = "generic" | "qpcr" | "imaging" | "blot" | "flow" | "timeseries" | "omics";

export type ResultTemplateField = {
  key?: string;
  label?: string;
  dataType?: ResultFieldDataType;
  /** Legacy aliases retained for imported Protocols and older snapshots. */
  name?: string;
  type?: ResultFieldDataType;
  unit?: string;
  required?: boolean;
  options?: string[];
  semanticRole?: ResultSemanticRole;
  description?: string;
  validation?: { min?: number; max?: number; pattern?: string };
};

export type ResultDatasetColumn = {
  key: string;
  label: string;
  dataType: ResultDatasetColumnType;
  required?: boolean;
  unit?: string;
  semanticRole?: ResultSemanticRole;
};

export type ResultTemplateDataset = {
  key: string;
  label: string;
  required?: boolean;
  columns: ResultDatasetColumn[];
};

export type ResultTemplateArtifact = {
  key: string;
  label: string;
  kind: "file" | "image" | "video";
  required?: boolean;
};

export type ResultChartSpec = {
  key: string;
  label: string;
  type: "bar" | "line" | "scatter";
  datasetKey: string;
  xField: string;
  yField: string;
  seriesField?: string;
};

export type ResultTemplate = {
  result_type: string;
  templateKey?: string;
  schemaVersion?: number;
  title?: string;
  description?: string;
  resultKind?: ResultKind;
  cardinality?: ResultCardinality;
  fields: ResultTemplateField[];
  datasets?: ResultTemplateDataset[];
  artifacts?: ResultTemplateArtifact[];
  view?: {
    preset?: ResultViewPreset;
    primaryMetric?: string;
    groupBy?: string;
    charts?: ResultChartSpec[];
  };
};

export type ProtocolVersionData = {
  id: string;
  protocolId: string;
  revision: number;
  displayVersion: string;
  reviewStage: "draft" | "ready_for_review" | "reviewed";
  recordStatus: RecordLifecycleStatus;
  previousVersionId?: string;
  derivedFromVersionId?: string;
  adaptationRationale?: string;
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
  humanCode?: string;
  title: string;
  canonicalTitle?: string;
  description: string;
  availability: "draft" | "active" | "retired" | "archived";
  scope: "general" | "project";
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

export type ResearchPlan = {
  id: string;
  projectId: string;
  projectName?: string;
  code?: string;
  title: string;
  objective?: string;
  hypothesis?: string;
  rationale?: string;
  design?: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  tags: string[];
};

export type EntryAttachment = {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  sha256?: string;
  metadata?: Record<string, unknown>;
  derivativeKind?: string;
};

export type Entry = {
  id: string;
  title: string;
  body: string;
  occurredAt: string;
  projectId?: string;
  projectName?: string;
  researchPlanId?: string;
  researchPlanTitle?: string;
  tags: string[];
  sourceType: "text" | "photo" | "file" | "voice" | "manual";
  recordStatus: RecordLifecycleStatus;
  archivedAt?: string;
  moodStatus?: string;
  attachmentCount: number;
  attachments?: EntryAttachment[];
  relevantItems: RelevantItem[];
  linkedItemCount?: number;
  pendingActionCount: number;
  contentMarkdown?: string;
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
  primaryProtocolVersionId?: string;
  protocolRunId?: string;
  tags: string[];
  steps: ExperimentStepRecord[];
};

export type InventoryItem = {
  id: string;
  name: string;
  englishName?: string;
  category?: string;
  brand?: string;
  principalInvestigator?: string;
  entityId?: string;
  containerType?: string;
  barcode?: string;
  aliquotCode?: string;
  lotNumber?: string;
  vendor?: string;
  catalogNumber?: string;
  casNumber?: string;
  currentQuantity: number;
  unit: string;
  lowThreshold?: number;
  concentration?: string;
  location: string;
  positionCode?: string;
  parentInventoryItemId?: string;
  freezeThawCount?: number;
  expiryDate?: string;
  storageCondition?: string;
  status: "active" | "inactive" | "archived";
  notes?: string;
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
  performedBy?: string;
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
