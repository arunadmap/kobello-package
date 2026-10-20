import { defineConfig } from 'tsup';

// ES modules for browsers (Vite, webpack and other bundlers), with type definitions.
export default defineConfig({
  entry: ['src/index.ts', 'src/shell.ts', 'src/mock.ts', 'src/protocol.ts'],
  format: ['esm'],
  dts: true,
  target: 'es2020',
  clean: true,
});
