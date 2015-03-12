// Not 100% precision inspecific.
// Reversing the bits of the significand would make it arbitrary

var float_a = new Float64Array(1),
    uint32_a = new Uint32Array(float_a.buffer);

function decode(i) {
    float_a[0] = i;

    return {
        exponent: ((uint32_a[1] & ~0x80000000) >>> 20) - 1023,
        sign: (uint32_a[1] & 0x80000000) ? true : false,
        significand: (uint32_a[1] & 0xFFFFF) * 0x100000000 + uint32_a[0]
    };
}

function encode(enc) {
    uint32_a[0] = enc.significand;

    enc.significand /= 0x100000000;

    uint32_a[1] =
        (enc.sign ? 0x80000000 : 0) |
        ((enc.exponent + 1023) << 20) |
        enc.significand;

    return float_a[0];
}

module.exports = {
    decode: decode,
    encode: encode
}
