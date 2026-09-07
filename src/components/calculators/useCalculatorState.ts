"use client";
import {useEffect,useState,useRef} from "react";
import {loadCalculatorState,saveCalculatorState,retryCalculatorStorage,getCalculatorStorageIssue,type CalculatorState} from "@/lib/calculators/calculator-storage";
export function useCalculatorState() {
  const [state, setState] = useState<CalculatorState | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState("");
  const pending=useRef<CalculatorState|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{const flush=()=>{clearTimeout(timer.current);if(pending.current){saveCalculatorState(pending.current);pending.current=null;}};window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);flush();};},[]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setState(loadCalculatorState());
      setPersistenceWarning(getCalculatorStorageIssue());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const update = (next: CalculatorState, delay=0) => {
    setState(next);pending.current=next;clearTimeout(timer.current);
    const persist=()=>{saveCalculatorState(next);pending.current=null;setPersistenceWarning(getCalculatorStorageIssue());};
    if(delay)timer.current=setTimeout(persist,delay);else persist();
  };
  const retry=()=>{clearTimeout(timer.current);pending.current=null;setState(retryCalculatorStorage());setPersistenceWarning(getCalculatorStorageIssue());};
  return { state, update, persistenceWarning, retry };
}
