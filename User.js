require("dotenv").config();
const mongoose=require("mongoose");


mongoose.connect(process.env.URL_DB)
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch((error) => console.error("MongoDB connection error:", error));


  
const WorkSchema = new mongoose.Schema({
    date: { type: Date, required: true }, 
    details: [{
        text: { type: String},  
        isComplete: { type: Boolean, default: false }
    }]
});


const TaskSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },  
    name: String,
    sd: String,  
    ed: String,  
    monthHeading: { type: String, default: "Task Overview" },
    work: [WorkSchema]
});

const UserSchema = new mongoose.Schema({
    name: String,
    google_id: String,
    email: String,
    password: String,
    tasks: {
        onGoing: [TaskSchema],  
        completed: []
    },
    notePad: String
});


const User=mongoose.model("User",UserSchema);
module.exports=User;
