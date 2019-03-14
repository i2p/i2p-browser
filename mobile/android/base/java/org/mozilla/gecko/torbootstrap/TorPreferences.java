/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.torbootstrap;


import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.os.Bundle;
import android.preference.Preference;
import android.preference.PreferenceFragment;
import android.preference.PreferenceScreen;
import android.preference.SwitchPreference;
import android.support.v7.app.ActionBar;
import android.text.style.ClickableSpan;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.method.LinkMovementMethod;
import android.view.LayoutInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewGroup.LayoutParams;
import android.view.ViewParent;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.AdapterView;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Switch;
import android.widget.TextView;
import android.util.AttributeSet;
import android.util.Log;
import android.util.Xml;

import java.util.HashMap;
import java.util.List;
import java.util.Vector;

import org.mozilla.gecko.R;
import org.mozilla.gecko.preferences.AppCompatPreferenceActivity;

import org.torproject.android.service.util.Prefs;

import org.xmlpull.v1.XmlPullParser;

import static org.mozilla.gecko.preferences.GeckoPreferences.NON_PREF_PREFIX;


/** TorPreferences provides the Tor-related preferences
 *
 * We configure bridges using either a set of built-in bridges where the user enables
 * them based on bridge type (the name of the pluggable transport) or the user provides
 * their own bridge (obtained from another person or BridgeDB, etc).
 *
 * This class (TorPreferences) is divided into multiple Fragments (screens). The first
 * screen is where the user enables or disables Bridges. The second screen shows the
 * user a list of built-in bridge types (obfs4, meek, etc) where they may select one of
 * them. It shows a button they may press for providing their own bridge, as well. The
 * third screen is where the user may provide (copy/paste) their own bridge.
 *
 * On the first screen, if bridges are currently enabled, then the switch/toggle is
 * shown as enabled. In addition, the user is shown a message saying whether built-in or
 * provided bridges are being used. There is a link, labeled "Change", where they
 * transitioned to the appropriate screen for modifying the configuration if it is pressed.
 *
 * The second screen shows radio buttons for the built-in bridge types.
 *
 * The State of Bridges-Enabled:
 * There are a few moving parts here, a higher-level description of how we expect this
 * works, where "Enabled" is "Bridges Enabled", "Type" is "Bridge Type", and "Provided"
 * is "Bridge Provided":
 *
 * We have five preferences:
 *   PREFS_BRIDGES_ENABLED
 *   PREFS_BRIDGES_TYPE
 *   PREFS_BRIDGES_PROVIDE
 *   pref_bridges_enabled (tor-android-service)
 *   pref_bridges_list    (tor-android-service)
 *
 * These may be in following three end states where PREFS_BRIDGES_ENABLED and
 * pref_bridges_enabled must always match, and pref_bridges_list must either match
 * PREFS_BRIDGES_PROVIDE or contain type PREFS_BRIDGES_TYPE.
 *
 *   PREFS_BRIDGES_ENABLED=false
 *   PREFS_BRIDGES_TYPE=null
 *   PREFS_BRIDGES_PROVIDE=null
 *   pref_bridges_enabled=false
 *   pref_bridges_list=null
 *
 *   PREFS_BRIDGES_ENABLED=true
 *   PREFS_BRIDGES_TYPE=T1
 *   PREFS_BRIDGES_PROVIDE=null
 *   pref_bridges_enabled=true
 *   pref_bridges_list=T1
 *
 *   PREFS_BRIDGES_ENABLED=true
 *   PREFS_BRIDGES_TYPE=null
 *   PREFS_BRIDGES_PROVIDE=X2
 *   pref_bridges_enabled=true
 *   pref_bridges_list=X2
 *
 * There are transition states where this is not consistent, for example when the
 * "Bridges Enabled" switch is toggled but "Bridge Type" and "Bridge Provided" are null.
 */

public class TorPreferences extends AppCompatPreferenceActivity {
    private static final String LOGTAG = "TorPreferences";

    private static final String PREFS_BRIDGES_ENABLED = NON_PREF_PREFIX + "tor.bridges.enabled";
    private static final String PREFS_BRIDGES_TYPE = NON_PREF_PREFIX + "tor.bridges.type";
    private static final String PREFS_BRIDGES_PROVIDE = NON_PREF_PREFIX + "tor.bridges.provide";

