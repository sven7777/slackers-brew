import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import PriceInput from './PriceInput';

// Stand-in for the real write path: App's setInvCost rounds to the cent and
// stores, and the stored value comes back down as `value`.
function Harness({ start = null }) {
  const [cpu, setCpu] = useState(start);
  return (
    <PriceInput
      value={cpu}
      aria-label="price"
      onCommit={(v) => setCpu(v === '' ? null : Math.round(parseFloat(v) * 100) / 100)}
    />
  );
}

describe('PriceInput', () => {
  it('shows a stored price at two decimals', () => {
    render(<PriceInput value={0.7} onCommit={vi.fn()} aria-label="price" />);
    expect(screen.getByLabelText('price')).toHaveValue(0.7);
    expect(screen.getByLabelText('price').value).toBe('0.70');
  });

  it('is blank, not zero, when there is no price', () => {
    render(<PriceInput value={null} onCommit={vi.fn()} aria-label="price" />);
    expect(screen.getByLabelText('price').value).toBe('');
  });

  // The bug this component exists for: a plain controlled field reformats to
  // "1.00" after the first keystroke, so the rest of "1.09" appended to it and
  // the row stored $1.01.
  it('keeps the digits typed instead of reformatting mid-entry', () => {
    render(<Harness />);
    const field = screen.getByLabelText('price');
    for (const v of ['1', '1.', '1.0', '1.09']) fireEvent.change(field, { target: { value: v } });
    expect(field.value).toBe('1.09');
    fireEvent.blur(field);
    expect(field.value).toBe('1.09');
  });

  it('normalizes to two decimals once focus leaves', () => {
    render(<Harness />);
    const field = screen.getByLabelText('price');
    fireEvent.change(field, { target: { value: '1.5' } });
    fireEvent.blur(field);
    expect(field.value).toBe('1.50');
  });

  it('clears back to blank when the field is emptied', () => {
    render(<Harness start={0.72} />);
    const field = screen.getByLabelText('price');
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);
    expect(field.value).toBe('');
  });
});
