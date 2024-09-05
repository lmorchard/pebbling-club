# quick notes on deploying with docker / podman

- `podman build -t lmorchard/pebbling-club -f docker/basic/Dockerfile .`
- `podman run -it --rm --env PORT=9999 -p 9999:9999 --volume ./data:/var/data:z lmorchard/pebbling-club`
