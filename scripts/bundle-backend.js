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
        '@nestjs/platform-express',
        'cache-manager',
        'class-transformer',
        'class-validator',
        'class-validator/cjs',
        'class-transformer/cjs',
        'swagger-ui-dist',
        'exceljs',
        'express',
        'rxjs',
      ],
      sourcemap: false,
      minify: false,
      keepNames: true,
      tsconfig: path.join(__dirname, '..', 'packages/backend/tsconfig.json'),
    });
    console.log('✅ Bundle complete');
  } catch (err) {
    console.error('❌ Bundle failed', err);
    process.exit(1);
  }
}

bundle();
