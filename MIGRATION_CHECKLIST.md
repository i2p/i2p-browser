# Use this checklist when migrating between ESR versions

**Note** this is work in progress, expect the list to not cover everything at least not yet.

## Features we must patch "back"

* Update images and names under browser/branding/alpha
* Ensure browser/app/profile/000-i2p-browser.js exists
* Ensure data directory
  * Edit toolkit/xre/nsAppRunner.cpp
  *
* The green address bar on .i2p or .onion
  * browser/base/content/pageinfo/security.js
  * browser/base/content/browser.js
  * dom/base/nsContentUtils.cpp
  * dom/base/nsContentUtils.h
  * dom/base/nsGlobalWindowOuter.cpp
  * dom/html/HTMLFormElement.cpp
  * dom/presentation/PresentationRequest.cpp
  * dom/security/nsContentSecurityManager.cpp
  * dom/security/nsMixedContentBlocker.cpp
  * dom/security/nsMixedContentBlocker.h
  * security/manager/ssl/nsSecureBrowserUIImpl.cpp
  * Ensure browser/themes/shared/identity-block/onion.svg exists for .onion
  * Ensure browser/themes/shared/identity-block/garlic.svg exists for .i2p
  * Ensure garlic.svg is added to browser/themes/shared/jar.inc.mn
  * Add CSS for garlic.svg in browser/themes/shared/identity-block/identity-block.inc.css
* network.dns.blockDotI2P
  * modules/libpref/init/all.js
  * netwerk/dns/effective_tld_names.dat
  * netwerk/dns/nsDNSService2.cpp
  * netwerk/dns/nsDNSService2.h
* Cookie Security (secure cookie)
  * netwerk/cookie/nsCookieService.cpp 
* Onboarding
  * browser/extensions/onboarding/bootstrap.js
  * browser/extensions/onboarding/content/onboarding.js
  * browser/extensions/onboarding/content/onboarding.css



