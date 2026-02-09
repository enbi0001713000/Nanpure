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

## 画面状態（1ページ内状態切替）

- `HOME`：タイトル（2行）と「挑戦する」
- `SELECT`：難易度選択
- `PLAY`：盤面操作
- `MODAL_USERNAME`：初回開始時の名前登録
- `MODAL_SETTINGS`：設定（ユーザーネーム変更、表示設定）
- `MODAL_RESULT`：クリア時のリザルト

### 遷移概要

`HOME → SELECT → (名前未登録なら MODAL_USERNAME) → PLAY → MODAL_RESULT`

- `MODAL_RESULT` から「もう一度」で同難易度を再開
- `MODAL_RESULT` から「ホームへ」で `HOME` へ戻る
- URLパスは固定（方式A）

## 主な機能

- 固定リンク共有（X Intent）とリンクコピー
- ハッシュタグ固定：`#えびナンプレ`
- クリア後の編集ロック（入力/メモ/Undo/Redo無効）
- メモモードの視認性強化（ボタン状態とインジケーター）
- 難易度再選択時の破棄確認
- localStorage 保存
  - `np_username_v1`
  - `np_settings_v1`
  - `np_save_v1`

## デプロイ（GitHub Pages）

このリポジトリのファイルをそのまま GitHub Pages に公開可能です（ビルド工程不要）。
