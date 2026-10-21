import { it, expect } from 'vitest';
import { readScenarios, saveScenario, deleteScenario, SCENARIOS_KEY } from '../src/storage.js';
import { emptyGraph } from '../src/graph.js';
function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};}
it('roundtrips named graphs and deletes one',()=>{const s=storage();saveScenario(s,' Demo ',emptyGraph(),false);expect(readScenarios(s)).toEqual([{name:'Demo',graph:emptyGraph()}]);deleteScenario(s,'Demo');expect(readScenarios(s)).toEqual([]);});
it('permits overwrite but blocks second free scenario',()=>{const s=storage();saveScenario(s,'One',emptyGraph(),false);saveScenario(s,'One',emptyGraph(),false);expect(()=>saveScenario(s,'Two',emptyGraph(),false)).toThrow('1 saved');saveScenario(s,'Two',emptyGraph(),true);expect(readScenarios(s)).toHaveLength(2);});
it('rejects empty names and corrupt data without overwriting',()=>{const s=storage();expect(()=>saveScenario(s,' ',emptyGraph(),false)).toThrow();s.setItem(SCENARIOS_KEY,'broken');expect(()=>readScenarios(s)).toThrow();expect(()=>saveScenario(s,'One',emptyGraph(),true)).toThrow();expect(s.getItem(SCENARIOS_KEY)).toBe('broken');});
