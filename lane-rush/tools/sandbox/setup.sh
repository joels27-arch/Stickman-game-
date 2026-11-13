# one-time setup of a fresh Higgsfield sandbox (after website_repo_access checkout): bun, wrangler, test scripts
set -e
cd /home/user
B=https://raw.githubusercontent.com/joels27-arch/stickman-game-/${1:-claude/inkfall-rts-game-c0g5po}/lane-rush/tools/sandbox
curl -sf -o sync.sh $B/sync.sh; mkdir -p e2e; curl -sf -o e2e/ob.js $B/ob.js
printf 'for p in $(pgrep -f "work""erd"); do kill $p; done\nfor p in $(pgrep -f "wrangler"" dev"); do kill $p; done\n' > k.sh
[ -x ~/.bun/bin/bun ] || (curl -fsSL https://bun.sh/install | bash) > bun.log 2>&1
cd website-b79f182e045711a0471705ae/app && [ -x node_modules/.bin/wrangler ] || ~/.bun/bin/bun add -d wrangler@4.118.0 > /home/user/bw.log 2>&1
git -C /home/user/website-b79f182e045711a0471705ae checkout -- package.json bun.lock 2>/dev/null || true
echo setup done
