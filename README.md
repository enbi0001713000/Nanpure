# Nanpure Web

数独（ナンプレ）をブラウザで遊べる静的Webアプリです。GitHub Pagesで公開できます。

## 開発

```bash
npm install
npm run dev
```

## テスト

```bash
npm run test
```

## ビルド

```bash
npm run build
```

## 機能（MVP）

- 難易度別の新規ゲーム（易/中/難/鬼）
- 値入力 / 消去 / メモモード
- Undo / Redo（値とメモ両方）
- タイマー（自動開始、クリアで停止）
- ミス表示 ON/OFF
- 途中状態の自動保存と復帰（localStorage）
- ダークモード
- キーボード操作（矢印、1-9、Delete、N、Ctrl+Z / Ctrl+Y）

## デプロイ

`main` ブランチに push すると GitHub Actions で `dist` が Pages にデプロイされます（`.github/workflows/deploy.yml`）。
