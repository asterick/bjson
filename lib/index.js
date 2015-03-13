var BitStream = require("./bitstream.js"),
    Adaptive = require("./adaptive.js"),
    Float = require("./float.js");

// BJSON type field settings
var TYPE_WIDTH = 3;
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

        stream.writeBool(float);

        if (float) {
            var enc = Float.decode(num);

            stream.writeBool(enc.sign);
            stream.writeBool(enc.exponent < 0);
            tree.write(Math.abs(enc.exponent));
            tree.write(enc.significand);
        } else {
            stream.writeBool(num < 0);
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
                stream.write(NULL, TYPE_WIDTH);
            } else if(Array.isArray(obj)) {
                stream.write(ARRAY, TYPE_WIDTH);
                writeArray(obj);
            } else {
                stream.write(OBJECT, TYPE_WIDTH);
                writeObject(obj);
            }
            break ;
        case 'number':
            stream.write(NUMBER, TYPE_WIDTH);
            writeNumber(obj);
            break ;
        case 'string':
            stream.write(STRING, TYPE_WIDTH);
            writeString(obj);
            break ;
        case 'boolean':
            stream.write(obj ? TRUE : FALSE, TYPE_WIDTH);
            break ;
        case 'undefined':
            stream.write(UNDEFINED, TYPE_WIDTH);
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
        if (stream.readBool()) {
            var sign = stream.readBool(),
                exp_s = stream.readBool(),
                exponent = tree.read();
                significand = tree.read();

            return Float.encode({
                sign: sign,
                exponent: exp_s ? -exponent : exponent,
                significand: significand
            });
        } else {
            return stream.readBool() ? -tree.read() : tree.read();
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
        switch(stream.read(TYPE_WIDTH)) {
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

function stringify(obj, cs) {
    cs || (cs = CHAR_SET);
    var arr = marshall(obj, CHAR_BITS);
    return arr.map(function (c) {
        return cs[c];
    }).join('');
}

function parse(str, cs) {
    cs || (cs = CHAR_BITS);
    var arr = str.split('').map(function (c) {
            return cs.indexOf(c);
        });

    return demarshall(arr, CHAR_BITS);
}

module.exports = {
    marshall: marshall,
    demarshall: demarshall,
    stringify: stringify,
    parse: parse
};
