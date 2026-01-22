
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CashierPOS from './cashier';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as useAuthHook from '@/hooks/useAuth';
import * as useWebSocketHook from '@/hooks/useWebSocket';

// Mocks
vi.mock('@/hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

vi.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: vi.fn(),
}));

// Mock Toaster hooks
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

// Mock API calls via global fetch
global.fetch = vi.fn();

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

describe('CashierPOS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuthHook.useAuth as any).mockReturnValue({
            user: { role: 'cashier', id: 'user_1' },
            isAuthenticated: true,
            isLoading: false,
        });
        (useWebSocketHook.useWebSocket as any).mockImplementation(() => { });

        // Mock successful product fetch
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/api/products')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: '1', name: 'Coffee', price: '5.00', categoryId: 'cat_1', stockQuantity: 100, isActive: true },
                        { id: '2', name: 'Tea', price: '3.00', categoryId: 'cat_1', stockQuantity: 50, isActive: true },
                    ]),
                });
            }
            if (url.includes('/api/categories')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 'cat_1', name: 'Beverages' }
                    ])
                })
            }
            if (url.includes('/api/users/me/settings')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            }
            if (url.includes('/api/currency/current')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ rate: '89500' }) });
            }
            if (url.includes('/api/orders')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([]),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
    });

    it('renders products and allows adding to cart', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <CashierPOS />
            </QueryClientProvider>
        );

        // Check if products load
        await waitFor(() => {
            expect(screen.getByText('Coffee')).toBeInTheDocument();
        });

        // Check initial total
        expect(screen.getByText(/\$0.00/)).toBeInTheDocument();

        // Click product to add to cart
        fireEvent.click(screen.getByText('Coffee'));

        // Check updated total (price is $5.00)
        await waitFor(() => {
            // It might be displayed in multiple places (cart item + total footing), so getAllByText or check specific area
            // Simpler: check for "$5.00" appearing in the cart total section logic or just text presence
            const priceElements = screen.getAllByText(/\$5.00/);
            expect(priceElements.length).toBeGreaterThan(0);
        });

        // Add another item
        fireEvent.click(screen.getByText('Tea'));

        // Total should be $8.00
        await waitFor(() => {
            const totalElements = screen.getAllByText(/\$8.00/);
            expect(totalElements.length).toBeGreaterThan(0);
        });
    });
});
