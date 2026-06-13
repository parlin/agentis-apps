#!/usr/bin/env node
// Build artifacts/data.json from agentis-apps/apps.json + agentis-user-pelle/context/artifacts_index.md
// Embedded timestamps are ISO-8601; the page computes "X ago" at load time.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const appsJsonPath = resolve(repoRoot, 'apps.json');
const indexMdPath =
  process.env.AGENTIS_ARTIFACTS_INDEX ??
  resolve(repoRoot, '..', 'agentis-user-pelle', 'context', 'artifacts_index.md');
const outPath = resolve(repoRoot, 'artifacts', 'data.json');

function sh(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function readApps() {
  if (!existsSync(appsJsonPath)) return [];
  const raw = JSON.parse(readFileSync(appsJsonPath, 'utf8'));
  return (raw.apps ?? []).map((a) => ({
    slug: a.slug,
    title: a.title ?? a.slug,
    description: a.description ?? '',
    url: `https://parlin.github.io/agentis-apps/${a.slug}/`,
    repoKind: 'local-folder',
    repoRef: a.slug,
    status: 'deployed',
  }));
}

function readIndexMd() {
  if (!existsSync(indexMdPath)) return [];
  const lines = readFileSync(indexMdPath, 'utf8').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    if (line.includes('---')) continue;
    if (line.includes('Slug') && line.includes('Title')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 8) continue;
    const [slug, title, type, url, repo, , , status] = cells;
    let repoRef = '';
    const m = repo.match(/github\.com\/parlin\/([^\s)]+)/);
    if (m) repoRef = m[1];
    rows.push({
      slug,
      title,
      description: '',
      type,
      url,
      repoKind: repoRef === 'agentis-apps' ? 'local-folder' : 'github-repo',
      repoRef: repoRef === 'agentis-apps' ? slug : repoRef,
      status,
    });
  }
  return rows;
}

function lastCommitIso(item) {
  if (item.repoKind === 'local-folder') {
    return sh(`git -C ${repoRoot} log -1 --format=%cI -- ${item.repoRef}/`);
  }
  if (item.repoKind === 'github-repo' && item.repoRef) {
    return sh(`gh api repos/parlin/${item.repoRef}/commits --jq '.[0].commit.committer.date'`);
  }
  return '';
}

function merge(a, b) {
  const bySlug = new Map();
  for (const x of [...a, ...b]) {
    const prev = bySlug.get(x.slug) ?? {};
    bySlug.set(x.slug, {
      ...prev,
      ...x,
      description: x.description || prev.description || '',
    });
  }
  return [...bySlug.values()];
}

const apps = readApps();
const indexRows = readIndexMd();
const items = merge(apps, indexRows);

const deployed = [];
const pending = [];
for (const it of items) {
  if (it.status && it.status !== 'deployed') {
    pending.push({ slug: it.slug, title: it.title, status: it.status, url: it.url });
    continue;
  }
  deployed.push({
    slug: it.slug,
    title: it.title,
    description: it.description,
    url: it.url,
    lastCommit: lastCommitIso(it) || null,
  });
}

deployed.sort((a, b) => (b.lastCommit ?? '').localeCompare(a.lastCommit ?? ''));

const out = {
  generatedAt: new Date().toISOString(),
  deployed,
  pending,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${outPath} · ${deployed.length} deployed · ${pending.length} pending`);
