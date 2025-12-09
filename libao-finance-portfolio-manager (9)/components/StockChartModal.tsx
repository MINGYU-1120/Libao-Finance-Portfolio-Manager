
import React, { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { checkIsOTC } from '../data/stockList';

interface StockChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
  market: 'TW' | 'US';
}

declare global {
  interface Window {
    TradingView: any;
  }
}

const StockChartModal: React.FC<StockChartModalProps> = ({ isOpen, onClose, symbol, name, market }) => {
  const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(7)}`);
  
  // State to handle manual override of Exchange (TWSE vs TPEX)
  const [exchangePrefix, setExchangePrefix] = useState<string>('');

  useEffect(() => {
    if (isOpen && market === 'TW') {
      // Initial Auto-Detection
      const isOTC = checkIsOTC(symbol);
      setExchangePrefix(isOTC ? 'TPEX' : 'TWSE');
    } else {
      setExchangePrefix(''); // US doesn't strictly need a specific prefix usually
    }
  }, [isOpen, symbol, market]);

  const toggleExchange = () => {
    setExchangePrefix(prev => prev === 'TWSE' ? 'TPEX' : 'TWSE');
  };

  useEffect(() => {
    if (!isOpen || !symbol) return;

    // Construct the symbol for TradingView
    let tvSymbol = symbol;
    if (market === 'TW') {
      tvSymbol = `${exchangePrefix}:${symbol}`;
    } else {
      // For US, we can just use the symbol or add generic logic
      // Most big stocks work without prefix or with NASDAQ/NYSE
      tvSymbol = symbol; 
    }

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: 'D',
          timezone: 'Asia/Taipei',
          theme: 'light',
          style: '1', // 1 = Candles
          locale: 'zh_TW',
          toolbar_bg: '#f1f3f6',
          enable_publishing: false,
          allow_symbol_change: false, // Lock to current symbol to avoid confusion
          container_id: containerId.current,
          hide_side_toolbar: false,
          details: true,
          studies: [
            "MASimple@tv-basicstudies", // MA
            "RSI@tv-basicstudies"      // RSI
          ]
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup usually involves clearing the container innerHTML in React 
      // but TradingView widget replaces it. 
      // We rely on the container ref being stable or recreated.
      const container = document.getElementById(containerId.current);
      if (container) container.innerHTML = '';
    };
  }, [isOpen, symbol, market, exchangePrefix]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="text-yellow-400 font-mono text-xl">{symbol}</span>
              <span>{name}</span>
            </h3>
            
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                {market === 'TW' ? exchangePrefix : 'US Market'}
              </span>
              
              {/* Manual Toggle Button for TW Stocks */}
              {market === 'TW' && (
                <button 
                  onClick={toggleExchange}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                  title="切換上市/上櫃來源"
                >
                  <RefreshCw className="w-3 h-3" />
                  切換上市/上櫃
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Chart Container */}
        <div className="flex-1 bg-gray-100 relative">
          <div id={containerId.current} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

export default StockChartModal;
