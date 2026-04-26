# SaltshakerClient

A peer-to-peer voice platform with an open-source plugin system for games and real-time apps.

> Generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.1.3 and packaged with [Electron](https://www.electronjs.org/).

---

## Windows

Official Windows releases are signed and published in the [Saltshaker Releases](https://github.com/fkribs/Saltshaker-Releases/releases) repository.

Download the latest installer:

**[⬇ Download for Windows (.exe)](https://github.com/fkribs/Saltshaker-Releases/releases)**

### Build from source

```bash
npm install
npm run build
```

Produces a signed `.exe` installer in the `dist/` folder.

---

## macOS

Official macOS releases are published in the [Saltshaker Releases](https://github.com/fkribs/Saltshaker-Releases/releases) repository. These builds are currently **unsigned**, so macOS will display a security warning on first launch.

Supported architectures:

| Architecture | File |
|---|---|
| Apple Silicon (M1/M2/M3) | `Saltshaker-*-MacOS-arm64.dmg` / `.zip` |
| Intel | `Saltshaker-*-MacOS-x64.dmg` / `.zip` |

**[⬇ Download for macOS (.dmg / .zip)](https://github.com/fkribs/Saltshaker-Releases/releases)**

> **macOS will block the app on first launch.** To allow it:
> 1. Open **System Settings → Privacy & Security**
> 2. Scroll down to the Saltshaker prompt and click **Open Anyway**
>
> Alternatively, right-click (or Control-click) the app in Finder and select **Open** to bypass Gatekeeper directly.

### Build from source

```bash
npm install
npm run build
```

Produces `.dmg` and `.zip` artifacts in the `dist/` folder for both `x64` and `arm64`.

---

## Linux (Unofficial)

Linux builds are not officially supported. Advanced users can run Saltshaker directly from source using Node.js and Electron.

### Run from source

```bash
git clone https://github.com/fkribs/Saltshaker-Public.git
cd Saltshaker-Public
npm install
npm start
```

### Attempt a package build

```bash
npm install
npm run build
```

> **Notes:**
> - Community-supported only — no guaranteed support for distro-specific issues
> - Linux packaging depends on your host environment and is not officially maintained
> - Some plugin paths or permissions may require manual configuration

---

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

---

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

---

## Build

Run `npm run build` to build the project. The build artifacts will be stored in the `dist/` directory.

---

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

---

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

---

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
