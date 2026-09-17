'use strict';
const { Buffer } = require('buffer');
// SPL layouts use 8, 16, 24 or 32 bytes. Cap all public inputs to bound work.
const MAX_BYTES = 4096;
function checkWidth(width) {
  if (!Number.isSafeInteger(width) || width < 0 || width > MAX_BYTES) {
    throw new RangeError('width must be an integer from 0 to 4096');
  }
}
function decode(bytes, littleEndian) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('Expected Buffer');
  checkWidth(bytes.length);
  let result = 0n;
  for (let index = 0; index < bytes.length; index++) {
    result = (result << 8n) | BigInt(bytes[littleEndian ? bytes.length - 1 - index : index]);
  }
  return result;
}
function encode(value, width, littleEndian) {
  checkWidth(width);
  if (typeof value !== 'bigint') throw new TypeError('Expected bigint');
  if (value < 0n || value >= (1n << BigInt(width * 8))) {
    throw new RangeError('Unsigned value does not fit requested width');
  }
  const output = Buffer.alloc(width);
  for (let index = 0; index < width; index++) {
    output[littleEndian ? index : width - 1 - index] = Number(value & 255n);
    value >>= 8n;
  }
  return output;
}
exports.toBigIntLE = bytes => decode(bytes, true);
exports.toBigIntBE = bytes => decode(bytes, false);
exports.toBufferLE = (value, width) => encode(value, width, true);
exports.toBufferBE = (value, width) => encode(value, width, false);
