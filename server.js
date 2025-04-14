require("dotenv").config(); // Load .env variables
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const socketIo = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Models
const UserSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String
});

const MessageSchema = new mongoose.Schema({
    sender: String,
    message: String,
    file: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Message = mongoose.model("Message", MessageSchema);

// Multer setup
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Register
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(409).json({ message: "Email already in use" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.json({ message: "User registered successfully!" });
});

// Login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, user });
});

// Upload
app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

// Socket.io chat
io.on("connection", (socket) => {
    console.log("User connected");

    socket.on("sendMessage", async (data) => {
        const { sender, message, file } = data;
        const newMessage = new Message({ sender, message, file });
        await newMessage.save();
        io.emit("receiveMessage", newMessage);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

// Start server
server.listen(5001, () => {
    console.log("🚀 Server running on port 5001");
});
