import React from 'react';
import { Tariff } from '../contexts/AuthContext';

interface TariffBadgeProps {
  tariff: Tariff;
  className?: string;
}

export function TariffBadge({ tariff, className = '' }: TariffBadgeProps) {
  if (tariff === 'Moneycan') {
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-bold bg-[#e6fcf2] text-[#189370] border border-[#189370]/20 ${className}`}>
        (M) MONEYCAN
      </span>
    );
  }
  if (tariff === 'Lemoner') {
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-bold bg-[#fff9db] text-[#b07d00] border border-[#b07d00]/20 ${className}`}>
        [L] LEMONER
      </span>
    );
  }
  if (tariff === 'Richer') {
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-bold bg-[#f3f0ff] text-[#7950f2] border border-[#7950f2]/20 ${className}`}>
        {'{R}'} RICHER
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 ${className}`}>
      NONE
    </span>
  );
}
