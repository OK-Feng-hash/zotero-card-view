# Zotero Card View / Zotero 文献卡片视图

[中文](#中文说明) · [English](#english)

## 中文说明

Zotero Card View 是面向 Zotero 9 的文献卡片视图插件。它把中央文献列表切换为可排序的卡片网格，同时保留 Zotero 原生的分类、搜索、选择、右键菜单、附件打开和右侧信息编辑流程。

### 主要功能

- 卡片摘要显示题名、文献日期、期刊、影响因子、中科院/SCI 分区、评级和标签。
- 展开卡片后显示完整题名、可折叠摘要、关键词、作者、标签类别、所属集合、笔记、附件、DOI 和 URL。
- 支持按文献日期、文献名、期刊影响因子和评级升序或降序排列。
- 支持单选、多选、右键菜单、双击/Enter 打开附件，并同步 Zotero 原生右侧信息面板。
- 可读取 Zotero Style 已加载的期刊指标及其显示颜色；也可从 Zotero `Extra` 字段读取显式保存的指标作为后备。
- 大型文献库采用分批渲染、按需详情和节点复用，降低界面卡顿。

### 安装

1. 从 GitHub [Releases](https://github.com/OK-Feng-hash/zotero-card-view/releases) 下载最新 `.xpi`。
2. 在 Zotero 中打开“工具 → 插件”。
3. 点击右上角齿轮，选择“Install Plugin From File…”并选中 `.xpi`。
4. 在文献库工具栏点击卡片图标切换列表视图与卡片视图。

当前版本为公开测试版，建议首次使用前备份 Zotero 数据目录，并在 [Issues](https://github.com/OK-Feng-hash/zotero-card-view/issues) 报告问题。

### 隐私

- 文献题名、摘要、笔记、附件和标识符只在本机 Zotero 中读取和显示。
- 插件不建立第二套文献数据库，也不上传文献内容。
- 插件仅访问 GitHub 上的公开 `updates.json` 以检查自身更新。
- Zotero Style 可能按其自身设置联网刷新期刊指标；本插件不会触发该请求，也不会读取或传输 Zotero Style 的密钥。

### 开发

```powershell
npm test
npm run build
```

生成的安装包位于 `build/`。模块职责与性能设计见 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

## English

Zotero Card View is a Zotero 9 plugin that turns the central library item list into a sortable literature-card grid while preserving Zotero's native collections, search, selection, context menu, attachment opening, and right-side editing workflows.

Cards show title, date, publication, journal metrics, rating, and tags. Expanded cards add the full title, collapsible abstract, keywords, creators, collections, notes, attachments, DOI, and URL. Sorting is available by publication date, title, impact factor, and rating.

The plugin reads library data locally. It does not upload titles, abstracts, notes, attachments, or identifiers. Zotero Style metrics are read from its already-loaded cache when available; this plugin does not read or transmit Zotero Style credentials.

Install the latest `.xpi` from [Releases](https://github.com/OK-Feng-hash/zotero-card-view/releases). This is currently a public beta.

## License

[MIT](LICENSE)

