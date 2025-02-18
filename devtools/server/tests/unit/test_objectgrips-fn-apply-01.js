/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
/* eslint-disable no-shadow, max-nested-callbacks */

"use strict";

Services.prefs.setBoolPref("security.allow_eval_with_system_principal", true);
registerCleanupFunction(() => {
  Services.prefs.clearUserPref("security.allow_eval_with_system_principal");
});

add_task(
  threadFrontTest(async ({ threadFront, debuggee }) => {
    debuggee.eval(
      function stopMe(arg1) {
        debugger;
      }.toString()
    );

    await test_object_grip(debuggee, threadFront);
  })
);

async function test_object_grip(debuggee, threadFront) {
  await assert_object_argument(
    debuggee,
    threadFront,
    `
      stopMe({
        obj1: {},
        obj2: {},
        context(arg) {
          return this === arg ? "correct context" : "wrong context";
        },
        sum(...parts) {
          return parts.reduce((acc, v) => acc + v, 0);
        },
        error() {
          throw "an error";
        },
      });
    `,
    async objectFront => {
      const obj1 = (await objectFront.getPropertyValue(
        "obj1",
        null
      )).value.return.getGrip();
      const obj2 = (await objectFront.getPropertyValue(
        "obj2",
        null
      )).value.return.getGrip();

      info(`Retrieve "context" function reference`);
      const context = (await objectFront.getPropertyValue("context", null))
        .value.return;
      info(`Retrieve "sum" function reference`);
      const sum = (await objectFront.getPropertyValue("sum", null)).value
        .return;
      info(`Retrieve "error" function reference`);
      const error = (await objectFront.getPropertyValue("error", null)).value
        .return;

      assert_response(await context.apply(obj1, [obj1]), {
        return: "correct context",
      });
      assert_response(await context.apply(obj2, [obj2]), {
        return: "correct context",
      });
      assert_response(await context.apply(obj1, [obj2]), {
        return: "wrong context",
      });
      assert_response(await context.apply(obj2, [obj1]), {
        return: "wrong context",
      });
      // eslint-disable-next-line no-useless-call
      assert_response(await sum.apply(null, [1, 2, 3, 4, 5, 6, 7]), {
        return: 1 + 2 + 3 + 4 + 5 + 6 + 7,
      });
      // eslint-disable-next-line no-useless-call
      assert_response(await error.apply(null, []), {
        throw: "an error",
      });
    }
  );
}

function assert_object_argument(debuggee, threadFront, code, objectHandler) {
  return eval_and_resume(debuggee, threadFront, code, async frame => {
    const arg1 = frame.arguments[0];
    Assert.equal(arg1.class, "Object");

    await objectHandler(threadFront.pauseGrip(arg1));
  });
}

function eval_and_resume(debuggee, threadFront, code, callback) {
  return new Promise((resolve, reject) => {
    wait_for_pause(threadFront, callback).then(resolve, reject);

    // This synchronously blocks until 'threadFront.resume()' above runs
    // because the 'paused' event runs everthing in a new event loop.
    debuggee.eval(code);
  });
}

function wait_for_pause(threadFront, callback = () => {}) {
  return new Promise((resolve, reject) => {
    threadFront.once("paused", function(packet) {
      (async () => {
        try {
          return await callback(packet.frame);
        } finally {
          await threadFront.resume();
        }
      })().then(resolve, reject);
    });
  });
}

function assert_response({ value }, expected) {
  assert_completion(value, expected);
}

function assert_completion(value, expected) {
  if (expected && "return" in expected) {
    assert_value(value.return, expected.return);
  }
  if (expected && "throw" in expected) {
    assert_value(value.throw, expected.throw);
  }
  if (!expected) {
    assert_value(value, expected);
  }
}

function assert_value(actual, expected) {
  Assert.equal(typeof actual, typeof expected);

  if (typeof expected === "object") {
    // Note: We aren't using deepEqual here because we're only doing a cursory
    // check of a few properties, not a full comparison of the result, since
    // the full outputs includes stuff like preview info that we don't need.
    for (const key of Object.keys(expected)) {
      assert_value(actual[key], expected[key]);
    }
  } else {
    Assert.equal(actual, expected);
  }
}
