#!/bin/sh
docker run --rm -d --name pebbling-club -v `pwd`/data:/var/data -p 17000:8081 -e SITE_URL=https://pebbling.lmorchard.com -e LOG_LEVEL=debug lmorchard/pebbling-club
