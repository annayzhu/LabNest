/** A unit select states what the typed number means. It never rescales the number,
 * so value-then-unit and unit-then-value give the same calculation. */
export function chooseUnit<T extends object>(record:T,unitKey:string,unit:string):T {
 return {...record,[unitKey]:unit};
}
