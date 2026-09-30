# Repo Jump

Chrome / Edge 扩展：在 GitHub 仓库页一键把当前仓库交给外部工具打开。

点工具栏图标 → 弹出菜单 → 选一项，在新页签打开。支持 6 个目标：

| 菜单项 | 打开 | 用途 |
|---|---|---|
| GD | `gitdiagram.com/{owner}/{repo}` | 生成仓库架构图 |
| DW | `deepwiki.com/{owner}/{repo}` | 生成仓库文档与问答 |
| GH | `github.dev/{owner}/{repo}` | 官方网页版 VS Code |
| GI | `gitingest.com/{owner}/{repo}` | 整仓转成一段可喂给 LLM 的文本 |
| SB | `stackblitz.com/github/{owner}/{repo}` | 在线 IDE，可直接跑起来 |
| ZR | `zread.ai/{owner}/{repo}` | AI 源码解读 |

菜单里每行右侧的按钮把该目标地址复制到剪贴板（不打开新页签）。键盘按 `1`–`6` 直接打开对应项。

## 安装（未上架，走加载已解压）

1. 打开 `chrome://extensions`（Edge 用 `edge://extensions`）
2. 打开右上角「开发者模式」
3. 点「加载已解压的扩展程序」，选中本仓库的 `extension/` 目录（必须是含 `manifest.json` 的那一层）
4. 建议点扩展图标旁的图钉，把它固定到工具栏

改完代码后回这个页面点一下刷新按钮即可生效，不用重新加载。

**限制**：加载已解压的扩展在 Chrome 每次启动时可能弹「停用开发者模式扩展程序」提示，选择保留即可。这种方式没有自动更新，换机器要重装。

## 使用

两个入口，指向同一张服务表。

**工具栏图标**：在任意 `github.com/{owner}/{repo}` 页面（含 `/tree/`、`/blob/`、`/issues/` 等子页面）点击图标。个人主页、话题页、设置页等非仓库页面会显示提示并停用菜单。

**右键菜单**：在仓库页任意位置右键 → `Repo Jump` → 选一个服务，跳过弹窗直接打开。菜单的显示范围由 `documentUrlPatterns` 静态限定为「`github.com` 且路径至少两段」，所以个人主页和非 GitHub 页面不会出现；但它挡不住 `/settings/profile`、`/topics/javascript` 这类同为两段路径的功能页 —— 在那类页面上菜单会出现，点击则什么都不做（详见「已知边界」）。

## 权限

扩展申请三个权限，**没有任何 host 权限**，不注入任何脚本，不读取页面内容：

| 权限 | 用途 |
|---|---|
| `activeTab` | 只在你点击扩展图标、或点击本扩展的右键菜单项时，读取当前标签页的 URL。不触发就不读。 |
| `clipboardWrite` | 「复制链接」按钮 |
| `contextMenus` | 注册右键菜单 |

**没有申请 `tabs`**，这是刻意的：右键菜单要拿到页面地址，`contextMenus.onClicked` 回调里的 `info.pageUrl` 就够了（官方文档没有给它标注任何 `tabs`/host 权限前置条件），而且点击菜单项这个动作本身就会临时授予 `activeTab`。`tabs` 权限的代价是安装时提示「读取您的浏览记录」，为一个只在右键时才需要的信息不值得。真要用到它，只有一种情况：想让右键菜单的显示范围精确到 100%（见下）。

没有 `host_permissions` 意味着扩展不会在后台看到你的任何页面，也不会常驻运行 —— service worker 只在安装、浏览器启动、以及你点击菜单时被唤醒。

## 目录结构

```
extension/
  manifest.json    扩展清单（MV3）
  services.js      服务模板表 + 仓库识别 + URL 渲染，纯函数，无 Chrome API 依赖
  i18n.js          中英文文案，弹窗与 service worker 共用
  popup.html       弹窗结构
  popup.css        样式（跟随系统深浅色）
  popup.js         渲染菜单、打开新页签、复制链接、数字快捷键
  background.js    service worker：注册右键菜单、处理点击
  icons/           16/32/48/128 图标
tools/
  generate_icons.py    图标生成脚本（纯标准库，无 Pillow 依赖）
  check-services.mjs   逻辑校验脚本
docs/ideas/
  repo-jump.md         立项时的方案文档：方向对比、取舍、未做的事
```

