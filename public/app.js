const socket = io();

const joinBtn = document.getElementById("joinBtn");
const muteBtn = document.getElementById("muteBtn");
const usernameInput = document.getElementById("username");
const status = document.getElementById("status");
const userList = document.getElementById("userList");

let localStream = null;
let joined = false;
let muted = false;

const screenBtn = document.getElementById("screenBtn");
const screenVideo = document.getElementById("screenVideo");

let screenStream = null;
let sharingScreen = false;

const peers = {};

const volumeSlider = document.getElementById("volumeSlider");

let remoteAudios = [];

joinBtn.addEventListener("click", async () => {
	if (!joined) {
		const username = usernameInput.value.trim();

		if (!username) {
			alert("please enter a username");
			return;
		}

		try {
			localStream = await navigator.mediaDevices.getUserMedia({
				audio: true
			});

			socket.emit("join-call", username);

			joined = true;
			usernameInput.disabled = true;
			
			joinBtn.textContent = "leave voice call? :(";
			
			muteBtn.disabled = false;
			screenBtn.disabled = false;
			
			status.textContent = "connected!!! :3";
		} catch (err) {
			console.error(err);
			alert("microphone permission denied");
		}
	} else {
		leaveCall();
	}
});
function leaveCall() {
	joined = false;
	usernameInput.disabled = false;
	joinBtn.textContent = "join voice call";
	status.textContent = "not connected";
	muteBtn.disabled = true;
	muted = false;
	muteBtn.textContent = "mute";
	if (localStream) {
		localStream.getTracks().forEach(track => track.stop());
		localStream = null;
	}
	for (const id in peers) {
		peers[id].close();
		delete peers[id];
	}
	socket.emit("leave-call");
}
socket.on("user-list", users => {
	userList.innerHTML = "";

	for (const id in users) {
		const div = document.createElement("div");
		div.className = "user";
		div.textContent = users[id].username;
		userList.appendChild(div);
	}
});
socket.on("existing-users", users => {
	users.forEach(id => {
		createPeer(id, true);
	});
});
socket.on("user-joined", id => {
	createPeer(id, false);
});
async function createPeer(id, offer) {
	if (peers[id]) return peers[id];

	const peer = new RTCPeerConnection({
		iceServers: [
			{
				urls: "stun:stun.l.google.com:19302"
			}
		]
	});
	peers[id] = peer;
	localStream.getTracks().forEach(track => {
		peer.addTrack(track, localStream);
	});
	peer.ontrack = event => {
		if (event.track.kind === "audio") {
			let audio = document.getElementById("audio-" + id);

			if (!audio) {
				audio = document.createElement("audio");
				audio.id = "audio-" + id;
				audio.autoplay = true;
				document.body.appendChild(audio);
			}
			audio.srcObject = event.streams[0];
			audio.volume = volumeSlider.value / 100;
			remoteAudios.push(audio);
		}
		if (event.track.kind === "video") {
			let video = document.getElementById("video-" + id);

			if (!video) {
				video = document.createElement("video");
				video.id = "video-" + id;
				video.autoplay = true;
				video.style.width = "90%";
				video.style.maxWidth = "1200px";
				document.body.appendChild(video);
			}			video.srcObject = event.streams[0];
		}
	};
	peer.onicecandidate = event => {
		if (event.candidate) {
			socket.emit("ice-candidate", {
				target: id,
				candidate: event.candidate
			});
		}
	};
	if (offer) {
		const offerData = await peer.createOffer();
		await peer.setLocalDescription(offerData);
		socket.emit("offer", {
			target: id,
			offer: offerData
		});
	}
	return peer;
}
socket.on("offer", async data => {
	const peer = await createPeer(data.sender, false);
	await peer.setRemoteDescription(data.offer);
	const answer = await peer.createAnswer();
	await peer.setLocalDescription(answer);
	socket.emit("answer", {
		target: data.sender,
		answer: answer
	});
});
socket.on("answer", async data => {
	const peer = peers[data.sender];
	if (peer) {
		await peer.setRemoteDescription(data.answer);
	}
});

//NOT THAT ICE
socket.on("ice-candidate", async data => {
	const peer = peers[data.sender];
	if (peer) {
		await peer.addIceCandidate(data.candidate);
	}
});

socket.on("user-left", id => {
	if (peers[id]) {
		peers[id].close();
		delete peers[id];
	}
	const audio = document.getElementById("audio-" + id);
	if (audio) {
		audio.remove();
	}
});
muteBtn.addEventListener("click", () => {
	if (!localStream) return;
	muted = !muted;
	localStream.getAudioTracks()[0].enabled = !muted;
	muteBtn.textContent = muted ? "unmute" : "mute";
});
screenBtn.addEventListener("click", async () => {
	if (!sharingScreen) {
		try {
			screenStream = await navigator.mediaDevices.getDisplayMedia({
				video: true
			});
			const screenTrack = screenStream.getVideoTracks()[0];
			screenVideo.srcObject = screenStream;
			screenVideo.style.display = "block";
			sharingScreen = true;
			screenBtn.textContent = "stop sharing";
			for (const id in peers) {
				const peer = peers[id];

				peer.addTrack(screenTrack, screenStream);

				const offer = await peer.createOffer();

				await peer.setLocalDescription(offer);

				socket.emit("offer", {
					target: id,
					offer: offer
				});
			}
			screenTrack.onended = () => {
				stopSharingScreen();
			};

		} catch (err) {
			console.log("screen share cancelled");
		}
	} else {
		stopSharingScreen();
	}
});
function stopSharingScreen() {
	if (!screenStream) return;

	screenStream.getTracks().forEach(track => {
		track.stop();
	});

	screenStream = null;

	screenVideo.srcObject = null;
	screenVideo.style.display = "none";

	sharingScreen = false;
	screenBtn.textContent = "share screen";
}
volumeSlider.addEventListener("input", () => {
	const volume = volumeSlider.value / 100;

	remoteAudios.forEach(audio => {
		audio.volume = volume;
	});
});