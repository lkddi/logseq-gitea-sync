import { defineConfig, type Plugin } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Copy package.json and README files into dist/ so Logseq can load the built
 * folder ("Load unpacked plugin" requires a package.json next to the entry
 * html, and the plugin panel shows the README shipped in the package).
 */
function copyPackageFiles(): Plugin {
  return {
    name: 'copy-package-files',
    closeBundle() {
      const pkgPath = resolve(process.cwd(), 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      // The entry is relative to dist/ once the plugin is loaded from dist/
      pkg.main = 'index.html'
      writeFileSync(resolve(process.cwd(), 'dist/package.json'), JSON.stringify(pkg, null, 2))

      for (const file of ['README.md', 'README.en.md', 'LICENSE']) {
        const src = resolve(process.cwd(), file)
        try {
          writeFileSync(resolve(process.cwd(), 'dist', file), readFileSync(src))
        } catch {
          // optional files may not exist yet
        }
      }
    },
  }
}

export default defineConfig({
  // Relative base so asset URLs work when Logseq loads dist/index.html from disk
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  plugins: [copyPackageFiles()],
})
