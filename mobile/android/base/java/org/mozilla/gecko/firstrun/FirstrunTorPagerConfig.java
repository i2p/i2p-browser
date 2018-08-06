/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.firstrun;

import android.content.Context;
import android.os.Bundle;
import android.util.Log;
import org.mozilla.gecko.GeckoSharedPrefs;
import org.mozilla.gecko.R;
import org.mozilla.gecko.Telemetry;
import org.mozilla.gecko.TelemetryContract;
import org.mozilla.gecko.Experiments;

import java.util.LinkedList;
import java.util.List;

public class FirstrunTorPagerConfig {
    public static final String LOGTAG = "FirstrunPagerConfigTor";

    public static final String KEY_IMAGE = "imageRes";
    public static final String KEY_TEXT = "textRes";
    public static final String KEY_SUBTEXT = "subtextRes";

    public static List<FirstrunTorPanelConfig> getDefault(Context context) {
       final List<FirstrunTorPanelConfig> panels = new LinkedList<>();
       panels.add(SimplePanelConfigs.welcomeTorPanelConfig);
       panels.add(SimplePanelConfigs.privacyPanelConfig);
       panels.add(SimplePanelConfigs.torNetworkPanelConfig);
       panels.add(SimplePanelConfigs.tipsPanelConfig);
       panels.add(SimplePanelConfigs.onionServicesPanelConfig);

       return panels;
    }

    public static class FirstrunTorPanelConfig {

        private String classname;
        private int titleRes;
        private Bundle args;

        public FirstrunTorPanelConfig(String classname, int titleRes, int imageRes, int textRes, int subtextRes) {
            this.classname = classname;
            this.titleRes = titleRes;

            this.args = new Bundle();
            this.args.putInt(KEY_IMAGE, imageRes);
            this.args.putInt(KEY_TEXT, textRes);
            this.args.putInt(KEY_SUBTEXT, subtextRes);
        }

        public String getClassname() {
            return this.classname;
        }

        public int getTitleRes() {
            return this.titleRes;
        }

        public Bundle getArgs() {
            return args;
        }
    }

    private static class SimplePanelConfigs {
        public static final FirstrunTorPanelConfig welcomeTorPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_welcome_tab_title, R.drawable.figure_welcome, R.string.firstrun_welcome_title, R.string.firstrun_welcome_message);
        public static final FirstrunTorPanelConfig privacyPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_privacy_tab_title, R.drawable.figure_privacy, R.string.firstrun_privacy_title, R.string.firstrun_privacy_message);
        public static final FirstrunTorPanelConfig torNetworkPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_tornetwork_tab_title, R.drawable.figure_network, R.string.firstrun_tornetwork_title, R.string.firstrun_tornetwork_message);
        public static final FirstrunTorPanelConfig tipsPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_tips_tab_title, R.drawable.figure_experience, R.string.firstrun_tips_title, R.string.firstrun_tips_message);
        public static final FirstrunTorPanelConfig onionServicesPanelConfig = new FirstrunTorPanelConfig(LastPanel.class.getName(), R.string.firstrun_onionservices_tab_title, R.drawable.figure_onion, R.string.firstrun_onionservices_title, R.string.firstrun_onionservices_message);
    }
}
