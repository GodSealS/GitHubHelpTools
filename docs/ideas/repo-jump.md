# Repo Jump — GitHub 仓库一键跳转扩展

> 状态：**Accepted（2026-09-30）**。方向已确认，MVP 已实现于 `extension/`，使用说明见根目录 `README.md`。
>
> **已锁定的决策**（用户于 2026-09-30 拍板）
> 1. 按钮位置 = 浏览器工具栏的扩展图标（弹窗菜单），不做页面内注入。
> 2. 服务清单 = 6 个。保留 `GitHub.dev`（要求所有服务走同一个执行入口）；移除 `GitHub1s`（疑似停止维护）。
> 3. 提供「复制链接」能力（不打开，只写剪贴板，便于分享）。
> 4. **不上架商店**，走「加载已解压」自用分发。
>
> 因此下方「路径 2：上架商店」与「路径 3：企业分发」保留为背景资料，当前不执行；输出物里不需要商店图标、截图、隐私政策与商标规避（扩展名仍用中性的 `Repo Jump`）。
>
> **追加决策（2026-09-30 第二轮）**
> 5. 增加右键菜单，且要求「只在当前页是 GitHub 仓库时才显示」。文档核查结论：**能做到 90%，做不到 100%**（详见文末「右键菜单的显示范围」）。
> 6. 原计划是链接上下文（右键任意仓库链接转换），实现时改为页面上下文（右键当前页的仓库）。理由：用户的措辞「当前页面是仓库时才显示」指向页面上下文；链接上下文可作为后续补充。

## Problem Statement

**How Might We** 在 GitHub 仓库页上用一次点击，把当前 `owner/repo` 交给 DeepWiki / GitDiagram / Gitingest / StackBlitz 等外部站点，而不必手动改域名、复制粘贴、重新搜索？

## 一句话洞察

用户列出的 7 个功能，**不是 7 个功能，是 1 个功能的 7 组参数**：

```
新 URL = 模板.replace("{owner}/{repo}", 从 location.pathname 取的前两段)
```

全部 7 项都是 `https://<host>/<path>` 的纯字符串替换，没有任何 DOM 抓取、API 调用、鉴权、数据处理。因此这不是一个"应用"，是一个**查表器**。

## System Context

- **SysDocs 基线：NOT APPLICABLE / UNINITIALIZED。** 工作区 `e:/Work/GitHubHelpTools` 为空目录，无源码、无文档、无知识库。本方案完全基于需求与外部事实验证，无既有能力可复用，也无既有边界需遵守。
- **已验证的外部事实**（2026-09-30 实测，见"假设验证"）：

  | 服务 | URL 模板 | 验证状态 |
  |---|---|---|
  | GitDiagram | `https://gitdiagram.com/{owner}/{repo}` | ✅ 实测 facebook/react，架构图正常，另有 `.md` 变体 |
  | DeepWiki | `https://deepwiki.com/{owner}/{repo}` | ⬜ 待实测 |
  | GitHub1s | `https://github1s.com/{owner}/{repo}` | ⚠️ 仅返回 SPA 空壳，未维护风险 |
  | GitHub.dev | `https://github.dev/{owner}/{repo}` | ✅ 官方功能（仓库页按 `.` 即开） |
  | Gitingest | `https://gitingest.com/{owner}/{repo}` | ✅ 实测 facebook/react 正常 |
  | StackBlitz | `https://stackblitz.com/github/{owner}/{repo}` | ⬜ 待实测 |
  | Zread | `https://zread.ai/{owner}/{repo}` | ✅ 实测 facebook/react 正常 |

- **原始需求中的 3 处错误（已修正）**：
  1. `Github.dev` 条目的域名被误写成 `gitingest.com`（与下一条重复）→ 应为 `github.dev`。
  2. `zrea.ai` 拼写错误 → 应为 `zread.ai`。
  3. 需求写"改域名"，但 StackBlitz 实际是**加路径**（`/github/`），说明抽象层不能是"域名替换"，必须是**URL 模板**。

