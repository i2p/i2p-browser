/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

package org.mozilla.gecko;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.mozilla.gecko.background.testhelpers.TestRunner;
import org.mozilla.gecko.AppConstants;

import static org.junit.Assert.*;

@RunWith(TestRunner.class)
public class I2PBrowserTest {
    /**
     * Tests the compile-time constants are set.
     */
    @Test
    public void testIsI2PBrowser() {
        assertTrue(AppConstants.isI2PBrowser());
    }

    @Test
    public void testI2PBrowserVersion() {
        assertEquals(AppConstants.I2P_BROWSER_VERSION, "9.0");
    }
}
