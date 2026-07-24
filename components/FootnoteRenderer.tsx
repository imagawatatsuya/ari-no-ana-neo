import React, { useMemo, useState, useRef, useEffect, useCallback, Fragment } from 'react';

export type FootnoteMode = 'scroll' | 'tooltip';

type FootnoteRendererProps = {
  content: string;
  footnoteMode?: FootnoteMode;
};

// =====================================================================
// 【設定】リンク化を禁止するURLパターン（正規表現リスト）
// 以下の正規表現のいずれかにマッチするURLは、リンクにならず黒文字のまま表示されます。
// =====================================================================
const BLOCKED_PATTERNS: RegExp[] = [
  /^https:\/\/(www\.)?example\.[a-z]+(\/|$)/,
  /bad-site\.com/,
  /^https:\/\/localhost/,
  /^https:\/\/192\.168\./,
  /^https:\/\/10\./,
];

// テキスト内のhttpsリンクを検出して<a>タグに変換する関数
const renderTextWithLinks = (text: string) => {
  const parts = text.split(/(https:\/\/[^\s"<>]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('https://')) {
          let url = part;
          let suffix = '';
          
          const invalidSuffixRegex = /[。、.,)\]\}!?:;"'）］｝><]$/;
          
          while (url.length > 8 && invalidSuffixRegex.test(url)) {
            suffix = url.slice(-1) + suffix;
            url = url.slice(0, -1);
          }

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
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
};

export const FootnoteRenderer: React.FC<FootnoteRendererProps> = ({ content, footnoteMode = 'scroll' }) => {
  const [activeTooltip, setActiveTooltip] = useState<{ index: number; text: string; x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeTooltip]);

  const handleFootnoteClick = useCallback((e: React.MouseEvent, footnoteIndex: number, footnoteText: string) => {
    e.preventDefault();
    if (footnoteMode === 'tooltip') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setActiveTooltip({
        index: footnoteIndex,
        text: footnoteText,
        x: rect.left,
        y: rect.bottom + 6,
      });
    } else {
      document.getElementById(`footnote-${footnoteIndex}`)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [footnoteMode]);

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
                onClick={(e) => handleFootnoteClick(e, footnote.index, footnote.text)}
              >
                [{footnote.index}]
              </a>
            </sup>
          );
        }
      }
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

      {/* ツールチップ表示 */}
      {activeTooltip && footnoteMode === 'tooltip' && (
        <div
          ref={tooltipRef}
          className="footnote-tooltip"
          style={{ left: activeTooltip.x, top: activeTooltip.y }}
        >
          <div className="footnote-tooltip-header">
            <span>脚注 {activeTooltip.index}</span>
            <button onClick={() => setActiveTooltip(null)} aria-label="閉じる">×</button>
          </div>
          <div className="footnote-tooltip-body">
            {renderTextWithLinks(activeTooltip.text)}
          </div>
        </div>
      )}
      
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
