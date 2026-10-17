const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = file => fs.readFileSync(file, 'utf8');
const PAGES = ['index.html', 'room.html', 'privacy.html', '404.html'];
const BALISE = `<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "a8f2e92ff4a04e478dc913a4a681de71"}'></script>`;

// Directives de la CSP du <meta>, pas une chaîne cherchée dans tout le fichier : une source
// ajoutée à la mauvaise directive laisserait passer le test et bloquerait la balise.
function csp(html) {
    const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
    if (!meta) return null;
    return Object.fromEntries(meta[1].split(';').map(d => d.trim().split(/\s+/)).filter(d => d[0]).map(([nom, ...sources]) => [nom, sources]));
}

test('chaque page porte la balise Cloudflare Web Analytics une fois, avant </body>', () => {
    for (const page of PAGES) {
        const html = read(page);
        assert.equal(html.split(BALISE).length - 1, 1, page);
        assert.ok(html.indexOf(BALISE) < html.indexOf('</body>'), page);
    }
});

test('la CSP de chaque page laisse passer le script et ses envois', () => {
    for (const page of PAGES) {
        const directives = csp(read(page));
        if (!directives) continue;
        assert.ok(directives['script-src']?.includes('https://static.cloudflareinsights.com'), `${page} : script-src`);
        assert.ok(directives['connect-src']?.includes('https://cloudflareinsights.com'), `${page} : connect-src`);
    }
});

test('la page de confidentialité dit la mesure sans cookie', () => {
    const html = read('privacy.html');
    assert.match(html, /<h3>4\.3\. Mesure d'audience sans cookie \(Cloudflare Web Analytics\)<\/h3>/);
    assert.match(html, /<h3>4\.4\. Vos droits \(RGPD\)<\/h3>/);
});
