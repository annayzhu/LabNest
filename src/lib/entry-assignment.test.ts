import { expect, it } from "vitest";
import { entryAssignmentSchema } from "./entry-assignment";
const common={mutationId:"c3066f54-1b55-4ec8-9822-5d10c6a9a405",expectedTarget:null};
it("requires an experiment for result filing, while ideas can stay independent",()=>{
 expect(entryAssignmentSchema.safeParse({...common,type:"result",targetId:"result"}).success).toBe(false);
 expect(entryAssignmentSchema.safeParse({...common,type:"none"}).success).toBe(true);
});
it("cannot create and select two targets in one filing request",()=>{
 expect(entryAssignmentSchema.safeParse({...common,type:"experiment",targetId:"one",newTitle:"two"}).success).toBe(false);
});
