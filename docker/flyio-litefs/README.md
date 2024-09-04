# quick notes on deploying to fly.io with litefs for sqlite

Following this guide on [deploying to Fly][].

Important bits to repeat:
- `fly launch`
- `fly volumes create pebbling_club_litefs --size 10`
- `fly consul attach`

[deploying to Fly]: https://fly.io/docs/litefs/getting-started-fly/