import { describe,it,expect } from 'vitest';
import { visualizationStudioUrl,legacyVisualizationExport } from './visualization-link';
describe('independent Studio integration',()=>{
 it('keeps root and sub-path URLs without adding data or credentials',()=>{expect(visualizationStudioUrl('https://lab.example/studio/')).toBe('https://lab.example/studio/');expect(visualizationStudioUrl(undefined)).toBeNull();for(const value of ['javascript:alert(1)','https://user:secret@lab.example/','https://lab.example/?token=1','/tools/visualization'])expect(visualizationStudioUrl(value)).toBeNull();});
 it('exports legacy preferences without mutating or inventing project data',()=>{const values={'labnest:visualization-studio:palette':'{"themeId":"cn-beihai"}','labnest:visualization-studio:custom-palettes':'[]'};const result=legacyVisualizationExport(values);expect(result.preferences['labnest:visualization-studio:palette']).toEqual({themeId:'cn-beihai'});expect(values['labnest:visualization-studio:custom-palettes']).toBe('[]');expect(result).not.toHaveProperty('data');});
});
