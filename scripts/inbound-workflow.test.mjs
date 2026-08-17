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
].forEach((filePath) => {
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
});

function evaluate(expression, values = {}) {
  Object.assign(context, values);
  return vm.runInContext(expression, context);
}

test('상품 등록은 필수값과 음수 재고를 거부한다', () => {
  const errors = evaluate('validateProductRegistrationRecord_(__record)', {
    __record: { 상품품목코드: '', 상품명: '', 안전재고: '-1' },
  });

  assert.equal(errors.length, 3);
});

test('입고 정보가 모두 비어 있으면 작성 중으로 유지한다', () => {
  const result = evaluate('validateInboundRecord_(__record)', { __record: {} });

  assert.equal(result.waiting, true);
  assert.equal(result.errors.length, 0);
});

test('입고 부족과 초과 수량을 자동 계산한다', () => {
  const shortage = evaluate('validateInboundRecord_(__record)', {
    __record: {
      실제입고일: '2026-08-16',
      입고예정수량: 100,
      실제입고수량: 98,
      정상수량: 96,
      불량수량: 2,
    },
  });
  const overage = evaluate('validateInboundRecord_(__record)', {
    __record: {
      실제입고일: '2026/08/16',
      입고예정수량: 10,
      실제입고수량: 12,
      정상수량: 11,
      불량수량: 1,
    },
  });

  assert.equal(shortage.errors.length, 0);
  assert.equal(shortage.shortage, 2);
  assert.equal(shortage.overage, 0);
  assert.equal(overage.shortage, 0);
  assert.equal(overage.overage, 2);
});

test('실제입고수량과 정상·불량 합계가 다르면 거부한다', () => {
  const result = evaluate('validateInboundRecord_(__record)', {
    __record: {
      실제입고일: '2026-08-16',
      입고예정수량: 10,
      실제입고수량: 10,
      정상수량: 9,
      불량수량: 2,
    },
  });

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /정상수량 \+ 불량수량/);
});

test('실제 달력에 없는 날짜를 거부한다', () => {
  assert.equal(evaluate("isValidWorkflowDate_('2026-02-29')"), false);
  assert.equal(evaluate("isValidWorkflowDate_('2028-02-29')"), true);
});

test('중단 복구는 반영 전·후와 수동 변경 상태를 구분한다', () => {
  const recovery = {
    availableBefore: 10,
    defectiveBefore: 1,
    availableAfter: 18,
    defectiveAfter: 3,
  };

  assert.equal(
    evaluate('classifyInboundRecovery_(__snapshot, __recovery)', {
      __snapshot: { availableBefore: 10, defectiveBefore: 1 },
      __recovery: recovery,
    }),
    'before',
  );
  assert.equal(
    evaluate('classifyInboundRecovery_(__snapshot, __recovery)', {
      __snapshot: { availableBefore: 18, defectiveBefore: 3 },
      __recovery: recovery,
    }),
    'after',
  );
  assert.equal(
    evaluate('classifyInboundRecovery_(__snapshot, __recovery)', {
      __snapshot: { availableBefore: 14, defectiveBefore: 1 },
      __recovery: recovery,
    }),
    'ambiguous',
  );
});
