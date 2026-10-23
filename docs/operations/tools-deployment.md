# Tools 部署说明

## 随 LabNest 部署的工具

| 工具 | Tools 入口 |
| --- | --- |
| Free Plate Layout Planner | `/tools/free-plate-layout/index.html` |
| qPCR Plate Layout Planner | `/tools/qpcr-plate-layout` |
| TaqMan CNV Plate Planner | `/tools/cnv-plate-layout` |
| Experimental Calculator | `/tools/calculator` |
| qPCR Analysis Studio | `/tools/qpcr-analysis` |
| CNV Analysis Studio | `/tools/cnv-analysis` |

这六个工具使用当前 LabNest 的域名和端口，在当前标签页打开。所需程序随仓库和 Docker 镜像提供，无需部署外部 Sites 服务。原有 `QPCR_LAYOUT_TOOL_URL`、`CNV_LAYOUT_TOOL_URL`、`QPCR_ANALYSIS_TOOL_URL`、`CNV_ANALYSIS_TOOL_URL` 不再改变入口，旧 `.env` 中保留这些变量也不会产生外部跳转。

qPCR 和 CNV 排板、两个分析工具通过本站 iframe 显示本地程序；Free Plate Layout 使用本站静态入口。工具自己的计算、文件导入和导出逻辑不因此改变。浏览器草稿按访问地址保存，原外部网站的草稿不会自动迁移；迁移前请在原工具导出可恢复的方案文件并保留原件。

## 单独部署 Visualization Studio

Visualization Studio 使用[独立仓库](https://github.com/annayzhu/Visualization-studio)。在部署机上准备 Node.js 22 和 npm，在独立目录运行：

```bash
git clone https://github.com/annayzhu/Visualization-studio.git
cd Visualization-studio
npm ci
npm run build:webpack
PORT=3400 HOSTNAME=0.0.0.0 npm run start
```

上述命令以前台方式启动服务。长期部署应由进程管理器或容器负责重启，并配置实际使用设备可达的域名、端口或反向代理。仅在同一台电脑访问时才使用 `localhost`；其他设备应使用服务器地址。

先在使用者的浏览器中直接打开 Studio，确认能看到绘图界面、载入示例并导出文件，再在 **LabNest 的 `.env`** 中填写真实地址。下面仅为格式示例：

```dotenv
VISUALIZATION_STUDIO_URL="https://studio.your-lab.example/"
```

然后在 **LabNest 目录** 更新应用容器，使 `.env` 重新注入：

```bash
docker compose up -d --build --force-recreate app
```

仅执行 `docker compose restart` 不会重新读取 Compose 的 `.env`。源码部署则重启 LabNest 服务；Studio 地址由服务器运行时读取，不需要为了修改这个地址重新构建 Studio。

如果把 Studio 放在域名子路径（例如 `/visualization-studio/`），须在构建 **Studio** 时设置 `NEXT_PUBLIC_VISUALIZATION_STUDIO_BASE_PATH`，并让反向代理保留该路径；详见[独立部署说明](https://github.com/annayzhu/Visualization-studio/blob/main/docs/engineering-integration.md)。`VISUALIZATION_STUDIO_URL` 应包含这个完整路径。

配置后，Tools 中的 Studio 在新标签页打开独立服务。留空或地址不合法时，`/tools/visualization` 显示配置提示，不会默认访问任何固定服务器。不要将这个入口页本身填为 Studio 地址，否则没有实际绘图服务可打开；该入口仅用于说明和旧配色迁移。

## 更新与验收

1. 更新 LabNest 并重新构建应用；部署者不需要运行工具源码打包脚本。
2. 从 `/tools` 分别打开六个内置工具，确认域名、端口不变，刷新仍可使用。
3. 在 qPCR 排板中用虚构样本测试导入、生成排板、确认和 Excel 导出，保留导出文件做回读检查。
4. 检查未配置 Studio 时的提示，以及配置后从 Tools 打开独立绘图页面的行为。
5. 在电脑、平板和手机宽度确认入口与工具可用。浏览器模拟不等同于真机验证。

维护者刷新 qPCR 内置发布物时，先在其源码仓库安装锁定依赖，然后在 LabNest 目录运行：

```bash
QPCR_PLANNER_SOURCE=/absolute/path/to/qPCR-Plate-Layout-Planner node scripts/sync-qpcr-planner.mjs
```

脚本从该仓库当前提交导出干净源码，在临时目录执行上游便携版构建及四项包验证，再写入 `public/tools/qpcr-plate-layout`。`release.json` 记录源提交、锁文件摘要与输出文件摘要；第三方许可随发布物保留。它不修改源仓库、源仓库的离线包或未提交工作。`scripts/sync-embedded-tools.mjs` 仍只刷新其他工具。
