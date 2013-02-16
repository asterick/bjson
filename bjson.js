~function() {
		// Character set we use for base64 encoding
	var B64_CHAR_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",

		// Adaptive huffman coding values
		BASE_WEIGHT = 1,

		// Variable integer values
		VAR_INT_WIDTH = 7,
		
		// BitStream constants
		CELL_WIDTH = 16,
		MAX_INT = 32,

		// BJSON type field settings
		BJSON_TYPE_FIELD_SIZE = 3,
		BJSON_UNDEFINED = 2,
		BSJON_NULL = 3,
		BJSON_TRUE = 4,
		BSJON_FALSE = 5,
		BJSON_NUMBER = 1,
		BJSON_STRING = 0,
		BJSON_ARRAY = 6,
		BJSON_OBJECT = 7;

		// Holding area for float conversions
	var float_a = new Float64Array(1),
		uint32_a = new Uint32Array(float_a.buffer);

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
					mask = (1<<grab)-1;

				output |= (this._acc & mask) << shift;

				this._acc >>>= grab;
				this._bits -= grab;
				shift += grab;
				bits -= grab;
			}

			return output;
		},

		getBuffer: function () {
			if (this._bits) {
				this._data.push(this._acc);
				this._bits = this._acc = 0;
			}
			return this._data;
		}
	});

	// --- Adaptive huffman encoding
	function Adaptive(buffer, max) {
		this._buffer = buffer;
		this._counts = [];

		// Give everything an inital weight of 1
		while(max--) { this._counts.push(BASE_WEIGHT); }
	}

	Adaptive.prototype = Object.create({
		write: function (data) {
			var pattern = this._tree(data),
				self = this;

			this._counts[data]++;

			pattern.forEach(function (b) {
				self._buffer.write(b, 1);
			});
		},

		read: function () {
			var node = this._tree();

			while (node.zero !== undefined) {
				node = node[this._buffer.read(1) ? 'one' : 'zero'];
			}
			
			this._counts[node.value]++;
			return node.value;
		},

		_tree: function (target) {
			var pattern = [],
				nodes = this._counts.map(function (d, i) {
					return { value: i, weight: d, count: 1 };
				}).sort(function (a, b) {
					return (a.weight != b.weight) ?
							(b.weight - b.weight) :
							(b.value - b.value);
				}),
				tree = nodes.reduce(function(root, insert) {
					var top = root;

					// Decend to the first root node
					while (top.zero !== undefined) {
						var zero = top.zero,
							one = top.one;
							
						// Update node so it knows how big things are getting
						top.weight += insert.weight;
						top.count++;

						// Insert into the lowest weight side of the tree
						// ... otherwise the side with the fewest nodes
						if (zero.weight != one.weight) {
							top = (zero.weight < one.weight) ? zero : one;
						} else {
							top = (zero.count < one.count) ? zero : one;
						}

						// If we are inserting our pattern, track it's bit pattern
						if (insert.value === target) {
							pattern.push((top == zero) ? 0 : 1);
						}
					}

					// If we are in a leaf node, track pattern on match
					if (top.value === target) {
						pattern.push(0);
					} else if (insert.value === target) {
						pattern.push(1);
					}

					// Bisect leaf node
					top.zero = {
						weight: top.weight,
						count: top.count,
						value: top.value
					}
					top.one = insert;
					top.weight += insert.weight;
					top.count++;

					return root;
				});

			return (target !== undefined) ? pattern : tree;
		}
	});

	// --- CHARACTER TABLE AID
	function marshall(obj, huffman, width) {
		var stream = new BitStream([], width),
			stringTableIdx = {},
			writeChar;

		function writeVarInt(i) {
			var mask = (1 << VAR_INT_WIDTH) - 1;
			do {
				stream.write(i & mask, VAR_INT_WIDTH);
				i >>>= VAR_INT_WIDTH;
				stream.write(i ? 1 : 0, 1);
			} while(i);
		}

		function writeString(str) {
			writeVarInt(str.length);

			str.split('').map(function (c) {
				return c.charCodeAt(0);
			}).forEach(writeChar);
		}

		function writeStringTable() {
			var stringTable = [],
				charTable = [],
				usedChars = [],
				adapt;

			function uniqueChars(s) {
				s.split('').forEach(function (c) {
					var ch = c.charCodeAt(0);
					if (charTable[ch] !== undefined) { return ; }
					charTable[ch] = usedChars.length;
					usedChars.push(ch);
				});
			}

			function dive(obj) {
				switch(typeof obj) {
				case 'string':
					uniqueChars(obj);
					break ;
				case 'object':
					if (Array.isArray(obj)) {
						obj.forEach(function (v) { dive(v); });
					} else if (obj) {
						var names = Object.getOwnPropertyNames(obj);

						names.forEach(function (name) {
							if (stringTableIdx[name] !== undefined) { return ; }
							stringTableIdx[name] = stringTable.length;
							stringTable.push(name);
							uniqueChars(name);
						})

						names.forEach(function (n) {
							dive(obj[n]);
						});
					}
					break ;
				}
			}

			// Attempt to find all the used characters and keys in the object
			dive(obj);

			// Write the character set if we are huffman encoding
			stream.write(huffman, 1);
			if (huffman) {
				writeVarInt(usedChars.length);
				usedChars.forEach(function(c) { writeVarInt(c); });
				adapt = new Adaptive(stream, usedChars.length);
				writeChar = function (ch) {
					adapt.write(charTable[ch]);
				};
			} else {
				writeChar = writeVarInt;
			}

			// Filter string table to contain only unique entries
			writeVarInt(stringTable.length);
			stringTable.forEach(writeString);
		}

		function writeNumber(num) {
			var float = num % 1;

			stream.write(float ? 1 : 0, 1);
			if (float) {
				float_a[0] = num;

				stream.write(uint32_a[0], 32);
				stream.write(uint32_a[1], 32);
			} else {
				stream.write((num < 0) ? 1 : 0, 1);
				writeVarInt(Math.abs(num));
			}
		}

		function writeArray(arr) {
			writeVarInt(arr.length);
			arr.forEach(function (v) {
				writeElement(v);
			})
		}

		function writeObject(obj) {
			var keys = Object.getOwnPropertyNames(obj);
			writeVarInt(keys.length);
			keys.forEach(function (n) {
				writeVarInt(stringTableIdx[n]);
				writeElement(obj[n]);
			});
		}

		function writeElement(obj) {
			switch(typeof obj) {
			case 'object':
				if (!obj) {
					stream.write(BSJON_NULL, BJSON_TYPE_FIELD_SIZE);
				} else if(Array.isArray(obj)) {
					stream.write(BJSON_ARRAY, BJSON_TYPE_FIELD_SIZE);
					writeArray(obj);
				} else {
					stream.write(BJSON_OBJECT, BJSON_TYPE_FIELD_SIZE);
					writeObject(obj);
				}
				break ;
			case 'number':
				stream.write(BJSON_NUMBER,BJSON_TYPE_FIELD_SIZE);
				writeNumber(obj);
				break ;
			case 'string':
				stream.write(BJSON_STRING,BJSON_TYPE_FIELD_SIZE);
				writeString(obj);
				break ;
			case 'boolean':
				stream.write(obj ? BJSON_TRUE : BSJON_FALSE, BJSON_TYPE_FIELD_SIZE);
				break ;
			case 'undefined':
				stream.write(BJSON_UNDEFINED,BJSON_TYPE_FIELD_SIZE);
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
			readChar;

		function readVarInt() {
			var data = 0,
				bits = 0;
			
			do {
				data |= (stream.read(VAR_INT_WIDTH)) << bits;
				bits += VAR_INT_WIDTH;
			} while(stream.read(1));

			return data;
		}

		function readCharacterSet() {
			var huffman = stream.read(1),
				charSet = [],
				adapt, i;

			if (huffman) {
				for (var i = readVarInt(); i > 0; i--) {
					charSet.push(readVarInt());
				}

				adapt = new Adaptive(stream, charSet.length);
				readChar = function () { return charSet[adapt.read()]; };
			} else {
				readChar = readVarInt;
			}
		}

		function readString() {
			var chs = [];
			
			for(var chars = readVarInt(); chars > 0; chars--) {
				chs.push(String.fromCharCode(readChar()));
			}

			return chs.join('');
		}

		function readStringTable() {
			var strings;
			
			stringTable = [];
			for(strings = readVarInt(); strings > 0; strings--) {
				stringTable.push(readString());
			}
		}

		function readNumber() {
			if (stream.read(1)) {
				uint32_a[0] = stream.read(32);
				uint32_a[1] = stream.read(32);

				return float_a[0];
			} else {
				return stream.read(1) ? -readVarInt() : readVarInt();
			}
		}
		
		function readArray() {
			var data = [],
				length;
			
			for (length = readVarInt(); length; length--) {
				data.push(readElement());
			}
			return data;
		}

		function readObject() {
			var data = {},
				name, length;

			for (length = readVarInt(); length; length--) {
				name = stringTable[readVarInt()];
				data[name] = readElement();
			}
			return data;
		}

		function readElement() {
			switch(stream.read(BJSON_TYPE_FIELD_SIZE)) {
			case BJSON_UNDEFINED:
				return undefined;
			case BSJON_NULL:
				return null;
			case BJSON_TRUE:
				return true;
			case BSJON_FALSE:
				return false;
			case BJSON_NUMBER:
				return readNumber();
			case BJSON_STRING:
				return readString();
			case BJSON_ARRAY:
				return readArray();
			case BJSON_OBJECT:
				return readObject();
			}
		}

		readCharacterSet();
		readStringTable();
		
		return readElement();
	}

	function stringify(obj, huff) {
		var arr = marshall(obj, huff, 6);
		return arr.map(function (c) {
			return B64_CHAR_SET[c];
		}).join('');
	}

	function parse(str) {
		var arr = str.split('').map(function (c) {
				return B64_CHAR_SET.indexOf(c);
			});
		return demarshall(arr, 6);
	}

	this.BJSON = this.BJSON || {
		marshall: marshall,
		demarshall: demarshall,
		stringify: stringify,
		parse: parse
	};
}.call(this);
