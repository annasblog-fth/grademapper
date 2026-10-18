# Little Grades

A cute, simple grade tracker that tells you exactly what you need on your next test.
Works offline. No account. Your grades never leave your device.

It is a plain website (HTML, CSS and JavaScript, no build step) that can be installed on a phone
from the browser ("Add to Home Screen"), and later wrapped as an App Store app.

## What is in it

- **Welcome setup.** Pip the sprout asks for your grade or year, grading style, goals and colleges, then explains how grades work.
- **Grades.** Terms, courses, categories with unlimited entries, decimal scores and weights, drop-lowest, current letter and GPA, weighted or unweighted GPA, a trend chart across terms, and a progress meter to your goal.
- **What do I need?** Pick a goal and see the average needed on everything still to come. A what-if slider shows where any score would land you.
- **Encouraging tone.** Messages like "On track", "Within reach", "Stretch goal" and "Good to know" use an icon and a label as well as colour, and a celebration with confetti when a goal is reached.
- **Activities.** Volunteering, sports, clubs and jobs, grouped by type or by the major they relate to, plus a college course-requirement tracker.
- **Calendar.** List and month views with what each test is worth and what to aim for. In-app reminders, and a calendar file (.ics) your phone's own calendar can use for reminders when the app is closed.
- **Mini tools.** Focus timer with a growing plant, sound player (white, pink and brown noise, rain, ocean), word counter, lecture-to-text, read aloud, notes and a doodle pad.
- **Make it yours.** Six themes (Standard, Academic, Neon, Pink Flowey, Retro, Dyslexia friendly), your own colours, 13 fonts, four corner shapes, three card styles, spacing, animation level, text size, high contrast and dyslexia-friendly mode.
- **Privacy.** No account, no ads, no tracking. Optional passphrase encryption (AES-256), encrypted backups, CSV export, print to PDF, and a delete-everything button.

## Put it online with GitHub Pages (free)

You do not need to know Git for this.

1. Make a free account at <https://github.com>.
2. Click **New repository**. Name it `little-grades`, choose **Public**, and click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Unzip `little-grades-site.zip` on your computer. Open the unzipped folder, select **everything inside it** (the `index.html`, `css`, `js`, `icons` and other items, not the outer folder itself), and drag it into the GitHub upload box. Wait for the upload to finish, then click **Commit changes**.
   - Check that `index.html` is at the top level of the repository, not inside another folder.
   - Hidden files such as `.nojekyll` may not show in your file picker. It is not required, so it is fine if it is missing.
5. Go to **Settings, then Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick **main** and **/ (root)**, then click **Save**.
6. Wait one or two minutes. GitHub shows your address at the top of the Pages screen:
   `https://YOUR-USERNAME.github.io/little-grades/`
7. Open that address on your phone.
   - **iPhone (Safari):** Share button, then **Add to Home Screen**.
   - **Android (Chrome):** menu, then **Install app** or **Add to Home screen**.

### Before you share it

- Open `privacy.html` and replace `[add your email address here before publishing]` with a real contact address.
- Check the grading scales in `js/engine.js` against your own school. The BC, UK and IB cut-offs are approximate, and the app says so.

## Changing things

| I want to change | Edit this file |
| --- | --- |
| Theme colours, fonts, theme names | `js/themes.js` (the `THEMES` and `FONTS` lists) |
| Grading scales, the maths | `js/engine.js` (then run the tests) |
| Pip's messages and the encouraging wording | `js/engine.js` (the `coach` function) and `js/pages/home.js` (the `NUDGES` list) |
| Layout and styles | `css/styles.css` |
| The pages | `js/pages/*.js` |

When you change files, also change `VERSION` at the top of `sw.js` (for example `lg-v2`) so phones refresh their saved copy.

## Run it on your own computer

Browsers only allow some features (offline mode, encryption) from `http://localhost` or `https`, not from a double-clicked file. From this folder run:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>.

## Run the tests

The calculation engine has automated tests. You need Node.js (<https://nodejs.org>):

```
node tests/engine.test.js
```

Every test should print `ok`. Run them after any change to `js/engine.js`.

## Good to know

- **Data stays in one browser on one device.** Phone and laptop do not sync. Use **Settings, Download backup** to move data, and make a backup before clearing browser data or changing phones.
- **There is no password reset.** If you set a passphrase and forget it, the data cannot be opened. That is what keeps it private.
- **Reminders** from a website only appear while the app is open. For reminders when it is closed, download the calendar file from the Calendar page and open it on your phone.
- **Lecture to text** uses the browser's own speech service. In many browsers that service sends audio to the browser maker's servers. This is explained on the page and in `privacy.html`.
- **Fonts** load from Google Fonts the first time you are online, then work offline. A later improvement is to download the font files into the project so no request is ever made to Google.
- **Doodles** are not saved when you leave the page. Use **Save picture**.

## Next steps toward an App Store app

1. Use it yourself and with a few classmates for a few weeks. Fix what confuses people.
2. Wrap this same folder as an iPhone app with [Capacitor](https://capacitorjs.com) (needs a Mac and Xcode, or a cloud build service).
3. Add one native feature that a website cannot do, such as real notifications when the app is closed, so the app is more than a website in a frame.
4. Join the Apple Developer Program, add screenshots, use `privacy.html` as the privacy policy link, and submit.
