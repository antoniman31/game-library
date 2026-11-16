import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empreintes, politique, ajouterCsp } from './csp.js';

// Empreintes calculées à part (openssl dgst -sha256 -binary | base64), pas avec le code testé.
test('empreinte d\'un script en ligne, espaces compris', () => {
  assert.deepEqual(empreintes('<script>alert(1)</script>'), ["'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='"]);
  assert.deepEqual(empreintes('<script>\n  console.log("x");\n</script>'), ["'sha256-jVwlLRxptxXs4cUUBlTu6M3tc106DraLUBB0YnEkrsc='"]);
});

test('un script chargé par src n\'a pas d\'empreinte', () => {
  assert.deepEqual(empreintes('<script type="module" crossorigin src="/a.js"></script><script id="x" src="/b.js"></script>'), []);
});

test('la politique n\'autorise ni script en ligne ni eval', () => {
  const p = politique('<script>alert(1)</script>');
  assert.match(p, /script-src 'self' 'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF\+pI='/);
  assert.doesNotMatch(p, /unsafe-inline|unsafe-eval|\*/);
  assert.match(p, /object-src 'none'/);
  assert.match(p, /base-uri 'none'/);
});

test('la CSP se place juste après <meta charset>, avant le premier script', () => {
  const html = '<head>\n    <meta charset="UTF-8" />\n    <script>alert(1)</script>\n</head>';
  const sortie = ajouterCsp(html);
  const csp = sortie.indexOf('Content-Security-Policy');
  assert.ok(csp > sortie.indexOf('charset') && csp < sortie.indexOf('<script>'));
});

test('sans <meta charset> ou avec une CSP déjà là, la construction s\'arrête', () => {
  assert.throws(() => ajouterCsp('<head><script>alert(1)</script></head>'), /charset/);
  assert.throws(() => ajouterCsp(ajouterCsp('<meta charset="UTF-8" />')), /déjà/);
});
