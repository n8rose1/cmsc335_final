// #region Requires
const axios = require("axios");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
require("dotenv")
const { MongoClient, ServerApiVersion, BSON } = require('mongodb');
// #endregion

// #region Set up MongoDB
const uri = process.env.MONGO_CONNECTION_STRING;
const db = process.env.MONGO_DB_NAME;
//  #endregion 

// #region Set up web server
const app = express();
const portNumber = 5000;

// set up views
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

// enable body parsing
app.use(bodyParser.urlencoded({extended:false}));

// set up assets
app.use(express.static(path.resolve(__dirname, "public")));

// #endregion

// #region Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/exercises", async (req, res) => {
    const exercise = req.query.exercise;
    let limit = (req.query.max) ? parseInt(req.query.max) : 25
    let offset = (req.query.offset) ? parseInt(req.query.offset) : 0
    if (limit < 0) {
        limit = 0;
    }
    if (offset < 0) {
        offset = 0;
    }
    const {mongoExercises, apiExercises} = await getExercises(exercise, limit, offset);
    const targets = await getExerciseTargets()
    const equipment = await getExerciseEquipments()
    const numApi = apiExercises.length;
    const variables = {
        exerciseString: exercise,
        limit: limit,
        offset: offset,
        mongoExercises: mongoExercises,
        apiExercises: apiExercises,
        numApi: numApi,
        targetsDropdown: createDropdown(targets, "target", "target"),
        equipmentDropdown: createDropdown(equipment, "equipment", "equipment")
    }
    res.render("exerciseStore", variables);
})

app.post("/addExercise", async (req, res) => {
    //TODO: insert exercise
    const name = req.body.name;
    const bodyPart = req.body.bodyPart;
    const target = req.body.target;
    const equipment = req.body.equipment;

    await insertMongoExercise(name, bodyPart, target, equipment)
    res.redirect("/exercises");
});

app.get("/workouts", async (req, res) => {
    const search = req.query.search;
    const workouts = await getMongoWorkouts(search);
    console.log(workouts);
    const variables = {
        workouts: workouts
    }
    res.render("workoutsStore", variables);
})

app.get("/createWorkout", (req, res) => {
    res.render("createNewWorkout");
})

app.post("/processCreateWorkout", async(req, res) => {
    const workoutName = req.body.workoutName;
    const params = Object.keys(req.body);
    let sets = Array();
    console.log(params);

    const exercises = params.filter((param) => {
        return param.includes("exercise");
    });
    const weights = params.filter((param) => {
        return param.includes("weight");
    });
    const reps = params.filter((param) => {
        return param.includes("rep");
    });

    for (let i = 0; i < exercises.length; i++) {
        newSet = {
            exercise: req.body[exercises[i]],
            weight: parseInt(req.body[weights[i]]),
            numReps: parseInt(req.body[reps[i]])
        };
        sets.push(newSet)
    }
    await insertMongoWorkout(workoutName, sets);

    res.redirect("/workouts");
})

app.get("/workoutView/:workoutId", async (req, res) => {
    const workoutId = req.params.workoutId;
    const workout = await getMongWorkoutById(workoutId);
    console.log(workout);
    const variables = {
       workout: workout
    }
    res.render("workoutView", variables);
})
// #endregion

// #region Start Server
app.listen(portNumber);
console.log(`Web server is running at http://localhost:${portNumber}`);
// #endregion

// #region Request Functions
async function getExercises(exerciseName, limit=30, offset=0) {
    if (exerciseName) {
        exerciseName = exerciseName.trim();
        exerciseName = exerciseName.toLowerCase();
    }
    const apiExercises = await getAPIExercises(exerciseName, limit, offset);
    const mongoExercises = await getMongoExercises(exerciseName);

    return {mongoExercises, apiExercises};
}

