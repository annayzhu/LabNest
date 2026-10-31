# 外部样本库接口契约（v1）

日期：2026-10-31
对应问题：S16
状态：S16 定契约；S17–S30（2026-10-31，[方案](../sample-bank-20261031/PLAN.md)）实现了 LabNest 一侧：连接配置、发出检索、接收推送、存档、结果页与导入。还没有连接真实样本库，用模拟样本库 `scripts/mock-sample-bank.ts` 验证。

契约版本：`labnest.sample-bank/v1`。代码里的校验器在 `src/lib/sample-bank/contract.ts`，连接器接口在 `src/lib/sample-bank/connector.ts`。本文每个 JSON 示例都由 `src/lib/sample-bank/contract.test.ts` 按其上方注明的结构校验，文档和代码不会各说各的。

## 1. 流程

1. 用户在 LabNest 的样本模块发起检索。LabNest 生成请求号（`sbr_…`），把检索条件和回传地址 POST 给现有样本库。
2. 样本库立即回答“已接受”或“拒绝及原因”（同步应答）。
3. 样本库在自己的系统里检索，把结果分页推送到回传地址：每页最多 500 条，同一检索的各页带同一请求号。
4. LabNest 按请求号归档推送结果，用户查看后选择导入为样本。

导入时以「外部来源 `source` + 外部编号 `externalId`」识别同一个样本：两者在 LabNest 的样本表上联合唯一，以后再推送同一个样本时更新这一条，不新建。

## 2. 检索请求（LabNest → 样本库）

`POST {样本库地址}/searches`，`Content-Type: application/json`。

<!-- schema: searchRequest -->
```json
{
  "contract": "labnest.sample-bank/v1",
  "requestId": "sbr_7f3aK2Lq9xZ4",
  "requestedAt": "2026-10-31T08:00:00+08:00",
  "requestedBy": "zhuanna",
  "callbackUrl": "https://labnest.lab.local/api/sample-bank/results",
  "query": {
    "text": "ESCC",
    "sampleTypes": ["sample_tissue", "sample_serum"],
    "disease": "食管鳞癌",
    "collectedFrom": "2024-01-01",
    "collectedTo": "2026-10-31",
    "attributes": { "pathology": "鳞癌" }
  },
  "limit": 500
}
```

| 字段 | 说明 |
|---|---|
| `requestId` | LabNest 生成，`sbr_` 加 8–64 位字母、数字、`_`、`-`。也是幂等键：同一请求号重复发送，样本库应视为同一次检索。 |
| `callbackUrl` | 结果推送地址。 |
| `query` | 至少一个条件。`sampleTypes` 可以是 LabNest 的类型键（`sample_tissue`…），也可以是样本库自己的类型词。`attributes` 为任意键值筛选。日期写成 `2026-10-31`。 |
| `limit` | 最多返回多少条，1–5000，默认 500。 |

## 3. 同步应答（样本库 → LabNest）

接受：

<!-- schema: searchAck -->
```json
{
  "contract": "labnest.sample-bank/v1",
  "requestId": "sbr_7f3aK2Lq9xZ4",
  "accepted": true,
  "bankRequestId": "BBQ-20261031-0042"
}
```

拒绝时 `accepted` 为 `false`，并说明原因：

<!-- schema: searchAck -->
```json
{
  "contract": "labnest.sample-bank/v1",
  "requestId": "sbr_7f3aK2Lq9xZ4",
  "accepted": false,
  "error": { "code": "invalid_request", "message": "collectedFrom is after collectedTo." }
}
```

## 4. 结果推送（样本库 → LabNest）

`POST {callbackUrl}`。每页最多 500 条，同一检索的各页带同一 `requestId`；最后一页 `status` 为 `complete`。同一页重复推送时 LabNest 只记一次。

<!-- schema: resultPush -->
```json
{
  "contract": "labnest.sample-bank/v1",
  "requestId": "sbr_7f3aK2Lq9xZ4",
  "bankRequestId": "BBQ-20261031-0042",
  "page": 1,
  "pageCount": 1,
  "status": "complete",
  "total": 2,
  "records": [
    {
      "source": "hospital-biobank",
      "externalId": "BB-2024-000123",
      "name": "P001-T",
      "sampleType": "sample_tissue",
      "origin": "P001",
      "collectedAt": "2024-05-12",
      "amount": { "value": 50, "unit": "mg" },
      "location": "3号冰箱 / B架 / 12盒 / A5",
      "biosafetyLevel": "BSL-2",
      "attributes": { "site": "食管中段", "pathology": "鳞癌", "stage": "IIIA" },
      "updatedAt": "2026-10-30T12:00:00+08:00"
    },
    {
      "source": "hospital-biobank",
      "externalId": "BB-2024-000124",
      "name": "P001-RNA",
      "sampleType": "RNA",
      "origin": "P001",
      "parentExternalId": "BB-2024-000123",
      "amount": { "value": 30, "unit": "µL" },
      "concentration": { "value": 412.5, "unit": "ng/µL" },
      "attributes": { "rin": "8.1" }
    }
  ]
}
```

