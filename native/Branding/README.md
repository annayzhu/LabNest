# LabNest 原生 App 图标

图形直接复用 `src/components/TraditionalMotif.tsx` 的 `huiwen` SVG 路径、线宽与圆角。按用户指定的黑白配色，使用纯黑 `#000000` 底色和纯白 `#ffffff` 回纹。

`labnest-app-icon.svg` 是可编辑母版。回纹按原截图的留白比例居中：网页中的 18 px SVG 放在 36 px 底色中，对应母版将原 24 单位图形围绕中心缩放至 50%；包含笔画的白色图形约占图标宽度的 30.3%。底色铺满正方形，不预先绘制圆角或圆形遮罩，交由系统裁切。

从仓库根目录运行 `node scripts/build-native-app-icon.mjs`，输出 `native/SharedAssets.xcassets/AppIcon.appiconset/LabNest-1024.png`（1024 × 1024、RGB、不透明）。脚本使用项目已有的 sharp 依赖。PNG 已包含在源码中，Xcode 构建无需先运行 Node。

iPhone、配套 Watch 和原独立 Watch target 共用该资源目录及 `AppIcon` 名称。Xcode 自动生成各平台所需的图标尺寸。
