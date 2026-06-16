const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
	cors: {
		origin: "*"
	}
});

app.use(express.static("public"));

const users = {};

io.on("connection", (socket) => {
	console.log("user connected:", socket.id);

	socket.on("join-call", (username) => {
		users[socket.id] = {
			username: username
		};

		socket.emit(
			"existing-users",
			Object.keys(users).filter(id => id !== socket.id)
		);

		console.log(username, "joined the call");

		io.emit("user-list", users);

		socket.broadcast.emit("user-joined", socket.id);
	});


	socket.on("offer", (data) => {
		socket.to(data.target).emit("offer", {
			sender: socket.id,
			offer: data.offer
		});
	});


	socket.on("answer", (data) => {
		socket.to(data.target).emit("answer", {
			sender: socket.id,
			answer: data.answer
		});
	});


	socket.on("ice-candidate", (data) => {
		socket.to(data.target).emit("ice-candidate", {
			sender: socket.id,
			candidate: data.candidate
		});
	});


	socket.on("disconnect", () => {
		if (users[socket.id]) {
			console.log(users[socket.id].username, "left");

			delete users[socket.id];

			io.emit("user-list", users);

			socket.broadcast.emit("user-left", socket.id);
		}
	});
});


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`server running on port ${PORT}`);
});