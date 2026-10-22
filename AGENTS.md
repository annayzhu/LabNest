<!-- BEGIN:development-baseline -->
# 开发前先核对源码版本

- 每次开始开发或接手其他会话的工作前，先确认当前目录、分支和未提交文件，再执行 `git fetch origin`，核对 `git rev-list --left-right --count HEAD...origin/main`。
- `origin/main` 必须是当前开发分支的祖先。若落后或分叉，先保存全部未提交改动并合并最新主分支，再修改业务代码；多个会话同时编辑时，先协调暂停写入。
- 不要用 `reset --hard`、清理未跟踪文件或直接覆盖的方式同步共享开发目录。已经与 GitHub 一致的旧残留不应再次作为功能改动提交。
- 端口、Docker 镜像和源码目录是三项独立状态。发布完成后分别核对 GitHub 主分支、日常开发目录基线、运行服务版本；更新运行服务不代表源码目录已经更新。
- 同步后保留其他会话尚未提交的功能修改；明确列出当前开发功能与已发布版本的差异。

## 每次更新的完成条件

- 默认发布流程必须同时完成：将已验收的本批提交发布到 GitHub 主分支、同步 `~/Developer/LabNest` 的开发基线，并将同一提交部署到 3001；仅推送、仅部署或仅更新一个目录均不算完成。用户明确要求只做其中一项时，按当次要求执行并说明尚未同步的部分。
- 完成前重新读取并比对三处：GitHub main 的实际提交、开发目录 HEAD、3001 当前运行镜像的源码版本；三者必须一致。开发目录 `HEAD...origin/main` 应为 `0/0`，不可仅凭镜像标签推断源码相同。
- 核对部署源码、3001 健康状态和必要的页面行为，确认数据库、附件及运行配置保留。发布记录明确写出三处版本和验证结果；任一项未完成时，不得报告“已全部同步”。
- 其他会话未提交的开发修改应原样保留并单独说明，不得混入发布提交；若它们与已发布版本不同，应表述为“开发基线已同步，另有未提交开发内容”。
- Claude、Codex 或其他会话恢复开发前必须重新读取本文件与当前 Git 差异，以已同步的开发基线为准，不得沿用旧会话中的源码副本。
<!-- END:development-baseline -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
