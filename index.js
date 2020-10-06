const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qvbao.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const ObjectId = require("mongodb").ObjectId;
const admin = require("firebase-admin");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const port = 5000;

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("hello it's working");
});

const serviceAccount = require("./volunteer-network-ef243-firebase-adminsdk-3t40n-06a20fc994.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://volunteer-network-ef243.firebaseio.com",
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
});

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
client.connect((err) => {
  const tasksCollection = client
    .db(`${process.env.DB_NAME}`)
    .collection("tasks");
  const userTasks = client.db(`${process.env.DB_NAME}`).collection("userTasks");
  const adminTasks = client
    .db(`${process.env.DB_NAME}`)
    .collection("adminTasks");

  // to upload all data
  app.post("/addTasks", (req, res) => {
    const tasks = req.body;
    tasksCollection.insertMany(tasks).then((result) => {
      res.send(result);
    });
  });

  // to add single data
  app.post("/addTask", (req, res) => {
    const newTask = req.body;
    userTasks.insertOne(newTask).then((result) => {
      res.send(result.insertedCount > 0);
    });
  });

  // to add admin event
  app.post("/addEvent", (req, res) => {
    const newEvent = req.body;
    tasksCollection.insertOne(newEvent).then((result) => {
      res.send(result.insertedCount > 0);
    });
  });

  // to retrieve all data
  app.get("/showTasks", (req, res) => {
    tasksCollection.find({}).toArray((err, documents) => {
      res.send(documents);
    });
  });

  // to retrieve single data by JWT
  app.get("/showUserTasks", (req, res) => {
    const bearer = req.headers.authorization;
    if (bearer && bearer.startsWith("Bearer ")) {
      const idToken = bearer.split(" ")[1];
      admin
        .auth()
        .verifyIdToken(idToken)
        .then(function (decodedToken) {
          const tokenEmail = decodedToken.email;
          const queryEmail = req.query.email;
          if (tokenEmail == queryEmail) {
            userTasks.find({ email: queryEmail }).toArray((err, documents) => {
              res.status(200).send(documents);
            });
          } else {
            res.status(401).send("un-authorized access");
          }
        })
        .catch(function (error) {
          res.status(401).send("un-authorized access");
        });
    } else {
      res.status(401).send("un-authorized access");
    }
  });

  // to retrieve user Info
  app.get("/showUser", (req, res) => {
    userTasks.find({}).toArray((err, documents) => {
      res.send(documents);
    });
  });

  // to delete single events data
  app.delete("/delete/:id", (req, res) => {
    userTasks.deleteOne({ _id: ObjectId(req.params.id) }).then((result) => {
      res.send(result.deletedCount > 0);
    });
  });

  // to delete single admin task
  app.delete("/deleteTask/:id", (req, res) => {
    userTasks.deleteOne({ _id: ObjectId(req.params.id) }).then((result) => {
      res.send(result.deletedCount > 0);
    });
  });

  // configuring upload image using multer
  app.post("/uploadImage", upload.single("myImage"), (req, res, next) => {
    console.log(typeof req.file);
    const img = fs.readFileSync(req.file);
    const encode_image = img.toString(base64);

    // defining json obj for image
    const final_image = {
      contentType: req.file.mimetype,
      path: req.file.path,
      image: new Buffer(encode_image, "base64"),
    };

    // inserting image to db
    adminTasks.insertOne(final_image, (err, result) => {
      console.log(result);
      if (err) {
        console.log(err);
      }
      console.log("saved to db");
      res.contentType(final_image.contentType);
      res.send(final_image.image);
    });
  });
});

app.listen(process.env.PORT || port);