async function getExerciseTargets() {
    const options = {
        method: 'GET',
        url: 'https://exercisedb.p.rapidapi.com/exercises/targetList',
        headers: {
          'X-RapidAPI-Key': 'bee4ecda73mshe5ea1334f27748ap188c8djsn44a0ff915701',
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        return response.data;
    } catch (error) {
        console.error(error);
    }
}

async function getExerciseEquipments() {
    const options = {
        method: 'GET',
        url: 'https://exercisedb.p.rapidapi.com/exercises/equipmentList',
        headers: {
          'X-RapidAPI-Key': 'bee4ecda73mshe5ea1334f27748ap188c8djsn44a0ff915701',
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        return response.data;
    } catch (error) {
        console.error(error);
    }
}

function createDropdown(data, selectId, selectName) {
    let html = `<select id=${selectId} name=${selectName}>`;
    data.forEach(option => {
        const name = toTitleCase(option);
        html += `<option value="${name}">${name}</option>`;
    })
    html += `</select>`;
    return html;
}

async function getAPIExercises(exerciseName, limit, offset) {
    let options = {
        method: 'GET',
        url: 'https://exercisedb.p.rapidapi.com/exercises',
        params: {
            offset: `${offset}`,
            limit: `${limit}`
        },
        headers: {
          'X-RapidAPI-Key': 'bee4ecda73mshe5ea1334f27748ap188c8djsn44a0ff915701',
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        }
    };

    if (exerciseName) {
        options = {
            method: 'GET',
            url: `https://exercisedb.p.rapidapi.com/exercises/name/${exerciseName}`,
            params: {
                offset: `${offset}`,
                limit: `${limit}`
            },
            headers: {
              'X-RapidAPI-Key': 'bee4ecda73mshe5ea1334f27748ap188c8djsn44a0ff915701',
              'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
            }
          };
    }
    
    try {
        const response = await axios.request(options);
        return response.data;
    } catch (error) {
        console.error(error);
        return [];
    }
}

async function getMongoExercises(exerciseName) {
    const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });
    let exercises = [];
    try {
        await client.connect();
        const exercisesCollection = process.env.MONGO_EXERCISES_COLLECTION;
        if (exerciseName) {
            const agg = [
                {
                  $search: {
                    index: "default",
                    text: {
                      query: exerciseName,
                      path: {
                        wildcard: "*"
                      }
                    }
                  }
                }
              ]
            exercises = await client.db(db).collection(exercisesCollection).aggregate(agg).toArray()
        } else {
            exercises = await client.db(db).collection(exercisesCollection).find({}).toArray()
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    return exercises;
}

async function insertMongoExercise(name, bodyPart, target, equipment) {
    const newExercise = {
        name: name,
        bodyPart: bodyPart,
        target: target,
        equipment: equipment
    }
    const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });
    await client.connect();
    const exercisesCollection = process.env.MONGO_EXERCISES_COLLECTION;
    await client.db(db).collection(exercisesCollection).insertOne(newExercise);
}

async function getMongoWorkouts(searchValue) {
    const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });
    let workouts = [];
    await client.connect();
    const workoutCollection = process.env.MONGO_WORKOUTS_COLLECTION;
    if (searchValue && searchValue.length > 0) {
        const agg = [
            {
              $search: {
                index: "default",
                text: {
                  query: searchValue,
                  path: {
                    wildcard: "*"
                  }
                }
              }
            }
          ]
        workouts = await client.db(db).collection(workoutCollection).aggregate(agg).toArray()
    } else {
        workouts = await client.db(db).collection(workoutCollection).find({}).toArray();
    }

    return workouts;
}

async function getMongWorkoutById(workoutId) {
    const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });
    await client.connect();
    const workoutCollection = process.env.MONGO_WORKOUTS_COLLECTION;
    const id = new BSON.ObjectId(workoutId);
    const query = {"_id": id};
    workout = await client.db(db).collection(workoutCollection).findOne(query);

    return workout;
}

async function insertMongoWorkout(name, sets) {
    const newWorkout = {
        name: name,
        sets: sets
    }
    const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });
    await client.connect();
    const workoutCollection = process.env.MONGO_WORKOUTS_COLLECTION;
    await client.db(db).collection(workoutCollection).insertOne(newWorkout);
}

// #endregion

// #region Basic Functions
function toTitleCase(str) {
    str = str.toLowerCase().split(' ');
    for (let i = 0; i < str.length; i++) {
        str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
    }
    return str.join(' ');
}
// #endregion