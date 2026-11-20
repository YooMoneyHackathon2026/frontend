import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';
import { types } from '../commitlint.config.mjs';

const run = (bin, ...args) => execFileSync(bin, args, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }).trim();
const git = (...args) => run('git', ...args);
const gh = (...args) => run('gh', ...args);
const fail = message => { throw new Error(message); };
const lines = text => text.split('\n').filter(Boolean);
const [mode, ...args] = process.argv.slice(2);
const branch = git('branch', '--show-current');
if (!/^(feature|bugfix|hotfix|chore)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch)) fail('Switch to a named task branch.');
const base = branch.startsWith('hotfix/') ? 'main' : 'develop';
const repo = JSON.parse(gh('repo', 'view', '--json', 'nameWithOwner')).nameWithOwner;
git('fetch', 'origin', '--tags');
const tags = lines(git('tag', '--list', 'v*')).filter(t => semver.valid(t.slice(1))).sort(semver.rcompare);
const field = (tag, key) => git('tag', '-l', tag, '--format=%(trailers:key=' + key + ',valueonly)');
const own = tags.filter(t => field(t, 'Task-Branch') === branch);
const stable = own.find(t => !semver.prerelease(t));
const temp = mkdtempSync(join(tmpdir(), 'git-flow-'));
function file(name, text) {
  const path = join(temp, name);
  writeFileSync(path, text + '\n');
  return path;
}
function publish(tag) {
  const title = field(tag, 'PR-Title');
  const notes = t => git('tag', '-l', t, '--format=%(contents)').split('\n').filter(l => l.startsWith('- '));
  const all = [...new Set([...own, tag].filter((t,i,a) => a.indexOf(t) === i).sort(semver.compare).flatMap(notes))];
  const body = file('pr.md', '## Что было изменено?\n\n' + all.join('\n'));
  const prs = JSON.parse(gh('pr','list','--repo',repo,'--head',branch,'--base',base,'--state','all','--json','number,state'));
  if (prs.some(p => p.state !== 'OPEN')) fail('Task PR is closed. Start a new branch.');
  git('push','--atomic','-u','origin','HEAD:refs/heads/' + branch,'refs/tags/' + tag);
  if (prs.length) gh('pr','edit',String(prs[0].number),'--repo',repo,'--title',title,'--body-file',body);
  else gh('pr','create','--repo',repo,'--base',base,'--head',branch,'--title',title,'--body-file',body);
  if (['minor','major'].includes(field(tag,'Version-Bump'))) {
    const releases = lines(gh('api','--paginate','repos/' + repo + '/releases','--jq','.[] | select(.draft == false and .prerelease == false) | .tag_name'));
    if (releases.includes(tag)) return;
    const prior = releases.find(t => semver.valid(t) && semver.lt(t, tag));
    const changes = lines(git('log','--reverse','--no-merges','--format=%s',prior ? prior + '..' + tag : tag));
    gh('release','create',tag,'--repo',repo,'--verify-tag','--title',title,'--notes-file',file('release.md','## Что было изменено?\n\n' + changes.map(s => '- ' + s).join('\n')));
  }
}
try {
  if (mode === 'publish') {
    const tag = own.find(t => git('rev-list','-1',t) === git('rev-parse','HEAD'));
    if (!tag) fail('No task tag at HEAD.');
    publish(tag);
  } else {
    const [message, title, ...bullets] = args;
    if (!['patch','minor','major','rc'].includes(mode) || (mode === 'rc') !== Boolean(stable)) fail('Use a stable bump for the first tag and rc for later tags.');
    if (!message || !new RegExp('^(' + types.join('|') + '): \\S').test(title ?? '') || !bullets.length ||
        [title,...bullets].some(s => !s.trim() || /[\r\n\p{Extended_Pictographic}]/u.test(s))) fail('Supply a commit header, typed PR title and change bullets.');
    if (stable) git('merge-base', '--is-ancestor', stable, 'HEAD');
    const closed = gh('pr','list','--repo',repo,'--head',branch,'--base',base,'--state','closed','--json','number');
    if (JSON.parse(closed).length) fail('Task already closed.');
    if (!git('diff','--cached','--name-only')) fail('Stage task files first.');
    if (git('diff','--name-only','--','package.json','package-lock.json')) fail('Stage intended manifest changes first.');
    run('node_modules/.bin/commitlint','--edit',file('message',message));
    const stableMax = tags.find(t => !semver.prerelease(t)) || '0.0.0';
    const version = stable ? stable.slice(1) + '-rc.' + (1 + Math.max(0,...own.filter(t => semver.prerelease(t)).map(t => Number(semver.prerelease(t)[1])))) : semver.inc(stableMax,mode);
    const tag = 'v' + version;
    for (const name of ['package.json','package-lock.json']) {
      const manifest = JSON.parse(readFileSync(name));
      manifest.version = version;
      if (name === 'package-lock.json') manifest.packages[''].version = version;
      writeFileSync(name, JSON.stringify(manifest,null,2) + '\n');
    }
    git('add','--','package.json','package-lock.json');
    git('commit','-m',message);
    const annotation = [title,'','Что было изменено?','',...bullets.map(s => '- ' + s),'','Task-Branch: ' + branch,'Version-Bump: ' + mode,'PR-Title: ' + title].join('\n');
    git('tag','-a',tag,'-F',file('tag.md',annotation));
    publish(tag);
    console.log(tag);
  }
} finally { rmSync(temp,{recursive:true,force:true}); }
