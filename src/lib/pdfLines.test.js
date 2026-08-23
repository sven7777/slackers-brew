import { describe, it, expect } from 'vitest';
import { groupIntoLines } from './pdfLines';

// pdf.js hands back positioned fragments; y increases UP the page, so a row with
// a higher y comes first.
const item = (str, x, y, width = str.length * 5) => ({ str, x, y, width });

describe('groupIntoLines', () => {
  it('groups items on the same baseline into one line, left to right', () => {
    const lines = groupIntoLines([item('World', 38, 700), item('Hello', 10, 700, 25)]);
    expect(lines).toEqual(['Hello World']);
  });

  it('orders lines down the page', () => {
    expect(groupIntoLines([item('second', 10, 680), item('first', 10, 700)]))
      .toEqual(['first', 'second']);
  });

  it('tolerates a baseline that wobbles within a row', () => {
    expect(groupIntoLines([item('a', 10, 700, 5), item('b', 17, 701.5)])).toEqual(['a b']);
  });

  it('splits rows further apart than the tolerance', () => {
    expect(groupIntoLines([item('a', 10, 700, 5), item('b', 10, 690)])).toEqual(['a', 'b']);
  });

  it('re-emits a column break as a double space, so the parser can split on it', () => {
    // "2-Row" ends at x=35; the unit label starts far to the right.
    const lines = groupIntoLines([item('2-Row', 10, 700, 25), item('price / lb', 200, 700)]);
    expect(lines).toEqual(['2-Row  price / lb']);
  });

  it('joins fragments that abut without inventing a space', () => {
    // pdf.js splits words mid-run; "Cara" + "munich" must not become "Cara munich".
    const lines = groupIntoLines([item('Cara', 10, 700, 20), item('munich', 30, 700, 30)]);
    expect(lines).toEqual(['Caramunich']);
  });

  it('drops empty fragments and handles no input', () => {
    expect(groupIntoLines([item('  ', 10, 700), item('x', 20, 700)])).toEqual(['x']);
    expect(groupIntoLines([])).toEqual([]);
    expect(groupIntoLines(undefined)).toEqual([]);
  });
});
