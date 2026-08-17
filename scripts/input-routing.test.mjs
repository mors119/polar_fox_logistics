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
  'src/Order_CsvParser.js',
  'src/Order_Validator.js',
].forEach((filePath) => {
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
});

function detect(headers) {
  context.__testHeaders = headers;
  return vm.runInContext('detectInputTypeFromHeaders_(__testHeaders)', context);
}

test('성공 폴더 이름과 Script Property 키를 고정한다', () => {
  assert.equal(vm.runInContext('CONFIG.folders.success', context), 'success');
  assert.equal(vm.runInContext('CONFIG.properties.successFolderId', context), 'SUCCESS_FOLDER_ID');
});

test('처리 파일을 대상 폴더에 추가하고 기존 부모 폴더에서 제거한다', () => {
  const removedFrom = [];
  let addedFile = null;
  const targetFolder = {
    getId: () => 'success-folder',
    addFile: (file) => {
      addedFile = file;
    },
  };
  const inputFolder = {
    getId: () => 'input-folder',
    removeFile: () => removedFrom.push('input-folder'),
  };
  const existingTargetParent = {
    getId: () => 'success-folder',
    removeFile: () => removedFrom.push('success-folder'),
  };
  const parents = [inputFolder, existingTargetParent];
  const file = {
    getParents: () => ({
      hasNext: () => parents.length > 0,
      next: () => parents.shift(),
    }),
  };

  context.__testFile = file;
  context.__testTargetFolder = targetFolder;
  vm.runInContext('moveFileToFolder_(__testFile, __testTargetFolder)', context);

  assert.equal(addedFile, file);
  assert.deepEqual(removedFrom, ['input-folder']);
});

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

test('최신 주문 내보내기 헤더를 주문 파일로 판별한다', () => {
  assert.equal(
    detect([
      '쇼핑몰번호',
      '주문번호',
      '품목별 주문번호',
      '상품품목코드',
      '주문상품명(기본)',
      '수량',
      '수령인',
      '수령인 주소(전체)',
    ]),
    'order',
  );
  assert.equal(
    vm.runInContext("normalizeOrderImportHeader_('총 주문금액(KRW)')", context),
    '총주문금액',
  );
  assert.equal(vm.runInContext("normalizeOrderImportHeader_('배송메시지')", context), '배송메세지');

  context.__latestOrderTable = [
    [
      '쇼핑몰번호',
      '주문번호',
      '품목별 주문번호',
      '상품품목코드',
      '주문상품명(기본)',
      '수량',
      '수령인',
      '수령인 주소(전체)',
    ],
    ['1', '20260804-1', '20260804-1-01', 'P0001', '테스트 상품', '1', '수령인', '서울'],
  ];
  const parsed = vm.runInContext('parseOrderCsv(null, __latestOrderTable)', context);
  context.__parsedLatestOrder = parsed;
  assert.doesNotThrow(() => vm.runInContext('validateCsv(__parsedLatestOrder)', context));
  assert.equal(parsed.rows[0]['주문상품명'], '테스트 상품');
  assert.equal(parsed.rows[0]['수령인 주소'], '서울');
});

test('카페24 재고 헤더를 상품 파일로 판별한다', () => {
  assert.equal(detect(['상품코드', '상품명', '품목코드', '재고수량']), 'product');
  assert.equal(
    vm.runInContext("normalizeProductImportHeader_('품목코드')", context),
    '상품품목코드',
  );
  assert.equal(vm.runInContext("normalizeProductImportHeader_('재고수량')", context), '가용재고');
  context.__cafe24Headers = ['상품코드', '상품명', '품목코드', '품목명', '재고수량'].map((header) =>
    vm.runInContext(`normalizeProductImportHeader_(${JSON.stringify(header)})`, context),
  );
  assert.doesNotThrow(() => vm.runInContext('validateHeaders_(__cafe24Headers)', context));
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
