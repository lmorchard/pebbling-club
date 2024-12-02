FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

RUN apt-get update -y \
    && apt-get install -y curl unzip tar gzip sqlite3

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && rm awscliv2.zip

ENV HOST=0.0.0.0 \
    PORT=8081 \
    SITE_URL=https://example.com \
    SESSION_KEY=8675309jenny \
    SESSION_EXPIRATION_INTERVAL=604800000 \
    SQLITE_DATA_PATH=/var/data \
    SQLITE_FILENAME=data.sqlite3 \
    AUTH_DISABLE_SIGNUP=false \
    LOG_LEVEL=info \
    LOG_SINGLE_LINE=true

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

RUN mkdir -p /var/data
VOLUME [ "/var/data" ]

EXPOSE ${PORT}
CMD [ "npm", "run", "prod:single-node" ]
