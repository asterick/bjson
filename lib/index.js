var BitStream = require("./bitstream.js"),
    Adaptive = require("./adaptive.js"),
    Float = require("./float.js");

// Character set we use for base64 encoding
var CHAR_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-";

// BJSON type field settings
var TYPE_FIELD_SIZE = 3;

var UNDEFINED = 0;
var NULL = 1;
var FALSE = 3;
var TRUE = 4;
var NUMBER = 5;
var STRING = 6;
var ARRAY = 7;
var OBJECT = 8;

// --- CHARACTER TABLE AID
function marshall(obj, width) {
    var stream = new BitStream([], width),
        stringTableIdx = {},
        characters = new Adaptive(stream);

    function writeString(str) {
        stream.writeVar(str.length);

        str.split('')
            .forEach(function (c) {
                characters.write(c.charCodeAt(0));
            });
    }

    function writeStringTable() {
        var stringTable = [];

        function dive(obj) {
            if (typeof obj === "object") {
                if (Array.isArray(obj)) {
                    obj.forEach(dive);
                } else if (obj) {
                    Object.getOwnPropertyNames(obj).forEach(function (name) {
                        if (stringTableIdx[name] === undefined) {
                            stringTableIdx[name] = stringTable.length;
                            stringTable.push(name);
                        }
                        dive(obj[name]);
                    });
                }
            }
        }

        // Attempt to find all the used characters and keys in the object
        dive(obj);

        // Filter string table to contain only unique entries
        stream.writeVar(stringTable.length);
        stringTable.forEach(writeString);
    }

    function writeNumber(num) {
        var float = num % 1;

        stream.write(float ? 1 : 0, 1);

        if (float) {
            var enc = Float.decode(num);

            console.log(enc);

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
            stream.writeVar(stringTableIdx[n]);
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

    writeStringTable();
    writeElement(obj);

    return stream.getBuffer();
}

function demarshall(buffer, width) {
    var stream = new BitStream(buffer, width),
        stringTable = [],
        characters;

    function readString() {
        var chs = [];

        for(var chars = stream.readVar(); chars > 0; chars--) {
            chs.push(String.fromCharCode(characters.read()));
        }

        return chs.join('');
    }

    function readStringTable() {
        var strings;

        characters = new Adaptive(stream);

        stringTable = [];
        for(strings = stream.readVar(); strings > 0; strings--) {
            stringTable.push(readString());
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
            name = stringTable[stream.readVar()];
            data[name] = readElement();
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

    readStringTable();

    return readElement();
}

function stringify(obj) {
    var arr = marshall(obj, 6);
    return arr.map(function (c) {
        return CHAR_SET[c];
    }).join('');
}

function parse(str) {
    var arr = str.split('').map(function (c) {
            return CHAR_SET.indexOf(c);
        });

    return demarshall(arr, 6);
}

module.exports = {
    marshall: marshall,
    demarshall: demarshall,
    stringify: stringify,
    parse: parse
};
