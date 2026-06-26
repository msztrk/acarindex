/**
 * Generates docs/visual-audit/d3/index.html from audit-metadata.json
 * Usage: node scripts/visual-audit/generate-d3-gallery.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const metaPath = join(root, 'docs/visual-audit/d3/audit-metadata.json')
const outPath = join(root, 'docs/visual-audit/d3/index.html')

if (!existsSync(metaPath)) {
  console.error('Missing audit-metadata.json — run D3 Playwright suite first')
  process.exit(1)
}

const { generatedAt, entries } = JSON.parse(readFileSync(metaPath, 'utf8'))

const rows = entries
  .map((e) => {
    const img = e.afterShot
      ? `<img src="${e.afterShot}" alt="${e.route}" loading="lazy" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px" />`
      : '<em>—</em>'
    return `<tr>
      <td><code>${escapeHtml(e.route)}</code></td>
      <td>${escapeHtml(e.pageType)}</td>
      <td>${escapeHtml(e.viewport)}</td>
      <td>${escapeHtml(e.statusBefore)}</td>
      <td>${escapeHtml(e.change)}</td>
      <td>${escapeHtml(e.statusAfter)}</td>
      <td>${img}</td>
      <td>${escapeHtml(e.remainingRisk ?? '')}</td>
    </tr>`
  })
  .join('\n')

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AcarIndex D3 Visual Audit Gallery</title>
  <style>
    :root { --brand: #1a3a5c; --muted: #64748b; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; color: #0f172a; background: #f8fafc; }
    h1 { font-family: Georgia, serif; color: var(--brand); }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    th, td { padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 0.875rem; }
    th { background: #f1f5f9; text-align: left; font-weight: 600; }
    code { font-size: 0.8rem; }
    .meta { color: var(--muted); margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>Faz 6C-Beta D3 — Görsel Denetim Galerisi</h1>
  <p class="meta">Oluşturulma: ${escapeHtml(generatedAt)} · ${entries.length} kayıt</p>
  <table>
    <thead>
      <tr>
        <th>Route</th>
        <th>Sayfa türü</th>
        <th>Viewport</th>
        <th>Önceki statü</th>
        <th>Değişiklik</th>
        <th>Son statü</th>
        <th>After</th>
        <th>Kalan risk</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

writeFileSync(outPath, html)
console.log(`Wrote ${outPath}`)

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
