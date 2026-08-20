/**
 * 脚注・本文レンダラー（正: ari-no-ana-neo）
 * ari-preview-editor へは GitHub Actions で自動同期
 */
import React, { useMemo, useState, useRef, useEffect, useCallback, Fragment } from 'react';

export type FootnoteMode = 'scroll' | 'tooltip';
type AuthorIndentMode = 'none' | 'jisage' | 'raw';
type ReaderIndentMode = 'none' | 'jisage' | 'author';
export type BodyFormatter = (
  body: string,
  mode: ReaderIndentMode,
  authorIndentMode?: AuthorIndentMode,
) => string;
export type BodySegment =
  | { type: 'fragment'; text: string; charCount?: number }
  | { type: 'break'; breakCount?: number };
export type BodySegmenter = (body: string) => BodySegment[];

const passThroughBody = (body: string): string => body;

// A fragment boundary already supplies visual separation. Keep intentional
// full-width indentation intact while suppressing only boundary line feeds.
const stripFragmentBoundaryLineFeeds = (text: string): string =>
  text.replace(/^\n|\n$/gu, '');

type FootnoteRendererProps = {
  content: string;
  indentMode?: ReaderIndentMode;
  authorIndentMode?: AuthorIndentMode;
  footnoteMode?: FootnoteMode;
  /**
   * Injected by the main app so this file remains portable for the
   * ari-preview-editor sync target.
   */
  formatBody?: BodyFormatter;
  /** Optional presentation adapter. Omit it to preserve continuous reading. */
  segmentBody?: BodySegmenter;
  /** Optional reader bookmark control for fragmented reading. */
  bookmarkedFragmentIndex?: number | null;
  onBookmarkToggle?: (fragmentIndex: number) => void;
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

// Keep consecutive U+2014/U+2015 novel-dash runs together in the rendered
// text without changing the underlying text used for copy, search, or screen readers.
const NOVEL_DASH_RUN_PATTERN = /(—{2,}|―{2,})/g;
const NOVEL_DASH_RUN_EXACT_PATTERN = /^(?:—{2,}|―{2,})$/;
const HAS_DASH_RUN = /—{2,}|―{2,}/;

const renderTextWithNovelDashes = (text: string, keyPrefix: string): React.ReactNode => {
  if (!HAS_DASH_RUN.test(text)) return text;

  return text.split(NOVEL_DASH_RUN_PATTERN).map((part, index) => {
    if (NOVEL_DASH_RUN_EXACT_PATTERN.test(part)) {
      return (
        <span key={`${keyPrefix}-dash-${index}`} className="novel-dash-run">
          {part}
        </span>
      );
    }

    return <Fragment key={`${keyPrefix}-text-${index}`}>{part}</Fragment>;
  });
};

const renderTextWithLinks = (text: string): React.ReactNode => {
  if (!text.includes('https://')) {
    return renderTextWithNovelDashes(text, 'plain');
  }

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
        return (
          <Fragment key={index}>
            {renderTextWithNovelDashes(part, `plain-${index}`)}
          </Fragment>
        );
      })}
    </>
  );
};

export const FootnoteRenderer: React.FC<FootnoteRendererProps> = React.memo(({
  content,
  indentMode = 'none',
  authorIndentMode = 'raw',
  footnoteMode = 'scroll',
  formatBody = passThroughBody,
  segmentBody,
  bookmarkedFragmentIndex = null,
  onBookmarkToggle,
}) => {
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

    // Footnote definitions are removed before applying jisage. This keeps the
    // footnote parser stable and ensures footnote text is never indented.
    return {
      mainContent: formatBody(cleanedContent, indentMode, authorIndentMode),
      footnotes: notes,
    };
  }, [content, indentMode, authorIndentMode, formatBody]);

  const bodyNodes = useMemo(() => {
    const footnoteById = new Map(footnotes.map((note) => [note.id, note]));

    const renderInline = (text: string) => {
      if (!text.includes('[^')) {
        if (!text.includes('\n')) return renderTextWithLinks(text);
        return text.split('\n').map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {renderTextWithLinks(line)}
          </Fragment>
        ));
      }

      const parts = text.split(/(\[\^.+?\])/g);
      return parts.map((part, index) => {
        const match = part.match(/\[\^(.+?)\]/);
        if (match) {
          const footnote = footnoteById.get(match[1].trim());
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
        if (!part.includes('\n')) {
          return <Fragment key={index}>{renderTextWithLinks(part)}</Fragment>;
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

    if (!segmentBody) {
      const paragraphs = mainContent.split(/\n\n+/).filter((p) => p.trim() !== '');
      return paragraphs.map((para, idx) => (
        <p key={idx} className={idx > 0 ? 'gyoukan' : undefined}>
          {renderInline(para)}
        </p>
      ));
    }

    let fragmentIndex = 0;
    return segmentBody(mainContent).map((segment, index) => {
      if (segment.type === 'break') {
        return <div key={`break-${index}`} className="reader-fragment-break" aria-hidden="true" />;
      }

      fragmentIndex += 1;
      const currentFragmentIndex = fragmentIndex;
      const isBookmarked = bookmarkedFragmentIndex === currentFragmentIndex;
      return (
        <section
          key={`fragment-${index}`}
          className="reader-fragment"
          aria-label={`本文断片 ${currentFragmentIndex}`}
        >
          <p>{renderInline(stripFragmentBoundaryLineFeeds(segment.text))}</p>
          {onBookmarkToggle ? (
            <button
              type="button"
              className={`reader-fragment-index reader-fragment-bookmark${isBookmarked ? ' is-bookmarked' : ''}`}
              data-fragment-index={currentFragmentIndex}
              aria-label={isBookmarked ? `断片 ${currentFragmentIndex} のしおりを外す` : `断片 ${currentFragmentIndex} をしおりにする`}
              aria-pressed={isBookmarked}
              onClick={() => onBookmarkToggle(currentFragmentIndex)}
            >
              {currentFragmentIndex}
            </button>
          ) : (
            <span className="reader-fragment-index" aria-hidden="true">{currentFragmentIndex}</span>
          )}
        </section>
      );
    });
  }, [
    mainContent,
    footnotes,
    handleFootnoteClick,
    segmentBody,
    bookmarkedFragmentIndex,
    onBookmarkToggle,
  ]);

  return (
    <div className="footnote-container">
      <div className="article-paragraphs">
        {bodyNodes}
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
});
