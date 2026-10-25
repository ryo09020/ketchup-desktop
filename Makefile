.PHONY: setup dev desktop.dev desktop.run desktop.build desktop.web dmg lint test

setup:
	pnpm install

dev: desktop.dev

desktop.dev:
	cd apps/desktop && pnpm tauri dev

desktop.run:
	./apps/desktop/src-tauri/target/debug/ketchup-desktop

desktop.build:
	cd apps/desktop && pnpm tauri build

dmg: desktop.build
	cp apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg ./KetchUp-macOS.dmg
	@echo "✅ 最新の KetchUp-macOS.dmg を更新しました！"

desktop.web:
	cd apps/desktop && pnpm vite

lint:
	pnpm -F desktop lint

test:
	pnpm -F desktop test

bump:
	node scripts/bump-version.js $(v)
