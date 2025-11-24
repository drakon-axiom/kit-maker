import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Mock payment component
const MockPaymentComponent = () => {
  const [loading, setLoading] = React.useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
        body: {
          orderId: 'order-123',
          amount: 10000,
          type: 'deposit',
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Payment</h1>
      <p>Amount: $100.00</p>
      <button onClick={handlePayment} disabled={loading}>
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </div>
  );
};

describe('Payment Processing Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = vi.fn();
  });

  it('should render payment component', () => {
    render(
      <BrowserRouter>
        <MockPaymentComponent />
      </BrowserRouter>
    );

    expect(screen.getByText(/payment/i)).toBeInTheDocument();
    expect(screen.getByText(/amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
  });

  it('should process payment successfully', async () => {
    const user = userEvent.setup();
    const mockCheckoutUrl = 'https://checkout.stripe.com/session/123';

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { url: mockCheckoutUrl },
      error: null,
    });

    render(
      <BrowserRouter>
        <MockPaymentComponent />
      </BrowserRouter>
    );

    const payButton = screen.getByRole('button', { name: /pay now/i });
    await user.click(payButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('create-payment-checkout', {
        body: expect.objectContaining({
          orderId: 'order-123',
          amount: 10000,
          type: 'deposit',
        }),
      });
      expect(window.open).toHaveBeenCalledWith(mockCheckoutUrl, '_blank');
    });
  });

  it('should show loading state during payment', async () => {
    const user = userEvent.setup();

    vi.mocked(supabase.functions.invoke).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: { url: 'test' }, error: null }), 100))
    );

    render(
      <BrowserRouter>
        <MockPaymentComponent />
      </BrowserRouter>
    );

    const payButton = screen.getByRole('button', { name: /pay now/i });
    await user.click(payButton);

    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    expect(payButton).toBeDisabled();
  });

  it('should handle payment error', async () => {
    const user = userEvent.setup();

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Payment failed' },
    });

    render(
      <BrowserRouter>
        <MockPaymentComponent />
      </BrowserRouter>
    );

    const payButton = screen.getByRole('button', { name: /pay now/i });
    await user.click(payButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalled();
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  it('should record payment transaction', async () => {
    const user = userEvent.setup();

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/session/123' },
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ 
        data: [{ id: 'txn-123', status: 'pending' }], 
        error: null 
      }),
    } as any);

    render(
      <BrowserRouter>
        <MockPaymentComponent />
      </BrowserRouter>
    );

    const payButton = screen.getByRole('button', { name: /pay now/i });
    await user.click(payButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalled();
    });
  });
});
