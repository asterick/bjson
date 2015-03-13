var bjson = require("../lib"),
    chai = require("chai");

chai.should();

describe('bjson', function(){
    describe('#marshall', function () {
        it('produces an Array', function () {
            bjson.marshall().should.be.a('array');
        });

        it('should encode numeric data types', function () {
            // Numeric types
            bjson.marshall(0).should.be.a('array');
            bjson.marshall(1).should.be.a('array');
            bjson.marshall(-1).should.be.a('array');
            bjson.marshall(1.1).should.be.a('array');
            bjson.marshall(-1.1).should.be.a('array');
        });

        it('should encode string data', function () {
            // String type
            bjson.marshall("").should.be.a('array');
            bjson.marshall("Test Data").should.be.a('array');
        });

        it('should encode boolean data', function () {
            // Boolean types
            bjson.marshall(true).should.be.a('array');
            bjson.marshall(false).should.be.a('array');
        });

        it('should encode uninitalized data types', function () {
            // Boolean types
            bjson.marshall().should.be.a('array');
            bjson.marshall(null).should.be.a('array');
        });

        it('should encode array data types', function () {
            bjson.marshall([]).should.be.a('array');
            bjson.marshall([1,2,3]).should.be.a('array');
        });

        it('should encode object data types', function () {
            bjson.marshall({}).should.be.a('array');
            bjson.marshall({"test": null}).should.be.a('array');
        });
    });

    describe('#demarshall', function () {
        function test_data(data) {
            var enc = bjson.marshall(data),
                dec = bjson.demarshall(enc);

            chai.expect(dec).to.eql(data);
        }

        it('should decode numeric data types', function () {
            // Numeric types
            test_data(0);
            test_data(1);
            test_data(-1);
            test_data(1.1);
            test_data(-1.1);
        });

        it('should decode string data', function () {
            // String type
            test_data("Test Data");
        });

        it('should decode boolean data', function () {
            // Boolean types
            test_data(true);
            test_data(false);
        });

        it('should decode uninitalized data types', function () {
            // Boolean types
            test_data();
            test_data(null);
        });

        it('should decode array data types', function () {
            test_data([]);
            test_data([1,2,3]);
        });

        it('should decode object data types', function () {
            test_data({
                "test": "Basic"
            });
        });

        it('should handle repeating strings', function () {
            test_data(["asdf","asdf","asdf","asdf","asdf","asdf"]);
        });

        it('should decode complex data', function () {
            test_data({
                "\u2603": 0,
                "": null,
                "1": (void 0),
                "2": false,
                "3": [
                    true,
                    "asdf",
                    {"x" : "1"},
                    Math.PI
                ]
            });
        });
    });

    describe("#stringify", function () {
        function test_data(data) {
            var enc = bjson.stringify(data),
                dec = bjson.parse(enc);

            chai.expect(dec).to.eql(data);
        }

        it('should produce a string', function () {
            bjson.stringify().should.be.a('string');
        });


        it('should decode complex data', function () {
            test_data({
                "\u2603": 0,
                "": null,
                "1": (void 0),
                "2": false,
                "3": [
                    true,
                    "asdf",
                    {"x" : "1"},
                    Math.PI
                ]
            });
        });
    });
});
