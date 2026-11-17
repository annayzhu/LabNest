import {it,expect} from 'vitest';
import {parseAppearance,appearanceDefaults,appearanceBootstrap} from './appearance';
import {systemThemes,resolvedThemeTokens} from './system-theme';
function luminance(hex:string){const rgb=hex.replace('#','').match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function ratio(a:string,b:string){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05);}
it('U13 legacy migration, future/unknown values retained with controlled fallback',()=>{const legacy=systemThemes.at(-1)!.id;expect(parseAppearance(null,legacy,'comfortable',true).value).toMatchObject({colorSchemeId:legacy,iconPackId:'classic-line'});expect(parseAppearance(null,null,null,false).value.iconPackId).toBe('lab-soft');for(const value of [{...appearanceDefaults,iconPackId:'bad'},{...appearanceDefaults,extra:'retain'},{...appearanceDefaults,constructor:'retain'},{...appearanceDefaults,schemaVersion:5}]){const raw=JSON.stringify(value);expect(parseAppearance(raw,null,null,false).preserve).toBe(true);expect(raw).toBe(JSON.stringify(value));}expect(appearanceBootstrap()).not.toContain('innerHTML');});
for(const theme of systemThemes)for(const mode of ['light','dark'] as const)it(`U16 ${theme.id} ${mode} WCAG semantic contrast`,()=>{const t=resolvedThemeTokens(theme.id,mode);for(const [fg,bg,min] of [['--ink','--surface',4.5],['--graphite','--paper',4.5],['--muted','--surface',4.5],['--moss','--surface',4.5],['--warm','--moss',4.5],['--warning','--warning-surface',4.5],['--ai-fg','--ai',4.5],['--ai-fg','--ai-hover',4.5],['--control-border','--surface',3],['--control-border','--paper',3],['--moss','--paper',3]] as const)expect(ratio(t[fg],t[bg]),`${fg}/${bg}`).toBeGreaterThanOrEqual(min);});
it('existing v1 preference gains independent standard density without protection or changing scale',()=>{const old={...appearanceDefaults,uiScaleId:'comfortable'} as Record<string,unknown>;delete old.densityId;const r=parseAppearance(JSON.stringify(old),null,null,true);expect(r.preserve).toBe(false);expect(r.value).toMatchObject({densityId:'standard',uiScaleId:'comfortable'});expect(parseAppearance(JSON.stringify({...old,densityId:'invalid'}),null,null,true).preserve).toBe(true);});
for(const theme of systemThemes)for(const mode of ['light','dark'] as const)it(`${theme.id} ${mode} distinguish AI/success/warning/error colors`,()=>{const t=resolvedThemeTokens(theme.id,mode);expect(t['--ai-hover']).not.toBe(t['--ai']);expect(new Set([t['--ai'],t['--success-surface'],t['--warning-surface'],t['--error-surface']]).size).toBe(4);for(const name of ['success','error'])expect(ratio(t['--'+name],t['--'+name+'-surface'])).toBeGreaterThanOrEqual(4.5);});
it('Q481 light purple is the default; an automatically saved moon-dai follows it until a style is picked',()=>{
 expect(appearanceDefaults.colorSchemeId).toBe('lilac-mist');
 const saved=JSON.stringify({...appearanceDefaults,colorSchemeId:'moon-dai'});
 expect(parseAppearance(saved,null,null,true,false).value.colorSchemeId).toBe('lilac-mist');
 expect(parseAppearance(saved,null,null,true,true).value.colorSchemeId).toBe('moon-dai');
 expect(parseAppearance(saved,'moon-dai',null,true,false).value.colorSchemeId).toBe('moon-dai');
 const other=JSON.stringify({...appearanceDefaults,colorSchemeId:'azure-coral'});
 expect(parseAppearance(other,null,null,true,false).value.colorSchemeId).toBe('azure-coral');
 expect(appearanceBootstrap()).toContain('labnest.system-theme-chosen');
});
