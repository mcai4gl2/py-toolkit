# py-toolkit

A VS Code extension for Python monorepo development. Manages virtual environments, discovers sub-projects, and integrates pytest, ruff, mypy, black, cProfile, and crash-capture debugging — all from the command palette, sidebar, or status bar.

## Features

### Venv Management
- **Auto-detect package manager** — recognises `uv.lock` / `pyproject.toml` for uv, falls back to venv+pip
- **Hash-based staleness check** — MD5 of `requirements.txt` stored in `.venv/.requirements-hash`; skips reinstall when nothing changed
- **File watcher** — notifies you the moment dependencies change, with one-click update
- **Create, update, or delete** venvs from the sidebar context menu

### Project Discovery
- Recursively scans the workspace for directories containing `requirements.txt`, `pyproject.toml`, or `.py` files
- Supports nested projects (e.g. `mcp/weather`)
- Respects configurable exclude patterns

### Developer Tools
| Command | What it does |
|---|---|
| **Run Tests** | pytest with auto-venv resolution and test-file discovery |
| **Lint File** | Runs ruff, mypy, black sequentially (each toggleable) |
| **Profile File** | cProfile with `.stats` + `.txt` output to `out/profiles/` |
| **Debug File** | Runs with crash capture — saves exception, traceback, and metadata to `out/crashes/` |
| **Validate Workspace** | Checks Python version, venv status, and output dirs |

### Sidebar Tree View
The **py-toolkit** activity bar icon opens a project tree showing:
- Each discovered sub-project
- Venv status: up to date / stale / missing
- Python version and package manager
- Right-click context menu: Create Venv, Delete Venv, Open Terminal, Install Package

### Status Bar
Shows the active project, venv health, and package manager for the current file. Click to open a quick-pick with all available actions.

### Dynamic Task Provider
Automatically generates **Run**, **Test**, **Profile**, and **Lint** tasks for every executable Python file (files with `if __name__ == '__main__'`). Supports per-file task variants via settings. Tasks appear in the VS Code task runner (`Ctrl+Shift+B`) without any `tasks.json` maintenance.

## Commands

All commands are available from the command palette (`Ctrl+Shift+P`):

| Command | ID |
|---|---|
| Create/Update Virtual Environment | `pyToolkit.createVenv` |
| Discover Sub-projects | `pyToolkit.discoverProjects` |
| Run Tests | `pyToolkit.runTests` |
| Lint File | `pyToolkit.lintFile` |
| Profile File | `pyToolkit.profileFile` |
| Debug File (Crash Capture) | `pyToolkit.debugFile` |
| Validate Workspace | `pyToolkit.validateWorkspace` |
| Show Actions | `pyToolkit.showActions` |
| Refresh Projects | `pyToolkit.refreshTree` |

## Settings

All settings use the `pyToolkit.*` prefix and have IntelliSense support.

### Python

| Setting | Default | Description |
|---|---|---|
| `pyToolkit.python.minVersion` | `"3.10"` | Minimum Python version |
| `pyToolkit.python.preferredManagers` | `["uv", "venv+pip"]` | Package manager preference (auto-detected per project) |
| `pyToolkit.python.pypiMirror` | `"auto"` | PyPI mirror URL, or `"auto"` for geo-IP detection |

### Projects

| Setting | Default | Description |
|---|---|---|
| `pyToolkit.projects.excludePatterns` | `["*.venv", "__pycache__", ...]` | Patterns to exclude from discovery |

### Tools

| Setting | Default | Description |
|---|---|---|
| `pyToolkit.tools.test.defaultArgs` | `["-v", "--tb=short"]` | Default pytest arguments |
| `pyToolkit.tools.test.coverageArgs` | `["--cov", "--cov-report=html"]` | Coverage arguments |
| `pyToolkit.tools.lint.ruff.enabled` | `true` | Enable ruff |
| `pyToolkit.tools.lint.ruff.args` | `["check", "--select=E,F,W,I"]` | ruff arguments |
| `pyToolkit.tools.lint.mypy.enabled` | `true` | Enable mypy |
| `pyToolkit.tools.lint.mypy.args` | `["--strict", "--ignore-missing-imports"]` | mypy arguments |
| `pyToolkit.tools.lint.black.enabled` | `true` | Enable black |
| `pyToolkit.tools.lint.black.args` | `["--check", "--line-length=100"]` | black arguments |
| `pyToolkit.tools.profile.defaultTool` | `"cProfile"` | Profiling backend |
| `pyToolkit.tools.debug.debugger` | `"ipdb"` | Preferred debugger |

### Output

| Setting | Default | Description |
|---|---|---|
| `pyToolkit.output.baseDir` | `"out"` | Base output directory |
| `pyToolkit.output.profileDir` | `"out/profiles"` | Profile output |
| `pyToolkit.output.testReports` | `"out/test-reports"` | Test reports |
| `pyToolkit.output.coverageDir` | `"out/coverage"` | Coverage reports |

### Task Variants

Define multiple run configurations for a single file:

```jsonc
"pyToolkit.taskVariants": {
    "mcp/weather/src/server.py": [
        { "name": "HTTP", "args": ["--transport", "http"], "description": "Run with HTTP transport" },
        { "name": "Port 3000", "args": ["--port", "3000"] }
    ]
}
```

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
git clone https://github.com/ligeng/py-toolkit
cd py-toolkit
npm install
```

### Build
```bash
npm run compile    # one-shot compile
npm run watch      # watch mode
```

### Lint
```bash
npm run lint       # check
npm run lint:fix   # auto-fix
```

### Test
```bash
npm test
```

### Package
```bash
npm run package    # creates py-toolkit-<version>.vsix
```

### Release
```bash
./scripts/release.sh [patch|minor|major]
```

This will:
1. Run lint + compile + tests
2. Bump version in `package.json`
3. Git commit + tag
4. Push to origin
5. Build the `.vsix` package

The GitHub Actions release workflow then automatically:
- Publishes to the VS Code Marketplace
- Creates a GitHub Release with the `.vsix` attached

## License

[MIT](LICENSE)
