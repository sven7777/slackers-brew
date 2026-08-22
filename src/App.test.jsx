import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { reportFailure, resetFailures } from './lib/saveStatus';
import { defRecipes } from './lib/defaults';

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


// Regression for the Whirlfloc report (2026-08-21): seed_recipes.sql put
// ingredients into recipe_ingredients that no inventory row matched, so the
// Cost view showed them permanently "unpriced" AND the price field silently
// refused input — setInvCost mapped over the inventory list, matched nothing,
// and wrote nothing. Typing into a field and having nothing happen gives the
// brewer no way to tell a broken control from a value that didn't save.
//
// Driven through App rather than CostPanel because the bug lived in the wiring
// between them, which a panel test with a mocked setter cannot see.
describe('pricing an ingredient with no inventory row', () => {
  // One recipe holding nothing but a name the ingredient catalog has never
  // heard of — exactly the shape prod was in for Whirlfloc. Stripped to that
  // single ingredient so the assertions are about it and nothing else (a fresh
  // install has no prices at all, so every other line would read unpriced too).
  const seedPhantomRecipe = () => {
    const recs = [{
      ...structuredClone(defRecipes[0]),
      m: [], h: [], y: [], sa: [],
      a: [['Phantom Adjunct', 4, 'each', 'boil', 10]],
    }];
    localStorage.setItem('slackers_brew_recipes', JSON.stringify(recs));
  };

  const openCostView = () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Recipes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cost' }));
  };

  const field = () => screen.getByLabelText('Cost per each of Phantom Adjunct');

  it('accepts a price and folds it into the total', () => {
    seedPhantomRecipe();
    openCostView();

    expect(screen.getByText(/1 ingredient unpriced/)).toBeInTheDocument();
    expect(field()).toHaveValue(null);

    fireEvent.change(field(), { target: { value: '2.50' } });

    // The write landed: the field holds it, the line is costed 4 × $2.50, and
    // the unpriced warning is gone.
    expect(field()).toHaveValue(2.5);
    const row = screen.getByText('Phantom Adjunct').closest('tr');
    expect(within(row).getByText('$10.00')).toBeInTheDocument();
    expect(screen.queryByText(/ingredient unpriced/)).not.toBeInTheDocument();
  });

  it('stores the price to the cent', () => {
    seedPhantomRecipe();
    openCostView();
    fireEvent.change(field(), { target: { value: '2.567' } });
    expect(field()).toHaveValue(2.57);
  });
});
