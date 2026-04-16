const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Api OK!')
})

app.get('/health', (req, res) => {
    res.status(200).send('healthy');
});

app.get('/error', (req, res) => {
    process.exit(1);
});

app.listen(3000, () => console.log('rodando'));