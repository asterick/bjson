var BitStream = require("./bitstream.js"),
    Adaptive = require("./adaptive.js"),
    Float = require("./float.js");

// BJSON type field settings
var UNDEFINED = 0;
var NULL = 1;
var FALSE = 2;
var TRUE = 3;
var NUMBER = 4;
var STRING = 5;
var ARRAY = 6;
var OBJECT = 7;

// --- CHARACTER TABLE AID
function marshall(obj, width) {
    var stream = new BitStream([], width),
        stringTable = {},
        stringTableIdx = 1,
        tree = new Adaptive(stream);

    function writeString(str) {
        if (stringTable[str] !== undefined) {
            tree.write(stringTable[str]);
        } else {
            tree.write(0);
            stringTable[str] = stringTableIdx++;

            tree.write(str.length);
            for (var i = 0; i < str.length; i++) {
                tree.write(str.charCodeAt(i));
            }
        }
    }

    function writeNumber(num) {
        var float = num % 1;

        tree.write(float ? 1 : 0);

        if (float) {
            var enc = Float.decode(num);

            tree.write(enc.sign ? 1 : 0, 1);
            tree.write((enc.exponent > 0) ? 0 : 1);
            tree.write(Math.abs(enc.exponent));
            tree.write(enc.significand);
        } else {
            tree.write((num < 0) ? 1 : 0, 1);
            tree.write(Math.abs(num));
        }
    }

    function writeArray(arr) {
        tree.write(arr.length);
        arr.forEach(function (v) {
            writeElement(v);
        });
    }

    function writeObject(obj) {
        var keys = Object.getOwnPropertyNames(obj);

        tree.write(keys.length);
        keys.forEach(function (n) {
            writeString(n);
            writeElement(obj[n]);
        });
    }

    function writeElement(obj) {
        switch(typeof obj) {
        case 'object':
            if (!obj) {
                tree.write(NULL);
            } else if(Array.isArray(obj)) {
                tree.write(ARRAY);
                writeArray(obj);
            } else {
                tree.write(OBJECT);
                writeObject(obj);
            }
            break ;
        case 'number':
            tree.write(NUMBER);
            writeNumber(obj);
            break ;
        case 'string':
            tree.write(STRING);
            writeString(obj);
            break ;
        case 'boolean':
            tree.write(obj ? TRUE : FALSE);
            break ;
        case 'undefined':
            tree.write(UNDEFINED);
            break ;
        }
    }

    writeElement(obj);

    return stream.getBuffer();
}

function demarshall(buffer, width) {
    var stream = new BitStream(buffer, width),
        stringTable = [null],
        tree = new Adaptive(stream);

    function readString() {
        var idx = tree.read();

        if (!idx) {
            var chs = [],
                str;

            for(var chars = tree.read(); chars > 0; chars--) {
                chs.push(String.fromCharCode(tree.read()));
            }

            stringTable.push(str = chs.join(''));

            return str;
        } else {
            return stringTable[idx];
        }
    }

    function readNumber() {
        if (tree.read()) {
            var sign = tree.read() ? true : false,
                exp_s = tree.read(),
                exponent = tree.read();
                significand = tree.read();

            return Float.encode({
                sign: sign,
                exponent: exp_s ? -exponent : exponent,
                significand: significand
            });
        } else {
            return tree.read() ? -tree.read() : tree.read();
        }
    }

    function readArray() {
        var data = [],
            length;

        for (length = tree.read(); length; length--) {
            data.push(readElement());
        }
        return data;
    }

    function readObject() {
        var data = {},
            name, length;

        for (length = tree.read(); length; length--) {
            data[readString()] = readElement();
        }

        return data;
    }

    function readElement() {
        switch(tree.read()) {
        case UNDEFINED:
            return undefined;
        case NULL:
            return null;
        case TRUE:
            return true;
        case FALSE:
            return false;
        case NUMBER:
            return readNumber();
        case STRING:
            return readString();
        case ARRAY:
            return readArray();
        case OBJECT:
            return readObject();
        }
    }

    return readElement();
}

// Character set we use for base64 encoding
var CHAR_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-",
    CHAR_BITS = 6;

function stringify(obj) {
    var arr = marshall(obj, CHAR_BITS);
    return arr.map(function (c) {
        return CHAR_SET[c];
    }).join('');
}

function parse(str) {
    var arr = str.split('').map(function (c) {
            return CHAR_SET.indexOf(c);
        });

    return demarshall(arr, CHAR_BITS);
}

module.exports = {
    marshall: marshall,
    demarshall: demarshall,
    stringify: stringify,
    parse: parse
};
