# pebbling club

a club for [pebbling][] enthusiasts on the web

[pebbling]: https://en.wikipedia.org/wiki/Pebbling

## overall notions

- Sift, seek, save, share... with friends? overall pitch?

## Misc dev notions

- separate concerns of data and logic into repository and service layers
- start each feature as a CLI command first, wherever possible
- write tests mainly for tricky bits of logic, don't need 100% coverage
- think about per-user sqlite databases for profile data?

## TODO

- [ ] convert all these TODOs to github issues!

- [ ] add email as requirement to passwords (e.g. for future recovery)
- [ ] add profileId association to password table
- [ ] drop sessions table since moving to fastify
- [ ] switch from passport to [fastify-auth](https://github.com/fastify/fastify-auth)?

- hosting / deployment
  - [ ] try deploying to glitch
  - [ ] fly.io?
  - [ ] pick some other deployment targets - fastly? netlify? digitalocean? azure? gcp? aws?
  - [ ] dockerfile, pm2, nginx, etc. for self-hosting
  - [ ] decompose into serverless functions?
  
- code golfing
  - [x] switch from express to fastify?
  - [x] extract minimal interfaces out of concrete services?

- basic UX
  - [x] view bookmarks by profile
  - [x] create bookmark
  - [ ] fetch URL head / opengraph metadata to pre-fill form
  - [x] bookmarklet-able posting form URL with params to pre-fill form
  - [x] edit bookmark
  - [x] delete bookmark
  - [x] view bookmarks by tag
  - [x] view bookmarks by tag intersection
  - [x] show bookmarks per user

- public views
  - [ ] feed of all public bookmarks across all users

- import / export
  - [ ] web UI for pinboard import
  - [ ] web UI for pocket import
  - [ ] JSON data export
  - [ ] HTML data export

- access control
  - [ ] hide private bookmarks except for logged in user

- advanced UX
  - [ ] tag intersections sidebar - tags seen along with current tag at top of sidebar
  - [ ] visibility settings for bookmarks (private, mutuals-only, followers-only, public)
  - [ ] rss / atom / json feeds?
  - [ ] fetch URL thumbnails based on metadata?
  - [ ] browser web extensions?

- tagging
  - [x] maintain per-user tags?

- admin
  - [ ] okay to stick with CLI for admin tasks initially?
  - [ ] general web UI admin panel - use something readybaked?

- api
  - [ ] clone ye olde delicious API?
  - [ ] establish basic scaffolding for API building
    - [openapi](https://openapi-ts.dev/introduction) - overkill?
    - graphql seems like overkill for this project

- fediverse / federation / inbox
  - [ ] try out [`activitypub-express`](https://github.com/immers-space/activitypub-express)?
  - [ ] adapt dariusk's [`express-activitypub](https://github.com/dariusk/express-activitypub)?
  - [ ] websocket bot to ingest links from personal mastodon account
  - [ ] support for following other users
  - [ ] support for accepting / approving follow requests
  - [ ] inbox for receiving bookmarks from other users
  - [ ] outbox delivery queue for sending bookmarks to followers
  - [ ] sign-in via mastodon oauth dance? (not really meant for that)

- search
  - [ ] full-text search
  - [x] tag search
  - [x] user search
  - [ ] federated search with authorized fetch for followers only?
  - [ ] use sqlite fulltext search? or something else? make it pluggable?

- random feature ideas
  - [ ] podcast rss feeds of bookmarked MP3s
  - [ ] easy webring building from link collections
  - [ ] live bookmarks - bookmark a site with an RSS feed, see updates, lighterweight than full RSS sifting UI
  - [ ] keyword searches - bookmark a URL with a keyword and a %s in query string to launch a search redirect
  - [ ] daily / weekly / monhtly newsletters?
