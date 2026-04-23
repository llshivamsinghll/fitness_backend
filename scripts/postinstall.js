import { execSync } from 'node:child_process';

const run = (command) => {
  execSync(command, { stdio: 'inherit' });
};

run('npx prisma generate');

const isRender = process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID);
if (isRender) {
  run('npx prisma migrate deploy');
}
