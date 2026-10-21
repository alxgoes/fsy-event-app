#!/bin/sh
# Compila e roda os testes de lógica pura no macOS (sem simulador, leve para 8 GB).
set -eu
cd "$(dirname "$0")/.."
: "${DEVELOPER_DIR:=/Users/alexgoes/Downloads/Xcode.app/Contents/Developer}"
export DEVELOPER_DIR
OUT="${TMPDIR:-/tmp}/fsy-logic-tests"
xcrun --sdk macosx swiftc -O -module-name FSYLogic \
  Shared/EventCalendar.swift FSY/Core/Models.swift FSY/Core/EventClock.swift FSY/Core/DeepLink.swift \
  Tests/main.swift -o "$OUT"
"$OUT"
