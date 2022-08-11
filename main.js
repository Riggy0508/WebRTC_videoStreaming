import './style.css';
import javascriptLogo from './javascript.svg';
import { setupCounter } from './counter.js';

import * as firebase from 'firebase/app';
import 'firebase/firestore';

setupCounter(document.querySelector('#counter'));

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyCyZ58W63V20XHy9blBGq7XLVf_y2Ru-II',
  authDomain: 'webrtc-demo-dad8e.firebaseapp.com',
  projectId: 'webrtc-demo-dad8e',
  storageBucket: 'webrtc-demo-dad8e.appspot.com',
  messagingSenderId: '885071804213',
  appId: '1:885071804213:web:7ad82e769e18fa8a7dfe7c',
  measurementId: 'G-SQ51BXLY76',
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

//global State managing a peer-to-peer connection
//stun server--Will be using the free-one's provided by google

const servers = {
  iceServers: [
    {
      urls: ['stun:stun2.l.google.com:19302', 'stun:stun4.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc = new RTCPeerConnection(servers);
//creating two variable for local stream and remote stream

let localStream = null;
let remoteStream = null;

//grabbing a bunch of element's from the index.html

const webButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteButton = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

//creating a click event on the button webcam

webButton.onclick = async () => {
  console.log('clicked');
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  console.log('clicked');
  remoteStream = new MediaStream();

  //streaming to peer connection ===local stream

  localStream.getTracks().forEach((track) => {
    //here we are pushing the audio and vidoe to the peer connection
    pc.addTrack(track, localStream);
  });

  //here we are pulling the track's from the remote stream and then adding it to the video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

//creating an offer to manage the firing of stream from local to remote and manage the answer from both user's

callButton.onclick = async () => {
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  //getting caller details and saving it in the database
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON()); //setupping up the listener function before setLocalDescription
  };

  callInput.value = callDoc.id;
  // the above line helps the user to join the call from anywhere around the world

  //create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  //listing for the remote answer

  callDoc.onSnapShot((snapshot) => {
    //here we are listeing to the changes made on the firesotre
    const data = snapshot.data();

    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription); //here we are listening in our databse for answer and once the  answer recived we update it on the peer connection
    }
  });
  answerCandidates.onSnapShot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type == 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// here we are creating a method to make a call with a uniqueID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};