检索失败时也推送一页，`status` 为 `failed` 并带 `error`：

<!-- schema: resultPush -->
```json
{
  "contract": "labnest.sample-bank/v1",
  "requestId": "sbr_7f3aK2Lq9xZ4",
  "page": 1,
  "pageCount": 1,
  "status": "failed",
  "records": [],
  "error": { "code": "bank_unavailable", "message": "The bank database is in maintenance until 22:00." }
}
```

### 4.1 样本记录

| 字段 | 必填 | 说明 | 导入 LabNest 时 |
|---|---|---|---|
| `source` | 是 | 样本库的短名，小写字母、数字、`.` `_` `-` | 外部来源 |
| `externalId` | 是 | 样本在样本库里的稳定编号 | 外部编号；与 `source` 联合唯一 |
| `code` | 否 | 希望在 LabNest 使用的编号 | 编号（未被占用时）；否则按类型前缀自动编号 |
| `name` | 是 | 显示名称 | 名称 |
| `sampleType` | 是 | 类型键或类型名 | 按类型键、名称、前缀匹配，匹配不到记为“其他”并提示 |
| `origin` | 否 | 来源个体（患者、动物等） | 来源 |
| `parentExternalId` | 否 | 母样本在样本库里的编号 | 同一批导入或已导入时连成母样本 |
| `collectedAt` | 否 | 采集日期 `2024-05-12` | 日期 |
| `amount` / `concentration` | 否 | `{ value, unit }` | 体积/量、浓度 |
| `location` | 否 | 样本库里的存放位置原文 | 写入备注，不映射到 LabNest 的库位 |
| `biosafetyLevel` | 否 | `BSL-1` / `BSL-2` / `BSL-3` | 生物安全等级 |
| `attributes` | 否 | 其余属性，键值都是文字 | 与类型字段同名的进入类型字段，其余写入备注 |
| `updatedAt` | 否 | 样本库最后修改时间 | 以后用于判断是否需要更新 |

### 4.2 LabNest 的应答

收下一页时回 200；同一页再推送一次时同样回 200，并带 `duplicate: true`，样本库不必重推：

<!-- schema: pushReceipt -->
```json
{
  "contract": "labnest.sample-bank/v1",
  "requestId": "sbr_7f3aK2Lq9xZ4",
  "page": 1,
  "received": true
}
```

## 5. 错误

错误对象：`{ "code": …, "message": … }`。

| `code` | 含义 |
|---|---|
| `invalid_request` | 请求不符合本契约 |
| `unauthorized` | 鉴权失败 |
| `unknown_request` | 推送的请求号 LabNest 没有发出过 |
| `too_many_records` | 超过单页 500 条或 `limit` |
| `bank_unavailable` | 样本库暂不可用 |
| `internal_error` | 其他内部错误 |

LabNest 拒绝推送时的应答：

<!-- schema: error -->
```json
{
  "contract": "labnest.sample-bank/v1",
  "requestId": "sbr_7f3aK2Lq9xZ4",
  "error": { "code": "unknown_request", "message": "LabNest did not send this request." }
}
```

## 6. 鉴权与传输

- 只在实验室内网传输，能用 HTTPS 时用 HTTPS。
- 检索请求带样本库给的令牌：`Authorization: Bearer <样本库令牌>`。LabNest 把它和 AI 服务密钥一样加密保存，设置页只显示末四位。
- 推送带 LabNest 的推送令牌：`Authorization: Bearer <推送令牌>`。推送令牌在 LabNest 设置页生成，只显示一次，重新生成后旧的立即失效。
- 推送另带签名 `X-LabNest-Signature: sha256=<hex>`。签名是以推送令牌为密钥、对原始请求体计算的 HMAC-SHA256，LabNest 先校验签名再处理。
- LabNest 只接受自己发给这个样本库的请求号，而且记录的 `source` 必须是这个样本库的短名。同一请求号的同一页只处理一次，几页先后到达的顺序不限，全部页到齐才算完成。
- 拒绝时回第 5 节的错误：令牌或签名不对、连接已关闭为 401/403 `unauthorized`；格式不对为 400 `invalid_request`；超过 500 条为 413 `too_many_records`；请求号不认识为 404 `unknown_request`。每次拒绝都写进活动日志，不记录请求体。

## 7. 接入真实样本库（S30）

LabNest 一侧已经就绪。接入时先请样本库管理员确认：

1. 能按本契约实现 `POST /searches` 和推送：在设置里填地址、短名、样本库令牌，把推送令牌交给对方，再发一次测试检索。
2. 已有自己的接口：在 LabNest 写一个适配它的 `SampleBankConnector`，本契约中 LabNest 这一侧不变。
3. 只能导出表格：过渡期用样本的表格导入，另加「外部来源」「外部编号」两列。
