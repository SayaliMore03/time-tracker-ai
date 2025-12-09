// Firebase init (Compat)
const firebaseConfig = {
  apiKey: "AIzaSyDIHgtdmvpQKosL9KuLLxv1-1pZRGhMFJ0",
  authDomain: "time-tracker-ai-b6dcc.firebaseapp.com",
  projectId: "time-tracker-ai-b6dcc",
  storageBucket: "time-tracker-ai-b6dcc.appspot.com",
  messagingSenderId: "1025341819192",
  appId: "1:1025341819192:web:17016b0443f7f62eeb59cd",
  measurementId: "G-E3ESF1TPZQ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
