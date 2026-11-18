#!/bin/bash
# 球球 · 一行安装
#
# 做的事：从 GitHub 把 pet 文件夹下载到 ~/QiuQiu，然后运行里面的 install.sh
# （install.sh 会在这台 Mac 上现场编译、安装、打开；不用 sudo，不改系统设置）。
#
# 用法：打开「终端」，粘贴下面这一行，回车：
#
#   curl -fsSL https://raw.githubusercontent.com/Kashing79/kashing/main/pet/get.sh | bash
#
# 想要开机自动出现，就在最后加上  -s -- --autostart
#
# 可以用环境变量改默认值：
#   QIUQIU_REF   从哪个分支 / 哪次提交下载（默认 main）
#   QIUQIU_DIR   下载到哪里（默认 ~/QiuQiu）

set -euo pipefail

REPO="Kashing79/kashing"
REF="${QIUQIU_REF:-main}"
DEST="${QIUQIU_DIR:-${HOME}/QiuQiu}"

if [ "$(uname -s)" != "Darwin" ] && [ "${QIUQIU_GET_ONLY:-0}" != "1" ]; then
  echo "这个脚本只能在 Mac 上运行。"
  exit 1
fi

# 分支名前面要加 refs/heads/；40 位的提交号直接用
case "${REF}" in
  refs/*) PART="${REF}" ;;
  *)
    if printf '%s' "${REF}" | grep -Eq '^[0-9a-f]{40}$'; then PART="${REF}"; else PART="refs/heads/${REF}"; fi
    ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

echo "正在下载球球 ……"
if ! curl -fsSL "https://codeload.github.com/${REPO}/tar.gz/${PART}" -o "${TMP}/src.tar.gz"; then
  echo "下载失败。请检查网络，或者改用压缩包安装（见 README.md）。"
  exit 1
fi
tar -xzf "${TMP}/src.tar.gz" -C "${TMP}"

SRC=""
for d in "${TMP}"/*/pet; do
  if [ -f "${d}/install.sh" ]; then SRC="${d}"; fi
done
if [ -z "${SRC}" ]; then
  echo "下载的内容里没有找到 pet 文件夹（分支 ${REF} 上可能还没有它）。"
  exit 1
fi

# 换成新的；旧的先挪开，换好了再删，中途失败不会两头落空
if [ -e "${DEST}" ]; then
  rm -rf "${DEST}.old"
  mv "${DEST}" "${DEST}.old"
fi
mkdir -p "${DEST}"
cp -R "${SRC}/." "${DEST}/"
rm -rf "${DEST}.old"
echo "已下载到： ${DEST}"

if [ "${QIUQIU_GET_ONLY:-0}" = "1" ]; then exit 0; fi

cd "${DEST}"
bash install.sh ${1+"$@"}
