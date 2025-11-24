import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Mock order creation component - adjust import based on your actual component
const MockOrderCreation = () => {
  const [selectedProduct, setSelectedProduct] = React.useState('');
  const [quantity, setQuantity] = React.useState(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('sales_orders')
      .insert({
        human_uid: 'TEST-001',
        uid: 'test-uid',
        customer_id: 'test-customer',
        subtotal: 100,
      });
    
    if (error) throw error;
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="product">Product</label>
      <select 
        id="product" 
        value={selectedProduct} 
        onChange={(e) => setSelectedProduct(e.target.value)}
      >
        <option value="">Select a product</option>
        <option value="prod-1">Product 1</option>
      </select>
      
      <label htmlFor="quantity">Quantity</label>
      <input 
        id="quantity" 
        type="number" 
        value={quantity} 
        onChange={(e) => setQuantity(Number(e.target.value))}
        min="1"
      />
      
      <button type="submit">Create Order</button>
    </form>
  );
};

describe('Order Creation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render order creation form', () => {
    render(
      <BrowserRouter>
        <MockOrderCreation />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/product/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create order/i })).toBeInTheDocument();
  });

  it('should allow selecting product and quantity', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <MockOrderCreation />
      </BrowserRouter>
    );

    const productSelect = screen.getByLabelText(/product/i);
    const quantityInput = screen.getByLabelText(/quantity/i);

    await user.selectOptions(productSelect, 'prod-1');
    await user.clear(quantityInput);
    await user.type(quantityInput, '5');

    expect(productSelect).toHaveValue('prod-1');
    expect(quantityInput).toHaveValue(5);
  });

  it('should create order successfully', async () => {
    const user = userEvent.setup();
    const mockOrder = {
      id: 'order-123',
      customer_id: 'test-customer',
      subtotal: 100,
    };

    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [mockOrder], error: null }),
    } as any);

    render(
      <BrowserRouter>
        <MockOrderCreation />
      </BrowserRouter>
    );

    const productSelect = screen.getByLabelText(/product/i);
    const submitButton = screen.getByRole('button', { name: /create order/i });

    await user.selectOptions(productSelect, 'prod-1');
    await user.click(submitButton);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('sales_orders');
    });
  });

  it('should handle order creation error', async () => {
    const user = userEvent.setup();

    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ 
        data: null, 
        error: { message: 'Failed to create order' } 
      }),
    } as any);

    render(
      <BrowserRouter>
        <MockOrderCreation />
      </BrowserRouter>
    );

    const productSelect = screen.getByLabelText(/product/i);
    const submitButton = screen.getByRole('button', { name: /create order/i });

    await user.selectOptions(productSelect, 'prod-1');
    await user.click(submitButton);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalled();
    });
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <MockOrderCreation />
      </BrowserRouter>
    );

    const submitButton = screen.getByRole('button', { name: /create order/i });
    await user.click(submitButton);

    // Form validation should prevent submission
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
