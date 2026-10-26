#!/usr/bin/env node

/**
 * KetchUp Version Bump Script
 * 
 * Usage:
 *   node scripts/bump-version.js <patch|minor|major|x.y.z> [--tag]
 *   pnpm bump <patch|minor|major|x.y.z> [--tag]
 *   make bump v=<x.y.z>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

const FILES = {
  rootPackage: path.join(rootDir, 'package.json'),
  desktopPackage: path.join(rootDir, 'apps/desktop/package.json'),
  tauriConf: path.join(rootDir, 'apps/desktop/src-tauri/tauri.conf.json'),
  cargoToml: path.join(rootDir, 'apps/desktop/src-tauri/Cargo.toml'),
};

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));

const targetArg = args[0];
const shouldGitTag = flags.has('--tag') || flags.has('--git');
const shouldPush = flags.has('--push');

if (!targetArg) {
  console.error('\x1b[31mError: バージョンまたはインクリメント種別を指定してください。\x1b[0m');
  console.log('\n使用例:');
  console.log('  pnpm bump patch      # 0.2.0 -> 0.2.1');
  console.log('  pnpm bump minor      # 0.2.0 -> 0.3.0');
  console.log('  pnpm bump major      # 0.2.0 -> 1.0.0');
  console.log('  pnpm bump 0.3.0      # 直接指定');
  console.log('  pnpm bump patch --tag # バージョン更新 + git tag');
  console.log('  pnpm bump patch --push # バージョン更新 + git tag + push (CI/CDで最新DMG自動リリース)\n');
  process.exit(1);
}

// 現在のバージョンを取得（ルート package.json から）
const rootPkg = JSON.parse(fs.readFileSync(FILES.rootPackage, 'utf-8'));
const currentVersion = rootPkg.version;

function calculateNextVersion(current, target) {
  let cleanTarget = target.replace(/^v/, '');
  if (/^\d+\.\d+\.\d+/.test(cleanTarget)) {
    return cleanTarget;
  }

  const [major, minor, patch] = current.split('.').map(Number);
  switch (target.toLowerCase()) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      console.error(`\x1b[31mError: 不正なバージョン指定です: ${target}\x1b[0m`);
      process.exit(1);
  }
}

const nextVersion = calculateNextVersion(currentVersion, targetArg);

console.log(`\x1b[1mKetchUp Version Bump: \x1b[33mv${currentVersion}\x1b[0m -> \x1b[32mv${nextVersion}\x1b[0m\n`);

// 1. ルート package.json
rootPkg.version = nextVersion;
fs.writeFileSync(FILES.rootPackage, JSON.stringify(rootPkg, null, 2) + '\n');
console.log(`  ✓ ${path.relative(rootDir, FILES.rootPackage)}`);

// 2. apps/desktop/package.json
const desktopPkg = JSON.parse(fs.readFileSync(FILES.desktopPackage, 'utf-8'));
desktopPkg.version = nextVersion;
fs.writeFileSync(FILES.desktopPackage, JSON.stringify(desktopPkg, null, 2) + '\n');
console.log(`  ✓ ${path.relative(rootDir, FILES.desktopPackage)}`);

// 3. apps/desktop/src-tauri/tauri.conf.json
const tauriConf = JSON.parse(fs.readFileSync(FILES.tauriConf, 'utf-8'));
tauriConf.version = nextVersion;
fs.writeFileSync(FILES.tauriConf, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`  ✓ ${path.relative(rootDir, FILES.tauriConf)}`);

// 4. apps/desktop/src-tauri/Cargo.toml
let cargoContent = fs.readFileSync(FILES.cargoToml, 'utf-8');
cargoContent = cargoContent.replace(/^version\s*=\s*"[^"]+"/m, `version = "${nextVersion}"`);
fs.writeFileSync(FILES.cargoToml, cargoContent);
console.log(`  ✓ ${path.relative(rootDir, FILES.cargoToml)}`);

// 5. Git Commit & Tag (オプション)
if (shouldGitTag || shouldPush) {
  try {
    console.log(`\n📦 Git commit & tag を作成中...`);
    execSync(`git add "${FILES.rootPackage}" "${FILES.desktopPackage}" "${FILES.tauriConf}" "${FILES.cargoToml}"`, { stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to v${nextVersion}"`, { stdio: 'inherit' });
    execSync(`git tag "v${nextVersion}"`, { stdio: 'inherit' });
    console.log(`\n🏷️  \x1b[32mGit タグ v${nextVersion} を作成しました！\x1b[0m`);

    if (shouldPush) {
      console.log(`\n🚀 GitHub にプッシュ中 (CI/CD リリースをトリガー)...`);
      execSync(`git push && git push --tags`, { stdio: 'inherit' });
      console.log(`\n✨ \x1b[32mGitHub へのプッシュが完了しました！CI/CD による DMG 自動ビルドが開始されます。\x1b[0m`);
    }
  } catch (err) {
    console.warn(`\x1b[33mWarning: Git 操作に失敗しました: ${err.message}\x1b[0m`);
  }
}

console.log(`\n🎉 \x1b[32m全てのバージョンを一括で v${nextVersion} に同期完了しました！\x1b[0m\n`);
