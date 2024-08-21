# pebbling club

a club for [pebbling][] enthusiasts on the web

[pebbling]: https://en.wikipedia.org/wiki/Pebbling

## Misc dev notions

- separate concerns of data and logic into repository and service layers
- start each feature as a CLI command first, wherever possible
- write tests mainly for tricky bits of logic, don't need 100% coverage
- think about per-user sqlite databases for profile data?

## TODO

- [ ] add email as requirement to passwords (e.g. for future recovery)
- [ ] add profileId association to password table
- [ ] drop sessions table since moving to fastify
- [ ] switch from passport to [fastify-auth](https://github.com/fastify/fastify-auth)?

- code golfing
  - [x] switch from express to fastify?
  - [x] extract minimal interfaces out of concrete services?

- basic UX
  - [x] view bookmarks by profile
  - [x] create bookmark
  - [ ] fetch URL head / opengraph metadata to pre-fill form
  - [x] bookmarklet-able posting form URL with params to pre-fill form
  - [ ] edit bookmark
  - [x] delete bookmark
  - [ ] view bookmarks by tag
  - [ ] view bookmarks by tag intersection

- access control
  - [ ] show bookmarks per user
  - [ ] hide private bookmarks except for logged in user

- import / export
  - [ ] web UI for pinboard import
  - [ ] web UI for pocket import
  - [ ] JSON data export
  - [ ] HTML data export

- advanced UX
  - [ ] visibility settings for bookmarks (private, mutuals-only, followers-only, public)
  - [ ] rss / atom / json feeds?
  - [ ] fetch URL thumbnails based on metadata?
  - [ ] browser web extensions?

- tagging
  - [ ] maintain per-user tags?

- admin
  - [ ] okay to stick with CLI for admin tasks initially?
  - [ ] general web UI admin panel - use something readybaked?

- api
  - [ ] clone ye olde delicious API?
  - [ ] establish basic scaffolding for API building
    - [openapi](https://openapi-ts.dev/introduction) - overkill?
    - graphql seems like overkill for this project

- fediverse / federation
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
  - [ ] tag search
  - [ ] user search
  - [ ] federated search with authorized fetch for followers only?
  - [ ] use sqlite fulltext search? or something else? make it pluggable?

- hosting / deployment
  - [ ] try deploying to glitch
  - [ ] pick some other deployment targets - fastly? netlify? digitalocean? azure? gcp? aws?
  - [ ] dockerfile, pm2, nginx, etc. for self-hosting
  - [ ] decompose into serverless functions?
