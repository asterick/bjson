// Variable integer values
var VAR_INT_WIDTH = 7;

// BitStream constants
var CELL_WIDTH = 16;
var MAX_INT = 32;

// --- Bit-Stream object
function BitStream(data, width) {
    this._data = data || [];
    this._width = Math.min(width || CELL_WIDTH, MAX_INT);

    this._index = 0;
    this._bits = 0;
    this._acc = 0;
}

BitStream.prototype = Object.create({
    constructor: BitStream,

    write: function (data, bits) {
        while (bits > 0) {
            var grab = Math.min(bits, this._width - this._bits),
                mask = (1 << grab) - 1;

            this._acc |= (data & mask) << this._bits;
            this._bits += grab;
            bits -= grab;
            data >>>= grab;

            if (this._bits >= this._width) {
                this._data.push(this._acc);
                this._acc = this._bits = 0;
            }
        }
    },

    writeBool: function (i) {
        this.write(i ? 1 : 0, 1);
    },

    writeVar: function (i) {
        var mask = (1 << VAR_INT_WIDTH) - 1;

        do {
            this.write(i & mask, VAR_INT_WIDTH);
            i = Math.floor(i /(1 << VAR_INT_WIDTH));
            this.write(i ? 1 : 0, 1);
        } while(i);
    },

    read: function (bits) {
        var shift = 0,
            output = 0;

        while (bits) {
            if (!this._bits) {
                this._bits = this._width;
                this._acc = this._data[this._index++];

                if (this._acc === undefined) {
                    throw new Error("Buffer underflow");
                }
            }

            var grab = Math.min(this._bits, bits),
                mask = (1 << grab)-1;

            output |= (this._acc & mask) << shift;

            this._acc >>>= grab;
            this._bits -= grab;
            shift += grab;
            bits -= grab;
        }

        return output;
    },

    readBool: function () {
        return this.read(1) ? true : false;
    },

    readVar: function () {
        var data = 0,
            bits = 0;

        do {
            data += this.read(VAR_INT_WIDTH) * Math.pow(2, bits);
            bits += VAR_INT_WIDTH;
        } while(this.read(1));

        return data;
    },

    getBuffer: function () {
        if (this._bits) {
            this._data.push(this._acc);
            this._bits = this._acc = 0;
        }
        return this._data;
    }
});

module.exports = BitStream;

