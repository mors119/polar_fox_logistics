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
  'src/Dashboard.js',
  'src/InboundWorkflow.js',
  'src/PickingWorkflow.js',
].forEach((filePath) => {
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
});

function evaluate(expression, values = {}) {
  Object.assign(context, values);
  return vm.runInContext(expression, context);
}

test('피킹 담당자를 설정한 주문 건수마다 순환 배정한다', () => {
  const assignees = ['김서연', '박지훈'];
  assert.equal(
    evaluate('selectPickingAssignee_(__people, 1, 2)', { __people: assignees }),
    '김서연',
  );
  assert.equal(
    evaluate('selectPickingAssignee_(__people, 2, 2)', { __people: assignees }),
    '김서연',
  );
  assert.equal(
    evaluate('selectPickingAssignee_(__people, 3, 2)', { __people: assignees }),
    '박지훈',
  );
  assert.equal(
    evaluate('selectPickingAssignee_(__people, 5, 2)', { __people: assignees }),
    '김서연',
  );
});

test('피킹 확인값은 대소문자와 공백을 정규화한다', () => {
  assert.equal(evaluate("normalizePickingConfirmation_(' o ')"), 'O');
  assert.equal(evaluate("normalizePickingConfirmation_('x')"), 'X');
});

test('최신 피킹 표시 헤더를 사용한다', () => {
  assert.equal(evaluate('PICKING_HEADER_HEADERS[1]'), '카트 슬롯');
  assert.equal(evaluate('PICKING_HEADER_HEADERS[3]'), '수령인');
  assert.equal(evaluate('PICKING_LINE_HEADERS[0]'), '주문묶음');
  assert.equal(evaluate('PICKING_LINE_HEADERS[3]'), '상품코드');
  assert.equal(evaluate('PICKING_LINE_HEADERS[8]'), '현재재고');
  assert.equal(evaluate('PICKING_LINE_HEADERS[9]'), '출고후재고');
  assert.equal(evaluate('LATEST_COMPLETED_ORDER_HEADERS[1]'), '쇼핑몰번호');
  assert.equal(evaluate('LATEST_COMPLETED_ORDER_HEADERS[8]'), '주문상품명(기본)');
});

test('피킹은 같은 상품의 주문 수량을 합산해 재고를 확인한다', () => {
  const orderLines = [
    { record: { 상품품목코드: 'P-1', 수량: '2' } },
    { record: { 상품품목코드: 'P-1', 수량: '3' } },
  ];
  const productMap = { 'P-1': { record: { 가용재고: '5' } } };
  const plan = evaluate('buildPickingStockPlan_(__lines, __products)', {
    __lines: orderLines,
    __products: productMap,
  });
  assert.equal(plan.eligible, true);
  assert.equal(plan.stockByProduct['P-1'].requestedQuantity, 5);
  assert.equal(
    evaluate('buildPickingStockPlan_(__lines, __products, {"P-1": 4}).eligible', {
      __lines: orderLines,
      __products: productMap,
    }),
    false,
  );
});

test('이미지 URL은 피킹 작업용 썸네일 수식으로 만든다', () => {
  assert.equal(
    evaluate("buildPickingImageValue_('https://example.com/product.png')"),
    '=IMAGE("https://example.com/product.png",4,52,52)',
  );
});

test('대시보드 진행률 막대를 범위 안에서 만든다', () => {
  assert.equal(evaluate('buildDashboardProgressBar_(50, 10)'), '█████░░░░░');
  assert.equal(evaluate('buildDashboardProgressBar_(120, 4)'), '████');
  assert.equal(evaluate('buildDashboardProgressBar_(-1, 4)'), '░░░░');
});

test('담당자별 주문수는 1 이상 정수만 허용한다', () => {
  assert.equal(evaluate("parsePickingAssignmentUnit_('10')"), 10);
  assert.throws(() => evaluate("parsePickingAssignmentUnit_('0')"));
  assert.throws(() => evaluate("parsePickingAssignmentUnit_('1.5')"));
});

test('피킹 헤더 상태를 대시보드용으로 집계한다', () => {
  const counts = evaluate('countPickingStatuses_(__records)', {
    __records: [{ 상태: '대기' }, { 상태: '진행' }, { 상태: '완료' }, { 상태: '완료' }],
  });
  assert.equal(counts['대기'], 1);
  assert.equal(counts['진행'], 1);
  assert.equal(counts['완료'], 2);
  assert.equal(counts['예외'], 0);
});

test('취소 복구는 재고 반영 전·후와 수동 변경을 구분한다', () => {
  const recovery = {
    availableBefore: 5,
    pendingBefore: 2,
    availableAfter: 6,
    pendingAfter: 2,
  };
  assert.equal(
    evaluate('classifyPickingCancellationRecovery_(__current, __recovery)', {
      __current: { available: 5, pending: 2 },
      __recovery: recovery,
    }),
    'before',
  );
  assert.equal(
    evaluate('classifyPickingCancellationRecovery_(__current, __recovery)', {
      __current: { available: 6, pending: 2 },
      __recovery: recovery,
    }),
    'after',
  );
  assert.equal(
    evaluate('classifyPickingCancellationRecovery_(__current, __recovery)', {
      __current: { available: 4, pending: 2 },
      __recovery: recovery,
    }),
    'ambiguous',
  );
});
