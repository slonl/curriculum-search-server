import express from 'express'
import flex from 'flexsearch'
import cache from 'memory-cache'
import cors from 'cors'
import JSONTag from '@muze-nl/jsontag'
import parse from '@muze-nl/od-jsontag/src/parse.mjs'
import serialize from '@muze-nl/od-jsontag/src/serialize.mjs'
import { getAttribute } from '@muze-nl/od-jsontag/src/jsontag.mjs'
import fs from 'fs'

const app = express()
app.use(cors())

const index = new flex.Index()
const port = process.env.NODE_PORT || 3701

const dataDir = process.env.DATA_DIR || '../data'
console.log(dataDir)

const apiDir = process.env.API_DIR || '.'

const extension = '.jsontag'
const basefile = dataDir + '/data/data'

let count = 0
let dataspace
let jsontag
let meta = {}
let parseMeta = {}
let datafile = basefile+extension
let commands = readCommands(dataDir)
commands.push('done')
do {
    if (fs.existsSync(datafile)) {
        jsontag = fs.readFileSync(datafile)
        dataspace = parse(jsontag, parseMeta)
        count++
    }
    datafile = basefile + '.' + commands.shift() + extension
} while (commands.length)
serialize(dataspace, {meta})

jsontag = fs.readFileSync(dataDir + '/data/schema.jsontag', 'utf-8')
meta.schema = JSONTag.parse(jsontag)

function readCommands(dataDir) {
    const str = fs.readFileSync(dataDir+'/command-status.jsontag', 'utf-8')
    const lines = str.split('\n').filter(Boolean)
    const commands = []
    for (const line of lines) {
        const command = JSON.parse(line.trim())
        if (command.status=='done') {
            commands.push(command.command)
        }
    }
    return commands
}

function getSchema(type) {
    for (const context in meta.schema.contexts) {
        for (const entry in (meta.schema.contexts[context])) {
            if (entry == type) {
                return 'https://opendata.slo.nl/curriculum/schema/curriculum-'+context+'/context.json'
            }
        }
    }
}

count = 0
let deprecated = 0
meta.index.id.forEach((offset,id) => {
    let value = parseMeta.resultArray[offset]
    if (value?.replacedBy) {
        deprecated++
    } else if (value?.title || value?.description) {
        count++
        index.add(id, value.title, value.description)
    }
})
console.log(meta.index.id.size+' entities indexed, '+deprecated+' deprecated')

app.route('/search').get((req,res) => {
    if (!req.query || !req.query.text) {
        res.status(400)
        res.render('error: missing search parameter &quot;text&quot;');
        console.log('missing search text')
    } else {
        const ids = index.search(req.query.text)
        let results = []
        ids.forEach(id => {
            const offset = meta.index.id.get(id)
            const entity = parseMeta.resultArray[offset]
            const type = getAttribute(entity, 'class')
            const schema = getSchema(type)
            let result = {
                '@type': type,
                '@context': schema
            }
            for (let property in meta.schema.types[type].properties) {
                result[property] = entity[property]
            }
            results.push(result)
        })
        res.json(results)
    }        
})

app.listen(port, () => console.log(`JSON text search server listening on port ${port}!`))
