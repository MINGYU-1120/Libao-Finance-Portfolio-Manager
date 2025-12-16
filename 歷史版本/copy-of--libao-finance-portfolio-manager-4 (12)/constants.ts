import { PositionCategory } from './types';

export const INITIAL_CAPITAL = 1000000;
export const DEFAULT_EXCHANGE_RATE = 30;

export const DEFAULT_CATEGORIES: PositionCategory[] = [
  {
    id: 'tw-red',
    name: '紅標 (頭等艙)',
    market: 'TW',
    allocationPercent: 20,
    assets: [],
  },
  {
    id: 'tw-g',
    name: 'G倉 (長線)',
    market: 'TW',
    allocationPercent: 25,
    assets: [],
  },
  {
    id: 'tw-f',
    name: 'F倉',
    market: 'TW',
    allocationPercent: 15,
    assets: [],
  },
  {
    id: 'us-d',
    name: 'D倉 (長線)',
    market: 'US',
    allocationPercent: 25,
    assets: [],
  },
  {
    id: 'us-e',
    name: 'E倉',
    market: 'US',
    allocationPercent: 15,
    assets: [],
  },
];