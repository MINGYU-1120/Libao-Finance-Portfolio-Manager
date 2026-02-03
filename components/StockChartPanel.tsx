import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { checkIsOTC } from '../data/stockList';

interface StockChartPanelProps {
    symbol: string;
    market: 'TW' | 'US';
    height?: string;
}

declare global {
    interface Window {
        TradingView: any;
    }
}

const StockChartPanel: React.FC<StockChartPanelProps> = ({ symbol, market, height = "100%" }) => {
    const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(7)}`);

    // State to handle manual override of Exchange (TWSE vs TPEX)
    const [exchangePrefix, setExchangePrefix] = useState<string>('');

    useEffect(() => {
        if (market === 'TW') {
            // Initial Auto-Detection
            const isOTC = checkIsOTC(symbol);
            setExchangePrefix(isOTC ? 'TPEX' : 'TWSE');
        } else {
            setExchangePrefix('');
        }
    }, [symbol, market]);

    const toggleExchange = () => {
        setExchangePrefix(prev => prev === 'TWSE' ? 'TPEX' : 'TWSE');
    };

    useEffect(() => {
        if (!symbol) return;

        // Construct the symbol for TradingView
        let tvSymbol = symbol;
        if (market === 'TW' && !symbol.includes(':')) {
            tvSymbol = `${exchangePrefix}:${symbol}`;
        }

        const initWidget = () => {
            if (window.TradingView && document.getElementById(containerId.current)) {
                // Clear previous widget
                const container = document.getElementById(containerId.current);
                if (container) container.innerHTML = '';

                try {
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
                        allow_symbol_change: false, // Lock to current symbol
                        container_id: containerId.current,
                        hide_side_toolbar: true, // Hide drawing tools for cleaner embedded view
                        details: true,
                        studies: [
                            "MASimple@tv-basicstudies", // MA
                        ]
                    });
                } catch (e: any) {
                    console.error("TV Widget Error:", e);
                }
            }
        };

        if (window.TradingView) {
            initWidget();
        } else {
            // Check if script is already in head
            let script = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]') as HTMLScriptElement;
            if (!script) {
                script = document.createElement('script');
                script.src = 'https://s3.tradingview.com/tv.js';
                script.async = true;
                document.head.appendChild(script);
            }

            // Add listener
            const onScriptLoad = () => {
                initWidget();
            };

            // If already loaded but window.TradingView might be laggy? Usually onload fires once.
            // Better to attach listener anyway if not loaded.
            script.addEventListener('load', onScriptLoad);

            return () => {
                script.removeEventListener('load', onScriptLoad);
                const container = document.getElementById(containerId.current);
                if (container) container.innerHTML = '';
            }
        }
    }, [symbol, market, exchangePrefix]);

    return (
        <div className="w-full relative flex flex-col bg-white rounded-xl overflow-hidden shadow-inner border border-gray-200" style={{ height }}>
            {market === 'TW' && (
                <div className="absolute top-2 right-2 z-10 opacity-50 hover:opacity-100 transition-opacity">
                    <button
                        onClick={toggleExchange}
                        className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-500 px-2 py-1 rounded border border-gray-300 flex items-center gap-1"
                        title="切換上市/上櫃來源"
                    >
                        <RefreshCw className="w-3 h-3" />
                        {exchangePrefix}
                    </button>
                </div>
            )}
            <div id={containerId.current} className="w-full h-full" />
        </div>
    );
};

export default StockChartPanel;
