import { describe, expect, it } from 'vitest';
import { extractStoryText, htmlToPlainText } from '../content';

describe('content plain-text normalization', () => {
  it('preserves paragraph and line breaks while decoding entities', () => {
    expect(htmlToPlainText('<p>Fresh &amp; leafy greens</p><p>Second<br>line&nbsp;here</p>'))
      .toBe('Fresh & leafy greens\nSecond\nline here');
  });

  it('keeps existing plain text unchanged', () => {
    expect(htmlToPlainText('Already plain\nwith spacing')).toBe('Already plain\nwith spacing');
    expect(extractStoryText('Already plain\nwith spacing')).toBe('Already plain\nwith spacing');
  });
});
