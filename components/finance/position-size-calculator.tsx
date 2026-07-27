"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PositionSizeCalculator() {
  const [balance, setBalance] = useState("10000");
  const [riskPercent, setRiskPercent] = useState("1");
  const [stopLossPips, setStopLossPips] = useState("20");
  const [pipValue, setPipValue] = useState("10");

  const balanceNum = Number(balance);
  const riskPercentNum = Number(riskPercent);
  const stopLossPipsNum = Number(stopLossPips);
  const pipValueNum = Number(pipValue);

  const valid = [balanceNum, riskPercentNum, stopLossPipsNum, pipValueNum].every((n) => n > 0);
  const riskAmount = valid ? balanceNum * (riskPercentNum / 100) : 0;
  const lotSize = valid ? riskAmount / (stopLossPipsNum * pipValueNum) : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Position size &amp; risk calculator</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="calc-balance">Account balance</Label>
          <Input id="calc-balance" type="number" min="0" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-risk">Risk %</Label>
          <Input id="calc-risk" type="number" min="0" step="0.1" value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-sl">Stop loss (pips)</Label>
          <Input id="calc-sl" type="number" min="0" value={stopLossPips} onChange={(e) => setStopLossPips(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-pip">Pip value / lot ($)</Label>
          <Input id="calc-pip" type="number" min="0" step="0.1" value={pipValue} onChange={(e) => setPipValue(e.target.value)} />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Defaults assume ~$10/pip per standard lot (typical for USD-quoted pairs) — adjust for your pair/lot size.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Risk amount</p>
          <p className="font-mono text-lg text-brand">${riskAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Lot size</p>
          <p className="font-mono text-lg text-brand">{valid ? lotSize.toFixed(2) : "—"}</p>
        </div>
      </div>
    </div>
  );
}
