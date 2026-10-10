#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { validate, type Coaching } from '@motivado/engine';
import { convert, type ImportIssue } from './convert';
import { parseXpdl } from './xpdl';

/**
 * Usage: motivado-import <modeling-dir> [--out <content-dir>] [--only key,key]
 *
 * Reads every `*.xpdl` below <modeling-dir> and writes
 *   <out>/coachings/<key>.json
 *   <out>/index.json
 *   <out>/import-report.json
 */

function findXpdl(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...findXpdl(full));
    else if (entry.endsWith('.xpdl')) found.push(full);
  }
  return found.sort();
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const source = process.argv[2];
if (!source || source.startsWith('--')) {
  console.error('Usage: motivado-import <modeling-dir> [--out <content-dir>] [--only key,key]');
  process.exit(2);
}
const outDir = resolve(arg('--out') ?? 'content');
const only = arg('--only')?.split(',');

mkdirSync(join(outDir, 'coachings'), { recursive: true });

interface ReportEntry {
  key: string;
  file: string;
  ok: boolean;
  nodes: number;
  edges: number;
  issues: (ImportIssue | { level: string; message: string; activity?: string })[];
}

const sourceRoot = resolve(source);
const relative = (file: string) => file.slice(sourceRoot.length + 1).replace(/\\/g, '/');
const report: ReportEntry[] = [];
const index: { key: string; domain: string; nodes: number; edges: number }[] = [];
const externalKeys = new Set<string>();

const results: { coaching: Coaching; file: string; ok: boolean; issues: ImportIssue[] }[] = [];
for (const file of findXpdl(resolve(source))) {
  const key = basename(file, '.xpdl');
  if (only && !only.includes(key)) continue;
  if (!/^[a-z0-9-]+$/.test(key)) {
    report.push({ key, file: relative(file), ok: false, nodes: 0, edges: 0, issues: [{ level: 'error', message: 'Invalid coaching key' }] });
    continue;
  }
  const xml = readFileSync(file, 'utf8');
  const { coaching, issues, ok } = convert(parseXpdl(xml, key), key);
  results.push({ coaching, file, ok, issues });
}

// Answer keys set by other coachings (profile data like gender) are legitimate references.
for (const r of results) for (const n of Object.values(r.coaching.nodes)) if (n.key) externalKeys.add(n.key);

for (const { coaching, file, ok, issues } of results) {
  const all = [...issues, ...validate(coaching, externalKeys).filter((i) => i.code !== 'unknown-variable')];
  const edges = Object.values(coaching.nodes).reduce((n, node) => n + node.next.length, coaching.start.length);
  const nodeCount = Object.keys(coaching.nodes).length;
  const playable = ok && !all.some((i) => i.level === 'error');
  report.push({ key: coaching.key, file: relative(file), ok: playable, nodes: nodeCount, edges, issues: all });
  if (playable) {
    writeFileSync(join(outDir, 'coachings', `${coaching.key}.json`), JSON.stringify(coaching, null, 2) + '\n');
    index.push({ key: coaching.key, domain: coaching.domain, nodes: nodeCount, edges });
  }
}

index.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
writeFileSync(join(outDir, 'import-report.json'), JSON.stringify(report, null, 2) + '\n');

const failed = report.filter((r) => !r.ok);
console.log(`Imported ${index.length} of ${report.length} coachings into ${outDir}`);
for (const f of failed) {
  console.log(`  FAILED ${f.key}: ${f.issues.filter((i) => i.level === 'error').map((i) => i.message).slice(0, 2).join(' | ')}`);
}
