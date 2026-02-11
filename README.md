# Nanpure Web

ブラウザで動くナンプレ（数独）アプリです。

## 開発フロー（運用ルール）

- **編集対象は TypeScript（`src/**/*.ts`）のみ**。
- **JavaScript（`src/**/*.js`）は生成物**として扱い、`npm run build` で更新します。
- 実行前に `npm run build` を通して、TS→JS 変換後の成果物で確認してください。

## 起動（ローカル）

```bash
npm run dev
# http://localhost:5173 を開く
```

`dev` は `build` を先に実行してから静的サーバーを起動します。

## テスト・チェック

```bash
npm run typecheck
npm run test
```

- `typecheck`: TS の型検査のみ実行（JSは更新しない）
- `test`: `build` 実行後に Node テストを実行

## 主な機能

- 難易度切り替え（easy/medium/hard/oni）
- メモ入力、Undo/Redo、同数字再入力で消去
- 設定でON/OFF可能な自動候補メモ（初期値OFF、ON時は手動メモ編集を無効化）
- 罰ヒント（1盤面3回まで、30秒加算）
- ミス表示、同一数字ハイライト、ダークモード
- ミス表示がOFFでも、入力ミスの内部カウントは継続（リザルト/統計に反映）
- localStorage 保存
  - `np_settings_v1`
  - `np_save_v1`
  - `np_stats_v1`
