qPCR 板布局规划工具｜离线便携版
qPCR Plate Layout Planner | Offline Portable Edition

使用方法 / How to use
1. 请保留并拷贝解压后的整个文件夹。Keep the entire extracted folder together.
2. 双击“Open_qPCR_Plate_Layout_Planner.html”即可打开。
   Double-click "Open_qPCR_Plate_Layout_Planner.html" to open the app.
3. 推荐使用最新版 Chrome、Edge 或 Safari。无需安装 Node、Python，也无需启动服务器。
   Use a current Chrome, Edge, or Safari. Node, Python, a server, and an internet connection are not required.
4. 单板 Excel 和批量 ZIP 会保存到浏览器的默认下载目录。
   Excel workbooks and batch ZIP files are saved to the browser's Downloads folder.

重要说明 / Notes
- 核心排板、反应用量计算和 Excel 导出均可离线使用。
  Layout planning, reaction calculations, and Excel export work offline.
- 384 孔板默认使用固定 9 mm 八道排枪隔行路径：先 A/C/E/G/I/K/M/O，再 B/D/F/H/J/L/N/P；使用 4.5 mm、自动化或单道设备时可切换为连续孔位。
  The 384-well default follows a fixed 9 mm 8-channel route: A/C/E/G/I/K/M/O, then B/D/F/H/J/L/N/P. Select sequential loading for 4.5 mm, automated, or single-channel workflows.
- 上样组以八连排为单位，不足八位留空；下一组从新八连排的首位开始。Z/N 切换整组行进顺序，技术复孔仍在同一行从左到右连续。
  Loading groups use eight-position strips, leaving unused positions empty. Each new group starts a new strip. Z/N changes strip traversal, while technical replicates remain contiguous left to right in one row.
- 可使用滚轮或百分比调整板子视图，支持框选、拖动画布、调整视窗高度和全屏。技术复孔设置位于板布局预览旁。
  Zoom the plate with the wheel or percentage input; box-select, pan, resize the viewport, or use fullscreen. Technical replicate settings are beside the layout preview.
- Sample_cDNA 表按当前样本输入列表排序；仅手动添加到孔板、未出现在输入列表中的样本排在末尾。
  Sample_cDNA follows the current sample input order; samples assigned manually only on the plate are appended.
- 反应计算器默认按实际移取的 10 µM 引物液计算终浓度；默认 10 µL 体系、每条引物 0.2 µL 时，终浓度为 200 nM，配液余量为 12%。
  The calculator defaults to 10 µM primer solutions as pipetted. At 0.2 µL per primer in a 10 µL reaction, each primer is 200 nM final, with 12% pipetting overage.
- 384 孔隔行布局可选择 A–H 八连排 gene mix 分装；每管按该通道实际孔数计算，Blank 替代水另行加入。
  For 384-well interleaved layouts, assay mix can be aliquoted across an A–H 8-tube strip using each channel's actual destination-well count; Blank replacement water is added separately.
- Thermo Fisher 与 Bio-Rad 的来源链接需要联网时才能打开，不影响其他功能。
  The Thermo Fisher and Bio-Rad source links require internet access; all other features remain available offline.
- “保存”使用当前电脑、当前浏览器的本地存储。更换浏览器、移动或重命名 HTML 后，原先保存的草稿可能不会自动出现。
  Save uses browser-local storage on the current computer. Drafts may not follow the file if you rename or move it, or switch browsers/computers.
- 只有点击“保存”后方案才会在下次打开时恢复；“重置工具”会清除本机保存记录并恢复初始状态。
  A plan is restored on the next visit only after you click Save. Reset tool clears the browser-saved plan and restores the defaults.
- 请使用脱敏样本名称；本工具不会主动上传样本名称。
  Use de-identified sample names. The tool does not actively upload sample names.
- 仅供科研使用。上机前请按试剂说明书和本地 SOP 人工核对。
  For research use only. Verify the final setup against the reagent instructions and local SOP before running the plate.
