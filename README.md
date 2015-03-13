BJSON
=====

Efficient binary encoding of JSON objects

NOTE: This is a stub document.  the library is functional and quite robust.

Usage
=====

* BJSON.marshall(object, [bit_width])

Encode an object as a Javascript array.
By default, return is an array of 16-bit unsigned integers

NOTE: bit_width cannot be larger than 32-bits (integer bit size limitations)

* BJSON.demarshall(array, [bit_width])

Decode an array created using BJSON.marshall.  Bit width must match what was provided with marshall

* BJSON.stringify(object, [character set])

Base64 a 6-bit width marshalled object.

* BJSON.parse(string, [character set])

Demarshall 6-bit, base64 encoded string.
