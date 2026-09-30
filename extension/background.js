import { SERVICES, analyzeUrl, buildUrl } from './services.js';
import { t } from './i18n.js';

/**
 * 右键菜单：与工具栏弹窗并列的第二个入口，指向同一个服务模板表。
 */

const PARENT_ID = 'repojump';
const ITEM_PREFIX = 'open:';
const BADGE_COLOR = '#d1242f';

/**
 * 菜单显示范围的静态过滤条件。
 *
 * 这两个模式在 match pattern 语义里等价于「host 是 github.com 且路径至少两段」
 * （注意：注释里不能原样写出带通配符的模式，中间的双字符序列会提前终止块注释，
 * 所以下面用占位写法描述）。由此，个人主页、设置首页、gist 以及所有非 GitHub
 * 页面天然被排除，且不需要任何 host 权限。
 *
 * 模式形状：https://github.com 后面跟 「斜杠 通配 斜杠 通配」。
 *
 * 做不到 100% 精确：match pattern 没有「非」运算，也无法表达「首段不在某个
 * 词表里」，所以 /settings/profile、/topics/javascript、/orgs/vercel 这类同样
 * 两段路径的功能页仍会显示菜单。要精确就得在菜单弹出前读到 URL，那需要 tabs
 * 权限 + 监听 tab 切换常驻更新菜单（onShown/refresh 已不在 Chrome 文档里，
 * 不能依赖）。这里选择零额外权限，极少数误显示的页面由 onClicked 兜底——
 * 判定不是仓库就什么都不做。
 */
const MENU_URL_PATTERNS = ['https://github.com/*/*', 'http://github.com/*/*'];

/**
 * contexts 用 'all' 而不是 'page'：Chrome 的菜单上下文是互斥的，右键落在链接
 * 上时上下文是 link 而非 page。只写 'page' 会导致「右键仓库名（本身是个链接）
 * 菜单不出现」——这是最容易被当成 bug 的情况。
 */
const MENU_CONTEXTS = ['all'];

function reportCreateError() {
  // lastError 必须在这里读，否则控制台会报 "Unchecked runtime.lastError"
  const error = chrome.runtime.lastError;
  if (error) {
    console.error('[Repo Jump] 创建右键菜单失败：', error.message);
  }
}

function buildMenus() {
  // removeAll 用回调形式：promise 形式要 Chrome 123+，回调形式一直可用
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PARENT_ID,
      title: 'Repo Jump',
      contexts: MENU_CONTEXTS,
      documentUrlPatterns: MENU_URL_PATTERNS,
    }, reportCreateError);

    for (const service of SERVICES) {
      chrome.contextMenus.create({
        id: ITEM_PREFIX + service.id,
        parentId: PARENT_ID,
        title: t.contextOpen.replace('{label}', service.label),
        contexts: MENU_CONTEXTS,
        documentUrlPatterns: MENU_URL_PATTERNS,
      }, reportCreateError);
    }
  });
}

// MV3 要求事件监听在顶层同步注册。菜单项由浏览器持久化，service worker 被回收
// 后依然存在，所以只在安装和浏览器启动时重建，不必每次唤醒都重建。
chrome.runtime.onInstalled.addListener(buildMenus);
chrome.runtime.onStartup.addListener(buildMenus);

function clearAlert() {
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setTitle({ title: 'Repo Jump' });
}

/**
 * 在工具栏图标上挂一个角标报错。
 *
 * 为什么需要它：取页面地址这一步依赖 info.pageUrl（或其回退路径），而右键菜单
 * 是这套代码里唯一无法用自动化验证的部分。失败必须可见，否则表现就是「点了没
 * 反应」，无从排查。
 */
function raiseAlert(message) {
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setTitle({ title: message });
}

/**
 * 取右键所在页面的地址。
 *
 * info.pageUrl 是首选。拿不到时回退到 tabs.get —— 点击右键菜单项这个动作本身
 * 会授予 activeTab（临时 host 权限），因此此时 tab.url 应该可读。
 */
async function readPageUrl(info, tab) {
  if (info.pageUrl) {
    return info.pageUrl;
  }
  if (tab && tab.url) {
    return tab.url;
  }
  if (tab && tab.id !== undefined) {
    try {
      return (await chrome.tabs.get(tab.id)).url || '';
    } catch {
      return '';
    }
  }
  return '';
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (typeof info.menuItemId !== 'string' || !info.menuItemId.startsWith(ITEM_PREFIX)) {
    return;
  }
  clearAlert();

  const service = SERVICES.find((item) => item.id === info.menuItemId.slice(ITEM_PREFIX.length));
  if (!service) {
    return;
  }

  const pageUrl = await readPageUrl(info, tab);
  if (!pageUrl) {
    raiseAlert(t.alertNoPageUrl);
    console.error('[Repo Jump] info.pageUrl 与 tab.url 都为空，拿不到仓库地址');
    return;
  }

  const analysis = analyzeUrl(pageUrl);
  if (!analysis.ok) {
    // 静态过滤挡不住的两段路径功能页（/settings/profile 之类）会落在这里
    console.warn('[Repo Jump] 当前页不是仓库，忽略右键菜单点击：', analysis.reason, pageUrl);
    return;
  }

  const url = buildUrl(service.urlTemplate, analysis.owner, analysis.repo);
  try {
    await chrome.tabs.create({ url });
  } catch {
    raiseAlert(t.alertTemplateBroken.replace('{label}', service.label));
  }
});
