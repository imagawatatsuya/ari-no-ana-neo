import React, { useMemo, Fragment } from 'react'; // 【修正】Fragment を追加

type FootnoteRendererProps = {
  content: string;
};

// テキスト内のhttpsリンクを検出して<a>タグに変換する関数
const renderTextWithLinks = (text: string) => {
  // https:// から始まる文字列（空白が来るまで）で分割
  const parts = text.split(/(https:\/\/[^\s]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('https://')) {
          let url = part;
          let suffix = '';
          
          // 末尾の除外対象記号（句読点や括弧、タグの閉じ括弧など）を判定
          // 【修正】ここに '<' と '>' を追加し、HTMLタグの誤判定を防いでいます
          const invalidSuffixRegex = /[。、.,)\]\}!?:;"'）］｝><]$/;
          
          // "https://" (8文字) より長く、かつ末尾が除外対象ならループで削る
          while (url.length > 8 && invalidSuffixRegex.test(url)) {
            suffix = url.slice(-1) + suffix;
            url = url.slice(0, -1);
          }

          return (
            // 【修正】React.Fragment ではなく Fragment を使用
            <Fragment key={index}>
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all" // 青文字＋ホバー下線
              >
                {url}
              </a>
              {suffix}
            </Fragment>
          );
        }
        // 通常テキスト
        // 【修正】React.Fragment ではなく Fragment を使用
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
      /^\s*\[\^(.+?)\]:\s*(.*(?:\n(?!\s*\[\^.+?\]:).*)*)/gm,
      (_, id, text) => {
        footnotesMap.set(id.trim(), text.trim());
        return '';
      }
    ).trim();

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

  const renderContent = () => {
    const parts = mainContent.split(/(\[\^.+?\])/g);
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

  return (
    <div className="footnote-container">
      <div className="leading-relaxed">
        {renderContent()}
      </div>
      
      {footnotes.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-400">
          <p className="font-bold text-sm mb-2 text-[#800000]">脚注</p>
          <ol className="list-decimal pl-5 text-sm text-gray-700">
            {footnotes.map(note => (
              <li key={note.index} id={`footnote-${note.index}`} className="mb-1 pl-1">
                {renderTextWithLinks(note.text)}{' '}
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