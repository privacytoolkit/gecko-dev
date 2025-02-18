package org.mozilla.geckoview.test

import android.support.test.InstrumentationRegistry
import android.support.test.filters.MediumTest
import android.support.test.runner.AndroidJUnit4
import android.util.Log
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mozilla.geckoview.BuildConfig
import org.mozilla.geckoview.test.rule.GeckoSessionTestRule.IgnoreCrash
import org.mozilla.geckoview.test.rule.GeckoSessionTestRule.Setting
import org.mozilla.geckoview.test.rule.GeckoSessionTestRule.WithDisplay
import org.mozilla.geckoview.test.util.Callbacks


@RunWith(AndroidJUnit4::class)
@MediumTest
class ContentCrashTest : BaseSessionTest() {
    val client = TestCrashHandler.Client(InstrumentationRegistry.getTargetContext())

    @Before
    fun setup() {
        assertTrue(client.connect(env.defaultTimeoutMillis))
        client.setEvalNextCrashDump(/* expectFatal */ false)
    }

    @IgnoreCrash
    @Test
    fun crashContent() {
        assumeTrue(sessionRule.env.isMultiprocess)
        // We need the crash reporter for this test
        assumeTrue(BuildConfig.MOZ_CRASHREPORTER)

        mainSession.loadUri(CONTENT_CRASH_URL)
        mainSession.waitUntilCalled(Callbacks.ContentDelegate::class, "onCrash")

        // This test is really slow so we allow double the usual timeout
        var evalResult = client.getEvalResult(env.defaultTimeoutMillis * 2)
        assertTrue(evalResult.mMsg, evalResult.mResult)
    }

    @After
    fun teardown() {
        client.disconnect()
    }
}
