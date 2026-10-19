'use client';

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalculatorCatalog } from '@/components/calculators/CalculatorCatalog';
import { CalculatorWorkbench } from '@/components/calculators/CalculatorWorkspace';
import { I18nProvider } from '@/components/I18nProvider';
import { ModalDialogProvider } from '@/components/ui/ModalDialogProvider';
import { getCalculatorCatalog } from '@/lib/calculators/calculator-engine';

/**
 * The 实验计算器 as one offline file: the same catalog and calculators as LabNest, routed by the URL hash
 * ("#/dilution?…") because a file opened from disk has no server to route it.
 */
function OfflineCalculator() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const changed = () => { setHash(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const [id = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const known = getCalculatorCatalog().some(tool => tool.id === id);
  return <main className="mx-auto min-h-screen max-w-[1480px] bg-paper px-4 py-4 md:px-5 md:py-5">
    {known ? <CalculatorWorkbench key={hash} calculatorId={id} initialInputs={Object.fromEntries(new URLSearchParams(query))} /> : <CalculatorCatalog />}
  </main>;
}

createRoot(document.getElementById('root')!).render(<I18nProvider initialLocale="zh"><ModalDialogProvider><OfflineCalculator /></ModalDialogProvider></I18nProvider>);
