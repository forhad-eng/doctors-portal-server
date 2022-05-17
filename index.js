const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion } = require('mongodb')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded
        next()
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j1agm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 })

async function run() {
    try {
        await client.connect()
        const serviceCollection = client.db('doctorsPortal').collection('service')
        const bookingsCollection = client.db('doctorsPortal').collection('bookings')
        const userCollection = client.db('doctorsPortal').collection('users')
        const doctorCollection = client.db('doctorsPortal').collection('doctors')

        const verifyAdmin = async (req, res, next) => {
            const user = req.decoded.email
            const userAcc = await userCollection.findOne({ email: user })
            if (userAcc.role === 'admin') {
                next()
            } else {
                res.status(401).send({ success: false, message: 'Unauthorized access' })
            }
        }

        //ADMIN
        app.get('/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            res.send({ admin: true })
        })

        //DOCTORS
        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await doctorCollection.find().toArray()
            res.send(result)
        })

        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body
            const result = await doctorCollection.insertOne(doctor)
            if (result.insertedId) {
                res.send({ success: true, message: 'Inserted successfully' })
            }
        })

        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email
            const result = await doctorCollection.deleteOne({ email })
            if (result.deletedCount) {
                res.send({ success: true, message: 'Removed successfully' })
            }
        })

        //USERS
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email
            const filter = { email }
            const updatedDoc = { $set: { role: 'admin' } }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email }
            const option = { upsert: true }
            const updatedDoc = { $set: { email } }
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            const result = await userCollection.updateOne(filter, updatedDoc, option)
            if (result) {
                res.send({ accessToken })
            }
        })

        //SERVICES
        app.get('/service', verifyJWT, async (req, res) => {
            const result = await serviceCollection.find().project({ name: 1 }).toArray()
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
            })

            res.send({ success: true, result: services })
        })

        //BOOKINGS
        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient
            const decodedEmail = req.decoded.email
            if (patient === decodedEmail) {
                const query = { patient }
                const result = await bookingsCollection.find(query).toArray()
                res.send(result)
            }
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
