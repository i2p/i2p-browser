/* -*- Mode: Java; c-basic-offset: 4; tab-width: 20; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
package org.mozilla.gecko.activitystream.homepanel;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import org.mozilla.gecko.GeckoSharedPrefs;
import org.mozilla.gecko.R;
import org.mozilla.gecko.Telemetry;
import org.mozilla.gecko.TelemetryContract;
import org.mozilla.gecko.home.HomeFragment;

/**
 * Simple wrapper around the ActivityStream view that allows embedding as a HomePager panel.
 */
public class ActivityStreamHomeFragment
        extends HomeFragment implements SharedPreferences.OnSharedPreferenceChangeListener {
    private ActivityStreamPanel activityStreamPanel;

    private boolean isSessionActive;
    private SharedPreferences sharedPreferences;

    @Override
    public void onAttach(Activity activity) {
        super.onAttach(activity);
        sharedPreferences = GeckoSharedPrefs.forProfile(getContext());
        sharedPreferences.registerOnSharedPreferenceChangeListener(this);
    }

    @Override
    public void onDetach() {
        super.onDetach();
        sharedPreferences.unregisterOnSharedPreferenceChangeListener(this);
    }

    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String s) {
        final boolean shouldReload = TextUtils.equals(s, ActivityStreamPanel.PREF_BOOKMARKS_ENABLED)
                || TextUtils.equals(s, ActivityStreamPanel.PREF_VISITED_ENABLED)
                || TextUtils.equals(s, ActivityStreamPanel.PREF_POCKET_ENABLED)
                || TextUtils.equals(s, ActivityStreamPanel.PREF_USER_DISMISSED_SIGNIN);

        if (shouldReload) {
            activityStreamPanel.reload(getLoaderManager(), getContext(), sharedPreferences);
        }

    }

    @Override
    protected void load() {
        activityStreamPanel.load(getLoaderManager());
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        if (activityStreamPanel == null) {
            activityStreamPanel = (ActivityStreamPanel) inflater.inflate(R.layout.activity_stream, container, false);
            activityStreamPanel.setOnUrlOpenListeners(mUrlOpenListener, mUrlOpenInBackgroundListener);
        }

        return activityStreamPanel;
    }

    @Override
    public void setUserVisibleHint(boolean isVisibleToUser) {
        super.setUserVisibleHint(isVisibleToUser);

        if (isVisibleToUser) {
            sendPanelShownTelemetry();
        } else {
            sendPanelHiddenTelemetry();
        }
    }

    @Override
    public void onResume() {
        super.onResume();

        if (!isSessionActive && getUserVisibleHint()) {
            // The activity is being resumed and we are showing the panel again: Start session.
            sendPanelShownTelemetry();
        }
    }

    @Override
    public void onPause() {
        super.onPause();

        // User is navigating away from activity (to other app or settings). Stop the session.
        sendPanelHiddenTelemetry();
    }

    private void sendPanelHiddenTelemetry() {
        if (isSessionActive) {
            Telemetry.sendUIEvent(TelemetryContract.Event.CANCEL, TelemetryContract.Method.PANEL, "as_newtab");

            Telemetry.stopUISession(TelemetryContract.Session.ACTIVITY_STREAM, "newtab");

            isSessionActive = false;
        }
    }

    private void sendPanelShownTelemetry() {
        Telemetry.startUISession(TelemetryContract.Session.ACTIVITY_STREAM, "newtab");

        Telemetry.sendUIEvent(TelemetryContract.Event.SHOW, TelemetryContract.Method.PANEL, "as_newtab");

        isSessionActive = true;
    }
}
