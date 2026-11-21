import React, { useMemo } from 'react';
import { Novel, ReaderIndentMode } from '../types';
import { formatDate, formatManuscriptPages } from '../utils';
import { FootnoteRenderer, FootnoteMode } from './FootnoteRenderer';
import { IndentModeControl } from './IndentModeControl';
import { formatReaderBody } from '../services/jisageAdapter';
import { BASE_PATH, navigate } from '../router';

interface RyuseigaiReaderProps {
  novel: Novel;
  footnoteMode?: FootnoteMode;
  indentMode: ReaderIndentMode;
  onIndentModeChange: (mode: ReaderIndentMode) => void;
  onOpenReaderSettings: () => void;
}

export const RyuseigaiReader: React.FC<RyuseigaiReaderProps> = React.memo(({
  novel,
  footnoteMode,
  indentMode,
  onIndentModeChange,
  onOpenReaderSettings,
}) => {
  const subtitle = novel.description?.trim() ?? '';
  const authorMessage = novel.authorMessage?.trim() ?? '';
  const pageCountLabel = useMemo(() => formatManuscriptPages(novel.body), [novel.body]);

  return (
    <div className="ryuseigai-shell ryuseigai-reader-shell">
      {/* 戻る */}
      <div className="ryuseigai-nav-top">
        <a href={BASE_PATH + '/ryuseigai'} onClick={(e) => { e.preventDefault(); navigate('/ryuseigai'); }} className="ryuseigai-back-link">← 流星垓へ戻る</a>
        <button
          type="button"
          className="reader-settings-link"
          onClick={onOpenReaderSettings}
          aria-haspopup="dialog"
        >
          &gt;&gt;字下げ設定
        </button>
      </div>

      <IndentModeControl
        mode={indentMode}
        onChange={onIndentModeChange}
        name="ryuseigai-reader-indent-mode"
        note="既定値は投稿者設定です。全角空白1字は整理し、二字以上の手動空白は保持します。脚注には適用しません。"
      />

      {/* 作品本文: 共通組版システム */}
      <table className="article-table">
        <tbody>
          <tr>
            <td className="article-title">{novel.title}</td>
          </tr>
          {pageCountLabel && (
            <tr>
              <td className="article-page-count">{pageCountLabel}</td>
            </tr>
          )}
          {subtitle && (
            <tr>
              <td className="ryuseigai-article-subtitle">{subtitle}</td>
            </tr>
          )}
          <tr>
            <td className="article-body">
              <FootnoteRenderer
                content={novel.body}
                indentMode={indentMode}
                authorIndentMode={novel.authorIndentMode}
                footnoteMode={footnoteMode}
                formatBody={formatReaderBody}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="article-date" style={{ textAlign: 'right' }}>{formatDate(novel.date)} に捨てられた</div>

      <div className="ryuseigai-author-block">
        <div className="ryuseigai-author-label"><b>■ 捨てた者</b></div>
        <div className="ryuseigai-author-name">{novel.author || '名無し'}</div>
        {authorMessage && (
          <div className="ryuseigai-author-message">
            <div className="ryuseigai-author-message-label">■メッセージ</div>
            <div className="ryuseigai-author-message-text">{authorMessage}</div>
          </div>
        )}
      </div>

      {/* 戻る */}
      <div className="ryuseigai-nav-bottom">
        <a href={BASE_PATH + '/ryuseigai'} onClick={(e) => { e.preventDefault(); navigate('/ryuseigai'); }} className="ryuseigai-back-link">← 流星垓へ戻る</a>
      </div>
    </div>
  );
});
