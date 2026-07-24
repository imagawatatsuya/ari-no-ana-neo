import React, { useMemo, Fragment } from 'react';

type FootnoteRendererProps = {
  content: string;
};

// =====================================================================
// 【設定】リンク化を禁止するURLパターン（正規表現リスト）
// 以下の正規表現のいずれかにマッチするURLは、リンクにならず黒文字のまま表示されます。
// =====================================================================
const BLOCKED_PATTERNS: RegExp[] = [
  // 1. "example" ドメインを含むものを全ブロック (.com, .net, .org など全て)
  // 例: https://example.com, https://example.net/page, https://www.example.org
  /^https:\/\/(www\.)?example\.[a-z]+(\/|$)/,

  // 2. 具体的な危険ドメインの部分一致（サブドメインも含む）
  // 例: https://bad-site.com, https://phishing.bad-site.com
  /bad-site\.com/,

  // 3. ローカルホストやプライベートIP（誤ってリンク化させないため）
  /^https:\/\/localhost/,
  /^https:\/\/192\.168\./,
  /^https:\/\/10\./,
];

// テキスト内のhttpsリンクを検出して<a>タグに変換する関数
const renderTextWithLinks = (text: string) => {
  // 空白・"・<・> を区切り文字として認識
  const parts = text.split(/(https:\/\/[^\s"<>]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('https://')) {
          let url = part;
          let suffix = '';
          
          // 末尾の除外対象記号（句読点など）を判定
          const invalidSuffixRegex = /[。、.,)\]\}!?:;"'）］｝><]$/;
          
          while (url.length > 8 && invalidSuffixRegex.test(url)) {
            suffix = url.slice(-1) + suffix;
            url = url.slice(0, -1);
          }

          // 【修正】ブロックリスト（正規表現）によるチェック
          // 登録されたパターンのいずれかにマッチした場合、リンク化を中止します
          const isBlocked = BLOCKED_PATTERNS.some(pattern => pattern.test(url));

          if (isBlocked) {
            return (
              <Fragment key={index}>
                {url}{suffix}
              </Fragment>
            );
          }

          return (
            <Fragment key={index}>
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="body-link"
              >
                {url}
              </a>
              {suffix}
            </Fragment>
          );
        }
        // 通常テキスト
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
};

export const FootnoteRenderer: React.FC<FootnoteRendererProps> = ({ content }) => {
  const { mainContent, footnotes } = useMemo(() => {
    if (!content) return { mainContent: '', footnotes: [] };

    let normalizedContent = content
      .replace(/［/g, '[')
      .replace(/］/g, ']')
      .replace(/＾/g, '^')
      .replace(/：/g, ':');

    const footnotesMap = new Map<string, string>();
    const footnoteOrder: string[] = [];

    const cleanedContent = normalizedContent.replace(
      /^\[\^(.+?)\]:\s*(.*(?:\n(?!\[\^.+?\]:).*)*)/gm,
       (_, id, text) => {
        footnotesMap.set(id.trim(), text);
        return '';
       }
    );

    cleanedContent.replace(/\[\^(.+?)\]/g, (_, id) => {
      const trimmedId = id.trim();
      if (footnotesMap.has(trimmedId) && !footnoteOrder.includes(trimmedId)) {
        footnoteOrder.push(trimmedId);
      }
      return '';
    });

    const notes = footnoteOrder.map((id, index) => ({
      id,
      index: index + 1,
      text: footnotesMap.get(id) || '',
    }));

    return { mainContent: cleanedContent, footnotes: notes };
  }, [content]);

  // 段落内のインラインコンテンツ（脚注参照 + リンク + <br>改行）を描画
  const renderInline = (text: string) => {
    const parts = text.split(/(\[\^.+?\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[\^(.+?)\]/);
      if (match) {
        const id = match[1].trim();
        const footnote = footnotes.find(f => f.id === id);
        if (footnote) {
          return (
            <sup key={index} id={`footnote-ref-${footnote.index}`}>
              <a 
                href={`#footnote-${footnote.index}`}
                className="footnote-ref-link"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`footnote-${footnote.index}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                [{footnote.index}]
              </a>
            </sup>
          );
        }
      }
      // 通常テキスト: 単一\nは<br>で改行
      return (
        <Fragment key={index}>
          {part.split('\n').map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {renderTextWithLinks(line)}
            </Fragment>
          ))}
        </Fragment>
      );
    });
  };

  // 本文を段落（空行区切り）に分割し、<p>要素として描画
  const renderContent = () => {
    const paragraphs = mainContent.split(/\n\n+/).filter(p => p.trim() !== '');
    return paragraphs.map((para, idx) => (
      <p key={idx} className={idx > 0 ? 'gyoukan' : undefined}>
        {renderInline(para)}
      </p>
    ));
  };

  return (
    <div className="footnote-container">
      <div className="article-paragraphs">
        {renderContent()}
      </div>
      
      {footnotes.length > 0 && (
        <div className="footnote-section">
          <p className="footnote-heading">脚注</p>
          <ol className="footnote-list">
            {footnotes.map(note => (
              <li key={note.index} id={`footnote-${note.index}`}>
                {renderTextWithLinks(note.text)}{' '}
                <a 
                  href={`#footnote-ref-${note.index}`} 
                  className="footnote-back-link"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`footnote-ref-${note.index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  ↩
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};