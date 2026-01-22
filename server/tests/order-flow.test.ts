
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';

// Mock DB 
vi.mock('../db', () => ({
    db: {
        transaction: vi.fn(),
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    rawClient: {},
    pool: {}
}));

describe('Order Flow (createOrderTransaction)', () => {
    // Mock data
    const mockProduct = {
        id: 'prod_1',
        name: 'Test Coffee',
        type: 'finished_good',
        price: '5.00',
        stockQuantity: 10,
        isActive: true
    };

    const mockOrder = {
        orderNumber: 1,
        subtotal: '5.00',
        total: '5.00',
        status: 'pending',
        cashierId: 'user_1'
    };

    const mockItem = {
        productId: 'prod_1',
        quantity: 1,
        unitPrice: '5.00',
        total: '5.00'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('successfully creates order and deducts stock for finished_good', async () => {
        // Setup Mock Transaction
        const mockTx = {
            insert: vi.fn(),
            select: vi.fn(),
            update: vi.fn(),
            execute: vi.fn(),
        };

        // db.transaction executes callback immediately
        (db.transaction as any).mockImplementation(async (cb: any) => {
            return cb(mockTx);
        });

        // Mock insert order -> returns new order
        mockTx.insert.mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'order_1', ...mockOrder }])
            })
        });

        // Mock select product -> returns product
        mockTx.select.mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([mockProduct])
            })
        });

        // Mock update stock execution -> returns updated stock
        mockTx.execute.mockResolvedValue([{ stock_quantity: 9 }]);

        // Execute
        const result = await storage.createOrderTransaction(mockOrder as any, [mockItem] as any, 'user_1');

        // Verify
        expect(result.id).toBe('order_1');
        expect(mockTx.insert).toHaveBeenCalledTimes(3); // Order, OrderItems, InventoryLog
        // Verify inventory log was called
        const inventoryLogCall = mockTx.insert.mock.calls[2][0]; // 3rd call to insert (table is implied by mock structure, but in reality it's passed to insert)
        // Since mockTx.insert is called with the table, we can verify that too if we mocked imports better. 
        // But observing 3 inserts is a good sign: Order, Item, InventoryLog.
    });

    it('fails when stock is insufficient', async () => {
        const mockTx = {
            insert: vi.fn(),
            select: vi.fn(),
            update: vi.fn(),
            execute: vi.fn(),
        };

        (db.transaction as any).mockImplementation(async (cb: any) => {
            return cb(mockTx);
        });

        // Mock insert order
        mockTx.insert.mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'order_1', ...mockOrder }])
            })
        });

        // Mock select product
        mockTx.select.mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([mockProduct])
            })
        });

        // Mock update stock execution -> returns empty array (failure to update condition)
        mockTx.execute.mockResolvedValue([]);

        // Execute and Expect Error
        await expect(storage.createOrderTransaction(mockOrder as any, [mockItem] as any, 'user_1'))
            .rejects
            .toThrow('Insufficient stock for product Test Coffee');
    });
});
