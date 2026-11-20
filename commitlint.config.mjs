export const types = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
const header = new RegExp('^(' + types.join('|') + '): (?=[ -~]*[A-Za-z])[!-~](?:[ -~]{0,98}[!-~])?$');

export default {
  defaultIgnores: false,
  plugins: [{ rules: { 'english-header': ({ header: value }) =>
    [header.test(value), 'Use type: English description (1-100 printable ASCII characters).'] } }],
  rules: { 'english-header': [2, 'always'] }
};
