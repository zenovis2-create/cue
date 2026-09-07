"""Purge inventoried credential homes; print paths and commit hashes only.

No credential values are read by this script. The preserved inventory is metadata.
Git plumbing rewrites history without stashing or changing dirty source files.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'evidence' / 'P11'


def git(*args, data=None, env=None, cwd=ROOT):
    result = subprocess.run(['git', *args], input=data, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, cwd=cwd, env=env)
    if result.returncode:
        # Git error output is deliberately not propagated from history operations.
        raise RuntimeError('git metadata operation failed: ' + args[0])
    return result.stdout


inventory = json.loads((EVIDENCE / 'p11_credential_inventory.json').read_text())
paths = [item['path'] for item in inventory['inventory']]
prefixes = sorted({path.rsplit('/', 1)[0] + '/' for path in paths})
original_head = git('rev-parse', 'HEAD').decode().strip()
refs = [line.split(' ', 1) for line in git('for-each-ref', '--format=%(refname) %(objectname)').decode().splitlines()]
commits = git('rev-list', '--reverse', '--topo-order', '--all').decode().splitlines()
mapping = {}
removed_blobs = set()
removed_paths = set()

with tempfile.TemporaryDirectory(prefix='cue-p11-history-') as temp:
    env = {**os.environ, 'GIT_INDEX_FILE': str(Path(temp) / 'index')}
    for commit in commits:
        entries = git('ls-tree', '-r', '-z', commit).split(b'\0')
        removed = []
        for entry in filter(None, entries):
            meta, raw_path = entry.split(b'\t', 1)
            path = raw_path.decode()
            if any(path.startswith(prefix) for prefix in prefixes):
                removed.append(raw_path)
                removed_blobs.add(meta.split()[2].decode())
                removed_paths.add(path)
        raw = git('cat-file', 'commit', commit)
        header, body = raw.split(b'\n\n', 1)
        lines = header.split(b'\n')
        if removed:
            git('read-tree', commit, env=env)
            git('update-index', '--force-remove', '-z', '--stdin', data=b'\0'.join(removed) + b'\0', env=env)
            tree = git('write-tree', env=env).strip()
        else:
            tree = lines[0].split(b' ')[1]
        new_lines = []
        for line in lines:
            if line.startswith(b'tree '):
                line = b'tree ' + tree
            elif line.startswith(b'parent '):
                parent = line.split(b' ')[1].decode()
                line = b'parent ' + mapping.get(parent, parent).encode()
            new_lines.append(line)
        rewritten = b'\n'.join(new_lines) + b'\n\n' + body
        mapping[commit] = commit if rewritten == raw else git('hash-object', '-t', 'commit', '-w', '--stdin', data=rewritten).decode().strip()
    updates = []
    for ref, old in refs:
        new = mapping.get(old, old)
        if new != old:
            updates.append(f'update {ref} {new} {old}')
    if updates:
        git('update-ref', '--stdin', data=('\n'.join(updates) + '\n').encode())

git('reflog', 'expire', '--expire=now', '--all')
git('gc', '--prune=now')
reachable = {line.split(' ', 1)[0] for line in git('rev-list', '--objects', '--all').decode().splitlines()}
unreachable = all(blob not in reachable for blob in removed_blobs)
absent = all(subprocess.run(['git', 'cat-file', '-e', blob], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0 for blob in removed_blobs)
fsck = git('fsck', '--full', '--no-reflogs').decode()
with tempfile.TemporaryDirectory(prefix='cue-p11-fresh-clone-') as temp:
    clone = Path(temp) / 'clone'
    git('clone', '--no-local', '--quiet', str(ROOT), str(clone))
    fresh_paths = git('log', '--all', '--format=', '--name-only', cwd=clone).decode().splitlines()
    fresh_clean = not any(any(path.startswith(prefix) for prefix in prefixes) for path in fresh_paths)
    fresh_absent = all(subprocess.run(['git', 'cat-file', '-e', blob], cwd=clone, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0 for blob in removed_blobs)
    fresh_fsck = git('fsck', '--full', '--no-reflogs', cwd=clone).decode()

ignored = subprocess.run(['git', 'check-ignore', '--no-index', '.codex/auth.json', 'daemon/.test-state-example/homes/codex-home-example/auth.json'], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0
result = {
    'schema': 'cue.p11.credential-hygiene.v1',
    'inventory': inventory['inventory'],
    'removedPaths': sorted(removed_paths),
    'originalHead': original_head,
    'rewrittenHead': git('rev-parse', 'HEAD').decode().strip(),
    'purgeVerification': {'blobsUnreachable': unreachable, 'blobsAbsentAfterGc': absent,
                          'gitFsckPassed': not fsck.strip(), 'freshCloneNoPathResidue': fresh_clean,
                          'freshCloneBlobsAbsent': fresh_absent, 'freshCloneFsckPassed': not fresh_fsck.strip(),
                          'credentialHomeIgnored': ignored},
    'guardTest': 'daemon/test/p11-credential-hygiene.test.ts',
    'guardVerification': 'pending targeted test',
    'credentialService': 'OpenAI ChatGPT/Codex OAuth',
    'rotation': 'User confirmed rotation 2026-09-06 19:33; no credential values read or emitted by purge'
}
result['passed'] = all(result['purgeVerification'].values())
(EVIDENCE / 'p11_credential_hygiene.json').write_text(json.dumps(result, indent=2) + '\n')
(EVIDENCE / 'p11_credential_hygiene.log').write_text('\n'.join(f'{key}: {value}' for key, value in result['purgeVerification'].items()) + '\n')
print(json.dumps({'passed': result['passed'], 'originalHead': original_head, 'rewrittenHead': result['rewrittenHead']}))
if not result['passed']:
    raise SystemExit(1)
