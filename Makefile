.PHONY: setup desktop.dev desktop.run desktop.build desktop.web dmg lint test

setup:
	pnpm install

desktop.dev:
	cd apps/desktop && pnpm tauri dev

desktop.build:
	cd apps/desktop && pnpm tauri build

dmg: desktop.build
	cp apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg ./KetchUp-macOS.dmg
	@echo "✅ 最新の KetchUp-macOS.dmg を更新しました！"

lint:
	pnpm -F desktop lint

test:
	pnpm -F desktop test
