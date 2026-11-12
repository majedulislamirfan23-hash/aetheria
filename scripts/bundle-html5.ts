import fs from 'node:fs';
import path from 'node:path';

export function buildStandaloneHtml5(distDir = path.resolve(process.cwd(), 'dist')): string {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`dist/index.html not found at ${indexPath}. Run vite build first.`);
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // Inline stylesheet <link rel="stylesheet" ... href="/assets/...">
  html = html.replace(
    /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    (_full, href: string) => {
      const relPath = href.replace(/^\//, '');
      const assetPath = path.join(distDir, relPath);
      if (fs.existsSync(assetPath)) {
        const css = fs.readFileSync(assetPath, 'utf8');
        return `<style>\n${css}\n</style>`;
      }
      return '';
    },
  );

  // Also handle href before rel="stylesheet"
  html = html.replace(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi,
    (_full, href: string) => {
      const relPath = href.replace(/^\//, '');
      const assetPath = path.join(distDir, relPath);
      if (fs.existsSync(assetPath)) {
        const css = fs.readFileSync(assetPath, 'utf8');
        return `<style>\n${css}\n</style>`;
      }
      return '';
    },
  );

  // Strip manifest and SW register script for portable standalone file:// HTML5 usage
  html = html.replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]*id=["']vite-plugin-pwa:register-sw["'][^>]*><\/script>/gi, '');
  html = html.replace(/<script[^>]*src=["'][^"']*registerSW\.js["'][^>]*><\/script>/gi, '');

  // Collect all module script bundles referenced in index.html
  const moduleScripts: string[] = [];
  html = html.replace(
    /<script\b([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi,
    (full, _pre: string, src: string) => {
      const relPath = src.replace(/^\//, '');
      const assetPath = path.join(distDir, relPath);
      if (!fs.existsSync(assetPath)) return full;
      let js = fs.readFileSync(assetPath, 'utf8');
      // Escape closing script tags inside JS literals safely
      js = js.replace(/<\/script>/gi, '<\\/script>');
      moduleScripts.push(js);
      return '';
    },
  );

  // Strip modulepreload links pointing to local /assets/ that are now inlined
  html = html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '');

  if (moduleScripts.length > 0) {
    const combinedJs = moduleScripts.join('\n');
    html = html.replace(
      '</body>',
      `<script type="module">\n${combinedJs}\n</script>\n</body>`,
    );
  }

  const outPath = path.join(distDir, 'Aetheria-Project-Omega-HTML5.html');
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}

const isCli =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  path.basename(process.argv[1]).includes('bundle-html5');

if (isCli) {
  const out = buildStandaloneHtml5();
  const sizeMb = (fs.statSync(out).size / (1024 * 1024)).toFixed(2);
  console.log(`Bundled standalone HTML5 package: ${out} (${sizeMb} MB)`);
}
