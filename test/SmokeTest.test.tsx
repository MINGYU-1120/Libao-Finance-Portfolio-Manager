import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- MOCK FIREBASE ---
vi.mock('../services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user' } },
    googleProvider: {},
    loginWithGoogle: vi.fn(),
    logoutUser: vi.fn(),
    subscribeToAuthChanges: vi.fn((callback) => {
        callback({ uid: 'test-user', email: 'test@example.com' }); // Auto-login
        return () => { };
    }),
    savePortfolioToCloud: vi.fn(),
    loadPortfolioFromCloud: vi.fn().mockResolvedValue({
        lastModified: Date.now(),
        totalCapital: 1000000,
        settings: { usExchangeRate: 30, enableFees: true, usBroker: 'Firstrade', twFeeDiscount: 6, enableSystemNotifications: false },
        categories: [
            {
                id: 'cat1', name: '台股長波段', market: 'TW', allocationPercent: 50,
                assets: [{ id: 'a1', symbol: '2330', name: '台積電', shares: 1000, lots: [], avgCost: 500, averageCost: 500, currentPrice: 500 }]
            }
        ],
        transactions: [
            { id: 'tx1', type: 'BUY', symbol: '2330', date: '2025-01-01', shares: 1000, price: 500, amount: 500000, categoryName: '台股長波段' }
        ],
        capitalLogs: []
    }),
    syncUserProfile: vi.fn().mockResolvedValue('viewer'),
    resetCloudPortfolio: vi.fn(),
}));

// --- MOCK STOCK SERVICE ---
vi.mock('../services/StockService', () => ({
    stockService: {
        getStockNews: vi.fn().mockResolvedValue([]),
        getPrice: vi.fn().mockResolvedValue(600),
        getPrices: vi.fn().mockResolvedValue({ '2330': 600 }),
    }
}));

// --- MOCK TOAST CONTEXT ---
vi.mock('../contexts/ToastContext', () => ({
    ToastProvider: ({ children }: any) => <div>{children}</div>,
    useToast: () => ({ showToast: vi.fn() }),
}));

describe('App Smoke Test (Browser Simulation)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Force Desktop View
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
        window.dispatchEvent(new Event('resize'));
    });

    it('renders the main navigation tabs', async () => {
        render(<App />);
        // Wait for loading to finish
        expect(await screen.findByText('總覽 Dashboard')).toBeInTheDocument();

        expect(screen.getByText('AI Picks')).toBeInTheDocument();
        expect(screen.getByText('歷史 History')).toBeInTheDocument();
    });

    it('navigates to AI Picks and shows strategy data', async () => {
        render(<App />);

        // Wait for load and Click AI Picks Tab
        const aiTab = await screen.findByText('AI Picks');
        fireEvent.click(aiTab);

        // Verify Strategy Components
        expect(await screen.findByText('AI 策略選股')).toBeInTheDocument();
    });

    it('navigates to Holdings and shows portfolio data', async () => {
        render(<App />);

        // Wait for load and Click Dashboard Tab
        const dashTab = await screen.findByText('總覽 Dashboard');
        fireEvent.click(dashTab);

        // Verify Portfolio Data
        expect(await screen.findByText('持倉總覽 (Overview)')).toBeInTheDocument();
        expect(await screen.findByText('台股長波段')).toBeInTheDocument();
    });

    it('navigates to History and shows transactions', async () => {
        render(<App />);

        // Wait for load and Click History Tab
        const historyTab = await screen.findByText('歷史 History');
        fireEvent.click(historyTab);

        // Verify Transaction Data
        expect(await screen.findByText('交易紀錄 (Transaction History)')).toBeInTheDocument();
        // Use regex for partial match or specific text
        expect(await screen.findByText(/買入/)).toBeInTheDocument();
    });

});
