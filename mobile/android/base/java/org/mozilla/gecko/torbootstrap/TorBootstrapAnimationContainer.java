/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.torbootstrap;

import android.app.Activity;
import android.content.Context;
import android.support.v4.app.FragmentManager;
import android.util.AttributeSet;

import android.view.View;
import android.widget.LinearLayout;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import org.mozilla.gecko.R;
import org.mozilla.gecko.firstrun.FirstrunAnimationContainer;

/**
 * A container for the bootstrapping flow.
 *
 * Mostly a modified version of FirstrunAnimationContainer
 */
public class TorBootstrapAnimationContainer extends FirstrunAnimationContainer {

    public static interface OnFinishListener {
        public void onFinish();
    }

    private TorBootstrapPager pager;
    private boolean visible;

    // Provides a callback so BrowserApp can execute an action
    // when the bootstrapping is complete and the bootstrapping
    // screen closes.
    private OnFinishListener onFinishListener;

    public TorBootstrapAnimationContainer(Context context) {
        this(context, null);
    }
    public TorBootstrapAnimationContainer(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public void load(Activity activity, FragmentManager fm) {
        visible = true;
        pager = findViewById(R.id.tor_bootstrap_pager);
        pager.load(activity, fm, new OnFinishListener() {
            @Override
            public void onFinish() {
                hide();
            }
        });
    }

    public void hide() {
        visible = false;
        if (onFinishListener != null) {
            onFinishListener.onFinish();
        }
        animateHide();
    }

    private void animateHide() {
        final Animator alphaAnimator = ObjectAnimator.ofFloat(this, "alpha", 0);
        alphaAnimator.setDuration(150);
        alphaAnimator.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                TorBootstrapAnimationContainer.this.setVisibility(View.GONE);
            }
        });

        alphaAnimator.start();
    }

    public void registerOnFinishListener(OnFinishListener listener) {
        onFinishListener = listener;
    }
}
