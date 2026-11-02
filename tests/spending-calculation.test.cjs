const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(`${__dirname}/../app.js`, 'utf8');
const functions = app.slice(app.indexOf('function spendingBreakdown('), app.indexOf('function renderSpendingCalculation('));
const context = vm.createContext({
  num: x => Number.isFinite(Number(x)) ? Math.round(Number(x) * 100) / 100 : 0,
  money: n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  escapeHtml: x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  expenseLabel: e => e.category || 'Spending',
});
vm.runInContext(functions, context);
const month = { id: '2026-11', label: 'November 2026', spending: 1336.71, cashOffset: 50 };
const expense = { type: 'Spending', month: month.id, original: 1500, modifier: .95, final: 1425, comment: 'Example expense', createdAt: '2026-10-31T12:00:00Z' };
const source = { entries: [expense, {...expense, type:'Groceries', final:900}, {...expense, month:'2026-10', final:800}], extraIncome: [{month:month.id, amount:88.29, category:'Refund', description:'Example income', createdAt:'2026-11-01T12:00:00Z'}] };
test('uses assigned month, final amounts and only Spending; subtracts extra income once', () => {
  const before = JSON.stringify(source);
  const result = context.spendingBreakdown(month, source);
  assert.equal(result.expenseCents,142500);
  assert.equal(result.incomeCents,8829);
  assert.equal(result.recordedCents,133671);
  assert.equal(result.differenceCents,0);
  assert.equal(result.expenses.length,1);
  assert.equal(JSON.stringify(source),before);
});
test('flags either sign of discrepancy, including missing imported history', () => {
  assert.equal(context.spendingBreakdown({...month,spending:1400},source).differenceCents,6329);
  assert.equal(context.spendingBreakdown({...month,spending:1300},source).differenceCents,-3671);
  assert.equal(context.spendingBreakdown(month,{entries:[],extraIncome:[]}).differenceCents,133671);
});
test('adds cents exactly and handles zero and negative totals', () => {
  const input = {entries:[{...expense,final:.1},{...expense,final:.2}],extraIncome:[]};
  assert.equal(context.spendingBreakdown({...month,spending:.3},input).differenceCents,0);
  assert.equal(context.spendingBreakdown({...month,spending:0},{entries:[],extraIncome:[]}).differenceCents,0);
  assert.equal(context.spendingBreakdown({...month,spending:-88.29},{entries:[],extraIncome:source.extraIncome}).differenceCents,0);
});
test('renders equation, modifier, escaped descriptions and separate legacy cash offset', () => {
  const html = context.spendingCalculationHtml(month,source);
  assert.match(html,/1,425.00 − 88.29 = <b>1,336.71<\/b>/);
  assert.match(html,/1,500.00 × 0.95 = 1,425.00/);
  assert.match(html,/Legacy cash offset: 50.00/);
  assert.match(html,/not deducted from this Spending figure/);
  const unsafe = {entries:[{...expense, comment:'<img src=x onerror=alert(1)>'}],extraIncome:[]};
  assert.doesNotMatch(context.spendingCalculationHtml(month,unsafe),/<img/);
  assert.match(context.spendingCalculationHtml(month,unsafe),/Unexplained difference/);
});
