FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

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

COPY . .

RUN mkdir -p /var/data
VOLUME [ "/var/data" ]

EXPOSE ${PORT}
CMD [ "npm", "run", "start" ]
