# Zotero Card View / Zotero 文献卡片视图

[中文](#中文说明) · [English](#english)

## 中文说明

Zotero Card View 是面向 Zotero 9 的文献卡片视图插件。它把中央文献列表切换为可排序的卡片网格，同时保留 Zotero 原生的分类、搜索、选择、右键菜单、附件打开和右侧信息编辑流程。

### 主要功能

- 卡片摘要显示题名、文献日期、期刊、影响因子、中科院/SCI 分区、评级和标签。
- 展开卡片后显示完整题名、可折叠摘要、关键词、作者、标签类别、所属集合、笔记、附件、DOI 和 URL。
- 可从 15 个字段中勾选常用排序项目，并在卡片顶部快捷切换；支持升序或降序，设置会在重启后保留。
- 可只读镜像 Ethereal Style 的分页阅读进度，在卡片标题背景中显示与其颜色、透明度一致的深浅色块。
- 支持单选、多选、右键菜单、双击/Enter 打开附件，并同步 Zotero 原生右侧信息面板。
- 进入 PDF 或其他 Zotero 标签页后返回时，恢复离开前的卡片滚动位置和选中文献位置。
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
- 当前可见卡片缺少期刊指标时，本插件会调用 Zotero Style 的公开渲染入口；是否联网及数据源仍完全由 Zotero Style 的设置决定。本插件不会读取或传输 Zotero Style 的密钥，也不会自行请求指标服务。
- 阅读进度仅从 Ethereal Style 已加载的本地 `readingTime` 缓存中读取，本插件不会修改或另行保存该记录。

### 开发

```powershell
npm test
npm run build
```

生成的安装包位于 `build/`。模块职责与性能设计见 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

## English

Zotero Card View is a Zotero 9 plugin that turns the central library item list into a sortable literature-card grid while preserving Zotero's native collections, search, selection, context menu, attachment opening, and right-side editing workflows.

Cards show title, date, publication, journal metrics, rating, and tags. Expanded cards add the full title, collapsible abstract, keywords, creators, collections, notes, attachments, DOI, and URL. A persistent field picker lets users choose a compact sorting menu from 15 supported fields. When available, Ethereal Style's local per-page reading progress is mirrored behind card titles using its configured color and opacity. Returning from a PDF or another Zotero tab restores the previous grid position and selected-card anchor.

The plugin reads library data locally. It does not upload titles, abstracts, notes, attachments, or identifiers. Zotero Style metrics are read from its local cache; missing metrics for visible cards are requested through Style's public renderer, while Card View never reads Style credentials or performs the metric network request itself.

Install the latest `.xpi` from [Releases](https://github.com/OK-Feng-hash/zotero-card-view/releases). This is currently a public beta.

## License

[MIT](LICENSE)
