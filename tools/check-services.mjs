/**
 * 校验 extension/services.js 的两处非平凡逻辑：
 *   1. 仓库页识别（analyzeUrl）—— 保留字黑名单是启发式的，最容易改坏
 *   2. URL 模板渲染（buildUrl）—— 占位符漏写、编码错误、id/short 重复
 *
 * 用法：node tools/check-services.mjs
 * 需要 Node 22.7+（靠模块语法自动识别加载 .js 里的 ESM）。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SERVICES, analyzeUrl, buildUrl } from '../extension/services.js';
import { TEXT, t, LANG } from '../extension/i18n.js';

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok  ' + label);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + label + '\n      ' + error.message);
  }
}

console.log('--- analyzeUrl：应识别为仓库 ---');
const repos = [
  ['https://github.com/facebook/react', 'facebook', 'react'],
  ['https://github.com/facebook/react/tree/main/packages', 'facebook', 'react'],
  ['https://github.com/facebook/react/blob/main/README.md', 'facebook', 'react'],
  ['https://github.com/facebook/react/issues/123', 'facebook', 'react'],
  ['https://github.com/facebook/react?tab=readme-ov-file#install', 'facebook', 'react'],
  ['https://github.com/facebook/react.git', 'facebook', 'react'],
  ['https://www.github.com/facebook/react', 'facebook', 'react'],
  ['http://github.com/facebook/react', 'facebook', 'react'],
  // github 是合法组织名，不能被保留字误伤
  ['https://github.com/github/gitignore', 'github', 'gitignore'],
  // 仓库名可以是保留字，所以只检查首段
  ['https://github.com/someone/settings', 'someone', 'settings'],
  ['https://github.com/someone/features', 'someone', 'features'],
  ['https://github.com/vercel/next.js', 'vercel', 'next.js'],
];
for (const [url, owner, repo] of repos) {
  check(url, () => {
    const result = analyzeUrl(url);
    assert.equal(result.ok, true, 'expected ok, got ' + result.reason);
    assert.equal(result.owner, owner);
    assert.equal(result.repo, repo);
    assert.equal(result.source, `https://github.com/${owner}/${repo}`);
  });
}

console.log('--- analyzeUrl：应被拒绝 ---');
const rejected = [
  ['https://github.com/facebook', 'not-repo'],
  ['https://github.com/orgs/vercel', 'not-repo'],
  ['https://github.com/topics/javascript', 'not-repo'],
  ['https://github.com/collections/machine-learning', 'not-repo'],
  ['https://github.com/settings/profile', 'not-repo'],
  ['https://github.com/sponsors/sindresorhus', 'not-repo'],
  ['https://github.com/marketplace/actions/checkout', 'not-repo'],
  ['https://github.com/apps/dependabot', 'not-repo'],
  ['https://github.com/trending/javascript', 'not-repo'],
  ['https://github.com/notifications', 'not-repo'],
  ['https://github.com/features/actions', 'not-repo'],
  ['https://github.com/codespaces/new', 'not-repo'],
  // 主机名必须精确等于 github.com，子域和伪装域名都要挡住
  ['https://gist.github.com/foo/abc123', 'not-github'],
  ['https://gitlab.com/facebook/react', 'not-github'],
  ['https://github.dev/facebook/react', 'not-github'],
  ['https://github.com.evil.example/facebook/react', 'not-github'],
  ['chrome://extensions', 'unknown-url'],
  ['about:blank', 'unknown-url'],
  ['not a url', 'unknown-url'],
  ['', 'unknown-url'],
];
for (const [url, reason] of rejected) {
  check(`${url || '(空字符串)'} -> ${reason}`, () => {
    const result = analyzeUrl(url);
    assert.equal(result.ok, false, 'expected rejection');
    assert.equal(result.reason, reason);
  });
}

console.log('--- buildUrl：模板渲染 ---');
check('已知六个服务的真实目标地址', () => {
  const got = Object.fromEntries(
    SERVICES.map((s) => [s.id, buildUrl(s.urlTemplate, 'facebook', 'react')])
  );
  assert.deepEqual(got, {
    gitdiagram: 'https://gitdiagram.com/facebook/react',
    deepwiki: 'https://deepwiki.com/facebook/react',
    githubdev: 'https://github.dev/facebook/react',
    gitingest: 'https://gitingest.com/facebook/react',
    stackblitz: 'https://stackblitz.com/github/facebook/react',
    zread: 'https://zread.ai/facebook/react',
  });
});

check('表结构完整：id / short / label / 双语 note 齐全且唯一', () => {
  for (const service of SERVICES) {
    assert.match(service.id, /^[a-z0-9-]+$/, 'id 不合法：' + service.id);
    assert.equal(service.short.length, 2, 'short 必须是 2 个字符：' + service.id);
    assert.ok(service.label, '缺少 label：' + service.id);
    assert.ok(service.note && service.note.zh && service.note.en, '缺少双语 note：' + service.id);
  }
  assert.equal(new Set(SERVICES.map((s) => s.id)).size, SERVICES.length, 'id 有重复');
  assert.equal(new Set(SERVICES.map((s) => s.short)).size, SERVICES.length, 'short 有重复，菜单徽标会撞脸');
});

check('每个模板都用齐两个占位符，渲染后无残留', () => {
  for (const service of SERVICES) {
    assert.match(service.urlTemplate, /^https:\/\//, '模板必须是 https：' + service.id);
    assert.ok(service.urlTemplate.includes('{owner}'), '缺 {owner}：' + service.id);
    assert.ok(service.urlTemplate.includes('{repo}'), '缺 {repo}：' + service.id);
    const rendered = buildUrl(service.urlTemplate, 'vercel', 'next.js');
    assert.doesNotMatch(rendered, /[{}]/, '渲染后仍有占位符：' + service.id);
    assert.doesNotThrow(() => new URL(rendered), '渲染结果不是合法 URL：' + service.id);
  }
});

check('占位符值会被 URL 编码', () => {
  assert.equal(
    buildUrl('https://x.example/{owner}/{repo}', 'a b', 'c/d'),
    'https://x.example/a%20b/c%2Fd'
  );
});

check('仓库名含百分号编码时能正确还原再编码', () => {
  const result = analyzeUrl('https://github.com/owner/re%20po');
  assert.equal(result.ok, true);
  assert.equal(result.repo, 're po');
  assert.equal(
    buildUrl('https://x.example/{owner}/{repo}', result.owner, result.repo),
    'https://x.example/owner/re%20po'
  );
});

console.log('--- i18n：文案完整性 ---');
const SOURCES = ['popup.js', 'background.js'];
const sourceText = SOURCES
  .map((name) => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8'))
  .join('\n');

// popup.js 里用模板拼出来的键，正则扫不到，显式列出来
const DYNAMIC_KEYS = [
  'emptyUnknownTitle', 'emptyUnknownHint',
  'emptyNotGithubTitle', 'emptyNotGithubHint',
  'emptyNotRepoTitle', 'emptyNotRepoHint',
];

check('中英文两个表的键完全一致', () => {
  const zh = Object.keys(TEXT.zh).sort();
  const en = Object.keys(TEXT.en).sort();
  assert.deepEqual(en, zh, '两种语言的键对不上');
  assert.ok(zh.length > 0);
});

check('源码里引用的每个 t.xxx 键都存在', () => {
  const used = new Set();
  for (const match of sourceText.matchAll(/\bt\.([A-Za-z][A-Za-z0-9]*)/g)) {
    used.add(match[1]);
  }
  for (const key of DYNAMIC_KEYS) {
    used.add(key);
  }
  assert.ok(used.size >= 15, '只扫到 ' + used.size + ' 个键，正则可能失效了');
  for (const key of used) {
    assert.ok(key in TEXT.zh, 'zh 缺少文案：' + key);
    assert.ok(key in TEXT.en, 'en 缺少文案：' + key);
  }
});

check('每条文案的占位符在两种语言里一致', () => {
  const placeholders = (value) => (value.match(/\{[a-z]+\}/g) || []).sort().join(',');
  for (const key of Object.keys(TEXT.zh)) {
    assert.equal(
      placeholders(TEXT.en[key]),
      placeholders(TEXT.zh[key]),
      '占位符对不上：' + key
    );
    assert.ok(TEXT.zh[key].trim().length > 0, '空文案：' + key);
    assert.ok(TEXT.en[key].trim().length > 0, '空文案：' + key);
  }
});

check('右键菜单项标题渲染后没有残留占位符', () => {
  for (const key of ['zh', 'en']) {
    assert.doesNotMatch(TEXT[key].contextOpen.replace('{label}', 'DeepWiki'), /[{}]/);
  }
  assert.equal(TEXT[LANG].keys, t.keys);
});

/**
 * background.js（右键菜单）的校验。
 *
 * 唯一测不到的是 Chrome 自己的 match pattern 语义和菜单实际弹出行为——那需要
 * 真的加载扩展并手动右键。其余逻辑（菜单树构建、点击路由、取 URL 的三级回退、
 * 失败上报）都在下面这些断言里。
 */
