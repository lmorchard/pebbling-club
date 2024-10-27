FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

# Install LiteFS dependencies
RUN apt-get update -y && apt-get install -y ca-certificates fuse3 sqlite3
COPY --from=flyio/litefs:0.5 /usr/local/bin/litefs /usr/local/bin/litefs

# Copy over LiteFS configuration
ARG LITEFS_CONFIG=litefs.yml
ADD docker/flyio-litefs/litefs.yml /tmp/litefs.yml
RUN cp /tmp/$LITEFS_CONFIG /etc/litefs.yml

RUN apt-get update -y \
    && apt-get install -y curl unzip tar gzip sqlite3

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && rm awscliv2.zip

ENV HOST=0.0.0.0 \
    PORT=8081 \
    SQLITE_DATA_PATH=/litefs \
    AUTH_DISABLE_SIGNUP=true

ENV BACKUP_S3_PREFIX=pebbling-dev \
    BACKUP_S3_ENDPOINT=s3.us-west-000.backblazeb2.com \
    BACKUP_S3_BUCKET_NAME=backups \
    BACKUP_S3_KEY_ID=key \
    BACKUP_S3_SECRET=secret

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE ${PORT}
ENTRYPOINT litefs mount
# CMD [ "npm", "run", "start" ]