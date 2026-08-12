# Source of truth: this repository

`main` on GitHub is the authoritative copy of this project. Firebase project
`imc-er-manager` is a deployment target, not a place where the project is
edited. A working copy on a laptop is a draft until it is merged.

```
  your machine  ──push──▶  branch  ──PR──▶  main  ──GitHub Actions──▶  Firebase
                                             │                     imc-er-manager
                                             │                            │
                                             └──── drift check ◀──────────┘
                                                (daily + after deploy)
```

## Project binding

This repository deploys to exactly one Firebase project, and that project is
deployed to by exactly one repository:

| Repository | Firebase project | Live site |
| --- | --- | --- |
| **`hassanabdelmenem/imc-er`** (this one) | **`imc-er-manager`** | <https://imc-er-manager.web.app> |
| `hassanabdelmenem/er-app-final` | `er-icu` | <https://er-icu.web.app> |
| `hassanabdelmenem/eha-transfer` | `eha-transfer-1785622025` | <https://eha-transfer.web.app> |

The other two rows are here to make the boundary unambiguous, not because
anything in this repo reaches them. This project shares no backend, database,
collection, build tooling, or credentials with either of them.

If you find anything in this repository pointing at a Firebase project other
than `imc-er-manager`, at another application, or at a path outside this
directory, it is a leftover from when these projects shared a workspace.
Remove it.

## Two trees: `public/` and `dist/`

This repo commits both. `public/` is the source. `dist/` is the artifact, and
it is what Firebase serves — `firebase.json` sets `"public": "dist"`.

`npm run build` regenerates `dist/` from `public/`. **Today that build is a
verbatim copy**, so the two trees are byte-identical; `scripts/build-prod.js`
deliberately reproduces the artifact that is actually deployed rather than a
different one. It does not minify, and never has — every file in the committed
`dist/` matches its `public/` counterpart exactly. Introducing real
minification is a separate, deliberate change.

Editing `public/` without rebuilding produces a change that deploys green and
does nothing. CI now blocks that: both hosting workflows run
`node scripts/build-prod.js --check` before deploying, and fail on mismatch. So
after touching `public/`:

```bash
npm run build          # regenerate dist/
git add public dist    # commit both
```

Until recently `npm run build` pointed at `../scripts/build-prod.js`, outside
this repository, in the workspace that once held these apps side by side. It
failed with MODULE_NOT_FOUND in any clean clone, and `dist/` could only be
regenerated on a machine that happened to have that parent directory. The
script now lives here.

## What the repository controls

| Path | Controls | Released by |
| --- | --- | --- |
| `dist/` | Everything Firebase Hosting serves | `firebase-hosting-merge.yml` |
| `public/` | Source for `dist/` | via `npm run build` |
| `firestore.rules` | Firestore security rules | `firebase-config-deploy.yml` |
| `remote-config.json` | Remote Config kill-switches | `firebase-config-deploy.yml` |
| `firebase.json`, `.firebaserc` | Hosting config, rules/template paths, project id | both |

## What it does not control

These live only in Firebase. Nothing in this repo backs them up, and nothing
here will restore them:

- **Firestore data** — `patients`, `users`, `settings`, `dead_letter_queue`.
- **Auth users** — accounts, sign-in providers, role documents.
- **Console-only project settings** — authorized domains, quotas, budgets, API
  key restrictions, the service account itself.

Changing `firestore.rules` changes who may read the data. It never changes the
data. Treat a rules deploy as a production change to a system holding PHI.

## Day-to-day

```bash
git switch main
git pull origin main
git switch -c my-change
# edit public/, then:
npm run build
npm test
git add -A && git commit
git push -u origin my-change
```

Open a pull request. It gets its own Hosting preview channel, so the change can
be reviewed on real Firebase infrastructure before reaching `main`. Merging
deploys to the live channel.

Do not run `firebase deploy` by hand. A manual deploy puts content on the live
site that no commit accounts for — the drift check will fail the next morning.

## Bringing an existing local clone into line

```bash
git fetch origin
git status                     # commit or stash anything you still want
git log origin/main..main      # local-only commits — save these before resetting
git switch main
git reset --hard origin/main   # discards local commits on main
git clean -nd                  # review untracked files first
git clean -fd                  # then remove them
npm run build:check            # confirm dist/ agrees with public/
```

`git reset --hard` throws work away. If `git log origin/main..main` prints
anything, those commits exist nowhere else — put them on a branch and into a PR
before you reset.

## One-time setup

These need Firebase Console and GitHub repository-settings access, so they fall
to the project owner.

1. **Grant the service account two more roles.** The key the Firebase CLI
   generates carries hosting permissions only, which is why hosting deploys
   have been succeeding while rules and Remote Config never deployed at all. In
   the Google Cloud Console, IAM & Admin → the `github-action-*` service
   account → add:
   - **Firebase Rules Admin** (`roles/firebaserules.admin`)
   - **Firebase Remote Config Admin** (`roles/firebaseremoteconfig.admin`)

   Without these, `firebase-config-deploy.yml` fails with a 403 on its first
   run. The job names tell you which one is missing.

