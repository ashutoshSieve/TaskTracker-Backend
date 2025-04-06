require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { jsonwebtoken, generateJWT } = require("./Jwt"); 
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
            _id: task._id || new mongoose.Types.ObjectId(), 
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
            _id: new mongoose.Types.ObjectId(),  
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



app.get("/logout", function(req,res){
    req.logout(function(err){
        if(err){return next(err);}
        res.redirect("/");
    });
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
            sameSite: "None",
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
            sameSite: "None",
        });

        res.status(200).json({ message: "User logged in successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error logging in", error });
    }
});




app.get("/workDetail/:id/:taskName", jsonwebtoken, async (req, res) => {
    try {
        const { id, taskName } = req.params;
        const { date, month, year } = req.query;

        if (!date || !month || !year) {
            return res.status(400).json({ message: "Date, month, and year are required." });
        }

        const user = await User.findById(req.payload.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const paddedDate = String(date).padStart(2, '0');
        const formattedDate = new Date(`${year}-${monthMap[month]}-${paddedDate}T00:00:00Z`);

        
        let task = user.tasks.onGoing.find(t => t.name === taskName) ||
                   user.tasks.completed.find(t => t.name === taskName);

        if (!task) return res.status(404).json({ message: "Task not found." });

        
        const workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);

        res.json({
            success: true,
            message: workEntry ? "Work found." : "No work found for this date.",
            work: workEntry ? workEntry.details : []
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
});

app.post("/addTask", jsonwebtoken, async (req, res) => {
    try {
        const { id, date, month, year, taskText, completed, taskName } = req.body;
        
        const user = await User.findById(req.payload.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const paddedDate = String(date).padStart(2, '0');
        const formattedDate = new Date(`${year}-${monthMap[month]}-${paddedDate}T00:00:00Z`);

        
        let task = user.tasks.onGoing.find(t => t.name === taskName) ||
                   user.tasks.completed.find(t => t.name === taskName);

        if (!task) return res.status(404).json({ message: "Task not found" });

        
        let workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);

        if (workEntry) {
            workEntry.details.push({ text: taskText, isComplete: completed });
        } else {
            task.work.push({ date: formattedDate, details: [{ text: taskText, isComplete: completed }] });
        }

        await user.save();
        res.json({ message: "Task added successfully", task });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});


app.put("/updateTask", jsonwebtoken, async (req, res) => {
    try {
        const { id, date, month, year, oldTaskText, newTaskText } = req.body;
        const user = await User.findById(req.payload.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        
        const task = user.tasks.onGoing.id(id);
        if (!task) return res.status(404).json({ message: "Task not found" });

        const paddedDate = String(date).padStart(2, '0');
        const formattedDate = new Date(`${year}-${monthMap[month]}-${paddedDate}T00:00:00Z`);

        
        let workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);

        if (workEntry) {
            const taskItem = workEntry.details.find(t => t.text === oldTaskText);
            if (taskItem) {
                taskItem.text = newTaskText;
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

        
        const task = user.tasks.onGoing.id(id);
        if (!task) return res.status(404).json({ message: "Task not found" });

        const paddedDate = String(date).padStart(2, '0');
        const formattedDate = new Date(`${year}-${monthMap[month]}-${paddedDate}T00:00:00Z`);

       
        let workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);

        if (workEntry) {
            workEntry.details = workEntry.details.filter(task => task.text !== taskText);

           
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

app.put("/toggleTaskCompletion", jsonwebtoken, async (req, res) => {
    try {
        const { id, date, month, year, taskText, completed } = req.body;

        if (!date || !month || !year || !taskText) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        
        const user = await User.findById(req.payload.id);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        
        const task = user.tasks.onGoing.id(id);
        if (!task) {
            return res.status(404).json({ error: "Task not found." });
        }

        const paddedDate = String(date).padStart(2, '0');
        const formattedDate = new Date(`${year}-${monthMap[month]}-${paddedDate}T00:00:00Z`);
        
        
        const workEntry = task.work.find(w => w.date.toISOString().split('T')[0] === formattedDate.toISOString().split('T')[0]);
        if (!workEntry) {
            return res.status(404).json({ error: "Work entry not found for the given date." });
        }

        
        const taskDetail = workEntry.details.find(detail => detail.text === taskText);
        if (!taskDetail) {
            return res.status(404).json({ error: "Task text not found in work details." });
        }

       
        taskDetail.isComplete = completed;

        
        await user.save();
        res.status(200).json({ message: "Task completion status updated successfully." });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ error: "Internal Server Error." });
    }
});




app.put("/updateMonthHeading/:taskId", jsonwebtoken, async (req, res) => {
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



app.put("/notepadAdd", jsonwebtoken, async (req, res) => {
    try {
        const user = await User.findById(req.payload.id);
        const { text, firstText } = req.body;
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!text.trim()) {
            user.notePad = "";
        } else {
            user.notePad = text.trim();
        }

        await user.save();

        res.json({ success: true, message: "Note updated successfully!", notePad: user.notePad });
    } catch (error) {
        console.error("Error updating notepad:", error);
        res.status(500).json({ success: false, message: "Server error", error });
    }
});


app.get("/notepad", jsonwebtoken, async (req, res) => {
    try {
        if (!req.payload) {
            return res.status(401).json({ success: false, message: "Unauthorized access" });
        }

        const user = await User.findById(req.payload.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, notePad: user.notePad || "" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
});



app.get("/getGraph/:name", jsonwebtoken, async (req, res) => {
    try {
        if (!req.payload) {
            return res.status(401).json({ success: false, message: "Unauthorized access" });
        }

        const { name } = req.params;
        const user = await User.findById(req.payload.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const task = user.tasks.onGoing.find(t => t.name === name);
        if (!task) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        
        const calculateCompletion = (startDate) => {
            const filteredTasks = task.work.filter(w => new Date(w.date) >= startDate);
            const totalTasks = filteredTasks.reduce((acc, w) => acc + w.details.length, 0);
            const completedTasks = filteredTasks.reduce((acc, w) => acc + w.details.filter(d => d.isComplete).length, 0);

            return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        };

        
        const todayCompletion = calculateCompletion(today);
        const weekCompletion = calculateCompletion(startOfWeek);
        const monthCompletion = calculateCompletion(startOfMonth);
        const overallCompletion = calculateCompletion(new Date(task.createdAt));

        res.status(200).json({
            success: true,
            todayCompletion,
            weekCompletion,
            monthCompletion,
            overallCompletion
        });

    } catch (error) {
        console.error("Error fetching graph data:", error);
        res.status(500).json({ success: false, message: "Server error", error });
    }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
