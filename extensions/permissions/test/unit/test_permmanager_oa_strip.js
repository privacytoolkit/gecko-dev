/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const TEST_URI = Services.io.newURI("http://example.com");
const TEST_PERMISSION = "test/oastrip";
const TEST_PERMISSION2 = "test/oastrip2";
const TEST_PERMISSION3 = "test/oastrip3";

let principal = Services.scriptSecurityManager.createContentPrincipal(
  TEST_URI,
  {}
);
let principalPrivateBrowsing = Services.scriptSecurityManager.createContentPrincipal(
  TEST_URI,
  { privateBrowsingId: 1 }
);
let principalUserContext1 = Services.scriptSecurityManager.createContentPrincipal(
  TEST_URI,
  { userContextId: 1 }
);
let principalUserContext2 = Services.scriptSecurityManager.createContentPrincipal(
  TEST_URI,
  { userContextId: 2 }
);

function testOAIsolation(permIsolateUserContext, permIsolatePrivateBrowsing) {
  info(
    `testOAIsolation: permIsolateUserContext: ${permIsolateUserContext}; permIsolatePrivateBrowsing: ${permIsolatePrivateBrowsing}`
  );

  let pm = Services.perms;

  Services.prefs.setBoolPref(
    "permissions.isolateBy.userContext",
    permIsolateUserContext
  );
  Services.prefs.setBoolPref(
    "permissions.isolateBy.privateBrowsing",
    permIsolatePrivateBrowsing
  );

  // Set test permission for normal browsing
  pm.addFromPrincipal(principal, TEST_PERMISSION, pm.ALLOW_ACTION);

  // Check normal browsing permission
  Assert.equal(
    Ci.nsIPermissionManager.ALLOW_ACTION,
    pm.testPermissionFromPrincipal(principal, TEST_PERMISSION)
  );
  // normal browsing => user context 1
  Assert.equal(
    permIsolateUserContext
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.ALLOW_ACTION,
    pm.testPermissionFromPrincipal(principalUserContext1, TEST_PERMISSION)
  );
  // normal browsing => user context 2
  Assert.equal(
    permIsolateUserContext
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.ALLOW_ACTION,
    pm.testPermissionFromPrincipal(principalUserContext2, TEST_PERMISSION)
  );
  // normal browsing => private browsing
  Assert.equal(
    permIsolatePrivateBrowsing
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.ALLOW_ACTION,
    pm.testPermissionFromPrincipal(principalPrivateBrowsing, TEST_PERMISSION)
  );

  // Set permission for private browsing
  pm.addFromPrincipal(
    principalPrivateBrowsing,
    TEST_PERMISSION2,
    pm.DENY_ACTION
  );

  // Check private browsing permission
  Assert.equal(
    Ci.nsIPermissionManager.DENY_ACTION,
    pm.testPermissionFromPrincipal(principalPrivateBrowsing, TEST_PERMISSION2)
  );
  // private browsing => normal browsing
  Assert.equal(
    permIsolatePrivateBrowsing
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.DENY_ACTION,
    pm.testPermissionFromPrincipal(principal, TEST_PERMISSION2)
  );
  // private browsing => user context 1
  Assert.equal(
    permIsolatePrivateBrowsing || permIsolateUserContext
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.DENY_ACTION,
    pm.testPermissionFromPrincipal(principalUserContext1, TEST_PERMISSION2)
  );
  // private browsing => user context 2
  Assert.equal(
    permIsolatePrivateBrowsing || permIsolateUserContext
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.DENY_ACTION,
    pm.testPermissionFromPrincipal(principalUserContext2, TEST_PERMISSION2)
  );

  // Set permission for user context 1
  pm.addFromPrincipal(
    principalUserContext1,
    TEST_PERMISSION3,
    pm.PROMPT_ACTION
  );

  // Check user context 1 permission
  Assert.equal(
    Ci.nsIPermissionManager.PROMPT_ACTION,
    pm.testPermissionFromPrincipal(principalUserContext1, TEST_PERMISSION3)
  );

  // user context 1 => normal browsing
  Assert.equal(
    permIsolateUserContext
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.PROMPT_ACTION,
    pm.testPermissionFromPrincipal(principal, TEST_PERMISSION3)
  );
  // user context 1 => user context 2
  Assert.equal(
    permIsolateUserContext
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.PROMPT_ACTION,
    pm.testPermissionFromPrincipal(principalUserContext2, TEST_PERMISSION3)
  );
  // user context 1 => private browsing
  Assert.equal(
    permIsolatePrivateBrowsing || permIsolateUserContext
      ? Ci.nsIPermissionManager.UNKNOWN_ACTION
      : Ci.nsIPermissionManager.PROMPT_ACTION,
    pm.testPermissionFromPrincipal(principalPrivateBrowsing, TEST_PERMISSION3)
  );

  // Cleanup
  pm.removeAll();
}

add_task(async function do_test() {
  // Test all pref combinations and check if principals with different origin attributes
  // are isolated.
  testOAIsolation(true, true);
  testOAIsolation(true, false);
  testOAIsolation(false, true);
  testOAIsolation(false, false);
});
