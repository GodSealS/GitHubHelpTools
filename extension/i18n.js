/**
 * 界面文案，弹窗与 service worker 共用一份，避免同一个词在两处走样。
 *
 * 跟随浏览器界面语言，不引入 _locales：只有两种语言、一共二十来个字符串，
 * 目录结构加 __MSG_ 替换反而更重。
 */

function detectLang() {
  let tag = '';
  try {
    tag = chrome.i18n.getUILanguage();
  } catch {
    tag = '';
  }
  return (tag || navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const LANG = detectLang();

const TEXT = {
  zh: {
    keys: '按 1-9 直接打开',
    open: '在新页签打开',
    copy: '复制链接',
    copied: '已复制 {label} 链接',
    copyFailed: '复制失败，请右键链接手动复制',
    launched: '已在新页签打开 {label}',
    openFailed: '打不开 {label}，它的 URL 模板可能写错了',
    emptyUnknownTitle: '读不到当前标签页的地址',
    emptyUnknownHint: '可能是浏览器内部页面（chrome://…）。切到一个普通网页再试。',
    emptyNotGithubTitle: '当前页面不是 GitHub',
    emptyNotGithubHint: 'Repo Jump 只在 github.com 的仓库页生效。先去打开一个仓库试试。',
    emptyNotRepoTitle: '当前页面不是仓库页',
    emptyNotRepoHint: '需要 URL 里带 owner/repo 两段，例如 github.com/facebook/react。个人主页、话题页、设置页都不算。',
    // 右键菜单
    contextOpen: '用 {label} 打开',
    alertNoPageUrl: 'Repo Jump：读不到当前页地址，右键菜单无法工作（请反馈）',
    alertTemplateBroken: 'Repo Jump：{label} 的 URL 模板有问题',
  },
  en: {
    keys: 'Press 1-9 to open',
    open: 'Open in a new tab',
    copy: 'Copy link',
    copied: 'Copied the {label} link',
    copyFailed: 'Copy failed — right-click the link instead',
    launched: 'Opened {label} in a new tab',
    openFailed: 'Could not open {label} — its URL template may be wrong',
    emptyUnknownTitle: 'Cannot read the current tab address',
    emptyUnknownHint: 'This looks like a browser-internal page (chrome://…). Switch to a normal page and try again.',
    emptyNotGithubTitle: 'Not a GitHub page',
    emptyNotGithubHint: 'Repo Jump only works on repository pages under github.com.',
    emptyNotRepoTitle: 'Not a repository page',
    emptyNotRepoHint: 'The URL needs an owner/repo pair, e.g. github.com/facebook/react. Profiles, topics and settings pages do not count.',
    // Context menu
    contextOpen: 'Open in {label}',
    alertNoPageUrl: 'Repo Jump: cannot read the page URL, the context menu will not work (please report)',
    alertTemplateBroken: 'Repo Jump: the {label} URL template is broken',
  },
};

export const t = TEXT[LANG];

// 导出完整表供 tools/check-services.mjs 校验两种语言的 key 是否对齐
export { TEXT };
