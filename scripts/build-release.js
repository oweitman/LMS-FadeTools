// Build the plugin ZIP and the LMS repository catalog. No LMS runtime required.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import AdmZip from 'adm-zip';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOMEPAGE = 'https://github.com/oweitman/LMS-FadeTools';
const xmlOptions = { ignoreAttributes: false, parseTagValue: false };

export function parseXml(text) {
    const result = XMLValidator.validate(text);
    if (result !== true) throw new Error(`Invalid XML: ${result.err.msg}`);
    return new XMLParser(xmlOptions).parse(text);
}

function parseVersion(version) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
        throw new Error(`Expected a major.minor.patch version, got ${version}`);
    }
    const parts = version.split('.').map(Number);
    if (!parts.every(Number.isSafeInteger)) throw new Error('Version number is too large');
    return parts;
}

function compareVersions(left, right) {
    for (let index = 0; index < 3; index++) {
        if (left[index] !== right[index]) return left[index] - right[index];
    }
    return 0;
}

function nextVersion(current, published, advance) {
    const currentParts = parseVersion(current);
    if (!advance || !published) return current;
    const publishedParts = parseVersion(published);
    if (compareVersions(currentParts, publishedParts) > 0) return current;
    publishedParts[2]++;
    const next = publishedParts.join('.');
    parseVersion(next);
    return next;
}

function sourceFiles(directory, prefix = '') {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error(`Symlinks are not supported: ${entry.name}`);
        if (entry.name.startsWith('.') || ['__pycache__', 'node_modules'].includes(entry.name)) continue;
        const relative = prefix + entry.name;
        if (entry.isDirectory()) {
            files.push(...sourceFiles(path.join(directory, entry.name), `${relative}/`));
        } else if (entry.isFile()) {
            files.push(relative);
        }
    }
    return files.sort();
}

export function build(root = ROOT, { advance = false } = {}) {
    const source = path.join(root, 'src');
    const manifestPath = path.join(source, 'install.xml');
    const catalogPath = path.join(root, 'public.xml');
    const manifestText = fs.readFileSync(manifestPath, 'utf8').replace(/\r\n/g, '\n');
    const manifest = parseXml(manifestText).extension;
    const previous = parseXml(fs.readFileSync(catalogPath, 'utf8')).extensions.plugins?.plugin;
    const version = nextVersion(manifest.version, previous?.['@_version'], advance);

    if (manifest.homepage !== HOMEPAGE) throw new Error('Unexpected plugin homepage');
    if (manifest.module !== 'Plugins::FadeTools::Plugin') throw new Error('Unexpected plugin module');
    for (const field of ['minVersion', 'maxVersion']) {
        if (!manifest.targetApplication?.[field]) throw new Error(`Missing ${field}`);
    }
    const files = sourceFiles(source);
    for (const required of ['Plugin.pm', 'install.xml', 'strings.txt', 'README.txt']) {
        if (!files.includes(required)) throw new Error(`Missing plugin file: ${required}`);
    }

    fs.writeFileSync(manifestPath, manifestText.replace(/<version>[^<]+<\/version>/, `<version>${version}</version>`));
    const readmePath = path.join(source, 'README.txt');
    const readme = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
    fs.writeFileSync(readmePath, readme.replace(/^Version .+$/m, `Version ${version}`));

    // Fixed timestamps, order and permissions make repeat builds identical.
    const zip = new AdmZip();
    for (const relative of files) {
        zip.addFile(relative, fs.readFileSync(path.join(source, relative)), '', 0o100644);
        zip.getEntry(relative).header.time = new Date(2020, 0, 1, 0, 0, 0);
    }
    const dist = path.join(root, 'dist');
    fs.mkdirSync(dist, { recursive: true });
    const archiveName = `FadeTools-${version}.zip`;
    const archive = path.join(dist, archiveName);
    const contents = zip.toBuffer();
    fs.writeFileSync(archive, contents);

    const catalog = {
        extensions: {
            details: { title: { '@_lang': 'EN', '#text': 'Fade Tools for Lyrion Music Server' } },
            plugins: {
                plugin: {
                    '@_name': 'FadeTools',
                    '@_version': version,
                    '@_minTarget': manifest.targetApplication.minVersion,
                    '@_maxTarget': manifest.targetApplication.maxVersion,
                    title: { '@_lang': 'EN', '#text': 'Fade Tools' },
                    desc: [
                        { '@_lang': 'EN', '#text': 'Fade playback in or out with server-timed CLI commands.' },
                        { '@_lang': 'DE', '#text': 'Wiedergabe mit serverseitig gesteuerten CLI-Befehlen ein- und ausblenden.' },
                    ],
                    url: `${HOMEPAGE}/releases/download/v${version}/${archiveName}`,
                    link: HOMEPAGE,
                    sha: createHash('sha1').update(contents).digest('hex'),
                    creator: manifest.creator,
                },
            },
        },
    };
    const builder = new XMLBuilder({ ...xmlOptions, format: true, indentBy: '  ' });
    fs.writeFileSync(catalogPath, '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(catalog));
    return { version, archive };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { advance: { type: 'boolean', default: false } } });
    const { version, archive } = build(ROOT, values);
    console.log(`Built ${path.basename(archive)} (version ${version})`);
    if (process.env.GITHUB_OUTPUT) {
        const relative = path.relative(ROOT, archive).split(path.sep).join('/');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\narchive=${relative}\n`);
    }
}
