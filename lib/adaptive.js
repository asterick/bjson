var NYT = "NYT";

// --- Adaptive huffman encoding
function Adaptive(buffer) {
    this._buffer = buffer;
    this._nodes = [];

    // Create default tree with 0 weight root node
    this._nodes[NYT] =
    this._tree = {
        parent: null,
        weight: 0,
        data: NYT
    };
}

Adaptive.prototype = Object.create({
    write: function (data) {
        var node = this._nodes[data];

        if (node === undefined) {
            this._emit(this._nodes[NYT]);
            this._buffer.writeVar(data);
            this._insert(data, 1);
        } else {
            this._emit(node);
            this._remove(node);
            this._insert(node.data, node.weight + 1);
        }
    },

    read: function () {
        var node = this._tree,
            data;

        while (node.data === undefined) {
            node = node[this._buffer.read(1) ? 'one' : 'zero'];
        }

        if (node.data === NYT) {
            data = this._buffer.readVar();
            this._insert(data, 1);

            return data;
        } else {
            this._remove(node);
            this._insert(node.data, node.weight + 1);

            return node.data;
        }
    },

    _insert: function (data, weight) {
        var top = this._tree;

        // Find a node we want to split
        while (top.data === undefined && weight < top.weight) {
            var zero = top.zero,
                one = top.one;

            top.weight += weight;
            top = (zero.weight < one.weight) ? zero : one;
        }

        // Previous node becomes the "one"
        this._nodes[top.data] =
        top.one = {
            bit: 1,
            zero: top.zero,
            one: top.one,
            weight: top.weight,
            data: top.data,
            parent: top
        };

        // Inserted node becomes the "zero"
        this._nodes[data] =
        top.zero = {
            bit: 0,
            weight: weight,
            data: data,
            parent: top
        }

        // If previous node was a split node, update parents
        if (top.one.data === undefined) {
            top.one.one.parent = top.one;
            top.one.zero.parent = top.one;
        }

        // Establish proper weight and clean up data
        top.weight += weight;
        delete top.data;
    },

    _remove: function (node) {
        var parent = node.parent,
            keep = node.bit ? parent.zero : parent.one;

        // Shift up all the data in the tree
        parent.one = keep.one;
        parent.zero = keep.zero;
        parent.data = keep.data;

        // If the kept node was a branch, keep children in a proper tree
        if (keep.data === undefined) {
            keep.one.parent = parent;
            keep.zero.parent = parent;
        } else {
            this._nodes[keep.data] = parent;
        }

        // Adjust the weight
        while (parent) {
            parent.weight -= node.weight;
            parent = parent.parent;
        }
    },

    _emit: function (node) {
        var self = this;

        function emit(node) {
            if (!node.parent) { return ; }
            emit(node.parent);
            self._buffer.write(node.bit, 1);
        }

        emit(node);
    }
});

module.exports = Adaptive;
