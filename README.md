# Beach Cams

A small, mobile-first website for free coastal camera views around Dana Point. Everything runs on GitHub Pages; there is no account system, API key, paid API, or build step.

## Start here, slowly

1. This folder, `beach-fun-app`, is the whole website.
2. `index.html` is the page. `styles.css` controls its appearance. `app.js` handles cameras.
3. `cams.json` is the only list you edit to add or remove beaches and feeds.
4. Read `EMBED-TESTS.md` for the camera checks and current limitations. Some free providers block embedding. Those feeds show helpful cards instead of blank players.

## Step 1: Look at it on your Mac

Open Terminal and paste these commands, one line at a time:

```sh
cd "/Users/allylabriola/Documents/ChatGPT/Beach Fun/beach-fun-app"
python3 -m http.server 8000 --bind 127.0.0.1
```

This starts a tiny local preview server. Leave this Terminal window open. In your browser, open <http://127.0.0.1:8000>. If a preview is already running, just open that address. Use Control-C in the server's Terminal to stop it.

Don't double-click `index.html`: browsers block the camera list and app features when opened as a plain file. Your iPhone also cannot use your Mac's `127.0.0.1`; use the published GitHub Pages address for your phone.

## Step 2: Create your free GitHub repository

A repository is simply your project's folder stored on GitHub.

1. Sign in at <https://github.com>.
2. Use the **+** menu, then **New repository**.
3. Name it `beach-fun-app`.
4. Choose **Public** for free GitHub Pages hosting. This project's files contain no secrets.
5. Leave the README, license, and .gitignore options unchecked. Your local folder already has its files.
6. Click **Create repository**. Keep this page open.

## Step 3: Push the website to GitHub

Open a **second Terminal window**. Paste the following commands, one line at a time:

```sh
cd "/Users/allylabriola/Documents/ChatGPT/Beach Fun/beach-fun-app"
git init
git add .
git commit -m "Create Beach Cams website"
git branch -M main
```

`git add` gathers the files. `git commit` saves a named version. None of these commands publishes anything yet.

If Git says your identity is missing, set it just for this project, replacing the examples with your name and your GitHub email (you can use your GitHub private noreply email):

```sh
git config user.name "Your Name"
git config user.email "YOUR_GITHUB_EMAIL"
git commit -m "Create Beach Cams website"
```

Next, replace `YOUR-USERNAME` below with your actual GitHub username:

```sh
git remote add origin https://github.com/YOUR-USERNAME/beach-fun-app.git
git push -u origin main
```

GitHub may ask you to sign in. Your ordinary GitHub password does not work as a Git HTTPS password. Use GitHub's supported credential manager or the browser upload option below if authentication feels complicated. See <https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git>.

### Easier alternative: upload in the browser

In your empty repository, select **uploading an existing file**, then drag the **contents** of `beach-fun-app` into it (including `icons`, `vendor`, and `scripts`). Commit the files. `index.html` must appear at the repository's top level, not inside another `beach-fun-app` folder. Hidden `.nojekyll` is optional for this plain HTML project. Browser upload works without the Terminal or Git authentication setup.

## Step 4: Turn on GitHub Pages

1. Open your repository on GitHub.
2. Choose **Settings**, then **Pages** in the sidebar.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**.
5. Click **Save**.
6. Wait a few minutes. The Pages screen will show your address, usually `https://YOUR-USERNAME.github.io/beach-fun-app/`.
7. Open that exact HTTPS address. Check both available camera players there: provider rules can differ on a public domain.

No workflow, npm installation, domain purchase, or build command is required. All asset paths are relative, so the GitHub project subfolder works.

Official instructions: <https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site>.

## Step 5: Put it on your iPhone Home Screen

1. On your iPhone, open the published **HTTPS** address in **Safari**.
2. Tap **Share** (the square with the up arrow).
3. Choose **Add to Home Screen**. You may need to scroll down.
4. Tap **Add**.
5. Open the teal wave icon on your Home Screen.

The app includes a manifest, 180px Apple touch icon, 192px and 512px icons, theme color, and service worker. The shell can reopen offline after the first successful visit. Live cameras and fresh NOAA data need internet. Low Power Mode, browser settings, and provider policies can require tapping Play even though autoplay is requested muted and inline.

## Edit the camera list

Open `cams.json` in a text editor. It is JSON: use double quotes and put commas between entries, but no trailing comma after the last entry.

Each item under `beaches` has:

