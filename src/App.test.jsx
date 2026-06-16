import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  it('renders the header and all three tabs', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Slackers Brewing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Order Calculator' })).toBeInTheDocument();
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
    // First checkbox selects the first recipe.
    const [firstRecipe] = screen.getAllByRole('checkbox');
    await user.click(firstRecipe);
    expect(screen.getByText(/Order Summary/i)).toBeInTheDocument();
  });
});
