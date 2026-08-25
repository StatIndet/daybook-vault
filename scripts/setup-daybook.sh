#!/bin/bash
set -euo pipefail

# Find version
VERSION="latest"
if [ -f ".daybook-version" ]; then
    VERSION=$(cat .daybook-version | tr -d '[:space:]')
fi
if [ -z "$VERSION" ]; then
    VERSION="latest"
fi

# Set up local paths
DAYBOOK_DIR="$PWD/.daybook/bin"
DAYBOOK_BIN="$DAYBOOK_DIR/daybook"

# Check cache
if [ -x "$DAYBOOK_BIN" ]; then
    CURRENT_VERSION=$($DAYBOOK_BIN --version 2>/dev/null | awk '{print $3}')
    # daybook --version outputs like "daybook version vX.Y.Z"
    if [ "$VERSION" != "latest" ] && [ "$CURRENT_VERSION" = "$VERSION" ]; then
        echo "Daybook $VERSION is already installed at $DAYBOOK_BIN, skipping download."
        exit 0
    fi
    # If latest, we still download to ensure it's actually the latest
fi

echo "Setting up Daybook ($VERSION)..."

# Detect OS and Arch
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    linux) OS="linux" ;;
    darwin) OS="darwin" ;;
    *) echo "Unsupported OS: $OS" && exit 1 ;;
esac

case "$ARCH" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "Unsupported Architecture: $ARCH" && exit 1 ;;
esac

echo "Detected platform: ${OS}_${ARCH}"

# Determine URLs
REPO="StatIndet/daybook"
if [ "$VERSION" = "latest" ]; then
    echo "Resolving latest Daybook release..."
    LATEST_URL=$(
        curl -fsSL \
            -o /dev/null \
            -w '%{url_effective}' \
            "https://github.com/$REPO/releases/latest"
    ) || {
        echo "ERROR: Failed to resolve latest Daybook release."
        exit 1
    }

    VERSION="${LATEST_URL##*/}"

    if [ -z "$VERSION" ] || [ "$VERSION" = "latest" ]; then
        echo "ERROR: Failed to resolve latest Daybook release tag."
        exit 1
    fi

    echo "Resolved latest Daybook release: $VERSION"
fi

DOWNLOAD_BASE="https://github.com/$REPO/releases/download/$VERSION"
ARCHIVE_NAME="daybook_${VERSION}_${OS}_${ARCH}.tar.gz"
CHECKSUM_FILE="checksums.txt"

# Download archive and checksum
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading Daybook $VERSION ($ARCHIVE_NAME)..."
if ! curl -sSLf "$DOWNLOAD_BASE/$ARCHIVE_NAME" -o "$TMP_DIR/$ARCHIVE_NAME"; then
    echo "ERROR: Daybook release $VERSION ($ARCHIVE_NAME) not found."
    exit 1
fi

echo "Downloading checksums..."
if ! curl -sSLf "$DOWNLOAD_BASE/$CHECKSUM_FILE" -o "$TMP_DIR/$CHECKSUM_FILE"; then
    echo "ERROR: Checksum file not found for release $VERSION."
    exit 1
fi

# Verify checksum
cd "$TMP_DIR"
# The checksum file format usually looks like:
# hash  filename
if ! grep "$ARCHIVE_NAME" "$CHECKSUM_FILE" | sha256sum --check --status; then
    echo "ERROR: Checksum validation failed!"
    exit 1
fi
echo "Checksum verified."

# Extract and install
tar -xzf "$ARCHIVE_NAME" daybook
cd - > /dev/null

mkdir -p "$DAYBOOK_DIR"
mv "$TMP_DIR/daybook" "$DAYBOOK_BIN"
chmod +x "$DAYBOOK_BIN"

echo "Daybook $VERSION installed successfully to $DAYBOOK_BIN."
