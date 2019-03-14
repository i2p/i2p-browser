/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.torbootstrap;

import android.app.Activity;
import android.content.Context;
import android.support.v4.app.Fragment;
import android.support.v4.app.FragmentManager;
import android.support.v4.app.FragmentPagerAdapter;
import android.util.AttributeSet;
import android.view.View;
import android.view.ViewGroup;
import android.animation.Animator;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;

import org.mozilla.gecko.firstrun.FirstrunPager;

import java.util.List;

/**
 * ViewPager containing our bootstrapping pages.
 *
 * Based on FirstrunPager for simplicity
 */
public class TorBootstrapPager extends FirstrunPager {

    private Context context;
    private Activity mActivity;
    protected TorBootstrapPanel.PagerNavigation pagerNavigation;

    public TorBootstrapPager(Context context) {
        this(context, null);
    }

    public TorBootstrapPager(Context context, AttributeSet attrs) {
        super(context, attrs);
        this.context = context;
    }

    @Override
    public void addView(View child, int index, ViewGroup.LayoutParams params) {
        super.addView(child, index, params);
    }

    // Load the default (hard-coded) panels from TorBootstrapPagerConfig
    // Mostly copied from super
    public void load(Activity activity, FragmentManager fm, final TorBootstrapAnimationContainer.OnFinishListener onFinishListener) {
        mActivity = activity;
        final List<TorBootstrapPagerConfig.TorBootstrapPanelConfig> panels = TorBootstrapPagerConfig.getDefaultBootstrapPanel();

        setAdapter(new ViewPagerAdapter(fm, panels));
        this.pagerNavigation = new TorBootstrapPanel.PagerNavigation() {
            @Override
            public void next() {
                // No-op implementation.
            }

            @Override
            public void finish() {
                if (onFinishListener != null) {
                    onFinishListener.onFinish();
                }
            }
        };

        animateLoad();
    }

    // Copied from super
    private void animateLoad() {
        setTranslationY(500);
        setAlpha(0);

        final Animator translateAnimator = ObjectAnimator.ofFloat(this, "translationY", 0);
        translateAnimator.setDuration(400);

        final Animator alphaAnimator = ObjectAnimator.ofFloat(this, "alpha", 1);
        alphaAnimator.setStartDelay(200);
        alphaAnimator.setDuration(600);

        final AnimatorSet set = new AnimatorSet();
        set.playTogether(alphaAnimator, translateAnimator);
        set.setStartDelay(400);

        set.start();
    }

    // Provide an interface for inter-panel communication allowing
    // the logging panel to stop the bootstrapping animation on the
    // main panel.
    public interface TorBootstrapController {
        void startBootstrapping();
        void stopBootstrapping();
    }

    // Mostly copied from FirstrunPager
    protected class ViewPagerAdapter extends FragmentPagerAdapter implements TorBootstrapController {
        private final List<TorBootstrapPagerConfig.TorBootstrapPanelConfig> panels;
        private final Fragment[] fragments;

        public ViewPagerAdapter(FragmentManager fm, List<TorBootstrapPagerConfig.TorBootstrapPanelConfig> panels) {
            super(fm);
            this.panels = panels;
            this.fragments = getPagerPanels();
        }

        private Fragment[] getPagerPanels() {
            Fragment[] fragments = new Fragment[panels.size()];
            for (int i = 0; i < fragments.length; i++) {
                TorBootstrapPagerConfig.TorBootstrapPanelConfig panelConfig = panels.get(i);
                // We know the class is within the "org.mozilla.gecko.torbootstrap" package namespace
                fragments[i] = Fragment.instantiate(mActivity.getApplicationContext(), panelConfig.getClassname());
                ((TorBootstrapPanel) fragments[i]).setPagerNavigation(pagerNavigation);
                ((TorBootstrapPanel) fragments[i]).setContext(mActivity);
                ((TorBootstrapPanel) fragments[i]).setBootstrapController(this);
            }
            return fragments;
        }

        @Override
        public Fragment getItem(int i) {
            return fragments[i];
        }

        @Override
        public int getCount() {
            return panels.size();
        }

        public void startBootstrapping() {
            if (fragments.length == 0) {
                return;
            }

            TorBootstrapPanel mainPanel = (TorBootstrapPanel) getItem(0);
            if (mainPanel == null) {
                return;
            }
            mainPanel.startBootstrapping();
        }

        public void stopBootstrapping() {
            if (fragments.length == 0) {
                return;
            }

            TorBootstrapPanel mainPanel = (TorBootstrapPanel) getItem(0);
            if (mainPanel == null) {
                return;
            }
            mainPanel.stopBootstrapping();
        }
    }
}
