import React, { useMemo } from 'react';

type FootnoteRendererProps = {
  content: string;
};

export const FootnoteRenderer: React.FC<FootnoteRendererProps> = ({ content }) => {
  // 本文と注釈を解析・分離するロジック
  const { mainContent, footnotes } = useMemo(() => {
    if (!content) return { mainContent: '', footnotes: [] };

    const footnotesMap = new Map<string, string>();
    const footnoteOrder: string[] = [];
    
    // 1. 注釈定義 [^1]: ... を抽出して削除
    const cleanedContent = content.replace(
      /^\[\^(.+?)\]:\s*(.*(?:\n(?!\[\^.+?\]:).*)*)/gm,
      (match, id, text) => {
        footnotesMap.set(id.trim(), text.trim());
        return '';
      }
    ).trim();

    // 2. 本文中の参照 [^1] を探して順序を記録
    cleanedContent.replace(/\[\^(.+?)\]/g, (match, id) => {
      const trimmedId = id.trim();
      if (footnotesMap.has(trimmedId) && !footnoteOrder.includes(trimmedId)) {
        footnoteOrder.push(trimmedId);
      }
      return '';
    });

    // 3. 配列に整形
    const notes = footnoteOrder.map((id, index) => ({
      id,
      index: index + 1,
      text: footnotesMap.get(id) || '',
    }));

    return { mainContent: cleanedContent, footnotes: notes };
  }, [content]);

  // 本文を描画する関数
  const renderContent = () => {
    const parts = mainContent.split(/(\[\^.+?\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[\^(.+?)\]/);
      if (match) {
        const id = match[1].trim();
        const footnote = footnotes.find(f => f.id === id);
        if (footnote) {
          // 注釈へのリンク
          return (
            <sup key={index} id={`footnote-ref-${footnote.index}`}>
              <a 
                href={`#footnote-${footnote.index}`}
                style={{ textDecoration: 'none', color: '#dc2626', fontWeight: 'bold', marginLeft: '2px' }}
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
      // 通常テキスト（改行対応）
      return (
        <React.Fragment key={index}>
          {part.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="footnote-container">
      {/* 本文エリア */}
      <div className="text-base leading-relaxed whitespace-pre-wrap">
        {renderContent()}
      </div>
      
      {/* 注釈リストエリア */}
      {footnotes.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-400">
          <p className="font-bold text-sm mb-2 text-[#800000]">注釈</p>
          <ol className="list-decimal pl-5 text-sm text-gray-700">
            {footnotes.map(note => (
              <li key={note.index} id={`footnote-${note.index}`} className="mb-1 pl-1">
                {note.text}{' '}
                <a 
                  href={`#footnote-ref-${note.index}`} 
                  className="no-underline text-blue-600 hover:text-red-600 cursor-pointer select-none"
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