## Recommended Direction

**Direction A：MV3 扩展，浏览器工具栏按钮 + 弹窗菜单，纯静态、零依赖、零构建。**

- `manifest.json`（MV3，权限仅 `activeTab`，**零 host permission**）
- `popup.html` / `popup.js` / `popup.css` + 4 个尺寸图标
- 核心就是一个 `SERVICES` 常量数组 + 一个 `parseRepo(pathname)` 纯函数 + `chrome.tabs.create`
- 在非仓库页面（`github.com/facebook`、`/settings/*`、`/topics/*`…）显示"当前不是仓库页"并禁用选项

选它的理由，按重要性排序：

1. **权限最小 = 上架最顺。** 不用 content script 就不需要 `host_permissions: ["https://github.com/*"]`，审核不会因"权限过大"卡住；商店页面能写"不收集任何数据"。
2. **零维护。** GitHub 前端是 Turbo 驱动的 SPA，页头 DOM 随版本变动。注入式按钮（Direction B）第一年大概率要修 3~5 次；工具栏弹窗永远不会因为 GitHub 改版而失效。
3. **零构建。** 没有 TypeScript/Vite/React，改一行复制目录即可验证。整个 MVP 约 200 行，半天可跑通。
4. **不堵后路。** 模板表是纯数据，以后要加"注入页头按钮""快捷键""右键菜单""自定义服务"，都是在同一张表上叠加，不需要重写。

## 关键假设与验证

- [ ] **6 个模板全部可用** — 拿同一个冷门仓库（不要用 facebook/react）逐个手开一遍。特别是 DeepWiki/GitDiagram 对未索引仓库的表现（可能显示"正在生成"或空白），这会决定 UI 上要不要加风险提示。这是**唯一的遗留验证项**。
- [x] **GitHub1s 是否已死** — 2026-09-30 抓取只拿到 `You need to enable JavaScript to run this app.`，无法确认编辑器是否还能加载。用户决定**直接移除**，不做进一步验证：展示一个打不开的站点比不展示更伤信任。
- [x] **GitHub.dev 是否该出现在菜单里** — 建议移除（官方已支持按 `.` 直达）**未被采纳**。用户决定保留，理由是**要一个统一的执行入口**：不愿为一个功能记住两套肌肉记忆（"按 `.`，其余点菜单"）。理由成立，保留并在 `note` 里标注"官方网页版 VS Code"以区别于第三方服务。
- [ ] **你自己一周会用几次** — 上线后记一周，低于 3 次说明这是好奇心而非需求。这个插件成本低所以值得做，但别为它投入超过 3 天。
- [x] **按钮到底是"工具栏图标"还是"GitHub 页头按钮"** — 已定：**工具栏图标 + 弹窗菜单**，不做页面内注入。这是权限最小（零 host 权限）和零维护（不受 GitHub 改版影响）的前提，也是 Direction B 被否掉的原因。

## MVP Scope

**In（半天）**

- MV3 扩展，工具栏图标 → 弹窗菜单，点击任一项在新页签打开
- 6 组 URL 模板（含修正后的正确域名；GitHub1s 已移除）
- 仓库页识别：`pathname` 前两段 + 保留字黑名单（`settings` / `topics` / `orgs` / `sponsors` / `marketplace` / `apps` / `collections` / `trending` / `users` / `enterprise` / `notifications` / `search` …）
- 非仓库页降级提示
- 图标 16/32/48/128 PNG
- 中文 + 英文双语（同一份 HTML 内联两套文案，或先单语言）

**P1（+1 天，可选）**

- ⬜ 快捷键：`Alt+Shift+1..7` 直达（`chrome.commands`，0 额外权限）。用 `chrome.storage.sync` 配… 不必，见下。
- ⬜ 设置页：勾选显示哪些服务、拖拽排序（`chrome.storage.sync`）

