const MARCH_31 = new Date('2026-03-31');

export function getCall(holding, ltp) {
  if (holding.marchSell) {
    if (new Date() >= MARCH_31) {
      return { label: 'SELL NOW', cls: 'call-sell', note: 'Mar 31 deadline!' };
    }
    const bounceTarget = holding.marchSellBaseLTP * 1.05;
    if (ltp >= bounceTarget) {
      return { label: 'SELL', cls: 'call-sell', note: '+5% bounce hit!' };
    }
    const gapPct = (((bounceTarget - ltp) / ltp) * 100).toFixed(1);
    return { label: 'HOLD', cls: 'call-hold', note: `${gapPct}% to bounce target` };
  }

  if (holding.exitCandidate) {
    if (ltp >= holding.avg * 0.92) {
      return { label: 'EXIT', cls: 'call-exit', note: 'Cut loss now' };
    }
    return { label: 'HOLD', cls: 'call-hold', note: 'Wait for bounce' };
  }

  const targetPrice = holding.avg * (1 + holding.targetPct / 100);
  if (ltp >= targetPrice) {
    return { label: 'SELL', cls: 'call-sell', note: 'Target hit!' };
  }
  if (ltp >= holding.avg) {
    return { label: 'HOLD', cls: 'call-hold', note: 'In profit' };
  }
  return { label: 'WAIT', cls: 'call-wait', note: 'Recovering' };
}
