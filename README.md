# LabNest · 研巢

## 系统功能

LabNest 是面向个人研究者与小型实验室的实验设计与执行平台，将研究目标、方法准备、体系计算、实验操作和结果整理连接在同一工作区。系统支持本地部署，核心实验流程可在关闭 AI 的情况下使用。

**研究目标 → 方法检索与比较 → Protocol 整理 → 体系与配液准备 → 分步执行 → 结果与报告 → 方法复用**

| 功能 | 可以完成的工作 |
| --- | --- |
| 项目与研究计划 | 组织研究目标、研究计划和实验，关联 Protocol、记录、结果与报告，保留各环节的来源关系。 |
| 方法设计与 Protocol | 从实验目标检索方法、比较条件并整理草稿；编辑结构化章节、步骤、参数和图片，导入 DOCX，管理通用方法及项目适配版本。实验保留所采用的具体方法版本。 |
| 实验准备与执行 | 确认实验体系、换算用量、生成配液与操作清单；按步骤执行，使用计时器，记录实际参数、观察和附件，保存进度并继续实验。 |
| 记录、结果与报告 | 使用富文本、表格、图片和附件整理实验记录；关联结果数据与来源实验，编写报告，按模块导出 CSV、XLSX、JSON、Markdown，或生成 DOCX、打印为 PDF。 |
| 实验计算器 | 提供浓度与稀释、溶液配制、Master Mix、细胞铺板、转染、菌落计数和曲线拟合等工具，支持单位换算、预设、草稿和历史结果；可从实验步骤或孔板调用。 |
| 孔板规划与数据分析 | 规划多块孔板、样本和重复，汇总配液并导出移液工作表；提供 qPCR、TaqMan CNV 排板与分析工具入口，以及独立 Visualization Studio 的连接入口。 |
| 物料与序列管理 | 管理试剂、耗材和样本的存放位置、数量与使用记录，跟踪库存变动、询价和采购；维护序列资料及其关联记录。 |
| 可选 AI 辅助 | 辅助方法整理、Protocol 识别和记录解析，生成可审核的草稿与建议。支持 OpenAI、Anthropic、OpenAI 兼容服务及 Dify，也支持手动复制粘贴。 |
| 多设备使用 | 浏览器界面适配电脑、平板和手机；支持实验台操作、局部离线记录和恢复联网后的同步。仓库另提供 iPhone / Apple Watch 配套工程，用于连接实验及查看步骤和计时。 |

全局搜索可查找实验、方法、记录和物料等内容。附件随关联记录保存；字体、主题及常用工具可按个人习惯设置。

## 部署和运行

### Docker 部署

适用于本机或可信内网。准备 Git、Docker 和 Docker Compose v2；Docker Desktop 已包含 Compose。默认使用 PostgreSQL 16，网页访问端口为 **3001**，数据库端口为 **5432**。

**1. 获取代码并创建配置文件**

```bash
git clone https://github.com/annayzhu/LabNest.git
cd LabNest
cp .env.example .env
```

**2. 设置密钥**

运行以下命令生成密钥，将输出填入 `.env` 的 `LABNEST_AI_ENCRYPTION_KEY`，替换示例占位值：

```bash
openssl rand -hex 32
```

该密钥用于加密保存 AI 服务凭据，Compose 启动时要求设置。请妥善保留，升级时沿用原值。

**3. 启动服务**

```bash
docker compose up -d --build app
docker compose logs -f app
```

启动脚本会生成 Prisma Client、应用数据库迁移并构建网页。首次启动需要等待构建完成；看到服务就绪后，用 `Ctrl+C` 退出日志查看，后台服务会继续运行。

