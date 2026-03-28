import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: [path.resolve(__dirname, '../../node_modules/reflect-metadata/Reflect.js')],
  },
  resolve: {
    alias: {
      '@socialdrop/shared': path.resolve(__dirname, '../../libs/shared/src/index.ts'),
      '@socialdrop/prisma': path.resolve(__dirname, '../../libs/prisma/src/index.ts'),
      '@socialdrop/integrations': path.resolve(__dirname, '../../libs/integrations/src/index.ts'),
    },
  },
});
