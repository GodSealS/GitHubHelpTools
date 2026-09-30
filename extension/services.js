/**
 * Repo Jump 的唯一数据源。
 *
 * 新增一个服务 = 往 SERVICES 里加一条，不需要改任何其他文件。
 * 弹窗会按数组顺序渲染菜单，并按顺序绑定 1..9 数字快捷键。
 *
 * urlTemplate 支持的占位符：
 *   {owner}  仓库所有者（org 或 user）
 *   {repo}   仓库名
 *
 * 注意：占位符必须用在**路径**里。StackBlitz 是给 github.com 链接加前缀
 * （https://stackblitz.com/github/owner/repo），不是替换域名，所以这里的
 * 抽象层是"URL 模板"，而不是"域名替换"。
 *
 * short 是菜单徽标里的两字母缩写。必须显式写死：GitDiagram / GitHub.dev /
 * Gitingest 三个都以 G 开头，靠自动取首字母无法区分。
 */

export const SERVICES = [
  {
    id: 'gitdiagram',
    label: 'GitDiagram',
    short: 'GD',
    note: { zh: '生成仓库架构图', en: 'Architecture diagram' },
    urlTemplate: 'https://gitdiagram.com/{owner}/{repo}',
  },
  {
    id: 'deepwiki',
    label: 'DeepWiki',
    short: 'DW',
    note: { zh: '生成仓库文档与问答', en: 'Docs & Q&A' },
    urlTemplate: 'https://deepwiki.com/{owner}/{repo}',
  },
  {
    id: 'githubdev',
    label: 'GitHub.dev',
    short: 'GH',
    note: { zh: '官方网页版 VS Code', en: 'Official web VS Code' },
    urlTemplate: 'https://github.dev/{owner}/{repo}',
  },
  {
    id: 'gitingest',
    label: 'Gitingest',
    short: 'GI',
    note: { zh: '整仓转成一段可喂给 LLM 的文本', en: 'Repo as LLM-ready text' },
    urlTemplate: 'https://gitingest.com/{owner}/{repo}',
  },
  {
    id: 'stackblitz',
    label: 'StackBlitz',
    short: 'SB',
    note: { zh: '在线 IDE，可直接跑起来', en: 'Online IDE, runs the repo' },
    urlTemplate: 'https://stackblitz.com/github/{owner}/{repo}',
  },
  {
    id: 'zread',
    label: 'Zread',
    short: 'ZR',
    note: { zh: 'AI 源码解读', en: 'AI source walkthrough' },
    urlTemplate: 'https://zread.ai/{owner}/{repo}',
  },
];

/** 识别来源用的 GitHub 主机名。 */
export const GITHUB_HOST = 'github.com';

/**
 * 首段路径为这些值时，/{a}/{b} 不是仓库，而是 GitHub 的功能页。
 *
 * 为什么不判定第二段：仓库名完全可能叫 settings、features、marketplace
 * （github.com/某个用户/settings 是合法仓库），所以只能靠首段排除。
 * 这份名单是启发式的：GitHub 新增顶层路由时需要补，误判代价只是
 * 在非仓库页多显示一个按钮或漏显示一个按钮，不会出错跳转。
 */
const RESERVED_FIRST_SEGMENT = new Set([
  'about', 'account', 'apps', 'business', 'codespaces', 'collections',
  'contact', 'customer-stories', 'dashboard', 'discussions', 'education',
  'enterprise', 'events', 'explore', 'features', 'gist', 'issues', 'join',
  'login', 'logout', 'marketplace', 'mobile', 'new', 'nonprofit',
  'notifications', 'open-source', 'organizations', 'orgs', 'premium',
  'pricing', 'pulls', 'readme', 'resources', 'search', 'security',
  'sessions', 'settings', 'signup', 'site', 'sitemap', 'solutions',
  'sponsors', 'stars', 'team', 'topics', 'trending', 'trust-center',
  'users', 'watching',
]);

function safeDecode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * 把当前标签页的 URL 判定成仓库。
 *
 * @param {string} rawUrl
 * @returns {{ok: true, owner: string, repo: string, source: string}
 *          | {ok: false, reason: 'not-github' | 'not-repo' | 'unknown-url', host?: string}}
 */
export function analyzeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'unknown-url' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'unknown-url' };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== GITHUB_HOST) {
    return { ok: false, reason: 'not-github', host };
  }

  // 只取前两段路径：repo 子页面（/tree/main/x、/issues/1、/blob/…）
  // 一律视为同一个仓库。query 与 hash 天然被 pathname 排除。
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return { ok: false, reason: 'not-repo', host };
  }

  const owner = safeDecode(segments[0]);
  const repo = safeDecode(segments[1]).replace(/\.git$/i, '');

  if (!owner || !repo || RESERVED_FIRST_SEGMENT.has(owner.toLowerCase())) {
    return { ok: false, reason: 'not-repo', host };
  }

  return { ok: true, owner, repo, source: `https://${GITHUB_HOST}/${owner}/${repo}` };
}

/**
 * 用仓库信息填充一个 URL 模板。
 *
 * @param {string} template
 * @param {string} owner
 * @param {string} repo
 * @returns {string}
 */
export function buildUrl(template, owner, repo) {
  return template
    .replaceAll('{owner}', encodeURIComponent(owner))
    .replaceAll('{repo}', encodeURIComponent(repo));
}