打开 [http://localhost:3001](http://localhost:3001)。检查服务状态：

```bash
docker compose ps
curl --fail http://localhost:3001/api/health
```

健康接口应返回 `status: "ok"` 和 `database: "reachable"`。如果 3001 已被占用，可在 `.env` 中添加 `LABNEST_HOST_PORT=3002`，再启动并访问对应端口；容器内部仍使用 3000。

### 本地源码运行

准备 **Node.js 22、npm 和 PostgreSQL 16**。先完成上面的代码下载、`.env` 创建与密钥设置；如果使用 Compose 提供数据库，只启动 PostgreSQL：

```bash
docker compose up -d postgres
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run dev
```

打开 [http://localhost:3001](http://localhost:3001)。使用已有 PostgreSQL 时，将 `.env` 的 `DATABASE_URL` 改为自己的连接地址，并省略启动数据库的命令。

构建并运行生产版本：

```bash
npm run build
npm run start
```

开发服务与生产服务应分别运行。需要和已有 3001 服务并行时，在 macOS / Linux 使用 `PORT=3002 npm run dev` 或 `PORT=3002 npm run start`。Windows 源码运行建议使用 WSL2。

日常部署无需执行种子脚本。`npm run prisma:seed` 会先清理已有业务记录再写入演示数据，仅用于可丢弃的演示数据库。

### 配置与首次使用

| 配置项 | 用途 |
| --- | --- |
| `DATABASE_URL` | 源码运行时的 PostgreSQL 连接地址。Compose 内的应用使用 `docker-compose.yml` 中指向 `postgres` 的连接地址；默认数据库名、用户名和密码均为 `labnest`，自定义时需同步修改数据库及应用配置。 |
| `LABNEST_AI_ENCRYPTION_KEY` | AI 凭据加密密钥，使用 `openssl rand -hex 32` 生成。 |
| `LABNEST_ATTACHMENT_ROOT` | 源码运行时的附件目录，默认 `./storage/attachments`；Compose 使用持久化附件卷。 |
| `LABNEST_HOST_PORT` | Docker 网页端口，默认 `3001`。源码运行通过 `PORT` 调整。 |
| `TZ` | Compose 的服务器时区，默认 `Asia/Shanghai`。 |
| `VISUALIZATION_STUDIO_URL` | 独立 Visualization Studio 的地址，应能被实际使用设备访问；该应用需单独部署。 |

Tools 中的三个排板工具、实验计算器、qPCR Analysis 和 CNV Analysis 均随 LabNest 部署，在本站打开，无需另外配置网址。旧的四项 `*_TOOL_URL` 配置不再改变这些入口。

Visualization Studio 单独部署后，将其实际访问网址填入 `VISUALIZATION_STUDIO_URL`；留空时显示配置提示。具体部署、容器更新和验收步骤见 [Tools 部署说明](docs/tools-deployment.md)。

首次使用可从创建项目、研究计划和 Protocol 开始，再创建实验并进入准备与执行页面。需要 AI 时，在侧栏的 **AI settings** 中配置服务地址、模型和凭据，测试连接后启用；AI 服务的 API 凭据与上述加密密钥是两项不同配置。

电脑、平板和手机访问同一服务器地址即可使用网页；其他设备应填写服务器的局域网地址，而不是 `localhost`。需要内网 HTTPS 时，在 `.env` 设置 `LABNEST_HTTPS_HOST`，再运行：

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

此配置使用 Caddy 的本地证书机构，客户端需安装并信任其根证书。iPhone / Apple Watch 原生配套应用需通过 Xcode 单独构建与安装，步骤见 [配套应用安装说明](native/LabNestMobile/README.md)。

### 更新与日常维护

Docker 使用命名卷保存数据库和附件，更新应用会沿用这些数据。更新前先备份（见下文“备份与恢复”）并另存 `.env`，然后在仓库目录执行：

```bash
git pull --ff-only origin main
docker compose up -d --build app
docker compose ps
curl --fail http://localhost:3001/api/health
```

查看日志使用 `docker compose logs -f app`；暂停服务使用 `docker compose stop`，重新启动使用 `docker compose start`。保留数据时不要使用 `docker compose down -v`，因为它会删除数据库和附件卷。

源码部署更新后，依次运行 `npm ci`、`npx prisma migrate deploy`、`npm run build`，再重新启动服务。更换访问地址或端口前，先在原地址完成待同步操作；浏览器草稿和离线队列按访问地址分别保存。

### 备份与恢复

LabNest 每天 03:00 自动备份一次，内容是全部数据库表和全部附件文件；当时电脑在睡眠的话，醒来后补做。Docker 部署默认存到本机的 `~/LabNest备份`，在 Docker 卷之外；要换位置（例如 iCloud 云盘或移动硬盘），在 `.env` 中设置 `LABNEST_BACKUP_HOST_DIR=/完整/路径` 后重新启动 app。源码运行时用 `LABNEST_BACKUP_ROOT` 指定文件夹；不设置则不备份。

- **设置 → 备份**：上次成功备份的时间、位置与占用空间，“立即备份”，每份备份的下载（.zip）。超过 36 小时没有成功备份或最近一次失败时，总览页顶部会提醒。
- **保留**：最近 7 天的全部备份，以及再往前 4 周每周一份；附件文件只存一份，所有备份共用。
- **检查**：每份备份做完后都会还原到一个临时数据库，通过后才标为“已验证”。
- **恢复**：恢复会替换整个数据库，在命令行进行，并先自动把当前状态备份一份：

```bash
docker exec -it labnest-app npx tsx scripts/restore-backup.ts
docker exec -it labnest-app npx tsx scripts/restore-backup.ts <备份编号> --yes
```

第一条列出备份，第二条恢复其中一份。下载的 .zip 解压后与备份文件夹结构相同，把 `LABNEST_BACKUP_ROOT` 指向它即可恢复。备份不包含 `.env` 中解密 AI 密钥用的 `LABNEST_AI_ENCRYPTION_KEY`：换电脑恢复后，在 AI 设置里重新填写 API 密钥。只存在浏览器里的内容（计算器配方与计算记录、常用任务、外观设置、Entry 未保存的草稿）不在备份中。
