#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN="$HOME/bin"

command -v bun >/dev/null 2>&1 || {
  echo "ERROR: Bun is required. Install it from https://bun.sh (curl -fsSL https://bun.sh/install | bash)" >&2
  exit 1
}

echo "Running the test suite first (fully local, no network)..."
(cd "$ROOT" && bun test) || {
  echo "ERROR: tests failed; not installing a broken checkout." >&2
  exit 1
}

mkdir -p "$BIN"

# The CLI wrapper pins this checkout's path, so `zap-check` works from anywhere.
cat > "$BIN/zap-check" <<WRAPPER
#!/usr/bin/env bash
exec bun "$ROOT/src/cli.ts" "\$@"
WRAPPER
chmod 755 "$BIN/zap-check"

echo "Installed: $BIN/zap-check -> bun $ROOT/src/cli.ts"

case ":$PATH:" in
  *":$BIN:"*) ;;
  *) echo "NOTE: $BIN is not in your PATH. Add this to your shell profile:"
     echo "  export PATH=\"\$HOME/bin:\$PATH\"" ;;
esac

if [ ! -f "$ROOT/.env" ]; then
  echo "Next: cp .env.example .env and fill in ZAPCHECK_URL and ZAPCHECK_TOKEN."
fi
