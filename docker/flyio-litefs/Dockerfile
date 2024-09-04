FROM node:16.19.0-slim

# Create app directory
WORKDIR /usr/src/app

# Install LiteFS dependencies
RUN apt-get update -y && apt-get install -y ca-certificates fuse3 sqlite3
COPY --from=flyio/litefs:0.5 /usr/local/bin/litefs /usr/local/bin/litefs

# Copy over LiteFS configuration
ARG LITEFS_CONFIG=litefs.yml
ADD docker/flyio-litefs/litefs.yml /tmp/litefs.yml
RUN cp /tmp/$LITEFS_CONFIG /etc/litefs.yml

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

ENV HOST=0.0.0.0
ENV PORT=8081
ENV SQLITE_DATA_PATH=/litefs
ENV AUTH_DISABLE_SIGNUP=true

RUN npm run prod:build

EXPOSE 8081
ENTRYPOINT litefs mount
# CMD [ "npm", "run", "prod:start" ]