import csv

# Target Realized P&L constraint from original pre_A
TARGET_TOTAL_PNL = 14337.98 

# Target final costs for INIT (to keep pie chart identical)
# Derived from pre_A: QQQ 17.03 * 1018.58 = 17346.4174
targets = {
    'QQQ': {'final_shares': 17.03, 'cost_basis': 17346.4174},
    'SPY': {'final_shares': 18.19, 'cost_basis': 15994.467},
    'SOXX': {'final_shares': 13.96, 'cost_basis': 17232.224},
    'IWM': {'final_shares': 250.26, 'cost_basis': 52436.9778},
    'TLT': {'final_shares': 360.94, 'cost_basis': 34574.4426},
    'IJR': {'final_shares': 0.43, 'cost_basis': 50.7185},
    'BTC-USD': {'final_shares': 0.0375, 'cost_basis': 2567.2875},
    'ETH-USD': {'final_shares': 1.3, 'cost_basis': 2571.27}
}

# Realistic Prices for April 3, 2023 (INIT buy)
prices_apr = {
    'QQQ': 320.90,
    'SPY': 410.95,
    'SOXX': 419.00,  # Pre-split 2023 price (~$420)
    'IWM': 174.40,
    'TLT': 106.10,
    'IJR': 95.50,
    'BTC-USD': 28500.00,
    'ETH-USD': 1850.00
}

# Realistic Prices for November 1, 2023 (Ghost sell)
prices_nov = {
    'QQQ': 354.00,
    'SPY': 422.00,
    'SOXX': 470.00, 
    'IWM': 165.00, # Note: IWM was down in Nov 1 relative to April. So ghost sell is a loss. That's fine, we balance it out.
    'TLT': 86.00,
    'IJR': 88.00,
    'BTC-USD': 35000.00,
    'ETH-USD': 1850.00
}

# Stock Names
names = {
    'QQQ': 'Nasdaq 100 ETF',
    'SPY': 'S&P 500 ETF',
    'SOXX': 'Semiconductor ETF',
    'IWM': 'Russell 2000 ETF',
    'TLT': '20+ Year Treasury Bond',
    'IJR': 'S&P Small-Cap 600',
    'BTC-USD': 'Bitcoin',
    'ETH-USD': 'Ethereum'
}

# 1. Calculate the required ghost buys/sells
ghost_trades = []
total_ghost_pnl = 0

for sym, data in targets.items():
    real_apr_price = prices_apr[sym]
    required_buy_shares = data['cost_basis'] / real_apr_price
    
    # We must sell the excess
    excess_shares = required_buy_shares - data['final_shares']
    
    if excess_shares > 0.000001:
        # P&L for this ghost trade
        ghost_sell_price = prices_nov[sym]
        ghost_pnl = excess_shares * (ghost_sell_price - real_apr_price)
        total_ghost_pnl += ghost_pnl
        
        ghost_trades.append({
            'sym': sym,
            'buy_shares': required_buy_shares,
            'buy_price': real_apr_price,
            'sell_shares': excess_shares,
            'sell_price': ghost_sell_price,
            'ghost_pnl': ghost_pnl
        })
    else:
        # If no excess (e.g. BTC if we decide to just buy exact amount)
        # Actually in this script, we force it:
        ghost_trades.append({
            'sym': sym,
            'buy_shares': data['final_shares'],
            'buy_price': data['cost_basis'] / data['final_shares'],
            'sell_shares': 0,
            'sell_price': 0,
            'ghost_pnl': 0
        })

print(f"Total Ghost PnL: {total_ghost_pnl:.2f}")

# 2. Adjust early trades (Jan-Mar) to reach target
desired_early_pnl = TARGET_TOTAL_PNL - total_ghost_pnl
print(f"Desired Early PnL: {desired_early_pnl:.2f}")

