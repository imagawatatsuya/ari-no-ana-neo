# ezdog組版ノウハウ

> 来源: https://books.ezdog.org/diary/ のCSS解析（2026年7月）
> 根本原則: 全テキスト処理はCSSのみ。JavaScript不使用。

## 1. ルートレベル設定（:root）

```css
:root {
  line-break: strict;              /* 厳格な禁則処理 */
  hanging-punctuation: allow-end;  /* 句読点のぶら下げ */
  text-autospace: normal;          /* CJK/非CJK間の自動スペーシング */
}

body {
  word-break: break-word;
  overflow-wrap: break-word;
}
```

## 2. 本文段落

```css
.article-body {
  text-align: justify;
  text-justify: inter-character;   /* 全文字間で均等割付（CJK最適解） */
  letter-spacing: 0;               /* 明示ゼロ。text-justifyに委ねる */
  font-size: 17px;
  line-height: 1.75;
  font-family: Georgia, '游明朝', YuMincho, 'Hiragino Mincho ProN', Meiryo, serif;
}
```

- `inter-character` は `inter-word`（デフォルト）と異なり、CJK文字間で均等に字間を分配する
- `letter-spacing: 0` を明示しないと、ブラウザ既定値が干渉する場合がある

## 3. 約物制御（.nihongo スパン）

```css
.nihongo {
  font-feature-settings: "halt" 1;  /* 半角代替字形 */
  word-spacing: 0.25em;             /* 約物後の精密な字間 */
}
```

### HTML パターン

約物＋半角スペースを `<span class="nihongo">` でラップする：

```html
本文テキスト<span class="nihongo">。 </span>次のテキスト
引用の開始<span class="nihongo">「</span>引用本文<span class="nihongo">」 </span>続き
```

### ラップ対象パターン一覧

| パターン | 説明 |
|----------|------|
| `。 ` | 句点＋半角スペース |
| `、 ` | 読点＋半角スペース |
| `「` | 開き鉤括弧（前置スペースなし） |
| `」 ` | 閉じ鉤括弧＋半角スペース |
| `『` | 開き二重鉤括弧 |
| `』 ` | 閉じ二重鉤括弧＋半角スペース |
| `（` | 開き丸括弧 |
| `） ` | 閉じ丸括弧＋半角スペース |
| `）、 ` | 閉じ括弧＋読点＋スペース |
| `）。 ` | 閉じ括弧＋句点＋スペース |
| `』 『` | 閉じ＋開き（連続引用） |

## 4. 見出し（h1〜h6）

```css
h1, h2, h3, h4, h5, h6 {
  font-feature-settings: "palt";       /* プロポーショナル代替字形 */
  word-break: keep-all !important;     /* CJK見出しの途中分割禁止 */
  text-align: start;                   /* 両端揃えしない */
}
```

## 5. 引用ブロック

```css
blockquote {
  text-align: start;    /* 両端揃えしない */
  line-break: loose;    /* 緩い禁則（引用文の自然な折り返し） */
}
```

## 6. 段落構造

- 第1段落: クラスなし
- 第2段落以降: `class="gyoukan"`（margin-top: 6.8px 相当）
- 字下げ: 全角スペース `　` をテキスト先頭に挿入（CSS text-indent は不使用）
- ドロップキャップ: **本项目では不使用**

## 7. .tate ラッパー

```html
<div class="tate">
  <div class="entry-content">...</div>
</div>
```

- 縦書き対応のwrapper div（現在は `writing-mode: horizontal-tb`）
- 将来の縦書き対応時に `writing-mode: vertical-rl` へ切替可能

## 本プロジェクトでの適用箇所

| セレクタ | 適用内容 |
|----------|----------|
| `:root` | line-break, hanging-punctuation, text-autospace |
| `body` | word-break: break-word, overflow-wrap |
| `.article-body` | justify + inter-character + 明朝体 + 17px/1.75 |
| `.nihongo` | halt + word-spacing（約物ラップ用） |
| `.article-body h1-h6` | palt + keep-all + start |

## 注意事項

- `text-justify: inter-character` は Firefox で未対応（2026年時点）。Firefox では `inter-word` にフォールバック
- `hanging-punctuation: allow-end` は Chromium 系のみ対応。Safari/Firefox では無視される
- `text-autospace: normal` は Chromium 131+ で対応
- 非対応ブラウザでも `text-align: justify` + `line-break: strict` により基本の両端揃えは機能する
