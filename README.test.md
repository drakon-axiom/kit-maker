# Automated Testing Guide

This project uses **Vitest** and **React Testing Library** for automated testing.

## Setup

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Structure

Tests are organized in `src/test/`:
- `auth.test.tsx` - Authentication flow tests
- `order-creation.test.tsx` - Order creation tests
- `payment.test.tsx` - Payment processing tests
- `setup.ts` - Test configuration and mocks

## Writing Tests

### Example Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Component Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    const user = userEvent.setup();
    render(<YourComponent />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/expected text/i)).toBeInTheDocument();
    });
  });
});
```

## Key Testing Concepts

1. **Mocking Supabase**: The Supabase client is automatically mocked in `setup.ts`
2. **User Interactions**: Use `@testing-library/user-event` for realistic interactions
3. **Async Operations**: Use `waitFor` for async state updates
4. **Queries**: Prefer `getByRole` and `getByLabelText` for accessibility

## Coverage Goals

Aim for:
- Authentication flows: 80%+
- Order creation: 75%+
- Payment processing: 75%+
- Critical business logic: 90%+

## Continuous Integration

Add to your CI pipeline:
```yaml
- name: Run tests
  run: npm run test:coverage
```

## Best Practices

1. Test user behavior, not implementation
2. Use descriptive test names
3. Keep tests isolated and independent
4. Mock external dependencies
5. Test error states and edge cases
6. Maintain test data fixtures
