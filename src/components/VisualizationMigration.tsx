'use client';
import { useEffect,useState } from 'react';
import { legacyVisualizationKeys,legacyVisualizationExport } from '@/lib/visualization-link';
import { Button } from './ui/Button';
export function VisualizationMigration({url}:{url:string|null}) {
 const [state,setState]=useState<'checking'|'migration'|'unavailable'>('checking');
 const [error,setError]=useState('');
 useEffect(()=>{
  const timer=setTimeout(()=>{try{if(url&&new URL(url).href===window.location.href){setState('unavailable');setError('Studio 地址指向当前迁移页面，请配置独立服务地址。');return;}const hasState=legacyVisualizationKeys.some(key=>localStorage.getItem(key)!==null);if(hasState)setState('migration');else if(url)window.location.replace(url);else setState('unavailable');}catch{setState('unavailable');setError('无法读取此浏览器的旧偏好。请保留当前浏览器，并检查本地存储权限。');}},0);return()=>clearTimeout(timer);
 },[url]);
 const download=()=>{try{const values=Object.fromEntries(legacyVisualizationKeys.map(key=>[key,localStorage.getItem(key)]));const payload=legacyVisualizationExport(values);const blobUrl=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=blobUrl;link.download='labnest-visualization-preferences.json';link.click();setTimeout(()=>URL.revokeObjectURL(blobUrl),1000);}catch(error){setError(String(error));}};
 return <section className="mx-auto max-w-3xl space-y-4 p-4"><h1 className="text-2xl font-semibold">Visualization Studio</h1><p>Studio 已成为独立工具，图表、数据与项目均由 Studio 管理。</p>{state==='checking'?<p role="status">正在检查旧偏好…</p>:null}{state==='migration'?<><p>此浏览器保留了旧版配色偏好。先下载迁移文件，再在独立 Studio 中导入。旧版未持久保存原始表格或项目；已有 Config 文件可在 Studio 中恢复。</p><Button onClick={download}>下载旧配色迁移文件</Button><p className="text-sm text-muted">下载或打开工具不会清除旧数据。不同地址的浏览器存储不能自动共享。</p></>:null}{url?<a href={url} className="inline-flex rounded border border-hairline px-4 py-2 text-action" rel="noreferrer">打开独立 Studio</a>:<p role="alert">尚未配置独立 Studio 地址。请设置 VISUALIZATION_STUDIO_URL 为手机和电脑可访问的实际地址；本站不会默认跳往演示页面。</p>}{error?<p role="alert">{error}</p>:null}<p className="text-sm text-muted">如果目标无法访问，请确认独立服务正在运行，且设备处于可访问该地址的网络中。</p></section>;
}
