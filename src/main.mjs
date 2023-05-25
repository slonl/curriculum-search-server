import express from 'express'
import flex from 'flexsearch'
import cache from 'memory-cache'
import cors from 'cors'
import Curriculum from 'curriculum-js'

const app = express()
app.use(cors())

const index = new flex.Index()
const port = process.env.NODE_PORT || 3701

const dataDir = process.env.DATA_DIR || '../data'
console.log(dataDir)

const apiDir = process.env.API_DIR || '.'

const curriculum = new Curriculum()

const dataset = [
    'basis',
    'kerndoelen',
    'leerdoelenkaarten',
    'examenprogramma',
    'examenprogramma-bg',
    'syllabus',
    'inhoudslijnen',
    'referentiekader',
    'doelgroepteksten'
]

let schemas = []

dataset.forEach(set => {
    console.log(dataDir+'/curriculum-'+set+'/context.json')

    schemas[set] = curriculum.loadContextFromFile(
        'curriculum-' + set,
        dataDir + '/curriculum-' + set + '/context.json'
    )
})

Promise.allSettled(Object.values(schemas))
.then(() => {
    Object.keys(curriculum.index.id).forEach(id => {
        if (curriculum.index.id[id] && curriculum.index.id[id].title) {
            index.add(id, curriculum.index.id[id].title, curriculum.index.id[id].description)
//            console.log('added '+id)
//        } else {
//            console.log('no '+id)
        }
    })
    console.log(Object.keys(curriculum.index.id).length+' entities indexed')
})

app.route('/search').get((req,res) => {
    if (!req.query || !req.query.text) {
        res.status(400)
        res.render('error: missing search parameter &quot;text&quot;');
        console.log('missing search text')
    } else {
        console.log('search for '+req.query.text)
        const ids = index.search(req.query.text)
        let results = []
        ids.forEach(id => {
            const obj = Object.assign(
                {
                    '@type': curriculum.index.type[id],
                    '@context': 'https://opendata.slo.nl/curriculum/schemas/'+curriculum.index.schema[id]+'/context.json'
                },
                curriculum.index.id[id]
            )
            results.push(obj)
        })
        res.json(results)
        console.log(results.length+' results')
    }        
})

app.listen(port, () => console.log(`JSON text search server listening on port ${port}!`))
