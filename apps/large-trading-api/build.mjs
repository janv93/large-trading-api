import { parseSync } from '@swc/core';
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = dirname(fileURLToPath(import.meta.url));
const sourceFiles = readdirSync(join(projectDir, 'src'), { recursive: true });
// Strategies need separate files because the application discovers them at runtime.
const strategyEntries = [];
// Singleton instances must not be recreated inside each bundle.
const singletonEntries = [];

for (const file of sourceFiles) {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file.endsWith('.d.ts')) continue;

  const entry = join('src', file);

  if (file.replaceAll('\\', '/').startsWith('strategies/')) strategyEntries.push(entry);

  const source = parseSync(readFileSync(join(projectDir, entry), 'utf8'), { syntax: 'typescript' });

  if (source.body.some((statement) => statement.type === 'ExportDefaultExpression' && statement.expression.type === 'NewExpression')) {
    singletonEntries.push(entry);
  }
}

// Keep singletons shared and controllers beside the worker files they launch.
const sharedEntries = [...singletonEntries, 'src/backtesting/live/live.ts', 'src/backtesting/auto-params/auto-params.ts'];
// Worker threads launch files directly, so each needs its own bundle.
const workerEntries = ['src/backtesting/live/worker.ts', 'src/backtesting/auto-params/worker.ts'];
const sharedModules = new Set(sharedEntries.map((entry) => resolve(projectDir, entry)));
const entryPoints = [...new Set(['src/app.ts', ...workerEntries, ...sharedEntries, ...strategyEntries])];

await Promise.all(
  entryPoints.map((entryPoint) =>
    build({
      absWorkingDir: projectDir,
      entryPoints: [entryPoint],
      outbase: 'src',
      outdir: '../../dist/apps/large-trading-api',
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      packages: 'external',
      tsconfig: 'tsconfig.json',
      keepNames: true,
      sourcemap: true,
      logLevel: 'warning',
      plugins: [
        {
          name: 'shared-module-entry-points',
          setup(build) {
            build.onResolve({ filter: /^\./ }, async (args) => {
              if (args.kind === 'entry-point' || args.pluginData?.resolvingSharedImport) return;

              const resolution = await build.resolve(args.path, {
                kind: args.kind,
                resolveDir: args.resolveDir,
                importer: args.importer,
                namespace: args.namespace,
                pluginData: { resolvingSharedImport: true },
              });
              if (!sharedModules.has(resolution.path)) return;

              const modulePath = relative(dirname(resolve(projectDir, entryPoint)), resolution.path)
                .replace(/\.ts$/, '')
                .replaceAll('\\', '/');

              return {
                path: `${modulePath.startsWith('.') ? '' : './'}${modulePath}.js`,
                external: true,
              };
            });
          },
        },
      ],
    }),
  ),
);

console.log(`Built ${entryPoints.length} backend bundles.`);