### 已完成：右键菜单

- ✅ 右键菜单（`contextMenus`，额外 1 个权限，见下节）
- ✅ 数字键 `1`–`6` 直达（在弹窗内，0 额外权限，替代原计划的 `chrome.commands` 全局快捷键）

**P2（仅当 P1 真的天天用）**

- 自定义服务注册表：用户自己填 `{label, urlTemplate}`
- 注入 GitHub 页头按钮（Direction B）
- 企业 GitHub 域名支持（`optional_host_permissions`）

## Directions Considered（发散记录）

| # | 方向 | 判断 |
|---|---|---|
| 1 | **零代码方案**：Chrome 内置"网站搜索"（设置 → 搜索引擎 → 添加关键字 `dw` + `https://deepwiki.com/%s`） | 能 100% 实现核心跳转，值得**同时配置**作为兜底；但无法从当前页一键跳，也无法在 GitHub 页面里被发现 → 不替代扩展 |
| 2 | **反转**：不做菜单，做地址栏关键字 | 无 UI 无发现性，作为 P1 快捷键的补充 |
| 3 | **移除约束**：不限当前页，右键页面里任意仓库链接 → 用 X 打开 | 真实痛点（看 README 里的依赖仓库时最想要），成本低 → 收进 P1 |
| 4 | **换受众**：不做"打开"，做"复制为 X 链接"写进剪贴板 | 分享场景确实独立，但先不做（YAGNI） |
| 5 | **极简化**：砍到 3 个服务 | `github.dev` 冗余（按 `.`）；`github1s` 疑似已死；剩下 5 个才是真集合 |
| 6 | **组合**：注入页头一排小图标（像徽章） | 发现性最好，维护成本最高 → 见 Direction B |
| 7 | **10x**：服务注册表 + 远端 JSON 订阅，新站点上线不发版 | 优雅但引入远程配置（审核关注点）且过度工程 → P2 |

## Direction 对比与压力测试

| | A. 工具栏弹窗 | B. 注入页头按钮 | C. 可配置注册表 |
|---|---|---|---|
| 用户价值 | 半止痛药：省 4 次点击 + 7 个域名记忆 | 最高，符合"界面上有按钮"的字面预期 | 边际：90% 时间只用 DeepWiki + GitDiagram |
| 最难的部分 | 无（唯一"难"点是仓库页识别） | GitHub Turbo SPA 导航后 DOM 重渲染，需 MutationObserver + 幂等注入 | 设置 UI + 数据迁移 |
| 权限成本 | `activeTab` | `host_permissions: github.com/*` | `activeTab` + `storage` |
| 失效风险 | 几乎为零 | 每次 GitHub 改版 | 几乎为零 |
| 工期 | 0.5–1 天 | 2–3 天 + 长期维护 | 2–3 天 |
| 差异化 | 与现有同类扩展无差异 | 有，但同类扩展已有 | 有（现有扩展普遍硬编码） |
| **结论** | **采用** | **不做（P2 再说）** | 暂缓 |

**差异化实话**：商店里已有若干"GitHub → DeepWiki/Diagram"扩展，这个插件不会让别人切换。它的正当理由是**自用**：你天天看仓库，且这是半天成本、零维护的工具。按这个定位做，别按"做个有人用产品"的定位做。

## Not Doing (and Why)

