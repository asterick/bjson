BJSON
=====

Efficient binary encoding of JSON objects

NOTE: This is a stub document.  the library is functional and quite robust.

Usage
=====

* BJSON.marshall(object, [huffman, bit_width])

Encode an object as a Javascript array.  Optional adaptive huffman encoded strings can be used (slower).
By default, return is an array of 16-bit unsigned integers

NOTE: bit_width cannot be larger than 32-bits (integer bit size limitations)

* BJSON.demarshall(array, [bit_width])

Decode an array created using BJSON.marshall.  Bit width must match what was provided with marshall

* BJSON.stringify(object, [huffman])

Base64 a 6-bit width marshalled object.  Does not include trailing "=".

* BJSON.parse(string)

Demarshall 6-bit, base64 encoded string.  Should not include trailing "=".