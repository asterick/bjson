var bjson = require("./lib");

function test(d) {
    console.log("----")

    var i =  bjson.marshall(d);
    console.log(d);
    console.log(i);
    console.log(bjson.demarshall(i));
}

test(0);
test(1);
test(-1);
test(1.1);
test(-1.1);

