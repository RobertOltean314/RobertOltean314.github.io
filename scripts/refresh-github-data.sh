#!/usr/bin/env bash
# Regenerates assets/data/github-snapshot.json from the live GitHub API.
# The site reads live data at runtime; this snapshot is the offline fallback
# and the source for the language-bytes breakdown (too many requests to do live).
#
# Usage:  ./scripts/refresh-github-data.sh
# Needs:  gh (authenticated)  — https://cli.github.com

set -euo pipefail
USER="RobertOltean314"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/assets/data/github-snapshot.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching profile..."
gh api "users/$USER" > "$TMP/profile.json"

echo "Fetching repositories..."
gh api "users/$USER/repos?per_page=100&sort=updated" --paginate > "$TMP/repos.json"

echo "Fetching per-repo languages..."
: > "$TMP/langs.ndjson"
for name in $(node -e "console.log(require('$TMP/repos.json').filter(r=>!r.fork).map(r=>r.name).join('\n'))"); do
  printf '  %s\n' "$name"
  langs=$(gh api "repos/$USER/$name/languages" 2>/dev/null || echo '{}')
  node -e "process.stdout.write(JSON.stringify({name:process.argv[1],languages:JSON.parse(process.argv[2])})+'\n')" "$name" "$langs" >> "$TMP/langs.ndjson"
done

node -e "
const fs=require('fs');
const profile=JSON.parse(fs.readFileSync('$TMP/profile.json','utf8'));
const repos=JSON.parse(fs.readFileSync('$TMP/repos.json','utf8'));
const langs=Object.fromEntries(
  fs.readFileSync('$TMP/langs.ndjson','utf8').trim().split('\n').filter(Boolean)
    .map(l=>{const o=JSON.parse(l);return [o.name,o.languages];})
);
const out={
  generated_at:new Date().toISOString(),
  profile:{
    login:profile.login, name:profile.name, avatar_url:profile.avatar_url,
    html_url:profile.html_url, company:profile.company, blog:profile.blog,
    location:profile.location, followers:profile.followers,
    following:profile.following, public_repos:profile.public_repos,
    created_at:profile.created_at
  },
  repos:repos.map(r=>({
    name:r.name, full_name:r.full_name, html_url:r.html_url,
    description:r.description, language:r.language, topics:r.topics||[],
    stargazers_count:r.stargazers_count, forks_count:r.forks_count,
    archived:r.archived, fork:r.fork, homepage:r.homepage,
    created_at:r.created_at, pushed_at:r.pushed_at, updated_at:r.updated_at,
    size:r.size
  })),
  languages:langs
};
fs.writeFileSync('$OUT', JSON.stringify(out,null,2));
console.log('Wrote', '$OUT', '—', out.repos.length, 'repos');
"
