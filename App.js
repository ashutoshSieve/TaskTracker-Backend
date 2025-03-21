require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { jsonwebtoken, generateJWT } = require("./Jwt"); // Fixed import
const passport = require("passport");
const User = require("./User");
const mongoose=require("mongoose");

const app = express();

const monthMap = {
    January: "01", February: "02", March: "03", April: "04",
    May: "05", June: "06", July: "07", August: "08",
    September: "09", October: "10", November: "11", December: "12"
};

app.use(cors({
    origin: ["https://task-tracker-app20.netlify.app"],
    methods: ["GET", "POST", "DELETE", "PUT"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(passport.initialize());
app.use(cookieParser());

require("./Gauth");


app.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
      const user = req.user;
      const token = generateJWT({ id: user._id, name: user.name, email: user.email });

      res.cookie("jwt", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "None",
          maxAge: 24 * 60 * 60 * 1000
      });

      res.redirect("https://task-tracker-app20.netlify.app/main");
  }
);

// 🔹 Verify JWT Token Route
app.get("/verify-token", jsonwebtoken, (req, res) => {
    res.status(200).json({ message: "Token is valid", user: req.payload });
});


app.get("/home", jsonwebtoken, async(req,res) =>{
    try {
        const user = await User.findById(req.payload.id);
        if(!user){
            return res.status(404).json({ message: "User not found" });
        }
        res.json({name:user.name});
    } catch (error) {
        res.status(500).json({ message: "Error User Info ", error });
    }
});


app.get("/details/:ID", jsonwebtoken, async (req, res) => {
    try {
        const user = await User.findOne({
            $or: [
                { "tasks.onGoing._id": req.params.ID }, 
                { "tasks.completed._id": req.params.ID }
            ]
        });

        if (!user) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Find task in user's onGoing or completed tasks
        let findTask = user.tasks.onGoing.find(task => task._id.toString() === req.params.ID) || 
                       user.tasks.completed.find(task => task._id.toString() === req.params.ID);

        if (!findTask) {
            return res.status(404).json({ message: "Task not found in user's tasks" });
        }
        res.json({ task: findTask });

    } catch (error) {
        console.error("Error finding task:", error);
        res.status(500).json({ message: "Server error", error });
    }
});


app.get("/completed", jsonwebtoken, async(req,res) =>{
    try {
        const user = await User.findById(req.payload.id);
        if(!user){
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ tasks: user.tasks.completed });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});


app.get("/onGoings", jsonwebtoken, async (req, res) => {
    try {
        const user = await User.findById(req.payload.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const tasks = user.tasks.onGoing.map(task => ({
            _id: task._id || new mongoose.Types.ObjectId(),  // Ensure _id exists
            name: task.name,
            sd: task.sd,
            ed: task.ed
        }));

        res.json({ tasks });
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});


app.post("/create", jsonwebtoken, async (req, res) => {
    try {
        const user = await User.findById(req.payload.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const { taskName, startDate, endDate } = req.body;

        const newTask = {
            _id: new mongoose.Types.ObjectId(),  // Ensure _id is assigned
            name: taskName,
            sd: startDate,
            ed: endDate
        };

        user.tasks.onGoing.push(newTask);
        await user.save();

        res.status(201).json({ message: "Task added successfully", taskId: newTask._id });
    } catch (error) {
        console.error("Error adding task:", error);
        res.status(500).json({ message: "Server error", error });
    }
});


app.delete("/deleteTask/:id", jsonwebtoken, async (req, res) => {
    try {
        const user = await User.findById(req.payload.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.tasks.onGoing = user.tasks.onGoing.filter(task => task._id.toString() !== req.params.id);
        await user.save();

        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});



app.post("/logout", async(req,res) =>{
    res.clearCookie("jwt");
    res.json({ message: "Logged out successfully" });
});

app.post("/signup", async(req,res) =>{
    try {
       const {name,email,password} = req.body;
       const isUserExist=await User.findOne({email});

       if (isUserExist) return res.status(400).json({ message: "User already exists" });

       const newUser = new User({ name, email, password });
       await newUser.save();
       
       const token = generateJWT({ id: newUser._id, email: newUser.email, name: newUser.name});

       res.cookie("jwt", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "None"
      });
    

        res.status(201).json({ message: "User created successfully!", token });
    } catch (error) {
        res.status(500).json({ message: "Error creating user", error });
    }
})

app.post("/login", async(req,res) =>{
    try {
        const {email,password} = req.body;
        const existUser = await User.findOne({email});

        if (!existUser || (password!==existUser.password)) {
            return res.status(400).json({ message: "Wrong credentials" });
        }

        const token = generateJWT({ id: existUser._id, name: existUser.name, email: existUser.email });

        res.cookie("jwt", token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "None"
        });

        res.status(200).json({ message: "User logged in successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error logging in", error });
    }
});


// daily tasks 

app.get("/workDetail/:id", jsonwebtoken, async (req, res) => {
    try {
        const { id } = req.params;
        const { date, month, year } = req.query;

        const user = await User.findById(req.payload.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Convert query params into a proper Date format
        const formattedDate = new Date(`${year}-${monthMap[month]}-${date}T00:00:00Z`);

        // Check tasks in both onGoing and completed
        let workDetails = [];

        const allTasks = [...user.tasks.onGoing, ...user.tasks.completed];
        for (const task of allTasks) {
            const workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);
            if (workEntry) {
                workDetails = workEntry.details;
                break; // Exit loop once we find the work details
            }
        }

        res.json({ work: workDetails });
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

app.post("/addTask", jsonwebtoken, async (req, res) => {
    try {
        const { id, date, month, year, taskText } = req.body;
        const user = await User.findById(req.payload.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Find the task inside the user's onGoing tasks
        const task = user.tasks.onGoing.id(id); 
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Convert date into correct format
        const formattedDate = new Date(`${year}-${monthMap[month]}-${date}T00:00:00Z`);

        // Find if work for this date exists
        let workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);

        if (!workEntry) {
            // If the date does not exist, create a new work entry
            workEntry = { date: formattedDate, details: [taskText] };
            task.work.push(workEntry);
        } else {
            // If the date exists, add the task to details
            workEntry.details.push(taskText);
        }
        await user.save();
        res.status(201).json({ message: "Task added successfully", task });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

app.put("/updateTask", jsonwebtoken, async (req, res) => {
    try {
        const { id, date, month, year, oldTaskText, newTaskText } = req.body;
        const user = await User.findById(req.payload.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Find the task inside the user's ongoing tasks
        const task = user.tasks.onGoing.id(id);
        if (!task) return res.status(404).json({ message: "Task not found" });

        // Convert date into correct format
        const formattedDate = new Date(`${year}-${monthMap[month]}-${date}T00:00:00Z`);

        // Find the work entry for the given date
        let workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);

        if (workEntry) {
            const taskIndex = workEntry.details.indexOf(oldTaskText);
            if (taskIndex !== -1) {
                workEntry.details[taskIndex] = newTaskText;
                await user.save();
                return res.json({ message: "Task updated successfully", updatedTask: newTaskText });
            } else {
                return res.status(404).json({ message: "Task text not found in work details" });
            }
        } else {
            return res.status(404).json({ message: "Work entry not found for this date" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

app.delete("/deleteTask", jsonwebtoken, async (req, res) => {
    try {
        const { id, date, month, year, taskText } = req.body;
        const user = await User.findById(req.payload.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Find the task inside the user's ongoing tasks
        const task = user.tasks.onGoing.id(id);
        if (!task) return res.status(404).json({ message: "Task not found" });

        // Convert date into correct format
        const formattedDate = new Date(`${year}-${monthMap[month]}-${date}T00:00:00Z`);

        // Find the work entry for the given date
        let workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);

        if (workEntry) {
            // Remove the task from the details array
            workEntry.details = workEntry.details.filter(task => task !== taskText);

            // If the details array is empty, remove the entire work entry
            if (workEntry.details.length === 0) {
                task.work = task.work.filter(w => w.date.toISOString().split('T')[0] !== formattedDate.toISOString().split('T')[0]);
            }

            await user.save();
            return res.json({ message: "Task deleted successfully" });
        } else {
            return res.status(404).json({ message: "Work entry not found for this date" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});




app.put("/updateMonthHeading/:taskId", async (req, res) => {
    const { taskId } = req.params;
    const { monthHeading } = req.body;

    try {
        const user = await User.findOne({ "tasks.onGoing._id": taskId });

        if (!user) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        const task = user.tasks.onGoing.find(task => task._id.toString() === taskId);
        if (task) {
            task.monthHeading = monthHeading;
            await user.save();
            return res.json({ success: true, message: "Month heading updated successfully" });
        }

        res.status(404).json({ success: false, message: "Task not found" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
});




const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
