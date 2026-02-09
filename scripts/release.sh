#!/usr/bin/env bash
set -euo pipefail

# ─── py-toolkit release script ───────────────────────────────────────────────
# Usage: ./scripts/release.sh [patch|minor|major]
#
# Steps:
#   1. Checks for clean working tree
#   2. Compiles TypeScript
#   3. Runs lint
#   4. Packages the VSIX
#   5. Bumps version in package.json (patch by default)
#   6. Commits and tags the release
#   7. Pushes to remote (branch + tag)
#   8. Publishes to VS Code Marketplace
#   9. Creates a GitHub release with the VSIX attached
# ──────────────────────────────────────────────────────────────────────────────

BUMP="${1:-patch}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# ─── Preflight checks ────────────────────────────────────────────────────────

echo "==> Preflight checks..."

if ! command -v node &>/dev/null; then
  echo "ERROR: node is not installed" >&2; exit 1
fi

if ! command -v npx &>/dev/null; then
  echo "ERROR: npx is not installed" >&2; exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "WARNING: gh (GitHub CLI) not found — GitHub release step will be skipped"
  HAS_GH=false
else
  HAS_GH=true
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first." >&2
  git status --short >&2
  exit 1
fi

# ─── Build & quality gates ───────────────────────────────────────────────────

echo "==> Installing dependencies..."
npm ci

echo "==> Compiling TypeScript..."
npm run compile

echo "==> Running lint..."
npm run lint

echo "==> Packaging VSIX (pre-release validation)..."
npx vsce package --no-dependencies
PRE_VSIX=$(ls -t *.vsix | head -1)
rm -f "$PRE_VSIX"

# ─── Version bump ────────────────────────────────────────────────────────────

echo "==> Bumping version ($BUMP)..."
OLD_VERSION=$(node -p "require('./package.json').version")
npm version "$BUMP" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "    $OLD_VERSION -> $NEW_VERSION"

# ─── Package final VSIX ──────────────────────────────────────────────────────

echo "==> Packaging final VSIX..."
npx vsce package --no-dependencies
VSIX="py-toolkit-${NEW_VERSION}.vsix"

if [[ ! -f "$VSIX" ]]; then
  echo "ERROR: Expected $VSIX not found" >&2; exit 1
fi

# ─── Git commit & tag ────────────────────────────────────────────────────────

echo "==> Committing version bump..."
git add package.json package-lock.json
git commit -m "release: v${NEW_VERSION}"
git tag -a "v${NEW_VERSION}" -m "v${NEW_VERSION}"

echo "==> Pushing to remote..."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin "$BRANCH"
git push origin "v${NEW_VERSION}"

# ─── Publish to VS Code Marketplace ──────────────────────────────────────────

echo "==> Publishing to VS Code Marketplace..."
if [[ -n "${VSCE_PAT:-}" ]]; then
  npx vsce publish --packagePath "$VSIX"
  echo "    Published $VSIX to marketplace"
else
  echo "    VSCE_PAT not set — skipping marketplace publish."
  echo "    To publish manually: npx vsce publish --packagePath $VSIX"
fi

# ─── GitHub Release ──────────────────────────────────────────────────────────

if $HAS_GH; then
  echo "==> Creating GitHub release..."
  gh release create "v${NEW_VERSION}" "$VSIX" \
    --title "v${NEW_VERSION}" \
    --generate-notes
  echo "    GitHub release v${NEW_VERSION} created"
else
  echo "==> Skipping GitHub release (gh CLI not installed)"
  echo "    Upload $VSIX manually at your repository's Releases page"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "=== Release v${NEW_VERSION} complete ==="
echo "    VSIX: $VSIX"
