#!/usr/bin/env node
/** Reject tracked runtime directories without reading or printing their contents.
 * Run from the repository root. This checks the index, not old Git history and
 * not arbitrary credential patterns in source files.
 */
import { execFileSync } from 'node:child_process';

try {
  const paths = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(Boolean);
  const count = paths.filter((p) =>
    p.split('/').some((part) => part.toLowerCase() === '.oclive_directory_plugin_data'),
  ).length;
  if (count > 0) {
    console.error(`FAIL: ${count} runtime-state file(s) are tracked. Back them up privately, then remove them from the index. File contents are not shown.`);
    process.exitCode = 1;
  } else {
    console.log('PASS: no directory-plugin runtime state is tracked.');
  }
} catch {
  console.error('FAIL: unable to inspect the Git index; run this check from a Git worktree.');
  process.exitCode = 1;
}
