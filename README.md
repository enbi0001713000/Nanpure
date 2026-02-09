# Nanpure Web

ブラウザだけで動く、ビルド不要のナンプレ（数独）アプリです。GitHub Pages にそのまま置けます。

## 起動（ローカル）

```bash
npm run dev
# http://localhost:5173 を開く
```

## テスト

```bash
npm run test
```

## 実装済み（MVP）

- 難易度別の新規ゲーム（易/中/難/鬼）
- 値入力 / 消去 / メモモード
- Undo / Redo（値とメモ両方）
- タイマー（開始・クリア時停止）
- ミス表示 ON/OFF
- 途中状態の自動保存と復帰（localStorage）
- ダークモード
- キーボード操作（矢印、1-9、Delete、N、Ctrl+Z / Ctrl+Y）

## 重要な改善点（白画面対策）

- `main.ts` / TypeScript + Vite 前提をやめ、**ブラウザが直接読める ES Modules (`.js`)** に変更しました。
- CSS は JS import ではなく `index.html` の `<link>` で読み込む構成に変更しました。

## デプロイ

このリポジトリのファイルをそのまま GitHub Pages に公開可能です（ビルド工程不要）。