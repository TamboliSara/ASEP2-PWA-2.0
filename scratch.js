const { execSync } = require('child_process');

function run(cmd, cwd) {
  console.log(`\n>>> ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', cwd, stdio: 'pipe' });
    console.log(out);
    return true;
  } catch (e) {
    console.error(e.stdout || '');
    console.error(e.stderr || '');
    return false;
  }
}

const root = 'd:\\Engineering\\ASEP Final App\\ASEP2-PWA';

run('git add .', root);
run('git commit -m "fix: replace broken state.locker refs with currentLocker"', root);
run('git push origin main', root);
