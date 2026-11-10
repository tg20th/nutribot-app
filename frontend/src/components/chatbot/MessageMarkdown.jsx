import { useEffect, useMemo, useRef, useState } from 'react';

const INLINE_TOKEN = /(\*\*[^*]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|`[^`\n]+`|\[([^\]]+)\]\(([^\s)]+)\))/g;

function inlineMarkdown(value) {
  const parts = [];
  let last = 0;
  String(value).replace(INLINE_TOKEN, (match, _bold, linkText, linkUrl, offset) => {
    if (offset > last) parts.push({ type: 'text', value: value.slice(last, offset) });
    if (match.startsWith('**')) parts.push({ type: 'strong', value: match.slice(2, -2) });
    else if (match.startsWith('*')) parts.push({ type: 'em', value: match.slice(1, -1) });
    else if (match.startsWith('`')) parts.push({ type: 'code', value: match.slice(1, -1) });
    else if (linkText && linkUrl && /^(https?:\/\/|mailto:)/i.test(linkUrl)) parts.push({ type: 'link', value: linkText, href: linkUrl });
    else parts.push({ type: 'text', value: match });
    last = offset + match.length;
    return match;
  });
  if (last < String(value).length) parts.push({ type: 'text', value: String(value).slice(last) });
  if (parts.length === 1 && parts[0].type === 'text') return parts[0].value;
  return parts.map((part, index) => {
    if (part.type === 'strong') return <strong key={index}>{part.value}</strong>;
    if (part.type === 'em') return <em key={index}>{part.value}</em>;
    if (part.type === 'code') return <code key={index}>{part.value}</code>;
    if (part.type === 'link') return <a key={index} href={part.href} target="_blank" rel="noreferrer">{part.value}</a>;
    return <span key={index}>{part.value}</span>;
  });
}

function renderBlocks(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;
  let code = null;
  const flushParagraph = () => { if (paragraph.length) { blocks.push({ type: 'p', lines: paragraph }); paragraph = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (code) { blocks.push({ type: 'codeblock', value: code.lines.join('\n'), language: code.language }); code = null; }
      else { flushParagraph(); flushList(); code = { language: line.trim().slice(3).trim(), lines: [] }; }
      return;
    }
    if (code) { code.lines.push(line); return; }
    if (!line.trim()) { flushParagraph(); flushList(); return; }
    const heading = line.match(/^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: 'heading', level: heading[1].length, value: heading[2] }); return; }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ordered || unordered) {
      flushParagraph();
      const type = ordered ? 'ol' : 'ul';
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push(ordered?.[1] || unordered[1]);
      return;
    }
    if (line.match(/^\s*>\s?/)) { flushParagraph(); flushList(); blocks.push({ type: 'blockquote', value: line.replace(/^\s*>\s?/, '') }); return; }
    flushList(); paragraph.push(line);
  });
  if (code) blocks.push({ type: 'codeblock', value: code.lines.join('\n'), language: code.language });
  flushParagraph(); flushList();
  return blocks;
}

function inlineMarkdownText(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(`{1,3})(.*?)\1/g, '$2')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\\([\\`*_[\]{}()#+.!>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function markdownToPlainText(markdown) {
  return renderBlocks(markdown).map((block) => {
    if (block.type === 'codeblock') return inlineMarkdownText(block.value);
    if (block.type === 'ol' || block.type === 'ul') return block.items.map(inlineMarkdownText).join(' ');
    return inlineMarkdownText(block.value || block.lines?.join(' ') || '');
  }).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function MarkdownBlocks({ value }) {
  const blocks = useMemo(() => renderBlocks(value), [value]);
  return <div className="chatbot-markdown">{blocks.map((block, index) => {
    if (block.type === 'heading') { const Tag = `h${Math.min(block.level + 2, 6)}`; return <Tag key={index}>{inlineMarkdown(block.value)}</Tag>; }
    if (block.type === 'p') return <p key={index}>{block.lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{inlineMarkdown(line)}</span>)}</p>;
    if (block.type === 'blockquote') return <blockquote key={index}>{inlineMarkdown(block.value)}</blockquote>;
    if (block.type === 'codeblock') return <pre key={index}><code data-language={block.language || undefined}>{block.value}</code></pre>;
    const List = block.type === 'ol' ? 'ol' : 'ul';
    return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{block.type === 'ol' ? <span className="chatbot-markdown__list-number">{itemIndex + 1}. {inlineMarkdown(item)}</span> : inlineMarkdown(item)}</li>)}</List>;
  })}</div>;
}

export default function MessageMarkdown({ text, animate = false, onComplete }) {
  const source = String(text || '');
  const [visibleLength, setVisibleLength] = useState(animate ? 0 : source.length);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!animate) { setVisibleLength(source.length); onCompleteRef.current?.(); return undefined; }
    setVisibleLength(0);
    let cursor = 0;
    const interval = window.setInterval(() => {
      cursor = Math.min(source.length, cursor + (cursor < 140 ? 2 : 4));
      setVisibleLength(cursor);
      if (cursor >= source.length) { window.clearInterval(interval); onCompleteRef.current?.(); }
    }, 18);
    return () => window.clearInterval(interval);
  }, [animate, source]);
  return <MarkdownBlocks value={source.slice(0, visibleLength)} />;
}
