
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, MarketType, AppSettings } from '../types';
import { X, Calculator, ArrowRight, RefreshCw, AlertCircle, Search, TrendingUp, Wallet, PieChart, Layers, Calendar } from 'lucide-react';
import { stockService } from '../services/StockService'; // Direct Import
import { ALL_STOCKS, StockItem } from '../data/stockList';
import { useToast } from '../contexts/ToastContext';
import StockChartModal from './StockChartModal';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MarketType;
  totalCapital: number;
  categoryRemainingCash: number;
  categoryProjectedInvestment: number;
  initialAsset?: Asset | null;
  currentAssetAllocation?: number; // Current % of category budget this asset occupies
  onExecuteOrder: (order: OrderData) => void;
  defaultExchangeRate: number;
  settings?: AppSettings;
}

export interface OrderData {
  assetId?: string;
  symbol: string;
  name: string;
  action: 'BUY' | 'SELL' | 'DIVIDEND';
  price: number;
  shares: number;
  exchangeRate: number;
  fee: number;
  tax: number;
  totalAmount: number; // In TWD
  transactionDate?: string; // YYYY-MM-DD
}

const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  market,
  totalCapital,
  categoryRemainingCash,
  categoryProjectedInvestment,
  initialAsset,
  currentAssetAllocation = 0,
  onExecuteOrder,
  defaultExchangeRate,
  settings
}) => {
  const { showToast } = useToast();
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [calcMode, setCalcMode] = useState<'SHARES' | 'PERCENT'>('PERCENT');

  // Basic Info
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');

  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState<'symbol' | 'name' | null>(null);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const symbolWrapperRef = useRef<HTMLDivElement>(null);
  const nameWrapperRef = useRef<HTMLDivElement>(null);

  // Pricing & FX
  const [price, setPrice] = useState<string>(''); // Original Currency
  const [exchangeRate, setExchangeRate] = useState<string>(defaultExchangeRate.toString());

  // Inputs
  const [sharesInput, setSharesInput] = useState<string>('');
  const [percentInput, setPercentInput] = useState<string>('');
  const [feeInput, setFeeInput] = useState<string>('0');
  const [taxInput, setTaxInput] = useState<string>('0');

  // --- Fee Settings State (Local, synced from props) ---
  const [enableFees, setEnableFees] = useState<boolean>(true);
  const [usBroker, setUsBroker] = useState<'Firstrade' | 'IBKR' | 'Sub-brokerage'>('Firstrade');
  const [feeDiscount, setFeeDiscount] = useState<string>('6');

  // Sub-brokerage specific settings (Keep local persistence for these specific overrides)
  const [subBrokerageRate, setSubBrokerageRate] = useState<string>(() => {
    return localStorage.getItem('libao_us_sub_rate') || '0.3'; // Default 0.3%
  });
  const [subBrokerageMin, setSubBrokerageMin] = useState<string>(() => {
    return localStorage.getItem('libao_us_sub_min') || '15'; // Default 15 USD
  });

  // Sync settings when modal opens or settings change
  useEffect(() => {
    if (settings) {
      setEnableFees(settings.enableFees ?? true);
      setUsBroker(settings.usBroker || 'Firstrade');
      // Sync global discount setting to local state
      setFeeDiscount(settings.twFeeDiscount?.toString() || '6');
    }
  }, [isOpen, settings]);

  useEffect(() => {
    if (market === 'US') {
      localStorage.setItem('libao_us_sub_rate', subBrokerageRate);
      localStorage.setItem('libao_us_sub_min', subBrokerageMin);
    }
  }, [subBrokerageRate, subBrokerageMin, market]);


  // State
  const [calculatedTotalOriginal, setCalculatedTotalOriginal] = useState(0); // Total in Original Currency (USD or TWD)
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Chart State
  const [isChartOpen, setIsChartOpen] = useState(false);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        symbolWrapperRef.current &&
        !symbolWrapperRef.current.contains(event.target as Node) &&
        nameWrapperRef.current &&
        !nameWrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setActiveSearchField(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const executePriceFetch = useCallback(async (sym: string) => {
    if (!sym) return;
    setIsFetchingPrice(true);
    setPriceError(false);

    // Use StockService
    const fetchedPrice = await stockService.getPrice(sym, market);

    if (fetchedPrice) {
      setPrice(fetchedPrice.toString());
      setPriceError(false);
    } else {
      setPriceError(true);
      // Auto focus price input if fetch fails so user can type immediately
      setTimeout(() => {
        priceInputRef.current?.focus();
      }, 100);
    }
    setIsFetchingPrice(false);
  }, [market]);

  useEffect(() => {
    if (isOpen) {
      // Always reset date to today when opening
      setDate(new Date().toISOString().split('T')[0]);

      if (initialAsset) {
        setSymbol(initialAsset.symbol);
        setName(initialAsset.name);
        setPrice(initialAsset.currentPrice.toString());
        setAction('BUY');
        executePriceFetch(initialAsset.symbol);
      } else {
        setSymbol('');
        setName('');
        setPrice('');
        setAction('BUY');
      }
      setExchangeRate(market === 'US' ? defaultExchangeRate.toString() : '1');
      setSharesInput('');
      setPercentInput('');

      setFeeInput('0');
      setTaxInput('0');
      setCalcMode('PERCENT');
      setSuggestions([]);
      setPriceError(false);
      setIsSearchingOnline(false);
      setActiveSearchField(null);
      setIsChartOpen(false);
    }
  }, [isOpen, initialAsset, executePriceFetch, market, defaultExchangeRate]);

  // Hybrid Search Logic
  const runHybridSearch = useCallback((query: string) => {
    const upQuery = query.toUpperCase();
    const localResults = ALL_STOCKS.filter(s =>
      s.market === market &&
      (s.symbol.includes(upQuery) || s.name.includes(query) || s.name.toUpperCase().includes(upQuery))
    ).slice(0, 20);

    setSuggestions(localResults);
    setShowSuggestions(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length >= 1) { // 放寬到 1 個字即觸發線上搜尋，確保 CRDO 等較少見代號能快速顯現
      setIsSearchingOnline(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const onlineResults = await stockService.searchStocks(query, market);
          setSuggestions(prev => {
            const currentSymbols = new Set(prev.map(p => p.symbol));
            const newItems = onlineResults.filter(r => !currentSymbols.has(r.symbol));
            const combined = [...prev, ...newItems].slice(0, 50);
            // 如果線上搜尋找到了精確匹配的 Symbol，確保它排在第一位
            return combined.sort((a, b) => {
              if (a.symbol === upQuery) return -1;
              if (b.symbol === upQuery) return 1;
              return 0;
            });
          });
        } catch (e) {
          console.error("Online search failed", e);
        } finally {
          setIsSearchingOnline(false);
        }
      }, 400);
    } else {
      setIsSearchingOnline(false);
    }
  }, [market]);

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setSymbol(val);
    setPriceError(false);

    if (!initialAsset && val.length > 0) {
      setActiveSearchField('symbol');
      runHybridSearch(val);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!initialAsset && val.length > 0) {
      setActiveSearchField('name');
      runHybridSearch(val);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item: StockItem) => {
    setSymbol(item.symbol);
    setName(item.name);
    setShowSuggestions(false);
    setActiveSearchField(null);
    executePriceFetch(item.symbol);
  };

  // Recalculate totals
  useEffect(() => {
    const rate = market === 'TW' ? 1 : (parseFloat(exchangeRate) || 1);
    const p = parseFloat(price) || 0;

    if (calcMode === 'SHARES') {
      const s = parseFloat(sharesInput) || 0;
      const subtotal = s * p;
      setCalculatedTotalOriginal(subtotal);
    } else {
      const pct = parseFloat(percentInput) || 0;

      if (pct > 0) {
        // Target Capital to Allocate/De-allocate (TWD)
        const targetTWD = categoryProjectedInvestment * (pct / 100);

        if (action === 'SELL' && initialAsset && initialAsset.lots && initialAsset.lots.length > 0) {
          // === STRICT FIFO SIMULATION FOR SELL ===
          let accumulatedCostTWD = 0;
          let sharesNeeded = 0;

          // Sort lots by date ascending (Oldest first)
          const sortedLots = [...initialAsset.lots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          for (const lot of sortedLots) {
            const remainingTarget = targetTWD - accumulatedCostTWD;
            if (remainingTarget <= 0.1) break; // Float tolerance

            const lotCostTWD = lot.shares * lot.costPerShare * lot.exchangeRate;

            if (lotCostTWD <= remainingTarget) {
              accumulatedCostTWD += lotCostTWD;
              sharesNeeded += lot.shares;
            } else {
              const lotPricePerShareTWD = lot.costPerShare * lot.exchangeRate;
              if (lotPricePerShareTWD > 0) {
                const sharesFromLot = remainingTarget / lotPricePerShareTWD;
                sharesNeeded += sharesFromLot;
                accumulatedCostTWD += remainingTarget;
              }
              break;
            }
          }

          const s = market === 'TW'
            ? Math.ceil(sharesNeeded)
            : Math.ceil(sharesNeeded * 100) / 100;

          setSharesInput(s.toString());
          setCalculatedTotalOriginal(s * p);

        } else {
          const calculationPrice = p;
          const calculationPriceTWD = calculationPrice * rate;

          if (calculationPriceTWD > 0) {
            const s = market === 'TW'
              ? Math.ceil(targetTWD / calculationPriceTWD)
              : Math.ceil((targetTWD / calculationPriceTWD) * 100) / 100;

            setSharesInput(s.toString());
            setCalculatedTotalOriginal(s * p);
          }
        }
      } else {
        setSharesInput('');
        setCalculatedTotalOriginal(0);
      }
    }
  }, [price, exchangeRate, sharesInput, percentInput, calcMode, categoryProjectedInvestment, market, action, initialAsset]);


  // --- Auto Calculation Logic ---

  const handleAutoCalcTW = useCallback(() => {
    if (!enableFees) {
      setFeeInput('0');
      setTaxInput('0');
      return;
    }
    const p = parseFloat(price) || 0;
    const s = parseFloat(sharesInput) || 0;
    const val = p * s;
    if (val <= 0) {
      setFeeInput('0');
      setTaxInput('0');
      return;
    }

    // TW Fee: 0.1425% * Discount
    let discount = parseFloat(feeDiscount);
    if (isNaN(discount) || discount <= 0) discount = 10;
    const multiplier = discount / 10;

    let f = Math.ceil(val * 0.001425 * multiplier);
    if (f < 20) f = 20;
    setFeeInput(f.toString());

    if (action === 'SELL') {
      const isETF = symbol.startsWith('00');
      const taxRate = isETF ? 0.001 : 0.003;
      const t = Math.round(val * taxRate);
      setTaxInput(t.toString());
    } else {
      setTaxInput('0');
    }
  }, [price, sharesInput, feeDiscount, action, symbol, enableFees]);

  const handleAutoCalcUS = useCallback(() => {
    if (!enableFees) {
      setFeeInput('0');
      setTaxInput('0');
      return;
    }

    const p = parseFloat(price) || 0;
    const s = parseFloat(sharesInput) || 0;
    const val = p * s;

    if (val <= 0) {
      setFeeInput('0');
      setTaxInput('0');
      return;
    }

    // --- Commission ---
    let commission = 0;
    if (usBroker === 'Firstrade') {
      commission = 0;
    } else if (usBroker === 'IBKR') {
      let rawComm = s * 0.005;
      if (rawComm < 1.0) rawComm = 1.0;
      const maxComm = val * 0.01;
      if (rawComm > maxComm) rawComm = maxComm;
      commission = rawComm;
    } else if (usBroker === 'Sub-brokerage') {
      const rate = parseFloat(subBrokerageRate) || 0;
      const minFee = parseFloat(subBrokerageMin) || 0;

      let rawComm = val * (rate / 100);
      if (rawComm < minFee) rawComm = minFee;
      commission = rawComm;
    }
    setFeeInput(commission.toFixed(4));

    // --- Regulatory Fees (Tax) - SELL ONLY ---
    let regulatoryFees = 0;
    if (action === 'SELL') {
      const secFee = val * 0.000008;
      const tafFee = Math.min(s * 0.000119, 5.95);
      regulatoryFees = secFee + tafFee;
    }
    setTaxInput(regulatoryFees.toFixed(4));

  }, [price, sharesInput, action, enableFees, usBroker, subBrokerageRate, subBrokerageMin]);

  // Trigger calculations
  useEffect(() => {
    if (market === 'TW') {
      handleAutoCalcTW();
    } else if (market === 'US') {
      handleAutoCalcUS();
    }
  }, [market, price, sharesInput, feeDiscount, action, symbol, enableFees, usBroker, subBrokerageRate, subBrokerageMin, handleAutoCalcTW, handleAutoCalcUS]);


  const handleMaxAction = () => {
    if (action === 'BUY') {
      const p = parseFloat(price) || 0;
      const rate = market === 'TW' ? 1 : parseFloat(exchangeRate) || 1;
      if (p <= 0 || rate <= 0) return;

      const safeCash = categoryRemainingCash * 0.995;
      if (safeCash <= 0) {
        setSharesInput('0');
        return;
      }

      const priceInTWD = p * rate;
      let maxShares = 0;

      if (market === 'TW') {
        maxShares = Math.floor(safeCash / priceInTWD);
      } else {
        maxShares = Math.floor((safeCash / priceInTWD) * 100) / 100;
      }

      setSharesInput(maxShares.toString());
      setCalcMode('SHARES');
      setCalculatedTotalOriginal(maxShares * p);
    } else {
      if (initialAsset) {
        setSharesInput(initialAsset.shares.toString());
        setCalcMode('SHARES');
        const p = parseFloat(price) || 0;
        if (p > 0) setCalculatedTotalOriginal(initialAsset.shares * p);
      }
    }
  };

  const handleSubmit = () => {
    const rate = market === 'TW' ? 1 : parseFloat(exchangeRate);
    const p = parseFloat(price);
    const s = parseFloat(sharesInput);

    const fee = enableFees ? (parseFloat(feeInput) || 0) : 0;
    const tax = enableFees ? (parseFloat(taxInput) || 0) : 0;

    if (!symbol || !name || isNaN(p) || isNaN(s) || s <= 0 || isNaN(rate)) {
      showToast("請填寫完整正確的資訊", 'error');
      return;
    }

    if (action === 'SELL' && initialAsset) {
      if (s > initialAsset.shares) {
        showToast(`賣出股數 (${s}) 超過持有股數 (${initialAsset.shares})`, 'error');
        return;
      }
    }

    const totalTWD = p * s * rate;
    const feeTWD = market === 'US' ? fee * rate : fee;
    const taxTWD = market === 'US' ? tax * rate : tax;

    console.log('Sending Order with Date:', date); // Debug Log

    onExecuteOrder({
      assetId: initialAsset?.id,
      symbol: symbol.toUpperCase(),
      name,
      action,
      price: p,
      shares: s,
      exchangeRate: rate,
      fee: feeTWD,
      tax: taxTWD,
      totalAmount: totalTWD,
      transactionDate: date
    });
    onClose();
  };

  const SuggestionDropdown = ({ query, fieldName }: { query: string, fieldName: string }) => (
    <div className="absolute top-full left-0 w-[200%] z-[100] bg-white shadow-xl rounded-lg border border-gray-200 mt-1 max-h-56 overflow-y-auto">
      <ul>
        {suggestions.map((item, idx) => (
          <li
            key={idx}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelectSuggestion(item);
            }}
            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0 flex items-center gap-2 group"
          >
            <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-sm shrink-0 min-w-[60px] text-center">{item.symbol}</span>
            <span className="text-sm text-gray-600 group-hover:text-gray-900">{item.name}</span>
          </li>
        ))}
        {isSearchingOnline && (
          <li className="px-3 py-2 text-center text-xs text-gray-400 bg-gray-50 flex items-center justify-center gap-2 border-t border-gray-100">
            <RefreshCw className="w-3 h-3 animate-spin" /> 正在線上搜尋更多結果...
          </li>
        )}
        {!isSearchingOnline && suggestions.length === 0 && (
          <li className="px-3 py-3 text-center text-sm text-gray-400">
            無符合結果，請嘗試其他關鍵字。
          </li>
        )}
      </ul>
    </div>
  );

  if (!isOpen) return null;

  let bgColor, textColor, borderColor, ringColor;
  if (action === 'BUY') {
    bgColor = 'bg-red-600'; textColor = 'text-red-600'; borderColor = 'border-red-200'; ringColor = 'focus:ring-red-500';
  } else {
    bgColor = 'bg-green-600'; textColor = 'text-green-600'; borderColor = 'border-green-200'; ringColor = 'focus:ring-green-500';
  }

  const subtotalOriginal = calculatedTotalOriginal;
  const rate = parseFloat(exchangeRate) || 1;
  const feeVal = parseFloat(feeInput) || 0;
  const taxVal = parseFloat(taxInput) || 0;
  const currentSharesVal = parseFloat(sharesInput) || 0;

  const currency = market === 'US' ? 'USD' : 'TWD';
  const currencySymbol = market === 'US' ? '$' : 'NT$';

  let netCashImpactOriginal = 0;
  let breakEvenPrice = 0;

  if (action === 'BUY') {
    netCashImpactOriginal = subtotalOriginal + feeVal;
    if (currentSharesVal > 0) {
      breakEvenPrice = netCashImpactOriginal / currentSharesVal;
    }
  } else if (action === 'SELL') {
    netCashImpactOriginal = subtotalOriginal - feeVal - taxVal;
    if (currentSharesVal > 0) {
      breakEvenPrice = netCashImpactOriginal / currentSharesVal;
    }
  }

  const netCashImpactTWD = netCashImpactOriginal * rate;
  const isBuy = action === 'BUY';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">

      {/* Stock Chart Overlay */}
      <StockChartModal
        isOpen={isChartOpen}
        onClose={() => setIsChartOpen(false)}
        symbol={symbol}
        name={name}
        market={market}
      />

      <div id="order-modal-content" className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className={`${bgColor} p-4 text-white flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2 font-bold text-lg">
            <Calculator className="w-5 h-5" />
            {initialAsset ? `交易: ${initialAsset.symbol}` : '新增委託單'}
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X className="w-6 h-6" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button onClick={() => setAction('BUY')} className={`flex-1 py-3 font-bold text-sm transition-colors ${action === 'BUY' ? 'text-red-600 border-b-2 border-red-600 bg-red-50' : 'text-gray-500 hover:bg-gray-50'}`}>買入 (BUY)</button>
          <button onClick={() => setAction('SELL')} className={`flex-1 py-3 font-bold text-sm transition-colors ${action === 'SELL' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-50'}`}>賣出 (SELL)</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Symbol / Name */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 relative" ref={symbolWrapperRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1">代號 / 搜尋</label>
              <input
                value={symbol}
                onChange={handleSymbolChange}
                onBlur={() => {
                  if (symbol && !isFetchingPrice && !showSuggestions) {
                    setTimeout(() => {
                      if (!showSuggestions && !activeSearchField) executePriceFetch(symbol);
                    }, 200);
                  }
                }}
                placeholder="代號"
                disabled={!!initialAsset}
                className="w-full p-2 border rounded-lg font-bold text-center bg-white border-gray-300 uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                autoComplete="off"
              />
              {showSuggestions && activeSearchField === 'symbol' && (
                <SuggestionDropdown query={symbol} fieldName="Symbol" />
              )}
            </div>
            <div className="col-span-2 relative" ref={nameWrapperRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1">名稱 / 搜尋</label>
              <input
                value={name}
                onChange={handleNameChange}
                placeholder="搜尋名稱"
                disabled={!!initialAsset}
                className="w-full p-2 border rounded-lg bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                autoComplete="off"
              />
              {showSuggestions && activeSearchField === 'name' && (
                <SuggestionDropdown query={name} fieldName="Name" />
              )}
            </div>
          </div>

          {/* Current Position Info */}
          {initialAsset && (
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex justify-between items-center text-xs text-blue-800">
              <div className="flex flex-col">
                <span className="text-blue-400 text-[10px] flex items-center gap-1"><Layers className="w-3 h-3" />現有股數</span>
                <span className="font-bold font-mono text-sm">{initialAsset.shares.toLocaleString()}</span>
              </div>
              <div className="flex flex-col text-center border-l border-blue-100 pl-4">
                <span className="text-blue-400 text-[10px] flex items-center gap-1 justify-center"><TrendingUp className="w-3 h-3" />持倉均價</span>
                <span className="font-bold font-mono text-sm">{currencySymbol} {initialAsset.avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col text-right border-l border-blue-100 pl-4">
                <span className="text-blue-400 text-[10px] flex items-center gap-1 justify-end"><PieChart className="w-3 h-3" />目前占比</span>
                <span className="font-bold font-mono text-sm">{currentAssetAllocation.toFixed(2)}%</span>
              </div>
            </div>
          )}

          {/* Price & Rate */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">
                <span>單價 ({currency})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsChartOpen(true)}
                    disabled={!symbol}
                    className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="查看即時K線"
                  >
                    <TrendingUp className="w-3 h-3" /> K線
                  </button>
                  <button
                    onClick={() => executePriceFetch(symbol)}
                    className={`text-blue-600 hover:underline text-[10px] inline-flex items-center ${isFetchingPrice ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isFetchingPrice}
                  >
                    <RefreshCw className={`w-3 h-3 mr-0.5 ${isFetchingPrice ? 'animate-spin' : ''}`} />
                    查價
                  </button>
                </div>
              </label>
              <input
                ref={priceInputRef}
                type="number"
                value={price}
                onChange={(e) => { setPrice(e.target.value); setPriceError(false); }}
                className={`w-full p-2 border rounded-lg font-mono font-bold bg-white ${priceError ? 'border-red-500 focus:ring-red-200' : `${ringColor} border-gray-300`}`}
                placeholder="0.00"
              />
              {priceError && (
                <div className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>無法取得報價，請手動輸入</span>
                </div>
              )}
            </div>
            {market === 'US' && (
              <div className="w-24">
                <label className="block text-xs font-medium text-gray-500 mb-1">匯率</label>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="w-full p-2 border rounded-lg font-mono text-center bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
          </div>

          {/* Date Selection */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 交易日期
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* Calc Mode */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setCalcMode('PERCENT')} className={`flex-1 py-1 text-xs rounded ${calcMode === 'PERCENT' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>輸入比例</button>
            <button onClick={() => setCalcMode('SHARES')} className={`flex-1 py-1 text-xs rounded ${calcMode === 'SHARES' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>輸入股數</button>
          </div>

          {/* Shares / Percent Input */}
          {calcMode === 'SHARES' ? (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-gray-500">交易股數</label>
                {price && !isNaN(parseFloat(price)) && (
                  <button
                    onClick={handleMaxAction}
                    className="text-[10px] bg-red-100 hover:bg-red-200 text-red-700 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                    title={action === 'BUY' ? "最大可買股數 (依現金)" : "最大可賣股數 (依庫存)"}
                  >
                    <Wallet className="w-3 h-3" /> Max
                  </button>
                )}
              </div>
              <input
                type="number"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                placeholder="0"
                className={`w-full p-2 border rounded-lg font-mono text-xl font-bold text-right bg-white border-gray-300 ${ringColor}`}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {isBuy ? '投入資金比例 (% of Category)' : '減碼資金比例 (% of Category)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={percentInput}
                  onChange={(e) => setPercentInput(e.target.value)}
                  placeholder="%"
                  className={`w-full p-2 border rounded-lg font-mono text-xl font-bold text-right bg-white border-gray-300 ${ringColor}`}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">
                  基準: NT${categoryProjectedInvestment.toLocaleString()}
                </span>
                <span className="text-xs text-right text-gray-500">約 {sharesInput || 0} 股</span>
              </div>
            </div>
          )}

          {/* Fee & Tax Section */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="flex flex-col gap-2 mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableFees"
                  checked={enableFees}
                  onChange={(e) => setEnableFees(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="enableFees" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
                  套用手續費計算 ({currency})
                </label>
              </div>

              {enableFees && (
                <>
                  {market === 'TW' && (
                    <div className="flex items-center bg-white border border-gray-300 rounded px-2 py-0.5 w-fit">
                      <span className="text-[10px] text-gray-500 mr-1">折扣:</span>
                      <input
                        type="number"
                        value={feeDiscount}
                        onChange={(e) => setFeeDiscount(e.target.value)}
                        className="w-8 text-[10px] text-center outline-none font-bold text-blue-600 p-0 border-none bg-transparent"
                        placeholder="6"
                      />
                      <span className="text-[10px] text-gray-500">折</span>
                    </div>
                  )}
                  {market === 'US' && (
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex bg-white border border-gray-300 rounded p-0.5 w-fit">
                        <button
                          onClick={() => setUsBroker('Firstrade')}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${usBroker === 'Firstrade' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          Firstrade
                        </button>
                        <div className="w-[1px] bg-gray-200 my-0.5"></div>
                        <button
                          onClick={() => setUsBroker('IBKR')}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${usBroker === 'IBKR' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          IBKR
                        </button>
                        <div className="w-[1px] bg-gray-200 my-0.5"></div>
                        <button
                          onClick={() => setUsBroker('Sub-brokerage')}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${usBroker === 'Sub-brokerage' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          複委託
                        </button>
                      </div>

                      {usBroker === 'Sub-brokerage' && (
                        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 p-1.5 rounded animate-in fade-in">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500">費率%:</span>
                            <input
                              type="number"
                              value={subBrokerageRate}
                              onChange={(e) => setSubBrokerageRate(e.target.value)}
                              className="w-10 text-[10px] p-0.5 border rounded text-center bg-white focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500">最低(USD):</span>
                            <input
                              type="number"
                              value={subBrokerageMin}
                              onChange={(e) => setSubBrokerageMin(e.target.value)}
                              className="w-10 text-[10px] p-0.5 border rounded text-center bg-white focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {enableFees && (
              <div className="flex gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400">
                    {market === 'TW' ? '手續費 (最低20)' : '佣金 (Commission)'}
                  </label>
                  <input
                    type="number"
                    value={feeInput}
                    onChange={(e) => setFeeInput(e.target.value)}
                    className="w-full p-1 text-sm border rounded text-right bg-white border-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400">
                    {market === 'TW' ? '證交稅' : '監管費 (SEC/TAF)'}
                  </label>
                  <input
                    type="number"
                    value={taxInput}
                    onChange={(e) => setTaxInput(e.target.value)}
                    className="w-full p-1 text-sm border rounded text-right bg-white border-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                    disabled={action === 'BUY' && market === 'TW'}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Total Summary */}
          <div className={`rounded-lg p-4 border ${borderColor} ${isBuy ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">成交總值 ({currency})</span>
              <span className="font-mono font-medium">{Math.round(subtotalOriginal).toLocaleString()}</span>
            </div>
            {enableFees && (
              <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-2">
                <span className="text-xs text-gray-500">費用總計 ({currency})</span>
                <span className="text-xs text-gray-500">{(feeVal + taxVal).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-800">
                {isBuy ? '預估扣款' : '預估入帳'}
              </span>
              <span className={`text-xl font-bold font-mono ${textColor}`}>
                {currencySymbol} {Math.round(netCashImpactOriginal).toLocaleString()}
              </span>
            </div>

            {market === 'US' && (
              <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200/50">
                <span className="text-xs text-gray-500">預估台幣金額</span>
                <span className="text-xs font-mono font-bold text-gray-600">
                  ≈ NT$ {Math.round(netCashImpactTWD).toLocaleString()}
                </span>
              </div>
            )}

            {breakEvenPrice > 0 && currentSharesVal > 0 && (
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200/50">
                <span className="text-xs text-gray-500 font-bold">
                  {isBuy ? '損益兩平價' : '實質成交均價'}
                </span>
                <span className="text-sm font-mono font-bold text-gray-700 bg-white/50 px-2 rounded">
                  {currencySymbol} {breakEvenPrice.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <button onClick={handleSubmit} className={`w-full py-3 rounded-lg text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 ${isBuy ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
            {action === 'BUY' ? '確認買入' : '確認賣出'} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderModal;