    private static final String[] sTorPreferenceFragments = {TorPreferences.TorNetworkBridgesEnabledPreference.class.getName(),
                                                  TorPreferences.TorNetworkBridgeSelectPreference.class.getName(),
                                                  TorPreferences.TorNetworkBridgeProvidePreference.class.getName()};
    // Current displayed PreferenceFragment
    private TorNetworkPreferenceFragment mFrag;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Begin with the first (Enable Bridges) fragment
        getIntent().putExtra(EXTRA_SHOW_FRAGMENT, TorPreferences.TorNetworkBridgesEnabledPreference.class.getName());
        getIntent().putExtra(EXTRA_NO_HEADERS, true);
        super.onCreate(savedInstanceState);

        mFrag = null;
    }

    // Save the current preference when the app is minimized or swiped away.
    @Override
    public void onStop() {
        if (mFrag != null) {
            mFrag.onSaveState();
        }
        super.onStop();
    }

    // This is needed because launching a fragment fails if this
    // method doesn't return true.
    @Override
    protected boolean isValidFragment(String fragmentName) {
        for (String frag : sTorPreferenceFragments) {
            if (fragmentName.equals(frag)) {
                return true;
            }
        }
        Log.i(LOGTAG, "isValidFragment(): Returning false (" + fragmentName + ")");
        return false;
    }

    public void setFragment(TorNetworkPreferenceFragment frag) {
        mFrag = frag;
    }

    // Save the preference when the user returns to the previous screen using
    // the back button
    @Override
    public void onBackPressed() {
        if (mFrag != null) {
            mFrag.onSaveState();
        }
        super.onBackPressed();
    }

    // Control the behavior when the Up button (back button in top-left
    // corner) is pressed. Save the current preference and return to the
    // previous screen.
    @Override
    public boolean onNavigateUp() {
        super.onNavigateUp();

        if (mFrag == null) {
            Log.w(LOGTAG, "onNavigateUp(): mFrag is null");
            return false;
        }

        // Handle the user pressing the Up button in the same way as
        // we handle them pressing the Back button. Strictly, this
        // isn't correct, but it will prevent confusion.
        mFrag.onSaveState();

        if (mFrag.getFragmentManager().getBackStackEntryCount() > 0) {
            Log.i(LOGTAG, "onNavigateUp(): popping from backstatck");
            mFrag.getFragmentManager().popBackStack();
        } else {
            Log.i(LOGTAG, "onNavigateUp(): finishing activity");
            finish();
        }
        return true;
    }

    // Overriding this method is necessary because before Oreo the PreferenceActivity didn't
    // correctly handle the Home button (Up button). This was implemented in Oreo (Android 8+,
    // API 26+).
    // https://android.googlesource.com/platform/frameworks/base/+/6af15ebcfec64d0cc6879a0af9cfffd3e084ee73
    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item != null && item.getItemId() == android.R.id.home) {
            Log.i(LOGTAG, "onOptionsItemSelected(): Home");
            onNavigateUp();
            return true;
        }

        return super.onOptionsItemSelected(item);
    }

    // Helper abstract Fragment with common methods
    public static abstract class TorNetworkPreferenceFragment extends PreferenceFragment {
        protected TorPreferences mTorPrefAct;

        @Override
        public void onActivityCreated(Bundle savedInstanceState) {
            super.onActivityCreated(savedInstanceState);

            // This is only ever a TorPreferences
            mTorPrefAct = (TorPreferences) getActivity();
        }

        @Override
        public void onResume() {
            super.onResume();
            mTorPrefAct.setFragment(this);
        }

        // Implement this callback in child Fragments
        public void onSaveState() {
        }

        // Helper method for walking a View hierarchy and printing the children
        protected void walkViewTree(View view, int depth) {
            if (view instanceof ViewGroup) {
                ViewGroup vg = (ViewGroup) view;
                int childIdx = 0;
                for (; childIdx < vg.getChildCount(); childIdx++) {
                    walkViewTree(vg.getChildAt(childIdx), depth + 1);
                }
            }
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view: " + view);
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view id: " + view.getId());
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view is focused: " + view.isFocused());
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view is enabled: " + view.isEnabled());
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view is selected: " + view.isSelected());
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view is in touch mode: " + view.isInTouchMode());
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view is activated: " + view.isActivated());
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view is clickable: " + view.isClickable());
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view is focusable: " + view.isFocusable());
            Log.i(LOGTAG, "walkViewTree: " + depth + ": view is FocusableInTouchMode: " + view.isFocusableInTouchMode());
        }

        // Helper returning the ListView
        protected ListView getListView(View view) {
            if (!(view instanceof ViewGroup) || view == null) {
                return null;
            }

            View rawListView = view.findViewById(android.R.id.list);
            if (!(rawListView instanceof ListView) || rawListView == null) {
                return null;
            }

            return (ListView) rawListView;
        }

        // Get Bridges associated with the provided pref key saved in the
        // provided SharedPreferences. Return null if the SharedPreferences
        // is null or if there isn't any value associated with the pref.
        protected String getBridges(SharedPreferences sharedPrefs, String pref) {
            if (sharedPrefs == null) {
                Log.w(LOGTAG, "getBridges: sharedPrefs is null");
                return null;
            }
            return sharedPrefs.getString(pref, null);
        }

        // Save the bridge type and bridge line preferences.
        //
        // Save the bridgesType with the PREFS_BRIDGES_TYPE pref as the key
        // (for future lookup). If bridgesType is null, then save the
        // bridgesLines with the PREFS_BRIDGES_PROVIDE pref as the key, and
        // use tor-android-service's helper method and enable
        // tor-android-service's bridge pref.
        protected boolean setBridges(SharedPreferences.Editor editor, String bridgesType, String bridgesLines) {
            if (editor == null) {
                Log.w(LOGTAG, "setBridges: editor is null");
                return false;
            }
            Log.i(LOGTAG, "Saving bridge type preference: " + bridgesType);
            Log.i(LOGTAG, "Saving bridge line preference: " + bridgesLines);

            // If bridgesType is null, then clear the pref and save the bridgesLines
            // as a provided bridge. If bridgesType is not null, then save the type
            // but don't save it as a provided bridge.
            editor.putString(PREFS_BRIDGES_TYPE, bridgesType);
            if (bridgesType == null) {
                editor.putString(PREFS_BRIDGES_PROVIDE, bridgesLines);
            } else {
                editor.putString(PREFS_BRIDGES_PROVIDE, null);
            }

            if (!editor.commit()) {
                return false;
            }

            // Set tor-android service's preference
            Prefs.setBridgesList(bridgesLines);

            // If either of these are not null, then we're enabling bridges
            boolean bridgesAreEnabled = (bridgesType != null) || (bridgesLines != null);
            // Inform tor-android-service bridges are enabled
            Prefs.putBridgesEnabled(bridgesAreEnabled);
            return true;
        }

        // Disable the bridges.enabled Preference
        protected void disableBridges(PreferenceFragment frag) {
            if (frag == null) {
                Log.w(LOGTAG, "disableBridges: frag is null");
                return;
            }

            SwitchPreference bridgesEnabled = (SwitchPreference) frag.findPreference(PREFS_BRIDGES_ENABLED);
            Preference bridgesType = frag.findPreference(PREFS_BRIDGES_TYPE);
            Preference bridgesProvide = frag.findPreference(PREFS_BRIDGES_PROVIDE);
            Preference pref = null;

            if (bridgesEnabled != null) {
                Log.i(LOGTAG, "disableBridges: bridgesEnabled is not null");
                pref = bridgesEnabled;
            } else if (bridgesType != null) {
                Log.i(LOGTAG, "disableBridges: bridgesType is not null");
                pref = bridgesType;
            } else if (bridgesProvide != null) {
                Log.i(LOGTAG, "disableBridges: bridgesProvide is not null");
                pref = bridgesProvide;
            } else {
                Log.w(LOGTAG, "disableBridges: all of the expected preferences are null?");
                return;
            }

            // Clear the saved prefs (it's okay we're using a different
            // SharedPreference.Editor here, they modify the same backend).
            // In addition, passing null is equivalent to clearing the
            // preference.
            setBridges(pref.getEditor(), null, null);

            if (bridgesEnabled != null) {
                bridgesEnabled.setChecked(false);
            }
        }

        // Set the current title
        protected void setTitle(int resId) {
            ActionBar actionBar = mTorPrefAct.getSupportActionBar();

            if (actionBar == null) {
                Log.w(LOGTAG, "setTitle: actionBar is null");
                return;
            }

            actionBar.setTitle(resId);
        }
    }

    // Fragment implementing the screen for enabling Bridges
    public static class TorNetworkBridgesEnabledPreference extends TorNetworkPreferenceFragment {

        @Override
        public void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            addPreferencesFromResource(R.xml.preferences_tor_network_main);
        }

        // This class is instantiated within the OnClickListener of the
        // PreferenceSwitch's Switch widget
        public class BridgesEnabledSwitchOnClickListener implements View.OnClickListener {
                @Override
                public void onClick(View v) {
                    Log.i(LOGTAG, "bridgesEnabledSwitch clicked");
                    if (!(v instanceof Switch)) {
                        Log.w(LOGTAG, "View isn't an instance of Switch?");
                        return;
                    }

                    Switch bridgesEnabledSwitch = (Switch) v;

                    // The widget was pressed, now find the preference and set it
                    // such that it is synchronized with the widget.
                    final SwitchPreference bridgesEnabled = (SwitchPreference) TorNetworkBridgesEnabledPreference.this.findPreference(PREFS_BRIDGES_ENABLED);
                    if (bridgesEnabled == null) {
                        Log.w(LOGTAG, "onClick: bridgesEnabled is null?");
                        return;
                    }

                    bridgesEnabled.setChecked(bridgesEnabledSwitch.isChecked());

                    // Only launch the Fragment if we're enabling bridges.
                    if (bridgesEnabledSwitch.isChecked()) {
                        TorNetworkBridgesEnabledPreference.this.mTorPrefAct.startPreferenceFragment(new TorNetworkBridgeSelectPreference(), true);
                    } else {
                        disableBridges(TorNetworkBridgesEnabledPreference.this);
                    }
                }
        }

        // This method must be overridden because, when creating Preferences, the
        // creation of the View hierarchy occurs asynchronously. Usually
        // onCreateView() gives us the View hierarchy as it is defined in the XML layout.
        // However, with Preferences the layout is created across multiple threads and it
        // usually isn't available at the time onCreateView() or onViewCreated() are
        // called. As a result, we find the ListView (which is almost guaranteed to exist
        // at this time) and we add an OnHierarchyChangeListener where we wait until the
        // children are added into the tree.
        @Override
        public void onViewCreated(View view, Bundle savedInstanceState) {
            super.onViewCreated(view, savedInstanceState);

            final SwitchPreference bridgesEnabled = (SwitchPreference) findPreference(PREFS_BRIDGES_ENABLED);
            if (bridgesEnabled == null) {
                Log.w(LOGTAG, "onViewCreated: bridgesEnabled is null?");
                return;
            }

            // If we return from either of the "Select Bridge Type" screen
            // or "Provide Bridge" screen without selecting or inputing
            // any value, then we could arrive here without any bridge
            // saved/enabled but this switch is enabled. Disable it.
            if (!Prefs.bridgesEnabled()) {
                bridgesEnabled.setChecked(false);
            }

            // Decide if the configured bridges were provided by the user or
            // selected from the list of bridge types
            if (isBridgeProvided(bridgesEnabled)) {
                String newSummary = getString(R.string.pref_tor_network_bridges_enabled_change_custom);
                setBridgesEnabledSummaryAndOnClickListener(bridgesEnabled, newSummary, true);
            } else if (Prefs.bridgesEnabled()) {
                // If isBridgeProvided() returned false, but Prefs.bridgesEnabled() returns true.
                // This means we have bridges, but they weren't provided by the user - therefore
                // they must be built-in bridges.
                String newSummary = getString(R.string.pref_tor_network_bridges_enabled_change_builtin);
                setBridgesEnabledSummaryAndOnClickListener(bridgesEnabled, newSummary, false);
            }

            ListView lv = getListView(view);
            if (lv == null) {
                Log.i(LOGTAG, "onViewCreated: ListView not found");
                return;
            }

            lv.setOnHierarchyChangeListener(new ViewGroup.OnHierarchyChangeListener() {

                @Override
                public void onChildViewAdded(View parent, View child) {
                    Log.i(LOGTAG, "onChildViewAdded: Adding ListView child view");

                    setTitle(R.string.pref_tor_network_title);

                    // Make sure the Switch widget is synchronized with the preference
                    final Switch bridgesEnabledSwitch =
                        (Switch) parent.findViewById(android.R.id.switch_widget);

                    if (bridgesEnabledSwitch != null) {
                        bridgesEnabledSwitch.setChecked(bridgesEnabled.isChecked());

                        // When the Switch is pressed by the user, either load the next
                        // fragment (where the user chooses a bridge type), or return to
                        // the main bootstrapping screen.
                        bridgesEnabledSwitch.setOnClickListener(new BridgesEnabledSwitchOnClickListener());
                    }

                    final TextView bridgesEnabledSummary =
                                (TextView) parent.findViewById(android.R.id.summary);
                    if (bridgesEnabledSummary == null) {
                        Log.w(LOGTAG, "Bridge Enabled Summary is null, we can't enable the span");
                        return;
                    }

                    // Make the ClickableSpan clickable within the TextView.
                    // This is a requirement for using a ClickableSpan in
                    // setBridgesEnabledSummaryAndOnClickListener().
                    bridgesEnabledSummary.setMovementMethod(LinkMovementMethod.getInstance());
               }

                @Override
                public void onChildViewRemoved(View parent, View child) {
                }
            });
        }

        // This is a common OnClickListener for when the user clicks on the Change link.
        // The span won't be clickable until the MovementMethod is set. This happens in
        // onViewCreated within the OnHierarchyChangeListener we set on the ListView.
        private void setBridgesEnabledSummaryAndOnClickListener(SwitchPreference bridgesEnabled, final String newSummary, final boolean custom) {
            Log.i(LOGTAG, "Bridge Summary clicked");
            if (bridgesEnabled == null) {
                Log.w(LOGTAG, "Bridge Enabled switch is null");
                return;
            }

            // Here we obtain the correct text, based on whether the bridges
            // were provided (custom) or built-in. Using that text, we create
            // a spannable string and find the substring "Change" within it.
            // If it exists, we make that substring clickable.
            // Note: TODO This breaks with localization.
            if (newSummary == null) {
                Log.w(LOGTAG, "R.string.pref_tor_network_bridges_enabled_change_builtin is null");
                return;
            }
            int changeStart = newSummary.indexOf("Change");
            if (changeStart == -1) {
                Log.w(LOGTAG, "R.string.pref_tor_network_bridges_enabled_change_builtin doesn't contain 'Change'");
                return;
            }
            SpannableString newSpannableSummary = new SpannableString(newSummary);
            newSpannableSummary.setSpan(new ClickableSpan() {
                @Override
                public void onClick(View v) {
                    // If a custom (provided) bridge is configured, then
                    // open the BridgesProvide preference fragment. Else,
                    // open the built-in/bridge-type fragment.
                    Log.i(LOGTAG, "Span onClick!");

                    // Add this Fragment regardless of which Fragment we're showing next. If the Change
                    // link goes to the built-in bridges, then this is what we show the user. If the Change
                    // link goes to the provided bridges, then we consider this a deep-link and we inject the
                    // built-in bridges screen into the backstack so they are shown it when they press Back
                    // from the provided-bridges screen.
                    mTorPrefAct.startPreferenceFragment(new
                            TorNetworkBridgeSelectPreference(), true);

                    if (custom) {
                        mTorPrefAct.startPreferenceFragment(new
                                TorNetworkBridgeProvidePreference(), true);
                    }
                }
            },
            // Begin the span
            changeStart,
            // End the span
            newSummary.length(),
            // Don't include new characters added into the spanned substring
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);

            bridgesEnabled.setSummaryOn(newSpannableSummary);
        }

        // We follow this logic:
        //   If the bridgesEnabled switch is off, then false
        //   If tor-android-service doesn't have bridges enabled, then false
        //   If PREFS_BRIDGES_PROVIDE is not null, then true
        //   Else false
        private boolean isBridgeProvided(SwitchPreference bridgesEnabled) {
            if (bridgesEnabled == null) {
                Log.i(LOGTAG, "isBridgeProvided: bridgesEnabled is null");
                return false;
            }

            if (!bridgesEnabled.isChecked()) {
                Log.i(LOGTAG, "isBridgeProvided: bridgesEnabled is not checked");
                return false;
            }

            if (!Prefs.bridgesEnabled()) {
                Log.i(LOGTAG, "isBridgeProvided: bridges are not enabled");
                return false;
            }
            SharedPreferences sharedPrefs = bridgesEnabled.getSharedPreferences();
            boolean hasBridgeProvide =
                sharedPrefs.getString(PREFS_BRIDGES_PROVIDE, null) != null;

            Log.i(LOGTAG, "isBridgeProvided: We have provided bridges: " + hasBridgeProvide);
            return hasBridgeProvide;
        }
    }

    // Fragment implementing the screen for selecting a built-in Bridge type
    public static class TorNetworkBridgeSelectPreference extends TorNetworkPreferenceFragment {

        @Override
        public void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            addPreferencesFromResource(R.xml.preferences_tor_network_select_bridge_type);
        }

        // Add OnClickListeners after the View is created
        @Override
        public void onViewCreated(View view, Bundle savedInstanceState) {
            super.onViewCreated(view, savedInstanceState);

            ListView lv = getListView(view);
            if (lv == null) {
                Log.i(LOGTAG, "onViewCreated: ListView not found");
                return;
            }

            // Configure onClick handler for "Provide a Bridge" button
            lv.setOnHierarchyChangeListener(new ViewGroup.OnHierarchyChangeListener() {

                @Override
                public void onChildViewAdded(View parent, View child) {
                    setTitle(R.string.pref_tor_select_a_bridge_title);

                    // Set the previously chosen RadioButton as checked
                    final RadioGroup group = getBridgeTypeRadioGroup();
                    if (group == null) {
                        Log.w(LOGTAG, "Radio Group is null");
                        return;
                    }

                    final View titleAndSummaryView = parent.findViewById(R.id.title_and_summary);
                    if (titleAndSummaryView == null) {
                        Log.w(LOGTAG, "title and summary view is null");
                        group.setVisibility(View.VISIBLE);
                        return;
                    }

                    titleAndSummaryView.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            group.setVisibility(View.VISIBLE);
                        }
                    });

                    final View provideABridge = parent.findViewById(R.id.tor_network_provide_a_bridge);
                    if (provideABridge == null) {
                        return;
                    }

                    provideABridge.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            Log.i(LOGTAG, "bridgesProvide clicked");
                            saveCurrentCheckedRadioButton();

                            mTorPrefAct.startPreferenceFragment(new TorNetworkBridgeProvidePreference(), true);
                        }
                    });

                    final TextView provideABridgeSummary = (TextView) parent.findViewById(R.id.tor_network_provide_a_bridge_summary);
                    if (provideABridgeSummary == null) {
                        Log.i(LOGTAG, "provideABridgeSummary is null");
                        return;
                    }

                    Preference bridgesTypePref = findPreference(PREFS_BRIDGES_TYPE);
                    if (bridgesTypePref == null) {
                        return;
                    }

                    SharedPreferences sharedPrefs = bridgesTypePref.getSharedPreferences();
                    String provideBridges = sharedPrefs.getString(PREFS_BRIDGES_PROVIDE, null);
                    if (provideBridges != null) {
                        if (provideBridges.indexOf("\n") != -1) {
                            provideABridgeSummary.setText(R.string.pref_tor_network_using_multiple_provided_bridges);
                        } else {
                            String summary = getString(R.string.pref_tor_network_using_a_provided_bridge, provideBridges);
                            provideABridgeSummary.setText(summary);
                        }
                    }

                    final String configuredBridgeType = getBridges(bridgesTypePref.getSharedPreferences(), PREFS_BRIDGES_TYPE);
                    if (configuredBridgeType == null) {
                        return;
                    }

                    int buttonId = -1;
                    // Note: Keep these synchronized with the layout xml file.
                    switch (configuredBridgeType) {
                        case "obfs4":
                            buttonId = R.id.radio_pref_bridges_obfs4;
                            break;
                        case "meek":
                            buttonId = R.id.radio_pref_bridges_meek_azure;
                            break;
                        case "obfs3":
                            buttonId = R.id.radio_pref_bridges_obfs3;
                            break;
                    }

                    if (buttonId != -1) {
                        group.check(buttonId);
                        // If a bridge is selected, then make the list visible
                        group.setVisibility(View.VISIBLE);
                    }
                }

                @Override
                public void onChildViewRemoved(View parent, View child) {
                }
            });

        }

        // Save the checked RadioButton in the SharedPreferences
        private boolean saveCurrentCheckedRadioButton() {
            ListView lv = getListView(getView());
            if (lv == null) {
                Log.w(LOGTAG, "ListView is null");
                return false;
            }

            RadioGroup group = getBridgeTypeRadioGroup();
            if (group == null) {
                Log.w(LOGTAG, "RadioGroup is null");
                return false;
            }

            int checkedId = group.getCheckedRadioButtonId();
            RadioButton selectedBridgeType = lv.findViewById(checkedId);
            if (selectedBridgeType == null) {
                Log.w(LOGTAG, "RadioButton is null");
                return false;
            }

            String bridgesType = selectedBridgeType.getText().toString();
            if (bridgesType == null) {
                // We don't know with which bridgesType this Id is associated
                Log.w(LOGTAG, "RadioButton has null text");
                return false;
            }

            // Currently obfs4 is the recommended pluggable transport. As a result,
            // the text contains " (recommended)". This won't be expected elsewhere,
            // so replace the string with only the pluggable transport name.
            // This will need updating when another transport is "recommended".
            //
            // Similarly, if meek-azure is chosen, substitute it with "meek"
            // (tor-android-service only handles these keywords specially if
            // they are less than 5 characters).
            if (bridgesType.contains("obfs4")) {
                bridgesType = "obfs4";
            } else if (bridgesType.contains("meek-azure")) {
                bridgesType = "meek";
            }

            Preference bridgesTypePref = findPreference(PREFS_BRIDGES_TYPE);
            if (bridgesTypePref == null) {
                Log.w(LOGTAG, PREFS_BRIDGES_TYPE + " preference not found");
                disableBridges(this);
                return false;
            }

            if (!setBridges(bridgesTypePref.getEditor(), bridgesType, bridgesType)) {
                Log.w(LOGTAG, "Saving Bridge preference failed.");
                disableBridges(this);
                return false;
            }

            return true;
        }

        // Handle onSaveState when the user presses Back. Save the selected
        // built-in bridge type.
        @Override
        public void onSaveState() {
            saveCurrentCheckedRadioButton();
        }

        // Find the RadioGroup within the View hierarchy now.
        private RadioGroup getBridgeTypeRadioGroup() {
            ListView lv = getListView(getView());
            if (lv == null) {
                Log.w(LOGTAG, "ListView is null");
                return null;
            }
            ViewParent listViewParent = lv.getParent();
            // If the parent of this ListView isn't a View, then
            // the RadioGroup doesn't exist
            if (!(listViewParent instanceof View)) {
                Log.w(LOGTAG, "ListView's parent isn't a View. Failing");
                return null;
            }
            View lvParent = (View) listViewParent;
            // Find the RadioGroup with this View hierarchy.
            return (RadioGroup) lvParent.findViewById(R.id.pref_radio_group_builtin_bridges_type);
        }
    }

    // Fragment implementing the screen for providing a Bridge
    public static class TorNetworkBridgeProvidePreference extends TorNetworkPreferenceFragment {
        @Override
        public void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            addPreferencesFromResource(R.xml.preferences_tor_network_provide_bridge);
        }

        // If there is a provided bridge saved in the preference,
        // then fill-in the text field with that value.
        private void setBridgeProvideText(View parent) {
            final View provideBridge1 = parent.findViewById(R.id.tor_network_provide_bridge1);
            final View provideBridge2 = parent.findViewById(R.id.tor_network_provide_bridge2);
            final View provideBridge3 = parent.findViewById(R.id.tor_network_provide_bridge3);

            EditText provideBridge1ET = null;
            EditText provideBridge2ET = null;
            EditText provideBridge3ET = null;

            if (provideBridge1 != null) {
                if (provideBridge1 instanceof EditText) {
                    provideBridge1ET = (EditText) provideBridge1;
                }
            }

            if (provideBridge2 != null) {
                if (provideBridge2 instanceof EditText) {
                    provideBridge2ET = (EditText) provideBridge2;
                }
            }

            if (provideBridge3 != null) {
                if (provideBridge3 instanceof EditText) {
                    provideBridge3ET = (EditText) provideBridge3;
                }
            }

            Preference bridgesProvide = findPreference(PREFS_BRIDGES_PROVIDE);
            if (bridgesProvide != null) {
                Log.i(LOGTAG, "setBridgeProvideText: bridgesProvide isn't null");
                String bridgesLines = getBridges(bridgesProvide.getSharedPreferences(), PREFS_BRIDGES_PROVIDE);
                if (bridgesLines != null) {
                    Log.i(LOGTAG, "setBridgeProvideText: bridgesLines isn't null");
                    if (bridgesLines.contains("\n")) {
                        String[] lines = bridgesLines.split("\n");
                        if (provideBridge1ET != null && lines.length >= 1) {
                            provideBridge1ET.setText(lines[0]);
                        }
                        if (provideBridge2ET != null && lines.length >= 2) {
                            provideBridge2ET.setText(lines[1]);
                        }
                        if (provideBridge3ET != null && lines.length >= 3) {
                            provideBridge3ET.setText(lines[2]);
                        }
                    } else {
                        // Simply set the single line as the text field input if the text field exists.
                        if (provideBridge1ET != null) {
                            provideBridge1ET.setText(bridgesLines);
                        }
                    }
                }
            }
        }

        // See explanation of TorNetworkBridgesEnabledPreference.onViewCreated()
        @Override
        public void onViewCreated(View view, Bundle savedInstanceState) {
            super.onViewCreated(view, savedInstanceState);
            ListView lv = getListView(view);
            if (lv == null) {
                Log.i(LOGTAG, "onViewCreated: ListView not found");
                return;
            }
            // The ListView is given "focus" by default when the EditText
            // field is selected, this prevents typing anything into the field.
            // We set FOCUS_AFTER_DESCENDANTS so the ListView's children are
            // given focus (and, therefore, the EditText) before it is
            // given focus.
            lv.setDescendantFocusability(ViewGroup.FOCUS_AFTER_DESCENDANTS);

            // The preferences are adding into the ListView hierarchy asynchronously.
            // We need the onChildViewAdded callback so we can modify the layout after
            // the child is added.
            lv.setOnHierarchyChangeListener(new ViewGroup.OnHierarchyChangeListener() {
                @Override
                public void onChildViewAdded(View parent, View child) {
                    setTitle(R.string.pref_tor_provide_a_bridge_title);

                    // If we have a bridge line saved for this pref,
                    // then show the user
                    setBridgeProvideText(parent);
                }

                @Override
                public void onChildViewRemoved(View parent, View child) {
                }
            });
        }

        private String getBridgeLineFromView(View provideBridge) {
            if (provideBridge != null) {
                if (provideBridge instanceof EditText) {
                    Log.i(LOGTAG, "onSaveState: Saving bridge");
                    EditText provideBridgeET = (EditText) provideBridge;

                    // Get the bridge line (provided text) from the text
                    // field.
                    String bridgesLine = provideBridgeET.getText().toString();
                    if (bridgesLine != null && !bridgesLine.equals("")) {
                        return bridgesLine;
                    }
                } else {
                    Log.w(LOGTAG, "onSaveState: provideBridge isn't an EditText");
                }
            }
            return null;
        }

        // Save EditText field value when the Back button or Up button are pressed.
        @Override
        public void onSaveState() {
            ListView lv = getListView(getView());
            if (lv == null) {
                Log.i(LOGTAG, "onSaveState: ListView not found");
                return;
            }

            final View provideBridge1 = lv.findViewById(R.id.tor_network_provide_bridge1);
            final View provideBridge2 = lv.findViewById(R.id.tor_network_provide_bridge2);
            final View provideBridge3 = lv.findViewById(R.id.tor_network_provide_bridge3);

            String bridgesLines = null;
            String bridgesLine1 = getBridgeLineFromView(provideBridge1);
            String bridgesLine2 = getBridgeLineFromView(provideBridge2);
            String bridgesLine3 = getBridgeLineFromView(provideBridge3);

            if (bridgesLine1 != null) {
                Log.i(LOGTAG, "bridgesLine1 is not null.");
                bridgesLines = bridgesLine1;
            }

            if (bridgesLine2 != null) {
                Log.i(LOGTAG, "bridgesLine2 is not null.");
                if (bridgesLines != null) {
                    // If bridgesLine1 was not null, then append a newline.
                    bridgesLines += "\n" + bridgesLine2;
                } else {
                    bridgesLines = bridgesLine2;
                }
            }

            if (bridgesLine3 != null) {
                Log.i(LOGTAG, "bridgesLine3 is not null.");
                if (bridgesLines != null) {
                    // If bridgesLine1 or bridgesLine2 were not null, then append a newline.
                    bridgesLines += "\n" + bridgesLine3;
                } else {
                    bridgesLines = bridgesLine3;
                }
            }

            Preference bridgesProvide = findPreference(PREFS_BRIDGES_PROVIDE);
            if (bridgesProvide == null) {
                Log.w(LOGTAG, PREFS_BRIDGES_PROVIDE + " preference not found");
                disableBridges(this);
                return;
            }

            if (bridgesLines == null) {
                // If provided bridges are null/empty, then only disable all bridges if
                // the user did not select a built-in bridge
                String configuredBuiltinBridges = getBridges(bridgesProvide.getSharedPreferences(), PREFS_BRIDGES_TYPE);
                if (configuredBuiltinBridges == null) {
                    Log.i(LOGTAG, "Custom bridges are empty. Disabling.");
                    disableBridges(this);
                }
                return;
            }

            // Set the preferences (both our preference and
            // tor-android-service's preference)
            Log.w(LOGTAG, "Saving Bridge preference: " + bridgesLines);
            if (!setBridges(bridgesProvide.getEditor(), null, bridgesLines)) {
                // TODO inform the user
                Log.w(LOGTAG, "Saving Bridge preference failed.");
                disableBridges(this);
            }
        }
    }
}
