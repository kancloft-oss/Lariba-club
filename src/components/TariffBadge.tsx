import React from 'react';
import { Tariff } from '../contexts/AuthContext';

interface TariffBadgeProps {
  tariff: Tariff;
  className?: string;
}

export function TariffBadge({ tariff, className = '' }: TariffBadgeProps) {
  if (tariff === 'Moneycan') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-brand-green/10 text-brand-green border border-brand-green/20 ${className}`}>
        (M) MONEYCAN
      </span>
    );
  }
  if (tariff === 'Lemoner') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-brand-blue/20 text-[#8a85ff] border border-brand-blue/30 ${className}`}>
        [L] LEMONER
      </span>
    );
  }
  if (tariff === 'Richer') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-brand-gold/10 text-brand-gold border border-brand-gold/20 ${className}`}>
        {'{R}'} RICHER
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 ${className}`}>
      NONE
    </span>
  );
}
