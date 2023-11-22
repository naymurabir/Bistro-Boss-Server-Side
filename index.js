const express = require('express');
const cors = require('cors');
require('dotenv').config()
var cookieParser = require('cookie-parser')
var jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

//Middleware 
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())

//Database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cgjyfgp.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Custom Middleware 
const logger = async (req, res, next) => {
    console.log("Called:", req.host, req.originalUrl);
    next()
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies.token
    console.log("The desired token:", token);

    if (!token) {
        return res.status(401).send({ message: "Unauthorized" })
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Unauthorized" })
        }
        console.log("The value of token:", decoded);
        req.decoded = decoded
        next()
    })

}



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db("BistroDB").collection("users")

        const menusCollection = client.db("BistroDB").collection("menus")

        const reviewsCollection = client.db("BistroDB").collection("reviews")

        const cartsCollection = client.db("BistroDB").collection("carts")

        const paymentsCollection = client.db("BistroDB").collection("payments")

        // Use verify admin admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded?.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }


        // ---------------------------------------------------------
        //JWT Related APIs
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.cookie('token', token, {
                httpOnly: true,
                // secure: false,
                // sameSite: 'none'

            }).send({ success: true })
        })

        //Remove token after logout the user
        app.post('/logout', async (req, res) => {
            const user = req.body
            console.log("User: ", user);
            res.clearCookie('token', {
                maxAge: 0,
                // secure: process.env.NODE_ENV === 'production' ? true : false,
                // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
                .send({ status: true })
        })

        // ---------------------------------------------------------
        //Users related APIs
        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const existUser = await userCollection.findOne(query)
            if (existUser) {
                return res.send({ message: "User already exists.", insertedId: null })
            } else {
                const result = await userCollection.insertOne(user)
                res.send(result)
            }
        })

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const cursor = userCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "unauthorized access" })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false
            if (user) {
                admin = user.role === 'admin'
            }
            res.send({ admin })
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                },
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // ---------------------------------------------------------
        //Menus related APIs
        app.post('/menus', async (req, res) => {
            const newItem = req.body
            const result = await menusCollection.insertOne(newItem)
            res.send(result)
        })

        app.get('/menus', async (req, res) => {
            const cursor = menusCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })

        app.delete('/menus/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await menusCollection.deleteOne(query)
            res.send(result)
        })

        app.put('/menus/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updateItem = req.body
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    name: updateItem.name,
                    category: updateItem.category,
                    recipe: updateItem.recipe,
                    price: updateItem.price
                }
            }
            const result = await menusCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })



        // ---------------------------------------------------------

        //Reviews related APIs
        app.get('/reviews', async (req, res) => {
            const cursor = reviewsCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })

        // ---------------------------------------------------------

        //Carts related APIs
        app.post('/carts', async (req, res) => {
            const newCart = req.body
            const result = await cartsCollection.insertOne(newCart)
            res.send(result)
        })

        app.get('/carts', async (req, res) => {
            let query = {}
            if (req.query?.email) {
                query = { email: req.query?.email }
            }
            const result = await cartsCollection.find(query).toArray()
            res.send(result)
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartsCollection.deleteOne(query)
            res.send(result)
        })

        // ---------------------------------------------------------

        //PAYMENT INTENT Related APIs
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body
            const amount = parseInt(price * 100)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/payments', async (req, res) => {
            const newPayment = req.body
            const result = await paymentsCollection.insertOne(newPayment)
            console.log("Payment info", newPayment);

            const query = {
                _id: {
                    $in: newPayment?.cartIds?.map(id => new ObjectId(id))
                }
            }
            const deleteResult = await cartsCollection.deleteMany(query)
            res.send({ result, deleteResult })
        })

        app.get('/payments', async (req, res) => {
            let query = {}
            if (req.query?.email) {
                query = { email: req.query?.email }
            }
            const result = await paymentsCollection.find(query).toArray()
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Bistro Boss server is running...")
})

app.listen(port, (req, res) => {
    console.log(`The bistro boss server is running on port ${port}`);
})