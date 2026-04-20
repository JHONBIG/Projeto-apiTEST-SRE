const express = require('express');
const client = require('prom-client');
const app = express();

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Total de requisições HTTP',
    labelNames: ['method', 'route', 'status'],
    registers: [register]
});

app.get('/', (req, res) => {
    console.log('GET /');
    httpRequests.inc({ method: 'GET', route: '/', status: 200 });
    res.send('Api OK!')
})

app.get('/health', (req, res) => {
    console.log('GET /health');
    httpRequests.inc({ method: 'GET', route: '/health', status: 200 });
    res.status(200).send('healthy');
});

app.get('/error', (req, res) => {
    console.log('GET /error - encerrando processo');
    httpRequests.inc({ method: 'GET', route: '/error', status: 500 });
    process.exit(1);
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
});

app.listen(3000, () => console.log('rodando'));