#!/bin/bash
# 开发用：把 pet/ 打成一个可以直接发给她的 zip（不含编译产物）。
# 用法：bash dev/package.sh <输出目录>
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-.}"
TMP="$(mktemp -d)"
mkdir -p "${TMP}/qiuqiu-pet"
cp -R CLAUDE.md README.md SCENES.md install.sh uninstall.sh get.sh web src assets dev iphone phone "${TMP}/qiuqiu-pet/"
rm -rf "${TMP}/qiuqiu-pet/dev/node_modules"
(cd "${TMP}" && zip -qr qiuqiu-pet.zip qiuqiu-pet -x '*.DS_Store')
mv "${TMP}/qiuqiu-pet.zip" "${OUT}/qiuqiu-pet.zip"
rm -rf "${TMP}"
echo "打包完成：${OUT}/qiuqiu-pet.zip"
