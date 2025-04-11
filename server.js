const express = require("express");
const http = require("http");
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

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Multer Setup for File Uploads
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

// In-memory "database"
let users = [];
let messages = [];

// User Registration
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { id: Date.now(), username, email, password: hashedPassword };
    users.push(user);
    res.json({ message: "User registered successfully!" });
});

// User Login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user.id }, "secretkey", { expiresIn: "1h" });
    res.json({ token, user });
});

// File Upload Endpoint
app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

// Socket.io Chat Implementation
io.on("connection", (socket) => {
    console.log("User connected");

    socket.on("sendMessage", (data) => {
        const { sender, message, file } = data;
        const newMessage = {
            sender,
            message,
            file,
            timestamp: new Date()
        };
        messages.push(newMessage);
        io.emit("receiveMessage", newMessage);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

// Start Server
server.listen(5001, () => {
    console.log("Server running on port 5001");
});
