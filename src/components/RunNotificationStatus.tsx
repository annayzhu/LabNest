'use client';
import { useEffect, useState } from 'react';
/** Capability reporting is separate from timer execution. There is no Web Push scheduler here. */
export function RunNotificationStatus() {
 const [status,setStatus]=useState('Checking what reminders this device supports…');
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const installed=window.matchMedia('(display-mode: standalone)').matches;const permission='Notification' in window?Notification.permission:'unsupported';setStatus(`Running ${installed?'as a home screen app':'in a browser tab'}; notification permission ${({granted:'granted',denied:'denied',default:'not requested yet',unsupported:'not available here'} as const)[permission]}. This web version only alerts while the page is open; background Web Push is off. For lock-screen reminders use the installed, authorized watch app, and check it on a real device.`);});return()=>cancelAnimationFrame(frame);},[]);
 return <details className="rounded-[var(--ln-radius-control-lg)] border border-hairline p-3 text-sm"><summary className="min-h-11 cursor-pointer">Timer reminders on this device</summary><p>{status}</p><p className="mt-2 text-muted">A reminder does not complete the step. While offline, a timer cancelled or reset on another device may not withdraw this device’s reminder right away; check against the server once reconnected.</p></details>;
}
