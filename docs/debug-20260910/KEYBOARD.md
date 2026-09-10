# 快捷键与环境边界

本轮本机为macOS、Playwright Chromium。事件由浏览器发送；没有使用内部Editor对象直接执行被测格式命令。

|功能|macOS目标|本轮证据|Windows/Linux目标|
|---|---|---|---|
|加粗/斜体/下划线|Cmd+B/I/U|paragraph-browser.json，选区标记核验|Ctrl+B/I/U，真实系统未执行|
|剪切|Cmd+X|clipboard-browser.json，移除并可撤销|Ctrl+X，真实系统未执行|
|撤销/重做|Cmd+Z、Cmd+Shift+Z|剪切和缩进均验|Ctrl+Z、Ctrl+Shift+Z（Ctrl+Y兼容未执行）|
|复制|Cmd+C或菜单|复制菜单及Cmd+C读取剪贴板、编辑区Cmd+A范围均通过|Ctrl+C未执行|
|格式粘贴|Cmd+V|原生ClipboardItem HTML→真实键位；标题/列表/表格/符号及保存回读|Ctrl+V真实系统未执行|
|纯文本粘贴|Cmd+Shift+V或菜单|当前Chromium默认键位未触发（保留红例）；编辑区复用菜单逻辑后快捷键、换行/符号/拒绝保护回归通过|Ctrl+Shift+V未执行|
|全选|编辑区Cmd+A|浏览器Cmd+A选区仍局限在编辑器|Ctrl+A未执行|
|列表层级|Tab/Shift+Tab|paragraph-browser.json|保持编辑器原键位|
|表格下一格|Tab|实际选中下一格内容|保持编辑器原键位|
|普通段落缩进|段落菜单增减|混合选区0–8、撤销重做及保存|不全局劫持Tab|

字号、颜色、段落对齐等仍有可见菜单。没有新增全站键盘拦截。未验证的物理输入/系统快捷键不能记成通过；不影响对应菜单已执行的结果。真实中文IME和手机软键盘见MANUAL-ACCEPTANCE.md。
