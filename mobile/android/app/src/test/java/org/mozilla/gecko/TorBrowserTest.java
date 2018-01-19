/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

package org.mozilla.gecko;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.mozilla.gecko.background.testhelpers.TestRunner;
import org.mozilla.gecko.AppConstants;

import static org.junit.Assert.*;

@RunWith(TestRunner.class)
public class TorBrowserTest {
    /**
     * Tests the compile-time constants are set.
     */
    @Test
    public void testIsTorBrowser() {
        assertTrue(AppConstants.isTorBrowser());
    }

    @Test
    public void testTorBrowserVersion() {
        assertEquals(AppConstants.TOR_BROWSER_VERSION, "8.0");
    }
}
