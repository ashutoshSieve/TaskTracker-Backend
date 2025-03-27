require("dotenv").config();
const jwt = require("jsonwebtoken");

const jsonwebtoken = (req, res, next) => {
    const token = req.cookies?.jwt; 

    if (!token) {
        console.log("JWT not found, redirecting...");
        return res.status(401).json({ redirect: "/" });
    }

    try {
        const data = jwt.verify(token, process.env.JWT_SIGN);
        req.payload = data;
        next();
    } catch (err) {
        console.log("JWT verification failed:", err.message); 
        return res.status(401).json({ redirect: "/" });
    }
};

const generateJWT = (userData) => {
    return jwt.sign(userData, process.env.JWT_SIGN, { expiresIn: "1d" });
};

module.exports = { jsonwebtoken, generateJWT };