- **~~`GitHub.dev` 菜单项~~** — **已推翻**。原本判断它冗余（官方支持按 `.` 直达），但用户优先要的是"一个统一入口"而非"最短路径"。已保留为菜单第 3 项。教训：省一次点击不如省一套心智模型。
- **~~`GitHub1s`~~** — 已移除。2026-09-30 抓取只拿到 SPA 空壳，无法确认编辑器可用；用户决定不验证直接砍掉。展示一个打不开的站点比不展示更伤信任。
- **注入 GitHub 页头按钮（content script）** — 用 `host_permissions` + SPA DOM 依赖换取一点发现性，性价比低，且是最容易过审被卡/被用户质疑"为什么要读我所有 GitHub 页面"的部分。
- **企业 GitHub（`github.mycorp.com`）支持** — 第三方站点（DeepWiki/GitDiagram）根本不索引内网仓库，跳过去也是 404。
- **私有仓库 / 登录态 / 代理** — 需要处理 token，直接越界成"凭据管理工具"，信任成本和审核成本都陡增。
- **遥测、统计、后端服务** — 这插件的全部逻辑是字符串拼接，没有后端可做，也没有数据值得收。
- **i18n 框架** — 早期用 `_locales` 会是过度设计，先内联双语。
- **自动更新 / CRX 自签分发** — 已决定不上架，因此没有自动更新：改代码后需在 `chrome://extensions` 手动点刷新。接受这个代价换取零注册成本与零审核流程。

## 正规安装（三条路径）

### 路径 1：开发/自用（Sideload，5 分钟，不上架）

1. 打开 `chrome://extensions`（Edge 是 `edge://extensions`）
2. 右上角打开「开发者模式」
3. 点「加载已解压的扩展程序」，选择包含 `manifest.json` 的目录

**局限**：无法自动更新（改代码要手动点刷新）；Chrome 每次启动可能弹"停用开发者模式扩展程序"提醒；换电脑要重装；无法分享给非技术同事。适合开发阶段和只给自己用。

### 路径 2：上架商店（推荐的"正规"路径）

同一份 ZIP 可同时提交两个商店，只需保证 `manifest.json` 在 ZIP 根目录。

**Chrome Web Store**
- 注册开发者账号：一次性 **5 美元**注册费（永久，非年费），需 Google 账号 + 绑定信用卡/借记卡 + 开启两步验证。
- 必须 Manifest V3；扩展必须**单一用途**（这个插件天然满足：只做 GitHub 仓库跳转）。
- 提交物：ZIP + 商店图标 128×128 + 至少 1 张 1280×800 或 640×400 截图 + 详细描述 + 「隐私规范」表单（声明不收集数据则无需隐私政策 URL）。
- 审核：通常 1–3 个工作日，首次或权限较大时更久。驳回最常见原因是权限过宽和描述不清晰。
- **商标注意**：不要用 "GitHub" 作为扩展名主体、也不要用 `gitdiagram/deepwiki` 等第三方站名（可能触发商标/仿冒政策）。建议名称如 `Repo Jump`、`RepoLens`，描述中说明"为 GitHub 仓库提供快捷跳转"。
- 上架后可选择 Unlisted（公开链接可装、商店搜不到）用于小范围分发。

**Microsoft Edge 加载项**
- 注册：免费，但需要一个 **Microsoft Partner Center 开发者账号**（以 Microsoft 账号 MSA 作为主要所有者），需邮箱/电话验证。
- 可在 Partner Center 里直接「从 Chrome Web Store 导入」已上架条目，省一次审核；未上架 CWS 时也可独立提交同一份 ZIP。
- 审核通常比 CWS 快；Edge 上也有生态位优势——你的目标用户里 Edge 用户占比不低。

### 路径 3：企业内部/团队分发（不上架）

- **企业策略强制安装**：自己托管 CRX + `update.xml`，通过组策略/注册表 `ExtensionSettings` 或 `ExtensionInstallForcelist` 下发（Chrome/Edge 均支持，Windows 域内有效）。适合 10+ 人团队。
- **注意**：Chrome 在 Windows/macOS 上**已阻止**直接双击安装非商店来源的 `.crx`，自托管必须走企业策略，否则装不上。所以"发个 CRX 给同事"这条路在 2026 年基本不可行——要么开发者模式加载解压目录，要么上架。
- **Google Workspace 域内私有发布**：域管理员可在 Admin Console 把扩展设为仅本域可见，走的是 CWS 后台的私有发布流程。

