# SaltshakerClient

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.1.3.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Electron Builds

### Windows

```bash
npm run build -- --win
```

Produces an NSIS installer: `dist/Saltshaker-<version>-Windows.exe`

### macOS

```bash
npm run build -- --mac
```

Produces:
- **DMG** (for distribution): `dist/Saltshaker-<version>-MacOS-<arch>.dmg`
- **ZIP** (for auto-updates): `dist/Saltshaker-<version>-MacOS-<arch>.zip`

Both `x64` (Intel) and `arm64` (Apple Silicon) architectures are built by default. To build for a specific architecture:

```bash
npm run build -- --mac --x64      # Intel only
npm run build -- --mac --arm64    # Apple Silicon only
```

macOS builds must be run on macOS.

### Linux (Unofficial)

```bash
npm run build -- --linux
```

Linux is not tested and only supported 'unofficially'. Community testers are welcome!
