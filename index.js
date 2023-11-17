const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

//Middleware 
app.use(cors())
app.use(express.json())


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
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const menusCollection = client.db("BistroDB").collection("menus")

        const reviewsCollection = client.db("BistroDB").collection("reviews")

        const cartsCollection = client.db("BistroDB").collection("carts")

        //Menus related APIs
        app.get('/menus', async (req, res) => {
            const cursor = menusCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })

        //Reviews related APIs
        app.get('/reviews', async (req, res) => {
            const cursor = reviewsCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })

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