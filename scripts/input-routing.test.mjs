import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });

[
  'src/Config.js',
  'src/Order_Config.js',
  'src/CsvVaildation.js',
  'src/HistoryAndError.js',
  'src/Main.js',
].forEach((filePath) => {
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
});

function detect(headers) {
  context.__testHeaders = headers;
  return vm.runInContext('detectInputTypeFromHeaders_(__testHeaders)', context);
}

test('상품 필수 헤더를 상품 파일로 판별한다', () => {
  assert.equal(detect(['상품품목코드', '상품명', '가용재고']), 'product');
});

test('주문 필수 헤더를 주문 파일로 판별한다', () => {
  assert.equal(
    detect([
      '주문번호',
      '품목별 주문번호',
      '상품품목코드',
      '주문상품명',
      '수량',
      '수령인',
      '수령인 주소',
    ]),
    'order',
  );
});

test('알 수 없는 헤더 조합은 UNKNOWN_INPUT_TYPE 오류를 낸다', () => {
  assert.throws(
    () => detect(['코드', '수량']),
    (error) => error.code === 'UNKNOWN_INPUT_TYPE',
  );
});

test('주문과 상품 필수 헤더가 섞인 파일은 모호한 형식으로 거부한다', () => {
  assert.throws(
    () =>
      detect([
        '주문번호',
        '품목별 주문번호',
        '상품품목코드',
        '상품명',
        '주문상품명',
        '수량',
        '수령인',
        '수령인 주소',
      ]),
    (error) => error.code === 'AMBIGUOUS_INPUT_TYPE',
  );
});
