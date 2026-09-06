import {build} from 'esbuild';
// Generated artifact: standalone plate calls the same checked domain implementation.
await build({entryPoints:['src/lib/calculators/standalone.ts'],bundle:true,format:'iife',globalName:'LabNestCalculations',platform:'browser',target:'es2022',outfile:'public/tools/free-plate-layout/calculator-engine.js',legalComments:'none'});
