# 読書用ダーシ

`noto-serif-jp-dashes.woff2` はNoto Serif JPのU+2014 / U+2015サブセットの原本。
`ari-novel-dashes.woff2` はその派生版で、両コードポイントを全角幅の字形に割り当て、言語固有のOpenType置換順序に依存せずChromium / WebKitで同じ幅にする。表示するUnicode文字とコピーされる原文は変更しない。

再生成にはPythonと `fonttools` / `brotli` が必要。通常のnpmビルドでは生成済みファイルを使う。

```bash
python -m pip install fonttools brotli
python scripts/build-dash-font.py
```

両ファイルはSIL OFL 1.1で配布する。著作権表示とライセンス全文は `public/licenses/OFL-Noto-Serif-JP.txt` を参照。
