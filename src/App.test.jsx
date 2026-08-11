import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { reportFailure, resetFailures } from './lib/saveStatus';

describe('App', () => {
  it('renders the header and all four tabs', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Slackers Brewing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Order Calculator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('defaults to the Inventory tab showing ingredient categories', () => {
    render(<App />);
    expect(screen.getByText('🌾 Malts')).toBeInTheDocument();
    expect(screen.getByText('🌿 Hops')).toBeInTheDocument();
  });

  it('switches to the Order Calculator tab and prompts for a selection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Order Calculator' }));
    expect(screen.getByText(/Select Recipes to Brew/i)).toBeInTheDocument();
    expect(screen.getByText(/Select one or more recipes above/i)).toBeInTheDocument();
  });

  it('shows an order summary once a recipe is selected', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Order Calculator' }));
    const [firstRecipe] = screen.getAllByRole('checkbox');
    await user.click(firstRecipe);
    expect(screen.getByText(/Order Summary/i)).toBeInTheDocument();
  });

  it('updates the header when the brewery name is changed in Settings', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const nameInput = screen.getByLabelText(/Brewery name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Hop Haus');
    expect(screen.getByRole('heading', { name: /Hop Haus/i })).toBeInTheDocument();
  });

  it('changes the header icon when a different emoji is picked', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Header shows the default beer emoji.
    expect(screen.getByRole('heading')).toHaveTextContent('🍺');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: '🏭' }));
    expect(screen.getByRole('heading')).toHaveTextContent('🏭');
  });

  it('shows the data backup controls in Settings', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('💾 Data Backup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export backup/i })).toBeInTheDocument();
  });
});

// SaveErrorBanner is mounted by the shell, so testing the component alone
// would still pass if App never rendered it.
describe('App save-failure surface', () => {
  beforeEach(() => act(() => resetFailures()));

  it('shows no banner while saves are healthy', () => {
    render(<App />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces a failed save without disturbing the tabs', async () => {
    render(<App />);
    act(() => reportFailure('recipes', new Error('duplicate key'), vi.fn()));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/Recipes didn’t save/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inventory' })).toBeInTheDocument();
  });
});
