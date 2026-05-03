FROM node:20-alpine

WORKDIR /opt/fitro360-relay

COPY package.json ./
COPY src ./src
COPY config.example.json ./

ENV FITRO360_CONFIG=/etc/fitro360/config.json
VOLUME ["/etc/fitro360"]

ENTRYPOINT ["node", "src/index.js"]
