import React, { useMemo } from 'react';

type FootnoteRendererProps = {
  content: string;
};

export const FootnoteRenderer: React.FC<FootnoteRendererProps> = ({ content }) => {
  const { mainContent, footnotes } = useMemo(() => {
    if (!content) return { mainContent: '', footnotes: [] };

    // 全角の「［＾１］」などを半角の「[^1]」に統一する前処理
    let normalizedContent = content
      .replace(/［/g, '[')
      .replace(/］/g, ']')
      .replace(/＾/g, '^')
      .replace(/：/g, ':');

    const footnotesMap = new Map<string, string>();
    const footnoteOrder: string[] = [];
    
    // 1. 注釈定義 [^1]: ... を抽出して削除
    // 【修正箇所】引数の match を _ に変更しました
    const cleanedContent = normalizedContent.replace(
      /^\s*\[\^(.+?)\]:\s*(.*(?:\n(?!\s*\[\^.+?\]:).*)*)/gm,
      (_, id, text) => {
        footnotesMap.set(id.trim(), text.trim());
        return '';
      }
    ).trim();

    // 2. 本文中の参照 [^1] を探して順序を記録
    // 【修正箇所】ここも引数の match を _ に変更しました
    cleanedContent.replace(/\[\^(.+?)\]/g, (_, id) => {
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

  const renderContent = () => {
    // 分割してレンダリング
    const parts = mainContent.split(/(\[\^.+?\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[\^(.+?)\]/);
      if (match) {
        const id = match[1].trim();
        const footnote = footnotes.find(f => f.id === id);
        if (footnote) {
          // 注釈リンク
          return (
            <sup key={index} id={`footnote-ref-${footnote.index}`}>
              <a 
                href={`#footnote-${footnote.index}`}
                className="text-red-600 font-bold ml-0.5 no-underline hover:underline"
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
      // 通常テキスト
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
      <div className="leading-relaxed">
        {renderContent()}
      </div>
      
      {footnotes.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-400">
          <p className="font-bold text-sm mb-2 text-[#800000]">注釈</p>
          <ol className="list-decimal pl-5 text-sm text-gray-700">
            {footnotes.map(note => (
              <li key={note.index} id={`footnote-${note.index}`} className="mb-1 pl-1">
                {note.text}{' '}
                <a 
                  href={`#footnote-ref-${note.index}`} 
                  className="no-underline text-blue-600 hover:text-red-600 cursor-pointer ml-1"
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