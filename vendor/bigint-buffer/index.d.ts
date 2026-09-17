import { Buffer } from 'buffer';
export declare function toBigIntLE(bytes: Buffer): bigint;
export declare function toBigIntBE(bytes: Buffer): bigint;
export declare function toBufferLE(value: bigint, width: number): Buffer;
export declare function toBufferBE(value: bigint, width: number): Buffer;
