var BitStream = require("./bitstream.js"),
    Adaptive = require("./adaptive.js"),
    Float = require("./float.js");

// BJSON type field settings
var TYPE_FIELD_SIZE = 3;

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
        characters = new Adaptive(stream);

    function writeString(str) {
        if (stringTable[str] !== undefined) {
            stream.writeVar(stringTable[str]);
        } else {
            stream.writeVar(0);
            stringTable[str] = stringTableIdx++;

            stream.writeVar(str.length);
            for (var i = 0; i < str.length; i++) {
                stream.writeVar(str.charCodeAt(i));
            }
        }
    }

    function writeNumber(num) {
        var float = num % 1;

        stream.write(float ? 1 : 0, 1);

        if (float) {
            var enc = Float.decode(num);

            stream.write(enc.sign ? 1 : 0, 1);
            stream.writeVar(enc.exponent);
            stream.writeVar(enc.significand);
        } else {
            stream.write((num < 0) ? 1 : 0, 1);
            stream.writeVar(Math.abs(num));
        }
    }

    function writeArray(arr) {
        stream.writeVar(arr.length);
        arr.forEach(function (v) {
            writeElement(v);
        });
    }

    function writeObject(obj) {
        var keys = Object.getOwnPropertyNames(obj);

        stream.writeVar(keys.length);
        keys.forEach(function (n) {
            writeString(n);
            writeElement(obj[n]);
        });
    }

    function writeElement(obj) {
        switch(typeof obj) {
        case 'object':
            if (!obj) {
                stream.write(NULL, TYPE_FIELD_SIZE);
            } else if(Array.isArray(obj)) {
                stream.write(ARRAY, TYPE_FIELD_SIZE);
                writeArray(obj);
            } else {
                stream.write(OBJECT, TYPE_FIELD_SIZE);
                writeObject(obj);
            }
            break ;
        case 'number':
            stream.write(NUMBER,TYPE_FIELD_SIZE);
            writeNumber(obj);
            break ;
        case 'string':
            stream.write(STRING,TYPE_FIELD_SIZE);
            writeString(obj);
            break ;
        case 'boolean':
            stream.write(obj ? TRUE : FALSE, TYPE_FIELD_SIZE);
            break ;
        case 'undefined':
            stream.write(UNDEFINED,TYPE_FIELD_SIZE);
            break ;
        }
    }

    writeElement(obj);

    return stream.getBuffer();
}

function demarshall(buffer, width) {
    var stream = new BitStream(buffer, width),
        stringTable = [null],
        characters;

    function readString() {
        var idx = stream.readVar();

        if (!idx) {
            var chs = [],
                str;

            for(var chars = stream.readVar(); chars > 0; chars--) {
                chs.push(String.fromCharCode(stream.readVar()));
            }

            stringTable.push(str = chs.join(''));

            return str;
        } else {
            return stringTable[idx];
        }
    }

    function readNumber() {
        if (stream.read(1)) {
            var sign = stream.read(1) ? true : false,
                exponent = stream.readVar();
                significand = stream.readVar();

            return Float.encode({
                sign: sign,
                exponent: exponent,
                significand: significand
            });
        } else {
            return stream.read(1) ? -stream.readVar() : stream.readVar();
        }
    }

    function readArray() {
        var data = [],
            length;

        for (length = stream.readVar(); length; length--) {
            data.push(readElement());
        }
        return data;
    }

    function readObject() {
        var data = {},
            name, length;

        for (length = stream.readVar(); length; length--) {
            var k = readString();
            data[k] = readElement();
        }

        return data;
    }

    function readElement() {
        switch(stream.read(TYPE_FIELD_SIZE)) {
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
