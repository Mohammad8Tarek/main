import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '../../test-utils';
import StatCard from './StatCard';
import '@testing-library/jest-dom';

describe('StatCard', () => {
  it('renders the stat card with correct information', () => {
    render(
      <StatCard
        icon="fa-users"
        title="Total Users"
        value={120}
        gradient="bg-blue-500"
      />
    );

    // Check for title
    expect(screen.getByText('Total Users')).toBeInTheDocument();

    // Check for value
    expect(screen.getByText('120')).toBeInTheDocument();

    // Check for icon class
    const iconElement = screen.getByRole('presentation', { hidden: true });
    expect(iconElement).toHaveClass('fas fa-users');
  });
});
