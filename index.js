const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j1agm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 })

async function run() {
    try {
        await client.connect()
        const serviceCollection = client.db('doctorsPortal').collection('service')
        const bookingsCollection = client.db('doctorsPortal').collection('bookings')

        app.get('/service', async (req, res) => {
            const query = req.query
            const result = await serviceCollection.find(query).toArray()
            if (result) {
                return res.send({ success: true, result: result })
            }
            res.send({ success: false, message: 'Server error' })
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date
            const services = await serviceCollection.find().toArray()
            const bookings = await bookingsCollection.find({ date }).toArray()

            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatment === service.name)
                const booked = serviceBookings.map(s => s.slot)
                service.slots = service.slots.filter(slot => !booked.includes(slot))
                console.log(serviceBookings, booked)
            })

            res.send({ success: true, result: services })
        })

        //Bookings
        app.get('/booking', async (req, res) => {
            const patient = req.query.patient
            const query = { patient }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exits = await bookingsCollection.findOne(query)
            if (exits) {
                return res.send({ success: false, message: 'Already booked' })
            }
            const result = await bookingsCollection.insertOne(booking)
            if (result.insertedId) {
                res.send({ success: true, message: 'Booking Success' })
            }
        })
    } finally {
    }
}

run().catch(console.dir)

app.listen(port, () => {
    console.log('Listening to port', port)
})
