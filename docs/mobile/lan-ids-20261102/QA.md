# 手机上“添加事项”无反应：局域网 HTTP 下没有 crypto.randomUUID

日期：2026-11-02  
来源：用户反馈“手机端多日实验规划中，Add item 按钮似乎是失灵的”。

## 原因

手机通过 `http://192.168.0.106:3001` 打开 LabNest。这不是安全上下文（`isSecureContext === false`），浏览器不提供 `crypto.randomUUID`。日程的“添加事项”、拆分和“按规程排出初稿”都用它生成新段的编号，点按后抛出 `TypeError: crypto.randomUUID is not a function`，页面没有任何变化。桌面用 `localhost` 打开时是安全上下文，所以桌面上正常。

在 3001 上以手机宽度、局域网地址复现：控制台报上述错误，日程没有新卡片。

同样的调用还在两处浏览器代码里：
- 说明书识别的拍照/选图列表；
- 编辑规程表格时给没有编号的行补编号。

## 修改

- 以上三处改用已有的 `newClientMutationId` / `prefixedClientId`（`src/lib/client-mutation-id.ts`）。它在没有 `randomUUID` 时用 `getRandomValues` 生成 UUIDv4，原本就是为局域网 HTTP 写的。
- `client-mutation-id.test.ts` 新增一项检查：除 `*.server.ts` 外，源码里不许再直接调用 `crypto.randomUUID()`。

## 验证

- `npx tsc --noEmit`、改动文件 `eslint` 通过；`npx vitest run` 1809 项全部通过。
- `verify-lan-ids.mjs`：在 3004（`labnest_tidy_20261102`）上，390 px，先删掉 `Crypto.prototype.randomUUID` 再打开页面，模拟手机的局域网访问。检查项：
  - 工具栏的“添加事项”打开事项面板；
  - 当天的“添加事项”加出第二项；
  - “按规程排出初稿”排出 1 段；
  - 识别页选一张图后列表显示 1 张。

  没有页面错误，也没有写请求。截图 `lan-add-item-390.png`。
- 未在真机上验证：3004 是开发服务，手机无法通过局域网加载它的资源。
