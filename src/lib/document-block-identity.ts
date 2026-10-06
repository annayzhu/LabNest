/** Split/pasted blocks may inherit one legacy ID. Preserve the first and assign stable position identities. */
export function distinctDocumentBlockIds<T extends {id:string}>(blocks:T[]):T[] {
 const reserved = new Set(blocks.map(block=>block.id)), seen = new Set<string>();
 return blocks.map(block=>{if(!seen.has(block.id)){seen.add(block.id);return block;}let suffix=2;while(reserved.has(`${block.id}-part-${suffix}`)||seen.has(`${block.id}-part-${suffix}`))suffix++;const id=`${block.id}-part-${suffix}`;seen.add(id);return {...block,id};});
}