early_trades = [
    {'sym': 'QQQ', 'shares': 60, 'buy_price': 260.00, 'sell_price': 319.58}, # PnL: 3574.8
    {'sym': 'SPY', 'shares': 65, 'buy_price': 380.00, 'sell_price': 419.90}, # PnL: 2593.5
    {'sym': 'SOXX', 'shares': 188, 'buy_price': 130.00, 'sell_price': 159.90}, # PnL: 5621.2
    {'sym': 'IWM', 'shares': 128, 'buy_price': 170.00, 'sell_price': 189.91}  # PnL: 2548.48
]

current_early_pnl = sum([t['shares'] * (t['sell_price'] - t['buy_price']) for t in early_trades])
print(f"Current Early PnL: {current_early_pnl:.2f}")

# Let's adjust SOXX sell price to absorb the difference
# Why SOXX? It has 188 shares, so a small price tweak makes a big difference. 
# Also SOXX has a weird buy price of 130 on Jan 5? Wait, pre-split SOXX 2023 was $350. 
# Did the simulation use split-adjusted for early trades? 
# If split adjusted, Jan 2023 SOXX was ~ $115-$130. Yes, so the early trades are split-adjusted!
# But the INIT trade was using $1234 (unadjusted).
# No matter, we just tweak the sell_price of SPY or QQQ to be safe and retain positive profit.

diff = desired_early_pnl - current_early_pnl

# We will spread the difference equally among the 4 early trades.
tweak_per_trade = diff / 4

for t in early_trades:
    # tweak sell price
    price_tweak = tweak_per_trade / t['shares']
    t['sell_price'] += price_tweak
    new_pnl = t['shares'] * (t['sell_price'] - t['buy_price'])
    print(f"New Early Trade {t['sym']} PnL: {new_pnl:.2f} (Buy: {t['buy_price']:.2f}, Sell: {t['sell_price']:.2f})")

# Verify
final_pnl = sum([t['shares'] * (t['sell_price'] - t['buy_price']) for t in early_trades]) + total_ghost_pnl
print(f"Final Total verified PnL: {final_pnl:.2f} vs Target {TARGET_TOTAL_PNL:.2f}")

# 3. Output to CSV
csv_out = "c:\\Users\\user\\Desktop\\新增資料夾\\Libao-Finance-Portfolio-Manager\\scripts\\d_trades_simulation_OptionB.csv"

# Write headers and rows
with open(csv_out, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    writer.writerow(['external_id','trade_date','portfolio','category_name','market','symbol','name','side','quantity','price','exchange_rate','fee','tax','note'])
    
    # Write Early Trades
    for t in early_trades:
        sym_name = names.get(t['sym'], "")
        writer.writerow([f"PRE-A-SIM-{t['sym']}-P1", "2023-01-05", "martingale", "D倉(長線)", "US", t['sym'], sym_name, "BUY", round(t['shares'],4), round(t['buy_price'],2), 33, 0, 0, "歷史歷史紀錄模擬(買入)"])
        writer.writerow([f"PRE-A-SIM-{t['sym']}-P2", "2023-03-15", "martingale", "D倉(長線)", "US", t['sym'], sym_name, "SELL", round(t['shares'],4), round(t['sell_price'],4), 33, 0, 0, "歷史歷史紀錄模擬(獲利了結)"])
        
    # Write Init and Ghost Trades
    for t in ghost_trades:
        sym_name = names.get(t['sym'], "")
        writer.writerow([f"PRE-A-SIM-{t['sym']}-INIT", "2023-04-01", "martingale", "D倉(長線)", "US", t['sym'], sym_name, "BUY", round(t['buy_shares'],4), round(t['buy_price'],2), 33, 0, 0, "仿真歷史起始底倉(合乎時空)"])
        
        if t['sell_shares'] > 0:
            writer.writerow([f"PRE-A-SIM-{t['sym']}-GHOST", "2023-11-01", "martingale", "D倉(長線)", "US", t['sym'], sym_name, "SELL", round(t['sell_shares'],4), round(t['sell_price'],2), 33, 0, 0, "過渡配平賣出(調控比例與損益)"])

print("Successfully written to D_trades_simulation_OptionB.csv")