2. **Check what the live Firestore rules actually are**, in the Console under
   Firestore → Rules. Compare against `firestore.rules` here. This matters more
   than the rest of this document: the header of that file records that it
   replaces a ruleset whose `isApprovedMedicalStaff()` resolved to
   `getUserData().role != 'blocked'`, which was true for any signed-in account
   with no user record — meaning **any authenticated user could read and write
   every patient's PHI**. Since nothing has ever deployed rules from this repo,
   the fix may exist only as a file here. If the live rules are still the old
   ones, deploy immediately via the **Deploy Firebase config** workflow
   (`workflow_dispatch`) rather than waiting for a merge.

3. **Protect `main`.** Settings → Branches → require a pull request, require
   the PR checks to pass, disallow force pushes. A branch anyone can push to
   directly is not a source of truth.

4. **Stop other deploy paths.** Anyone with a local `firebase` CLI logged in to
   `imc-er-manager` can still overwrite the live site.

## Known inconsistencies

Flagged rather than changed, because each is a decision rather than a fix:

- _(none open)_

## The three registries behind Google sign-in

Sign-in depends on three separate lists in three separate places. They look
interchangeable and are not. Conflating them took Google sign-in down in
production: `authDomain` was pointed at `imc-er-manager.web.app` after
confirming the first two, without knowing the third existed.

| Registry | Where | Answers |
| --- | --- | --- |
| Hosting reserved paths | Firebase Hosting, automatic | Is `/__/auth/handler` **served** on this host? |
| Authorised domains | Firebase Console → Authentication → Settings | May a page on this origin **start** a sign-in? |
| OAuth redirect URIs | Google Cloud Console → Credentials → Web client | Will Google **accept** a redirect back to this handler? |

The first two are true for every Hosting site of the project, including every
preview channel. The third is true for exactly two handlers:
`https://imc-er-manager.firebaseapp.com/__/auth/handler`, which Firebase
registers when it creates the client, and
`https://imc-er-manager.web.app/__/auth/handler`, which was added by hand in the
Cloud Console to bring the live site back up and to let it hold the handshake on
its own origin. Nothing registers itself — a third host would need the same
manual step.

`public/js/config.js` encodes the third list as `OAUTH_REGISTERED_HOSTS`, and
`scripts/preflight.js` checks it against Google on every pull request.

### Changing where sign-in happens

1. Add `https://<host>/__/auth/handler` to the Web client in Google Cloud
   Console → APIs & Services → Credentials → Authorised redirect URIs.
2. Add `<host>` to `OAUTH_REGISTERED_HOSTS` in `public/js/config.js`.
3. `npm run preflight` — it fails if you did 2 without 1.

Do not use a preview channel to test this. Each pull request gets a fresh
hostname that cannot be pre-registered, so a preview can only ever exercise the
fallback path, never same-origin sign-in. Preflight is the check; a green
preview proves nothing about it.

## What is verified automatically, and what is not

| Claim | Checked by |
| --- | --- |
| `dist/` matches `public/` | `scripts/build-prod.js --check`, in every deploy workflow and in Checks |
| the live site matches `dist/` | `firebase-drift-check.yml`, daily and after each deploy |
| unit suite passes | `checks.yml`, on every pull request and push to `main` |
| role model agrees across `config.js`, `firestore.rules`, `set-admin.js` | `tests/unit/roleModel.test.js` |
| owner allowlist agrees between client and rules | `tests/unit/authDomain.test.js` |
| OAuth redirect URIs, authorised domains, sign-in providers, `firebase.json` schema | `scripts/preflight.js`, in Checks and daily |
| the Google Login button, clicked for real, reaches Google without `redirect_uri_mismatch` | `tests/e2e/authHandshake.spec.js`, in Checks |
| a rejected email/password sign-in surfaces a real Firebase Auth error, not a silent discard | `tests/e2e/authHandshake.spec.js`, in Checks |
| a *successful* email/password or Google sign-in reaches the dashboard | **nothing** — see the header comment in `tests/e2e/authHandshake.spec.js` for why: a disposable test account's `pending` record can only be deleted by the owner (`firestore.rules`, `/users/{userId}`), so completing that path on every Checks run would leave permanent debris in the real approval queue. Needs a pre-approved fixture account, set up by hand once, before this can close. |
| Firestore rules match `firestore.rules` | **nothing** — rules are not readable over HTTP. The deploy is automated instead, so the repo stays the only writer. |
| Remote Config matches `remote-config.json` | **nothing**, same reason, same mitigation |

## When the drift check fails

It compares a SHA-256 of every file under `dist/` against the same path on
`https://imc-er-manager.web.app`, retrying for two minutes so a slow release is
not mistaken for drift. A failure means one of:

- someone deployed out of band → re-run **Deploy to Firebase Hosting on merge**
  to republish `main`, then find out who and stop it recurring;
- a deploy silently failed → check the workflow run;
- files were removed from `dist/` in git → Hosting keeps the previous release
  until a successful deploy replaces it, so republish.

The repo is the correct copy. Fix Firebase to match it, never the reverse.

## Coordinating rules with app changes

Hosting and config deploy in separate workflows that run in parallel, so when
one push changes both, the order they land in is not guaranteed. When a change
needs them to agree, split it across two merges and ship the permissive half
first:

- **Rules getting stricter** → deploy the app change first, let it reach users,
  then tighten the rules. Tightening first breaks any client still on the old
  bundle. Note `sw.js` caches aggressively, so "still on the old bundle" can
  outlast the deploy by a while.
- **Rules getting looser** → deploy the rules first, then the app change that
  depends on the new access.
