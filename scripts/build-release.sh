#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p release
zip -FS -r release/rift-convoy-mobile-defense-crazygames.zip index.html assets -x '*.DS_Store'
unzip -t release/rift-convoy-mobile-defense-crazygames.zip
unzip -l release/rift-convoy-mobile-defense-crazygames.zip | sed -n '1,12p'
