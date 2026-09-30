import { SERVICES, analyzeUrl, buildUrl } from './services.js';
import { LANG, t } from './i18n.js';

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const emptyTitleEl = document.getElementById('empty-title');
const emptyHintEl = document.getElementById('empty-hint');
const repoEl = document.getElementById('repo');
const statusEl = document.getElementById('status');
const keysEl = document.getElementById('keys');

const COPY_ICON =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">' +
  '<rect x="5.75" y="5.75" width="8.5" height="8.5" rx="2"/>' +
  '<path d="M10.25 3.75V3.5a2 2 0 0 0-2-2H3.5a2 2 0 0 0-2 2v4.75a2 2 0 0 0 2 2h.25" stroke-linecap="round"/>' +
  '</svg>';

const CHECK_ICON =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
  '<path d="M2.75 8.5 6 11.75l7.25-7.5" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

/**
 * 徽标色板：按菜单位置取色，色相之间刻意拉开距离。
 * 不用哈希是因为哈希出来的颜色看着随机、相邻项还可能撞色；
 * 颜色在这里只是帮助扫读，不承载语义，所以顺序变、颜色跟着变是可以接受的。
 */
const BADGE_HUES = [212, 275, 160, 28, 340, 45, 190, 130];

let statusTimer = 0;

function setStatus(message) {
  statusEl.textContent = message;
  statusEl.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove('show'), 2000);
}

/**
 * 把文本写进剪贴板。
 *
 * 扩展弹窗里 navigator.clipboard 会因为焦点时序偶尔抛 "Document is not
 * focused"，所以保留一条 textarea + execCommand 的回退路径。
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 继续走回退方案
  }

  const scratch = document.createElement('textarea');
  scratch.value = text;
  scratch.setAttribute('readonly', '');
  scratch.className = 'offscreen';
  document.body.appendChild(scratch);
  scratch.focus();
  scratch.select();

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  scratch.remove();
  return ok;
}

function markCopyButton(button) {
  button.classList.add('done');
  button.innerHTML = CHECK_ICON;
  setTimeout(() => {
    button.classList.remove('done');
    button.innerHTML = COPY_ICON;
  }, 1500);
}

async function openService(url, label, row) {
  try {
    await chrome.tabs.create({ url });
  } catch {
    // 只在模板写坏（非法 URL）时才会走到这里，留在弹窗里报错比静默关掉好
    setStatus(t.openFailed.replace('{label}', label));
    return;
  }
  row.classList.add('launched');
  setStatus(t.launched.replace('{label}', label));
  // 留一点时间让用户看到反馈，再关掉弹窗
  setTimeout(() => window.close(), 220);
}

function buildRow(service, index, owner, repo) {
  const url = buildUrl(service.urlTemplate, owner, repo);

  const row = document.createElement('li');
  row.className = 'row';

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'open';
  open.title = url;

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.style.setProperty('--hue', String(BADGE_HUES[index % BADGE_HUES.length]));
  badge.textContent = service.short;
  badge.setAttribute('aria-hidden', 'true');

  const meta = document.createElement('span');
  meta.className = 'meta';

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = service.label;

  const note = document.createElement('span');
  note.className = 'note';
  note.textContent = service.note[LANG] || service.note.en || '';

  meta.append(label, note);

  const kbd = document.createElement('kbd');
  kbd.className = 'kbd';
  kbd.textContent = String(index + 1);

  open.append(badge, meta, kbd);
  open.setAttribute('aria-label', `${service.label} — ${t.open}`);
  open.addEventListener('click', () => openService(url, service.label, row));

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'copy';
  copy.title = t.copy;
  copy.setAttribute('aria-label', `${t.copy} — ${service.label}`);
  copy.innerHTML = COPY_ICON;
  copy.addEventListener('click', async () => {
    const ok = await copyText(url);
    if (ok) {
      markCopyButton(copy);
      setStatus(t.copied.replace('{label}', service.label));
    } else {
      setStatus(t.copyFailed);
    }
  });

  row.append(open, copy);
  return { row, url };
}

function showEmpty(analysis) {
  const key = analysis.reason === 'not-github'
    ? 'NotGithub'
    : analysis.reason === 'not-repo'
      ? 'NotRepo'
      : 'Unknown';

  emptyTitleEl.textContent = t[`empty${key}Title`];
  emptyHintEl.textContent = t[`empty${key}Hint`];
  emptyEl.hidden = false;
  keysEl.textContent = '';
}

async function readActiveTabUrl() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs[0] ? tabs[0].url || '' : '';
  } catch {
    return '';
  }
}

async function main() {
  const analysis = analyzeUrl(await readActiveTabUrl());

  if (!analysis.ok) {
    showEmpty(analysis);
    return;
  }

  repoEl.textContent = `${analysis.owner}/${analysis.repo}`;
  repoEl.title = analysis.source;

  const targets = [];
  SERVICES.forEach((service, index) => {
    const { row, url } = buildRow(service, index, analysis.owner, analysis.repo);
    listEl.append(row);
    targets.push({ url, label: service.label, row });
  });

  listEl.hidden = false;
  keysEl.textContent = t.keys;

  // 数字键直达：这是"统一执行入口"的键盘加速，不引入任何额外权限。
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= targets.length) {
      return;
    }
    event.preventDefault();
    const target = targets[index];
    openService(target.url, target.label, target.row);
  });
}

main();
