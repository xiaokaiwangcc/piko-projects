#!/usr/bin/env bash
# 契约冒烟：BASE_URL=https://board-demo-web.pages.dev bash scripts/smoke.sh
# 注意：判据一律用 Pages 同源域名；*.workers.dev 在部分网络（大陆电信等）不可达，不能用来判定可用性。
set -uo pipefail
BASE_URL="${BASE_URL:?请设置 BASE_URL，例如 https://board-demo-web.pages.dev}"
PASS=0
FAIL=0

hit() {
  local label="$1" expect="$2" method="$3" path="$4" data="${5:-}"
  local args=(-s -o /tmp/smoke_body -w '%{http_code}' -X "$method" "$BASE_URL$path")
  if [ -n "$data" ]; then
    args+=(-H 'Content-Type: application/json' --data "$data")
  fi
  local code
  code=$(curl "${args[@]}")
  local body
  body=$(cat /tmp/smoke_body)
  if [ "$code" = "$expect" ]; then
    PASS=$((PASS+1)); printf 'PASS  %-22s %s %s -> %s  %s\n' "$label" "$method" "$path" "$code" "$body"
  else
    FAIL=$((FAIL+1)); printf 'FAIL  %-22s %s %s -> %s (期望 %s)  %s\n' "$label" "$method" "$path" "$code" "$expect" "$body"
  fi
}

hit "health"            200 GET    /api/health
hit "列表(初始/空)"      200 GET    /api/notes
hit "新增"              201 POST   /api/notes         '{"content":"  smoke 测试  "}'
hit "空内容"            400 POST   /api/notes         '{"content":"   "}'
hit "201字"             400 POST   /api/notes         "{\"content\":\"$(printf 'x%.0s' $(seq 1 201))\"}"
hit "非法JSON"          400 POST   /api/notes         '{oops'
hit "删除不存在id"      404 DELETE /api/notes/999999
hit "非法id"            400 DELETE /api/notes/abc
hit "未知路由"          404 GET    /api/nope
hit "OPTIONS 预检"      204 OPTIONS /api/notes

printf '\n通过 %d / 失败 %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
