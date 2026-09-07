import {afterEach,expect,it,vi} from 'vitest';
import {offlineStatus,OfflineError,clearOfflineTools} from './offline';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('reports unsupported environments separately from registration failures',async()=>{vi.stubGlobal('location',{protocol:'http:'});vi.stubGlobal('window',{isSecureContext:false});await expect(offlineStatus()).rejects.toMatchObject({kind:'environment'});vi.stubGlobal('window',{isSecureContext:true});vi.stubGlobal('navigator',{serviceWorker:{register:async()=>{throw Error('scope');}}});await expect(offlineStatus()).rejects.toMatchObject({kind:'registration'});});
it('activation timeout removes its event listener and returns a retryable error',async()=>{vi.useFakeTimers();const remove=vi.fn(),worker={state:'installing',addEventListener:vi.fn(),removeEventListener:remove};vi.stubGlobal('window',{isSecureContext:true});vi.stubGlobal('navigator',{serviceWorker:{register:async()=>({installing:worker})}});const result=offlineStatus().catch(error=>error);await vi.advanceTimersByTimeAsync(15000);expect(await result).toBeInstanceOf(OfflineError);expect((await result).kind).toBe('timeout');expect(remove).toHaveBeenCalledWith('statechange',expect.any(Function));});

it('rejects a negative clear acknowledgement instead of reporting deletion success',async()=>{
 vi.stubGlobal('window',{isSecureContext:true});
 vi.stubGlobal('MessageChannel',class {port1={onmessage:null as null|((event:{data:unknown})=>void),close:vi.fn()};port2={close:vi.fn(),deliver:(data:unknown)=>this.port1.onmessage?.({data})};});
 vi.stubGlobal('navigator',{serviceWorker:{register:async()=>({active:{state:'activated',postMessage:(_data:unknown,ports:{deliver:(data:unknown)=>void}[])=>ports[0].deliver({ok:false,kind:'quota',detail:'denied'})}})}});
 await expect(clearOfflineTools()).rejects.toMatchObject({kind:'quota'});
});
