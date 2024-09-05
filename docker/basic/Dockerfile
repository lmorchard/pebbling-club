FROM node:16.19.0-slim

# Create app directory
WORKDIR /usr/src/app

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
ENV SQLITE_DATA_PATH=/var/data
ENV AUTH_DISABLE_SIGNUP=false

RUN mkdir -p /var/data
RUN npm run prod:build

VOLUME [ "/var/data" ]

EXPOSE ${PORT}
CMD [ "npm", "run", "prod:start" ]  