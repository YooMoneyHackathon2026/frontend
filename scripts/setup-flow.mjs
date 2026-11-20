import { execFileSync } from 'node:child_process';

for (const [key, value] of Object.entries({
  'core.hooksPath': '.githooks',
  'gitflow.branch.master': 'main',
  'gitflow.branch.develop': 'develop',
  'gitflow.prefix.feature': 'feature/',
  'gitflow.prefix.hotfix': 'hotfix/',
  'gitflow.prefix.versiontag': 'v'
})) execFileSync('git', ['config', '--local', key, value]);
