# Camera verification — October 16, 2026

Six configured camera URLs were checked. An HTTP 200 response alone does **not** mean an embed works. Both enabled YouTube feeds were also visually checked inside the local website, with a 390 × 844 phone viewport.

| Beach / camera | Result | Evidence / app behavior |
| --- | --- | --- |
| Huntington Beach — Pier & Pacific | **Working in the local app** | YouTube API reported Playing; picture visibly showed the pier, beach, and ocean. Uses `mhQjsLBfOoY`. |
| San Clemente — Pier | **Working in the local app** | YouTube API reported Playing; picture visibly showed the beach/ocean and City of San Clemente Beach Camera watermark. Uses `2c7NV66YzKA`. Refresh was exercised. |
| Monarch Bay Beach Club | **Embedding blocked** | Portal endpoint returned HTTP 200 with `Content-Security-Policy: frame-ancestors 'self' https://hdontap.com https://*.hdontap.com`. The app shows an explanatory source-link card. |
| Dana Point Harbor | **Embedding blocked** | Same portal HTTP 200 / restrictive frame-ancestors policy. Source-link card. |
| Carlsbad Beach Surf | **Embedding blocked** | Same portal HTTP 200 / restrictive frame-ancestors policy. Source-link card. |
| Terramar Point | **Embedding blocked** | Same portal HTTP 200 / restrictive frame-ancestors policy. Source-link card. |

## Exact configured player URLs

- Huntington Beach: <https://www.youtube.com/embed/mhQjsLBfOoY>
- San Clemente: <https://www.youtube.com/embed/2c7NV66YzKA>
- Monarch Bay: <https://portal.hdontap.com/s/embed/?stream=fulkra_monarch_resort_new-HDOT>
- Dana Harbor: <https://portal.hdontap.com/s/embed/?stream=danapoint-harbor_lgm-HDOT>
- Carlsbad: <https://portal.hdontap.com/s/embed/?stream=carlsbad_seashoreonthesand-HDOT>
- Terramar: <https://portal.hdontap.com/s/embed/?stream=hdontap_carlsbad_terra-mar-pt-HDOT>

For YouTube, the app adds autoplay=1, mute=1, playsinline=1, enablejsapi=1, and the actual website origin. Navigating directly to a naked YouTube embed URL without a referring webpage produced a player configuration error; testing inside the actual app succeeded. No account or payment was needed for these local playback checks. YouTube may serve ads and may change or end streams later.

## Rejected sources and gaps

The former Huntington Beach Granicus camera page exposes this HLS URL:

`https://cdn3.wowza.com/5/V2Y2VmhqMEFDTUkx/huntingtonbeach/G0088_005/playlist.m3u8`

Its playlist, chunklist, and CORS checks succeeded and it played in a muted inline video element. However, visual inspection showed non-beach video. **It was rejected and replaced with the current city YouTube pier camera.** This is why a URL-only health check is insufficient.

HDOnTap's advertised `/stream/.../embed/` routes for Carlsbad and Monarch Bay returned `X-Frame-Options: DENY`. The portal players above independently returned the restrictive CSP policy. No temporary signed HLS URLs were copied into this app, and no frame restrictions were bypassed. The cards preserve the requested free sources without pretending they can play on GitHub Pages.

Newport's official [beach information page](https://www.newportbeachca.gov/how-do-i-/find/beach-information) points to Surfline; premium feeds were excluded. Laguna's official surf report page could not be reliably fetched (403); no unverified embed was added. This is a curated subset of the requested coastal range, not complete beach coverage. Huntington Beach and Carlsbad can exceed the requested 45-minute drive in traffic.

## Other checks performed

- Local page returned HTTP 200 and rendered five beach sections and six cards.
- Mobile viewport: 390px document width, 390px content width, no page-wide horizontal overflow. Beach navigation scrolls within its own row.
- Desktop viewport: 1280px document and content width; no page-wide overflow.
- San Clemente refresh re-created a working player.
- Scrolling from San Clemente to Huntington removed the San Clemente iframe; only the visible Huntington iframe remained. Confirmed in the page DOM.
- NOAA predictions returned high/low events for Newport Bay entrance and La Jolla. Real values and Pacific time labels rendered in the app.
- NOAA water temperature returned a La Jolla observation; it rendered with station name and observation time. A Los Angeles station probe returned no temperature data, so the app explicitly labels La Jolla as a regional reading instead of inventing beach-specific values.
- Four automated checks pass: next tide selection across UTC midnight, Pacific daylight saving time, absent predictions, and valid camera configuration. JavaScript syntax checks pass.
- Manifest and 180/192/512px PNG icons are present. Service worker caches only the app shell, never video/provider/NOAA responses.

## Verification limits

This was a local desktop browser check using a phone-sized viewport, **not a physical iPhone Safari test**. Home Screen installation has not been exercised on a real iPhone. The site has not yet been pushed to GitHub or tested on its final Pages domain. Recheck both enabled streams after publishing: providers can impose different restrictions by domain, region, device, or date. Muted autoplay is requested, but iPhone Low Power Mode may require tapping Play.

The blocked HDOnTap feeds cannot meet the direct-on-page requirement under their current policy. Making them playable requires a provider-approved embed for the eventual domain or a different free embeddable feed. Their refresh buttons cannot override that policy.
