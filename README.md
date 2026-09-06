# Fade Tools for Lyrion Music Server

[![Release plugin](https://github.com/oweitman/LMS-FadeTools/actions/workflows/release.yml/badge.svg)](https://github.com/oweitman/LMS-FadeTools/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/oweitman/LMS-FadeTools)](https://github.com/oweitman/LMS-FadeTools/releases/latest)

<p align="center">
  <img
    src="src/HTML/EN/plugins/FadeTools/html/icon.png"
    alt="Fade Tools sound wave icon" width="160">
</p>

**Fade your music out, pause, and ease back into playback.** Fade Tools adds
server-timed volume transitions to Lyrion Music Server (LMS), ready for home
automation, bedtime routines, and a gentle return to your music.

Control the plugin through the LMS command interface. It does not add playback
buttons to the player interface.

## Features

| Command                   | Action                                |
| ------------------------- | ------------------------------------- |
| `fadeout pause <seconds>` | Fade out, then pause playback         |
| `fadeout stop <seconds>`  | Fade out, then stop playback          |
| `fadein play <seconds>`   | Start playback with a fade-in         |
| `fadein resume <seconds>` | Resume paused playback with a fade-in |
| `fadein pause <seconds>`  | Alias for `fadein resume`             |

Durations must be **greater than 0 and no more than 60 seconds**.

Fade-out runs in parallel on all active members of a sync group. Once every fade
has completed, the plugin pauses or stops playback and restores the previously
saved volume settings. Fade-in uses LMS's native fade-in support.

## Installation

Requires **Lyrion Music Server / Logitech Media Server 8.0 or later**, as declared
in the plugin metadata. Playback behavior depends on the player being used.

1.  Open **Settings > Plugins** in the LMS web interface.
2.  Under **Additional repositories** at the bottom
    of the page, add this URL and save:

        ```text
        https://raw.githubusercontent.com/oweitman/LMS-FadeTools/main/public.xml
        ```

3.  Reload the plugin page if necessary. Select **Fade Tools** from the available
    plugins and apply the installation.
4.  Restart LMS when prompted and check that **Fade Tools** is enabled.

### Manual installation

Download `FadeTools-<version>.zip` from the
[release page](https://github.com/oweitman/LMS-FadeTools/releases/latest).
Create a `FadeTools` folder in an LMS plugin directory and extract the ZIP into
it. The available plugin directories are listed under **Settings > Information**.

The resulting layout should be:

```text
FadeTools/
  Plugin.pm
  install.xml
  strings.txt
  README.txt
  HTML/EN/plugins/FadeTools/html/icon.png
```

Restart LMS afterwards. For the official Lyrion Docker image, the path used in
the bundled plugin documentation is `/config/cache/Plugins/FadeTools/`.

## Usage

### LMS CLI

Send these commands to the LMS CLI,
replacing `00:11:22:33:44:55` with your player ID:

```text
00:11:22:33:44:55 fadeout pause 2
00:11:22:33:44:55 fadein resume 1
00:11:22:33:44:55 fadeout stop 3
00:11:22:33:44:55 fadein play 2
```

### JSON-RPC / home automation

Send an HTTP `POST` to `http://<LMS-SERVER>:9000/jsonrpc.js` with
`Content-Type: application/json` and a body such as the following. Adjust the
server address, port, player ID, and authentication to match your installation.

```json
{
    "id": 1,
    "method": "slim.request",
    "params": ["00:11:22:33:44:55", ["fadeout", "pause", "2"]]
}
```

To resume with a fade-in, replace the command array with
`["fadein", "resume", "1"]`. This also works with automation tools that can
send HTTP requests.

## Troubleshooting

- **Plugin missing from the list:** Check the repository URL, save it, and reopen
  the plugin page.
- **Command not recognized:** Check that Fade Tools is enabled and restart LMS.
  Disable any old FadeOut installation.
- **Duration rejected:** Use a number in the range `0 < seconds <= 60`.
- **Further diagnosis:** Use the `plugin.fadetools` category in LMS logging settings.

Please report bugs and feature requests as
[GitHub issues](https://github.com/oweitman/LMS-FadeTools/issues). Include your
LMS version, player model, plugin version, command, and relevant log output.

## Releases for maintainers

The [release workflow](.github/workflows/release.yml) runs on pushes to `main`.
You can also start it through **Actions > Release plugin > Run workflow**.
It builds the current `main` branch. Releases run one at a time; GitHub may
combine pending runs when several pushes arrive in quick succession.

1. Install the locked build dependencies with `npm ci` and run the packaging tests.
2. Determine the version: the first release uses `src/install.xml`; subsequent
   releases automatically increment the patch version from `public.xml`.
   A manually increased version in `install.xml`, such as `1.1.0`, takes precedence.
3. Package the contents of `src/` directly into `FadeTools-<version>.zip` and
   publish it as a GitHub release tagged `v<version>`.
4. Commit the download URL and the ZIP's SHA-1 checksum to `public.xml`, together
   with the version updates in `src/install.xml` and `src/README.txt`.

The catalog is updated after the release is published. The bot commit uses
`GITHUB_TOKEN` and does not trigger another release run. Before making further
local changes, pull the bot commit with `git pull --rebase`.

GitHub Actions needs repository write access (`contents: write`, set in the
workflow). Branch rules must allow the bot to push to `main`. No additional
personal access token is required. The repository and release downloads must be
publicly accessible for users to install the plugin.

If a run fails after publication but before the catalog is pushed, it can be
started again. An existing release asset is compared with the rebuilt ZIP before
the catalog is updated; it is not overwritten. If source changes or a build-tool
change produce a different ZIP, set a higher version
in `src/install.xml` and push again.

### Local build and tests

Requires **Node.js 22 or later** and npm. Python is not needed. The build uses
`adm-zip` for ZIP files and `fast-xml-parser` for XML; tests use Node's built-in
test runner. These are development tools and are not included in the plugin ZIP.

```sh
npm ci
npm test
npm run build
```

`npm run build` creates `dist/FadeTools-<version>.zip` and updates the local
`public.xml`. It does not publish anything. To also advance the version as the
workflow does, run:

```sh
npm run build -- --advance
```

Discard locally generated catalog changes before pushing if the associated
package has not been published. Tests build in temporary directories and leave
your source files and catalog untouched.

The scripts are [scripts/build-release.js](scripts/build-release.js) and
[tests/release.test.js](tests/release.test.js). The package and repository format
follows [LMS-shoutcast](https://github.com/oweitman/LMS-shoutcast).

The icon was generated with the built-in Imagegen tool. Its generation prompt
is recorded in [docs/icon-prompt.md](docs/icon-prompt.md).
