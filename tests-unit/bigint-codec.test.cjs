const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const codec = require('../vendor/bigint-buffer/index.cjs');
const { createRequire } = require('node:module');
const path = require('node:path');

test('known endian vectors, zero and empty buffer', () => {
  assert.equal(codec.toBigIntLE(Buffer.from('01020304','hex')), 0x04030201n);
  assert.equal(codec.toBigIntBE(Buffer.from('01020304','hex')), 0x01020304n);
  assert.equal(codec.toBufferLE(0x01020304n,4).toString('hex'),'04030201');
  assert.equal(codec.toBufferBE(0x01020304n,4).toString('hex'),'01020304');
  for(const end of ['LE','BE']) {
    assert.equal(codec['toBigInt'+end](Buffer.alloc(0)),0n);
    assert.deepEqual(codec['toBuffer'+end](0n,0),Buffer.alloc(0));
    assert.deepEqual(codec['toBuffer'+end](0n,8),Buffer.alloc(8));
  }
});
test('random and boundary values agree with independent hex reference and do not mutate input',()=>{
  for(const width of [1,8,16,24,32,64]) {
    for(const bytes of [Buffer.alloc(width),Buffer.alloc(width,255),...Array.from({length:20},()=>randomBytes(width))]) {
      const original=Buffer.from(bytes);
      const expectedBE=BigInt('0x'+bytes.toString('hex'));
      const expectedLE=BigInt('0x'+Buffer.from(bytes).reverse().toString('hex'));
      assert.equal(codec.toBigIntBE(bytes),expectedBE);
      assert.equal(codec.toBigIntLE(bytes),expectedLE);
      assert.deepEqual(codec.toBufferBE(expectedBE,width),bytes);
      assert.deepEqual(codec.toBufferLE(expectedLE,width),bytes);
      assert.deepEqual(bytes,original);
    }
  }
});
test('rejects negative, overflowing, malformed and oversized inputs',()=>{
  for(const encode of [codec.toBufferLE,codec.toBufferBE]) {
    for(const width of [-1,1.5,NaN,Infinity,4097]) assert.throws(()=>encode(0n,width),RangeError);
    for(const width of [0,1,8,16,24,32]) assert.throws(()=>encode(1n<<BigInt(width*8),width),RangeError);
    assert.throws(()=>encode(-1n,8),RangeError);
    assert.throws(()=>encode(1,8),TypeError);
  }
  for(const decode of [codec.toBigIntLE,codec.toBigIntBE]) {
    assert.throws(()=>decode(Buffer.alloc(4097)),RangeError);
    assert.throws(()=>decode([1,2]),TypeError);
    assert.equal(decode(Buffer.alloc(4096)),0n);
  }
});
for(const scope of ['..','../frontend']) test(`${scope}: installed SPL layouts resolve to local adapter and round-trip u64/u128/u192/u256`,()=>{
  const req=createRequire(path.resolve(__dirname,scope,'package.json'));
  const splReq=createRequire(req.resolve('@solana/spl-token'));
  const layoutReq=createRequire(splReq.resolve('@solana/buffer-layout-utils'));
  assert.equal(layoutReq('bigint-buffer/package.json').name,'@vault-lab/bigint-buffer-js');
  const layouts=splReq('@solana/buffer-layout-utils');
  for(const bits of [64,128,192,256]) for(const suffix of ['','be']) {
    const layout=layouts['u'+bits+suffix]();
    const value=(1n<<BigInt(bits))-1n;
    const bytes=Buffer.alloc(bits/8);
    layout.encode(value,bytes,0);
    assert.deepEqual(bytes,Buffer.alloc(bits/8,255));
    assert.equal(layout.decode(bytes,0),value);
  }
});
