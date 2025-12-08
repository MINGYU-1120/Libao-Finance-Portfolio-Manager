
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, MarketType } from '../types';
import { X, Calculator, ArrowRight, RefreshCw, AlertCircle, Search } from 'lucide-react';
import { fetchStockPrice, searchStocksYahoo } from '../services/geminiService';
import { ALL_STOCKS, StockItem } from '../data/stockList';

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
  defaultExchangeRate
}) => {
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [calcMode, setCalcMode] = useState<'SHARES' | 'PERCENT'>('PERCENT');
  
  // Basic Info
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  
  // Autocomplete State
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState<'symbol' | 'name' | null>(null);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  
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
  
  // State
  const [calculatedTotalTWD, setCalculatedTotalTWD] = useState(0);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const priceInputRef = useRef<HTMLInputElement>(null);

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
    
    // Use the updated robust service
    const fetchedPrice = await fetchStockPrice(sym, market);
    
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
    }
  }, [isOpen, initialAsset, executePriceFetch, market, defaultExchangeRate]);

  const searchLocalStocks = (val: string) => {
      const filtered = ALL_STOCKS.filter(item => 
        item.market === market && 
        (item.symbol.includes(val) || item.name.includes(val))
      );
      setSuggestions(filtered.slice(0, 50)); 
      setShowSuggestions(true);
  };

  // Handle Symbol Change & Autocomplete
  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setSymbol(val);
    setPriceError(false); 
    
    if (!initialAsset && val.length > 0) {
      setActiveSearchField('symbol');
      searchLocalStocks(val);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle Name Change & Autocomplete
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    
    if (!initialAsset && val.length > 0) {
      setActiveSearchField('name');
      searchLocalStocks(val);
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

  const handleOnlineSearch = async (query: string) => {
    if (!query) return;
    setIsSearchingOnline(true);
    // Call the new quota-free Yahoo search
    const results = await searchStocksYahoo(query, market);
    
    // Map to StockItem structure
    const mappedResults: StockItem[] = results.map(r => ({
      symbol: r.symbol,
      name: r.name,
      market: r.market
    }));

    if (mappedResults.length === 0) {
      alert("未找到相關股票，請確認關鍵字。");
    } else {
      setSuggestions(mappedResults);
    }
    setIsSearchingOnline(false);
    
    // Keep focus
    setTimeout(() => {
        if (activeSearchField === 'symbol') symbolWrapperRef.current?.querySelector('input')?.focus();
        if (activeSearchField === 'name') nameWrapperRef.current?.querySelector('input')?.focus();
    }, 100);
  };

  // Recalculate totals and Sync Inputs
  useEffect(() => {
    const rate = market === 'TW' ? 1 : (parseFloat(exchangeRate) || 1);

    const p = parseFloat(price) || 0;
    
    // --- MODE: SHARES (User enters Shares -> Calculate Total) ---
    if (calcMode === 'SHARES') {
      const s = parseFloat(sharesInput) || 0;
      
      // Calculate Subtotal
      const subtotalTWD = s * p * rate;
      setCalculatedTotalTWD(subtotalTWD);
    } 
    
    // --- MODE: PERCENT (User enters % -> Calculate Shares) ---
    else {
      const pct = parseFloat(percentInput) || 0;
      
      if (action === 'BUY') {
        // BUY Logic: % of Category Projected Investment
        if (p > 0 && pct > 0) {
           const targetTWD = categoryProjectedInvestment * (pct / 100);
           const priceInTWD = p * rate;
           if (priceInTWD > 0) {
              const s = market === 'TW' 
                ? Math.floor(targetTWD / priceInTWD) 
                : Number((targetTWD / priceInTWD).toFixed(2));
              
              setSharesInput(s.toString());
              setCalculatedTotalTWD(s * priceInTWD);
           }
        } else {
          setSharesInput('');
          setCalculatedTotalTWD(0);
        }
      } 
      else {
        // SELL Logic: Allocation Trimming Strategy
        // If I have 5% allocation, and want to sell 2%, I sell (2/5) of my shares.
        // Formula: Shares = CurrentShares * (Input% / CurrentAllocation%)
        
        const currentShares = initialAsset?.shares || 0;
        
        if (currentShares > 0 && pct > 0 && currentAssetAllocation > 0) {
           // Avoid division by zero
           const ratio = pct / currentAssetAllocation;
           
           // Cap ratio at 1 (cannot sell more than 100% of holdings)
           const effectiveRatio = Math.min(ratio, 1);
           
           const s = market === 'TW'
             ? Math.floor(currentShares * effectiveRatio)
             : Number((currentShares * effectiveRatio).toFixed(2));
             
           setSharesInput(s.toString());
           const priceInTWD = p * rate;
           setCalculatedTotalTWD(s * priceInTWD);
        } else if (currentShares > 0 && pct > 0 && currentAssetAllocation === 0) {
           // Fallback if allocation is 0 (shouldn't happen if shares > 0, but safe guard)
           // Treat as % of shares directly if allocation is missing
           const s = market === 'TW'
             ? Math.floor(currentShares * (pct / 100))
             : Number((currentShares * (pct / 100)).toFixed(2));
           setSharesInput(s.toString());
           const priceInTWD = p * rate;
           setCalculatedTotalTWD(s * priceInTWD);
        } else {
           setSharesInput('');
           setCalculatedTotalTWD(0);
        }
      }
    }

  }, [price, exchangeRate, sharesInput, percentInput, calcMode, categoryProjectedInvestment, market, action, initialAsset, currentAssetAllocation]);


  const handleAutoCalcTW = () => {
    if (market !== 'TW') return;
    const p = parseFloat(price) || 0;
    const s = parseFloat(sharesInput) || 0;
    const val = p * s;
    if (val <= 0) return;

    // TW Fee: 0.1425%, min 20
    let f = Math.floor(val * 0.001425);
    if (f < 20) f = 20;
    setFeeInput(f.toString());

    // TW Tax: 0.3% (Sell only)
    if (action === 'SELL') {
      const t = Math.floor(val * 0.003);
      setTaxInput(t.toString());
    } else {
      setTaxInput('0');
    }
  };

  const handleSubmit = () => {
    const rate = market === 'TW' ? 1 : parseFloat(exchangeRate);
    
    const p = parseFloat(price);
    const s = parseFloat(sharesInput);
    const fee = parseFloat(feeInput) || 0;
    const tax = parseFloat(taxInput) || 0;

    if (!symbol || !name || isNaN(p) || isNaN(s) || s <= 0 || isNaN(rate)) {
      alert("請填寫完整正確的資訊");
      return;
    }
    
    // Validation for Sell
    if (action === 'SELL' && initialAsset) {
      if (s > initialAsset.shares) {
         alert(`賣出股數 (${s}) 超過持有股數 (${initialAsset.shares})`);
         return;
      }
    }

    onExecuteOrder({
      assetId: initialAsset?.id,
      symbol: symbol.toUpperCase(),
      name,
      action,
      price: p,
      shares: s,
      exchangeRate: rate,
      fee,
      tax,
      totalAmount: p * s * rate // Gross TWD Value
    });
    onClose();
  };

  const SuggestionDropdown = ({ query, fieldName }: { query: string, fieldName: string }) => (
    <div className="absolute top-full left-0 w-[200%] z-50 bg-white shadow-xl rounded-lg border border-gray-200 mt-1 max-h-56 overflow-y-auto">
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
        <li 
          onMouseDown={(e) => {
            e.preventDefault();
            handleOnlineSearch(query);
          }}
          className="px-3 py-3 hover:bg-blue-50 cursor-pointer text-blue-600 flex items-center justify-center gap-2 font-bold border-t border-gray-200 sticky bottom-0 bg-gray-50"
        >
          {isSearchingOnline ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> 搜尋中...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" /> 
              線上搜尋 '{query}'
            </>
          )}
        </li>
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

  const subtotal = calculatedTotalTWD;
  const feeVal = parseFloat(feeInput) || 0;
  const taxVal = parseFloat(taxInput) || 0;
  
  let netCashImpact = 0;
  if (action === 'BUY') netCashImpact = subtotal + feeVal;
  else if (action === 'SELL') netCashImpact = subtotal - feeVal - taxVal;

  const isBuy = action === 'BUY';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`${bgColor} p-4 text-white flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2 font-bold text-lg">
             <Calculator className="w-5 h-5" /> 
             {initialAsset ? `交易: ${initialAsset.symbol}` : '新增委託單'}
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X className="w-6 h-6"/></button>
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
                   if(symbol && !isFetchingPrice && !showSuggestions) {
                       setTimeout(() => {
                           if (!showSuggestions && !activeSearchField) executePriceFetch(symbol);
                       }, 200);
                   }
                 }}
                 placeholder="2330"
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
                 placeholder="台積電" 
                 disabled={!!initialAsset}
                 className="w-full p-2 border rounded-lg bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
                 autoComplete="off"
               />
               {showSuggestions && activeSearchField === 'name' && (
                 <SuggestionDropdown query={name} fieldName="Name" />
               )}
             </div>
          </div>

          {/* Price & Rate */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                單價 ({market === 'TW' ? 'TWD' : 'USD'})
                <button 
                  onClick={() => executePriceFetch(symbol)} 
                  className={`ml-2 text-blue-600 hover:underline text-[10px] inline-flex items-center ${isFetchingPrice ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isFetchingPrice}
                >
                  <RefreshCw className={`w-3 h-3 mr-0.5 ${isFetchingPrice ? 'animate-spin' : ''}`}/>
                  查價
                </button>
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

          {/* Calc Mode */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setCalcMode('PERCENT')} className={`flex-1 py-1 text-xs rounded ${calcMode === 'PERCENT' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>輸入比例</button>
            <button onClick={() => setCalcMode('SHARES')} className={`flex-1 py-1 text-xs rounded ${calcMode === 'SHARES' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>輸入股數</button>
          </div>

          {/* Shares / Percent Input */}
          {calcMode === 'SHARES' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">交易股數</label>
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
                {isBuy ? '投入資金比例 (% of Category)' : '減碼比例 (% of Holdings)'}
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
                    計算基準: {isBuy 
                      ? `倉位總額 NT$${categoryProjectedInvestment.toLocaleString()}` 
                      : `當前資金占比 ${currentAssetAllocation.toFixed(2)}%`}
                  </span>
                  <span className="text-xs text-right text-gray-500">約 {sharesInput || 0} 股</span>
              </div>
            </div>
          )}

          {/* Fee & Tax */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-600">手續費與稅金 (TWD)</span>
              {market === 'TW' && (
                <button onClick={handleAutoCalcTW} className="text-[10px] bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded text-gray-700">自動試算</button>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400">手續費</label>
                <input 
                  type="number" 
                  value={feeInput} 
                  onChange={(e) => setFeeInput(e.target.value)} 
                  className="w-full p-1 text-sm border rounded text-right bg-white border-gray-300 focus:ring-1 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400">證交稅</label>
                <input 
                  type="number" 
                  value={taxInput} 
                  onChange={(e) => setTaxInput(e.target.value)} 
                  className="w-full p-1 text-sm border rounded text-right bg-white border-gray-300 focus:ring-1 focus:ring-blue-500 outline-none" 
                  disabled={action === 'BUY'} 
                />
              </div>
            </div>
          </div>

          {/* Total Summary */}
          <div className={`rounded-lg p-4 border ${borderColor} ${isBuy ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">成交總值 (TWD)</span>
              <span className="font-mono font-medium">{Math.round(subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-2">
               <span className="text-xs text-gray-500">費用總計</span>
               <span className="text-xs text-gray-500">{(feeVal + taxVal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-800">
                  {isBuy ? '預估扣款' : '預估入帳'}
              </span>
              <span className={`text-xl font-bold font-mono ${textColor}`}>
                NT$ {Math.round(netCashImpact).toLocaleString()}
              </span>
            </div>
            {isBuy && (
              <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                <span>剩餘現金</span>
                <span className={netCashImpact > categoryRemainingCash ? 'text-red-600 font-bold' : ''}>
                  NT$ {(categoryRemainingCash - netCashImpact).toLocaleString()}
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
