import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console, Date });

[
  'src/Config.js',
  'src/Order_Config.js',
  'src/Order_SheetRepository.js',
  'src/InventoryService.js',
  'src/Order_Validator.js',
].forEach((filePath) => {
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
});

function evaluate(expression, values = {}) {
  Object.assign(context, values);
  return vm.runInContext(expression, context);
}

test('출고후잔량으로 품절과 안전재고 부족을 구분한다', () => {
  assert.equal(evaluate('calculateInventoryStatus_(10, 10, 3)'), '품절');
  assert.equal(evaluate('calculateInventoryStatus_(10, 8, 3)'), '안전재고 부족');
  assert.equal(evaluate('calculateInventoryStatus_(10, 4, 3)'), '정상');
});

test('이전 모델의 예약 차감분을 실물 재고에 한 번만 복원한다', () => {
  assert.equal(evaluate('calculateMigratedAvailableStock_(38, 12)'), 50);
});

test('주문 가능 수량은 가용재고에서 이미 예약된 발송대기를 뺀 값이다', () => {
  const stock = evaluate(
    "buildProductStockMap_([{ '상품품목코드': 'P-1', '가용재고': '50', '발송대기': '12' }])['P-1']",
  );

  assert.equal(stock.availableStock, 50);
  assert.equal(stock.pendingStock, 12);
  assert.equal(stock.remainingStock, 38);
});

test('같은 상품의 주문 수량을 합산한다', () => {
  const quantityMap = evaluate('buildRequestedQuantityMap_(__rows)', {
    __rows: [
      { 상품품목코드: 'P-1', 수량: '2' },
      { 상품품목코드: 'P-1', 수량: '3' },
      { 상품품목코드: 'P-2', 수량: '1' },
    ],
  });

  assert.equal(quantityMap['P-1'], 5);
  assert.equal(quantityMap['P-2'], 1);
});

test('재고이력에 가용재고와 발송대기 변화를 따로 남긴다', () => {
  const row = evaluate('buildInventoryHistoryRow_(__change)', {
    __change: {
      timestamp: '2026-08-14',
      type: '주문예약',
      productCode: 'P-1',
      availableDelta: 0,
      pendingDelta: 4,
      availableAfter: 20,
      pendingAfter: 7,
      orderNumber: 'O-1',
    },
  });

  assert.equal(row[1], '주문예약');
  assert.equal(row[5], 0);
  assert.equal(row[6], 4);
  assert.equal(row[7], 20);
  assert.equal(row[8], 7);
  assert.equal(row[9], 'O-1');
});