- `id`: a unique simple name for jump links, such as `san-clemente`.
- `name`, `area`, `drive`: the visible labels. Drive times are rough estimates, not live traffic.
- `latitude` and `longitude`: the beach's location. The app sorts beaches along the coast and finds the closest tide station, temperature sensor, water quality station and forecast grid cell from these.
- `facing`: the compass direction (0–359°) the beach faces out to sea. It is approximate and decides whether wind is labeled offshore, onshore or cross-shore.
- `advisoryUrl`: the county page with current closures and advisories (OC Beach Info or SD Beach Info).
- `qualityUrl`: link to the beach's Heal the Bay Beach Report Card page (`https://beachreportcard.org/LATITUDE/LONGITUDE/15`).
- `qualityStation` (optional): a Heal the Bay station `_id` from `https://admin.beachreportcard.org/api/locations/` to prefer. It is still checked by distance: within 0.5 mi it counts as local, up to 4 mi it is labeled “Nearby sample”, and beyond that the app shows “No local result available”. Without it, the nearest active station is used.
- `cams`: camera entries for that beach. Use `[]` for a beach with no camera; it still shows tides, water temperature and water quality.

A camera looks like this:

```json
{
  "id": "my-unique-cam",
  "name": "My Beach Pier",
  "provider": "Camera owner's name",
  "type": "youtube",
  "url": "https://www.youtube.com/embed/VIDEO_ID",
  "sourceUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "status": "enabled",
  "note": "Free public stream"
}
```

Use `youtube` for YouTube embed URLs, `hls` for an owner's public `.m3u8` stream, or `iframe` for an explicitly permitted provider embed URL. HLS uses Safari's native video support and the included hls.js library on compatible other browsers.

Use status `enabled` for a tested working feed, `blocked` for one that refuses embedding, or `offline` for an unavailable feed. Delete a camera object to remove it. If a YouTube live broadcast gets a new video ID, replace its URL here. Do not use temporary signed stream URLs; they expire.

For generic third-party iframes, browsers prevent this app from reading the inner player's status. Known blocked feeds are disabled up front. A timeout covers initial loading, but an iframe load event alone cannot prove video playback; the **Blank or frozen?** action lets you replace any bad player with a friendly card. YouTube API errors and native/HLS video errors are detected automatically. Long buffering or stalled HLS playback also becomes a friendly card. Refresh reloads an enabled feed; it cannot override provider embedding restrictions.

After editing, test locally, then publish your changes:

```sh
git add .
git commit -m "Update beach cameras"
git push
```

Reload the website after GitHub finishes publishing. The service worker uses network-first requests for app files. If you change its shell list or caching strategy, bump the cache version in `sw.js`.

## How the conditions work

Each beach finds its own sources from its coordinates:

- **Tides:** the closest NOAA prediction station from NOAA's station list (`mdapi`), including local subordinate stations, with high/low times and heights in feet above MLLW. The station name and distance are shown.
- **Water temperature:** the closest NOAA sensor that reported in the last 3 hours, with its name, distance and measurement time. If it is more than 10 miles away, it is labeled **Regional water temperature**.
- **Swell and wind:** [Open-Meteo](https://open-meteo.com/en/docs/marine-weather-api) model forecasts, labeled as such. Grid cells span several kilometres, so neighbouring beaches can share values. Offshore wave height is not a breaking-surf estimate, and the app never rates surf or says a beach is “safe for beginners”.
- **Water quality:** the county advisory link is shown separately from the latest Heal the Bay grade, because a good grade never overrides a current closure. The app doesn't check advisories itself yet.
- **Freshness:** every value shows when it was measured or sampled, separately from when the app checked. Lists the app reuses (station lists for a day, Heal the Bay grades for an hour) show when they were fetched, so a reload never makes old data look new.

Station lists are cached for a day and conditions refresh every ten minutes while the page is visible. This is a beach viewing app, not a navigation or ocean safety forecast.

## History and archive

`.github/workflows/record-history.yml` runs `scripts/record-history.mjs` every morning (and on demand from the Actions tab). It saves each beach's water temperature and latest grade to `data/history/YYYY-MM.json` and lists the months in `data/history/index.json`. Running it twice on the same day replaces that day's readings; nothing older is deleted. Each beach's **History** panel draws the temperature line, the daily grade strip and a table from these files.

API documentation: <https://api.tidesandcurrents.noaa.gov/api/prod/>, <https://open-meteo.com/en/docs/marine-weather-api>.

## Check the code

If Node.js is already installed, run `npm run check` from this folder. No package installation is needed. It checks JavaScript syntax, NOAA time conversion (including daylight saving), missing tide data, and the camera configuration. The camera and mobile browser checks are documented separately in `EMBED-TESTS.md`.

## Coverage and limits

The requested coast spans Huntington Beach to Carlsbad. These outer stops can exceed 45 minutes from Dana Point, especially in traffic. Not every beach in between has a verified free, embeddable stream. Newport's city page refers visitors to Surfline; Surfline premium is excluded. Laguna's city page could not be fetched reliably during research, so no unverified feed was added. The four HDOnTap sources are retained as honest fallback cards because their current embedding policy blocks unrelated websites. No provider restrictions are bypassed.

Hosting has been prepared for GitHub Pages, but this folder has not been pushed to a GitHub account or published. Follow the steps above to choose the account and publish it.
