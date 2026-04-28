const esbuild = require('esbuild');
const path = require('path');

async function bundle() {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, '..', 'packages/backend/src/index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: path.join(__dirname, '..', 'packages/backend/dist/index.js'),
      external: [
        'firebase-admin',
        'firebase-functions',
        '@nestjs/microservices',
        '@nestjs/websockets',
        'cache-manager',
        'class-transformer',
        'class-validator',
        'swagger-ui-dist',
      ],
      sourcemap: true,
      minify: false,
    });
    console.log('✅ Bundle complete');
  } catch (err) {
    console.error('❌ Bundle failed', err);
    process.exit(1);
  }
}

bundle();
