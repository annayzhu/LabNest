import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {writeFileSync} from 'node:fs';
import {taskLineIcons} from '../src/lib/calculators/task-line-icons';
// Build standalone fallbacks from the same components as the React application.
const svg=Object.fromEntries(Object.entries(taskLineIcons).map(([id,Icon])=>[id,renderToStaticMarkup(createElement(Icon,{width:32,height:32,strokeWidth:1.7,'aria-hidden':true}))]));
writeFileSync('src/lib/calculators/line-icon-svg.json',JSON.stringify(svg));
