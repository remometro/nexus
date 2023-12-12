// rev-proxy
const express = require('express')
var bodyParser = require('body-parser')
const app = express()
const port = 3000

const memo = {
	audio: '1'
}

const sources = {
	0: 'https://purizucom.out.airtime.pro/purizucom_a',
	1: 'my icecast'
}

app.use(bodyParser.json())

app.get('/audio', (req, res) => {
  res.send(`Audio ${memo.audio}!`)
})

app.get('/info', (req, res) => {
  res.send(`Audio ${memo.audio}!`)
})


app.post('/source', (req, res) => {
  const option = req?.body?.option
  memo.audio = sources[option]
  res.send(`200: Changed source to ${sources[option]}`)
  res.end()
})


app.listen(port, () => {
  console.log(`Nexus listening on port ${port}`)
})
