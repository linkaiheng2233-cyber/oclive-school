import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('./check-runtime-state-untracked.mjs', import.meta.url));
function fixture(fn) {
  const parent = path.resolve(tmpdir());
  const dir = mkdtempSync(path.join(parent, 'oclive-runtime-index-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  const add = (rel) => {
    const file = path.join(dir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'synthetic fixture\n');
    git('add', '-f', '--', rel);
  };
  const check = () => spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q');
    fn({ dir, git, add, check });
  } finally {
    const resolved = path.resolve(dir);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith('oclive-runtime-index-'));
    rmSync(resolved, { recursive: true, force: true });
  }
}

test('keeps official role content and similarly named source paths', () => fixture(({ add, check }) => {
  add('distros/chat-pro/roles/mumu/personality.txt');
  add('docs/.oclive_directory_plugin_data-notes.md');
  const result = check();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /PASS/);
}));

test('rejects forced tracked runtime data at old and nested roots; removal recovers', () => fixture(({ add, git, check }) => {
  for (const rel of [
    'roles/.oclive_directory_plugin_data/chats/synthetic.json',
    'distros/chat-pro/roles/.oclive_directory_plugin_data/user_remote_llm_token',
    'custom/.OCLIVE_DIRECTORY_PLUGIN_DATA/plugin_state.json',
  ]) add(rel);
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /3 runtime-state file/);
  assert.doesNotMatch(result.stderr, /synthetic fixture/);
  git('rm', '-r', '-f', '--cached', '--', 'roles', 'distros', 'custom');
  assert.equal(check().status, 0);
}));

test('fails closed outside a Git worktree', () => {
  const result = spawnSync(process.execPath, [script], { cwd: tmpdir(), encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unable to inspect the Git index/);
});
