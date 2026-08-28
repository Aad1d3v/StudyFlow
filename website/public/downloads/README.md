# Website downloads

The StudyFlow website enables its **Download for Windows** button automatically
when a real installer is available here. Never fake a download: the button
stays in the honest "coming soon" state until one of these is true:

1. **This folder** contains the installer and `manifest.json` says `"ready": true`
   (easiest — see below), or
2. The site is built with `VITE_WINDOWS_DOWNLOAD_URL` set (hosted release,
   e.g. a GitHub release asset).

## Adding the installer

From the repository root, after building the installer with
`scripts/build-exe.ps1` (or any build), run:

```bash
node scripts/prepare-download.mjs <path-to>-setup.exe
```

The script copies the installer into this folder and flips `manifest.json` to
`"ready": true` with the correct filename and version. Rebuild the website
(`npm run build` inside `website/`) and host the whole `website/dist` folder —
the download button will be live.

The button also works in `npm run dev` without a rebuild once the manifest is
ready, because the site probes `/downloads/manifest.json` at runtime.
