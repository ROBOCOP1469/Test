const express = require('express');
const app = express();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const formidable = require('express-formidable');
const fsPromises = require('fs').promises;

app.set('view engine', 'ejs');

/* MongoDB settings */
const mongourl = 'mongodb+srv://admin:admin@cluster0.uwyrf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const dbName = 'store';
const collectionName = "products";
const client = new MongoClient(mongourl, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const insertDocument = async (db, doc) => {
    var collection = db.collection(collectionName);
    let results = await collection.insertOne(doc);
    console.log("insert one document:" + JSON.stringify(results));
    return results;
};

const findDocument = async (db, criteria) => {
    var collection = db.collection(collectionName);
    let results = await collection.find(criteria).toArray();
    console.log("find the documents:" + JSON.stringify(results));
    return results;
};

const updateDocument = async (db, criteria, updateData) => {
    var collection = db.collection(collectionName);
    let results = await collection.updateOne(criteria, { $set: updateData });
    console.log("update one document:" + JSON.stringify(results));
    return results;
};

const deleteDocument = async (db, criteria) => {
    var collection = db.collection(collectionName);
    let results = await collection.deleteMany(criteria);
    console.log("delete one document:" + JSON.stringify(results));
    return results;
};
/* End of MongoDB settings */

const users = [
    { username: 'admin', password: 'admin' },
    { username: 'user1', password: 'password1' },
    { username: 'user2', password: 'password2' }
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "yourSecretKey", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  (username, password, done) => {
    const user = users.find(user => user.username === username);
    if (!user) {
      return done(null, false, { message: 'Incorrect username or password' });
    }
    if (user.password !== password) {
      return done(null, false, { message: 'Incorrect username or password' });
    }
    return done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user.username));
passport.deserializeUser((username, done) => {
  const user = users.find(user => user.username === username);
  done(null, user);
});

app.use((req, res, next) => {
  let d = new Date();
  console.log(`TRACE: ${req.path} was requested at ${d.toLocaleDateString()}`);
  next();
});

const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

app.get("/login", (req, res) => {
  res.status(200).render('login');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: "/",
  failureRedirect: "/login"
}));

/* CRUD handler functions */
const handle_Create = async (req, res) => {
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db(dbName);
  let newDoc = {
    productId: req.fields.productId,
    productName: req.fields.productName,
    productQuantity: req.fields.productQuantity,
    productPrice: req.fields.productPrice
  };
  if (req.files.filetoupload && req.files.filetoupload.size > 0) {
    const data = await fsPromises.readFile(req.files.filetoupload.path);
    newDoc.photo = Buffer.from(data).toString('base64');
  }
  await insertDocument(db, newDoc);
  res.redirect('/');
};

const handle_Find = async (req, res, criteria) => {
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db(dbName);
  const docs = await findDocument(db, criteria);
  res.status(200).render('list', { products: docs, user: req.user });
};

const handle_Details = async (req, res, criteria) => {
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db(dbName);
  let DOCID = { _id: ObjectId.createFromHexString(criteria._id) };
  const docs = await findDocument(db, DOCID);
  res.status(200).render('details', { product: docs[0], user: req.user });
};

const handle_Edit = async (req, res, criteria) => {
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db(dbName);
  let DOCID = { _id: ObjectId.createFromHexString(criteria._id) };
  let docs = await findDocument(db, DOCID);
  if (docs.length > 0) {
    res.status(200).render('edit', { product: docs[0], user: req.user });
  } else {
    res.status(500).render('info', { message: 'Unable to edit - product not found!', user: req.user });
  }
};

const handle_Update = async (req, res, criteria) => {
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db(dbName);
  const DOCID = { _id: ObjectId.createFromHexString(req.fields._id) };
  let updateData = {
    productId: req.fields.productId,
    productName: req.fields.productName,
    productQuantity: req.fields.productQuantity,
    productPrice: req.fields.productPrice
  };
  if (req.files.filetoupload && req.files.filetoupload.size > 0) {
    const data = await fsPromises.readFile(req.files.filetoupload.path);
    updateData.photo = Buffer.from(data).toString('base64');
  }
  const results = await updateDocument(db, DOCID, updateData);
  res.status(200).end(`Updated ${results.modifiedCount} document(s)`);
};

const handle_Delete = async (req, res) => {
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db(dbName);
  let DOCID = { _id: ObjectId.createFromHexString(req.query._id) };
  const results = await deleteDocument(db, DOCID);
  res.status(200).render('info', { message: `Product ID ${req.query._id} removed.`, user: req.user || {} });
};

/* End of CRUD handler functions */

app.use(formidable());

app.get('/', isLoggedIn, (req, res) => {
  res.redirect('/content');
});

app.get("/content", isLoggedIn, (req, res) => {
  handle_Find(req, res, {});
});

app.get('/create', isLoggedIn, (req, res) => {
  res.status(200).render('create', { user: req.user });
});

app.post('/create', isLoggedIn, (req, res) => {
  handle_Create(req, res);
});

app.get('/details', isLoggedIn, (req, res) => {
  handle_Details(req, res, req.query);
});

app.get('/edit', isLoggedIn, (req, res) => {
  handle_Edit(req, res, req.query);
});

app.post('/update', isLoggedIn, (req, res) => {
  handle_Update(req, res, req.query);
});

app.get('/delete', isLoggedIn, (req, res) => {
  handle_Delete(req, res);
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

/* RESTful CRUD APIs for stock management */

// Create Product (HTTP GET)
app.get('/api/product/create', async (req, res) => {
    try {
        await client.connect();
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        const product = {
            productId: req.query.productId,
            productName: req.query.productName,
            productQuantity: req.query.productQuantity,
            productPrice: req.query.productPrice
        };
        const result = await insertDocument(db, product);
        res.status(201).json({ message: 'Product created successfully', result });
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error', error: err });
    }
});

// Read Products (HTTP POST)
app.post('/api/product/read', async (req, res) => {
    try {
        await client.connect();
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        const criteria = req.body.criteria || {};
        const products = await findDocument(db, criteria);
        res.status(200).json({ message: 'Products retrieved successfully', products });
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error', error: err });
    }
});

// Update Product (HTTP PUT)
app.put('/api/product/update', async (req, res) => {
    try {
        await client.connect();
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        const productId = req.body._id;
        const updateData = req.body.updateData;
        const result = await updateDocument(db, { _id: ObjectId(productId) }, updateData);
        res.status(200).json({ message: 'Product updated successfully', result });
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error', error: err });
    }
});

// Delete Product (HTTP DELETE)
app.delete('/api/product/delete', async (req, res) => {
    try {
        await client.connect();
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        const productId = req.body._id;
        const result = await deleteDocument(db, { _id: ObjectId(productId) });
        res.status(200).json({ message: 'Product deleted successfully', result });
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error', error: err });
    }
});

app.get('/*', (req, res) => { 
  res.status(404).render('info', { message: `${req.path} - Unknown request!`, user: req.user || {} }); });

const port = process.env.PORT || 8099;
app.listen(port, () => { console.log(`Listening at http://localhost:${port}`); });
