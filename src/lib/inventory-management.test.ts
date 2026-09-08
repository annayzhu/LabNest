import {describe,it,expect} from 'vitest';
import {getInventoryRiskFlags} from './inventory';

describe('Inventory quantity visibility',()=>{
 it('does not report unknown quantity as depleted, but still warns about expiry',()=>{
  expect(getInventoryRiskFlags({currentQuantity:0,quantityRecorded:false,expiryDate:'2020-01-01'},new Date('2026-09-08T12:00:00Z'))).toEqual(['expired']);
  expect(getInventoryRiskFlags({currentQuantity:0,quantityRecorded:true})).toEqual(['depleted']);
 });
});
