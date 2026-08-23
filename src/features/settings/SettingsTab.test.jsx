import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsTab from './SettingsTab';
import { defSettings } from '../../lib/defaults';

// Batch Volume asks for average kegs — the number counted on the floor — and
// derives the brewhouse loss %, the same way a recipe's Cost view does. There
// is no loss % input any more, so the derived figure is the only place that
// number appears and it has to be right.
describe('SettingsTab batch volume', () => {
  const inv = {
    malts: [], setMalts: vi.fn(), hops: [], setHops: vi.fn(),
    yeast: [], setYeast: vi.fn(), adj: [], setAdj: vi.fn(),
  };
  const renderTab = (settings, setSettings = vi.fn()) =>
    render(<SettingsTab settings={{ ...defSettings, ...settings }} setSettings={setSettings} {...inv} />);

  const kegsField = () => screen.getByLabelText('Average yield (kegs per batch)');

  it('asks for kegs, not a loss percentage', () => {
    renderTab({});
    expect(kegsField()).toBeInTheDocument();
    expect(screen.queryByLabelText(/Brewhouse loss/)).not.toBeInTheDocument();
  });

  it('shows the brewery default as the keg placeholder', () => {
    renderTab({});
    // 150 gal less the 33% default = 6.5 kegs.
    expect(kegsField()).toHaveAttribute('placeholder', '6.5');
  });

  it('back-solves and displays the loss % from the kegs entered', () => {
    renderTab({ avgKegs: '7' });
    // 7 kegs = 108.5 gal off 150 gal = 27.7% loss.
    expect(screen.getByText(/150 gal less 27\.7% loss ≈ 7\.0 kegs per batch\./)).toBeInTheDocument();
  });

  it('writes the entered kegs to settings', () => {
    const setSettings = vi.fn((fn) => fn(defSettings));
    renderTab({}, setSettings);
    fireEvent.change(kegsField(), { target: { value: '6' } });
    expect(setSettings).toHaveBeenCalled();
    expect(setSettings.mock.results[0].value).toMatchObject({ avgKegs: '6' });
  });

  it('clearing the field falls back to the brewery default, never to 0% loss', () => {
    renderTab({ avgKegs: '' });
    expect(screen.getByText(/150 gal less 33% loss/)).toBeInTheDocument();
  });

  it('rejects a yield larger than the boil and says why', () => {
    renderTab({ avgKegs: '12' });
    expect(screen.getByText(/more beer than the 150 gal boil produces/)).toBeInTheDocument();
    expect(screen.getByText(/150 gal less 33% loss/)).toBeInTheDocument();
  });

  it('honours a lossPct saved before the kegs field existed', () => {
    renderTab({ lossPct: 25, avgKegs: undefined });
    expect(screen.getByText(/150 gal less 25% loss/)).toBeInTheDocument();
  });
});