async function checkAsync(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok  ' + label);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + label + '\n      ' + error.message);
  }
}

function makeEvent() {
  const listeners = [];
  return {
    listeners,
    addListener: (fn) => listeners.push(fn),
    trigger: async (...args) => {
      for (const fn of listeners) {
        await fn(...args);
      }
    },
  };
}

function installChromeStub() {
  const created = [];
  const opened = [];
  const badges = [];
  const state = { tabUrl: '', tabsGetThrows: false };

  const stub = {
    runtime: { lastError: undefined, onInstalled: makeEvent(), onStartup: makeEvent() },
    contextMenus: {
      removeAll(callback) { created.length = 0; callback(); },
      create(properties, callback) { created.push(properties); if (callback) callback(); },
      onClicked: makeEvent(),
    },
    action: {
      setBadgeText: ({ text }) => badges.push(text),
      setBadgeBackgroundColor: () => {},
      setTitle: () => {},
    },
    tabs: {
      create: async ({ url }) => opened.push(url),
      get: async () => {
        if (state.tabsGetThrows) throw new Error('no host permission');
        return { url: state.tabUrl };
      },
    },
  };

  globalThis.chrome = stub;
  return { stub, created, opened, badges, state };
}

console.log('--- background：右键菜单 ---');

const harness = installChromeStub();
let importError = null;
try {
  await import('../extension/background.js');
} catch (error) {
  importError = error;
}

