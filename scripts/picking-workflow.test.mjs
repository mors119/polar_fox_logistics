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
