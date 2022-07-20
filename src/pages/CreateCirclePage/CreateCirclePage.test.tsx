import React from 'react';

import { act, render, screen } from '@testing-library/react';

import { TestWrapper } from 'utils/testing';

import { SummonCirclePage } from './CreateCirclePage';

describe('create circle page component', () => {
  test('renders successfully', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <SummonCirclePage />
        </TestWrapper>
      );
    });

    await screen.debug();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });
});
