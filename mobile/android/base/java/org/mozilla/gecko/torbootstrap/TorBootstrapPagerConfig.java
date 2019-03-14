/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.torbootstrap;

import android.util.Log;
import org.mozilla.gecko.GeckoSharedPrefs;

import java.util.LinkedList;
import java.util.List;

public class TorBootstrapPagerConfig {
    public static final String LOGTAG = "TorBootstrapPagerConfig";

    public static final String KEY_IMAGE = "imageRes";
    public static final String KEY_TEXT = "textRes";
    public static final String KEY_SUBTEXT = "subtextRes";
    public static final String KEY_CTATEXT = "ctatextRes";

    public static List<TorBootstrapPanelConfig> getDefaultBootstrapPanel() {
         final List<TorBootstrapPanelConfig> panels = new LinkedList<>();
         panels.add(SimplePanelConfigs.bootstrapPanelConfig);
         panels.add(SimplePanelConfigs.torLogPanelConfig);

         return panels;
    }

    public static class TorBootstrapPanelConfig {

        private String classname;

        public TorBootstrapPanelConfig(String classname) {
            this.classname = classname;
        }

        public String getClassname() {
            return this.classname;
        }
    }

    private static class SimplePanelConfigs {
        public static final TorBootstrapPanelConfig bootstrapPanelConfig = new TorBootstrapPanelConfig(TorBootstrapPanel.class.getName());
        public static final TorBootstrapPanelConfig torLogPanelConfig = new TorBootstrapPanelConfig(TorBootstrapLogPanel.class.getName());

    }
}
