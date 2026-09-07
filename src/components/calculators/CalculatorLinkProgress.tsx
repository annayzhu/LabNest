"use client";
import {useLinkStatus} from 'next/link';
/** Fixed overlay leaves target geometry stable while an uncached route loads. */
export function CalculatorLinkProgress(){const {pending}=useLinkStatus();return <span aria-hidden="true" data-pending={pending} className="calculator-link-progress"/>;}
