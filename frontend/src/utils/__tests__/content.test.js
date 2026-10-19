import { describe, expect, it } from 'vitest';
import { cleanExcerpt, extractStoryText } from '../content';

describe('content story text extraction', () => {
  it('extracts story from serialized JSON and cleans its HTML', () => {
    const value = JSON.stringify({ version: 1, story: '<p>  A   balanced <strong>story</strong>. </p>' });

    expect(cleanExcerpt(value)).toBe('A balanced story.');
    expect(cleanExcerpt(value, 10)).toBe('A balanced');
  });

  it('preserves plain text while normalizing whitespace', () => {
    expect(cleanExcerpt('  A simple\n\nstory.  ')).toBe('A simple story.');
    expect(extractStoryText('A simple story.')).toBe('A simple story.');
  });

  it('does not throw for malformed JSON and returns readable text', () => {
    expect(cleanExcerpt('{"version":1,"story":"unfinished"')).toBe('');
  });
});
