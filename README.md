SaltshakerClient
A peer-to-peer voice platform with an open-source plugin system for games and real-time apps.
> Generated with [Angular CLI](https://github.com/angular/angular-cli) v17.1.3 and packaged with [Electron](https://www.electronjs.org/).
---
Download
Official releases are published in the Saltshaker Releases repository.
Platform	Status	Download
Windows	✅ Official	Latest release
macOS (Intel / Apple Silicon)	⚠️ Unsigned	Latest release
Linux	🔧 Unofficial	Build from source
---
Windows
Official Windows releases are signed and published in the Saltshaker Releases repository.
Install
Download the latest `.exe` installer from the releases page and run it.
Build from source
```bash
npm install
npm run build
```
Produces a `.exe` installer in the `dist/` folder.
---
macOS (Unsigned)
macOS builds are available in the Saltshaker Releases repository for both Intel and Apple Silicon. These builds are currently unsigned, so macOS will show a security warning on first launch.
Install
Download the latest `.dmg` or `.zip` for your architecture from the releases page.
Architecture	File
Apple Silicon (M1/M2/M3)	`*-arm64.dmg` / `*-arm64.zip`
Intel	`*-x64.dmg` / `*-x64.zip`
Bypassing the macOS security warning
Because the app is unsigned, macOS will block it on first launch. To allow it:
Open System Settings → Privacy & Security
Scroll down to the security prompt for Saltshaker and click Open Anyway
Alternatively, you can right-click (or Control-click) the app in Finder and select Open to bypass Gatekeeper on the first launch.
Build from source
```bash
npm install
npm run build
```
Produces `.dmg` and `.zip` artifacts in the `dist/` folder. To target a specific architecture:
```bash
npm run build -- --mac --arm64
npm run build -- --mac --x64
```
---
Linux (Unofficial)
Linux builds are not officially supported. Advanced users can run Saltshaker directly from source using Node.js and Electron, or attempt a local package build.
Run from source
```bash
git clone https://github.com/fkribs/Saltshaker-Public.git
cd Saltshaker-Public
npm install
npm start
```
Attempt a package build
```bash
npm install
npm run build
```
Linux packaging depends on the host environment and toolchain and is not officially maintained.
> **Notes:**
> - Community-supported only — no guaranteed support for distro-specific issues
> - Some plugin paths or permissions may require manual configuration
> - AppImage, `.deb`, or `.rpm` output depends on your local build environment
---
Development
Dev server
```bash
ng serve
```
Navigate to `http://localhost:4200/`. The app will automatically reload on source file changes.
Code scaffolding
```bash
ng generate component component-name
```
Other available schematics:
```bash
ng generate directive|pipe|service|class|guard|interface|enum|module
```
Build
```bash
npm run build
```
Build artifacts are stored in the `dist/` directory.
---
Testing
Unit tests
```bash
ng test
```
Executes unit tests via Karma.
End-to-end tests
```bash
ng e2e
```
Executes end-to-end tests via your configured platform. You will need to add an e2e testing package before using this command.
---
Further help
```bash
ng help
```
Or visit the Angular CLI Overview and Command Reference.
