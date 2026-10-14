'use client';
import { useEffect, useState } from 'react';
/** Capability reporting is separate from timer execution. There is no Web Push scheduler here. */
export function RunNotificationStatus() {
 const [status,setStatus]=useState('正在检查本设备提醒能力…');
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const installed=window.matchMedia('(display-mode: standalone)').matches;const permission='Notification' in window?Notification.permission:'unsupported';setStatus(`网页：${installed?'主屏幕应用':'浏览器页面'}；通知权限：${({granted:'已允许',denied:'已拒绝',default:'尚未申请',unsupported:'此环境不提供通知接口'} as const)[permission]}。本版网页仅提供前台到时提示，未启用后台 Web Push；锁屏提醒请使用已安装并授权的手表端，并另做真机验证。`);});return()=>cancelAnimationFrame(frame);},[]);
 return <details className="rounded-[var(--ln-radius-control-lg)] border border-hairline p-3 text-sm"><summary className="min-h-11 cursor-pointer">本设备的计时提醒能力</summary><p>{status}</p><p className="mt-2 text-muted">提醒不代表步骤完成。离线期间其他设备取消或重置的计时器无法保证立即撤销本机提醒，重连后以服务器状态核对。</p></details>;
}
