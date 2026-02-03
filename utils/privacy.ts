import { CalculatedCategory, CalculatedAsset } from '../types';

/**
 * Creates a "Teaser" version of the categories by zeroing out sensitive numerical data.
 * Used to prevent sensitive data from even entering the view component's props.
 */
export const scrubSensitiveData = (categories: CalculatedCategory[]): CalculatedCategory[] => {
    return categories.map(cat => ({
        ...cat,
        projectedInvestment: 0,
        investedAmount: 0,
        remainingCash: 0,
        investmentRatio: 0,
        realizedPnL: 0,
        assets: cat.assets.map(asset => ({
            ...asset,
            shares: 0,
            avgCost: 0,
            costBasis: 0,
            marketValue: 0,
            unrealizedPnL: 0,
            realizedPnL: 0,
            returnRate: 0,
            portfolioRatio: 0,
            // Keep: symbol, name, market, currentPrice (public info usually), notes (maybe?)
            // If we strictly want to hide currentPrice for entry reasons, zero it too.
            // But usually currentPrice is public.
            // Let's zero currentPrice too to be safe/uniform with the mask.
            currentPrice: 0
        }))
    }));
};