**结论**：走**路径 1**。路径 2/3 仅作为背景保留——如果以后要分享给非技术同事，或想省掉每次启动的开发者模式提示，再回来看这一节。

## Open Questions（已关闭）

1. ~~按钮位置~~ → **工具栏图标 + 弹窗菜单**。不做页面内注入。
2. ~~服务清单~~ → **6 个**：GitDiagram / DeepWiki / GitHub.dev / Gitingest / StackBlitz / Zread。`github.dev` 保留（统一入口优先），`github1s` 移除。
3. ~~是否要"复制链接"~~ → **要**，菜单每行右侧一个复制按钮。
4. ~~UI 语言~~ → **自动跟随浏览器语言**（`navigator.language` 以 `zh` 开头用中文，否则英文），不引入 `_locales` 框架。
5. ~~扩展名称~~ → **`Repo Jump`**。不上架所以商标风险暂时不构成约束，但仍沿用中性名以留后路。
6. ~~是否上架~~ → **不上架**，走加载已解压。

## 右键菜单的显示范围：为什么是 90% 而不是 100%

需求原话：「右键菜单能不能只能针对当前页面是 GitHub 的仓库时才能显示？」

**静态能做到的**：`documentUrlPatterns` 配上「github.com 后面跟 斜杠-通配-斜杠-通配」形状的模式。match pattern 的路径里 `*` 可以跨 `/`，所以这个形状等价于「host 是 github.com 且路径至少两段」。于是个人主页（一段路径）、设置首页、gist、以及所有非 GitHub 页面自动被排除，且**零额外权限**。

**静态做不到的**：match pattern 没有「非」运算，也表达不了「首段不在某个词表里」。所以 `/settings/profile`、`/topics/javascript`、`/orgs/vercel`、`/sponsors/x`、`/apps/x`、`/marketplace/actions/x`、`/codespaces/new` 这些**同为两段路径但不是仓库**的功能页仍会显示菜单。

**动态方案为什么被否**：要精确，就必须在菜单弹出前拿到 URL。

- 被动读 tab URL 需要 `tabs` 权限（安装提示「读取您的浏览记录」），再加 `tabs.onActivated` / `tabs.onUpdated` 常驻监听去 `contextMenus.update(id, {visible})`。
- 曾经的 `contextMenus.onShown` + `refresh()` 能在弹出瞬间改可见性，但**已不在 Chrome 官方文档的事件列表里**（2026-09-11 版页面只列 `onClicked`），不能作为依赖。
- 代价 = 常驻唤醒的 service worker + 一条安装警告；收益 = 一个月可能遇到几次的误显示。不成比例。

**所以选了**：静态过滤 + 点击时兜底（`analyzeUrl` 判定不是仓库就什么都不做）。误显示的页面点下去没反应，但不会跳错。

**另一个必须记住的坑**：`contexts` 要用 `all` 而不是 `page`。Chrome 的菜单上下文是互斥的——右键落在链接上时上下文是 `link` 而非 `page`。只写 `page` 会导致「右键仓库名（它本身是个链接）菜单不出现」，而这最容易被误当成 bug。

**顺带确认的事实**（决定了不需要 `tabs`）：`contextMenus.onClicked` 的 `info.pageUrl` 在 Chrome 英文文档和 MDN 上**都没有** `tabs`/host 权限前置条件；而且**点击右键菜单项这个动作本身会授予 `activeTab`**（官方 activeTab 文档列的四种手势之一）。取当前页地址因此不需要新权限。这一条无法用自动化验证，代码里做了三级回退（`info.pageUrl` → `tab.url` → `tabs.get`），三条全失败时在工具栏图标挂红色 `!` 角标——失败必须可见，否则表现就是「点了没反应」，无从排查。