## 加一个新服务

只改 `extension/services.js` 一处，往 `SERVICES` 数组里加一条即可，菜单、数字快捷键、复制按钮会自动跟上：

```js
{
  id: 'example',
  label: 'Example',
  short: 'EX',                                   // 菜单徽标的两字母缩写，需唯一且可区分
  note: { zh: '一句话说明', en: 'One-liner' },
  urlTemplate: 'https://example.com/{owner}/{repo}',
},
```

模板里用 `{owner}` 和 `{repo}` 占位符，渲染时会做 URL 编码。抽象层是「URL 模板」而不是「域名替换」，因为 StackBlitz 这类是给路径加前缀，不是换域名。

`short` 必须显式写：GitDiagram / GitHub.dev / Gitingest 都以 G 开头，自动取首字母无法区分。

## 已知边界

- **只在 `github.com` 生效**，不支持企业自建 GitHub（`github.mycorp.com`）——第三方站点本来也不索引内网仓库。
- **仓库识别是启发式的**：取 URL 前两段路径，首段命中保留字（`settings`、`topics`、`orgs`、`sponsors`、`apps`、`codespaces` 等）就判定不是仓库。GitHub 新增顶层路由时需要在 `services.js` 的 `RESERVED_FIRST_SEGMENT` 里补。误判的代价只是菜单多显示或少显示一行，不会跳错。
- **右键菜单的显示范围不是 100% 精确。** 它由 `documentUrlPatterns` 静态限定，而这个机制没有「非」运算，也表达不了「首段不在某个词表里」，所以 `/settings/profile`、`/topics/javascript`、`/orgs/vercel` 这类**同为两段路径但不是仓库**的页面仍会出现菜单；点击时会被识别拦下，什么都不做。想要精确只有一条路：加 `tabs` 权限 + 监听 `tabs.onActivated` / `onUpdated` 常驻更新菜单可见性（`onShown` / `refresh()` 已不在 Chrome 文档的事件列表里，不能依赖）。代价是一个常驻唤醒的 service worker 加一条安装警告 —— 为了一个月可能遇到几次的误显示不值得，所以没做。
- **第三方站点自己的覆盖范围不受本扩展控制**：DeepWiki / GitDiagram / Zread 对冷门仓库可能显示「未索引」或一直转圈。
- **私有仓库不支持**：这些站点读不到你的私有仓库，跳过去也是空的。
- 样式里用了 `color-mix()`，需要 Chrome / Edge 111 及以上。低于该版本只会少掉悬停背景色，功能不受影响。

## 重新生成图标

```bash
python tools/generate_icons.py
```

几何参数都在脚本顶部的常量里，改完重跑即可覆盖 `extension/icons/`。

## 校验

```bash
node tools/check-services.mjs
```

51 项断言，覆盖四块：

1. **仓库页识别** —— 保留字黑名单、子域伪装拦截（`github.com.evil.example`）、`.git` 后缀、百分号编码
2. **URL 模板渲染** —— 占位符漏写、编码、`id` / `short` 是否撞脸
3. **文案完整性** —— 中英文 key 是否对齐、源码引用的每个 key 是否存在、占位符是否一致
4. **右键菜单** —— 用假 `chrome` API 加载真实的 `background.js`，验证菜单树构建、点击路由、取页面地址的三级回退、非仓库页不动作、彻底取不到地址时升角标、重复安装不产生重复项

需要 Node 22.7+。改了 `services.js`、`i18n.js` 或 `background.js` 都值得跑一遍。

**测不到的部分**：Chrome 自己的 match pattern 语义、菜单是否真的弹出、`info.pageUrl` 在没有 `tabs` 权限时是否真的非空。这三项只能手动验证：

1. 在仓库页任意位置右键 → 应出现 `Repo Jump` 子菜单 → 点一项应打开对应站点
2. 在 `/settings/profile` 右键 → 菜单会出现（预期内），但点击不应有任何动作
3. 在非 GitHub 页面右键 → 不应出现 `Repo Jump`

如果第 1 步没反应，去看工具栏图标上是否出现了红色 `!` 角标（悬停有说明）；那是「连页面地址都取不到」的兜底上报，遇到就说明得给扩展加 `tabs` 权限。