// 断言失败本身要能看见，但被测代码主动打的 warn/error 会淹没输出，先静音
const realWarn = console.warn;
const realError = console.error;
console.warn = () => {};
console.error = () => {};

await checkAsync('模块能加载，并同步注册了 onInstalled / onStartup / onClicked', () => {
  assert.equal(importError, null, 'background.js 导入失败：' + importError);
  // MV3 要求监听在顶层同步注册，否则 service worker 唤醒时收不到事件
  assert.equal(harness.stub.runtime.onInstalled.listeners.length, 1);
  assert.equal(harness.stub.runtime.onStartup.listeners.length, 1);
  assert.equal(harness.stub.contextMenus.onClicked.listeners.length, 1);
});

await harness.stub.runtime.onInstalled.trigger();

await checkAsync('建出 1 个父菜单 + 每个服务 1 个子菜单，id 与树形正确', () => {
  assert.equal(harness.created.length, SERVICES.length + 1);
  const parent = harness.created[0];
  assert.equal(parent.id, 'repojump');
  assert.equal(parent.parentId, undefined, '父菜单不该有 parentId');
  assert.equal(parent.title, 'Repo Jump');
  for (const [index, child] of harness.created.slice(1).entries()) {
    assert.equal(child.id, 'open:' + SERVICES[index].id);
    assert.equal(child.parentId, 'repojump');
    assert.deepEqual(child.documentUrlPatterns, parent.documentUrlPatterns);
    assert.ok(child.title.includes(SERVICES[index].label), '标题里应有服务名：' + child.title);
    assert.doesNotMatch(child.title, /[{}]/, '标题里还有未替换的占位符');
  }
});

await checkAsync('菜单显示范围限定在 github.com 且至少两段路径', () => {
  const patterns = harness.created[0].documentUrlPatterns;
  assert.deepEqual(patterns, ['https://github.com/*/*', 'http://github.com/*/*']);
});

async function click(menuItemId, info = {}, tab = { id: 7, url: '' }) {
  harness.opened.length = 0;
  harness.badges.length = 0;
  await harness.stub.contextMenus.onClicked.trigger({ menuItemId, ...info }, tab);
}

await checkAsync('点 open:deepwiki 打开对应模板地址', async () => {
  await click('open:deepwiki', { pageUrl: 'https://github.com/facebook/react' });
  assert.deepEqual(harness.opened, ['https://deepwiki.com/facebook/react']);
});

await checkAsync('pageUrl 缺失时回退到 tab.url（仓库子页也认）', async () => {
  await click('open:stackblitz', {}, { id: 7, url: 'https://github.com/vercel/next.js/tree/canary' });
  assert.deepEqual(harness.opened, ['https://stackblitz.com/github/vercel/next.js']);
});

await checkAsync('pageUrl 与 tab.url 都缺时回退到 tabs.get', async () => {
  harness.state.tabUrl = 'https://github.com/github/gitignore';
  await click('open:zread', {}, { id: 7 });
  assert.deepEqual(harness.opened, ['https://zread.ai/github/gitignore']);
});

await checkAsync('被静态过滤漏过的功能页不动作，也不报警', async () => {
  await click('open:deepwiki', { pageUrl: 'https://github.com/settings/profile' });
  assert.deepEqual(harness.opened, [], '不该打开任何页签');
  assert.ok(!harness.badges.includes('!'), '这是预期内的过滤，不该升角标');
});

await checkAsync('三条路都取不到地址时用角标报错，而不是静默失败', async () => {
  harness.state.tabsGetThrows = true;
  await click('open:deepwiki', {}, { id: 7 });
  harness.state.tabsGetThrows = false;
  assert.deepEqual(harness.opened, []);
  assert.ok(harness.badges.includes('!'), '应该升起角标');
});

await checkAsync('非本扩展的 menuItemId 被忽略', async () => {
  await click('some-other-item', { pageUrl: 'https://github.com/facebook/react' });
  assert.deepEqual(harness.opened, []);
});

await checkAsync('重复触发 onInstalled 不会留下重复菜单项', async () => {
  await harness.stub.runtime.onInstalled.trigger();
  assert.equal(harness.created.length, SERVICES.length + 1);
});

console.warn = realWarn;
console.error = realError;

console.log('\n' + passed + ' 项通过' + (failed ? '，' + failed + ' 项失败' : '，全部通过'));
if (failed) {
  process.exitCode = 1;
}
