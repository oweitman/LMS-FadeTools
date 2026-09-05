import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import AdmZip from 'adm-zip';
import { ROOT, build, parseXml } from '../scripts/build-release.js';

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fadetools-test-'));
    t.after(() => {
        // Only remove the exact temporary directory created by this test.
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('fadetools-test-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    fs.cpSync(path.join(ROOT, 'src'), path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'public.xml'), '<extensions><plugins /></extensions>');
    return root;
}

test('ZIP can be installed and its checksum and metadata match the catalog', t => {
    const root = fixture(t);
    const { version, archive } = build(root, { advance: true });
    const bytes = fs.readFileSync(archive);
    const plugin = parseXml(fs.readFileSync(path.join(root, 'public.xml'), 'utf8')).extensions.plugins.plugin;
    assert.equal(plugin['@_name'], 'FadeTools');
    assert.equal(plugin['@_version'], version);
    assert.equal(plugin.sha, createHash('sha1').update(bytes).digest('hex'));
    assert.ok(plugin.url.endsWith(`/v${version}/FadeTools-${version}.zip`));
    const zip = new AdmZip(bytes);
    assert.equal(zip.test(), true);
    for (const file of ['Plugin.pm', 'install.xml', 'strings.txt', 'README.txt', 'HTML/EN/plugins/FadeTools/html/icon.png']) {
        assert.ok(zip.getEntry(file), `Missing ${file} at its expected archive path`);
    }
    assert.ok(zip.getEntries().every(entry => !entry.entryName.startsWith('src/')));
    const manifest = parseXml(zip.readAsText('install.xml')).extension;
    assert.equal(manifest.version, version);
    assert.equal(manifest.homepage, plugin.link);
    assert.equal(manifest.targetApplication.minVersion, plugin['@_minTarget']);
    assert.deepEqual(zip.readFile('Plugin.pm'), fs.readFileSync(path.join(ROOT, 'src/Plugin.pm')));
    build(root);
    assert.deepEqual(fs.readFileSync(archive), bytes, 'Repeat build must produce identical ZIP bytes');
});

test('automatic patch increment and manual major version increase', t => {
    const root = fixture(t);
    const initial = build(root, { advance: true }).version;
    const [major, minor, patch] = initial.split('.').map(Number);
    const next = build(root, { advance: true }).version;
    assert.equal(next, `${major}.${minor}.${patch + 1}`);
    const manifestPath = path.join(root, 'src/install.xml');
    const manual = `${major + 1}.0.0`;
    fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, 'utf8').replace(`<version>${next}</version>`, `<version>${manual}</version>`));
    assert.equal(build(root, { advance: true }).version, manual);
});

test('nested assets are included and hidden development files are excluded', t => {
    const root = fixture(t);
    fs.writeFileSync(path.join(root, 'src/.local'), 'not for release');
    const zip = new AdmZip(build(root).archive);
    assert.equal(zip.getEntry('.local'), null);
    assert.ok(zip.getEntry('HTML/EN/plugins/FadeTools/html/icon.png'));
});

test('invalid XML and missing required files fail before producing a package', t => {
    const root = fixture(t);
    assert.throws(() => parseXml('<extension>'), /Invalid XML/);
    fs.unlinkSync(path.join(root, 'src/Plugin.pm'));
    assert.throws(() => build(root), /Missing plugin file: Plugin.pm/);
    assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});
