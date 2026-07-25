import { ExternalLink } from 'lucide-react';

const NOTION_PAGE_ID = /([0-9a-f]{32})(?:[?/#]|$)/i;

function RichText({ parts = [], onOpenNotionPage }) {
  return parts.map((part, index) => {
    const classNames = [
      part.annotations?.bold && 'is-bold',
      part.annotations?.italic && 'is-italic',
      part.annotations?.underline && 'is-underline',
      part.annotations?.strikethrough && 'is-strikethrough',
      part.annotations?.code && 'is-code',
      part.annotations?.color && part.annotations.color !== 'default' && `notion-color-${part.annotations.color}`,
    ].filter(Boolean).join(' ');
    let content = part.text;
    if (part.annotations?.code) content = <code>{content}</code>;
    if (!part.href) return <span className={classNames} key={index}>{content}</span>;
    const notionPageId = part.href.match(NOTION_PAGE_ID)?.[1];
    if (notionPageId && onOpenNotionPage) {
      return (
        <button
          type="button"
          className={`notion-inline-link ${classNames}`}
          onClick={() => onOpenNotionPage(notionPageId)}
          key={index}
        >
          {content}
        </button>
      );
    }
    return <a className={classNames} href={part.href} target="_blank" rel="noreferrer" key={index}>{content}</a>;
  });
}

function Caption({ parts, onOpenNotionPage }) {
  return parts?.length
    ? <figcaption><RichText parts={parts} onOpenNotionPage={onOpenNotionPage} /></figcaption>
    : null;
}

function NotionTable({ block, onOpenNotionPage }) {
  const rows = block.children || [];
  return (
    <div className="notion-table-scroll">
      <table className="notion-block-table">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id}>
              {(row.cells || []).map((cell, cellIndex) => {
                const Cell = block.hasColumnHeader && rowIndex === 0 ? 'th' : 'td';
                return (
                  <Cell scope={Cell === 'th' ? 'col' : undefined} key={`${row.id}-${cellIndex}`}>
                    <RichText parts={cell} onOpenNotionPage={onOpenNotionPage} />
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotionBlock({ block, onOpenNotionPage }) {
  const richText = <RichText parts={block.richText} onOpenNotionPage={onOpenNotionPage} />;
  const children = block.type === 'table'
    ? null
    : <NotionBlocks blocks={block.children} onOpenNotionPage={onOpenNotionPage} nested />;
  switch (block.type) {
    case 'paragraph': return <div className="notion-paragraph">{richText}{children}</div>;
    case 'heading_1': return <h1 id={`notion-${block.id}`}>{richText}</h1>;
    case 'heading_2': return <h2 id={`notion-${block.id}`}>{richText}</h2>;
    case 'heading_3': return <h3 id={`notion-${block.id}`}>{richText}</h3>;
    case 'bulleted_list_item': return <li>{richText}{children}</li>;
    case 'numbered_list_item': return <li>{richText}{children}</li>;
    case 'to_do':
      return <label className="notion-todo"><input type="checkbox" checked={block.checked} readOnly /><span>{richText}</span></label>;
    case 'toggle': return <details className="notion-toggle"><summary>{richText}</summary>{children}</details>;
    case 'quote': return <blockquote>{richText}{children}</blockquote>;
    case 'callout': return <aside className={`notion-callout notion-${block.color || 'default'}`}><span>{block.icon || '💡'}</span><div>{richText}{children}</div></aside>;
    case 'divider': return <hr />;
    case 'code':
      return <figure className="notion-code"><div>{block.language}</div><pre><code>{(block.richText || []).map((part) => part.text).join('')}</code></pre><Caption parts={block.caption} onOpenNotionPage={onOpenNotionPage} /></figure>;
    case 'equation': return <div className="notion-equation" aria-label="Equation">{block.expression}</div>;
    case 'image':
      return block.url ? <figure className="notion-image"><img src={block.url} alt={(block.caption || []).map((part) => part.text).join('') || 'Notion note'} loading="lazy" /><Caption parts={block.caption} onOpenNotionPage={onOpenNotionPage} /></figure> : null;
    case 'bookmark':
    case 'embed':
    case 'video':
    case 'file':
    case 'pdf':
    case 'audio':
      return block.url ? <a className="notion-asset-link" href={block.url} target="_blank" rel="noreferrer"><ExternalLink size={15} />{(block.caption || []).map((part) => part.text).join('') || block.type}</a> : null;
    case 'table': return <NotionTable block={block} onOpenNotionPage={onOpenNotionPage} />;
    case 'child_page':
    case 'child_database': return <div className="notion-child-page">📄 {block.title}</div>;
    case 'unsupported': return <div className="notion-unsupported">此 Notion 區塊暫不支援顯示。</div>;
    default: return (block.richText?.length || block.children?.length) ? <div className="notion-paragraph">{richText}{children}</div> : null;
  }
}

export function NotionBlocks({ blocks = [], onOpenNotionPage, nested = false }) {
  const output = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
      const type = block.type;
      const items = [];
      while (index < blocks.length && blocks[index].type === type) {
        items.push(<NotionBlock block={blocks[index]} onOpenNotionPage={onOpenNotionPage} key={blocks[index].id} />);
        index += 1;
      }
      const ListTag = type === 'bulleted_list_item' ? 'ul' : 'ol';
      output.push(<ListTag className="notion-list" key={`${type}-${block.id}`}>{items}</ListTag>);
      continue;
    }
    output.push(<NotionBlock block={block} onOpenNotionPage={onOpenNotionPage} key={block.id || index} />);
    index += 1;
  }
  return <div className={nested ? 'notion-block-children' : 'notion-blocks'}>{output}</div>;
}
