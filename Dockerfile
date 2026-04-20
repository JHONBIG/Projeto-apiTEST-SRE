FROM node:18
WORKDIR /app
COPY . .
RUN npm install express prom-client
CMD ["node", "app.js"]